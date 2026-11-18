import nodemailer from "nodemailer";
import { getUserRoles } from "../roles.js";

/**
 * Escapes characters to prevent HTML injection in emails.
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitizes header strings to prevent email header injection (CRLF).
 */
export function sanitizeHeader(str) {
  if (!str) return "";
  return String(str).replace(/[\r\n]+/g, " ").trim();
}

function getTransporter(smtpEnv = process.env) {
  const host = smtpEnv.SMTP_HOST;
  const port = Number(smtpEnv.SMTP_PORT || 587);
  const secure = smtpEnv.SMTP_SECURE === "true" || port === 465;
  const user = smtpEnv.SMTP_USER;
  const pass = smtpEnv.SMTP_PASS;

  if (!host || !user) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

async function getEmailsByRoles(pbAdmin, ...targetRoles) {
  try {
    const users = await pbAdmin.collection("users").getFullList({
      expand: "user_type",
      fields: "id,email,user_type,roles,expand",
      requestKey: null,
    });
    return users
      .filter((u) => {
        const uRoles = getUserRoles(u);
        return targetRoles.some((tr) => uRoles.includes(tr));
      })
      .map((u) => u.email)
      .filter(Boolean);
  } catch (err) {
    console.error("[Borrowly Notification] Failed to query users by roles:", err);
    return [];
  }
}

/**
 * Resolves email recipients for Borrowly loan events:
 * - Student creates loan: notify selected teacher + super_admin
 * - Teacher or Staff creates loan: notify super_admin
 * - Teacher approves/acknowledges loan (pending_caretaker): notify super_admin
 */
export async function resolveLoanRecipients(
  pbAdmin,
  { event, borrower, teacherEmail, actorEmail },
) {
  const recipients = new Set();
  const superAdminEmails = await getEmailsByRoles(
    pbAdmin,
    "super_admin",
    "superadmin",
  );

  if (event === "teacher_approved") {
    superAdminEmails.forEach((e) => recipients.add(e.toLowerCase().trim()));
  } else if (event === "created") {
    const borrowerRoles = getUserRoles(borrower);
    const isTeacherOrStaff = borrowerRoles.some((r) =>
      ["teacher", "teachers", "staff"].includes(r),
    );

    if (!isTeacherOrStaff && teacherEmail && teacherEmail.includes("@")) {
      recipients.add(teacherEmail.toLowerCase().trim());
    }
    superAdminEmails.forEach((e) => recipients.add(e.toLowerCase().trim()));
  }

  const excludeEmails = [borrower?.email, actorEmail]
    .filter(Boolean)
    .map((e) => String(e).toLowerCase().trim());
  for (const excluded of excludeEmails) {
    recipients.delete(excluded);
  }

  return Array.from(recipients);
}

function formatDateBangkok(isoOrDate) {
  if (!isoOrDate) return "-";
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return String(isoOrDate);
  return d.toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Sends a loan notification email via SMTP if configured.
 */
export async function sendLoanNotificationEmail(
  { to, event, requestRecord, itemSummaries = [], actorName = "" },
  smtpEnv = process.env,
) {
  if (!to || to.length === 0) return false;

  const transporter = getTransporter(smtpEnv);
  if (!transporter) {
    console.warn(
      "[Borrowly Notification] SMTP is not configured (SMTP_HOST/SMTP_USER missing). Skipping email.",
    );
    return false;
  }

  const from =
    smtpEnv.SMTP_FROM || `CS-KMITL Borrowly <${smtpEnv.SMTP_USER}>`;
  const origin = smtpEnv.ORIGIN || "https://req.cskmitl.com";
  const approvalsUrl = `${origin.replace(/\/$/, "")}/approvals`;

  const borrowerName = requestRecord?.borrowerName || "-";
  const borrowerEmail = requestRecord?.email || "-";
  const teacherName =
    requestRecord?.expand?.teacher?.name ||
    requestRecord?.expand?.teacher?.email ||
    "-";
  const dueDateLabel = formatDateBangkok(requestRecord?.dueDate);
  const noteText = requestRecord?.note || "-";
  const itemsText =
    itemSummaries.length > 0 ? itemSummaries.join(", ") : "-";

  const isTeacherApproved = event === "teacher_approved";
  const subject = isTeacherApproved
    ? sanitizeHeader(
        `[Borrowly] อาจารย์รับทราบคำขอยืมแล้ว: ${borrowerName}`,
      )
    : sanitizeHeader(`[Borrowly] คำขอยืมอุปกรณ์ใหม่: ${borrowerName}`);

  const heading = isTeacherApproved
    ? "อาจารย์รับทราบคำขอยืมอุปกรณ์แล้ว (รออนุมัติส่งมอบ)"
    : "มีการยื่นคำขอยืมอุปกรณ์ใหม่";

  const itemsHtml =
    itemSummaries.length > 0
      ? itemSummaries.map((s) => `<li>${escapeHtml(s)}</li>`).join("")
      : "<li>-</li>";

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b;">
      <div style="background-color: #16a34a; color: #ffffff; padding: 20px 24px;">
        <h2 style="margin: 0; font-size: 20px;">${escapeHtml(heading)}</h2>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">ระบบยืม-คืนอุปกรณ์ ภาควิชาวิทยาการคอมพิวเตอร์ (Borrowly)</p>
      </div>
      <div style="padding: 24px; background-color: #ffffff;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 130px;"><strong>ผู้ขอยืม:</strong></td>
            <td style="padding: 8px 0;">${escapeHtml(borrowerName)} (${escapeHtml(borrowerEmail)})</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; vertical-align: top;"><strong>อุปกรณ์ที่ยืม:</strong></td>
            <td style="padding: 8px 0;"><ul style="margin: 0; padding-left: 18px;">${itemsHtml}</ul></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;"><strong>กำหนดวันคืน:</strong></td>
            <td style="padding: 8px 0;">${escapeHtml(dueDateLabel)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;"><strong>อาจารย์ที่ปรึกษา:</strong></td>
            <td style="padding: 8px 0;">${escapeHtml(teacherName)}</td>
          </tr>
          ${
            isTeacherApproved && actorName
              ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>รับทราบโดย:</strong></td><td style="padding: 8px 0;">${escapeHtml(actorName)}</td></tr>`
              : ""
          }
          <tr>
            <td style="padding: 8px 0; color: #64748b;"><strong>หมายเหตุ:</strong></td>
            <td style="padding: 8px 0;">${escapeHtml(noteText)}</td>
          </tr>
        </table>
        <div style="margin-top: 20px;">
          <a href="${escapeHtml(approvalsUrl)}" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 14px;">เปิดหน้าอนุมัติคำขอ</a>
        </div>
      </div>
      <div style="padding: 14px 24px; background-color: #f8fafc; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        อีเมลนี้ส่งอัตโนมัติจากระบบ Borrowly ภาควิชาวิทยาการคอมพิวเตอร์ สจล.
      </div>
    </div>
  `;

  const text = `${heading}\nผู้ขอยืม: ${borrowerName} (${borrowerEmail})\nอุปกรณ์: ${itemsText}\nกำหนดวันคืน: ${dueDateLabel}\nอาจารย์ที่ปรึกษา: ${teacherName}\nหมายเหตุ: ${noteText}\nตรวจสอบได้ที่: ${approvalsUrl}`;

  try {
    await transporter.sendMail({
      from,
      to: to.join(", "),
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error("[Borrowly Notification] Failed to send email:", err);
    return false;
  }
}

export function resolveBorrowerEmail(requestRecord, borrower) {
  const candidates = [
    requestRecord?.email,
    borrower?.email,
    requestRecord?.expand?.requester?.email,
  ];
  for (const raw of candidates) {
    const email = String(raw || "").trim();
    if (email && email.includes("@")) {
      return email;
    }
  }
  return null;
}

/**
 * Sends a status-update email to the borrower for every loan lifecycle stage:
 * created -> teacher_approved -> approved -> returned (or rejected).
 */
export async function sendBorrowerStatusEmail(
  { to, event, requestRecord, itemSummaries = [], actorName = "" },
  smtpEnv = process.env,
) {
  if (!to) return false;

  const transporter = getTransporter(smtpEnv);
  if (!transporter) {
    console.warn(
      "[Borrowly Notification] SMTP is not configured (SMTP_HOST/SMTP_USER missing). Skipping borrower email.",
    );
    return false;
  }

  const from =
    smtpEnv.SMTP_FROM || `CS-KMITL Borrowly <${smtpEnv.SMTP_USER}>`;
  const origin = (smtpEnv.ORIGIN || "https://req.cskmitl.com").replace(/\/$/, "");
  const requestsUrl = `${origin}/requests`;

  const borrowerName = requestRecord?.borrowerName || "-";
  const teacherName =
    requestRecord?.expand?.teacher?.name ||
    requestRecord?.expand?.teacher?.email ||
    "-";
  const dueDateLabel = formatDateBangkok(requestRecord?.dueDate);
  const itemsText =
    itemSummaries.length > 0 ? itemSummaries.join(", ") : "-";
  const itemsHtml =
    itemSummaries.length > 0
      ? itemSummaries.map((s) => `<li>${escapeHtml(s)}</li>`).join("")
      : "<li>-</li>";

  const status = String(requestRecord?.status || "");
  const assetTags = String(requestRecord?.asset_tags || "").trim();
  const rejectReason = String(
    requestRecord?.adminComment || requestRecord?.teacherComment || "",
  ).trim();

  let subject = "[Borrowly] อัปเดตสถานะคำขอยืมอุปกรณ์";
  let heading = "อัปเดตสถานะคำขอยืมอุปกรณ์";
  let stepText = "กำลังดำเนินการ";
  let accentColor = "#16a34a";

  if (event === "created") {
    subject = "[Borrowly] ส่งคำขอยืมอุปกรณ์เรียบร้อยแล้ว";
    heading = "ส่งคำขอยืมอุปกรณ์เรียบร้อยแล้ว";
    accentColor = "#2563eb";
    if (status === "pending_teacher") {
      stepText = `ขั้นตอนปัจจุบัน: รออาจารย์ที่ปรึกษา (${teacherName}) รับทราบคำขอ`;
    } else if (status === "pending_caretaker") {
      stepText = "ขั้นตอนปัจจุบัน: รอเจ้าหน้าที่อนุมัติและส่งมอบอุปกรณ์";
    } else if (status === "approved") {
      stepText = `ขั้นตอนปัจจุบัน: อนุมัติเรียบร้อยแล้ว (กำหนดคืน: ${dueDateLabel})`;
      accentColor = "#16a34a";
    }
  } else if (event === "teacher_approved") {
    subject = "[Borrowly] อาจารย์รับทราบคำขอยืมแล้ว (รออนุมัติส่งมอบ)";
    heading = "อาจารย์รับทราบคำขอยืมอุปกรณ์แล้ว";
    stepText = "ขั้นตอนปัจจุบัน: รอเจ้าหน้าที่ตรวจสอบ อนุมัติ และส่งมอบอุปกรณ์";
    accentColor = "#0284c7";
  } else if (event === "approved") {
    subject = "[Borrowly] อนุมัติคำขอยืมอุปกรณ์เรียบร้อยแล้ว";
    heading = "คำขอยืมอุปกรณ์ได้รับการอนุมัติแล้ว";
    stepText = `ขั้นตอนปัจจุบัน: กำลังยืมอุปกรณ์ (กรุณาคืนภายใน ${dueDateLabel})`;
    accentColor = "#16a34a";
  } else if (event === "rejected") {
    subject = "[Borrowly] คำขอยืมอุปกรณ์ไม่ได้รับการอนุมัติ";
    heading = "คำขอยืมอุปกรณ์ไม่ได้รับการอนุมัติ";
    stepText = "สถานะ: ไม่ผ่านการอนุมัติ";
    accentColor = "#dc2626";
  } else if (event === "returned") {
    subject = "[Borrowly] บันทึกการคืนอุปกรณ์เรียบร้อยแล้ว";
    heading = "บันทึกการคืนอุปกรณ์เรียบร้อยแล้ว";
    stepText = "สถานะ: คืนอุปกรณ์ครบถ้วนเรียบร้อยแล้ว ขอบคุณครับ";
    accentColor = "#0f766e";
  }

  const extraRows = [
    actorName && event !== "created"
      ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>ดำเนินการโดย:</strong></td><td style="padding: 8px 0;">${escapeHtml(actorName)}</td></tr>`
      : "",
    assetTags && event === "approved"
      ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>เลขครุภัณฑ์ / SN:</strong></td><td style="padding: 8px 0;">${escapeHtml(assetTags)}</td></tr>`
      : "",
    rejectReason && event === "rejected"
      ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>เหตุผล:</strong></td><td style="padding: 8px 0; color: #b91c1c;">${escapeHtml(rejectReason)}</td></tr>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b;">
      <div style="background-color: ${accentColor}; color: #ffffff; padding: 20px 24px;">
        <h2 style="margin: 0; font-size: 20px;">${escapeHtml(heading)}</h2>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.92;">ระบบยืม-คืนอุปกรณ์ ภาควิชาวิทยาการคอมพิวเตอร์ (Borrowly)</p>
      </div>
      <div style="padding: 24px; background-color: #ffffff;">
        <div style="margin-bottom: 16px; padding: 12px 14px; border-radius: 8px; background-color: #f8fafc; border-left: 4px solid ${accentColor}; font-size: 14px; font-weight: 600; color: #0f172a;">
          ${escapeHtml(stepText)}
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 135px;"><strong>ผู้ขอยืม:</strong></td>
            <td style="padding: 8px 0;">${escapeHtml(borrowerName)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; vertical-align: top;"><strong>อุปกรณ์ที่ยืม:</strong></td>
            <td style="padding: 8px 0;"><ul style="margin: 0; padding-left: 18px;">${itemsHtml}</ul></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;"><strong>กำหนดวันคืน:</strong></td>
            <td style="padding: 8px 0;">${escapeHtml(dueDateLabel)}</td>
          </tr>
          ${extraRows}
        </table>
        <div style="margin-top: 20px;">
          <a href="${escapeHtml(requestsUrl)}" style="display: inline-block; background-color: ${accentColor}; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 14px;">ติดตามสถานะคำขอของฉัน</a>
        </div>
      </div>
      <div style="padding: 14px 24px; background-color: #f8fafc; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        อีเมลนี้ส่งอัตโนมัติจากระบบ Borrowly ภาควิชาวิทยาการคอมพิวเตอร์ สจล.
      </div>
    </div>
  `;

  const text = `${heading}\n${stepText}\nผู้ขอยืม: ${borrowerName}\nอุปกรณ์: ${itemsText}\nกำหนดวันคืน: ${dueDateLabel}${
    assetTags && event === "approved" ? `\nเลขครุภัณฑ์ / SN: ${assetTags}` : ""
  }${rejectReason && event === "rejected" ? `\nเหตุผล: ${rejectReason}` : ""}\nติดตามสถานะได้ที่: ${requestsUrl}`;

  try {
    await transporter.sendMail({
      from,
      to,
      subject: sanitizeHeader(subject),
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error("[Borrowly Notification] Failed to send borrower email:", err);
    return false;
  }
}
