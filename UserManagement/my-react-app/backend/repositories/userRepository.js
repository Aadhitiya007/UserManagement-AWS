const crypto = require("crypto");
const {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  TransactWriteCommand
} = require("@aws-sdk/lib-dynamodb");
const { docClient: defaultDocClient, TABLE_NAMES } = require("../config/dynamodb");

class UserRepository {
  constructor(docClient = defaultDocClient, tableName = TABLE_NAMES.USERS) {
    this.docClient = docClient;
    this.tableName = tableName;
  }

  _formatUser(item) {
    if (!item || item.itemType === "EMAIL_RESERVATION") return null;
    return {
      _id: item.userId,
      id: item.userId,
      name: item.name,
      email: item.email,
      password: item.password,
      role: item.role || "user",
      age: item.age,
      country: item.country,
      phone: item.phone,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  async findByEmail(email) {
    if (!email || typeof email !== "string") return null;
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Strongly consistent lookup on the unique email reservation pointer
    const reservationResult = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { userId: `EMAIL#${normalizedEmail}` }
      })
    );

    if (!reservationResult.Item || !reservationResult.Item.targetUserId) {
      return null;
    }

    // 2. Strongly consistent lookup on the actual user profile
    const profileResult = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { userId: reservationResult.Item.targetUserId }
      })
    );

    return this._formatUser(profileResult.Item);
  }

  async findById(userId) {
    if (!userId || typeof userId !== "string") return null;
    if (userId.startsWith("EMAIL#")) return null; // Never return reservation item as user

    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { userId }
      })
    );

    return this._formatUser(result.Item);
  }

  async create(userData) {
    const { name, email, password, role, age, country, phone } = userData;
    if (!name || !email || !password) {
      throw new Error("Name, email, and password are required");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userId = `u_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const reservationItem = {
      userId: `EMAIL#${normalizedEmail}`,
      itemType: "EMAIL_RESERVATION",
      targetUserId: userId,
      createdAt: now
    };

    const profileItem = {
      userId,
      itemType: "USER_PROFILE",
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: role === "admin" ? "admin" : "user",
      age: age !== undefined && age !== null ? Number(age) : null,
      country: country || "",
      phone: phone || "",
      createdAt: now,
      updatedAt: now
    };

    try {
      await this.docClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: reservationItem,
                ConditionExpression: "attribute_not_exists(userId)"
              }
            },
            {
              Put: {
                TableName: this.tableName,
                Item: profileItem,
                ConditionExpression: "attribute_not_exists(userId)"
              }
            }
          ]
        })
      );

      return this._formatUser(profileItem);
    } catch (err) {
      if (err.name === "TransactionCanceledException") {
        const reasons = err.CancellationReasons || [];
        const emailConflict = reasons[0] && reasons[0].Code === "ConditionalCheckFailed";
        if (emailConflict || err.message.includes("ConditionalCheckFailed")) {
          const conflictError = new Error("Email is already registered");
          conflictError.statusCode = 400;
          throw conflictError;
        }
      }
      throw err;
    }
  }

  async update(userId, updateFields) {
    const existing = await this.findById(userId);
    if (!existing) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }

    const now = new Date().toISOString();
    const newEmail = updateFields.email ? updateFields.email.trim().toLowerCase() : null;
    const isEmailChanging = newEmail && newEmail !== existing.email;

    if (isEmailChanging) {
      // Atomic email migration: Put new reservation, Delete old reservation, Update profile
      try {
        await this.docClient.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: this.tableName,
                  Item: {
                    userId: `EMAIL#${newEmail}`,
                    itemType: "EMAIL_RESERVATION",
                    targetUserId: userId,
                    createdAt: now
                  },
                  ConditionExpression: "attribute_not_exists(userId)"
                }
              },
              {
                Delete: {
                  TableName: this.tableName,
                  Key: { userId: `EMAIL#${existing.email}` },
                  ConditionExpression: "attribute_exists(userId) AND targetUserId = :uid",
                  ExpressionAttributeValues: {
                    ":uid": userId
                  }
                }
              },
              {
                Update: {
                  TableName: this.tableName,
                  Key: { userId },
                  UpdateExpression: "SET email = :email, #n = :name, #r = :role, age = :age, country = :country, phone = :phone, updatedAt = :now",
                  ConditionExpression: "attribute_exists(userId) AND email = :oldEmail",
                  ExpressionAttributeNames: {
                    "#n": "name",
                    "#r": "role"
                  },
                  ExpressionAttributeValues: {
                    ":email": newEmail,
                    ":oldEmail": existing.email,
                    ":name": updateFields.name !== undefined ? updateFields.name.trim() : existing.name,
                    ":role": updateFields.role || existing.role,
                    ":age": updateFields.age !== undefined ? (updateFields.age !== null ? Number(updateFields.age) : null) : existing.age,
                    ":country": updateFields.country !== undefined ? updateFields.country : existing.country,
                    ":phone": updateFields.phone !== undefined ? updateFields.phone : existing.phone,
                    ":now": now
                  }
                }
              }
            ]
          })
        );
      } catch (err) {
        if (err.name === "TransactionCanceledException") {
          const reasons = err.CancellationReasons || [];
          if (reasons[0] && reasons[0].Code === "ConditionalCheckFailed") {
            const conflictError = new Error("Email is already registered");
            conflictError.statusCode = 400;
            throw conflictError;
          }
          if (
            (reasons[1] && reasons[1].Code === "ConditionalCheckFailed") ||
            (reasons[2] && reasons[2].Code === "ConditionalCheckFailed")
          ) {
            const staleError = new Error("User email update conflict. Please refresh and retry.");
            staleError.statusCode = 409;
            throw staleError;
          }
          const defaultConflict = new Error("User email update conflict. Please refresh and retry.");
          defaultConflict.statusCode = 409;
          throw defaultConflict;
        }
        throw err;
      }
    } else {
      try {
        await this.docClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { userId },
            UpdateExpression: "SET #n = :name, #r = :role, age = :age, country = :country, phone = :phone, updatedAt = :now",
            ConditionExpression: "attribute_exists(userId)",
            ExpressionAttributeNames: {
              "#n": "name",
              "#r": "role"
            },
            ExpressionAttributeValues: {
              ":name": updateFields.name !== undefined ? updateFields.name.trim() : existing.name,
              ":role": updateFields.role || existing.role,
              ":age": updateFields.age !== undefined ? (updateFields.age !== null ? Number(updateFields.age) : null) : existing.age,
              ":country": updateFields.country !== undefined ? updateFields.country : existing.country,
              ":phone": updateFields.phone !== undefined ? updateFields.phone : existing.phone,
              ":now": now
            }
          })
        );
      } catch (err) {
        if (err.name === "ConditionalCheckFailedException") {
          const notFoundErr = new Error("User not found");
          notFoundErr.statusCode = 404;
          throw notFoundErr;
        }
        throw err;
      }
    }

    return this.findById(userId);
  }

  async delete(userId) {
    const existing = await this.findById(userId);
    if (!existing) {
      return false;
    }

    try {
      await this.docClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: this.tableName,
                Key: { userId },
                ConditionExpression: "attribute_exists(userId)"
              }
            },
            {
              Delete: {
                TableName: this.tableName,
                Key: { userId: `EMAIL#${existing.email}` },
                ConditionExpression: "attribute_exists(userId) AND targetUserId = :uid",
                ExpressionAttributeValues: {
                  ":uid": userId
                }
              }
            }
          ]
        })
      );
      return true;
    } catch (err) {
      if (err.name === "TransactionCanceledException") {
        return false;
      }
      throw err;
    }
  }

  async listUsers(options = {}) {
    const { limit = 50, nextToken, search } = options;

    const params = {
      TableName: this.tableName,
      FilterExpression: "itemType = :profile",
      ExpressionAttributeValues: {
        ":profile": "USER_PROFILE"
      },
      Limit: limit
    };

    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, "base64").toString("utf-8"));
    }

    const result = await this.docClient.send(new ScanCommand(params));
    let users = (result.Items || []).map((item) => {
      const formatted = this._formatUser(item);
      if (formatted) delete formatted.password;
      return formatted;
    }).filter(Boolean);

    if (search) {
      const term = search.toLowerCase();
      users = users.filter((u) =>
        (u.name && u.name.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term)) ||
        (u.role && u.role.toLowerCase().includes(term)) ||
        (u.country && u.country.toLowerCase().includes(term)) ||
        (u.phone && u.phone.includes(term))
      );
    }

    const response = { users };
    if (result.LastEvaluatedKey) {
      response.nextToken = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64");
    }

    return response;
  }

  async count() {
    const result = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "itemType = :profile",
        ExpressionAttributeValues: { ":profile": "USER_PROFILE" },
        Select: "COUNT"
      })
    );
    return result.Count || 0;
  }
}

module.exports = UserRepository;
