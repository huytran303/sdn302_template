# Xử lý Object & Array trong JavaScript

Tài liệu tổng hợp cách xử lý **object** và **mảng (array)** trong JS — phần hay dùng khi làm việc với dữ liệu trả về từ MongoDB/Mongoose.

Mục lục:
1. [Làm việc với Object](#1-làm-việc-với-object)
2. [Làm việc với Array](#2-làm-việc-với-array)
3. [Các hàm duyệt & biến đổi mảng](#3-các-hàm-duyệt--biến-đổi-mảng-quan-trọng)
4. [Sắp xếp, tìm kiếm, gộp](#4-sắp-xếp-tìm-kiếm-gộp)
5. [Mảng các object](#5-mảng-các-object-array-of-objects)
6. [Copy, merge, destructuring](#6-copy-merge-destructuring)
7. [Lưu ý với dữ liệu Mongoose](#7-lưu-ý-với-dữ-liệu-mongoose)

---

## 1. Làm việc với Object

```javascript
const user = { name: 'An', age: 20, city: 'HN' };

// Truy cập thuộc tính
user.name;          // "An"
user['age'];        // 20 (dùng khi tên field là biến/động)

// Thêm / sửa / xóa
user.email = 'an@gmail.com'; // thêm
user.age = 21;               // sửa
delete user.city;            // xóa

// Kiểm tra tồn tại
'name' in user;              // true
user.hasOwnProperty('age');  // true
user.phone === undefined;    // true (chưa có)

// Lấy danh sách key / value / cặp [key, value]
Object.keys(user);    // ["name", "age", "email"]
Object.values(user);  // ["An", 21, "an@gmail.com"]
Object.entries(user); // [["name","An"], ["age",21], ...]

// Duyệt qua object
for (const key in user) {
  console.log(key, user[key]);
}
Object.entries(user).forEach(([key, value]) => {
  console.log(`${key} = ${value}`);
});

// Gộp / sao chép object
const clone = { ...user };                    // sao chép nông (shallow copy)
const merged = { ...user, age: 30, vip: true }; // gộp + ghi đè field trùng
Object.assign({}, user, { age: 30 });         // cách khác để merge
```

**Optional chaining & giá trị mặc định:**

```javascript
const data = { profile: { address: { city: 'HN' } } };

data.profile?.address?.city;      // "HN" — an toàn nếu profile/address là undefined
data.profile?.phone?.number;      // undefined thay vì lỗi

const city = data.profile?.address?.city ?? 'N/A'; // ?? : dùng giá trị mặc định khi null/undefined
const page = req.query.page || 1;                   // || : mặc định khi giá trị "falsy"
```

> Khác biệt: `??` chỉ thay khi `null`/`undefined`; `||` thay khi mọi giá trị "falsy" (`0`, `''`, `false`, ...).

---

## 2. Làm việc với Array

```javascript
const arr = [10, 20, 30];

// Truy cập
arr[0];           // 10
arr.length;       // 3
arr[arr.length-1];// 30 (phần tử cuối)
arr.at(-1);       // 30 (cách mới)

// Thêm / xóa
arr.push(40);     // thêm cuối -> [10,20,30,40]
arr.pop();        // xóa cuối
arr.unshift(5);   // thêm đầu -> [5,10,20,30]
arr.shift();      // xóa đầu

// Cắt / nối
arr.slice(1, 3);           // lấy [index 1..2], KHÔNG đổi mảng gốc
arr.splice(1, 2);          // xóa 2 phần tử từ index 1, ĐỔI mảng gốc
[...arr, 99];              // nối thêm phần tử (tạo mảng mới)
[1,2].concat([3,4]);       // [1,2,3,4]

// Kiểm tra
arr.includes(20);          // true
arr.indexOf(20);           // 1 (-1 nếu không có)
Array.isArray(arr);        // true
```

---

## 3. Các hàm duyệt & biến đổi mảng (quan trọng)

Đây là nhóm hàm dùng nhiều nhất khi xử lý dữ liệu.

```javascript
const products = [
  { name: 'Book',  price: 100, category: 'edu' },
  { name: 'Pen',   price: 20,  category: 'edu' },
  { name: 'Phone', price: 500, category: 'tech' },
];

// map — biến đổi từng phần tử -> mảng MỚI cùng độ dài
const names = products.map(p => p.name);          // ["Book","Pen","Phone"]
const priced = products.map(p => ({ ...p, price: p.price * 1.1 })); // thêm thuế

// filter — lọc phần tử thỏa điều kiện -> mảng con
const cheap = products.filter(p => p.price < 100); // Pen

// find — PHẦN TỬ ĐẦU TIÊN thỏa điều kiện (undefined nếu không có)
const book = products.find(p => p.name === 'Book');
const idx  = products.findIndex(p => p.name === 'Pen'); // vị trí -> 1

// forEach — duyệt, KHÔNG trả về mảng mới
products.forEach(p => console.log(p.name));

// reduce — gộp mảng thành 1 giá trị
const total = products.reduce((sum, p) => sum + p.price, 0); // 620
const byCat = products.reduce((acc, p) => {                   // nhóm theo category
  (acc[p.category] ||= []).push(p.name);
  return acc;
}, {}); // { edu: ["Book","Pen"], tech: ["Phone"] }

// some / every — kiểm tra điều kiện
products.some(p => p.price > 400);   // true — có ít nhất 1
products.every(p => p.price > 0);    // true — tất cả đều thỏa

// Nối chuỗi (chaining): lọc -> biến đổi -> gộp
const eduTotal = products
  .filter(p => p.category === 'edu')
  .map(p => p.price)
  .reduce((a, b) => a + b, 0); // 120
```

Bảng chọn nhanh:

| Cần làm gì                         | Dùng hàm    |
| ---------------------------------- | ----------- |
| Biến đổi mọi phần tử               | `map`       |
| Lọc ra tập con                     | `filter`    |
| Lấy 1 phần tử                      | `find`      |
| Lấy vị trí                         | `findIndex` |
| Tính tổng / gộp về 1 giá trị       | `reduce`    |
| Kiểm tra "có ít nhất 1"            | `some`      |
| Kiểm tra "tất cả"                 | `every`     |
| Chỉ duyệt (in ra, gọi hàm)         | `forEach`   |

---

## 4. Sắp xếp, tìm kiếm, gộp

```javascript
const nums = [30, 10, 20];

// sort — MẶC ĐỊNH sắp theo chuỗi -> phải truyền hàm so sánh với số
[...nums].sort((a, b) => a - b);   // tăng dần [10,20,30]
[...nums].sort((a, b) => b - a);   // giảm dần [30,20,10]

// Sắp xếp mảng object theo field
[...products].sort((a, b) => b.price - a.price);            // theo price giảm dần
[...products].sort((a, b) => a.name.localeCompare(b.name)); // theo tên A→Z

// reverse — đảo ngược
[...nums].reverse();

// Gộp/làm phẳng mảng lồng
[[1,2],[3,4]].flat();              // [1,2,3,4]
products.flatMap(p => [p.name, p.price]); // map + flat 1 cấp

// Loại trùng
[...new Set([1,1,2,3,3])];         // [1,2,3]
```

> **Lưu ý:** `sort()` và `reverse()` **thay đổi mảng gốc**. Dùng `[...arr].sort(...)` để không ảnh hưởng mảng ban đầu.

---

## 5. Mảng các object (array of objects)

Đây là dạng dữ liệu Mongoose trả về (`Model.find()` → mảng document).

```javascript
const students = [
  { name: 'An',  scores: [8, 9, 7] },
  { name: 'Binh', scores: [5, 6] },
];

// Tính điểm trung bình mỗi sinh viên
const result = students.map(s => ({
  name: s.name,
  avg: s.scores.reduce((a, b) => a + b, 0) / s.scores.length,
}));

// Lấy sinh viên có điểm TB >= 7
const passed = result.filter(s => s.avg >= 7);

// Nhóm object theo 1 field -> object { key: [items] }
function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    (acc[item[key]] ||= []).push(item);
    return acc;
  }, {});
}

// Đếm số lượng theo field
const countByCat = products.reduce((acc, p) => {
  acc[p.category] = (acc[p.category] || 0) + 1;
  return acc;
}, {}); // { edu: 2, tech: 1 }
```

---

## 6. Copy, merge, destructuring

```javascript
// Destructuring object — lấy nhanh field ra biến
const { name, price } = product;
const { name: tenSP } = product;         // đổi tên biến
const { discount = 0 } = product;        // giá trị mặc định nếu thiếu

// Destructuring array
const [first, second] = arr;
const [head, ...rest] = arr;             // head = phần tử đầu, rest = mảng còn lại

// Spread — sao chép / gộp
const copyArr = [...arr];
const copyObj = { ...obj };
const combined = [...arr1, ...arr2];
const updated = { ...obj, price: 200 };  // ghi đè 1 field

// Lấy 1 phần thuộc tính, gom phần còn lại
const { _id, __v, ...clean } = doc;      // bỏ _id, __v khi trả về client
```

---

## 7. Lưu ý với dữ liệu Mongoose

Document trả về từ Mongoose **không phải object thuần** — nó có các method (`save`, `toObject`...). Khi cần thao tác như object thường:

```javascript
const doc = await Product.findById(id);

// Chuyển sang object thuần trước khi spread/sửa
const obj = doc.toObject();
const custom = { ...obj, priceWithTax: obj.price * 1.1 };

// Hoặc dùng .lean() khi query nếu chỉ ĐỌC (nhanh hơn, trả về object thuần)
const list = await Product.find().lean();
const names = list.map(p => p.name); // dùng trực tiếp được
```

- Dùng `.lean()` khi **chỉ đọc & xử lý JS**, không cần lưu lại.
- Không dùng `.lean()` nếu cần gọi `.save()` sau đó.

Xem thêm: [`MongoQuery.md`](./MongoQuery.md) — nên lọc/sắp xếp bằng query MongoDB khi có thể (nhanh hơn xử lý JS); [`JSProcessing.md`](./JSProcessing.md) — dùng các hàm này trong controller.
