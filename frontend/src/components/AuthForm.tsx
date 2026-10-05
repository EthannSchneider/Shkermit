import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { ApiError } from "../lib/api";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === "register";

  if (!loading && user) return <Navigate to="/account" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const data = new FormData(event.currentTarget);

    try {
      if (isRegister) {
        const password = String(data.get("password"));
        if (password !== String(data.get("confirmPassword"))) {
          throw new Error("Passwords do not match.");
        }
        const result = await register(String(data.get("username")), String(data.get("email")), password);
        navigate(`/verify-email?email=${encodeURIComponent(result.email)}`, { replace: true });
        return;
      } else {
        await login(String(data.get("identifier")), String(data.get("password")));
      }
      const requestedPath = (location.state as { from?: string } | null)?.from;
      navigate(requestedPath ?? "/account", { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "EMAIL_NOT_VERIFIED" && caught.email) {
        navigate(`/verify-email?email=${encodeURIComponent(caught.email)}`);
        return;
      }
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <p className="auth-eyebrow">Shkermit account</p>
        <h1>{isRegister ? "Join the swamp" : "Welcome back"}</h1>
        <p className="auth-intro">
          {isRegister ? "Create an account to make Shkermit yours." : "Log in with your username or email."}
        </p>

        {error && <div className="form-message form-error" role="alert">{error}</div>}

        {isRegister && (
          <label>
            Username
            <input name="username" autoComplete="username" minLength={3} maxLength={24} required />
          </label>
        )}

        <label>
          {isRegister ? "Email" : "Username or email"}
          <input
            name={isRegister ? "email" : "identifier"}
            type={isRegister ? "email" : "text"}
            autoComplete={isRegister ? "email" : "username"}
            required
          />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={isRegister ? 10 : undefined}
            required
          />
        </label>

        {isRegister && (
          <>
            <p className="field-hint">10+ characters with uppercase, lowercase, and a number.</p>
            <label>
              Confirm password
              <input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required />
            </label>
          </>
        )}

        <button className="primary-button" disabled={submitting}>
          {submitting ? "Please wait…" : isRegister ? "Create account" : "Log in"}
        </button>
        <p className="auth-switch">
          {isRegister ? "Already registered?" : "New to Shkermit?"}{" "}
          <Link to={isRegister ? "/login" : "/register"}>
            {isRegister ? "Log in" : "Create an account"}
          </Link>
        </p>
      </form>
    </main>
  );
}
