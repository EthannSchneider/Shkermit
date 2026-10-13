import { useTranslation } from 'react-i18next';
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { api } from "../lib/api";
import { BoardWallpaperSettings } from "../components/games/tetris/board-wallpaper-settings";
import ProfilePictureSettings from "../components/profile-picture-settings";

type Notice = { kind: "success" | "error"; text: string } | null;

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function Account() {
  const { t, i18n } = useTranslation();
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [deleteError, setDeleteError] = useState("");
  const [busy, setBusy] = useState("");

  if (loading) return <main className="auth-page"><p>{t("Loading account…")}</p></main>;
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
    if (!window.confirm(t("Permanently delete your Shkermit account? This cannot be undone."))) return;
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
        <p className="auth-eyebrow">{t("Signed in as {{username}}", { username: user.username })}</p>
        <h1>{t("Account settings")}</h1>
        <p>{t("Member since {{date}}.", { date: new Date(user.createdAt).toLocaleDateString(i18n.resolvedLanguage) })}</p>
        {!user.emailVerified && (
          <div className="form-message form-error"> {t("Your new email address is not confirmed.")} {" "}
            <Link to={`/verify-email?email=${encodeURIComponent(user.email)}`}>{t("Resend confirmation")}</Link>
          </div>
        )}
      </div>

      <section className="settings-card">
        <h2>{t("Profile picture")}</h2>
        <ProfilePictureSettings key={user.id} user={user} />
      </section>

      <section className="settings-card">
        <h2>{t("Profile")}</h2>
        <form onSubmit={updateProfile}>
          {profileNotice && <div className={`form-message form-${profileNotice.kind}`}>{t(profileNotice.text)}</div>}
          <label>{t("Username")}<input name="username" defaultValue={user.username} minLength={3} maxLength={24} required /></label>
          <label>{t("Email")}<input name="email" type="email" defaultValue={user.email} required /></label>
          <button className="primary-button" disabled={busy === "profile"}>{t("Save profile")}</button>
        </form>
      </section>

      <section className="settings-card">
        <h2>{t("Board wallpaper")}</h2>
        <BoardWallpaperSettings key={user.id} wallpaper={user.boardWallpaper} allowCustomUpload={user.isAdmin} onSave={async (wallpaper, image) => {
          const result = await api.updateBoardWallpaper(wallpaper, image);
          setUser((current) => current?.id === result.user.id ? { ...current, boardWallpaper: result.user.boardWallpaper } : current);
          return result.user.boardWallpaper;
        }} />
      </section>

      <section className="settings-card">
        <h2>{t("Change password")}</h2>
        <form onSubmit={updatePassword}>
          {passwordNotice && <div className={`form-message form-${passwordNotice.kind}`}>{t(passwordNotice.text)}</div>}
          <label>{t("Current password")}<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <label>{t("New password")}<input name="newPassword" type="password" autoComplete="new-password" minLength={10} required /></label>
          <label>{t("Confirm new password")}<input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required /></label>
          <button className="primary-button" disabled={busy === "password"}>{t("Change password")}</button>
        </form>
      </section>

      <section className="settings-card danger-zone">
        <h2>{t("Delete account")}</h2>
        <p>{t("This permanently removes your profile and all active sessions.")}</p>
        <form onSubmit={deleteAccount}>
          {deleteError && <div className="form-message form-error">{t(deleteError)}</div>}
          <label>{t("Confirm your password")}<input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="danger-button" disabled={busy === "delete"}>{t("Delete my account")}</button>
        </form>
      </section>
    </main>
  );
}
