export const statusLabels = {
  pending_teacher: 'รอ อจ. รับทราบ',
  pending_caretaker: 'รอคนดูแลอนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ',
};

export function getStatusLabel(request) {
  if (!request) return '-';
  if (request.status === 'rejected' && request.teacherComment) return 'อาจารย์ไม่อนุมัติ';
  if (request.status === 'rejected' && request.adminComment) return 'ผู้ดูแลไม่อนุมัติ';
  return statusLabels[request.status] || request.status || '-';
}

export function getStatusBadgeClass(status) {
  switch (status) {
    case 'pending_teacher':
      // Amber / Warm Orange-Yellow (รอ อจ. รับทราบ)
      return 'bg-amber-50 text-amber-900 border border-amber-300/90';
    case 'pending_caretaker':
      // Bright Blue (รอผู้ดูแลอนุมัติ)
      return 'bg-blue-50 text-blue-800 border border-blue-300/90';
    case 'approved':
      // Emerald Green (อนุมัติแล้ว)
      return 'bg-emerald-50 text-emerald-800 border border-emerald-300/90';
    case 'rejected':
      // Rose Red (ไม่อนุมัติ)
      return 'bg-rose-50 text-rose-800 border border-rose-300/90';
    default:
      return 'bg-gray-50 text-gray-700 border border-gray-200';
  }
}

export function getStatusDotClass(status) {
  switch (status) {
    case 'pending_teacher':
      return 'bg-amber-500';
    case 'pending_caretaker':
      return 'bg-blue-500';
    case 'approved':
      return 'bg-emerald-500';
    case 'rejected':
      return 'bg-rose-500';
    default:
      return 'bg-gray-400';
  }
}
