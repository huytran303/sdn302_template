const express = require('express');
const app = express();
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const connectDB = require('./config/db');
connectDB();
app.use(express.json());

// ===== Helpers =====
class HttpError extends Error {
    constructor(status, message, extra) {
        super(message);
        Object.assign(this, { status, extra });
    }
}

// Returns value when truthy, otherwise answers with { error, ...extra }
function must(value, status, error, extra) {
    if (value) return value;
    throw new HttpError(status, error, extra);
}

// Express 4 does not catch async errors
const route = (handler) => (req, res, next) => Promise.resolve().then(() => handler(req, res, next)).catch(next);

function errors(err, req, res, next) {
    if (res.headersSent) return next(err);
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
    if (err.name === "CastError" || err.name === "ValidationError" || err.type === "entity.parse.failed") {
        return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
}

// Message: `Invalid ${name}: ${value}`
function validId(value, name) {
    must(/^[0-9a-fA-F]{24}$/.test(value), 400, `Invalid ${name}: ${value}`);
    return value;
}

const isBlank = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

function required(body, fields, error = `${fields.join(", ")} required`) {
    must(fields.every((f) => !isBlank(body[f])), 400, error);
}

// Items of wanted that are not in have; ObjectId, string and populated docs all work
function missing(wanted, have) {
    const known = new Set(have.map((x) => String(x?._id ?? x)));
    return wanted.filter((x) => !known.has(String(x?._id ?? x)));
}

// app.post("/path", requireRole(User, "admin"), route(...))
const requireRole = (User, role) => route(async (req, res, next) => {
    const key = must(req.headers.access_key, 403, "No access key");
    req.user = must(await User.findOne({ access_key: key }), 403, "Invalid or unauthorized access key");
    must(req.user.role === role, 403, `${role.charAt(0).toUpperCase()}${role.slice(1)} access required`);
    next();
});

// Aggregation does not cast ids: { $match: { classId: oid(id) } }
const oid = (id) => new mongoose.Types.ObjectId(id);

// ...join("projects", "_id", "project") adds a single "project" object
const join = (from, localField, as, foreignField = "_id") => [
    { $lookup: { from, localField, foreignField, as } },
    { $unwind: `$${as}` },
];

const round = (x, digits = 1) => Number(x.toFixed(digits));

// ===== Models =====


// ===== Routes =====
app.get('/', async (req, res) => {
    try {
        res.send({ message: 'Welcome to Practical Exam!' });
    } catch (error) {
        res.send({ error: error.message });
    }
});


// Keep after all routes
app.use(errors);

const PORT = process.env.PORT || 9999;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
