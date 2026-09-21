export function formatDateTime(val) {
  if (!val) return '-';
  const str = String(val).trim();
  const normalized = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return str;
  const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return dateStr;
  return `${dateStr} เวลา ${hours}:${minutes} น.`;
}

export function exportRequestsToCSV(requests, items = [], filename = 'loan_requests.csv') {
  const statusLabels = {
    pending_teacher: 'รอ อจ. รับทราบ',
    pending_caretaker: 'รอผู้ดูแลอนุมัติ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ไม่อนุมัติ',
  };

  const getItemName = (id) => items.find((i) => i.id === id)?.name || id;

  const headers = [
    'รหัสคำขอ',
    'ชื่อผู้ขอยืม',
    'อีเมลผู้ยืม',
    'รายการของที่ยืม',
    'วันที่ส่งคำขอ',
    'กำหนดเวลาคืน',
    'อาจารย์ผู้รับทราบ',
    'สถานะ',
    'หมายเหตุผู้ยืม',
    'ความเห็นอาจารย์',
    'หมายเลข MAC Address',
  ];

  const escapeCSV = (val) => {
    if (val == null) return '""';
    return `"${String(val).replace(/"/g, '""')}"`;
  };

  // แยกหมายเลข MAC ออกเป็น array แต่ละรายการสำหรับแสดงไล่ลงมาแถวถัดไป
  const parseMacList = (comment) => {
    if (!comment) return [];
    return comment
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const rows = [];
  for (const req of requests) {
    const macs = parseMacList(req.adminComment);
    const firstMac = macs.length > 0 ? macs[0] : (req.adminComment || '');

    // แถวแรกของคำขอ: ข้อมูลของคำขอครบถ้วน และ MAC แรก
    rows.push([
      req.id,
      req.borrowerName || '',
      req.email || '',
      (req.itemIds || []).map(getItemName).join(', '),
      formatDateTime(req.created),
      formatDateTime(req.dueDate),
      req.expand?.teacher?.name || req.expand?.teacher?.email || '',
      statusLabels[req.status] || req.status,
      req.note || '',
      req.teacherComment || '',
      firstMac,
    ]);

    // หากมีหมายเลข MAC มากกว่า 1 รายการ ให้ไล่ลงมาแถวถัดไปในคอลัมน์เดิม (คอลัมน์ A-J ว่าง)
    for (let i = 1; i < macs.length; i++) {
      rows.push([
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        macs[i],
      ]);
    }
  }

  const csvString = [
    headers.map(escapeCSV).join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ].join('\r\n');

  // ใส่ UTF-8 BOM (\uFEFF) เพื่อให้ Excel บน Windows แสดงผลภาษาไทยได้อย่างถูกต้อง
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSingleRequestToCSV(request, items = []) {
  const safeName = (request.borrowerName || 'request').replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, '_');
  const filename = `request_${safeName}_${request.id?.slice(0, 8) || 'details'}.csv`;
  exportRequestsToCSV([request], items, filename);
}

export function exportItemsToCSV(itemsList, filename = 'items_catalog.csv') {
  const headers = ['รหัส', 'ชื่อของ', 'หมวดหมู่', 'รายละเอียด', 'จำนวนทั้งหมด', 'พร้อมให้ยืม', 'สถานที่จัดเก็บ'];
  const escapeCSV = (val) => (val == null ? '""' : `"${String(val).replace(/"/g, '""')}"`);

  const rows = itemsList.map((item) => [
    item.id,
    item.name || '',
    item.category || '',
    item.description || '',
    item.total || 0,
    item.available || 0,
    item.location || '',
  ]);

  const csvString = [
    headers.map(escapeCSV).join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
