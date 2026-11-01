# MongoDB Aggregation với Express + Mongoose

> Hướng dẫn dùng `Model.aggregate()` để làm **báo cáo / thống kê / join nâng cao** trong ứng dụng Express + Mongoose.
> Đọc kèm: [MongoModel.md](./MongoModel.md), [MongoQuery.md](./MongoQuery.md).

---

## 0. Model dùng xuyên suốt các ví dụ

Các ví dụ bên dưới giả định 4 model (quan hệ Nhân sự — Phòng ban — Dự án):

```javascript
// models/Department.js
const departmentSchema = new mongoose.Schema({
  depName: String
});
module.exports = mongoose.model("Department", departmentSchema);

// models/Employee.js — nhân viên thuộc 1 phòng ban
const employeeSchema = new mongoose.Schema({
  empName: String,
  salary: Number,
  depId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" }
});
module.exports = mongoose.model("Employee", employeeSchema);

// models/Project.js — dự án thuộc 1 phòng ban
const projectSchema = new mongoose.Schema({
  proName: String,
  depId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" }
});
module.exports = mongoose.model("Project", projectSchema);

// models/Workson.js — bảng trung gian: 1 nhân viên làm bao nhiêu giờ trên 1 dự án
const worksonSchema = new mongoose.Schema({
  empId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  proId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
  workHours: Number
});
module.exports = mongoose.model("Workson", worksonSchema);
```

---

## 1. Aggregate là gì?

Aggregation Pipeline xử lý dữ liệu **theo từng bước (stage)**. Dữ liệu chạy qua một dây chuyền, mỗi stage nhận kết quả của stage trước:

```
Collection → $match → $lookup → $unwind → $group → $project → $sort → Result
```

Cú pháp trong Mongoose — truyền một **mảng các stage**:

```javascript
const result = await Model.aggregate([
  { /* stage 1 */ },
  { /* stage 2 */ },
  { /* stage 3 */ }
]);
```

`aggregate()` trả về **Promise** → luôn dùng `await` (hoặc `.then()`).

---

## 2. Dùng trong Controller (Express)

```javascript
const Employee = require("../models/Employee");

// GET /api/employees/salary-by-department
exports.salaryByDepartment = async (req, res) => {
  try {
    const data = await Employee.aggregate([
      { $group: { _id: "$depId", totalSalary: { $sum: "$salary" } } },
      { $sort: { totalSalary: -1 } }
    ]);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
```

> **Nhớ:** `aggregate` là async → luôn bọc trong `try/catch` và `await`.

---

## 3. Thứ tự tư duy khi ráp pipeline

| Bước | Câu hỏi | Stage dùng |
| ---- | ------- | ---------- |
| 1 | Bắt đầu từ collection nào (chứa dữ liệu chính)? | `Model.aggregate(...)` |
| 2 | Có cần lọc bớt dữ liệu không? | `$match` |
| 3 | Có cần join sang collection khác không? | `$lookup` |
| 4 | Kết quả join là mảng — có cần "mở" ra không? | `$unwind` |
| 5 | Có cần nhóm / tính tổng không? | `$group` |
| 6 | Có cần chọn / đổi tên field không? | `$project` |
| 7 | Có cần sắp xếp không? | `$sort` |
| 8 | Có cần phân trang / giới hạn không? | `$skip`, `$limit` |

> **Mẹo hiệu năng:** đặt `$match` càng sớm càng tốt để lọc bớt document trước khi `$lookup`/`$group`.

---

## 4. Các Stage quan trọng

### `$match` — lọc (giống `find`)

```javascript
{ $match: { status: "Completed" } }
{ $match: { salary: { $gte: 1000 } } }
{ $match: { $or: [{ city: "HN" }, { city: "HCM" }] } }
```

### `$lookup` — join collection khác

```javascript
{
  $lookup: {
    from: "departments",     // ⚠️ TÊN COLLECTION THẬT, không phải tên Model
    localField: "depId",     // field ở collection hiện tại
    foreignField: "_id",     // field ở collection "from"
    as: "department"         // tên field kết quả (là MẢNG)
  }
}
```

Trước → Sau:

```json
{ "depId": "123" }
```
```json
{ "depId": "123", "department": [ { "_id": "123", "depName": "IT" } ] }
```

> ⚠️ **`from` là tên collection thật trong MongoDB** — thường là tên Model viết **thường + số nhiều**: `Department` → `"departments"`, `Project` → `"projects"`, `Workson` → `"worksons"`.
> `$lookup` **luôn trả về MẢNG** (kể cả khi chỉ khớp 1 document).

### `$unwind` — tách mảng thành từng document

Dùng khi `$lookup` chỉ khớp 1 phần tử và bạn muốn dùng như object:

```javascript
{ $unwind: "$department" }
```

Trước → Sau:

```json
{ "department": [ { "depName": "IT" } ] }
```
```json
{ "department": { "depName": "IT" } }
```

Sau `$unwind` truy cập thẳng: `department.depName` (không cần `department[0].depName`).

> Nếu có document **không khớp** khi lookup, `$unwind` mặc định sẽ **loại bỏ** document đó. Muốn giữ lại (giống LEFT JOIN):
> ```javascript
> { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } }
> ```

### `$group` — nhóm & tính toán

```javascript
{
  $group: {
    _id: "$proId",                       // gom nhóm theo field này
    totalHours: { $sum: "$workHours" },  // tính toán trên mỗi nhóm
    count: { $sum: 1 }
  }
}
```

`_id` là **khóa nhóm** (bắt buộc). `_id: null` = gom tất cả thành 1 nhóm duy nhất.

### `$project` — chọn / đổi tên / tính field

```javascript
{
  $project: {
    _id: 0,                          // ẩn _id
    projectName: "$project.proName", // đổi tên (lấy field lồng nhau)
    totalHours: 1                    // giữ nguyên field
  }
}
```

### `$sort` — sắp xếp

```javascript
{ $sort: { totalHours: -1 } }   // -1 giảm dần, 1 tăng dần
```

### `$limit` / `$skip` — giới hạn & phân trang

```javascript
{ $skip: 10 }
{ $limit: 5 }
```

### `$count` / `$addFields` — bonus

```javascript
{ $count: "total" }                                    // đếm số document còn lại
{ $addFields: { totalCost: { $multiply: ["$qty", "$price"] } } }  // thêm field mới
```

---

## 5. Toán tử trong `$group`

| Toán tử | Ý nghĩa | Ví dụ |
| ------- | ------- | ----- |
| `$sum: 1` | Đếm số document | `count: { $sum: 1 }` |
| `$sum: "$field"` | Tính tổng | `total: { $sum: "$salary" }` |
| `$avg` | Trung bình | `avg: { $avg: "$salary" }` |
| `$max` | Lớn nhất | `max: { $max: "$salary" }` |
| `$min` | Nhỏ nhất | `min: { $min: "$salary" }` |
| `$first` | Phần tử đầu | `name: { $first: "$empName" }` |
| `$last` | Phần tử cuối | `name: { $last: "$empName" }` |
| `$push` | Đưa tất cả vào mảng | `list: { $push: "$empName" }` |
| `$addToSet` | Vào mảng, bỏ trùng | `list: { $addToSet: "$empName" }` |

---

## 6. Ví dụ thực chiến

### Ví dụ 1 — Đếm số nhân viên mỗi phòng ban

```javascript
const data = await Employee.aggregate([
  { $group: { _id: "$depId", totalEmployees: { $sum: 1 } } }
]);
// [ { _id: "...", totalEmployees: 5 }, ... ]
```

### Ví dụ 2 — Tổng giờ làm mỗi dự án

```javascript
const data = await Workson.aggregate([
  { $group: { _id: "$proId", totalHours: { $sum: "$workHours" } } }
]);
```

### Ví dụ 3 — Join Project với Department (lookup + unwind + project)

```javascript
const data = await Project.aggregate([
  {
    $lookup: {
      from: "departments",
      localField: "depId",
      foreignField: "_id",
      as: "department"
    }
  },
  { $unwind: "$department" },
  {
    $project: {
      _id: 0,
      projectName: "$proName",
      departmentName: "$department.depName"
    }
  }
]);
// [ { projectName: "Web App", departmentName: "IT" }, ... ]
```

### Ví dụ 4 — Báo cáo tổng giờ làm theo TÊN dự án (group → lookup → unwind → project → sort)

```javascript
const report = await Workson.aggregate([
  // 1) Gom giờ làm theo proId
  { $group: { _id: "$proId", totalHours: { $sum: "$workHours" } } },

  // 2) Join sang collection projects để lấy tên
  {
    $lookup: {
      from: "projects",
      localField: "_id",       // _id ở đây chính là proId sau khi group
      foreignField: "_id",
      as: "project"
    }
  },
  { $unwind: "$project" },

  // 3) Đổi tên field cho đẹp
  {
    $project: {
      _id: 0,
      projectName: "$project.proName",
      totalHours: 1
    }
  },

  // 4) Sắp xếp giảm dần theo giờ làm
  { $sort: { totalHours: -1 } }
]);
```

### Ví dụ 5 — Lương trung bình + số nhân viên theo tên phòng ban

```javascript
const data = await Employee.aggregate([
  {
    $group: {
      _id: "$depId",
      avgSalary: { $avg: "$salary" },
      headcount: { $sum: 1 }
    }
  },
  { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "dep" } },
  { $unwind: "$dep" },
  { $project: { _id: 0, department: "$dep.depName", avgSalary: 1, headcount: 1 } },
  { $sort: { avgSalary: -1 } }
]);
```

---

## 7. Pipeline mẫu (học thuộc khung)

```
Báo cáo đơn giản:      $match → $group → $sort → $project
Join lấy dữ liệu:      $lookup → $unwind → $project
Báo cáo có join:       $match → $group → $lookup → $unwind → $project → $sort
Phân trang:            $match → $sort → $skip → $limit
```

---

## 8. Quy tắc nhớ nhanh

| Nhu cầu | Dùng |
| ------- | ---- |
| CRUD thường, lấy dữ liệu liên kết đơn giản | `find()` + `populate()` |
| Join trong pipeline | `$lookup` (+ `$unwind`) |
| Tính tổng / đếm / trung bình | `$group` |
| Đổi tên / chọn field | `$project` |
| Sắp xếp | `$sort` |
| Giới hạn / phân trang | `$limit`, `$skip` |

> **`populate` vs `$lookup`:** cần dữ liệu liên kết để **hiển thị** → `populate` gọn hơn. Cần **tính toán / nhóm / thống kê** kết hợp nhiều collection → dùng `aggregate` + `$lookup`.

---

## 9. Checklist khi làm bài thi

1. Chọn **đúng collection bắt đầu** (nơi chứa dữ liệu chính cần thống kê).
2. Lọc sớm bằng `$match` nếu đề có điều kiện.
3. Join bằng `$lookup` — nhớ **`from` là tên collection thật** (`projects`, `departments`), **không phải** tên Model.
4. `$lookup` **luôn trả về mảng** → thường theo sau bằng `$unwind`.
5. Tính toán bằng `$group`; đếm dùng `$sum: 1`, tổng dùng `$sum: "$field"`.
6. Chỉ lấy field cần thiết & đổi tên bằng `$project`.
7. Sắp xếp bằng `$sort` (`-1` giảm dần).
8. Luôn `await` + `try/catch` khi gọi trong controller.

---

**Chú thích:**

- `Model` là tên model Mongoose (`Employee`, `Project`, ...).
- Trong `$lookup.from` phải dùng **tên collection thật** (thường viết thường, số nhiều).
- `$match`, `$group`, `$sum`, `$lookup`... là các stage/toán tử của MongoDB.
