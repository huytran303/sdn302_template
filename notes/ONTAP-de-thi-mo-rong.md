# SDN302 — Ngân hàng đề MỞ RỘNG (quét hết JOIN / AGGREGATE / POST)

> Bổ sung cho `ONTAP-de-thi-mau.md`. File này liệt kê **mọi hướng có thể ra** trên DB điểm danh: tất cả cặp join, mọi góc aggregate, và đủ các POST/PUT/DELETE.
> Mục tiêu: gặp dạng lạ vẫn ghép được từ mẫu ở đây.

---

## A. BẢN ĐỒ QUAN HỆ — cái gì join được với cái gì

```
Subject ──1:N──> Class ──(mảng nhúng enrollments)──> Student
                   │                                     ▲
                   │                                     │
Attendance ──N:1──>┘   Attendance ──N:1──> Student ──────┘
AttendanceSummary ──N:1──> Class ,  ──N:1──> Student
```

| Từ | Field khóa ngoại | Tới | Cách nối |
|---|---|---|---|
| Class | `subjectId` | Subject | populate / `$lookup` |
| Class | `enrollments[].studentId` | Student | populate `"enrollments.studentId"` |
| Attendance | `studentId` | Student | populate / `$lookup` |
| Attendance | `classId` | Class | populate / `$lookup` |
| Attendance → Class | `classId` → `subjectId` | Subject | `$lookup` 2 tầng |
| AttendanceSummary | `studentId`, `classId` | Student, Class | populate / `$lookup` |

> **Tên collection cho `$lookup`** (chữ thường, số nhiều): `subjects`, `students`, `classes`, `attendances`, `attendancesummaries`.
> ⚠️ Mongoose tự đặt tên collection = số nhiều-lowercase của model. `AttendanceSummary` → `attendancesummaries`. Kiểm tra kỹ khi `$lookup`!

---

# B. NHÓM CÂU JOIN / POPULATE (quét hết mọi cặp)

### B1. Class → Subject (đã có ở câu 1.1) — trả môn học của lớp
```js
await Class.findById(id).populate("subjectId", "code name credits -_id");
```

### B2. Subject → các Class của nó (chiều ngược 1:N)
`GET /api/subjects/:subjectId/classes`
```js
app.get("/api/subjects/:subjectId/classes", async (req, res) => {
  const { subjectId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(subjectId))
    return res.status(400).json({ error: "Invalid ObjectId" });
  const subject = await Subject.findById(subjectId).select("code name");
  if (!subject) return res.status(404).json({ error: "Subject not found" });
  const classes = await Class.find({ subjectId })
    .select("className lecturerName status");
  res.json({ subject, totalClasses: classes.length, classes });
});
```

### B3. Class → Student (qua mảng nhúng) — đã có ở câu 1.2
```js
await Class.findById(id).populate("enrollments.studentId", "studentCode fullName -_id");
```

### B4. Student → các Class (chiều ngược, query mảng nhúng) — đã có ở 2.2
```js
await Class.find({ "enrollments.studentId": studentId });
// chỉ lấy lớp đang học:
await Class.find({ enrollments: { $elemMatch: { studentId, status: "enrolled" } } });
```

### B5. Attendance → Student + Class (join 2 chiều 1 lúc)
`GET /api/attendances/:id/detail`
```js
const a = await Attendance.findById(id)
  .populate("studentId", "studentCode fullName -_id")
  .populate("classId", "className -_id");
```

### B6. Attendance → Class → Subject (chain 3 collection, chỉ aggregate làm được đẹp)
`GET /api/reports/subjects/:subjectId/attendance` — mọi buổi điểm danh của 1 MÔN (gồm nhiều lớp)
```js
app.get("/api/reports/subjects/:subjectId/attendance", async (req, res) => {
  const { subjectId } = req.params;
  const data = await Attendance.aggregate([
    { $lookup: { from: "classes", localField: "classId", foreignField: "_id", as: "class" } },
    { $unwind: "$class" },
    { $match: { "class.subjectId": new mongoose.Types.ObjectId(subjectId) } },
    {
      $group: {
        _id: "$class.className",
        present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } },
        absent:  { $sum: { $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0] } },
      },
    },
    { $project: { _id: 0, className: "$_id", present: 1, absent: 1 } },
    { $sort: { className: 1 } },
  ]);
  res.json(data);
});
```

### B7. AttendanceSummary → Student + Class (đã có ở 2.3)
```js
await AttendanceSummary.find({ warning: true })
  .populate("studentId", "studentCode fullName -_id")
  .populate("classId", "className -_id");
```

### B8. Danh sách lớp + tên môn + sĩ số enrolled (populate + tính field)
`GET /api/classes` (list tổng hợp)
```js
app.get("/api/classes", async (req, res) => {
  const classes = await Class.find()
    .populate("subjectId", "code name -_id");
  const result = classes.map((c) => ({
    className: c.className,
    subject: c.subjectId,
    lecturerName: c.lecturerName,
    status: c.status,
    enrolledCount: c.enrollments.filter((e) => e.status === "enrolled").length,
    droppedCount: c.enrollments.filter((e) => e.status === "dropped").length,
  }));
  res.json(result);
});
```

---

# C. NHÓM CÂU AGGREGATE (quét hết mọi góc thống kê)

> Khung chung: `$match → $group → $addFields → $lookup → $unwind → $project → $sort`.

### C1. Tỉ lệ chuyên cần mỗi SV trong 1 lớp — (câu 3.1, chuẩn nhất)
→ xem `ONTAP-de-thi-mau.md` câu 3.1.

### C2. Chuyên cần tổng của MỖI SV trên TOÀN hệ thống (gộp mọi lớp)
`GET /api/reports/students/attendance`
```js
const report = await Attendance.aggregate([
  {
    $group: {
      _id: "$studentId",
      totalSessions: { $sum: 1 },
      present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } },
    },
  },
  { $addFields: { rate: { $round: [{ $multiply: [{ $divide: ["$present", "$totalSessions"] }, 100] }, 1] } } },
  { $lookup: { from: "students", localField: "_id", foreignField: "_id", as: "s" } },
  { $unwind: "$s" },
  { $project: { _id: 0, studentCode: "$s.studentCode", fullName: "$s.fullName", totalSessions: 1, present: 1, rate: 1 } },
  { $sort: { rate: -1 } },
]);
```

### C3. Thống kê trung bình theo LỚP (câu 3.2)
→ xem câu 3.2 (`AttendanceSummary` group theo `classId`).

### C4. Thống kê theo MÔN học (join Class → Subject)
`GET /api/reports/subjects/attendance-summary`
```js
const report = await AttendanceSummary.aggregate([
  { $lookup: { from: "classes", localField: "classId", foreignField: "_id", as: "class" } },
  { $unwind: "$class" },
  {
    $group: {
      _id: "$class.subjectId",
      totalStudents: { $sum: 1 },
      avgRate: { $avg: "$attendanceRate" },
      warnings: { $sum: { $cond: ["$warning", 1, 0] } },
    },
  },
  { $lookup: { from: "subjects", localField: "_id", foreignField: "_id", as: "subject" } },
  { $unwind: "$subject" },
  { $project: { _id: 0, subjectCode: "$subject.code", subjectName: "$subject.name",
               totalStudents: 1, warnings: 1, avgRate: { $round: ["$avgRate", 1] } } },
  { $sort: { avgRate: 1 } },
]);
```

### C5. Số buổi PRESENT/ABSENT theo NGÀY của 1 lớp (câu 3.3)
→ dùng `$dateToString`. Xem câu 3.3.

### C6. Đếm số LỚP mỗi GIẢNG VIÊN dạy (group theo string)
`GET /api/reports/lecturers`
```js
const report = await Class.aggregate([
  { $group: { _id: "$lecturerName", totalClasses: { $sum: 1 },
              classes: { $push: "$className" } } },
  { $project: { _id: 0, lecturerName: "$_id", totalClasses: 1, classes: 1 } },
  { $sort: { totalClasses: -1 } },
]);
```

### C7. Sĩ số enrolled mỗi lớp — group trên mảng nhúng bằng $unwind
`GET /api/reports/classes/enrollment-count`
```js
const report = await Class.aggregate([
  { $unwind: "$enrollments" },
  { $match: { "enrollments.status": "enrolled" } },
  { $group: { _id: "$_id", className: { $first: "$className" }, enrolled: { $sum: 1 } } },
  { $project: { _id: 0, className: 1, enrolled: 1 } },
  { $sort: { enrolled: -1 } },
]);
```

### C8. Đếm số MÔN theo status (ACTIVE/INACTIVE) — group đơn giản
```js
await Subject.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } },
]);
```

### C9. TOP N sinh viên vắng nhiều nhất
`GET /api/reports/top-absent?limit=3`
```js
const limit = parseInt(req.query.limit) || 5;
const report = await Attendance.aggregate([
  { $match: { status: "ABSENT" } },
  { $group: { _id: "$studentId", absentCount: { $sum: 1 } } },
  { $sort: { absentCount: -1 } },
  { $limit: limit },
  { $lookup: { from: "students", localField: "_id", foreignField: "_id", as: "s" } },
  { $unwind: "$s" },
  { $project: { _id: 0, studentCode: "$s.studentCode", fullName: "$s.fullName", absentCount: 1 } },
]);
```

### C10. Tỉ lệ đi học theo THỨ trong tuần (day-of-week)
```js
const report = await Attendance.aggregate([
  {
    $group: {
      _id: { $dayOfWeek: "$date" }, // 1=CN ... 7=T7
      total: { $sum: 1 },
      present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } },
    },
  },
  { $addFields: { rate: { $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 1] } } },
  { $sort: { _id: 1 } },
]);
```

### C11. Kiểm tra lệch dữ liệu: so summary vs log thật
`GET /api/reports/summary-mismatch` (câu "khó bẫy" — DB seed có case lệch!)
```js
const real = await Attendance.aggregate([
  { $group: { _id: { classId: "$classId", studentId: "$studentId" }, realTotal: { $sum: 1 } } },
]);
// so realTotal với AttendanceSummary.totalSessions ở tầng JS -> báo dòng nào lệch
```

---

# D. NHÓM CÂU POST / PUT / DELETE (mutation)

> Nhớ `app.use(express.json())` ở đầu file.

### D1. Tạo Subject (validate + chống trùng code)
`POST /api/subjects`
```js
app.post("/api/subjects", async (req, res) => {
  try {
    const created = await Subject.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Trùng code" });
    if (err.name === "ValidationError")
      return res.status(400).json({ errors: Object.values(err.errors).map(e => e.message) });
    res.status(500).json({ error: err.message });
  }
});
```

### D2. Tạo Class (kiểm subjectId tồn tại trước)
`POST /api/classes`
```js
app.post("/api/classes", async (req, res) => {
  const { subjectId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(subjectId))
    return res.status(400).json({ error: "Invalid subjectId" });
  const subject = await Subject.findById(subjectId);
  if (!subject) return res.status(404).json({ error: "Subject not found" });
  const created = await Class.create(req.body);
  res.status(201).json(created);
});
```

### D3. Ghi danh SV vào lớp (thêm mảng nhúng) — câu 4.2
→ xem `ONTAP-de-thi-mau.md` câu 4.2. Điểm cần: chặn trùng + lớp CLOSED.

### D4. Rút môn (đổi status enrollment sang "dropped")
`PUT /api/classes/:classId/drop` · body `{ studentId }`
```js
app.put("/api/classes/:classId/drop", async (req, res) => {
  const { classId } = req.params;
  const { studentId } = req.body;
  const cls = await Class.findById(classId);
  if (!cls) return res.status(404).json({ error: "Class not found" });
  const enr = cls.enrollments.find((e) => e.studentId.toString() === studentId);
  if (!enr) return res.status(404).json({ error: "SV chưa ghi danh" });
  enr.status = "dropped";
  await cls.save();
  res.json(cls);
});

// Cách 2: cập nhật trực tiếp phần tử mảng bằng arrayFilters
await Class.updateOne(
  { _id: classId },
  { $set: { "enrollments.$[e].status": "dropped" } },
  { arrayFilters: [{ "e.studentId": new mongoose.Types.ObjectId(studentId) }] }
);
```

### D5. Điểm danh 1 buổi (upsert chống trùng) — câu 4.1
→ xem câu 4.1 (`findOneAndUpdate` + `upsert: true`).

### D6. Điểm danh HÀNG LOẠT cả lớp trong 1 ngày
`POST /api/attendances/bulk` · body `{ classId, date, records: [{studentId, status}] }`
```js
app.post("/api/attendances/bulk", async (req, res) => {
  const { classId, date, records } = req.body;
  const ops = records.map((r) => ({
    updateOne: {
      filter: { classId, studentId: r.studentId, date: new Date(date) },
      update: { status: r.status },
      upsert: true,
    },
  }));
  const result = await Attendance.bulkWrite(ops);
  res.status(201).json(result);
});
```

### D7. Đóng lớp
`PUT /api/classes/:id/close`
```js
const updated = await Class.findByIdAndUpdate(id, { status: "CLOSED" },
  { new: true, runValidators: true });
```

### D8. Tính lại (recompute) summary cho 1 lớp từ log gốc — GHÉP aggregate + ghi
`POST /api/classes/:classId/recompute-summary`
```js
app.post("/api/classes/:classId/recompute-summary", async (req, res) => {
  const { classId } = req.params;
  const agg = await Attendance.aggregate([
    { $match: { classId: new mongoose.Types.ObjectId(classId) } },
    { $group: {
        _id: "$studentId",
        totalSessions: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } },
        absent:  { $sum: { $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0] } },
    }},
  ]);
  for (const r of agg) {
    const rate = Math.round((r.present / r.totalSessions) * 1000) / 10;
    await AttendanceSummary.findOneAndUpdate(
      { classId, studentId: r._id },
      { totalSessions: r.totalSessions, present: r.present, absent: r.absent,
        attendanceRate: rate, warning: rate < 80 },
      { upsert: true, new: true }
    );
  }
  res.json({ updated: agg.length });
});
```

### D9. Xóa 1 buổi điểm danh
`DELETE /api/attendances/:id`
```js
const deleted = await Attendance.findByIdAndDelete(id);
if (!deleted) return res.status(404).json({ error: "Not found" });
res.json({ message: "Deleted" });
```

---

# E. CHEAT-SHEET aggregate (thuộc là ghép được mọi câu)

| Toán tử | Dùng để |
|---|---|
| `$match` | lọc (như WHERE), đặt **đầu pipeline** cho nhanh |
| `$group` `{_id, x:{$sum:1}}` | gom nhóm; `_id` = trường gom |
| `$sum`, `$avg`, `$max`, `$min` | tính toán trong group |
| `$sum: { $cond: [ĐK, 1, 0] }` | **đếm có điều kiện** (present/absent) |
| `$push`, `$addToSet` | gom giá trị thành mảng |
| `$lookup` | JOIN sang collection khác |
| `$unwind` | tách mảng (sau lookup, hoặc mảng nhúng) |
| `$project` | chọn/đổi tên field; `_id:0` để ẩn |
| `$addFields` / `$set` | thêm field tính toán |
| `$sort`, `$limit`, `$skip` | sắp xếp, phân trang |
| `$round`, `$divide`, `$multiply` | tính tỉ lệ % |
| `$dateToString`, `$dayOfWeek`, `$month`, `$year` | gom theo thời gian |
| `$cond`, `$ifNull`, `$switch` | if/else trong aggregate |

**Khung sườn copy nhanh cho câu report:**
```js
const r = await Attendance.aggregate([
  { $match: { /* lọc */ } },
  { $group: { _id: "$field", total: { $sum: 1 } } },
  { $lookup: { from: "collection", localField: "_id", foreignField: "_id", as: "x" } },
  { $unwind: "$x" },
  { $project: { _id: 0, name: "$x.name", total: 1 } },
  { $sort: { total: -1 } },
]);
```

---

# F. BẪY hay gặp (đọc lại trước khi nộp)

1. `$lookup` `from` sai tên → collection **số nhiều-lowercase**; `AttendanceSummary` → `attendancesummaries`.
2. `$match` theo `_id`/khóa ngoại phải bọc `new mongoose.Types.ObjectId(id)`.
3. Populate field trong mảng: `"enrollments.studentId"` (có dấu chấm).
4. Quên `express.json()` → `req.body` = undefined ở POST/PUT.
5. `findByIdAndUpdate` thiếu `{ new: true, runValidators: true }`.
6. Chia cho 0 khi `totalSessions = 0` → dùng `$cond`/kiểm tra trước.
7. Trả sai tên field so với đề (đề chấm bằng so khớp JSON).
8. Với mảng nhúng cần đếm/lọc từng phần tử → nhớ `$unwind` trước `$group`.
9. So sánh ObjectId ở JS: dùng `.toString()` cả 2 vế.
10. `$sum: { $cond: ["$warning", 1, 0] }` — đếm theo boolean field trực tiếp được.

Chúc thi tốt! 🎯
