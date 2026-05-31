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
            <input
              className="auth-input"
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input
              className="auth-input"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <div className="remember-row">
            <label className="remember-label">
              <input type="checkbox" defaultChecked />
              Remember me
            </label>
            <a className="forgot-link" href="#login-help">Forgot password?</a>
          </div>
          {error ? <p className="auth-error">{error}</p> : null}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <div className="auth-divider">secure access</div>
        <div className="demo-hint" id="login-help">
          Use your assigned ShipTrack account to continue.
        </div>
      </section>
    </main>
  );
}
