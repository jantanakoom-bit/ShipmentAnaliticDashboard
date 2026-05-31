import { useEffect, useState, useMemo } from "react";
import { apiRequest } from "../lib/api";

export default function AdminPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    password: "",
    role: "user",
  });
  const [message, setMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "active").length;
    const admins = users.filter((u) => u.role === "admin").length;
    const disabled = users.filter((u) => u.status === "disabled").length;
    return { total, active, admins, disabled };
  }, [users]);

  function showToast(msg) {
    setMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await apiRequest("/api/admin/users");
      setUsers(data.users || []);
    } catch (error) {
      showToast(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    try {
      await apiRequest("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ username: "", displayName: "", password: "", role: "user" });
      await loadUsers();
      showToast("User created successfully");
    } catch (error) {
      showToast(error.message);
    }
  }

  async function patchUser(user, patch) {
    try {
      await apiRequest(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await loadUsers();
      showToast("User updated successfully");
    } catch (error) {
      showToast(error.message);
    }
  }

  async function resetPassword(user) {
    const password = window.prompt(`New password for ${user.username}`);
    if (!password) return;
    await patchUser(user, { password });
  }

  if (currentUser?.role !== "admin") {
    return (
      <div className="page-admin">
        <div className="admin-header">
          <div>
            <div className="admin-title">Access Denied</div>
            <div className="admin-sub">You do not have permission to view this page.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-admin">
      <div className={`msg-toast${toastVisible ? " show" : ""}`}>
        {message}
      </div>

      <div className="admin-header">
        <div>
          <div className="admin-title">User Management</div>
          <div className="admin-sub">Manage Google Sheet users and access status</div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#dbeafe", color: "#1d4ed8" }}>&#x1F465;</div>
          <div>
            <div className="stat-label">Total Users</div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-sub">Registered accounts</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#d1fae5", color: "#065f46" }}>&#x2705;</div>
          <div>
            <div className="stat-label">Active</div>
            <div className="stat-value">{stats.active}</div>
            <div className="stat-sub">Currently enabled</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#fef3c7", color: "#92400e" }}>&#x1F511;</div>
          <div>
            <div className="stat-label">Admins</div>
            <div className="stat-value">{stats.admins}</div>
            <div className="stat-sub">Full access</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#fee2e2", color: "#991b1b" }}>&#x1F6AB;</div>
          <div>
            <div className="stat-label">Disabled</div>
            <div className="stat-value">{stats.disabled}</div>
            <div className="stat-sub">Access revoked</div>
          </div>
        </div>
      </div>

      <div className="form-card">
        <div className="form-title">Add New User</div>
        <form className="form-row" onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. john.doe"
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. John Doe"
              value={form.displayName}
              onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Initial password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select
              className="form-select"
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button className="btn btn-primary" type="submit">Add User</button>
        </form>
      </div>

      <div className="table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Display Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>Loading users...</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 600 }}>{user.username}</td>
                    <td>{user.displayName || "-"}</td>
                    <td>
                      <span className={`role-badge role-${user.role}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${user.status}`}>
                        <span className="status-dot" />
                        {user.status === "active" ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td>{user.lastLoginAt || "-"}</td>
                    <td>
                      <div className="actions">
                        <button
                          className="btn-sm btn-role"
                          type="button"
                          onClick={() => patchUser(user, { role: user.role === "admin" ? "user" : "admin" })}
                        >
                          Role
                        </button>
                        <button
                          className="btn-sm btn-reset"
                          type="button"
                          onClick={() => resetPassword(user)}
                        >
                          Reset
                        </button>
                        <button
                          className={`btn-sm ${user.status === "active" ? "btn-disable" : "btn-enable"}`}
                          type="button"
                          onClick={() => patchUser(user, { status: user.status === "active" ? "disabled" : "active" })}
                        >
                          {user.status === "active" ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
