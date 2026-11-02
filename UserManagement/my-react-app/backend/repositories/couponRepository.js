const {
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  ScanCommand
} = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { getDynamoDBClient } = require("../config/dynamodb");

class CouponRepository {
  constructor(client = null, tableName = null) {
    this.client = client || getDynamoDBClient();
    this.tableName =
      tableName ||
      process.env.DYNAMODB_COUPONS_TABLE ||
      "UserManagementAWS-Coupons";
  }

  /**
   * Format and validate coupon before saving
   */
  _formatCoupon(item) {
    if (!item) return null;
    return {
      code: item.code,
      description: item.description || "",
      discountType: item.discountType || "percentage",
      discountValue: Number(item.discountValue || 0),
      minOrderAmount: Number(item.minOrderAmount || 0),
      maxDiscountAmount: item.maxDiscountAmount !== undefined && item.maxDiscountAmount !== null ? Number(item.maxDiscountAmount) : null,
      startDate: item.startDate || new Date().toISOString(),
      expirationDate: item.expirationDate,
      maxTotalUsage: item.maxTotalUsage !== undefined && item.maxTotalUsage !== null ? Number(item.maxTotalUsage) : null,
      usageCount: Number(item.usageCount || 0),
      maxUsagePerCustomer: Number(item.maxUsagePerCustomer || 1),
      customerUsage: item.customerUsage || {}, // map: userId -> count
      isActive: item.isActive !== false,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString()
    };
  }

  /**
   * 1. Create a new coupon
   */
  async create(data) {
    if (!data.code || typeof data.code !== "string") {
      throw new Error("Coupon code is required");
    }
    const cleanCode = data.code.trim().toUpperCase();

    if (!data.discountValue || Number(data.discountValue) <= 0) {
      throw new Error("Valid discount value is required");
    }
    if (!data.expirationDate) {
      throw new Error("Expiration date is required");
    }

    const now = new Date().toISOString();
    const couponItem = {
      code: cleanCode,
      description: (data.description || "").trim(),
      discountType: data.discountType === "fixed" ? "fixed" : "percentage",
      discountValue: Number(data.discountValue),
      minOrderAmount: Number(data.minOrderAmount || 0),
      maxDiscountAmount: data.maxDiscountAmount ? Number(data.maxDiscountAmount) : null,
      startDate: data.startDate || now,
      expirationDate: new Date(data.expirationDate).toISOString(),
      maxTotalUsage: data.maxTotalUsage ? Number(data.maxTotalUsage) : null,
      usageCount: 0,
      maxUsagePerCustomer: Number(data.maxUsagePerCustomer || 1),
      customerUsage: {},
      isActive: data.isActive !== false,
      createdAt: now,
      updatedAt: now
    };

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(couponItem, { removeUndefinedValues: true }),
      ConditionExpression: "attribute_not_exists(#code)",
      ExpressionAttributeNames: { "#code": "code" }
    });

    try {
      await this.client.send(command);
      return couponItem;
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") {
        const error = new Error(`Coupon with code '${cleanCode}' already exists.`);
        error.status = 400;
        throw error;
      }
      throw err;
    }
  }

  /**
   * 2. Find coupon by code
   */
  async findByCode(code) {
    if (!code) return null;
    const cleanCode = code.trim().toUpperCase();

    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ code: cleanCode })
    });

    const res = await this.client.send(command);
    if (!res.Item) return null;
    return this._formatCoupon(unmarshall(res.Item));
  }

  /**
   * 3. List all coupons (Admin)
   */
  async listAll() {
    const command = new ScanCommand({
      TableName: this.tableName
    });

    const res = await this.client.send(command);
    if (!res.Items || res.Items.length === 0) return [];
    return res.Items.map((item) => this._formatCoupon(unmarshall(item)));
  }

  /**
   * 4. Update coupon
   */
  async update(code, updateData) {
    const cleanCode = code.trim().toUpperCase();
    const existing = await this.findByCode(cleanCode);
    if (!existing) {
      const err = new Error("Coupon not found");
      err.status = 404;
      throw err;
    }

    const updated = {
      ...existing,
      ...updateData,
      code: cleanCode,
      updatedAt: new Date().toISOString()
    };

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(updated, { removeUndefinedValues: true })
    });

    await this.client.send(command);
    return updated;
  }

  /**
   * 5. Delete coupon
   */
  async delete(code) {
    const cleanCode = code.trim().toUpperCase();
    const command = new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({ code: cleanCode }),
      ConditionExpression: "attribute_exists(#code)",
      ExpressionAttributeNames: { "#code": "code" }
    });

    try {
      await this.client.send(command);
      return true;
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") {
        return false;
      }
      throw err;
    }
  }

  /**
   * 6. Validate coupon against order subtotal and customer ID
   */
  async validateCoupon(code, subtotal, userId = null) {
    if (!code) {
      return { valid: false, message: "Coupon code is required" };
    }
    const coupon = await this.findByCode(code);
    if (!coupon) {
      return { valid: false, message: "Invalid coupon code" };
    }

    if (!coupon.isActive) {
      return { valid: false, message: "This coupon is no longer active" };
    }

    const now = new Date();
    if (new Date(coupon.startDate) > now) {
      return { valid: false, message: "This coupon promotion has not started yet" };
    }

    if (new Date(coupon.expirationDate) < now) {
      return { valid: false, message: "This coupon has expired" };
    }

    const numSubtotal = Number(subtotal || 0);
    if (numSubtotal < coupon.minOrderAmount) {
      return {
        valid: false,
        message: `Minimum order amount of ₹${coupon.minOrderAmount.toLocaleString("en-IN")} required to use this coupon`
      };
    }

    if (coupon.maxTotalUsage !== null && coupon.usageCount >= coupon.maxTotalUsage) {
      return { valid: false, message: "This coupon has reached its maximum total usage limit" };
    }

    if (userId && coupon.customerUsage) {
      const userUsage = Number(coupon.customerUsage[userId] || 0);
      if (userUsage >= coupon.maxUsagePerCustomer) {
        return { valid: false, message: "You have already used this coupon the maximum allowed times" };
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = Math.round((numSubtotal * coupon.discountValue) / 100);
      if (coupon.maxDiscountAmount !== null && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else {
      // Fixed discount
      discountAmount = Math.min(numSubtotal, coupon.discountValue);
    }

    return {
      valid: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscountAmount: coupon.maxDiscountAmount
      },
      discountAmount,
      message: `${coupon.discountType === "percentage" ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`} applied successfully!`
    };
  }

  /**
   * 7. Atomically record usage of coupon on order placement
   */
  async recordUsage(code, userId) {
    if (!code) return;
    const cleanCode = code.trim().toUpperCase();

    const command = new UpdateItemCommand({
      TableName: this.tableName,
      Key: marshall({ code: cleanCode }),
      UpdateExpression: "ADD #usageCount :one SET #updatedAt = :now, #customerUsage.#uid = if_not_exists(#customerUsage.#uid, :zero) + :one",
      ExpressionAttributeNames: {
        "#usageCount": "usageCount",
        "#updatedAt": "updatedAt",
        "#customerUsage": "customerUsage",
        "#uid": userId || "anonymous"
      },
      ExpressionAttributeValues: marshall({
        ":one": 1,
        ":zero": 0,
        ":now": new Date().toISOString()
      })
    });

    try {
      await this.client.send(command);
    } catch (err) {
      console.warn(`[CouponRepository] Warning: failed to record usage for ${cleanCode}:`, err.message);
    }
  }
}

module.exports = CouponRepository;

