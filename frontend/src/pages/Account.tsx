import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { api } from "../lib/api";

type Notice = { kind: "success" | "error"; text: string } | null;

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function Account() {
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [deleteError, setDeleteError] = useState("");
  const [busy, setBusy] = useState("");

  if (loading) return <main className="auth-page"><p>Loading account…</p></main>;
  if (!user) return <Navigate to="/login" state={{ from: "/account" }} replace />;

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("profile");
    setProfileNotice(null);
    const data = new FormData(event.currentTarget);
    try {
      const result = await api.updateProfile(String(data.get("username")), String(data.get("email")));
      setUser(result.user);
      setProfileNotice({ kind: "success", text: "Profile updated." });
    } catch (error) {
      setProfileNotice({ kind: "error", text: messageFrom(error) });
    } finally {
      setBusy("");
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("password");
    setPasswordNotice(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword"));
    if (newPassword !== String(data.get("confirmPassword"))) {
      setPasswordNotice({ kind: "error", text: "New passwords do not match." });
      setBusy("");
      return;
    }
    try {
      await api.updatePassword(String(data.get("currentPassword")), newPassword);
      form.reset();
      setPasswordNotice({ kind: "success", text: "Password updated. Other sessions were signed out." });
    } catch (error) {
      setPasswordNotice({ kind: "error", text: messageFrom(error) });
    } finally {
      setBusy("");
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm("Permanently delete your Shkermit account? This cannot be undone.")) return;
    setBusy("delete");
    setDeleteError("");
    const data = new FormData(event.currentTarget);
    try {
      await api.deleteAccount(String(data.get("password")));
      setUser(null);
      navigate("/", { replace: true });
    } catch (error) {
      setDeleteError(messageFrom(error));
      setBusy("");
    }
  }

  return (
    <main className="account-page">
      <div className="account-heading">
        <p className="auth-eyebrow">Signed in as {user.username}</p>
        <h1>Account settings</h1>
        <p>Member since {new Date(user.createdAt.replace(" ", "T") + "Z").toLocaleDateString()}.</p>
      </div>

      <section className="settings-card">
        <h2>Profile</h2>
        <form onSubmit={updateProfile}>
          {profileNotice && <div className={`form-message form-${profileNotice.kind}`}>{profileNotice.text}</div>}
          <label>Username<input name="username" defaultValue={user.username} minLength={3} maxLength={24} required /></label>
          <label>Email<input name="email" type="email" defaultValue={user.email} required /></label>
          <button className="primary-button" disabled={busy === "profile"}>Save profile</button>
        </form>
      </section>

      <section className="settings-card">
        <h2>Change password</h2>
        <form onSubmit={updatePassword}>
          {passwordNotice && <div className={`form-message form-${passwordNotice.kind}`}>{passwordNotice.text}</div>}
          <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={10} required /></label>
          <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required /></label>
          <button className="primary-button" disabled={busy === "password"}>Change password</button>
        </form>
      </section>

      <section className="settings-card danger-zone">
        <h2>Delete account</h2>
        <p>This permanently removes your profile and all active sessions.</p>
        <form onSubmit={deleteAccount}>
          {deleteError && <div className="form-message form-error">{deleteError}</div>}
          <label>Confirm your password<input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="danger-button" disabled={busy === "delete"}>Delete my account</button>
        </form>
      </section>
    </main>
  );
}
