import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { API_URL } from "../config/api";
import logoIcon from "../assets/logo-icon.png";
import ThemeToggle from "./ui/ThemeToggle";
import Modal from "./ui/Modal";
import {
  ShoppingBag,
  Heart,
  Package,
  Shield,
  LogOut,
  LogIn,
  UserPlus,
  Store,
  ChevronDown,
  Phone,
  MapPin,
  ShieldCheck,
  User,
  Mail,
  Calendar,
  Globe,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Menu,
  X
} from "lucide-react";

function Navbar() {
  const navigate = useNavigate();
  const { cart, switchUser } = useCart();
  const { wishlist } = useWishlist();
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const closeTimerRef = useRef(null);
  const profileContainerRef = useRef(null);

  // User state
  const [currentUser, setCurrentUser] = useState(() => {
    return JSON.parse(localStorage.getItem("user") || "null");
  });
  const token = localStorage.getItem("token");

  // Edit Profile Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    country: "",
    age: ""
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  const isStaff = currentUser && (currentUser.role === "admin" || currentUser.role === "manager");
  const isSuperAdmin = currentUser?.role === "admin";
  const isManager = currentUser?.role === "manager";
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Hover handlers with 300ms debounce grace period
  const handleProfileMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setShowProfileCard(true);
  };

  const handleProfileMouseLeave = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setShowProfileCard(false);
    }, 300);
  };

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileContainerRef.current && !profileContainerRef.current.contains(e.target)) {
        setShowProfileCard(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  function handleLogout() {
    if (token) {
      fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: currentUser?.email })
      }).catch(() => {
        // Ignore network errors on logout
      });
    }

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("student_cart");
    setCurrentUser(null);
    if (typeof switchUser === "function") {
      switchUser(null);
    }
    navigate("/login");
  }

  function openEditModal() {
    setShowProfileCard(false);
    setEditError("");
    setEditSuccess("");
    setEditForm({
      name: currentUser?.name || "",
      email: currentUser?.email || "",
      phone: currentUser?.phone || "",
      country: currentUser?.country || "",
      age: currentUser?.age !== undefined && currentUser?.age !== null ? String(currentUser.age) : ""
    });
    setIsEditModalOpen(true);
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setEditError("");
    setEditSuccess("");

    if (!editForm.name.trim()) {
      setEditError("Full Name is required.");
      return;
    }

    if (!editForm.email.trim()) {
      setEditError("Email Address is required.");
      return;
    }

    const userId = currentUser?.id || currentUser?._id;
    if (!userId || !token) {
      setEditError("You must be signed in to edit your profile.");
      return;
    }

    try {
      setEditLoading(true);

      const res = await fetch(`${API_URL}/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim().toLowerCase(),
          phone: editForm.phone.trim(),
          country: editForm.country.trim(),
          age: editForm.age ? Number(editForm.age) : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update profile.");
      }

      const updatedUser = {
        ...currentUser,
        ...data.user,
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone.trim(),
        country: editForm.country.trim(),
        age: editForm.age ? Number(editForm.age) : undefined
      };

      // Persist in localStorage and update state
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      setEditSuccess("Profile updated successfully!");

      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccess("");
      }, 1200);
    } catch (err) {
      setEditError(err.message || "An error occurred while updating profile.");
    } finally {
      setEditLoading(false);
    }
  }

  const userInitial = currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U";

  return (
    <>
      <header className="navbar">
        {/* Dynamic Brand Logo: "shopi" turns white in dark mode, "ee" & bag remain vibrant orange */}
        <Link
          to="/products"
          className="navbar-brand"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            textDecoration: "none"
          }}
        >
          <img
            src={logoIcon}
            alt="Shopiee Logo"
            style={{ height: "32px", width: "auto", objectFit: "contain" }}
          />
          <span
            style={{
              fontSize: "1.45rem",
              fontWeight: "800",
              letterSpacing: "-0.03em",
              fontFamily: "var(--font-sans)",
              lineHeight: 1
            }}
          >
            <span style={{ color: "var(--color-logo-shopi, #172033)", transition: "color 0.15s ease" }}>
              shopi
            </span>
            <span style={{ color: "var(--color-coral, #FF7043)" }}>
              ee
            </span>
          </span>
        </Link>

        <nav className="navbar-links desktop-only">
          {/* Changed from 'Discover' to 'Store' */}
          <Link to="/products" className="nav-link-item">
            <Store size={16} />
            <span>{isStaff ? "Browse Store" : "Store"}</span>
          </Link>

          {/* Customer-only shopping links: hidden for Admins and Managers */}
          {!isStaff && (
            <>
              <Link to="/wishlist" className="nav-link-item">
                <Heart size={16} />
                <span>Wishlist</span>
                {wishlist.length > 0 && (
                  <span className="nav-badge wishlist-badge">{wishlist.length}</span>
                )}
              </Link>

              <Link to="/cart" className="nav-link-item">
                <ShoppingBag size={16} />
                <span>Bag</span>
                {totalItems > 0 && (
                  <span className="nav-badge">{totalItems}</span>
                )}
              </Link>

              {token && (
                <Link to="/orders" className="nav-link-item">
                  <Package size={16} />
                  <span>My Orders</span>
                </Link>
              )}
            </>
          )}

          {/* Staff & Manager dedicated shortcuts */}
          {isStaff && (
            <>
              <Link to="/admin/orders" className="nav-link-item">
                <Package size={16} />
                <span>Orders</span>
              </Link>

              <Link
                to="/admin/dashboard"
                className="btn btn-sm"
                style={{
                  backgroundColor: isSuperAdmin ? "var(--color-primary)" : "#0D9488",
                  color: "#FFFFFF",
                  boxShadow: isSuperAdmin
                    ? "0 4px 12px rgba(49, 94, 251, 0.25)"
                    : "0 4px 12px rgba(13, 148, 136, 0.25)"
                }}
              >
                <Shield size={14} />
                <span>{isSuperAdmin ? "Admin Portal" : "Manager Portal"}</span>
              </Link>
            </>
          )}

          {/* Dark Mode Theme Switcher */}
          <ThemeToggle />

          {token && currentUser ? (
            <div
              ref={profileContainerRef}
              style={{ position: "relative", marginLeft: "4px" }}
              onMouseEnter={handleProfileMouseEnter}
              onMouseLeave={handleProfileMouseLeave}
            >
              {/* Interactive User Pill */}
              <div
                onClick={() => setShowProfileCard((prev) => !prev)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "4px 10px 4px 6px",
                  borderRadius: "var(--radius-pill)",
                  backgroundColor: showProfileCard ? "var(--color-surface-hover)" : "var(--color-surface-subtle)",
                  border: "1px solid var(--color-border)",
                  cursor: "pointer",
                  transition: "all var(--transition-fast)"
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor: isStaff ? (isSuperAdmin ? "var(--color-primary)" : "#0D9488") : "var(--color-navy)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.8rem",
                    fontWeight: "700"
                  }}
                >
                  {userInitial}
                </div>
                <span
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    color: "var(--color-text-primary)",
                    maxWidth: "110px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  {currentUser.name || "User"}
                </span>
                <ChevronDown
                  size={13}
                  style={{
                    color: "var(--color-text-muted)",
                    transition: "transform var(--transition-fast)",
                    transform: showProfileCard ? "rotate(180deg)" : "rotate(0deg)"
                  }}
                />
              </div>

              {/* Floating User Details Card on Hover / Click */}
              {showProfileCard && (
                <div
                  onMouseEnter={handleProfileMouseEnter}
                  onMouseLeave={handleProfileMouseLeave}
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    paddingTop: "6px",
                    zIndex: 1000
                  }}
                >
                  {/* Invisible hit bridge ensuring cursor never crosses empty space */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: "10px"
                    }}
                  />

                  <div
                    style={{
                      width: "290px",
                      backgroundColor: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-lg)",
                      boxShadow: "var(--shadow-xl)",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      animation: "fadeIn 0.15s ease"
                    }}
                  >
                    {/* Header: Avatar, Name, Email, Role & Edit Button */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "10px",
                        paddingBottom: "12px",
                        borderBottom: "1px solid var(--color-border)"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden", minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "50%",
                            backgroundColor: isStaff ? (isSuperAdmin ? "var(--color-primary)" : "#0D9488") : "var(--color-navy)",
                            color: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.1rem",
                            fontWeight: "700",
                            flexShrink: 0
                          }}
                        >
                          {userInitial}
                        </div>
                        <div style={{ overflow: "hidden", minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontWeight: "700",
                              fontSize: "0.92rem",
                              color: "var(--color-text-primary)",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {currentUser.name || "User"}
                          </div>
                          <div
                            style={{
                              fontSize: "0.78rem",
                              color: "var(--color-text-secondary)",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {currentUser.email || "No email"}
                          </div>
                          <div style={{ marginTop: "4px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: "var(--radius-pill)",
                                fontSize: "0.7rem",
                                fontWeight: "700",
                                backgroundColor: isSuperAdmin
                                  ? "rgba(49, 94, 251, 0.12)"
                                  : isManager
                                  ? "rgba(13, 148, 136, 0.12)"
                                  : "rgba(22, 163, 106, 0.12)",
                                color: isSuperAdmin
                                  ? "var(--color-primary)"
                                  : isManager
                                  ? "#0D9488"
                                  : "var(--color-success)"
                              }}
                            >
                              {isSuperAdmin ? "Super Admin" : isManager ? "Store Manager" : "Verified Customer"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Edit Profile Action Button */}
                      <button
                        type="button"
                        onClick={openEditModal}
                        className="btn btn-secondary btn-sm"
                        style={{
                          padding: "5px 8px",
                          fontSize: "0.72rem",
                          fontWeight: "600",
                          gap: "4px",
                          borderRadius: "var(--radius-sm)",
                          flexShrink: 0
                        }}
                        title="Edit Personal Information"
                      >
                        <Edit2 size={12} />
                        <span>Edit</span>
                      </button>
                    </div>

                    {/* Profile Attributes (Phone, Country/Age) */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Phone size={13} style={{ color: "var(--color-text-muted)" }} />
                        <span>{currentUser.phone || "No phone added"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <MapPin size={13} style={{ color: "var(--color-text-muted)" }} />
                        <span>
                          {currentUser.country || "Country not set"}
                          {currentUser.age ? ` (${currentUser.age} yrs)` : ""}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <ShieldCheck size={13} style={{ color: "var(--color-success)" }} />
                        <span>Account Status: Active</span>
                      </div>
                    </div>

                    {/* Quick Shortcuts */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        borderTop: "1px solid var(--color-border)",
                        paddingTop: "10px"
                      }}
                    >
                      {!isStaff ? (
                        <>
                          <Link
                            to="/orders"
                            className="btn btn-secondary btn-sm"
                            style={{ width: "100%", justifyContent: "flex-start", gap: "8px", fontSize: "0.82rem" }}
                          >
                            <Package size={14} /> My Orders
                          </Link>
                          <Link
                            to="/wishlist"
                            className="btn btn-secondary btn-sm"
                            style={{ width: "100%", justifyContent: "flex-start", gap: "8px", fontSize: "0.82rem" }}
                          >
                            <Heart size={14} /> Wishlist
                          </Link>
                        </>
                      ) : (
                        <Link
                          to="/admin/dashboard"
                          className="btn btn-secondary btn-sm"
                          style={{ width: "100%", justifyContent: "flex-start", gap: "8px", fontSize: "0.82rem" }}
                        >
                          <Shield size={14} /> Admin / Manager Dashboard
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="btn btn-sm"
                        style={{
                          width: "100%",
                          marginTop: "4px",
                          backgroundColor: "rgba(220, 38, 38, 0.08)",
                          color: "var(--color-error)",
                          border: "1px solid rgba(220, 38, 38, 0.2)",
                          justifyContent: "center",
                          gap: "6px",
                          fontSize: "0.82rem",
                          fontWeight: "600"
                        }}
                      >
                        <LogOut size={14} /> Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <Link to="/login" className="btn btn-secondary btn-sm">
                <LogIn size={14} />
                <span>Login</span>
              </Link>
              <Link to="/signup" className="btn btn-primary btn-sm">
                <UserPlus size={14} />
                <span>Sign Up</span>
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile Header Controls */}
        <div className="mobile-only" style={{ alignItems: "center", gap: "8px" }}>
          <ThemeToggle />

          {!isStaff && (
            <Link
              to="/cart"
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-pill)",
                backgroundColor: "var(--color-surface-subtle)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border)",
                textDecoration: "none"
              }}
              aria-label="Shopping Bag"
            >
              <ShoppingBag size={18} />
              {totalItems > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-4px",
                    backgroundColor: "var(--color-coral)",
                    color: "#FFFFFF",
                    fontSize: "0.68rem",
                    fontWeight: "800",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {totalItems}
                </span>
              )}
            </Link>
          )}

          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            aria-label="Open mobile menu"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "var(--radius-pill)",
              backgroundColor: "var(--color-surface-subtle)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border)",
              cursor: "pointer"
            }}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Off-Canvas Mobile Navigation Drawer */}
      {isMobileDrawerOpen && (
        <>
          <div
            className="mobile-drawer-backdrop"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="mobile-drawer">
            <div className="mobile-drawer-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <img
                  src={logoIcon}
                  alt="Shopiee Logo"
                  style={{ height: "26px", width: "auto" }}
                />
                <span
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: "800",
                    letterSpacing: "-0.03em"
                  }}
                >
                  <span style={{ color: "var(--color-logo-shopi, #172033)" }}>shopi</span>
                  <span style={{ color: "var(--color-coral, #FF7043)" }}>ee</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="modal-close-btn"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mobile-drawer-body">
              {/* User Profile Card on Mobile */}
              {token && currentUser ? (
                <div
                  style={{
                    padding: "14px",
                    backgroundColor: "var(--color-surface-subtle)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        backgroundColor: isStaff ? (isSuperAdmin ? "var(--color-primary)" : "#0D9488") : "var(--color-navy)",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "700",
                        fontSize: "1rem"
                      }}
                    >
                      {userInitial}
                    </div>
                    <div style={{ overflow: "hidden", flex: 1 }}>
                      <div
                        style={{
                          fontWeight: "700",
                          fontSize: "0.92rem",
                          color: "var(--color-text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {currentUser.name || "Customer"}
                      </div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--color-text-secondary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {currentUser.email}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "var(--radius-pill)",
                        fontSize: "0.72rem",
                        fontWeight: "700",
                        backgroundColor: isSuperAdmin
                          ? "rgba(49, 94, 251, 0.12)"
                          : isManager
                          ? "rgba(13, 148, 136, 0.12)"
                          : "rgba(22, 163, 106, 0.12)",
                        color: isSuperAdmin
                          ? "var(--color-primary)"
                          : isManager
                          ? "#0D9488"
                          : "var(--color-success)"
                      }}
                    >
                      {isSuperAdmin ? "Super Admin" : isManager ? "Store Manager" : "Customer"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileDrawerOpen(false);
                        openEditModal();
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ height: "28px", padding: "0 10px", fontSize: "0.75rem", gap: "4px" }}
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Navigation Links */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Link
                  to="/products"
                  className="mobile-nav-link"
                  onClick={() => setIsMobileDrawerOpen(false)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Store size={18} />
                    <span>Store</span>
                  </div>
                </Link>

                {!isStaff && (
                  <>
                    <Link
                      to="/wishlist"
                      className="mobile-nav-link"
                      onClick={() => setIsMobileDrawerOpen(false)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Heart size={18} />
                        <span>Wishlist</span>
                      </div>
                      {wishlist.length > 0 && (
                        <span className="nav-badge wishlist-badge">{wishlist.length}</span>
                      )}
                    </Link>

                    <Link
                      to="/cart"
                      className="mobile-nav-link"
                      onClick={() => setIsMobileDrawerOpen(false)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <ShoppingBag size={18} />
                        <span>Shopping Bag</span>
                      </div>
                      {totalItems > 0 && <span className="nav-badge">{totalItems}</span>}
                    </Link>

                    {token && (
                      <Link
                        to="/orders"
                        className="mobile-nav-link"
                        onClick={() => setIsMobileDrawerOpen(false)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <Package size={18} />
                          <span>My Orders</span>
                        </div>
                      </Link>
                    )}
                  </>
                )}

                {isStaff && (
                  <>
                    <Link
                      to="/admin/orders"
                      className="mobile-nav-link"
                      onClick={() => setIsMobileDrawerOpen(false)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Package size={18} />
                        <span>Store Orders Pipeline</span>
                      </div>
                    </Link>
                    <Link
                      to="/admin/dashboard"
                      className="mobile-nav-link"
                      onClick={() => setIsMobileDrawerOpen(false)}
                      style={{
                        backgroundColor: isSuperAdmin ? "var(--color-primary-light)" : "rgba(13, 148, 136, 0.12)",
                        color: isSuperAdmin ? "var(--color-primary)" : "#0D9488",
                        borderColor: isSuperAdmin ? "var(--color-primary)" : "#0D9488"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Shield size={18} />
                        <span>{isSuperAdmin ? "Admin Portal" : "Manager Portal"}</span>
                      </div>
                    </Link>
                  </>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid var(--color-border)" }}>
                {token ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      handleLogout();
                    }}
                    className="btn btn-danger btn-sm"
                    style={{ width: "100%", height: "40px", fontSize: "0.9rem", gap: "8px" }}
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <Link
                      to="/login"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIsMobileDrawerOpen(false)}
                      style={{ height: "40px", fontSize: "0.9rem", justifyContent: "center", gap: "8px" }}
                    >
                      <LogIn size={16} />
                      <span>Login to Account</span>
                    </Link>
                    <Link
                      to="/signup"
                      className="btn btn-primary btn-sm"
                      onClick={() => setIsMobileDrawerOpen(false)}
                      style={{ height: "40px", fontSize: "0.9rem", justifyContent: "center", gap: "8px" }}
                    >
                      <UserPlus size={16} />
                      <span>Create Account</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !editLoading && setIsEditModalOpen(false)}
        title="Edit Profile Information"
        maxWidth="480px"
      >
        <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {editError && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(220, 38, 38, 0.1)",
                color: "var(--color-error)",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <AlertCircle size={16} />
              <span>{editError}</span>
            </div>
          )}

          {editSuccess && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(22, 163, 106, 0.1)",
                color: "var(--color-success)",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <CheckCircle2 size={16} />
              <span>{editSuccess}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "var(--color-text-primary)", marginBottom: "6px" }}>
              Full Name *
            </label>
            <div style={{ position: "relative" }}>
              <User size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
              <input
                type="text"
                className="form-control"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                placeholder="Enter full name"
                style={{ paddingLeft: "38px" }}
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "var(--color-text-primary)", marginBottom: "6px" }}>
              Email Address *
            </label>
            <div style={{ position: "relative" }}>
              <Mail size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
              <input
                type="email"
                className="form-control"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
                placeholder="email@example.com"
                style={{ paddingLeft: "38px" }}
              />
            </div>
          </div>

          {/* Customer Details Divider */}
          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "14px", marginTop: "2px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)", display: "block", marginBottom: "12px" }}>
              Customer Details
            </span>

            {/* Phone Number */}
            <div className="form-group" style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "var(--color-text-primary)", marginBottom: "6px" }}>
                Phone Number (10 digits)
              </label>
              <div style={{ position: "relative" }}>
                <Phone size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
                <input
                  type="tel"
                  maxLength={10}
                  className="form-control"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, "") })}
                  placeholder="9876543210"
                  style={{ paddingLeft: "38px" }}
                />
              </div>
            </div>

            {/* Country & Age (2 Columns) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "var(--color-text-primary)", marginBottom: "6px" }}>
                  Country
                </label>
                <div style={{ position: "relative" }}>
                  <Globe size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.country}
                    onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                    placeholder="e.g. India"
                    style={{ paddingLeft: "38px" }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "var(--color-text-primary)", marginBottom: "6px" }}>
                  Age
                </label>
                <div style={{ position: "relative" }}>
                  <Calendar size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
                  <input
                    type="number"
                    min="18"
                    max="120"
                    className="form-control"
                    value={editForm.age}
                    onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                    placeholder="Age"
                    style={{ paddingLeft: "38px" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="btn btn-secondary btn-sm"
              disabled={editLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={editLoading}
            >
              {editLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default Navbar;