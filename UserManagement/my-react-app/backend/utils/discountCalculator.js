/**
 * Utility functions for authoritative backend discount calculations.
 * Never trust client prices or client-computed discounts.
 */

/**
 * Calculates effective price and discount metadata for a product.
 *
 * @param {Object} product - Product document or plain object
 * @returns {Object}
 */
function calculateProductDiscount(product) {
  if (!product) {
    return {
      originalPrice: 0,
      effectivePrice: 0,
      discountAmount: 0,
      discountPercent: 0,
      isDiscountActive: false
    };
  }

  const originalPrice = Number(product.price) || 0;
  const discount = product.discount;

  if (!discount || !discount.isActive || Number(discount.value) <= 0) {
    return {
      originalPrice,
      effectivePrice: originalPrice,
      discountAmount: 0,
      discountPercent: 0,
      isDiscountActive: false
    };
  }

  const now = new Date();

  // Validate start date if present
  if (discount.startDate && new Date(discount.startDate) > now) {
    return {
      originalPrice,
      effectivePrice: originalPrice,
      discountAmount: 0,
      discountPercent: 0,
      isDiscountActive: false
    };
  }

  // Validate end date if present (auto-expire)
  if (discount.endDate && new Date(discount.endDate) < now) {
    return {
      originalPrice,
      effectivePrice: originalPrice,
      discountAmount: 0,
      discountPercent: 0,
      isDiscountActive: false
    };
  }

  let discountAmount = 0;
  let discountPercent = 0;
  const discountValue = Number(discount.value) || 0;

  if (discount.discountType === "percentage") {
    const cappedPercent = Math.min(Math.max(discountValue, 0), 100);
    discountAmount = Math.round((originalPrice * cappedPercent) / 100);
    discountPercent = cappedPercent;
  } else if (discount.discountType === "fixed") {
    discountAmount = Math.min(Math.max(discountValue, 0), originalPrice);
    discountPercent = originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 100) : 0;
  }

  const effectivePrice = Math.max(0, originalPrice - discountAmount);

  return {
    originalPrice,
    effectivePrice,
    discountAmount,
    discountPercent,
    isDiscountActive: discountAmount > 0
  };
}

module.exports = {
  calculateProductDiscount
};

