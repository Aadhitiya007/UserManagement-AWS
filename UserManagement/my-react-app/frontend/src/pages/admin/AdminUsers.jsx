import { useState, useEffect } from "react";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import PageHeader from "../../components/ui/PageHeader";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import EmptyState from "../../components/ui/EmptyState";
import { TableRowSkeleton } from "../../components/ui/LoadingSkeleton";
import { API_URL } from "../../config/api";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Edit2,
  Trash2
} from "lucide-react";

const ITEMS_PER_PAGE = 20;

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Edit Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    role: "user",
    age: "",
    country: "",
    phone: ""
  });
  const [saveLoading, setSaveLoading] = useState(false);

  // New Staff / Manager Creation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "manager",
    phone: "",
    country: ""
  });
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchUsers(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  async function fetchUsers(query = "") {
    const token = localStorage.getItem("token");
    try {
      setLoading(true);
      const url = query
        ? `${API_URL}/api/users?search=${encodeURIComponent(query)}`
        : `${API_URL}/api/users`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch users");
      setUsers(Array.isArray(data) ? data : data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenEditModal(user) {
    setEditingUser(user);
    setEditFormData({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "user",
      age: user.age || "",
      country: user.country || "",
      phone: user.phone || ""
    });
  }

  async function handleSaveUser(e) {
    e.preventDefault();
    if (!editingUser) return;

    const token = localStorage.getItem("token");
    const userId = editingUser._id || editingUser.id;
    try {
      setSaveLoading(true);
      const res = await fetch(`${API_URL}/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editFormData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update user");

      setUsers(users.map((u) => ((u._id || u.id) === userId ? { ...u, ...editFormData } : u)));
      alert("User account updated successfully!");
      setEditingUser(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleCreateStaff(e) {
    e.preventDefault();
    if (!createFormData.name || !createFormData.email || !createFormData.password) {
      alert("Please fill in Name, Email, and Password.");
      return;
    }

    const token = localStorage.getItem("token");
    try {
      setCreateLoading(true);
      const res = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(createFormData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create staff account");

      alert(`Success! Created ${createFormData.role === "manager" ? "Store Manager" : "Staff"} account for: ${data.user.email}`);
      setIsCreateModalOpen(false);
      setCreateFormData({
        name: "",
        email: "",
        password: "",
        role: "manager",
        phone: "",
        country: ""
      });
      fetchUsers(search);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleDeleteUser(id, name) {
    if (!window.confirm(`Are you sure you want to permanently delete user "${name}"?`)) return;

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete user");

      setUsers(users.filter((u) => (u._id || u.id) !== id));
      alert("User deleted successfully!");
    } catch (err) {
      alert(err.message);
    }
  }

  // Filter users by role
  const filteredUsers = users.filter((u) => {
    if (roleFilter === "all") return true;
    return u.role === roleFilter;
  });

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE) || 1;
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const adminCount = users.filter((u) => u.role === "admin").length;
  const managerCount = users.filter((u) => u.role === "manager").length;
  const customerCount = users.filter((u) => u.role === "user" || !u.role).length;

  return (
    <>
      <Navbar />
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content">
          <PageHeader
            title="User & Staff Management"
            subtitle="Control identity access, customer accounts, and staff roles."
            badge={<Badge variant="info">{users.length} Total Accounts</Badge>}
            actions={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <UserPlus size={16} />
                <span>+ Add Store Manager</span>
              </button>
            }
          />

          {error && (
            <div
              style={{
                padding: "14px",
                backgroundColor: "var(--color-error-light)",
                color: "var(--color-error)",
                borderRadius: "var(--radius-md)",
                marginBottom: "20px"
              }}
            >
              {error}
            </div>
          )}

          {/* Quick Metrics & Filter Bar */}
          <div
            className="card"
            style={{
              padding: "16px 20px",
              marginBottom: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "14px"
            }}
          >
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flex: 1, minWidth: "280px" }}>
              <div style={{ position: "relative", minWidth: "260px", flex: 1 }}>
                <Search
                  size={16}
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50)",
                    color: "var(--color-text-muted)"
                  }}
                />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search users by name, email, country..."
                  style={{ paddingLeft: "38px" }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Filter size={16} color="var(--color-text-muted)" />
                <select
                  className="form-control"
                  style={{ width: "auto" }}
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">All Roles ({users.length})</option>
                  <option value="user">Customers ({customerCount})</option>
                  <option value="manager">Managers ({managerCount})</option>
                  <option value="admin">Super Admins ({adminCount})</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <Badge variant="info">★ {adminCount} Admins</Badge>
              <Badge variant="warning">🛡️ {managerCount} Managers</Badge>
              <Badge variant="success">👤 {customerCount} Customers</Badge>
            </div>
          </div>

          {loading ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Contact</th>
                    <th>Joined</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <TableRowSkeleton cols={6} />
                  <TableRowSkeleton cols={6} />
                  <TableRowSkeleton cols={6} />
                  <TableRowSkeleton cols={6} />
                </tbody>
              </table>
            </div>
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users found"
              description="No user accounts matched your search or role filter criteria."
            />
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Account Name</th>
                      <th>Email Address</th>
                      <th>Role & Permissions</th>
                      <th>Phone / Location</th>
                      <th>Registration Date</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((u) => {
                      const id = u._id || u.id;
                      const initial = (u.name || "U").charAt(0).toUpperCase();

                      return (
                        <tr key={id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <div
                                style={{
                                  width: "36px",
                                  height: "36px",
                                  borderRadius: "50%",
                                  backgroundColor:
                                    u.role === "admin"
                                      ? "var(--color-primary-light)"
                                      : u.role === "manager"
                                      ? "var(--color-warning-light)"
                                      : "var(--color-surface-subtle)",
                                  color:
                                    u.role === "admin"
                                      ? "var(--color-primary)"
                                      : u.role === "manager"
                                      ? "var(--color-warning)"
                                      : "var(--color-text-primary)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: "700",
                                  fontSize: "0.85rem",
                                  border: "1px solid var(--color-border)"
                                }}
                              >
                                {initial}
                              </div>
                              <div>
                                <strong style={{ color: "var(--color-text-primary)", display: "block" }}>
                                  {u.name}
                                </strong>
                                {u.age && (
                                  <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                                    {u.age} years old
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ color: "var(--color-text-primary)" }}>{u.email}</span>
                          </td>
                          <td>
                            <Badge
                              variant={
                                u.role === "admin"
                                  ? "info"
                                  : u.role === "manager"
                                  ? "warning"
                                  : "success"
                              }
                            >
                              {u.role === "admin"
                                ? "★ Super Admin"
                                : u.role === "manager"
                                ? "🛡️ Store Manager"
                                : "Customer"}
                            </Badge>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
                              {u.phone || "No phone"} {u.country ? `• ${u.country}` : ""}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                              <button
                                onClick={() => handleOpenEditModal(u)}
                                className="btn btn-secondary btn-sm"
                                title="Edit Role & Details"
                              >
                                <Edit2 size={13} />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteUser(id, u.name)}
                                className="btn btn-danger btn-sm"
                                title="Delete User"
                              >
                                <Trash2 size={13} />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "12px",
                    marginTop: "24px"
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="btn btn-secondary btn-sm"
                  >
                    ← Previous
                  </button>

                  <span style={{ fontSize: "0.88rem", color: "var(--color-text-secondary)" }}>
                    Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="btn btn-secondary btn-sm"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}

          {/* CREATE STAFF MODAL */}
          <Modal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            title="🛡️ Provision Staff Account"
          >
            <form onSubmit={handleCreateStaff} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. John Doe (Store Lead)"
                  required
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Staff Email Address *</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="e.g. manager@shopiee.com"
                  required
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Account Password *</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Minimum 6 characters"
                  required
                  value={createFormData.password}
                  onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Role *</label>
                <select
                  className="form-control"
                  value={createFormData.role}
                  onChange={(e) => setCreateFormData({ ...createFormData, role: e.target.value })}
                  style={{ fontWeight: "600" }}
                >
                  <option value="manager">🛡️ Store Manager (Operations, Orders, Stock, Coupons)</option>
                  <option value="admin">★ Super Administrator (Full System & Security Access)</option>
                  <option value="user">Customer / User</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label className="form-label">Phone (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="+91..."
                    value={createFormData.phone}
                    onChange={(e) => setCreateFormData({ ...createFormData, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Country (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="India"
                    value={createFormData.country}
                    onChange={(e) => setCreateFormData({ ...createFormData, country: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={createLoading}
                >
                  {createLoading ? "Creating Account..." : "Create Account"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </Modal>

          {/* EDIT USER MODAL */}
          <Modal
            isOpen={Boolean(editingUser)}
            onClose={() => setEditingUser(null)}
            title="✏️ Edit User Details"
          >
            <form onSubmit={handleSaveUser} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Account Role</label>
                <select
                  className="form-control"
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                >
                  <option value="user">User / Customer</option>
                  <option value="manager">Store Manager</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label className="form-label">Age</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editFormData.age}
                    onChange={(e) => setEditFormData({ ...editFormData, age: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editFormData.country}
                    onChange={(e) => setEditFormData({ ...editFormData, country: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={saveLoading}
                >
                  {saveLoading ? "Saving Changes..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        </main>
      </div>
    </>
  );
}

export default AdminUsers;
