# Ôn tập SDN302 — Mongoose Models cho DB điểm danh

> DB: hệ thống **quản lý điểm danh** (subjects, students, classes, attendances, attendanceSummaries).
> File này gồm: cách setup, **model đầy đủ**, và các **pattern hay ra thi** (CRUD, query, populate, aggregate, validation).

---

## 0. Cài đặt & kết nối

```bash
npm init -y
npm install express mongoose dotenv
```

`.env`
```
MONGO_URI=mongodb://127.0.0.1:27017/attendance_db
PORT=3000
```

`config/db.js`
```js
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("DB error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
```

`server.js`
```js
require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");

const app = express();
app.use(express.json()); // BẮT BUỘC để đọc req.body

connectDB();

app.use("/api/subjects", require("./routes/subject.route"));
app.use("/api/students", require("./routes/student.route"));
app.use("/api/classes", require("./routes/class.route"));
app.use("/api/attendances", require("./routes/attendance.route"));

app.listen(process.env.PORT, () =>
  console.log(`Server on http://localhost:${process.env.PORT}`)
);
```

---

## 1. Model: Subject (Môn học)

`models/Subject.js`
```js
const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    credits: { type: Number, required: true, min: 1, max: 10 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true } // tự thêm createdAt, updatedAt
);

module.exports = mongoose.model("Subject", subjectSchema);
```

## 2. Model: Student (Sinh viên)

`models/Student.js`
```js
const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    studentCode: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);
```

## 3. Model: Class (Lớp học phần — có mảng nhúng `enrollments`)

`models/Class.js`
```js
const mongoose = require("mongoose");

// Subdocument nhúng — mỗi phần tử là 1 lượt ghi danh
const enrollmentSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    status: { type: String, enum: ["enrolled", "dropped"], default: "enrolled" },
  },
  { _id: false } // không cần _id riêng cho từng enrollment
);

const classSchema = new mongoose.Schema(
  {
    className: { type: String, required: true, unique: true, trim: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    lecturerName: { type: String, required: true },
    status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN" },
    enrollments: [enrollmentSchema], // MẢNG NHÚNG
  },
  { timestamps: true }
);

module.exports = mongoose.model("Class", classSchema);
```

## 4. Model: Attendance (Log điểm danh — chuẩn hóa)

`models/Attendance.js`
```js
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["PRESENT", "ABSENT"], required: true },
  },
  { timestamps: true }
);

// Chặn điểm danh trùng: 1 SV / 1 lớp / 1 ngày chỉ 1 bản ghi
attendanceSchema.index({ studentId: 1, classId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
```

## 5. Model: AttendanceSummary (Tổng hợp)

`models/AttendanceSummary.js`
```js
const mongoose = require("mongoose");

const summarySchema = new mongoose.Schema(
  {
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    totalSessions: { type: Number, default: 0 },
    present: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    attendanceRate: { type: Number, default: 0 }, // %
    warning: { type: Boolean, default: false },
  },
  { timestamps: true }
);

summarySchema.index({ classId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model("AttendanceSummary", summarySchema);
```

> **Lưu ý field id trong JSON gốc**: file seed dùng `"id"` (string). Khi import vào Mongo thật, `_id` phải là ObjectId. Nếu đề cho sẵn file JSON và bảo import, dùng `mongoimport` hoặc script `insertMany` — Mongoose sẽ tự sinh `_id` nếu bạn bỏ field `id`.

---

## 6. CRUD chuẩn (Controller + Route)

### 6.1 Controller mẫu (Subject)

`controllers/subject.controller.js`
```js
const Subject = require("../models/Subject");

// GET all — có lọc & phân trang
exports.getAll = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const data = await Subject.find(filter).sort({ code: 1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET by id
exports.getById = async (req, res) => {
  try {
    const item = await Subject.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// CREATE
exports.create = async (req, res) => {
  try {
    const created = await Subject.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// UPDATE
exports.update = async (req, res) => {
  try {
    const updated = await Subject.findByIdAndUpdate(req.params.id, req.body, {
      new: true,          // trả về bản ghi sau khi update
      runValidators: true, // chạy lại validate của schema
    });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE
exports.remove = async (req, res) => {
  try {
    const deleted = await Subject.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
```

### 6.2 Route mẫu

`routes/subject.route.js`
```js
const router = require("express").Router();
const c = require("../controllers/subject.controller");

router.get("/", c.getAll);
router.get("/:id", c.getById);
router.post("/", c.create);
router.put("/:id", c.update);
router.delete("/:id", c.remove);

module.exports = router;
```

---

## 7. POPULATE — join giữa các collection (RẤT hay thi)

```js
// Lấy lớp + thông tin môn học + thông tin từng SV trong enrollments
const classes = await Class.find()
  .populate("subjectId", "code name credits")        // join Subject
  .populate("enrollments.studentId", "studentCode fullName"); // join Student trong mảng nhúng

// Lấy log điểm danh kèm tên SV và tên lớp
const logs = await Attendance.find({ classId })
  .populate("studentId", "studentCode fullName")
  .populate("classId", "className");
```

---

## 8. QUERY thường gặp

```js
// 1. Môn ACTIVE, sắp xếp theo credits giảm dần
await Subject.find({ status: "ACTIVE" }).sort({ credits: -1 });

// 2. Tìm gần đúng theo tên (không phân biệt hoa thường)
await Student.find({ fullName: { $regex: "nguyen", $options: "i" } });

// 3. So sánh số: tín chỉ >= 3
await Subject.find({ credits: { $gte: 3 } });

// 4. Trong khoảng: điểm danh trong tháng 1/2026
await Attendance.find({
  date: { $gte: new Date("2026-01-01"), $lt: new Date("2026-02-01") },
});

// 5. IN: các lớp thuộc 1 vài môn
await Class.find({ subjectId: { $in: [id1, id2] } });

// 6. Đếm số buổi vắng của 1 SV trong 1 lớp
await Attendance.countDocuments({ studentId, classId, status: "ABSENT" });

// 7. Lấy SV đang enrolled trong 1 lớp (query field của subdocument nhúng)
await Class.find({ "enrollments.status": "enrolled" });

// 8. Phân trang
const page = 1, limit = 10;
await Attendance.find().skip((page - 1) * limit).limit(limit);
```

---

## 9. AGGREGATE — tính tổng hợp điểm danh (dạng bài khó, dễ ăn điểm cao)

Tính lại `attendanceSummaries` từ `attendances`:

```js
const summary = await Attendance.aggregate([
  { $match: { classId: new mongoose.Types.ObjectId(classId) } },
  {
    $group: {
      _id: "$studentId",
      totalSessions: { $sum: 1 },
      present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } },
      absent:  { $sum: { $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0] } },
    },
  },
  {
    $addFields: {
      attendanceRate: {
        $round: [{ $multiply: [{ $divide: ["$present", "$totalSessions"] }, 100] }, 1],
      },
    },
  },
  { $addFields: { warning: { $lt: ["$attendanceRate", 80] } } }, // rate < 80% -> cảnh báo
  {
    $lookup: { // join sang students để lấy tên
      from: "students",
      localField: "_id",
      foreignField: "_id",
      as: "student",
    },
  },
  { $unwind: "$student" },
  {
    $project: {
      _id: 0,
      studentCode: "$student.studentCode",
      fullName: "$student.fullName",
      totalSessions: 1, present: 1, absent: 1, attendanceRate: 1, warning: 1,
    },
  },
  { $sort: { attendanceRate: 1 } },
]);
```

**Các stage cần thuộc:**
- `$match` → lọc (như WHERE)
- `$group` → gom nhóm + tính tổng (`$sum`, `$avg`, `$max`, `$min`)
- `$cond` → if/else trong aggregate
- `$lookup` → join collection khác
- `$unwind` → tách mảng thành nhiều document
- `$project` → chọn/đổi tên field
- `$sort`, `$limit`, `$skip`, `$addFields`

---

## 10. Validation & xử lý lỗi (dễ bị trừ điểm nếu quên)

```js
// Bắt lỗi validation của Mongoose
try {
  await Subject.create(req.body);
} catch (err) {
  if (err.name === "ValidationError") {
    return res.status(400).json({ errors: Object.values(err.errors).map(e => e.message) });
  }
  if (err.code === 11000) { // lỗi trùng unique
    return res.status(409).json({ message: "Dữ liệu đã tồn tại (trùng key)" });
  }
  res.status(500).json({ message: err.message });
}
```

Custom validator trong schema:
```js
credits: {
  type: Number,
  required: [true, "Credits là bắt buộc"],
  validate: { validator: Number.isInteger, message: "Credits phải là số nguyên" },
}
```

---

## 11. Business logic hay được hỏi

```js
// A. Ghi danh SV vào lớp (thêm vào mảng nhúng, chặn trùng)
exports.enroll = async (req, res) => {
  const { studentId } = req.body;
  const cls = await Class.findById(req.params.classId);
  if (!cls) return res.status(404).json({ message: "Class not found" });
  if (cls.status === "CLOSED") return res.status(400).json({ message: "Lớp đã đóng" });

  const existed = cls.enrollments.find(e => e.studentId.toString() === studentId);
  if (existed) return res.status(409).json({ message: "SV đã ghi danh" });

  cls.enrollments.push({ studentId, status: "enrolled" });
  await cls.save();
  res.status(201).json(cls);
};

// B. Điểm danh 1 buổi (upsert để tránh trùng)
exports.markAttendance = async (req, res) => {
  const { studentId, classId, date, status } = req.body;
  const record = await Attendance.findOneAndUpdate(
    { studentId, classId, date: new Date(date) },
    { status },
    { new: true, upsert: true, runValidators: true }
  );
  res.status(201).json(record);
};

// C. Danh sách SV bị cảnh báo (rate < 80) của 1 lớp
exports.getWarnings = async (req, res) => {
  const data = await AttendanceSummary.find({ classId: req.params.classId, warning: true })
    .populate("studentId", "studentCode fullName");
  res.json(data);
};
```

---

## 12. Checklist trước khi thi

- [ ] `app.use(express.json())` — thiếu là `req.body` undefined.
- [ ] Đúng thứ tự: **Model → Controller → Route → server.js**.
- [ ] `ref` trong schema phải khớp **tên model** (chữ hoa đầu, số ít): `mongoose.model("Student", ...)` → `ref: "Student"`.
- [ ] `populate` chỉ chạy khi field là `ObjectId` + có `ref`.
- [ ] `findByIdAndUpdate` nhớ `{ new: true, runValidators: true }`.
- [ ] Status code: 200 (OK), 201 (Created), 400 (Bad request), 404 (Not found), 409 (Conflict/trùng), 500 (Server error).
- [ ] `enum`, `required`, `unique`, `min/max`, `match` cho validation.
- [ ] Aggregate: nhớ ép kiểu `new mongoose.Types.ObjectId(id)` khi `$match` theo id.
- [ ] Test bằng Postman: đủ 5 method GET/GET:id/POST/PUT/DELETE cho mỗi resource.

---

## 13. Cấu trúc thư mục gợi ý

```
sp26_B5/
├── config/db.js
├── models/
│   ├── Subject.js
│   ├── Student.js
│   ├── Class.js
│   ├── Attendance.js
│   └── AttendanceSummary.js
├── controllers/
├── routes/
├── .env
└── server.js
```

Chúc thi tốt! 🎯
