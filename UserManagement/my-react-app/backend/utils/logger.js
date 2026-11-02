const AuditLogRepository = require("../repositories/auditLogRepository");

let auditRepo = new AuditLogRepository();

function setAuditLogRepository(repo) {
  auditRepo = repo;
}

function getAuditLogRepository() {
  return auditRepo;
}

/**
 * Non-blocking, fire-and-forget centralized audit logger.
 * Never throws and never delays customer checkout or login operations.
 *
 * @param {Object} logData
 * @param {string} logData.category - AUTH | ORDER | PAYMENT | PRODUCT | COUPON | EMAIL
 * @param {string} logData.action - Action name (e.g. USER_LOGIN, ORDER_PLACED)
 * @param {string} [logData.status='SUCCESS'] - SUCCESS | WARNING | FAILURE
 * @param {Object} [logData.actor] - User performing the action
 * @param {Object} [logData.target] - Resource affected
 * @param {Object|string} [logData.details] - Arbitrary context
 */
function logAuditEvent({ category, action, status = "SUCCESS", actor = {}, target = {}, details = {} }) {
  // Execute asynchronously off the critical path
  setImmediate(async () => {
    try {
      await auditRepo.createLog({
        category,
        action,
        status,
        actor,
        target,
        details
      });
    } catch (err) {
      console.warn(`[AuditLogger] Non-blocking log failed for ${action}:`, err.message);
    }
  });
}

module.exports = {
  logAuditEvent,
  setAuditLogRepository,
  getAuditLogRepository
};

