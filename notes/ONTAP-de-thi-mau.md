# SDN302 — Đề thi mẫu (dự đoán) trên DB điểm danh

> **Cách đoán đề**: dựa vào file `server.js` mẫu (`"Welcome to Practical Exam!"`) — đề thật cho sẵn **models + connectDB**, bạn chỉ viết **endpoint**. Có đúng **3 dạng câu** lặp lại:
> 1. **Chi tiết + populate** → trả JSON custom shape (giống `/api/projects/department/:depId`)
> 2. **List liên quan** → `find` theo khóa ngoại + populate (giống `/api/projects/:proId/employees`)
> 3. **Report + aggregate** → `$group → $lookup → $unwind → $project → sort` (giống `/api/reports/projects/work-hours`)
>
> Dưới đây áp 3 dạng đó lên **DB điểm danh** (`subjects, students, classes, attendances, attendanceSummaries`).

---

## Quy ước chấm điểm (rút từ code mẫu)

Đề mẫu luôn kiểm:
- ✅ Validate ObjectId: `if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400)...`
- ✅ Not found → `res.status(404)`
- ✅ `.populate("field", "subfield -_id")` để join
- ✅ `.select(...)` để chọn field
- ✅ Trả **đúng shape JSON** đề yêu cầu (đặt tên field y hệt)
- ✅ Report thì thường **sort** theo 1 tiêu chí

> **Models**: giả định đã có sẵn (xem `ONTAP-mongoose-models.md`). Tên model: `Subject, Student, Class, Attendance, AttendanceSummary`.

---

# DẠNG 1 — Chi tiết + populate

## Câu 1.1. Lấy thông tin 1 lớp kèm môn học và giảng viên
**Endpoint:** `GET /api/classes/:classId`

**Yêu cầu output:**
```json
{
  "className": "SE1701",
  "subject": { "code": "PRJ301", "name": "Project Management", "credits": 3 },
  "lecturerName": "Dr. Nguyen Minh Tuan",
  "status": "OPEN",
  "totalEnrollments": 4
}
```

**Cách làm:** validate id → `findById` + `populate("subjectId")` → reshape → đếm `enrollments.length`.

```js
app.get("/api/classes/:classId", async (req, res) => {
  const { classId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(classId))
    return res.status(400).json({ error: `Invalid ObjectId: ${classId}` });

  const cls = await Class.findById(classId)
    .populate("subjectId", "code name credits -_id");
  if (!cls) return res.status(404).json({ error: "Class not found" });

  res.json({
    className: cls.className,
    subject: cls.subjectId,           // đã populate
    lecturerName: cls.lecturerName,
    status: cls.status,
    totalEnrollments: cls.enrollments.length,
  });
});
```

---

## Câu 1.2. Lấy danh sách sinh viên đang học (enrolled) của 1 lớp
**Endpoint:** `GET /api/classes/:classId/students`

**Yêu cầu:** chỉ trả SV có `status = "enrolled"` (bỏ `dropped`).

**Output:**
```json
{
  "className": "SE1701",
  "students": [
    { "studentCode": "SE001", "fullName": "Nguyen Van An" },
    { "studentCode": "SE002", "fullName": "Tran Thi Bich" }
  ]
}
```

**Cách làm:** populate `enrollments.studentId`, rồi `filter` theo status ở tầng JS.

```js
app.get("/api/classes/:classId/students", async (req, res) => {
  const { classId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(classId))
    return res.status(400).json({ error: `Invalid ObjectId: ${classId}` });

  const cls = await Class.findById(classId)
    .populate("enrollments.studentId", "studentCode fullName -_id");
  if (!cls) return res.status(404).json({ error: "Class not found" });

  const students = cls.enrollments
    .filter((e) => e.status === "enrolled")
    .map((e) => e.studentId);

  res.json({ className: cls.className, students });
});
```

> 💡 Điểm hay quên: populate field **nằm trong mảng nhúng** → viết `"enrollments.studentId"`.

---

# DẠNG 2 — List liên quan (find theo khóa ngoại)

## Câu 2.1. Lịch sử điểm danh của 1 sinh viên trong 1 lớp
**Endpoint:** `GET /api/attendances?studentId=..&classId=..`

**Output:** danh sách buổi, sort theo ngày tăng dần.
```json
[
  { "date": "2026-01-06T00:00:00.000Z", "status": "PRESENT" },
  { "date": "2026-01-13T00:00:00.000Z", "status": "PRESENT" }
]
```

```js
app.get("/api/attendances", async (req, res) => {
  const { studentId, classId } = req.query;
  const filter = {};
  if (studentId) filter.studentId = studentId;
  if (classId) filter.classId = classId;

  const data = await Attendance.find(filter)
    .select("date status -_id")
    .sort({ date: 1 });

  res.json(data);
});
```

---

## Câu 2.2. Tất cả lớp mà 1 sinh viên tham gia + tên môn
**Endpoint:** `GET /api/students/:studentId/classes`

**Cách làm:** tìm các `Class` mà trong mảng `enrollments` có `studentId` này → `$elemMatch` hoặc dot-notation.

```js
app.get("/api/students/:studentId/classes", async (req, res) => {
  const { studentId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(studentId))
    return res.status(400).json({ error: `Invalid ObjectId: ${studentId}` });

  const student = await Student.findById(studentId).select("studentCode fullName");
  if (!student) return res.status(404).json({ error: "Student not found" });

  const classes = await Class.find({ "enrollments.studentId": studentId })
    .populate("subjectId", "code name -_id")
    .select("className subjectId status");

  res.json({ student, classes });
});
```

> 💡 Query field trong mảng nhúng: `Class.find({ "enrollments.studentId": studentId })`.

---

## Câu 2.3. Danh sách SV bị cảnh báo (attendanceRate < 80) toàn hệ thống
**Endpoint:** `GET /api/reports/warnings`

```js
app.get("/api/reports/warnings", async (req, res) => {
  const data = await AttendanceSummary.find({ warning: true })
    .populate("studentId", "studentCode fullName -_id")
    .populate("classId", "className -_id")
    .select("attendanceRate present absent totalSessions");
  res.json(data);
});
```

---

# DẠNG 3 — Report + Aggregate (câu KHÓ, điểm cao)

## Câu 3.1. Báo cáo điểm danh từng SV trong 1 lớp (tính từ log gốc)
**Endpoint:** `GET /api/reports/classes/:classId/attendance`

**Output** (sort theo attendanceRate tăng dần — vắng nhiều lên đầu):
```json
[
  {
    "studentCode": "SE003", "fullName": "Le Van Cuong",
    "totalSessions": 10, "present": 6, "absent": 4,
    "attendanceRate": 60, "warning": true
  }
]
```

**Pipeline:** `$match` (lọc lớp) → `$group` (đếm) → `$addFields` (rate + warning) → `$lookup` students → `$unwind` → `$project` → `$sort`.

```js
app.get("/api/reports/classes/:classId/attendance", async (req, res) => {
  const { classId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(classId))
    return res.status(400).json({ error: `Invalid ObjectId: ${classId}` });

  const report = await Attendance.aggregate([
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
    { $addFields: { warning: { $lt: ["$attendanceRate", 80] } } },
    { $lookup: { from: "students", localField: "_id", foreignField: "_id", as: "student" } },
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

  res.json(report);
});
```

> ⚠️ Bẫy hay gặp: trong `$match` phải bọc `new mongoose.Types.ObjectId(classId)`, KHÔNG so sánh string thô.

---

## Câu 3.2. Thống kê theo lớp: sĩ số, tỉ lệ chuyên cần trung bình
**Endpoint:** `GET /api/reports/classes/attendance-summary`

**Output** (mỗi lớp 1 dòng, kèm tên môn, sort rate giảm dần):
```json
[
  {
    "className": "SE1703", "subjectName": "Software Development Project",
    "totalStudents": 3, "avgAttendanceRate": 79.2
  }
]
```

**Cách làm:** aggregate trên `AttendanceSummary` → `$group` theo `classId` → `$lookup` classes → `$lookup` subjects.

```js
app.get("/api/reports/classes/attendance-summary", async (req, res) => {
  const report = await AttendanceSummary.aggregate([
    {
      $group: {
        _id: "$classId",
        totalStudents: { $sum: 1 },
        avgAttendanceRate: { $avg: "$attendanceRate" },
      },
    },
    { $lookup: { from: "classes", localField: "_id", foreignField: "_id", as: "class" } },
    { $unwind: "$class" },
    { $lookup: { from: "subjects", localField: "class.subjectId", foreignField: "_id", as: "subject" } },
    { $unwind: "$subject" },
    {
      $project: {
        _id: 0,
        className: "$class.className",
        subjectName: "$subject.name",
        totalStudents: 1,
        avgAttendanceRate: { $round: ["$avgAttendanceRate", 1] },
      },
    },
    { $sort: { avgAttendanceRate: -1 } },
  ]);

  res.json(report);
});
```

---

## Câu 3.3. Đếm buổi PRESENT/ABSENT theo từng ngày của 1 lớp
**Endpoint:** `GET /api/reports/classes/:classId/by-date`

**Output:**
```json
[
  { "date": "2026-01-06", "present": 3, "absent": 0 },
  { "date": "2026-01-20", "present": 1, "absent": 2 }
]
```

```js
app.get("/api/reports/classes/:classId/by-date", async (req, res) => {
  const { classId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(classId))
    return res.status(400).json({ error: `Invalid ObjectId: ${classId}` });

  const report = await Attendance.aggregate([
    { $match: { classId: new mongoose.Types.ObjectId(classId) } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } },
        absent:  { $sum: { $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0] } },
      },
    },
    { $project: { _id: 0, date: "$_id", present: 1, absent: 1 } },
    { $sort: { date: 1 } },
  ]);

  res.json(report);
});
```

---

# DẠNG 4 — CRUD / Business (đề đôi khi cho 1 câu POST/PUT)

## Câu 4.1. Điểm danh 1 buổi (chống trùng bằng upsert)
**Endpoint:** `POST /api/attendances`  · body: `{ studentId, classId, date, status }`

```js
app.use(express.json()); // nhớ bật ở đầu file!

app.post("/api/attendances", async (req, res) => {
  try {
    const { studentId, classId, date, status } = req.body;
    if (!["PRESENT", "ABSENT"].includes(status))
      return res.status(400).json({ error: "status phải PRESENT|ABSENT" });

    const record = await Attendance.findOneAndUpdate(
      { studentId, classId, date: new Date(date) },
      { status },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

## Câu 4.2. Ghi danh SV vào lớp (thêm vào mảng nhúng, chặn trùng + lớp CLOSED)
**Endpoint:** `POST /api/classes/:classId/enroll` · body: `{ studentId }`

```js
app.post("/api/classes/:classId/enroll", async (req, res) => {
  const { classId } = req.params;
  const { studentId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(classId))
    return res.status(400).json({ error: `Invalid ObjectId: ${classId}` });

  const cls = await Class.findById(classId);
  if (!cls) return res.status(404).json({ error: "Class not found" });
  if (cls.status === "CLOSED")
    return res.status(400).json({ error: "Lớp đã đóng" });

  const existed = cls.enrollments.some((e) => e.studentId.toString() === studentId);
  if (existed) return res.status(409).json({ error: "SV đã ghi danh" });

  cls.enrollments.push({ studentId, status: "enrolled" });
  await cls.save();
  res.status(201).json(cls);
});
```

---

# Bảng đối chiếu code mẫu ↔ đề điểm danh

| Trong `server.js` mẫu (HR) | Tương đương trên DB điểm danh |
|---|---|
| `/api/projects/department/:depId` (detail+populate) | Câu 1.1 — lớp + môn học |
| `/api/projects/:proId/employees` (list+populate) | Câu 2.2 — SV + các lớp |
| `/api/reports/projects/work-hours` (aggregate 2 tầng group + lookup) | Câu 3.1 / 3.2 — báo cáo điểm danh |
| `$group` theo `empId` rồi group theo `proId` | `$group` theo `studentId` rồi (nếu cần) theo `classId` |
| `.reduce()` tính tổng ở JS | thay bằng `$sum` trong aggregate |

---

# Checklist 60 giây trước khi nộp

- [ ] `app.use(express.json())` nếu có POST/PUT.
- [ ] Mỗi endpoint: validate ObjectId → 400; not found → 404.
- [ ] `populate` đúng tên field + có `ref` trong schema; field trong mảng dùng `"arr.field"`.
- [ ] Aggregate `$match` theo id: `new mongoose.Types.ObjectId(id)`.
- [ ] `$lookup` dùng **tên collection** (số nhiều, thường): `students`, `classes`, `subjects`, `attendances`.
- [ ] Trả **đúng tên field** như đề yêu cầu (đề chấm bằng so khớp JSON).
- [ ] `$project: { _id: 0 }` để bỏ `_id` khi đề không cần.
- [ ] Nhớ `$sort` ở report.
- [ ] Test Postman đủ các case (id hợp lệ, id sai, id không tồn tại).

Chúc thi tốt! 🎯
