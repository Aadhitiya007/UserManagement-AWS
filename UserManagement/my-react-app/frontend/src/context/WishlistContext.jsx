import { createContext, useContext, useState, useEffect } from "react";

const WishlistContext = createContext();

const STORAGE_KEY = "shopiee_wishlist";

export function WishlistProvider({ children }) {
  const [wishlist, setWishlist] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("solstice_wishlist");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlist));
    } catch (e) {
      console.warn("Could not save wishlist to localStorage", e);
    }
  }, [wishlist]);

  const isInWishlist = (productId) => {
    if (!productId) return false;
    return wishlist.some((item) => (item.id || item._id || item.productId) === productId);
  };

  const addToWishlist = (product) => {
    if (!product) return;
    const pId = product.id || product._id || product.productId;
    setWishlist((prev) => {
      if (prev.some((item) => (item.id || item._id || item.productId) === pId)) {
        return prev;
      }
      return [...prev, product];
    });
  };

  const removeFromWishlist = (productId) => {
    setWishlist((prev) =>
      prev.filter((item) => (item.id || item._id || item.productId) !== productId)
    );
  };

  const toggleWishlist = (product) => {
    if (!product) return;
    const pId = product.id || product._id || product.productId;
    if (isInWishlist(pId)) {
      removeFromWishlist(pId);
    } else {
      addToWishlist(product);
    }
  };

  const moveToCart = (productId, addToCartFn) => {
    const item = wishlist.find((p) => (p.id || p._id || p.productId) === productId);
    if (item && typeof addToCartFn === "function") {
      addToCartFn(item, 1);
      removeFromWishlist(productId);
    }
  };

  const clearWishlist = () => {
    setWishlist([]);
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        isInWishlist,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        moveToCart,
        clearWishlist
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}

