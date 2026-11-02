import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import logo from "../assets/logo.png";

function Navbar() {
  const navigate = useNavigate();
  const { cart, switchUser } = useCart();
  const { wishlist } = useWishlist();

  const user = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("student_cart");
    if (typeof switchUser === "function") {
      switchUser(null);
    }
    navigate("/login");
  }

  return (
    <header className="navbar">
      <Link to="/products" className="navbar-brand" style={{ display: "flex", alignItems: "center" }}>
        <img
          src={logo}
          alt="shopiee"
          style={{ height: "38px", width: "auto", objectFit: "contain" }}
        />
      </Link>

      <nav className="navbar-links">
        <Link to="/products">Products</Link>

        <Link to="/wishlist" style={{ display: "flex", alignItems: "center" }}>
          Wishlist {wishlist.length > 0 && <span className="wishlist-badge">{wishlist.length}</span>}
        </Link>

        <Link to="/cart">
          Cart {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
        </Link>

        {token && <Link to="/orders">My Orders</Link>}

        {user && user.role === "admin" && (
          <Link to="/admin/dashboard" style={{ color: "#2563eb", fontWeight: "bold" }}>
            Admin Dashboard
          </Link>
        )}

        {token ? (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>
              Hi, {user?.name || "User"}
            </span>
            <button onClick={handleLogout} className="btn btn-outline btn-sm">
              Logout
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "10px" }}>
            <Link to="/login" className="btn btn-outline btn-sm">
              Login
            </Link>
            <Link to="/signup" className="btn btn-primary btn-sm">
              Register
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}

export default Navbar;
