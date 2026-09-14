# CMS quản lý chấm công, phạt và xác nhận lương

Giao diện quản trị cho OA, người nhập liệu, người duyệt và quản trị viên. CMS dùng template UI của [CMS_ABCLIVE](../CMS_ABCLIVE) (dark theme xanh, sidebar, DataTable, login MFA) và gọi **CMS API** tại `Management_Employee_CMS_API`.

Nhân viên tra cứu dữ liệu cá nhân trên Client riêng — repo này không chứa cổng nhân viên.

## Chức năng

- Đăng nhập MFA, đổi mật khẩu bắt buộc, step-up OTP cho thao tác rủi ro cao
- Hồ sơ nhân viên và đồng bộ LARK hai bước (xem trước → áp dụng)
- Nhập file Excel theo mẫu: chấm công, phạt, lương
- Xem/sửa staging, gửi duyệt, duyệt/từ chối (tách người nhập và người duyệt)
- Công bố kỳ và khóa kỳ
- Xử lý khiếu nại (không sửa dữ liệu gốc từ màn này)
- Quản lý tài khoản CMS và nhật ký audit

## Chạy trên máy phát triển

Yêu cầu: Node.js >= 20, CMS API đang chạy ở `http://localhost:3001`.

```bash
cp .env.example .env.development
npm install
npm run dev
```

Mở `http://localhost:5174`. Vite proxy `/cms-api` sang API. CORS của API mặc định cho origin `http://localhost:5174`.

Tài khoản quản trị đầu tiên tạo từ API:

```bash
cd ../Management_Employee_CMS_API
npm run db:create-admin -- --username=... --email=... --name="..." --roles=system_admin
```

## Workflow dữ liệu

```text
DRAFT → UPLOADED → VALIDATED → PENDING_APPROVAL → APPROVED → PUBLISHED → LOCKED
```

Chấm công/phạt công bố trước ngày 03; bảng lương trước ngày 11.
