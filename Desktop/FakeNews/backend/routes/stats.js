const express = require("express");
const router = express.Router();
const Check = require("../models/Check");

router.get("/", async (req, res) => {
  try {
    const total = await Check.countDocuments({ status: "completed" });
    const fake = await Check.countDocuments({ finalVerdict: { $in: ["FAKE", "LIKELY FAKE"] } });
    const real = await Check.countDocuments({ finalVerdict: { $in: ["REAL", "LIKELY REAL"] } });
    const uncertain = await Check.countDocuments({ finalVerdict: "UNCERTAIN" });
    const avgTime = await Check.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, avg: { $avg: "$processingTimeMs" } } },
    ]);
    res.json({ total, fake, real, uncertain, avgProcessingTimeMs: avgTime[0]?.avg || 0 });
  } catch (err) {
    const store = global.checkStore || {};
    const items = Object.values(store).filter((c) => c.status === "completed");
    res.json({
      total: items.length,
      fake: items.filter((c) => ["FAKE", "LIKELY FAKE"].includes(c.finalVerdict)).length,
      real: items.filter((c) => ["REAL", "LIKELY REAL"].includes(c.finalVerdict)).length,
      uncertain: items.filter((c) => c.finalVerdict === "UNCERTAIN").length,
      avgProcessingTimeMs: items.reduce((s, c) => s + (c.processingTimeMs || 0), 0) / (items.length || 1),
    });
  }
});

module.exports = router;
