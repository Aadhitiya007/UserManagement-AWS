const { PutCommand, DeleteCommand, ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLE_NAMES } = require("../config/dynamodb");

class WebSocketRepository {
  constructor(client = docClient, tableNames = TABLE_NAMES) {
    this.docClient = client;
    this.tableName = tableNames.WS_CONNECTIONS || "UserManagementAWS-WebSocketConnections";
  }

  async saveConnection(connectionId, { userId = "guest", role = "visitor", clientIp = "" } = {}) {
    const now = new Date().toISOString();
    // 24 hour TTL to automatically purge abandoned connections
    const ttl = Math.floor(Date.now() / 1000) + 24 * 3600;

    const item = {
      connectionId,
      userId: String(userId),
      role: String(role),
      clientIp,
      connectedAt: now,
      ttl
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item
        })
      );
      console.log(`[WebSocketRepo] ✓ Saved connection ${connectionId} for user ${userId} (${role}) to table ${this.tableName}`);
      return item;
    } catch (err) {
      console.error(`[WebSocketRepo] ✗ FAILED to save connection ${connectionId} to table ${this.tableName}:`, err.message);
      return null;
    }
  }

  async deleteConnection(connectionId) {
    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { connectionId }
        })
      );
      return true;
    } catch (err) {
      console.warn(`[WebSocketRepo] Failed to delete connection ${connectionId}:`, err.message);
      return false;
    }
  }

  async getAdminConnections() {
    try {
      // 1. Try querying GSI if configured
      const queryResult = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "role-index",
          KeyConditionExpression: "#r = :adminRole",
          ExpressionAttributeNames: { "#r": "role" },
          ExpressionAttributeValues: { ":adminRole": "admin" },
          ProjectionExpression: "connectionId"
        })
      );
      return (queryResult.Items || []).map((item) => item.connectionId);
    } catch {
      // 2. Fallback to bounded scan
      try {
        const scanResult = await this.docClient.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression: "#r = :adminRole OR #r = :managerRole",
            ExpressionAttributeNames: { "#r": "role" },
            ExpressionAttributeValues: { ":adminRole": "admin", ":managerRole": "manager" },
            ProjectionExpression: "connectionId",
            Limit: 100
          })
        );
        return (scanResult.Items || []).map((item) => item.connectionId);
      } catch (scanErr) {
        console.warn("[WebSocketRepo] Fallback scan failed:", scanErr.message);
        return [];
      }
    }
  }

  async getUserConnections(userId) {
    if (!userId) return [];
    try {
      const scanResult = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: "userId = :uid",
          ExpressionAttributeValues: { ":uid": String(userId) },
          ProjectionExpression: "connectionId",
          Limit: 50
        })
      );
      return (scanResult.Items || []).map((item) => item.connectionId);
    } catch (err) {
      console.warn(`[WebSocketRepo] Failed to get connections for user ${userId}:`, err.message);
      return [];
    }
  }
}

module.exports = WebSocketRepository;

