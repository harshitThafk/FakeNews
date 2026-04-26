require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());

// Routes
app.use("/api/check", require("./routes/check"));
app.use("/api/history", require("./routes/history"));
app.use("/api/stats", require("./routes/stats"));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// MongoDB connection (optional — app works without it)
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/fakenews";
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.warn("⚠️  MongoDB unavailable (in-memory fallback active):", err.message));

app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
