const express = require("express");
const router = express.Router();
const Check = require("../models/Check");

router.get("/", async (req, res) => {
  try {
    const docs = await Check.find({ status: "completed" }).sort({ createdAt: -1 }).limit(20);
    res.json(docs);
  } catch (err) {
    // Fallback to in-memory store
    const store = global.checkStore || {};
    const items = Object.values(store)
      .filter((c) => c.status === "completed")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);
    res.json(items);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await Check.deleteOne({ id: req.params.id });
    if (global.checkStore) delete global.checkStore[req.params.id];
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
