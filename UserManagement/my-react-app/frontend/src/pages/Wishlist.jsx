import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useWishlist } from "../context/WishlistContext";
import { useCart } from "../context/CartContext";

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
      <div className="wishlist-container">
        <div className="wishlist-header">
          <h2>
            <span>Saved in Wishlist</span>
            <span className="wishlist-count-pill">{wishlist.length} item{wishlist.length !== 1 ? "s" : ""}</span>
          </h2>
          {wishlist.length > 0 && (
            <button
              onClick={clearWishlist}
              className="btn btn-outline btn-sm"
              style={{ color: "#dc2626", borderColor: "#fca5a5" }}
            >
              Clear All
            </button>
          )}
        </div>

        {wishlist.length === 0 ? (
          <div className="wishlist-empty-state">
            <div className="wishlist-empty-icon">🤍</div>
            <h3>Your wishlist is empty</h3>
            <p>Save items you like and track their stock or move them to cart anytime.</p>
            <Link to="/products" className="btn btn-primary" style={{ padding: "10px 24px", borderRadius: "8px" }}>
              Explore Products
            </Link>
          </div>
        ) : (
          <div className="wishlist-grid">
            {wishlist.map((item) => {
              const pId = item.id || item._id || item.productId;
              const isOutOfStock = item.stock !== undefined && Number(item.stock) <= 0;
              const imgSrc = item.imageUrl || item.image || "https://placehold.co/400x300?text=No+Image";

              return (
                <div key={pId} className="wishlist-card">
                  <div className="wishlist-card-img-wrapper">
                    {isOutOfStock && <span className="badge-out-of-stock">Out of Stock</span>}
                    <Link to={`/products/${pId}`}>
                      <img src={imgSrc} alt={item.name} className="wishlist-card-img" />
                    </Link>
                  </div>

                  <div className="wishlist-card-body">
                    <Link to={`/products/${pId}`} className="wishlist-card-title">
                      {item.name}
                    </Link>

                    <div className="wishlist-card-price-row">
                      <span className="wishlist-card-price">₹{Number(item.price).toLocaleString("en-IN")}</span>
                      {item.mrp && Number(item.mrp) > Number(item.price) && (
                        <span className="wishlist-card-mrp">₹{Number(item.mrp).toLocaleString("en-IN")}</span>
                      )}
                    </div>

                    <div className="wishlist-card-actions">
                      <button
                        onClick={() => handleMoveToCart(item)}
                        className={`wishlist-btn-move ${isOutOfStock ? "btn-out-of-stock" : ""}`}
                        disabled={isOutOfStock}
                      >
                        {isOutOfStock ? "Out of Stock" : "Move to Bag"}
                      </button>
                      <button
                        onClick={() => removeFromWishlist(pId)}
                        className="wishlist-btn-remove"
                        title="Remove from wishlist"
                      >
                        ✕
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

