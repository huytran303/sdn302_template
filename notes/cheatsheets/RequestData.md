# Lấy dữ liệu từ Request (`req`) trong Express

Tài liệu mô tả cách lấy dữ liệu từ đối tượng **request (`req`)** — nơi chứa mọi thứ client gửi lên server: URL, tham số, body, header, cookie...

Mục lục:
1. [Tổng quan các nguồn dữ liệu](#1-tổng-quan)
2. [req.params — tham số trên URL](#2-reqparams--tham-số-trên-đường-dẫn)
3. [req.query — query string](#3-reqquery--query-string-sau-dấu-)
4. [req.body — dữ liệu trong body](#4-reqbody--dữ-liệu-gửi-lên-post--put--patch)
5. [req.headers — header](#5-reqheaders--http-header)
6. [Cookie, method, url và các field khác](#6-các-field-khác-của-req)
7. [Bảng tra cứu nhanh](#7-bảng-tra-cứu-nhanh)
8. [Ví dụ tổng hợp](#8-ví-dụ-tổng-hợp)

---

## 1. Tổng quan

Client gửi dữ liệu qua **4 nguồn chính**:

| Nguồn         | Nằm ở đâu                          | Ví dụ                                  |
| ------------- | ---------------------------------- | -------------------------------------- |
| `req.params`  | Trên đường dẫn URL (`:tên`)        | `/products/**123**`                    |
| `req.query`   | Sau dấu `?` trên URL               | `/products?**keyword=book&page=2**`    |
| `req.body`    | Trong phần thân request (JSON)     | `{ "name": "Book", "price": 100 }`     |
| `req.headers` | Header của request                 | `Authorization: Bearer <token>`        |

> **Bắt buộc:** để đọc được `req.body` (JSON), `server.js` phải có `app.use(express.json());` — dòng này đã có sẵn trong project.

---

## 2. `req.params` — tham số trên đường dẫn

Dùng khi định danh một tài nguyên cụ thể (theo id, slug...). Khai báo bằng dấu `:` trong route.

```javascript
// Route: GET /products/:id
app.get('/products/:id', (req, res) => {
  const id = req.params.id;   // với URL /products/123 -> id = "123"
  res.send(`ID = ${id}`);
});

// Nhiều params
// Route: GET /users/:userId/orders/:orderId
app.get('/users/:userId/orders/:orderId', (req, res) => {
  const { userId, orderId } = req.params; // destructuring
  res.send(`user=${userId}, order=${orderId}`);
});
```

- Giá trị `req.params` **luôn là chuỗi** (`"123"`). Nếu cần số: `Number(req.params.id)`.
- Dùng để lấy 1 document: `await Product.findById(req.params.id)`.

---

## 3. `req.query` — query string (sau dấu `?`)

Dùng cho tìm kiếm, lọc, phân trang, sắp xếp — những thứ **tùy chọn**.

```javascript
// URL: GET /products?keyword=book&page=2&limit=10&sort=price
app.get('/products', (req, res) => {
  const keyword = req.query.keyword;   // "book"
  const page    = req.query.page;      // "2"
  const { limit, sort } = req.query;   // "10", "price"

  // Nên có giá trị mặc định
  const currentPage = Number(req.query.page) || 1;
  const pageSize    = Number(req.query.limit) || 10;
});
```

**Ví dụ dùng để tìm kiếm + phân trang:**

```javascript
app.get('/products', async (req, res) => {
  try {
    const { keyword, minPrice } = req.query;
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 10;

    // Xây điều kiện lọc động
    const filter = {};
    if (keyword)  filter.name  = { $regex: keyword, $options: 'i' }; // tìm gần đúng, không phân biệt hoa/thường
    if (minPrice) filter.price = { $gte: Number(minPrice) };

    const data = await Product.find(filter)
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

- Giá trị `req.query` cũng **luôn là chuỗi** → ép kiểu khi cần so sánh số.
- `params` = bắt buộc & định danh; `query` = tùy chọn & để lọc/tìm.

---

## 4. `req.body` — dữ liệu gửi lên (POST / PUT / PATCH)

Dùng khi tạo mới hoặc cập nhật. Client gửi JSON trong body.

```javascript
// Client gửi: { "name": "Book", "price": 100, "tags": ["edu"] }
app.post('/products', (req, res) => {
  const name  = req.body.name;        // "Book"
  const price = req.body.price;       // 100 (giữ nguyên kiểu number vì là JSON)
  const { tags } = req.body;          // ["edu"]

  // Lấy toàn bộ body để tạo document
  // const created = await Product.create(req.body);
});
```

**Điều kiện để đọc được `req.body`:**

```javascript
// server.js — PHẢI có dòng này TRƯỚC các route
app.use(express.json());                          // đọc JSON body
app.use(express.urlencoded({ extended: true }));  // đọc form-urlencoded (tùy chọn)
```

- Khác `params`/`query`, dữ liệu trong `req.body` **giữ đúng kiểu JSON** (number là number, boolean là boolean, có thể là object/array lồng nhau).
- Client (Postman) phải set header `Content-Type: application/json`.

---

## 5. `req.headers` — HTTP header

Chứa metadata của request: kiểu nội dung, xác thực, thông tin client...

```javascript
app.get('/profile', (req, res) => {
  // Tên header KHÔNG phân biệt hoa/thường, thường viết thường
  const contentType = req.headers['content-type'];
  const auth        = req.headers['authorization']; // "Bearer eyJhbGci..."
  const custom      = req.headers['x-api-key'];

  // Cách khác
  const auth2 = req.get('Authorization');
});
```

**Trường hợp phổ biến — lấy JWT từ header `Authorization`:**

```javascript
const authHeader = req.headers.authorization; // "Bearer <token>"
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return res.status(401).json({ error: 'Thiếu token' });
}
const token = authHeader.split(' ')[1]; // tách lấy phần token sau chữ "Bearer "
```

> Xem chi tiết xử lý token trong [`JWT.md`](./JWT.md).

---

## 6. Các field khác của `req`

```javascript
req.method;    // "GET", "POST"... — HTTP method
req.url;       // "/products?page=2" — đường dẫn + query
req.path;      // "/products" — chỉ đường dẫn
req.baseUrl;   // tiền tố nếu dùng Router
req.protocol;  // "http" hoặc "https"
req.hostname;  // "localhost"
req.ip;        // địa chỉ IP client

// Cookie (cần middleware cookie-parser)
req.cookies;   // { token: "...", ... }
```

---

## 7. Bảng tra cứu nhanh

| Muốn lấy...                          | Dùng                       | Kiểu dữ liệu |
| ------------------------------------ | -------------------------- | ------------ |
| ID trên URL `/products/:id`          | `req.params.id`            | chuỗi        |
| Từ khóa tìm kiếm `?keyword=x`        | `req.query.keyword`        | chuỗi        |
| Dữ liệu form/JSON khi tạo mới        | `req.body`                 | đúng kiểu JSON |
| Token xác thực                       | `req.headers.authorization`| chuỗi        |
| Loại nội dung                        | `req.headers['content-type']` | chuỗi     |
| Phương thức HTTP                     | `req.method`               | chuỗi        |
| Cookie                               | `req.cookies`              | object       |

**Ghi nhớ:** `params` & `query` → **luôn là chuỗi** (ép kiểu khi cần); `body` → **giữ nguyên kiểu JSON**.

---

## 8. Ví dụ tổng hợp

Một handler dùng cả 4 nguồn cùng lúc:

```javascript
// PUT /products/:id?notify=true
// Header: Authorization: Bearer <token>
// Body:   { "price": 150 }
app.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;              // params: id sản phẩm
    const { notify } = req.query;           // query: cờ tùy chọn
    const token = req.headers.authorization?.split(' ')[1]; // header: token
    const updateData = req.body;            // body: dữ liệu cập nhật

    const updated = await Product.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });

    if (notify === 'true') {
      // ... gửi thông báo
    }
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

Xem thêm: [`JSProcessing.md`](./JSProcessing.md) — cấu trúc controller & response; [`MongoQuery.md`](./MongoQuery.md) — dùng dữ liệu lấy được để truy vấn DB.
