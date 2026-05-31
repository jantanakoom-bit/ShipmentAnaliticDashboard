import { useState } from "react";

export default function LoginScreen({ error, loading, onSubmit }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({ username, password });
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand">
          <div className="brand-icon">ST</div>
          <div>
            <div className="brand-name">ShipTrack</div>
            <div className="brand-sub">Logistics Intelligence</div>
          </div>
        </div>
        <h1 className="auth-title">Access dashboard</h1>
        <p className="auth-copy">Sign in to review shipment movement and logistics analytics.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Username</span>
            <input className="auth-input" type="text" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input className="auth-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error ? <p className="auth-error">{error}</p> : null}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
