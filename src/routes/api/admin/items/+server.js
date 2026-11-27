import { json } from "@sveltejs/kit";
import { adminPocketBase } from "$lib/server/pocketbase";
import { isBorrowlyAdmin } from "$lib/roles";

const ALLOWED_FIELDS = [
  "name",
  "category",
  "description",
  "image",
  "total",
  "available",
  "location",
  "is_active",
];

function pickItemFields(body) {
  const data = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) {
      data[key] = body[key];
    }
  }
  return data;
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function formatPocketBaseError(err, fallback) {
  const fieldErrors = err?.response?.data;
  if (fieldErrors && typeof fieldErrors === "object") {
    const details = Object.entries(fieldErrors)
      .map(([field, info]) => `${field}: ${info?.message || "invalid"}`)
      .filter(Boolean);
    if (details.length > 0) {
      return `${err?.response?.message || fallback} (${details.join(", ")})`;
    }
  }
  return err?.response?.message || err?.message || fallback;
}

export async function POST({ request, locals }) {
  if (!locals.user) {
    return json({ message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" }, { status: 401 });
  }
  if (!isBorrowlyAdmin(locals.user)) {
    return json({ message: "ไม่มีสิทธิ์เพิ่มอุปกรณ์" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const payload = {
    is_active: true,
    ...pickItemFields(body),
    created_by: locals.user.id,
    updated_by: locals.user.id,
  };

  if (!String(payload.name || "").trim()) {
    return json({ message: "กรุณาระบุชื่ออุปกรณ์" }, { status: 400 });
  }

  const imageUrl = String(payload.image || "").trim();
  if (imageUrl && !isValidHttpUrl(imageUrl)) {
    return json(
      { message: "URL รูปภาพไม่ถูกต้อง (ต้องขึ้นต้นด้วย http:// หรือ https:// หรือเว้นว่างไว้)" },
      { status: 400 },
    );
  }
  payload.image = imageUrl;

  try {
    const pb = await adminPocketBase();
    const created = await pb.collection("items").create(payload);
    return json(created, { status: 201 });
  } catch (err) {
    console.error("[api/admin/items] POST failed:", err);
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    const message = formatPocketBaseError(err, "เพิ่มอุปกรณ์ไม่สำเร็จ");
    return json({ message }, { status });
  }
}
