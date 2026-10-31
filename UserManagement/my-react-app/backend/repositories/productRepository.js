const crypto = require("crypto");
const {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand
} = require("@aws-sdk/lib-dynamodb");
const { docClient: defaultDocClient, TABLE_NAMES } = require("../config/dynamodb");

class ProductRepository {
  constructor(docClient = defaultDocClient, tableName = TABLE_NAMES.PRODUCTS) {
    this.docClient = docClient;
    this.tableName = tableName;
  }

  _formatProduct(item) {
    if (!item) return null;
    return {
      _id: item.productId,
      id: item.productId,
      productId: item.productId,
      name: item.name,
      description: item.description || "",
      price: Number(item.price),
      category: item.category,
      stock: Number(item.stock || 0),
      image: item.image || "",
      mrp: item.mrp !== undefined ? Number(item.mrp) : undefined,
      rating: Number(item.rating || 0),
      reviewsCount: Number(item.reviewsCount || 0),
      warranty: item.warranty || "1 Year Manufacturer Warranty",
      reviews: Array.isArray(item.reviews) ? item.reviews : [],
      version: Number(item.version || 1),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  async findById(productId) {
    if (!productId || typeof productId !== "string") return null;

    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { productId }
      })
    );

    return this._formatProduct(result.Item);
  }

  async findByIds(productIds) {
    if (!Array.isArray(productIds) || productIds.length === 0) return [];

    const fetchPromises = productIds.map((id) => this.findById(id));
    const results = await Promise.all(fetchPromises);
    return results.filter(Boolean);
  }

  async create(productData) {
    const { name, description = "", price, category, stock = 0, image = "", mrp, warranty } = productData;

    if (!name || price === undefined || !category) {
      throw new Error("Name, price, and category are required");
    }

    const productId = productData.productId || `p_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const searchTerms = `${name.toLowerCase()} ${category.toLowerCase()} ${description.toLowerCase()}`;

    const item = {
      productId,
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      category: category.trim(),
      stock: Number(stock),
      image: image || "",
      mrp: mrp !== undefined ? Number(mrp) : Number(price),
      rating: 0,
      reviewsCount: 0,
      warranty: warranty || "1 Year Manufacturer Warranty",
      reviews: [],
      version: 1,
      searchTerms,
      createdAt: now,
      updatedAt: now
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: "attribute_not_exists(productId)"
      })
    );

    return this._formatProduct(item);
  }

  async update(productId, updateFields) {
    const existing = await this.findById(productId);
    if (!existing) {
      const err = new Error("Product not found");
      err.statusCode = 404;
      throw err;
    }

    const name = updateFields.name !== undefined ? updateFields.name.trim() : existing.name;
    const description = updateFields.description !== undefined ? updateFields.description.trim() : existing.description;
    const price = updateFields.price !== undefined ? Number(updateFields.price) : existing.price;
    const category = updateFields.category !== undefined ? updateFields.category.trim() : existing.category;
    const stock = updateFields.stock !== undefined ? Number(updateFields.stock) : existing.stock;
    const image = updateFields.image !== undefined ? updateFields.image : existing.image;
    const mrp = updateFields.mrp !== undefined ? Number(updateFields.mrp) : existing.mrp;
    const warranty = updateFields.warranty !== undefined ? updateFields.warranty : existing.warranty;

    const now = new Date().toISOString();
    const searchTerms = `${name.toLowerCase()} ${category.toLowerCase()} ${description.toLowerCase()}`;

    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { productId },
          UpdateExpression: `
            SET #n = :name,
                description = :description,
                price = :price,
                category = :category,
                stock = :stock,
                image = :image,
                mrp = :mrp,
                warranty = :warranty,
                searchTerms = :searchTerms,
                #v = #v + :inc,
                updatedAt = :now
          `,
          ConditionExpression: "attribute_exists(productId)",
          ExpressionAttributeNames: {
            "#n": "name",
            "#v": "version"
          },
          ExpressionAttributeValues: {
            ":name": name,
            ":description": description,
            ":price": price,
            ":category": category,
            ":stock": stock,
            ":image": image,
            ":mrp": mrp,
            ":warranty": warranty,
            ":searchTerms": searchTerms,
            ":inc": 1,
            ":now": now
          }
        })
      );
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") {
        const notFoundErr = new Error("Product not found");
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }
      throw err;
    }

    return this.findById(productId);
  }

  async delete(productId) {
    const existing = await this.findById(productId);
    if (!existing) return false;

    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { productId },
          ConditionExpression: "attribute_exists(productId)"
        })
      );
      return true;
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") {
        return false;
      }
      throw err;
    }
  }

  async list(options = {}) {
    const { category, search, limit = 12, nextCursor } = options;

    const params = {
      TableName: this.tableName,
      Limit: limit
    };

    if (nextCursor) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextCursor, "base64").toString("utf-8"));
    }

    const filterExpressions = [];
    const expressionValues = {};
    const expressionNames = {};

    if (category) {
      filterExpressions.push("category = :cat");
      expressionValues[":cat"] = category.trim();
    }

    if (search) {
      const term = search.trim().toLowerCase();
      filterExpressions.push("contains(searchTerms, :term)");
      expressionValues[":term"] = term;
    }

    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(" AND ");
      params.ExpressionAttributeValues = expressionValues;
      if (Object.keys(expressionNames).length > 0) {
        params.ExpressionAttributeNames = expressionNames;
      }
    }

    const result = await this.docClient.send(new ScanCommand(params));
    const products = (result.Items || []).map((item) => this._formatProduct(item));

    const response = {
      products,
      total: products.length
    };

    if (result.LastEvaluatedKey) {
      response.nextCursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64");
    }

    return response;
  }

  async addReview(productId, { userId, userName, rating, comment }, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const product = await this.findById(productId);
      if (!product) {
        const err = new Error("Product not found");
        err.statusCode = 404;
        throw err;
      }

      const reviews = [...product.reviews];
      const existingIdx = reviews.findIndex((r) => r.userId.toString() === userId.toString());
      const now = new Date().toISOString();

      if (existingIdx !== -1) {
        // Update existing review by same user (prevent duplicate review items)
        reviews[existingIdx] = {
          ...reviews[existingIdx],
          rating: Number(rating),
          comment,
          updatedAt: now
        };
      } else {
        reviews.push({
          reviewId: `rev_${crypto.randomUUID()}`,
          _id: `rev_${crypto.randomUUID()}`,
          userId: userId.toString(),
          userName: userName || "Customer",
          rating: Number(rating),
          comment,
          createdAt: now
        });
      }

      const reviewsCount = reviews.length;
      const totalStars = reviews.reduce((sum, item) => sum + item.rating, 0);
      const avgRating = Math.round((totalStars / reviewsCount) * 10) / 10;

      try {
        await this.docClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { productId },
            UpdateExpression: `
              SET reviews = :reviews,
                  reviewsCount = :rc,
                  rating = :rating,
                  #v = #v + :inc,
                  updatedAt = :now
            `,
            ConditionExpression: "attribute_exists(productId) AND #v = :currVer",
            ExpressionAttributeNames: {
              "#v": "version"
            },
            ExpressionAttributeValues: {
              ":reviews": reviews,
              ":rc": reviewsCount,
              ":rating": avgRating,
              ":inc": 1,
              ":currVer": product.version,
              ":now": now
            }
          })
        );

        return this.findById(productId);
      } catch (err) {
        if (err.name === "ConditionalCheckFailedException" && attempt < maxRetries - 1) {
          // Version conflict; retry next loop
          continue;
        }
        throw err;
      }
    }

    throw new Error("Failed to add review due to concurrent updates. Please try again.");
  }

  async deleteReview(productId, reviewId, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const product = await this.findById(productId);
      if (!product) {
        const err = new Error("Product not found");
        err.statusCode = 404;
        throw err;
      }

      const originalCount = product.reviews.length;
      const filtered = product.reviews.filter((r) => r.reviewId !== reviewId && r._id !== reviewId);

      if (filtered.length === originalCount) {
        const err = new Error("Review not found");
        err.statusCode = 404;
        throw err;
      }

      const reviewsCount = filtered.length;
      const totalStars = filtered.reduce((sum, item) => sum + item.rating, 0);
      const avgRating = reviewsCount > 0 ? Math.round((totalStars / reviewsCount) * 10) / 10 : 0;
      const now = new Date().toISOString();

      try {
        await this.docClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { productId },
            UpdateExpression: `
              SET reviews = :reviews,
                  reviewsCount = :rc,
                  rating = :rating,
                  #v = #v + :inc,
                  updatedAt = :now
            `,
            ConditionExpression: "attribute_exists(productId) AND #v = :currVer",
            ExpressionAttributeNames: { "#v": "version" },
            ExpressionAttributeValues: {
              ":reviews": filtered,
              ":rc": reviewsCount,
              ":rating": avgRating,
              ":inc": 1,
              ":currVer": product.version,
              ":now": now
            }
          })
        );

        return {
          reviewsCount,
          rating: avgRating
        };
      } catch (err) {
        if (err.name === "ConditionalCheckFailedException" && attempt < maxRetries - 1) {
          continue;
        }
        throw err;
      }
    }

    throw new Error("Failed to delete review due to concurrent updates. Please try again.");
  }

  async getAllReviews() {
    const result = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "attribute_exists(reviews) AND size(reviews) > :zero",
        ExpressionAttributeValues: { ":zero": 0 }
      })
    );

    const allReviews = [];
    for (const item of result.Items || []) {
      const product = this._formatProduct(item);
      for (const rev of product.reviews) {
        allReviews.push({
          _id: rev.reviewId || rev._id,
          productId: product.productId,
          productName: product.name,
          productImage: product.image,
          userId: rev.userId,
          userName: rev.userName,
          rating: rev.rating,
          comment: rev.comment,
          createdAt: rev.createdAt
        });
      }
    }

    allReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return allReviews;
  }

  async count() {
    const result = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        Select: "COUNT"
      })
    );
    return result.Count || 0;
  }
}

module.exports = ProductRepository;
