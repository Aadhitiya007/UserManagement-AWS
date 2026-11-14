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
      isEmailVerified: item.isEmailVerified === true,
      addresses: Array.isArray(item.addresses) ? item.addresses : [],
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
      isEmailVerified: false,
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

  /**
   * Create a secure password reset token (15-min expiration) in DynamoDB
   */
  async createPasswordResetToken(email, hashedToken, expiresAt) {
    const user = await this.findByEmail(email);
    if (!user) return null;

    const resetItem = {
      userId: `RESET#${hashedToken}`,
      itemType: "PASSWORD_RESET_TOKEN",
      targetUserId: user.id,
      email: user.email,
      expiresAt: Number(expiresAt),
      createdAt: new Date().toISOString()
    };

    const updateProfile = {
      Update: {
        TableName: this.tableName,
        Key: { userId: user.id },
        UpdateExpression: "SET resetPasswordToken = :token, resetPasswordExpire = :exp, updatedAt = :now",
        ExpressionAttributeValues: {
          ":token": hashedToken,
          ":exp": Number(expiresAt),
          ":now": new Date().toISOString()
        }
      }
    };

    const putToken = {
      Put: {
        TableName: this.tableName,
        Item: resetItem
      }
    };

    await this.docClient.send(
      new TransactWriteCommand({
        TransactItems: [updateProfile, putToken]
      })
    );

    return { user, expiresAt };
  }

  /**
   * Atomically consume reset token and update password in DynamoDB
   */
  async consumePasswordResetToken(hashedToken, newPasswordHash) {
    const tokenResult = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { userId: `RESET#${hashedToken}` }
      })
    );

    const tokenItem = tokenResult.Item;
    if (!tokenItem || tokenItem.itemType !== "PASSWORD_RESET_TOKEN") {
      const err = new Error("Invalid or expired password reset token.");
      err.status = 400;
      throw err;
    }

    if (Date.now() > Number(tokenItem.expiresAt)) {
      try {
        await this.docClient.send(
          new DeleteCommand({
            TableName: this.tableName,
            Key: { userId: `RESET#${hashedToken}` }
          })
        );
      } catch (_) {}
      const err = new Error("Password reset token has expired.");
      err.status = 400;
      throw err;
    }

    const deleteToken = {
      Delete: {
        TableName: this.tableName,
        Key: { userId: `RESET#${hashedToken}` }
      }
    };

    const updateProfile = {
      Update: {
        TableName: this.tableName,
        Key: { userId: tokenItem.targetUserId },
        UpdateExpression: "SET password = :pwd, resetPasswordToken = :null, resetPasswordExpire = :null, updatedAt = :now ADD tokenVersion :one",
        ExpressionAttributeValues: {
          ":pwd": newPasswordHash,
          ":null": null,
          ":now": new Date().toISOString(),
          ":one": 1
        }
      }
    };

    await this.docClient.send(
      new TransactWriteCommand({
        TransactItems: [deleteToken, updateProfile]
      })
    );

    return { success: true, userId: tokenItem.targetUserId };
  }


  /**
   * Create an email verification token (24-hour expiration) in DynamoDB
   */
  async createEmailVerificationToken(email, hashedToken, expiresAt) {
    const user = await this.findByEmail(email);
    if (!user) return null;

    const verifyItem = {
      userId: `VERIFY#${hashedToken}`,
      itemType: "EMAIL_VERIFICATION_TOKEN",
      targetUserId: user.id,
      email: user.email,
      expiresAt: Number(expiresAt),
      createdAt: new Date().toISOString()
    };

    const updateProfile = {
      Update: {
        TableName: this.tableName,
        Key: { userId: user.id },
        UpdateExpression: "SET emailVerificationToken = :token, emailVerificationExpire = :exp, updatedAt = :now",
        ExpressionAttributeValues: {
          ":token": hashedToken,
          ":exp": Number(expiresAt),
          ":now": new Date().toISOString()
        }
      }
    };

    const putToken = {
      Put: {
        TableName: this.tableName,
        Item: verifyItem
      }
    };

    await this.docClient.send(
      new TransactWriteCommand({
        TransactItems: [updateProfile, putToken]
      })
    );

    return { user, expiresAt };
  }

  /**
   * Atomically consume verification token and mark user as verified in DynamoDB
   */
  async consumeEmailVerificationToken(hashedToken) {
    const tokenResult = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { userId: `VERIFY#${hashedToken}` }
      })
    );

    const tokenItem = tokenResult.Item;
    if (!tokenItem || tokenItem.itemType !== "EMAIL_VERIFICATION_TOKEN") {
      const err = new Error("Invalid or expired verification token.");
      err.status = 400;
      throw err;
    }

    if (Date.now() > Number(tokenItem.expiresAt)) {
      try {
        await this.docClient.send(
          new DeleteCommand({
            TableName: this.tableName,
            Key: { userId: `VERIFY#${hashedToken}` }
          })
        );
      } catch (_) {}
      const err = new Error("Verification token has expired. Please request a new one.");
      err.status = 400;
      throw err;
    }

    const deleteToken = {
      Delete: {
        TableName: this.tableName,
        Key: { userId: `VERIFY#${hashedToken}` }
      }
    };

    const updateProfile = {
      Update: {
        TableName: this.tableName,
        Key: { userId: tokenItem.targetUserId },
        UpdateExpression: "SET isEmailVerified = :verified, emailVerificationToken = :null, emailVerificationExpire = :null, updatedAt = :now",
        ExpressionAttributeValues: {
          ":verified": true,
          ":null": null,
          ":now": new Date().toISOString()
        }
      }
    };

    await this.docClient.send(
      new TransactWriteCommand({
        TransactItems: [deleteToken, updateProfile]
      })
    );

    return { success: true, userId: tokenItem.targetUserId, email: tokenItem.email };
  }

  /**
   * Set new password directly (e.g. for temporary password generation)
   */
  async updateUserPassword(userId, newPasswordHash) {
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression: "SET password = :pwd, updatedAt = :now ADD tokenVersion :one",
        ExpressionAttributeValues: {
          ":pwd": newPasswordHash,
          ":now": new Date().toISOString(),
          ":one": 1
        }
      })
    );
    return { success: true };
  }

  /**
   * Address Book Management
   */
  async getAddresses(userId) {
    const user = await this.findById(userId);
    if (!user) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }
    return user.addresses || [];
  }

  async addAddress(userId, addressData) {
    const user = await this.findById(userId);
    if (!user) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }

    const { fullName, phone, street, city, state, pinCode, type = "Home", isDefault = false } = addressData;
    if (!fullName || !phone || !street || !city || !state || !pinCode) {
      const err = new Error("Full name, phone, street, city, state, and pin code are required.");
      err.statusCode = 400;
      throw err;
    }

    const currentAddresses = user.addresses || [];
    const isFirst = currentAddresses.length === 0;
    const makeDefault = isDefault || isFirst;

    const newAddress = {
      addressId: `addr_${crypto.randomUUID()}`,
      fullName: String(fullName).trim(),
      phone: String(phone).trim(),
      street: String(street).trim(),
      city: String(city).trim(),
      state: String(state).trim(),
      pinCode: String(pinCode).trim(),
      type: ["Home", "Work", "Other"].includes(type) ? type : "Home",
      isDefault: makeDefault,
      location: addressData.location && typeof addressData.location === "object" ? {
        lat: Number(addressData.location.lat),
        lng: Number(addressData.location.lng)
      } : null,
      createdAt: new Date().toISOString()
    };

    const updatedList = currentAddresses.map((a) => (makeDefault ? { ...a, isDefault: false } : a));
    updatedList.push(newAddress);

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression: "SET addresses = :addrList, updatedAt = :now",
        ExpressionAttributeValues: {
          ":addrList": updatedList,
          ":now": new Date().toISOString()
        }
      })
    );

    return newAddress;
  }

  async updateAddress(userId, addressId, updateData) {
    const user = await this.findById(userId);
    if (!user) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }

    const currentAddresses = user.addresses || [];
    const targetIdx = currentAddresses.findIndex((a) => a.addressId === addressId);
    if (targetIdx === -1) {
      const err = new Error("Address not found");
      err.statusCode = 404;
      throw err;
    }

    const makeDefault = updateData.isDefault === true;

    const updatedList = currentAddresses.map((a, idx) => {
      if (idx === targetIdx) {
        return {
          ...a,
          fullName: updateData.fullName !== undefined ? String(updateData.fullName).trim() : a.fullName,
          phone: updateData.phone !== undefined ? String(updateData.phone).trim() : a.phone,
          street: updateData.street !== undefined ? String(updateData.street).trim() : a.street,
          city: updateData.city !== undefined ? String(updateData.city).trim() : a.city,
          state: updateData.state !== undefined ? String(updateData.state).trim() : a.state,
          pinCode: updateData.pinCode !== undefined ? String(updateData.pinCode).trim() : a.pinCode,
          type: updateData.type !== undefined ? updateData.type : a.type,
          location: updateData.location !== undefined ? updateData.location : (a.location || null),
          isDefault: makeDefault ? true : (updateData.isDefault === false ? false : a.isDefault),
          updatedAt: new Date().toISOString()
        };
      }
      return makeDefault ? { ...a, isDefault: false } : a;
    });

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression: "SET addresses = :addrList, updatedAt = :now",
        ExpressionAttributeValues: {
          ":addrList": updatedList,
          ":now": new Date().toISOString()
        }
      })
    );

    return updatedList.find((a) => a.addressId === addressId);
  }

  async deleteAddress(userId, addressId) {
    const user = await this.findById(userId);
    if (!user) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }

    const currentAddresses = user.addresses || [];
    const filtered = currentAddresses.filter((a) => a.addressId !== addressId);
    if (filtered.length === currentAddresses.length) {
      const err = new Error("Address not found");
      err.statusCode = 404;
      throw err;
    }

    if (filtered.length > 0 && !filtered.some((a) => a.isDefault)) {
      filtered[0].isDefault = true;
    }

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression: "SET addresses = :addrList, updatedAt = :now",
        ExpressionAttributeValues: {
          ":addrList": filtered,
          ":now": new Date().toISOString()
        }
      })
    );

    return { success: true, remaining: filtered.length };
  }

}

module.exports = UserRepository;
