import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { api } from "../lib/api";

type VerificationState = "waiting" | "verifying" | "verified" | "error";

export default function VerifyEmail() {
  const { user, verifyEmail } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const initialEmail = searchParams.get("email") ?? "";
  const attemptedToken = useRef(false);
  const [state, setState] = useState<VerificationState>(token ? "verifying" : "waiting");
  const [message, setMessage] = useState(
    token ? "Confirming your email…" : "We sent you a confirmation link.",
  );
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token || attemptedToken.current) return;
    attemptedToken.current = true;
    verifyEmail(token)
      .then(() => {
        setState("verified");
        setMessage("Your email is confirmed and you are now signed in.");
      })
      .catch((error: unknown) => {
        setState("error");
        setMessage(error instanceof Error ? error.message : "The confirmation link could not be verified.");
      });
  }, [token, verifyEmail]);

  if (user?.emailVerified && !token) {
    return <Navigate to="/account" replace />;
  }

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResending(true);
    const data = new FormData(event.currentTarget);
    try {
      const result = await api.resendVerification(String(data.get("email")));
      setState("waiting");
      setMessage(result.message);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not request another email.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-eyebrow">Email confirmation</p>
        <h1>{state === "verified" ? "Email confirmed" : "Check your inbox"}</h1>
        <div
          className={`form-message ${state === "error" ? "form-error" : "form-success"}`}
          role="status"
        >
          {message}
        </div>

        {state === "verified" ? (
          <Link className="primary-button button-link" to="/account">Continue to your account</Link>
        ) : state !== "verifying" ? (
          <form onSubmit={resend}>
            <label>
              Email address
              <input name="email" type="email" defaultValue={initialEmail} autoComplete="email" required />
            </label>
            <button className="primary-button" disabled={resending}>
              {resending ? "Sending…" : "Resend confirmation email"}
            </button>
          </form>
        ) : null}

        <p className="auth-switch"><Link to="/login">Back to login</Link></p>
      </section>
    </main>
  );
}
