import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { adminPocketBase } from "$lib/server/pocketbase";
import { isBorrowlyAdmin } from "$lib/roles";
import {
  resolveLoanRecipients,
  sendLoanNotificationEmail,
} from "$lib/server/notification";

export async function POST({ request, locals }) {
  if (!locals.user?.id) {
    return json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = String(body?.id || "").trim();
    const event = String(body?.event || "").trim();

    if (!id || (event !== "created" && event !== "teacher_approved")) {
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

    if (event === "created" && !isRequester && !isAdm) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    if (event === "teacher_approved" && !isAssignedTeacher && !isAdm) {
      return json({ error: "forbidden" }, { status: 403 });
    }
    if (
      event === "teacher_approved" &&
      record.status !== "pending_caretaker"
    ) {
      return json({ ok: true, sent: false }, { status: 409 });
    }

    const borrower = record.expand?.requester || locals.user;
    const teacherEmail = record.expand?.teacher?.email || "";
    const recipients = await resolveLoanRecipients(pb, {
      event,
      borrower,
      teacherEmail,
      actorEmail: event === "teacher_approved" ? locals.user.email : undefined,
    });

    const expandedItems = Array.isArray(record.expand?.items)
      ? record.expand.items
      : [];
    const itemSummaries = expandedItems.map((item) => {
      const qty = Number(record.quantities?.[item.id]) || 1;
      return `${item.name || item.id} x${qty}`;
    });

    const sent = await sendLoanNotificationEmail(
      {
        to: recipients,
        event,
        requestRecord: record,
        itemSummaries,
        actorName: locals.user.name || locals.user.email || "",
      },
      env,
    );

    return json({ ok: true, sent, recipientsCount: recipients.length });
  } catch (err) {
    console.warn("[loans/notify] failed:", err);
    return json({ ok: true, sent: false });
  }
}
