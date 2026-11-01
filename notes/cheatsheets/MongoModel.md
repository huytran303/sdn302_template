
# MongoDB Model Creation Examples

## 1. Single-Level Model
   - **Description**: A basic model with simple fields, similar to a flat structure.
   - **Example**:

   ```javascript
   const mongoose = require("mongoose");

   const userSchema = new mongoose.Schema({
     name: { type: String, required: true },
     age: { type: Number, required: true },
     email: { type: String, unique: true },
     createdAt: { type: Date, default: Date.now }
   });

   module.exports = mongoose.model("User", userSchema);
   ```

   > **Ghi chú — `_id` kiểu String thay vì ObjectId:**
   >
   > Mặc định Mongoose tự tạo `_id` kiểu `ObjectId` (ví dụ `"60d5ec49b9a8f914c4e8a6b1"`). Nếu đề yêu cầu `_id` là **String** (mã tự đặt như `"SP01"`, `"U001"`), khai báo `_id` tường minh trong Schema:
   >
   > ```javascript
   > const productSchema = new mongoose.Schema({
   >   _id: { type: String, required: true },  // _id là String, KHÔNG phải ObjectId
   >   name: String,
   >   price: Number
   > });
   >
   > module.exports = mongoose.model("Product", productSchema);
   > ```
   >
   > Khi đó **phải tự truyền `_id`** lúc tạo document (Mongoose không tự sinh nữa):
   >
   > ```javascript
   > await Product.create({ _id: "SP01", name: "Book", price: 100 });
   > await Product.findById("SP01"); // tìm bằng chuỗi, không cần ObjectId
   > ```
   >
   > - Với `ref` trỏ tới model có `_id` String, field khóa ngoại cũng phải là `String`:
   >   ```javascript
   >   author: { type: String, ref: "User" }   // thay vì mongoose.Schema.Types.ObjectId
   >   ```
   > - Có thể tắt `_id` mặc định của subdocument bằng `{ _id: false }` nếu không cần.

## 2. Nested Model (Embedded Documents)
   - **Description**: A model with nested objects, often used for storing related information within the same document.
   - **Example**:

   ```javascript
   const mongoose = require("mongoose");

   const userSchema = new mongoose.Schema({
     name: String,
     address: {
       street: String,
       city: String,
       postalCode: String
     }
   });

   module.exports = mongoose.model("User", userSchema);
   ```

   > **Ghi chú — Nested object `{...}` vs Subdocument `new Schema({...})`:**
   >
   > Có 2 cách khai báo object lồng, **cả hai đều đúng**:
   >
   > ```javascript
   > // Cách 1 — Nested object (như ví dụ trên): ngắn gọn, KHÔNG có _id riêng
   > address: {
   >   street: String,
   >   city: String
   > }
   >
   > // Cách 2 — Subdocument: có _id riêng, validate được cả cụm, tái sử dụng được
   > const addressSchema = new mongoose.Schema({ street: String, city: String });
   > // ...
   > address: { type: addressSchema, required: true }
   > ```
   >
   > | Tiêu chí                              | Nested `{...}`      | Subdocument `new Schema({...})` |
   > | ------------------------------------- | ------------------- | ------------------------------- |
   > | Có `_id` riêng cho object con         | ❌ Không            | ✅ Có (mặc định)                |
   > | `required`/`validate` cho cả cụm      | Hạn chế             | ✅ Đầy đủ                       |
   > | Tái sử dụng cho nhiều model           | ❌                  | ✅                              |
   > | Độ ngắn gọn                           | ✅ Ngắn hơn         | Dài hơn                         |
   >
   > → CRUD đơn giản dùng **nested object** là đủ. Chỉ cần `new Schema({...})` khi object con cần **`_id` riêng**, **validate phức tạp**, hoặc **dùng lại nhiều nơi**.
   >
   > Với **mảng** object con (mục 3 bên dưới), Mongoose **tự động** biến mỗi phần tử thành subdocument có `_id`.

## 3. Array of Subdocuments
   - **Description**: A model with an array of subdocuments, where each element is an embedded object.
   - **Example**:

   ```javascript
   const mongoose = require("mongoose");

   const userSchema = new mongoose.Schema({
     name: String,
     contacts: [
       {
         type: { type: String, enum: ["phone", "email"] },
         value: String
       }
     ]
   });

   module.exports = mongoose.model("User", userSchema);
   ```

## 4. Referenced Models (One-to-Many Relationship)
   - **Description**: Models referencing other documents, ideal for relationships where documents are stored separately.
   - **Example**:

   ```javascript
   const mongoose = require("mongoose");

   const postSchema = new mongoose.Schema({
     title: String,
     content: String,
     author: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
   });

   module.exports = mongoose.model("Post", postSchema);
   ```

## 5. Self-Referencing Model (Recursive Relationship)
   - **Description**: A model that references other documents of the same type, useful for hierarchical structures.
   - **Example**:

   ```javascript
   const mongoose = require("mongoose");

   const categorySchema = new mongoose.Schema({
     name: String,
     parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category" }
   });

   module.exports = mongoose.model("Category", categorySchema);
   ```

## 6. Many-to-Many Relationship with Arrays of References
   - **Description**: A model with arrays referencing multiple documents, suitable for many-to-many relationships.
   - **Example**:

   ```javascript
   const mongoose = require("mongoose");

   const courseSchema = new mongoose.Schema({
     title: String,
     students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }]
   });

   module.exports = mongoose.model("Course", courseSchema);
   ```

## 7. Model with Timestamps
   - **Description**: A model that uses automatic timestamps for `createdAt` and `updatedAt` fields.
   - **Example**:

   ```javascript
   const mongoose = require("mongoose");

   const productSchema = new mongoose.Schema(
     {
       name: String,
       price: Number
     },
     { timestamps: true }
   );

   module.exports = mongoose.model("Product", productSchema);
   ```

## 8. Discriminators for Inheritance (Single Collection for Multiple Models)
   - **Description**: Allows creating different types of models that share common fields within the same collection.
   - **Example**:

   ```javascript
   const mongoose = require("mongoose");

   const baseOptions = {
     discriminatorKey: "type",
     collection: "items"
   };

   const itemSchema = new mongoose.Schema(
     {
       name: String,
       price: Number
     },
     baseOptions
   );

   const Item = mongoose.model("Item", itemSchema);

   const Book = Item.discriminator(
     "Book",
     new mongoose.Schema({ author: String })
   );

   const Furniture = Item.discriminator(
     "Furniture",
     new mongoose.Schema({ material: String })
   );

   module.exports = { Item, Book, Furniture };
   ```

## 9 . Validate

```javascript
    const mongoose = require("mongoose");

    const reservationSchema = new mongoose.Schema({
    customerName: String,
    reservationDate: { 
        type: Date, 
        required: true,
        validate: {
        validator: function(value) {
            //Date.now()
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');
            return value >= startDate && value <= endDate;
        },
        message: "Reservation date must be between January 1, 2024 and December 31, 2024."
        }
    }
    });

    module.exports = mongoose.model("Reservation", reservationSchema);
```


---

