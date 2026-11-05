const crypto = require("crypto");
const {
  PutCommand,
  ScanCommand,
  QueryCommand
} = require("@aws-sdk/lib-dynamodb");
const { docClient: defaultDocClient, TABLE_NAMES } = require("../config/dynamodb");

// Global memory buffer for live audit logs across cold starts in Lambda instance
if (!global._auditMemoryBuffer) {
  global._auditMemoryBuffer = [];
}

class AuditLogRepository {
  constructor(docClient = defaultDocClient, tableName = null) {
    this.docClient = docClient;
    this.tableName = tableName || process.env.DYNAMODB_AUDIT_LOGS_TABLE || "UserManagementAWS-AuditLogs";
    this.memoryLogs = global._auditMemoryBuffer;
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

    // Store in-memory buffer so logs are always queryable
    this.memoryLogs.unshift(logItem);
    if (this.memoryLogs.length > 200) {
      this.memoryLogs.pop();
    }

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: logItem
        })
      );
      return this._formatLog(logItem);
    } catch (err) {
      console.warn(`[AuditLog] DynamoDB table not found, persisted to in-memory audit store:`, err.message);
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

      // Combine with memory logs if DynamoDB has fewer
      if (logs.length > 0) {
        return {
          logs,
          lastEvaluatedKey: res.LastEvaluatedKey || null,
          count: logs.length
        };
      }
    } catch (err) {
      console.warn("[AuditLog] Serving audit logs from fallback memory buffer:", err.message);
    }

    // Fallback: serve from memory buffer
    let filtered = [...this.memoryLogs];
    if (category && category !== "ALL") {
      filtered = filtered.filter(l => l.category === category.toUpperCase());
    }
    if (status && status !== "ALL") {
      filtered = filtered.filter(l => l.status === status.toUpperCase());
    }

    const formatted = filtered.slice(0, Number(limit) || 50).map(item => this._formatLog(item));
    return {
      logs: formatted,
      lastEvaluatedKey: null,
      count: formatted.length
    };
  }
}

module.exports = AuditLogRepository;
