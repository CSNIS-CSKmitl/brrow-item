export const PICKUP_LOCATION = "อาคารพระจอมเกล้า ห้อง 713";

function generateSlots(startHour, endHour, stepMinutes = 15) {
  const slots = [];
  const startTotal = startHour * 60;
  const endTotal = endHour * 60;
  for (let m = startTotal; m + stepMinutes <= endTotal; m += stepMinutes) {
    const sh = String(Math.floor(m / 60)).padStart(2, "0");
    const sm = String(m % 60).padStart(2, "0");
    const eh = String(Math.floor((m + stepMinutes) / 60)).padStart(2, "0");
    const em = String((m + stepMinutes) % 60).padStart(2, "0");
    slots.push(`${sh}:${sm}-${eh}:${em}`);
  }
  return slots;
}

export const MORNING_SLOTS = generateSlots(9, 12, 15);
export const AFTERNOON_SLOTS = generateSlots(13, 16, 15);
export const ALL_PICKUP_SLOTS = [...MORNING_SLOTS, ...AFTERNOON_SLOTS];

export function getTodayBangkokDateStr(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function isWeekday(dateStr) {
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return false;
  }
  const dayOfWeek = dt.getUTCDay(); // 0 = Sun, 6 = Sat
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

export function isValidPickupDate(dateStr, todayStr = getTodayBangkokDateStr()) {
  if (!isWeekday(dateStr)) return false;
  return dateStr >= todayStr;
}

export function isValidPickupSlot(slot) {
  return ALL_PICKUP_SLOTS.includes(String(slot || "").trim());
}

export function getNextWeekdayDateStr(now = new Date()) {
  const todayStr = getTodayBangkokDateStr(now);
  const [y, m, d] = todayStr.split("-").map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  for (let i = 0; i < 7; i++) {
    const candidate = cursor.toISOString().slice(0, 10);
    if (isWeekday(candidate)) return candidate;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return todayStr;
}

export function buildPickupIsoTime(dateStr, slot) {
  if (!isWeekday(dateStr) || !isValidPickupSlot(slot)) return "";
  const [startTime] = String(slot).split("-");
  const dt = new Date(`${dateStr}T${startTime}:00+07:00`);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString();
}

export function formatPickupDateThai(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) {
    return dateStr || "-";
  }
  const dt = new Date(`${dateStr}T00:00:00+07:00`);
  if (Number.isNaN(dt.getTime())) return dateStr;
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(dt);
}

export function formatPickupSchedule(request) {
  if (!request) return "-";
  const datePart = request.pickup_date
    ? formatPickupDateThai(request.pickup_date)
    : "";
  const slotPart = request.pickup_slot ? `${request.pickup_slot} น.` : "";
  if (datePart && slotPart) return `${datePart} เวลา ${slotPart}`;
  if (datePart) return datePart;
  if (slotPart) return slotPart;
  return "-";
}

export function needsUserPickupSelection(request) {
  if (!request || request.status !== "approved") return false;
  const ps = String(request.pickup_status || "").trim();
  return (
    !ps ||
    ps === "none" ||
    ps === "pending_user_select" ||
    ps === "reschedule_requested"
  );
}

export function getPickupStatusMeta(status) {
  switch (String(status || "").trim()) {
    case "pending_user_select":
      return {
        label: "รอผู้ยืมเลือกเวลานัดรับ",
        badgeClass: "bg-amber-50 text-amber-900 border border-amber-300/90",
        dotClass: "bg-amber-500",
      };
    case "pending_caretaker_confirm":
      return {
        label: "รอผู้ดูแลยืนยันเวลานัดรับ",
        badgeClass: "bg-indigo-50 text-indigo-800 border border-indigo-300/90",
        dotClass: "bg-indigo-500",
      };
    case "confirmed":
      return {
        label: "ยืนยันเวลานัดรับแล้ว",
        badgeClass:
          "bg-emerald-50 text-emerald-800 border border-emerald-300/90",
        dotClass: "bg-emerald-500",
      };
    case "reschedule_requested":
      return {
        label: "ผู้ดูแลขอเปลี่ยนเวลานัดรับ",
        badgeClass: "bg-rose-50 text-rose-800 border border-rose-300/90",
        dotClass: "bg-rose-500",
      };
    case "picked_up":
      return {
        label: "รับอุปกรณ์แล้ว",
        badgeClass: "bg-teal-50 text-teal-800 border border-teal-300/90",
        dotClass: "bg-teal-500",
      };
    default:
      return {
        label: "",
        badgeClass: "bg-slate-50 text-slate-700 border border-slate-200",
        dotClass: "bg-slate-400",
      };
  }
}
