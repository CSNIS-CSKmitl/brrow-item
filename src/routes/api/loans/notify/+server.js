import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { adminPocketBase } from "$lib/server/pocketbase";
import { isBorrowlyAdmin } from "$lib/roles";
import {
  resolveBorrowerEmail,
  resolveLoanRecipients,
  sendBorrowerStatusEmail,
  sendLoanNotificationEmail,
} from "$lib/server/notification";

const ALLOWED_EVENTS = new Set([
  "created",
  "teacher_approved",
  "approved",
  "rejected",
  "returned",
  "pickup_proposed",
  "pickup_confirmed",
  "pickup_reschedule",
  "picked_up",
]);

export async function POST({ request, locals }) {
  if (!locals.user?.id) {
    return json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = String(body?.id || "").trim();
    const event = String(body?.event || "").trim();

    if (!id || !ALLOWED_EVENTS.has(event)) {
      return json({ ok: false, error: "invalid payload" }, { status: 400 });
    }

    const pb = await adminPocketBase();
    const record = await pb.collection("loan_requests").getOne(id, {
      expand: "requester,teacher,items",
      requestKey: null,
    });

    const isRequester = record.requester === locals.user.id;
    const isAssignedTeacher = record.teacher === locals.user.id;
    const isAdm = isBorrowlyAdmin(locals.user);

    if (
      (event === "created" || event === "pickup_proposed") &&
      !isRequester &&
      !isAdm
    ) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    if (event === "teacher_approved" && !isAssignedTeacher && !isAdm) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    if (event === "rejected" && !isAssignedTeacher && !isAdm) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    if (
      (event === "approved" ||
        event === "returned" ||
        event === "pickup_confirmed" ||
        event === "pickup_reschedule" ||
        event === "picked_up") &&
      !isAdm
    ) {
      return json({ error: "forbidden" }, { status: 403 });
    }

    if (event === "teacher_approved" && record.status !== "pending_caretaker") {
      return json({ ok: true, sent: false }, { status: 409 });
    }
    if (
      (event === "approved" || event === "rejected" || event === "returned") &&
      record.status !== event
    ) {
      return json({ ok: true, sent: false }, { status: 409 });
    }
    if (
      event === "pickup_proposed" &&
      (record.status !== "approved" ||
        record.pickup_status !== "pending_caretaker_confirm")
    ) {
      return json({ ok: true, sent: false }, { status: 409 });
    }
    if (
      event === "pickup_confirmed" &&
      (record.status !== "approved" || record.pickup_status !== "confirmed")
    ) {
      return json({ ok: true, sent: false }, { status: 409 });
    }
    if (
      event === "pickup_reschedule" &&
      (record.status !== "approved" ||
        record.pickup_status !== "reschedule_requested")
    ) {
      return json({ ok: true, sent: false }, { status: 409 });
    }
    if (
      event === "picked_up" &&
      (record.status !== "approved" || record.pickup_status !== "picked_up")
    ) {
      return json({ ok: true, sent: false }, { status: 409 });
    }

    const borrower = record.expand?.requester || locals.user;
    const borrowerEmail = resolveBorrowerEmail(record, borrower);
    const expandedItems = Array.isArray(record.expand?.items)
      ? record.expand.items
      : [];
    const itemSummaries = expandedItems.map((item) => {
      const qty = Number(record.quantities?.[item.id]) || 1;
      return `${item.name || item.id} x${qty}`;
    });
    const actorName = locals.user.name || locals.user.email || "";

    let approversSent = false;
    let recipientsCount = 0;

    if (
      event === "created" ||
      event === "teacher_approved" ||
      event === "pickup_proposed"
    ) {
      const teacherEmail = record.expand?.teacher?.email || "";
      const recipients = await resolveLoanRecipients(pb, {
        event,
        borrower,
        teacherEmail,
        actorEmail: event === "teacher_approved" ? locals.user.email : undefined,
      });
      recipientsCount = recipients.length;
      if (recipients.length > 0) {
        approversSent = await sendLoanNotificationEmail(
          {
            to: recipients,
            event,
            requestRecord: record,
            itemSummaries,
            actorName,
          },
          env,
        );
      }
    }

    const borrowerSent = borrowerEmail
      ? await sendBorrowerStatusEmail(
          {
            to: borrowerEmail,
            event,
            requestRecord: record,
            itemSummaries,
            actorName,
          },
          env,
        )
      : false;

    return json({
      ok: true,
      sent: approversSent || borrowerSent,
      approversSent,
      borrowerSent,
      recipientsCount,
    });
  } catch (err) {
    console.warn("[loans/notify] failed:", err);
    return json({ ok: true, sent: false });
  }
}
