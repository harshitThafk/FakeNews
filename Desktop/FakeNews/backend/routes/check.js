const express = require("express");
const router = express.Router();
const { submitCheck, getCheckResult } = require("../controllers/checkController");

router.post("/", submitCheck);
router.get("/:id", getCheckResult);

module.exports = router;
