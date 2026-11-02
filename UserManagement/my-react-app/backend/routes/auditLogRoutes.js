const express = require("express");
const router = express.Router();
const auditLogController = require("../controllers/auditLogController");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/roleMiddleware");

// Admin only: view system audit logs
router.get("/", verifyToken, requireAdmin, auditLogController.getAuditLogs);

module.exports = router;
