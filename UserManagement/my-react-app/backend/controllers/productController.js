const ProductRepository = require("../repositories/productRepository");
const OrderRepository = require("../repositories/orderRepository");
const { calculateProductDiscount } = require("../utils/discountCalculator");

const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");
const {
  getSignedUrl
} = require("@aws-sdk/s3-request-presigner");
const s3 = require("../config/s3");
const fs = require("fs");
const path = require("path");

let activeProductRepo = new ProductRepository();
let activeOrderRepo = new OrderRepository();

exports.setProductRepository = (repo) => {
  activeProductRepo = repo;
};
exports.getProductRepository = () => activeProductRepo;

exports.setOrderRepository = (repo) => {
  activeOrderRepo = repo;
};
exports.getOrderRepository = () => activeOrderRepo;

// In-memory cache for presigned URLs: key -> { url, expiresAt }
const presignedCache = new Map();

/**
 * Converts a stored S3 object key or legacy URL into a temporary presigned URL.
 * Handles private S3 objects while retaining compatibility with existing
 * Base64 images, local upload paths, and external image URLs.
 */
async function getProductWithImageUrl(product) {
  if (!product) return product;

  const item =
    typeof product.toObject === "function"
      ? product.toObject()
      : { ...product };

  const image =
    typeof item.image === "string"
      ? item.image.trim()
      : "";

  item.imageUrl = image;

  // Enrich product with server-side discount calculation
  const discountInfo = calculateProductDiscount(item);
  item.effectivePrice = discountInfo.effectivePrice;
  item.discountAmount = discountInfo.discountAmount;
  item.discountPercent = discountInfo.discountPercent;
  item.isDiscountActive = discountInfo.isDiscountActive;

  // Base64 data URIs
  if (image.startsWith("data:image/")) {
    return item;
  }

  // Local filesystem uploads
  if (image.startsWith("/uploads/") || image.startsWith("uploads/")) {
    item.imageUrl = image.startsWith("/") ? image : `/${image}`;
    return item;
  }

  // Extract S3 object key
  let s3Key = null;
  if (image.startsWith("products/")) {
    s3Key = image;
  } else if (/^https?:\/\/.*\.amazonaws\.com\//.test(image)) {
    try {
      const parsed = new URL(image);
      const pathname = parsed.pathname.replace(/^\/+/, "");
      const segments = pathname.split("/");
      const bucket = s3.getBucketName();
      if (segments[0] === bucket) {
        s3Key = segments.slice(1).join("/");
      } else {
        s3Key = pathname;
      }
    } catch (_) {
      s3Key = null;
    }
  }

  // External non-S3 URLs
  if (!s3Key) {
    return item;
  }

  // Check cache for valid presigned URL (with 5-minute safety buffer)
  const cached = presignedCache.get(s3Key);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 300 * 1000) {
    item.imageUrl = cached.url;
    return item;
  }

  // Generate new presigned GET URL (1-hour expiration)
  try {
    const s3Client = s3.getS3Client();
    const bucket = s3.getBucketName();
    if (s3Client && bucket) {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: s3Key
      });
      const signed = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      presignedCache.set(s3Key, {
        url: signed,
        expiresAt: now + 3600 * 1000
      });
      item.imageUrl = signed;
    }
  } catch (err) {
    console.warn(`[S3] Presigning failed for key "${s3Key}":`, err.message);
  }

  return item;
}

/**
 * Batch resolve image URLs and discounts for multiple products concurrently
 */
async function getProductsWithImageUrls(products) {
  if (!Array.isArray(products)) return [];
  return Promise.all(products.map(getProductWithImageUrl));
}

/**
 * Process uploaded product image (supports S3 upload or local storage)
 */
async function processProductImage(file) {
  if (!file) return null;

  const s3Client = s3.getS3Client();
  const bucket = s3.getBucketName();

  if (s3Client && bucket) {
    const fileExt = path.extname(file.originalname) || ".jpg";
    const objectKey = `products/${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;

    let body = file.buffer;
    if (!body && file.path && fs.existsSync(file.path)) {
      body = fs.readFileSync(file.path);
    }

    if (body) {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: body,
        ContentType: file.mimetype || "image/jpeg"
      });

      await s3Client.send(command);

      // Clean up temporary local file if written by diskStorage
      if (file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (_) {}
      }

      return objectKey;
    }
  }

  // Fallback to local storage if S3 is unconfigured
  if (file.filename) {
    return `/uploads/products/${file.filename}`;
  }
  return null;
}

/**
 * Safely delete an S3 or local product image file
 */
async function deleteProductImageFile(imagePath) {
  if (!imagePath || typeof imagePath !== "string") return;

  const s3Client = s3.getS3Client();
  const bucket = s3.getBucketName();

  let s3Key = null;
  if (imagePath.startsWith("products/")) {
    s3Key = imagePath;
  } else if (/^https?:\/\/.*\.amazonaws\.com\//.test(imagePath)) {
    try {
      const parsed = new URL(imagePath);
      const pathname = parsed.pathname.replace(/^\/+/, "");
      const segments = pathname.split("/");
      if (segments[0] === bucket) {
        s3Key = segments.slice(1).join("/");
      } else {
        s3Key = pathname;
      }
    } catch (_) {
      s3Key = null;
    }
  }

  if (s3Key && s3Client && bucket) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: s3Key
        })
      );
      presignedCache.delete(s3Key);
      console.log(`[S3] Object Deleted: ${s3Key}`);
      return;
    } catch (err) {
      console.warn(`[S3] Failed to delete object "${s3Key}":`, err.message);
    }
  }

  // Local filesystem cleanup
  if (imagePath.startsWith("/uploads/") || imagePath.startsWith("uploads/")) {
    try {
      const cleanRelative = imagePath.replace(/^\/+/, "");
      const fullPath = path.join(__dirname, "..", cleanRelative);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.warn(`[FileSystem] Failed to delete local image "${imagePath}":`, err.message);
    }
  }
}

// Invalidate cache every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of presignedCache.entries()) {
    if (val.expiresAt <= now) {
      presignedCache.delete(key);
    }
  }
}, 15 * 60 * 1000).unref();

/**
 * 1. Get Products with Optional Category, Search & Pagination
 * GET /api/products
 */
exports.getProducts = async (req, res) => {
  try {
    const { search, page, limit, category } = req.query;

    if (page) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 12;
      const result = await activeProductRepo.list({
        category,
        search,
        limit: limitNum
      });
      const total = await activeProductRepo.count();
      const productsWithImageUrls = await getProductsWithImageUrls(result.products);

      return res.json({
        products: productsWithImageUrls,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1
      });
    }

    const result = await activeProductRepo.list({
      category,
      search,
      limit: 100
    });
    const productsWithImageUrls = await getProductsWithImageUrls(result.products);
    return res.json(productsWithImageUrls);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 2. Get Single Product by ID
 * GET /api/products/:id
 */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await activeProductRepo.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    const withUrl = await getProductWithImageUrl(product);
    return res.json(withUrl);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 3. Create Product (Admin)
 * POST /api/products
 */
exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, category, stock, mrp, warranty } = req.body;

    if (!name || price === undefined || !category || stock === undefined) {
      return res.status(400).json({
        message: "Name, price, category, and stock are required."
      });
    }

    const parsedPrice = Number(price);
    const parsedStock = Number(stock);
    const parsedMrp = mrp !== undefined && mrp !== "" ? Number(mrp) : parsedPrice;

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ message: "Price must be a positive number." });
    }

    if (isNaN(parsedStock) || !Number.isInteger(parsedStock) || parsedStock < 0) {
      return res.status(400).json({ message: "Stock must be a non-negative integer." });
    }

    let imageValue = "";
    if (req.file) {
      imageValue = await processProductImage(req.file);
    } else if (req.body.image) {
      imageValue = req.body.image.trim();
    }

    const createdProduct = await activeProductRepo.create({
      name,
      description: description || "",
      price: parsedPrice,
      category,
      stock: parsedStock,
      mrp: parsedMrp,
      warranty: warranty || "1 Year Manufacturer Warranty",
      image: imageValue,
      discount: req.body.discount || { isActive: false, value: 0 }
    });

    const withUrl = await getProductWithImageUrl(createdProduct);
    return res.status(201).json({
      message: "Product created successfully",
      product: withUrl
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 4. Update Product (Admin)
 * PUT /api/products/:id
 */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await activeProductRepo.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Product not found" });
    }

    const updates = { ...req.body };
    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.stock !== undefined) updates.stock = Number(updates.stock);
    if (updates.mrp !== undefined) updates.mrp = Number(updates.mrp);

    if (req.file) {
      if (existing.image) {
        await deleteProductImageFile(existing.image);
      }
      updates.image = await processProductImage(req.file);
    }

    const updated = await activeProductRepo.update(id, updates);
    const withUrl = await getProductWithImageUrl(updated);
    return res.json({
      message: "Product updated successfully",
      product: withUrl
    });
  } catch (error) {
    res.status(error.statusCode || error.status || 500).json({ message: error.message });
  }
};

/**
 * 5. Delete Product (Admin)
 * DELETE /api/products/:id
 */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await activeProductRepo.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (existing.image) {
      await deleteProductImageFile(existing.image);
    }

    await activeProductRepo.delete(id);
    return res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 6. Check Review Eligibility for Customer
 * GET /api/products/:id/can-review
 */
exports.canUserReview = async (req, res) => {
  try {
    const { id: productId } = req.params;
    const userId = req.user.id;

    const hasPurchased = await activeOrderRepo.checkReviewEligibility(userId, productId);
    return res.json({ canReview: hasPurchased });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 7. Add Product Review
 * POST /api/products/:id/reviews
 */
exports.addProductReview = async (req, res) => {
  try {
    const { id: productId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.name || "Customer";

    if (!rating || !comment) {
      return res.status(400).json({ message: "Rating and comment are required." });
    }

    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5." });
    }

    const hasPurchased = await activeOrderRepo.checkReviewEligibility(userId, productId);
    if (!hasPurchased) {
      return res.status(403).json({
        message: "Only verified buyers who have purchased this product can leave a review."
      });
    }

    const result = await activeProductRepo.addReview(productId, {
      userId,
      userName,
      rating: numericRating,
      comment: comment.trim()
    });

    return res.status(201).json({
      message: "Review added successfully",
      rating: result.rating,
      reviewsCount: result.reviewsCount,
      reviews: result.reviews,
      product: result
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    res.status(statusCode).json({ message: error.message });
  }
};

/**
 * 8. Get All Product Reviews (Admin Moderation)
 * GET /api/products/reviews/all
 */
exports.getAllProductReviews = async (req, res) => {
  try {
    const allReviews = await activeProductRepo.getAllReviews();
    const reviewsWithUrls = await Promise.all(
      allReviews.map(async (r) => {
        const dummyProduct = { image: r.productImage };
        const withUrl = await getProductWithImageUrl(dummyProduct);
        return {
          ...r,
          productImage: withUrl.imageUrl || withUrl.image
        };
      })
    );
    return res.json(reviewsWithUrls);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 9. Delete Product Review (Admin Moderation)
 * DELETE /api/products/:productId/reviews/:reviewId
 */
exports.deleteProductReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    const result = await activeProductRepo.deleteReview(productId, reviewId);
    return res.json({
      message: "Review deleted successfully",
      reviewsCount: result.reviewsCount,
      rating: result.rating
    });
  } catch (error) {
    res.status(error.statusCode || error.status || 500).json({ message: error.message });
  }
};

// Export helpers for testing and reuse
exports.getProductWithImageUrl = getProductWithImageUrl;
exports.getProductsWithImageUrls = getProductsWithImageUrls;
exports.processProductImage = processProductImage;
exports.deleteProductImageFile = deleteProductImageFile;

// Aliases for route/test consistency
exports.checkPurchaseEligibility = exports.canUserReview;
exports.createProductReview = exports.addProductReview;
exports.getAllReviews = exports.getAllProductReviews;
