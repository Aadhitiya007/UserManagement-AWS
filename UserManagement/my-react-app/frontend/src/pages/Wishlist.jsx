import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useWishlist } from "../context/WishlistContext";
import { useCart } from "../context/CartContext";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import { Heart, ShoppingBag, Trash2, ArrowRight } from "lucide-react";

function Wishlist() {
  const { wishlist, removeFromWishlist, moveToCart, clearWishlist } = useWishlist();
  const { addToCart } = useCart();

  const handleMoveToCart = (product) => {
    const pId = product.id || product._id || product.productId;
    const stock = product.stock !== undefined ? Number(product.stock) : Infinity;
    if (stock <= 0) {
      alert("This item is currently out of stock and cannot be added to cart.");
      return;
    }
    moveToCart(pId, addToCart);
  };

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: "32px", paddingBottom: "60px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "28px",
            flexWrap: "wrap",
            gap: "16px"
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.85rem",
                fontWeight: "800",
                color: "var(--color-text-primary)",
                letterSpacing: "-0.03em",
                margin: "0 0 4px"
              }}
            >
              Saved in Wishlist
            </h1>
            <p style={{ fontSize: "0.88rem", color: "var(--color-text-secondary)", margin: 0 }}>
              Curated drops saved to your personal collection.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Badge variant="info">{wishlist.length} Saved Drops</Badge>
            {wishlist.length > 0 && (
              <button
                type="button"
                onClick={clearWishlist}
                className="btn btn-secondary btn-sm"
                style={{ color: "var(--color-error)" }}
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {wishlist.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Your wishlist is empty"
            description="Explore our curated catalog and save items you love to track stock and price drops."
            action={
              <Link to="/products" className="btn btn-primary btn-sm">
                <span>Explore Drops</span>
                <ArrowRight size={14} />
              </Link>
            }
          />
        ) : (
          <div className="product-grid">
            {wishlist.map((item) => {
              const pId = item.id || item._id || item.productId;
              const isOutOfStock = item.stock !== undefined && Number(item.stock) <= 0;
              const imgSrc = item.imageUrl || item.image || "https://placehold.co/400x300?text=No+Image";

              return (
                <div key={pId} className="product-card">
                  <div className="product-image-wrap">
                    {isOutOfStock && (
                      <div className="product-card-badge">
                        <Badge variant="danger">Out of Stock</Badge>
                      </div>
                    )}
                    <Link to={`/products/${pId}`}>
                      <img src={imgSrc} alt={item.name} />
                    </Link>
                  </div>

                  <div className="product-card-body">
                    <span className="product-card-category">{item.category || "Lifestyle"}</span>

                    <h3 className="product-card-title">
                      <Link to={`/products/${pId}`}>{item.name}</Link>
                    </h3>

                    <div className="product-card-price-row">
                      <span className="product-price-current">
                        ₹{Number(item.price).toLocaleString("en-IN")}
                      </span>
                      {item.mrp && Number(item.mrp) > Number(item.price) && (
                        <span className="product-price-original">
                          ₹{Number(item.mrp).toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>

                    <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => handleMoveToCart(item)}
                        disabled={isOutOfStock}
                        className={`btn btn-sm ${isOutOfStock ? "btn-secondary" : "btn-primary"}`}
                        style={{ flex: 1 }}
                      >
                        <ShoppingBag size={14} />
                        <span>{isOutOfStock ? "Sold Out" : "Move to Bag"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => removeFromWishlist(pId)}
                        className="btn btn-secondary btn-sm btn-icon-only"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default Wishlist;
