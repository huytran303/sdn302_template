# Sử dụng JWT (JSON Web Token) trong Express

Tài liệu mô tả cách dùng **JWT** để xác thực (authentication) trong ứng dụng Express — dùng thư viện `jsonwebtoken` (đã có sẵn trong `package.json`) kèm `bcryptjs` để mã hóa mật khẩu.

Mục lục:
1. [JWT là gì & luồng hoạt động](#1-jwt-là-gì)
2. [Cài đặt & import](#2-import)
3. [Tạo token — jwt.sign()](#3-tạo-token--jwtsign)
4. [Xác thực token — jwt.verify()](#4-xác-thực-token--jwtverify)
5. [Middleware bảo vệ route](#5-middleware-bảo-vệ-route)
6. [Mã hóa mật khẩu với bcrypt](#6-mã-hóa-mật-khẩu-với-bcrypt)
7. [Ví dụ đầy đủ: Register + Login + Protected route](#7-ví-dụ-đầy-đủ)
8. [Lấy token & thông tin user](#8-lấy-token--thông-tin-user)
9. [Lỗi thường gặp](#9-lỗi-thường-gặp)

---

## 1. JWT là gì

**JWT** là một chuỗi mã hóa chứa thông tin người dùng (payload), được server ký bằng một khóa bí mật. Client giữ token này và gửi kèm mỗi request để chứng minh danh tính.

**Luồng hoạt động:**

```
1. User đăng nhập (email + password)
2. Server kiểm tra đúng -> tạo token bằng jwt.sign() -> trả về client
3. Client lưu token, gửi kèm header: Authorization: Bearer <token>
4. Server dùng jwt.verify() kiểm tra token -> cho phép truy cập
```

Token gồm 3 phần (ngăn bởi dấu `.`): `header.payload.signature`.

---

## 2. Import

```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Khóa bí mật nên để trong file .env
const JWT_SECRET = process.env.JWT_SECRET || 'my_secret_key';
```

File `.env`:

```
JWT_SECRET=your_super_secret_key_here
```

---

## 3. Tạo token — `jwt.sign()`

Dùng sau khi đăng nhập thành công.

```javascript
// jwt.sign(payload, secret, options)
const token = jwt.sign(
  { id: user._id, email: user.email, role: user.role }, // payload: thông tin muốn nhúng
  JWT_SECRET,                                            // khóa bí mật để ký
  { expiresIn: '1h' }                                    // thời gian hết hạn
);
```

- **payload**: chỉ nên chứa thông tin định danh (id, email, role) — **KHÔNG** để mật khẩu.
- **expiresIn**: `'1h'` (1 giờ), `'7d'` (7 ngày), `'30m'`, hoặc số giây `3600`.
- Kết quả là một chuỗi token gửi về client.

---

## 4. Xác thực token — `jwt.verify()`

Dùng để kiểm tra token client gửi lên có hợp lệ không.

```javascript
try {
  // jwt.verify(token, secret) -> trả về payload nếu hợp lệ
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log(decoded); // { id: '...', email: '...', role: '...', iat: ..., exp: ... }
} catch (error) {
  // Ném lỗi nếu token sai hoặc hết hạn
  console.log(error.name); // "JsonWebTokenError" hoặc "TokenExpiredError"
}

// Giải mã KHÔNG kiểm tra chữ ký (chỉ đọc, ít dùng)
const payload = jwt.decode(token);
```

---

## 5. Middleware bảo vệ route

Tạo một middleware kiểm tra token, gắn thông tin user vào `req`, rồi cho đi tiếp.

```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'my_secret_key';

const authMiddleware = (req, res, next) => {
  // 1. Lấy token từ header Authorization: "Bearer <token>"
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập / thiếu token' });
  }
  const token = authHeader.split(' ')[1]; // tách lấy token

  // 2. Xác thực token
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;  // gắn thông tin user vào req để handler sau dùng
    next();              // hợp lệ -> cho đi tiếp
  } catch (error) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

module.exports = authMiddleware;
```

**Dùng middleware để bảo vệ route:**

```javascript
const auth = require('./middleware/auth');

// Chỉ user đã đăng nhập mới truy cập được
app.get('/profile', auth, (req, res) => {
  res.json({ message: 'Thông tin cá nhân', user: req.user });
});
```

**Kiểm tra quyền (role) — middleware nâng cao:**

```javascript
const requireRole = (role) => (req, res, next) => {
  if (req.user.role !== role) {
    return res.status(403).json({ error: 'Không đủ quyền' }); // 403 Forbidden
  }
  next();
};

app.delete('/products/:id', auth, requireRole('admin'), handler);
```

---

## 6. Mã hóa mật khẩu với bcrypt

**Không bao giờ** lưu mật khẩu dạng plaintext. Dùng `bcryptjs` để hash.

```javascript
const bcrypt = require('bcryptjs');

// Khi đăng ký — hash mật khẩu trước khi lưu
const hashedPassword = await bcrypt.hash(plainPassword, 10); // 10 = số vòng salt

// Khi đăng nhập — so sánh mật khẩu nhập vào với hash trong DB
const isMatch = await bcrypt.compare(plainPassword, user.password);
if (!isMatch) {
  return res.status(400).json({ error: 'Sai mật khẩu' });
}
```

---

## 7. Ví dụ đầy đủ

Giả sử có Model `User` với các field `email`, `password`, `role` (xem `MongoModel.md`).

```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const JWT_SECRET = process.env.JWT_SECRET || 'my_secret_key';

// ===== ĐĂNG KÝ =====
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Kiểm tra email đã tồn tại chưa
    const existed = await User.findOne({ email });
    if (existed) return res.status(400).json({ error: 'Email đã được dùng' });

    // Hash mật khẩu rồi lưu
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashedPassword });

    res.status(201).json({ message: 'Đăng ký thành công', id: user._id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== ĐĂNG NHẬP =====
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Tìm user theo email
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Sai email hoặc mật khẩu' });

    // 2. So sánh mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Sai email hoặc mật khẩu' });

    // 3. Tạo token trả về
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({ message: 'Đăng nhập thành công', token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ROUTE ĐƯỢC BẢO VỆ =====
app.get('/me', authMiddleware, async (req, res) => {
  // req.user được gắn từ middleware sau khi verify token
  const user = await User.findById(req.user.id).select('-password'); // bỏ field password
  res.status(200).json(user);
});
```

---

## 8. Lấy token & thông tin user

**Phía client (Postman / frontend):** gắn token vào header mỗi request cần xác thực:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

**Phía server:** lấy token và giải mã:

```javascript
// Lấy token thô từ header
const token = req.headers.authorization?.split(' ')[1];

// Sau khi qua authMiddleware, thông tin user nằm ở req.user
app.get('/orders', authMiddleware, (req, res) => {
  const userId = req.user.id;      // lấy id người đang đăng nhập
  const role   = req.user.role;    // lấy role
  // -> dùng để lọc dữ liệu của riêng user: Order.find({ userId })
});
```

---

## 9. Lỗi thường gặp

| Lỗi                              | Nguyên nhân                                   | Cách xử lý                                        |
| -------------------------------- | --------------------------------------------- | ------------------------------------------------- |
| `jwt must be provided`           | Token rỗng / không tách đúng                  | Kiểm tra `authHeader.split(' ')[1]`               |
| `invalid signature`              | Sai `JWT_SECRET` giữa lúc sign và verify       | Dùng cùng một secret (đọc từ `.env`)              |
| `jwt expired`                    | Token hết hạn                                  | Đăng nhập lại lấy token mới                        |
| `req.user` là `undefined`        | Quên gắn `authMiddleware` vào route            | Thêm middleware: `app.get('/x', auth, handler)`   |
| Mật khẩu so sánh luôn sai        | Lưu plaintext nhưng `compare` với hash         | Hash bằng `bcrypt.hash()` khi đăng ký             |
| `req.body` là `undefined`        | Thiếu `app.use(express.json())`                | Thêm vào `server.js` trước các route              |

**Ghi nhớ:**
- `jwt.sign()` → **tạo** token (lúc login).
- `jwt.verify()` → **kiểm tra** token (mỗi request cần bảo vệ).
- Token gửi qua header `Authorization: Bearer <token>`, tách bằng `.split(' ')[1]`.
- Sau khi verify, gắn payload vào `req.user` để các handler dùng.

Xem thêm: [`RequestData.md`](./RequestData.md) — cách lấy header/body; [`JSProcessing.md`](./JSProcessing.md) — middleware & controller; [`MongoModel.md`](./MongoModel.md) — tạo Model User.
