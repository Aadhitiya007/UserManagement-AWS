const crypto = require("crypto");
const {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
  TransactWriteCommand
} = require("@aws-sdk/lib-dynamodb");
const { docClient: defaultDocClient, TABLE_NAMES } = require("../config/dynamodb");

const ALLOWED_TRANSITIONS = {
  Pending: ["Processing", "Cancelled"],
  Processing: ["Shipped", "Cancelled"],
  Shipped: ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: []
};

class OrderRepository {
  constructor(docClient = defaultDocClient, tableNames = TABLE_NAMES) {
    this.docClient = docClient;
    this.tableNames = tableNames;
  }

  _formatOrder(item) {
    if (!item) return null;
    return {
      _id: item.orderId,
      id: item.orderId,
      orderId: item.orderId,
      userId: item.userId,
      userName: item.userName || "Customer",
      userEmail: item.userEmail || "",
      products: Array.isArray(item.products) ? item.products : [],
      purchasedProductIds: Array.isArray(item.purchasedProductIds) ? item.purchasedProductIds : [],
      totalAmount: Number(item.totalAmount || 0),
      status: item.status || "Pending",
      paymentStatus: item.paymentStatus || "Pending",
      paymentMethod: item.paymentMethod || "Card",
      paymentDetails: item.paymentDetails || {},
      paymentAttempts: Array.isArray(item.paymentAttempts) ? item.paymentAttempts : [],
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  async findById(orderId) {
    if (!orderId || typeof orderId !== "string") return null;

    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableNames.ORDERS,
        Key: { orderId }
      })
    );

    return this._formatOrder(result.Item);
  }

  async createOrderWithStockDeduction({ userId, userName, userEmail, rawProducts, productRepo }) {
    if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
      throw new Error("Cart is empty. Products array is required.");
    }

    // 1. Consolidate duplicate products to prevent DynamoDB Transaction ValidationException
    const consolidatedMap = new Map();
    for (const item of rawProducts) {
      if (!item.productId) {
        throw new Error("Invalid product ID in order items.");
      }

      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new Error("Product quantity must be a positive integer.");
      }

      const id = String(item.productId);
      if (consolidatedMap.has(id)) {
        consolidatedMap.get(id).quantity += qty;
      } else {
        consolidatedMap.set(id, {
          productId: id,
          quantity: qty,
          image: item.image || ""
        });
      }
    }

    const consolidatedItems = Array.from(consolidatedMap.values());
    const productIds = consolidatedItems.map((item) => item.productId);

    // 2. Fetch authoritative prices from Products repository
    const productRecords = await productRepo.findByIds(productIds);
    if (productRecords.length !== productIds.length) {
      const foundIds = new Set(productRecords.map((p) => p.productId));
      const missing = productIds.find((id) => !foundIds.has(id));
      const err = new Error(`Product with ID ${missing} not found.`);
      err.statusCode = 404;
      throw err;
    }

    let calculatedTotal = 0;
    const validatedProducts = [];
    for (const record of productRecords) {
      const item = consolidatedMap.get(record.productId);
      calculatedTotal += record.price * item.quantity;
      validatedProducts.push({
        productId: record.productId,
        name: record.name,
        price: record.price,
        quantity: item.quantity,
        image: item.image || record.image || ""
      });
    }

    const orderId = `ord_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const orderItem = {
      orderId,
      userId,
      userName: userName || "Customer",
      userEmail: userEmail || "",
      products: validatedProducts,
      purchasedProductIds: productIds,
      totalAmount: calculatedTotal,
      status: "Pending",
      paymentStatus: "Pending",
      paymentMethod: "Card",
      paymentDetails: {},
      paymentAttempts: [],
      createdAt: now,
      updatedAt: now
    };

    // 3. Build atomic TransactWriteItems
    const transactItems = [
      ...consolidatedItems.map((item) => ({
        Update: {
          TableName: this.tableNames.PRODUCTS,
          Key: { productId: item.productId },
          UpdateExpression: "SET stock = stock - :qty, updatedAt = :now",
          ConditionExpression: "attribute_exists(productId) AND stock >= :qty",
          ExpressionAttributeValues: {
            ":qty": item.quantity,
            ":now": now
          }
        }
      })),
      {
        Put: {
          TableName: this.tableNames.ORDERS,
          Item: orderItem,
          ConditionExpression: "attribute_not_exists(orderId)"
        }
      }
    ];

    try {
      await this.docClient.send(
        new TransactWriteCommand({
          TransactItems: transactItems
        })
      );

      return this._formatOrder(orderItem);
    } catch (err) {
      if (err.name === "TransactionCanceledException") {
        const reasons = err.CancellationReasons || [];

        // Check if any product stock condition failed
        for (let i = 0; i < consolidatedItems.length; i++) {
          if (reasons[i] && reasons[i].Code === "ConditionalCheckFailed") {
            const failedProduct = productRecords.find((p) => p.productId === consolidatedItems[i].productId);
            const stockErr = new Error(
              `Insufficient stock for "${failedProduct ? failedProduct.name : consolidatedItems[i].productId}".`
            );
            stockErr.statusCode = 400;
            throw stockErr;
          }
        }

        // Check if the order Put failed
        const orderReason = reasons[consolidatedItems.length];
        if (orderReason && orderReason.Code === "ConditionalCheckFailed") {
          const dupErr = new Error("Duplicate order ID detected. Please try again.");
          dupErr.statusCode = 409;
          throw dupErr;
        }

        // Generic transaction failure (e.g. concurrent conflict)
        const transErr = new Error("Order transaction could not be completed due to concurrent update. Please retry.");
        transErr.statusCode = 409;
        throw transErr;
      }
      throw err;
    }
  }

  async findByUserId(userId, options = {}) {
    const { limit = 50, nextCursor } = options;

    try {
      // 1. Try querying GSI userId-createdAt-index if provisioned
      const queryParams = {
        TableName: this.tableNames.ORDERS,
        IndexName: "userId-createdAt-index",
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": userId },
        ScanIndexForward: false,
        Limit: limit
      };

      if (nextCursor) {
        queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(nextCursor, "base64").toString("utf-8"));
      }

      const result = await this.docClient.send(new QueryCommand(queryParams));
      const orders = (result.Items || []).map((item) => this._formatOrder(item));
      const response = { orders };

      if (result.LastEvaluatedKey) {
        response.nextCursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64");
      }
      return response;
    } catch (err) {
      // 2. Fallback to Scan with FilterExpression if GSI does not yet exist
      if (err.name === "ValidationException" || err.message.includes("Index") || err.message.includes("ResourceNotFoundException")) {
        const scanParams = {
          TableName: this.tableNames.ORDERS,
          FilterExpression: "userId = :uid",
          ExpressionAttributeValues: { ":uid": userId },
          Limit: limit
        };
        const result = await this.docClient.send(new ScanCommand(scanParams));
        const orders = (result.Items || []).map((item) => this._formatOrder(item));
        orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return { orders };
      }
      throw err;
    }
  }

  async listAllOrders(options = {}) {
    const { limit = 50, nextCursor, status } = options;

    const params = {
      TableName: this.tableNames.ORDERS,
      Limit: limit
    };

    if (nextCursor) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextCursor, "base64").toString("utf-8"));
    }

    if (status) {
      params.FilterExpression = "#s = :st";
      params.ExpressionAttributeNames = { "#s": "status" };
      params.ExpressionAttributeValues = { ":st": status };
    }

    const result = await this.docClient.send(new ScanCommand(params));
    const orders = (result.Items || []).map((item) => this._formatOrder(item));
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const response = { orders };
    if (result.LastEvaluatedKey) {
      response.nextCursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64");
    }

    return response;
  }

  async updateStatusWithStockRestoration(orderId, newStatus) {
    const order = await this.findById(orderId);
    if (!order) {
      const err = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    if (order.status === newStatus) {
      if (newStatus === "Cancelled") {
        const err = new Error("Order is already cancelled.");
        err.statusCode = 400;
        throw err;
      }
      return order;
    }

    const allowedNext = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowedNext.includes(newStatus)) {
      const err = new Error(`Invalid status transition from "${order.status}" to "${newStatus}".`);
      err.statusCode = 400;
      throw err;
    }

    if (newStatus !== "Cancelled" && order.paymentStatus !== "Paid") {
      const err = new Error("Cannot advance status because payment is still Pending. Customer must complete payment first.");
      err.statusCode = 400;
      throw err;
    }

    const now = new Date().toISOString();

    if (newStatus === "Cancelled") {
      // Atomic cancellation and stock restoration in a single transaction
      const transactItems = [
        {
          Update: {
            TableName: this.tableNames.ORDERS,
            Key: { orderId },
            UpdateExpression: "SET #status = :cancelled, updatedAt = :now",
            ConditionExpression: "attribute_exists(orderId) AND #status IN (:pending, :processing, :shipped)",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: {
              ":cancelled": "Cancelled",
              ":pending": "Pending",
              ":processing": "Processing",
              ":shipped": "Shipped",
              ":now": now
            }
          }
        },
        ...order.products.map((item) => ({
          Update: {
            TableName: this.tableNames.PRODUCTS,
            Key: { productId: item.productId },
            UpdateExpression: "SET stock = stock + :qty, updatedAt = :now",
            ExpressionAttributeValues: {
              ":qty": Number(item.quantity),
              ":now": now
            }
          }
        }))
      ];

      try {
        await this.docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
        return this.findById(orderId);
      } catch (err) {
        if (err.name === "TransactionCanceledException") {
          const cancelErr = new Error("Order cannot be cancelled in its current state (already cancelled or delivered).");
          cancelErr.statusCode = 400;
          throw cancelErr;
        }
        throw err;
      }
    } else {
      try {
        await this.docClient.send(
          new UpdateCommand({
            TableName: this.tableNames.ORDERS,
            Key: { orderId },
            UpdateExpression: "SET #s = :newStatus, updatedAt = :now",
            ConditionExpression: "attribute_exists(orderId) AND paymentStatus = :paid AND #s = :currentStatus",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: {
              ":newStatus": newStatus,
              ":currentStatus": order.status,
              ":paid": "Paid",
              ":now": now
            }
          })
        );

        return this.findById(orderId);
      } catch (err) {
        if (err.name === "ConditionalCheckFailedException") {
          const latest = await this.findById(orderId);
          if (!latest) {
            const notFoundErr = new Error("Order not found");
            notFoundErr.statusCode = 404;
            throw notFoundErr;
          }
          if (latest.status !== order.status) {
            const conflictErr = new Error(
              `Order status was concurrently updated to "${latest.status}". Please refresh and retry.`
            );
            conflictErr.statusCode = 409;
            throw conflictErr;
          }
          if (latest.paymentStatus !== "Paid") {
            const payErr = new Error("Cannot advance status because payment is still Pending. Customer must complete payment first.");
            payErr.statusCode = 400;
            throw payErr;
          }
          const conflictErr = new Error("Order update conflict. Please refresh and retry.");
          conflictErr.statusCode = 409;
          throw conflictErr;
        }
        throw err;
      }
    }
  }

  async updatePaymentStatus(orderId, { paymentStatus, paymentMethod, paymentDetails, failureReason, shouldAdvanceStatus = false }) {
    const now = new Date().toISOString();
    const selectedMethod = paymentMethod || "Card";
    const attemptId = paymentDetails?.transactionId || `ATTEMPT_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const attemptRecord = {
      attemptId,
      method: selectedMethod,
      status: paymentStatus === "Paid" ? "Success" : "Failed",
      failureReason: failureReason || (paymentStatus === "Failed" ? "Payment decline" : undefined),
      createdAt: now
    };

    const details = {
      transactionId: attemptId,
      paidAt: paymentStatus === "Paid" ? now : undefined,
      failureReason: paymentStatus === "Failed" ? failureReason : undefined
    };

    let updateExpression = `
      SET paymentStatus = :ps,
          paymentMethod = :pm,
          paymentDetails = :pd,
          paymentAttempts = list_append(if_not_exists(paymentAttempts, :emptyList), :att),
          updatedAt = :now
    `;
    const expressionValues = {
      ":ps": paymentStatus,
      ":pm": selectedMethod,
      ":pd": details,
      ":att": [attemptRecord],
      ":emptyList": [],
      ":now": now,
      ":cancelled": "Cancelled",
      ":paid": "Paid"
    };

    const expressionNames = { "#s": "status" };

    if (shouldAdvanceStatus && paymentStatus === "Paid") {
      updateExpression += ", #s = if_not_exists(#s, :proc)";
      expressionValues[":proc"] = "Processing";
    }

    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableNames.ORDERS,
          Key: { orderId },
          UpdateExpression: updateExpression,
          ConditionExpression: "attribute_exists(orderId) AND #s <> :cancelled AND paymentStatus <> :paid",
          ExpressionAttributeNames: expressionNames,
          ExpressionAttributeValues: expressionValues
        })
      );

      return this.findById(orderId);
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") {
        const current = await this.findById(orderId);
        if (!current) {
          const notFound = new Error("Order not found");
          notFound.statusCode = 404;
          throw notFound;
        }
        if (current.paymentStatus === "Paid") {
          return current; // Idempotent success
        }
        if (current.status === "Cancelled") {
          const cancErr = new Error("Cannot apply payment to a cancelled order.");
          cancErr.statusCode = 400;
          throw cancErr;
        }
      }
      throw err;
    }
  }

  async cancelPendingPayment(orderId, userId, productRepo) {
    const order = await this.findById(orderId);
    if (!order) return true; // Idempotent

    if (userId && order.userId.toString() !== userId.toString()) {
      const err = new Error("Access denied. Not your order.");
      err.statusCode = 403;
      throw err;
    }

    if (order.paymentStatus === "Paid") {
      const err = new Error("Cannot cancel an order that has already been paid.");
      err.statusCode = 400;
      throw err;
    }

    const now = new Date().toISOString();
    const transactItems = [
      {
        Delete: {
          TableName: this.tableNames.ORDERS,
          Key: { orderId },
          ConditionExpression: "attribute_exists(orderId) AND paymentStatus <> :paid",
          ExpressionAttributeValues: { ":paid": "Paid" }
        }
      },
      ...order.products.map((item) => ({
        Update: {
          TableName: this.tableNames.PRODUCTS,
          Key: { productId: item.productId },
          UpdateExpression: "SET stock = stock + :qty, updatedAt = :now",
          ExpressionAttributeValues: {
            ":qty": Number(item.quantity),
            ":now": now
          }
        }
      }))
    ];

    try {
      await this.docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
      return true;
    } catch (err) {
      if (err.name === "TransactionCanceledException") {
        return false;
      }
      throw err;
    }
  }

  async checkReviewEligibility(userId, productId) {
    if (!userId || !productId) return false;

    try {
      // Query user orders and check if any paid, non-cancelled order contains the productId
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableNames.ORDERS,
          IndexName: "userId-createdAt-index",
          KeyConditionExpression: "userId = :uid",
          FilterExpression: "paymentStatus = :paid AND #s <> :canc AND contains(purchasedProductIds, :pid)",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":uid": userId,
            ":paid": "Paid",
            ":canc": "Cancelled",
            ":pid": productId
          },
          Limit: 1
        })
      );

      return (result.Items || []).length > 0;
    } catch (err) {
      // Fallback scan if index is not yet created
      const scanResult = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableNames.ORDERS,
          FilterExpression: "userId = :uid AND paymentStatus = :paid AND #s <> :canc AND contains(purchasedProductIds, :pid)",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":uid": userId,
            ":paid": "Paid",
            ":canc": "Cancelled",
            ":pid": productId
          },
          Limit: 1
        })
      );
      return (scanResult.Items || []).length > 0;
    }
  }

  async getStats() {
    const ordersResult = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableNames.ORDERS,
        ProjectionExpression: "totalAmount, paymentStatus"
      })
    );

    const allOrders = ordersResult.Items || [];
    const totalOrders = allOrders.length;
    const totalRevenue = allOrders
      .filter((o) => o.paymentStatus === "Paid")
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    return { totalOrders, totalRevenue };
  }
}

module.exports = OrderRepository;
