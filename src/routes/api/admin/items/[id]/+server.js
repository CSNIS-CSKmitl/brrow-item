import { json } from "@sveltejs/kit";
import { adminPocketBase } from "$lib/server/pocketbase";
import { isBorrowlyAdmin } from "$lib/roles";

const SAFE_ID = /^[a-zA-Z0-9_-]{1,64}$/;
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

export async function PATCH({ params, request, locals }) {
  if (!locals.user) {
    return json({ message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" }, { status: 401 });
  }
  if (!isBorrowlyAdmin(locals.user)) {
    return json({ message: "ไม่มีสิทธิ์แก้ไขอุปกรณ์" }, { status: 403 });
  }

  const id = params.id;
  if (!id || !SAFE_ID.test(id)) {
    return json({ message: "รหัสอุปกรณ์ไม่ถูกต้อง" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const updates = pickItemFields(body);
  if (Object.keys(updates).length === 0) {
    return json({ message: "ไม่มีข้อมูลที่ต้องการแก้ไข" }, { status: 400 });
  }

  if (updates.image !== undefined) {
    const imageUrl = String(updates.image || "").trim();
    if (imageUrl && !isValidHttpUrl(imageUrl)) {
      return json(
        { message: "URL รูปภาพไม่ถูกต้อง (ต้องขึ้นต้นด้วย http:// หรือ https:// หรือเว้นว่างไว้)" },
        { status: 400 },
      );
    }
    updates.image = imageUrl;
  }

  try {
    const pb = await adminPocketBase();
    const updated = await pb.collection("items").update(id, {
      ...updates,
      updated_by: locals.user.id,
    });
    return json(updated);
  } catch (err) {
    console.error("[api/admin/items/[id]] PATCH failed:", err);
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    const message = formatPocketBaseError(err, "แก้ไขข้อมูลอุปกรณ์ไม่สำเร็จ");
    return json({ message }, { status });
  }
}

export async function DELETE({ params, locals }) {
  if (!locals.user) {
    return json({ message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" }, { status: 401 });
  }
  if (!isBorrowlyAdmin(locals.user)) {
    return json({ message: "ไม่มีสิทธิ์ลบอุปกรณ์" }, { status: 403 });
  }

  const id = params.id;
  if (!id || !SAFE_ID.test(id)) {
    return json({ message: "รหัสอุปกรณ์ไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const pb = await adminPocketBase();
    await pb.collection("items").delete(id);
    return json({ ok: true });
  } catch (err) {
    console.error("[api/admin/items/[id]] DELETE failed:", err);
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    const message = err?.response?.message || err?.message || "ลบอุปกรณ์ไม่สำเร็จ";
    return json({ message }, { status });
  }
}
