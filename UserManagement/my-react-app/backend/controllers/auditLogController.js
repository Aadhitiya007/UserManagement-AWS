const AuditLogRepository = require("../repositories/auditLogRepository");

let activeAuditRepo = new AuditLogRepository();

exports.setAuditLogRepository = (repo) => {
  activeAuditRepo = repo;
};

/**
 * GET /api/audit-logs
 * List audit logs with category, status, and pagination
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const { category, status, limit, lastKey } = req.query;
    let parsedKey = null;
    if (lastKey) {
      try {
        parsedKey = JSON.parse(decodeURIComponent(lastKey));
      } catch {
        parsedKey = null;
      }
    }

    const result = await activeAuditRepo.listLogs({
      category: category || null,
      status: status || null,
      limit: limit ? Number(limit) : 50,
      lastEvaluatedKey: parsedKey
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Failed to retrieve audit logs."
    });
  }
};

