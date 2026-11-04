# Borrowly

[แผนภาพเส้นทางการกดใช้งานและไฟล์ที่ถูกเรียก](CLICK_FLOW.md)

เว็บยืมของที่สร้างด้วย Svelte + Tailwind CSS + PocketBase โดยออกแบบให้ component แยกชัดเจนและเริ่มใช้งานได้ด้วย mock data

## เริ่มต้น

```bash
npm install
npm run dev
```

ถ้าต้องการต่อ PocketBase ให้คัดลอก `.env.example` เป็น `.env` แล้วตั้งค่า `VITE_POCKETBASE_URL`

## PocketBase collections ที่คาดหวัง

- `items`: `name`, `category`, `description`, `image`, `available`, `total`, `location`
- `loan_requests`: `items` (relation), `quantities` (json), `borrowerName`, `email`, `dueDate`, `note`, `status`
- `loan_items`: `request` (relation), `item` (relation), `quantity`, `status` (`borrowed`/`returned`), `returned_at`
- `admin_actions`: บันทึก Audit Log เมื่อแอดมินหรืออาจารย์ Approve/Reject คำขอยืม

สำหรับ flow การอนุมัติ ให้เพิ่ม field ใน `loan_requests` เพิ่ม:

- `requester`: Relation → `users`
- `teacher`: Relation → `users`
- `caretaker`: Relation → `users`
- `status`: Select → `pending_teacher`, `pending_caretaker`, `approved`, `rejected`

ลำดับการทำงานคือ ผู้ยืมส่งคำขอ → ผู้ใช้ `teachers` กดรับทราบ → ผู้ใช้ `superadmin` กดอนุมัติหรือไม่อนุมัติ ที่หน้า `/approvals`

## Schema ที่ต้องมีครบ

### `users` (Auth collection ที่มีอยู่แล้ว)

- `email`: built-in Email
- `name`: Text — ชื่อที่จะแสดงในคำขอ
- `user_type`: Relation แบบ Single → `user_type`

ชื่อและอีเมลในหน้าส่งคำขอจะอ่านจาก record นี้เท่านั้น ผู้ใช้แก้จากฟอร์มไม่ได้

### `user_type` (มีอยู่แล้ว)

- `type`: Text
- ต้องมีค่า `students`, `teachers`, `staff`, `superadmin`

### `items` (ต้องสร้าง)

- `name`: Text, required
- `category`: Text, required
- `description`: Text
- `image`: URL หรือ File
- `available`: Number
- `total`: Number
- `location`: Text

### `loan_requests` (ต้องสร้าง)

- `requester`: Relation แบบ Single → `users`, required
- `borrowerName`: Text, required — snapshot จาก `users.name`
- `email`: Email, required — snapshot จาก `users.email`
- `itemIds`: JSON, required
- `dueDate`: Date, required
- `note`: Text
- `teacher`: Relation แบบ Single → `users`
- `caretaker`: Relation แบบ Single → `users`
- `status`: Select แบบ Single, required:
  - `pending_teacher`
  - `pending_caretaker`
  - `approved`
  - `rejected`

### API Rules แนะนำ

`items`

- List/View: เปิดให้ authenticated อ่านได้
- Create/Update/Delete: `@request.auth.expand.user_type.type = "superadmin"`

`loan_requests`

- Create: `@request.auth.id != ""`
- List/View: `requester = @request.auth.id || teacher = @request.auth.id || @request.auth.expand.user_type.type = "superadmin"`
- Update: ให้เปิดเฉพาะผู้ตรวจตาม flow หรือจัดการผ่าน server hook
- Delete: เฉพาะ `superadmin`

โครงสร้างหลักอยู่ที่ `src/lib/components` และ service เชื่อมฐานข้อมูลอยู่ที่ `src/lib/pocketbase.js` เพื่อให้เปลี่ยน UI หรือ backend แยกกันได้ง่าย

## สถิติหน้าแอดมิน

หน้า `/admin` คำนวณสถิติจาก `items` และ `loan_requests` ชุดเดียวกับรายการที่แสดงบนหน้า เพื่อลด request ซ้ำและป้องกันค่ากระพริบจากข้อมูลคนละ snapshot รองรับช่วงวันนี้, 7 วัน, เดือนนี้, ปีนี้ และทั้งหมด พร้อม drill-down ไปยังคำขอทั้งหมด, รออนุมัติ, กำลังยืม, เกินกำหนด และคืนแล้ว

ข้อมูลที่แสดงประกอบด้วยจำนวนคำขอและผู้ยืม, อุปกรณ์พร้อมยืม, อุปกรณ์ยอดนิยม, แนวโน้มคำขอ และอัตราคืนตรงเวลา โดยอัปเดตจาก PocketBase realtime หลังโหลดครั้งแรก ไม่ต้องเพิ่ม collection สำหรับสถิติ

หมายเหตุสำหรับ PocketBase ตัวปัจจุบัน: collection `users` ใช้ relation field ชื่อ `user_type` ไปยัง collection `user_type` และหน้า `/admin` อนุญาตผู้ใช้ประเภท `admin` (id `000000000000000`) และ `superadmin` (id `000000000000009`)

หน้า Login เรียก `listAuthMethods()` แล้วเลือก provider จาก `VITE_POCKETBASE_OIDC_PROVIDER` (ค่าเริ่มต้น `oidc`) ดังนั้นต้องเปิดและตั้งค่า OIDC provider ใน PocketBase ก่อน
# brrow-item



## GitHub Actions deploy

วิธีตั้งค่า SSH, ENV_FILE, PM2 และ deploy อัตโนมัติ: [คู่มือ deploy](https://github.com/CSNIS-CSKmitl/Docs/blob/main/Projects/borrowly/docs/DEPLOY.md)

## เอกสารกฎหมาย

- [นโยบายความเป็นส่วนตัว](https://req.cskmitl.com/privacy)
- [ข้อกำหนดการใช้งาน](https://req.cskmitl.com/terms)

