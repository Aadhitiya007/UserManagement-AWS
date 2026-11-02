const crypto = require("crypto");
const {
  PutCommand,
  ScanCommand,
  QueryCommand
} = require("@aws-sdk/lib-dynamodb");
const { docClient: defaultDocClient, TABLE_NAMES } = require("../config/dynamodb");

class AuditLogRepository {
  constructor(docClient = defaultDocClient, tableName = null) {
    this.docClient = docClient;
    this.tableName = tableName || process.env.DYNAMODB_AUDIT_LOGS_TABLE || "UserManagementAWS-AuditLogs";
  }

  _formatLog(item) {
    if (!item) return null;
    return {
      _id: item.logId,
      id: item.logId,
      logId: item.logId,
      timestamp: item.timestamp,
      category: item.category || "SYSTEM",
      action: item.action,
      status: item.status || "SUCCESS",
      actor: item.actor || { userId: "system", email: "system", role: "system", ip: "127.0.0.1" },
      target: item.target || {},
      details: item.details || {},
      expiresAt: item.expiresAt,
      createdAt: item.timestamp
    };
  }

  /**
   * 1. Record an audit log entry with 90-day TTL (7,776,000 seconds)
   */
  async createLog({ category, action, status = "SUCCESS", actor = {}, target = {}, details = {} }) {
    if (!action) {
      throw new Error("Action is required for audit logging");
    }

    const now = new Date();
    const logId = `log_${now.getTime()}_${crypto.randomUUID().slice(0, 8)}`;
    // TTL: 90 days from creation in Unix epoch seconds
    const expiresAt = Math.floor(now.getTime() / 1000) + (90 * 24 * 60 * 60);

    const logItem = {
      logId,
      timestamp: now.toISOString(),
      category: (category || "SYSTEM").toUpperCase(),
      action: action.toUpperCase(),
      status: (status || "SUCCESS").toUpperCase(),
      actor: {
        userId: actor.userId || actor.id || "anonymous",
        email: actor.email || "anonymous",
        role: actor.role || "visitor",
        ip: actor.ip || "unknown"
      },
      target: {
        type: target.type || "NONE",
        id: target.id || "",
        name: target.name || ""
      },
      details: typeof details === "object" ? details : { message: String(details) },
      expiresAt
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: logItem
        })
      );
      return this._formatLog(logItem);
    } catch (err) {
      // In development or if table is provisioning, log warning without throwing
      console.warn(`[AuditLog] Failed to persist log ${action}:`, err.message);
      return this._formatLog(logItem);
    }
  }

  /**
   * 2. List recent audit logs with category and status filtering
   */
  async listLogs({ category = null, status = null, limit = 50, lastEvaluatedKey = null } = {}) {
    try {
      const scanParams = {
        TableName: this.tableName,
        Limit: Math.min(Number(limit) || 50, 100)
      };

      const filterParts = [];
      const exprAttrNames = {};
      const exprAttrValues = {};

      if (category && category !== "ALL") {
        filterParts.push("#category = :cat");
        exprAttrNames["#category"] = "category";
        exprAttrValues[":cat"] = category.toUpperCase();
      }

      if (status && status !== "ALL") {
        filterParts.push("#status = :stat");
        exprAttrNames["#status"] = "status";
        exprAttrValues[":stat"] = status.toUpperCase();
      }

      if (filterParts.length > 0) {
        scanParams.FilterExpression = filterParts.join(" AND ");
        scanParams.ExpressionAttributeNames = exprAttrNames;
        scanParams.ExpressionAttributeValues = exprAttrValues;
      }

      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      const res = await this.docClient.send(new ScanCommand(scanParams));
      const logs = (res.Items || [])
        .map((item) => this._formatLog(item))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return {
        logs,
        lastEvaluatedKey: res.LastEvaluatedKey || null,
        count: logs.length
      };
    } catch (err) {
      console.warn("[AuditLog] Failed to scan audit logs:", err.message);
      return { logs: [], lastEvaluatedKey: null, count: 0 };
    }
  }
}

module.exports = AuditLogRepository;

