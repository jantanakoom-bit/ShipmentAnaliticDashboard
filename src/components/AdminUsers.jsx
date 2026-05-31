import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";

export default function AdminUsers({ onClose }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: "", displayName: "", password: "", role: "user" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await apiRequest("/api/admin/users");
      setUsers(data.users || []);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
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
      setMessage("User created.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function patchUser(user, patch) {
    try {
      await apiRequest(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await loadUsers();
      setMessage("User updated.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function resetPassword(user) {
    const password = window.prompt(`New password for ${user.username}`);
    if (!password) return;
    await patchUser(user, { password });
  }

  return (
    <section className="admin-panel">
      <div className="admin-head">
        <div>
          <div className="top-title">Admin Users</div>
          <div className="chart-sub">Manage Google Sheet users and access status.</div>
        </div>
        <button className="btn-filter btn-all" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <form className="admin-form" onSubmit={handleCreate}>
        <input className="auth-input" placeholder="Username" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} />
        <input className="auth-input" placeholder="Display name" value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} />
        <input className="auth-input" placeholder="Password" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
        <select className="auth-input" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <button className="primary-button" type="submit">
          Add user
        </button>
      </form>

      {message ? <div className="inline-error admin-message">{message}</div> : null}
      {loading ? <div className="status-state admin-state">Loading users...</div> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Display name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.displayName || "-"}</td>
                <td>{user.role}</td>
                <td>{user.status}</td>
                <td>{user.lastLoginAt || "-"}</td>
                <td>
                  <div className="admin-actions">
                    <button className="ms-btn-sa" type="button" onClick={() => patchUser(user, { role: user.role === "admin" ? "user" : "admin" })}>
                      Role
                    </button>
                    <button className="ms-btn-sa" type="button" onClick={() => resetPassword(user)}>
                      Reset
                    </button>
                    <button className="ms-btn-cl" type="button" onClick={() => patchUser(user, { status: user.status === "active" ? "disabled" : "active" })}>
                      {user.status === "active" ? "Disable" : "Enable"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
