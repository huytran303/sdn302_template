# JavaScript Processing Functions — Hướng dẫn sử dụng

Tài liệu này mô tả cách viết và sử dụng **các hàm xử lý (processing functions)** trong một ứng dụng Express + Mongoose (bài thi SDN302). Bao gồm:

1. [Cấu trúc một route handler / controller](#1-route-handler--controller)
2. [Lấy dữ liệu từ request](#2-lấy-dữ-liệu-từ-request-req)
3. [Trả về response](#3-trả-về-response-res)
4. [Async / await và xử lý lỗi](#4-async--await-và-xử-lý-lỗi)
5. [Gọi hàm xử lý dữ liệu qua Mongoose Model](#5-gọi-hàm-xử-lý-qua-mongoose-model)
6. [Các hàm xử lý mảng / dữ liệu trong JS](#6-các-hàm-xử-lý-mảng--dữ-liệu-thuần-js)
7. [Tách controller ra file riêng](#7-tách-controller-ra-file-riêng-khuyến-nghị)
8. [Middleware — hàm xử lý trung gian](#8-middleware--hàm-xử-lý-trung-gian)
9. [Checklist khi làm bài](#9-checklist-khi-làm-bài)

Xem thêm: [`MongoModel.md`](./MongoModel.md) (tạo Schema/Model) và [`MongoQuery.md`](./MongoQuery.md) (các câu truy vấn MongoDB).

---

## 1. Route handler / Controller

**Hàm xử lý** trong Express là một hàm nhận `(req, res)` — được gọi khi có request khớp với route. Đây là nơi bạn xử lý logic và trả kết quả về client.

```javascript
// GET / — route đơn giản (đã có sẵn trong server.js)
app.get('/', async (req, res) => {
  try {
    res.send({ message: 'Welcome to Practical Exam!' });
  } catch (error) {
    res.send({ error: error.message });
  }
});
```

Các HTTP method thường dùng:

| Method  | Dùng để          | Ví dụ route                     |
| ------- | ---------------- | ------------------------------- |
| GET     | Lấy dữ liệu      | `app.get('/products', ...)`     |
| POST    | Thêm mới         | `app.post('/products', ...)`    |
| PUT     | Cập nhật toàn bộ | `app.put('/products/:id', ...)` |
| PATCH   | Cập nhật 1 phần  | `app.patch('/products/:id', ...)` |
| DELETE  | Xóa              | `app.delete('/products/:id', ...)` |

---

## 2. Lấy dữ liệu từ request (`req`)

```javascript
app.post('/products/:id', async (req, res) => {
  const id = req.params.id;        // Tham số trên URL: /products/123 -> "123"
  const { name, price } = req.body; // Dữ liệu JSON gửi trong body (cần express.json())
  const keyword = req.query.keyword; // Query string: /products?keyword=abc -> "abc"
  const page = req.query.page || 1;  // Có giá trị mặc định nếu không truyền
});
```

- **`req.params`**: dữ liệu nằm trên đường dẫn URL (khai báo bằng `:tên`).
- **`req.body`**: dữ liệu client gửi lên (POST/PUT/PATCH). **Bắt buộc** có `app.use(express.json())` trong `server.js` để đọc được.
- **`req.query`**: dữ liệu sau dấu `?` trên URL (dùng cho lọc, phân trang, tìm kiếm).

---

## 3. Trả về response (`res`)

```javascript
// Trả JSON kèm mã trạng thái HTTP
res.status(200).json({ data: products });   // 200 OK
res.status(201).json(newProduct);           // 201 Created — sau khi thêm mới
res.status(400).json({ error: 'Bad request' }); // 400 — dữ liệu không hợp lệ
res.status(404).json({ error: 'Not found' });    // 404 — không tìm thấy
res.status(500).json({ error: error.message });  // 500 — lỗi server

// res.send() và res.json() đều gửi dữ liệu; res.json() luôn set Content-Type: application/json
res.send({ message: 'OK' });
```

Các mã trạng thái nên nhớ: **200** (thành công), **201** (tạo mới thành công), **400** (client gửi sai), **404** (không tìm thấy), **500** (lỗi server).

---

## 4. Async / await và xử lý lỗi

Mọi thao tác với database đều **bất đồng bộ** → dùng `async/await` và bọc trong `try/catch`.

```javascript
app.get('/products', async (req, res) => {
  try {
    const products = await Product.find();  // await: chờ DB trả kết quả
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: error.message }); // Bắt mọi lỗi phát sinh
  }
});
```

**Quy tắc:**
- Hàm có `await` bên trong → phải khai báo `async`.
- Luôn có `try/catch` để tránh server bị crash khi query lỗi.
- `error.message` cho biết nội dung lỗi cụ thể (ví dụ lỗi validate của Schema).

---

## 5. Gọi hàm xử lý qua Mongoose Model

Sau khi tạo Model (xem `MongoModel.md`), gọi các hàm sau bên trong controller. Chi tiết cú pháp query xem `MongoQuery.md`.

```javascript
const Product = require('./models/Product');

// CREATE — thêm mới
const created = await Product.create({ name: 'Book', price: 100 });
// hoặc:
const p = new Product({ name: 'Book', price: 100 });
await p.save();

// READ — đọc dữ liệu
const all       = await Product.find();                       // Tất cả
const filtered  = await Product.find({ price: { $gt: 50 } });  // Có điều kiện
const one       = await Product.findById(id);                 // Theo _id
const first     = await Product.findOne({ name: 'Book' });     // 1 document
const withRef   = await Product.find().populate('category');   // Kèm dữ liệu tham chiếu

// UPDATE — cập nhật (option { new: true } để trả về document SAU khi cập nhật)
const updated = await Product.findByIdAndUpdate(
  id,
  { $set: { price: 120 } },
  { new: true, runValidators: true } // runValidators: kiểm tra ràng buộc khi update
);

// DELETE — xóa
const deleted = await Product.findByIdAndDelete(id);
```

**Mẫu controller đầy đủ (CRUD một resource):**

```javascript
// GET danh sách
app.get('/products', async (req, res) => {
  try {
    const list = await Product.find();
    res.status(200).json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET theo id — nhớ kiểm tra không tìm thấy
app.get('/products/:id', async (req, res) => {
  try {
    const item = await Product.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Product not found' });
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST tạo mới
app.post('/products', async (req, res) => {
  try {
    const created = await Product.create(req.body);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: error.message }); // 400 vì thường do dữ liệu sai
  }
});

// PUT cập nhật
app.put('/products/:id', async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Product not found' });
    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE xóa
app.delete('/products/:id', async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 6. Các hàm xử lý mảng / dữ liệu thuần JS

Sau khi lấy dữ liệu từ DB, đôi khi cần xử lý thêm bằng JavaScript trước khi trả về.

```javascript
const products = await Product.find();

// map — biến đổi từng phần tử, trả về mảng mới cùng độ dài
const names = products.map(p => p.name);
const withTax = products.map(p => ({ ...p.toObject(), priceWithTax: p.price * 1.1 }));

// filter — lọc phần tử thỏa điều kiện
const expensive = products.filter(p => p.price > 100);

// find — lấy PHẦN TỬ ĐẦU TIÊN thỏa điều kiện (undefined nếu không có)
const book = products.find(p => p.name === 'Book');

// reduce — gộp mảng thành 1 giá trị (tổng, đếm, gộp object...)
const total = products.reduce((sum, p) => sum + p.price, 0);

// sort — sắp xếp (b - a: giảm dần; a - b: tăng dần)
const sorted = [...products].sort((a, b) => b.price - a.price);

// some / every — kiểm tra điều kiện
const hasCheap = products.some(p => p.price < 10);   // true nếu có ít nhất 1
const allValid = products.every(p => p.price > 0);   // true nếu TẤT CẢ đều thỏa

// forEach — duyệt qua từng phần tử (không trả về mảng mới)
products.forEach(p => console.log(p.name));

// Nối chuỗi hàm xử lý: lọc rồi lấy tên
const cheapNames = products.filter(p => p.price < 50).map(p => p.name);
```

> **Lưu ý:** Với dữ liệu đơn giản nên ưu tiên xử lý bằng **query MongoDB** (nhanh hơn, xem `MongoQuery.md`). Chỉ dùng hàm JS khi cần biến đổi dữ liệu sau khi đã lấy về.

Các hàm xử lý chuỗi/số hay dùng:

```javascript
'Hello'.toLowerCase();          // "hello"
'  a  '.trim();                 // "a"
'a,b,c'.split(',');            // ["a", "b", "c"]
['a','b'].join('-');           // "a-b"
Number('12');                   // 12
parseInt('12px');               // 12
(3.14159).toFixed(2);          // "3.14"
`Giá: ${p.price} đ`;            // Template string
```

---

## 7. Tách controller ra file riêng (khuyến nghị)

Với dự án lớn, tách hàm xử lý ra khỏi `server.js` cho gọn.

```javascript
// controllers/productController.js
const Product = require('../models/Product');

exports.getAll = async (req, res) => {
  try {
    const list = await Product.find();
    res.status(200).json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const created = await Product.create(req.body);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
```

```javascript
// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/productController');

router.get('/', controller.getAll);
router.post('/', controller.create);

module.exports = router;
```

```javascript
// server.js
const productRoutes = require('./routes/productRoutes');
app.use('/products', productRoutes); // Gắn router vào đường dẫn gốc /products
```

---

## 8. Middleware — hàm xử lý trung gian

Middleware là hàm nhận `(req, res, next)` chạy **trước** controller — dùng cho log, xác thực, validate...

```javascript
// Middleware kiểm tra dữ liệu đầu vào
const validateProduct = (req, res, next) => {
  const { name, price } = req.body;
  if (!name || price == null) {
    return res.status(400).json({ error: 'name và price là bắt buộc' });
  }
  next(); // Gọi next() để tiếp tục sang handler tiếp theo
};

app.post('/products', validateProduct, async (req, res) => {
  const created = await Product.create(req.body);
  res.status(201).json(created);
});
```

Các middleware toàn cục (khai báo trong `server.js`):

```javascript
app.use(express.json());   // Đọc JSON body -> req.body
app.use(require('cors')()); // Cho phép gọi API từ domain khác
app.use(require('morgan')('dev')); // Log request ra console
```

---

## 9. Checklist khi làm bài

- [ ] Tạo Schema/Model đúng yêu cầu (xem `MongoModel.md`), khai báo `required`, `enum`, `ref`, `validate` nếu đề yêu cầu.
- [ ] `server.js` đã có `app.use(express.json())` để đọc `req.body`.
- [ ] Mỗi handler dùng `async/await` + `try/catch`.
- [ ] Lấy đúng nguồn dữ liệu: URL → `req.params`, body → `req.body`, filter → `req.query`.
- [ ] Trả về **đúng status code** (200/201/400/404/500).
- [ ] Trường hợp không tìm thấy (`findById` trả `null`) → trả **404**.
- [ ] Khi update dùng `{ new: true }` để trả document sau khi cập nhật; thêm `runValidators: true` nếu cần kiểm tra ràng buộc.
- [ ] Dùng `populate()` khi đề yêu cầu lấy kèm dữ liệu tham chiếu.
- [ ] Test bằng Postman/REST client trước khi nộp.

---

**Ghi chú:**
- `req` = request (dữ liệu client gửi lên), `res` = response (dữ liệu server trả về), `next` = chuyển sang middleware/handler kế tiếp.
- `await` chỉ dùng được bên trong hàm `async`.
- Model được import bằng `require('./models/TênModel')`.
