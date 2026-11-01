# Format dữ liệu (Number, Date, String…) — Hướng dẫn sử dụng

Tài liệu này mô tả cách **định dạng (format) các kiểu dữ liệu** thường gặp khi trả về response trong ứng dụng Express + Mongoose (bài thi SDN302): số, tiền tệ, ngày giờ, chuỗi, boolean… Bao gồm:

1. [Số (Number)](#1-số-number)
2. [Tiền tệ (Currency)](#2-tiền-tệ-currency)
3. [Phần trăm (Percent)](#3-phần-trăm-percent)
4. [Ngày giờ (Date)](#4-ngày-giờ-date)
5. [Chuỗi (String)](#5-chuỗi-string)
6. [Boolean & giá trị rỗng](#6-boolean--giá-trị-rỗng)
7. [Format khi định nghĩa Schema (Mongoose)](#7-format-khi-định-nghĩa-schema-mongoose)
8. [Format khi trả response (getter / toJSON)](#8-format-khi-trả-response-getter--tojson)
9. [Bảng tra nhanh](#9-bảng-tra-nhanh)
10. [Checklist](#10-checklist)

Xem thêm: [`JSProcessing.md`](./JSProcessing.md) (hàm xử lý dữ liệu) và [`MongoModel.md`](./MongoModel.md) (tạo Schema/Model).

---

## 1. Số (Number)

```javascript
const n = 1234567.891;

// toFixed(k) — làm tròn về k chữ số thập phân, trả về CHUỖI
n.toFixed(0);          // "1234568"
n.toFixed(2);          // "1234567.89"
(3.1).toFixed(2);      // "3.10"  (thêm số 0 cho đủ)

// toLocaleString — thêm dấu phân cách hàng nghìn theo locale
n.toLocaleString('vi-VN');   // "1.234.567,891"  (VN: chấm ngăn nghìn, phẩy thập phân)
n.toLocaleString('en-US');   // "1,234,567.891"  (US: ngược lại)

// Giới hạn số chữ số thập phân khi format
n.toLocaleString('vi-VN', { maximumFractionDigits: 2 }); // "1.234.567,89"
n.toLocaleString('vi-VN', { minimumFractionDigits: 2 }); // "1.234.567,89"

// Làm tròn thủ công
Math.round(3.567);     // 4
Math.floor(3.9);       // 3   (làm tròn xuống)
Math.ceil(3.1);        // 4   (làm tròn lên)
Math.round(3.567 * 100) / 100; // 3.57 (giữ 2 chữ số, kết quả là NUMBER chứ không phải chuỗi)

// Ép kiểu chuỗi -> số
Number('12.5');        // 12.5
parseInt('12px', 10);  // 12   (luôn truyền cơ số 10)
parseFloat('12.5kg');  // 12.5
Number('abc');         // NaN  -> kiểm tra bằng Number.isNaN()
```

> ⚠️ `toFixed()` và `toLocaleString()` trả về **chuỗi**, không dùng để tính toán tiếp được. Chỉ format ở **bước cuối cùng** trước khi trả response.

---

## 2. Tiền tệ (Currency)

Cách chuẩn nhất là dùng `Intl.NumberFormat` với `style: 'currency'`:

```javascript
const price = 1500000;

// VND — Việt Nam Đồng
price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
// "1.500.000 ₫"

// USD
(1500.5).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
// "$1,500.50"

// Tách riêng đối tượng formatter để tái sử dụng (hiệu quả hơn khi format nhiều lần)
const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
vnd.format(1500000);   // "1.500.000 ₫"
vnd.format(299000);    // "299.000 ₫"

// Cách thủ công (nếu không muốn ký hiệu tiền tệ)
`${price.toLocaleString('vi-VN')} đ`; // "1.500.000 đ"
```

---

## 3. Phần trăm (Percent)

```javascript
const ratio = 0.1256;  // 12.56%

// style: 'percent' tự động nhân 100 và thêm dấu %
ratio.toLocaleString('vi-VN', { style: 'percent', maximumFractionDigits: 1 });
// "12,6%"

// Cách thủ công
`${(ratio * 100).toFixed(1)}%`; // "12.6%"
```

---

## 4. Ngày giờ (Date)

### 4.1. Tạo & lấy Date

```javascript
const now = new Date();                 // Thời điểm hiện tại
const d   = new Date('2026-07-18');     // Từ chuỗi ISO
const d2  = new Date(2026, 6, 18);      // Năm, THÁNG (0-11 -> 6 = tháng 7), ngày

d.getFullYear();  // 2026
d.getMonth();     // 6   (LƯU Ý: tháng bắt đầu từ 0)
d.getDate();      // 18  (ngày trong tháng)
d.getDay();       // thứ trong tuần (0 = Chủ Nhật)
d.getHours();     // giờ
```

### 4.2. Format Date thành chuỗi

```javascript
const d = new Date('2026-07-18T09:30:00');

// ISO — chuẩn để lưu / trả API (luôn là giờ UTC, có hậu tố Z)
d.toISOString();          // "2026-07-18T09:30:00.000Z"

// toLocaleDateString / toLocaleString — format theo vùng
d.toLocaleDateString('vi-VN');  // "18/7/2026"
d.toLocaleString('vi-VN');      // "18/7/2026 09:30:00"

// Tùy chỉnh định dạng bằng options
d.toLocaleDateString('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric'
});                              // "18/07/2026"

d.toLocaleString('vi-VN', {
  weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
});                             // "Thứ Bảy, 18 tháng 7, 2026"

// Chỉ lấy giờ:phút
d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); // "09:30"
```

### 4.3. Format thủ công `dd/MM/yyyy` (không phụ thuộc locale)

```javascript
function formatDate(date) {
  const d = new Date(date);
  const day   = String(d.getDate()).padStart(2, '0');    // "08"
  const month = String(d.getMonth() + 1).padStart(2, '0'); // +1 vì tháng từ 0
  const year  = d.getFullYear();
  return `${day}/${month}/${year}`;                       // "18/07/2026"
}
formatDate('2026-07-18'); // "18/07/2026"
```

### 4.4. So sánh & tính toán ngày

```javascript
const a = new Date('2026-07-18');
const b = new Date('2026-07-20');

a < b;                                    // true (so sánh trực tiếp được)
const diffMs   = b - a;                   // hiệu số theo mili-giây
const diffDays = diffMs / (1000 * 60 * 60 * 24); // 2 (số ngày)
```

> 💡 Trong Mongoose, các trường `Date` được lưu dạng ISO. Khi cần lọc theo ngày dùng toán tử `$gte`, `$lte` với đối tượng `Date` (xem [`MongoQuery.md`](./MongoQuery.md)).

---

## 5. Chuỗi (String)

```javascript
const s = '  Nguyen Van A  ';

s.trim();                    // "Nguyen Van A"  (bỏ khoảng trắng 2 đầu)
s.trim().toUpperCase();      // "NGUYEN VAN A"
s.trim().toLowerCase();      // "nguyen van a"
'abc'.padStart(5, '0');      // "00abc"  (thêm cho đủ độ dài)
'abcdef'.slice(0, 3);        // "abc"    (cắt chuỗi con)
'a,b,c'.split(',');          // ["a","b","c"]
'a,b,c'.replace(',', '-');   // "a-b,c"  (chỉ thay lần đầu)
'a,b,c'.replaceAll(',', '-'); // "a-b-c"

// Viết hoa chữ cái đầu
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
capitalize('hANOI');         // "Hanoi"

// Template string — ghép biến vào chuỗi
const name = 'A', age = 20;
`Xin chào ${name}, ${age} tuổi`; // "Xin chào A, 20 tuổi"

// Rút gọn chuỗi dài + "..."
function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '...' : str;
}
```

---

## 6. Boolean & giá trị rỗng

```javascript
// Ép về boolean
Boolean(0);     // false
Boolean('');    // false
Boolean('abc'); // true
!!'abc';        // true  (cách viết ngắn)

// Các giá trị "falsy": false, 0, '', null, undefined, NaN

// Giá trị mặc định khi null/undefined
const price = req.body.price ?? 0;       // ?? chỉ nhận null/undefined -> 0
const name  = req.body.name || 'N/A';    // || nhận mọi falsy -> "N/A"

// Format boolean khi hiển thị
const status = isActive ? 'Đang hoạt động' : 'Ngừng';
```

> ⚠️ Khác biệt quan trọng: `0 || 'N/A'` → `"N/A"` (vì 0 là falsy), nhưng `0 ?? 'N/A'` → `0`. Với dữ liệu số nên dùng `??`.

---

## 7. Format khi định nghĩa Schema (Mongoose)

Có thể chuẩn hoá dữ liệu **ngay khi lưu** bằng các option của Schema:

```javascript
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    trim: true,          // Tự cắt khoảng trắng 2 đầu
    lowercase: true,     // Tự chuyển thành chữ thường
  },
  name: {
    type: String,
    uppercase: true,     // Tự chuyển thành chữ HOA
  },
  price: {
    type: Number,
    min: 0,              // Ràng buộc giá trị nhỏ nhất
    // set: làm tròn trước khi lưu
    set: (v) => Math.round(v * 100) / 100,
  },
  createdAt: {
    type: Date,
    default: Date.now,   // Mặc định = thời điểm tạo
  },
}, {
  timestamps: true,      // Tự thêm createdAt & updatedAt (kiểu Date)
});
```

- `trim`, `lowercase`, `uppercase`: áp dụng cho `String`.
- `set`: hàm biến đổi giá trị **trước khi lưu** vào DB.
- `timestamps: true`: tự sinh 2 trường ngày `createdAt`, `updatedAt`.

---

## 8. Format khi trả response (getter / toJSON)

Đôi khi cần **format lại lúc trả về** mà không đổi dữ liệu trong DB. Thường xử lý ngay trong controller bằng `.map()` (xem [`JSProcessing.md`](./JSProcessing.md)):

```javascript
const products = await Product.find();

const result = products.map(p => ({
  id: p._id,
  name: p.name,
  price: p.price,
  priceText: p.price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }),
  createdAt: p.createdAt.toLocaleDateString('vi-VN'), // "18/7/2026"
}));

res.status(200).json(result);
```

Hoặc dùng `getter` + `toJSON` trong Schema để tự format mỗi khi chuyển sang JSON:

```javascript
const schema = new mongoose.Schema({
  price: {
    type: Number,
    get: (v) => v.toLocaleString('vi-VN'), // format khi ĐỌC
  },
}, {
  toJSON: { getters: true },  // BẮT BUỘC bật để getter chạy khi res.json()
});
```

> 💡 Đơn giản và dễ kiểm soát nhất trong bài thi là format bằng `.map()` trong controller.

---

## 9. Bảng tra nhanh

| Nhu cầu                       | Cách dùng                                                       | Kết quả          |
| ----------------------------- | -------------------------------------------------------------- | ---------------- |
| Làm tròn 2 số thập phân       | `n.toFixed(2)`                                                 | `"3.14"`         |
| Dấu phân cách hàng nghìn      | `n.toLocaleString('vi-VN')`                                    | `"1.234.567"`    |
| Tiền VND                      | `n.toLocaleString('vi-VN', {style:'currency', currency:'VND'})` | `"1.500.000 ₫"`  |
| Phần trăm                     | `r.toLocaleString('vi-VN', {style:'percent'})`                | `"13%"`          |
| Ngày `dd/MM/yyyy`             | `d.toLocaleDateString('vi-VN')`                               | `"18/7/2026"`    |
| Ngày ISO (lưu/API)            | `d.toISOString()`                                             | `"2026-07-18T…"` |
| Ngày + giờ                    | `d.toLocaleString('vi-VN')`                                    | `"18/7/2026 09:30:00"` |
| Cắt khoảng trắng              | `s.trim()`                                                     | `"abc"`          |
| Viết hoa / thường             | `s.toUpperCase()` / `s.toLowerCase()`                         | —                |
| Chuỗi -> số                   | `Number(s)` / `parseInt(s, 10)`                              | `12`             |
| Giá trị mặc định (null)       | `x ?? default`                                                | —                |

---

## 10. Checklist

- [ ] Chỉ format ở **bước cuối** (trước `res.json()`), giữ dữ liệu gốc dạng số/Date để tính toán và query.
- [ ] Số tiền/số lượng: format bằng `toLocaleString('vi-VN', …)`, không dùng chuỗi đã format để cộng trừ.
- [ ] Ngày lưu vào DB để **kiểu `Date`** (không phải String) để lọc/sắp xếp được.
- [ ] Nhớ `getMonth()` trả về **0–11** → cộng thêm 1 khi hiển thị.
- [ ] Dùng `??` cho giá trị số mặc định (tránh nhầm `0` thành falsy như `||`).
- [ ] Cần chuẩn hoá lúc lưu → dùng `trim/lowercase/uppercase/set` trong Schema.
- [ ] Muốn tự có `createdAt`/`updatedAt` → thêm `{ timestamps: true }`.

---

**Ghi chú:**
- `toFixed()` và `toLocaleString()` luôn trả về **chuỗi**.
- `Intl.NumberFormat` / `Intl.DateTimeFormat` là chuẩn hiện đại, hỗ trợ đầy đủ locale.
- Tháng trong `Date` đánh số từ **0** (0 = tháng 1).
