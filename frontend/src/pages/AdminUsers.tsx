import { useTranslation } from 'react-i18next';
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import AdminNavigation from "../components/admin-navigation";
import { useAuth } from "../context/auth-context";
import { api, type AdminUser, type AdminUsersResponse } from "../lib/api";
import { BoardWallpaperSettings } from "../components/games/tetris/board-wallpaper-settings";

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "The request failed.";
}

function UserEditor({ user, onSaved, onCancel }: {
  user: AdminUser;
  onSaved: (user: AdminUser, warning?: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await api.updateUser(user.id, String(form.get("username")), String(form.get("email")));
      onSaved(result.user, result.warning);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-card admin-user-editor" aria-labelledby="edit-user-title">
      <h2 id="edit-user-title">{t("Edit")} {user.username}</h2>
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <label>{t("Username")}<input name="username" defaultValue={user.username} minLength={3} maxLength={24} pattern="[a-zA-Z0-9_-]+" autoFocus required /></label>
          <label>{t("Email")}<input name="email" type="email" defaultValue={user.email} maxLength={254} required /></label>
          <p className="field-hint">{t("Changing the email signs out all sessions and sends a new confirmation link. The user must confirm it before logging in again.")}</p>
          {error && <div className="form-message form-error" role="alert">{t(error)}</div>}
          <div className="admin-modal-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>{t("Cancel")}</button>
            <button className="primary-button" type="submit">{busy ? t("Saving…") : t("Save profile")}</button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

export default function AdminUsers() {
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading, setUser } = useAuth();
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ key: string; values?: Record<string, string> } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [wallpaperUser, setWallpaperUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    if (!user?.isAdmin) return;
    let active = true;
    api.listUsers(search, page)
      .then((result) => {
        if (!active) return;
        if (result.users.length === 0 && page > 1) {
          setPage(Math.max(1, Math.ceil(result.total / result.pageSize)));
          return;
        }
        setData(result);
      })
      .catch((caught: unknown) => {
        if (active) {
          setData(null);
          setError(messageFrom(caught));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [user?.isAdmin, search, page, revision]);

  if (authLoading) return <main className="gallery-page"><p className="gallery-status">{t("Checking access…")}</p></main>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAdmin) return <Navigate to="/" replace />;

  function reload() {
    setLoading(true);
    setError("");
    setRevision((value) => value + 1);
  }

  function changePage(nextPage: number) {
    setLoading(true);
    setError("");
    setEditing(null);
    setWallpaperUser(null);
    setPage(nextPage);
  }

  function findUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(draftSearch.trim());
    setPage(1);
    setEditing(null);
    setWallpaperUser(null);
    setNotice(null);
    reload();
  }

  async function resend(target: AdminUser) {
    setBusyId(target.id);
    setNotice(null);
    setError("");
    try {
      await api.resendUserVerification(target.id);
      setNotice({ key: "Confirmation email sent to {{email}}.", values: { email: target.email } });
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(target: AdminUser) {
    if (!window.confirm(t("Permanently delete {{value1}} ({{value2}})? Their account, sessions, and game scores will be removed. This cannot be undone.", { value1: target.username, value2: target.email }))) return;
    setBusyId(target.id);
    setNotice(null);
    setError("");
    try {
      await api.deleteUser(target.id);
      setNotice({ key: "{{username}} was deleted.", values: { username: target.username } });
      reload();
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmEmail(target: AdminUser) {
    if (!window.confirm(t("Manually confirm {{value1}} for {{value2}}? The user will be able to log in without using the email confirmation link. Suspended accounts will remain suspended.", { value1: target.email, value2: target.username }))) return;
    setBusyId(target.id);
    setNotice(null);
    setError("");
    try {
      const result = await api.confirmUserEmail(target.id, target.email);
      setData((current) => current && ({ ...current, users: current.users.map((item) => item.id === target.id ? result.user : item) }));
      setNotice({ key: "Email confirmed for {{username}}.", values: { username: target.username } });
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleSuspension(target: AdminUser) {
    if (!target.isSuspended && !window.confirm(t("Suspend {{value1}}? All sessions will be signed out and login will be blocked until reactivation.", { value1: target.username }))) return;
    setBusyId(target.id);
    setNotice(null);
    setError("");
    try {
      const result = await api.setUserSuspended(target.id, !target.isSuspended);
      setData((current) => current && ({ ...current, users: current.users.map((item) => item.id === target.id ? result.user : item) }));
      setNotice({ key: result.user.isSuspended ? "{{username}} was suspended." : "{{username}} was reactivated.", values: { username: target.username } });
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusyId(null);
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const actionsDisabled = busyId !== null || editing !== null || wallpaperUser !== null || loading;

  return (
    <main className="gallery-page admin-users-page">
      <div className="gallery-heading">
        <div>
          <p className="auth-eyebrow">{t("Administration")}</p>
          <h1>{t("Manage users")}</h1>
          <p className="gallery-status">{t("Find accounts, edit profiles and board wallpapers, suspend users, and manage email confirmation.")}</p>
        </div>
        <Link className="account-cta" to="/account">{t("My account")}</Link>
      </div>
      <div className="admin-users-content">
        <AdminNavigation />
        <form className="admin-user-search" onSubmit={findUsers}>
          <label htmlFor="user-search">{t("Search users")}</label>
          <div>
            <input id="user-search" type="search" placeholder={t("Username or email")} maxLength={254} value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} />
            <button className="secondary-button" disabled={busyId !== null || editing !== null || wallpaperUser !== null}>{t("Search")}</button>
          </div>
        </form>
        <p className="field-hint">{t("Administrator profiles are protected. Board wallpapers can be changed for every account.")}</p>
        {notice && <div className="form-message form-success" role="status">{t(notice.key, notice.values)}</div>}
        {error && <div className="form-message form-error" role="alert">{t(error)} <button type="button" className="underline" onClick={reload} disabled={busyId !== null || editing !== null}>{t("Reload list")}</button></div>}
        {editing && <UserEditor key={editing.id} user={editing} onCancel={() => setEditing(null)} onSaved={(saved, warning) => {
          setEditing(null);
          setNotice({ key: warning ?? "Profile updated for {{username}}.", values: { username: saved.username } });
          reload();
        }} />}
        {wallpaperUser && <section className="settings-card admin-user-editor" aria-labelledby="user-wallpaper-title">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="user-wallpaper-title">{t("Wallpaper for")} {wallpaperUser.username}</h2>
            <button type="button" className="secondary-button" onClick={() => setWallpaperUser(null)}>{t("Done")}</button>
          </div>
          <BoardWallpaperSettings key={wallpaperUser.id} wallpaper={wallpaperUser.boardWallpaper} allowCustomUpload onSave={async (wallpaper, image) => {
            const result = await api.updateUserBoardWallpaper(wallpaperUser.id, wallpaper, image);
            setData((current) => current && ({ ...current, users: current.users.map((item) => item.id === result.user.id ? result.user : item) }));
            setUser((current) => current?.id === result.user.id ? { ...current, boardWallpaper: result.user.boardWallpaper } : current);
            setWallpaperUser((current) => current?.id === result.user.id ? result.user : current);
            return result.user.boardWallpaper;
          }} />
        </section>}
        {loading ? <p className="gallery-status" role="status">{t("Loading users…")}</p> : data && (
          <>
            <p className="gallery-status">{t("accountCount", { count: data.total, formattedCount: data.total.toLocaleString(i18n.resolvedLanguage) })}{search ? t(" matching “{{value1}}”", { value1: search }) : ""}</p>
            {data.users.length === 0 ? <p className="gallery-status">{t("No users found. Try another username or email.")}</p> : (
              <div className="admin-user-table-wrapper">
                <table className="admin-user-table">
                  <caption className="sr-only">{t("Registered users")}</caption>
                  <thead><tr><th scope="col">{t("User")}</th><th scope="col">{t("Status")}</th><th scope="col">{t("Joined")}</th><th scope="col">{t("Wallpaper")}</th><th scope="col">{t("Actions")}</th></tr></thead>
                  <tbody>
                    {data.users.map((target) => (
                      <tr key={target.id}>
                        <td><strong>{target.username}</strong><span className="admin-user-email">{target.email}</span></td>
                        <td><span className={`admin-user-badge ${target.emailVerified ? "verified" : "pending"}`}>{target.emailVerified ? t("Confirmed") : t("Pending email")}</span>{target.isSuspended && <span className="admin-user-badge suspended">{t("Suspended")}</span>}{!target.canManage && <span className="admin-user-email">{t("Protected admin")}{target.id === user.id ? t(" (you)") : ""}</span>}</td>
                        <td><time dateTime={target.createdAt}>{new Date(target.createdAt).toLocaleDateString(i18n.resolvedLanguage)}</time></td>
                        <td><button className="secondary-button" type="button" disabled={actionsDisabled} onClick={() => { setWallpaperUser(target); setError(""); setNotice(null); }}>{t("Wallpaper")}</button></td>
                        <td>{target.canManage ? (
                          <div className="admin-user-actions">
                            <button className="secondary-button" type="button" disabled={actionsDisabled} onClick={() => { setEditing(target); setError(""); setNotice(null); }}>{t("Edit")}</button>
                            {!target.emailVerified && <button className="secondary-button" type="button" disabled={actionsDisabled} onClick={() => void resend(target)}>{t("Resend confirmation")}</button>}
                            {!target.emailVerified && <button className="secondary-button" type="button" disabled={actionsDisabled} onClick={() => void confirmEmail(target)}>{t("Confirm email")}</button>}
                            <button className="secondary-button" type="button" disabled={actionsDisabled} onClick={() => void toggleSuspension(target)}>{target.isSuspended ? t("Reactivate") : t("Suspend")}</button>
                            <button className="danger-button" type="button" disabled={actionsDisabled} onClick={() => void remove(target)}>{t("Delete")}</button>
                            {busyId === target.id && <span role="status">{t("Processing…")}</span>}
                          </div>
                        ) : target.id === user.id ? <Link to="/account" className="field-hint">{t("Account settings")}</Link> : <span className="field-hint">{t("Protected account")}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <nav className="admin-user-pagination" aria-label={t("User list pages")}>
              <button className="secondary-button" type="button" disabled={page <= 1 || actionsDisabled} onClick={() => changePage(page - 1)}>{t("Previous")}</button>
              <span>{t("Page {{page}} of {{pages}}", { page: data.page, pages })}</span>
              <button className="secondary-button" type="button" disabled={page >= pages || actionsDisabled} onClick={() => changePage(page + 1)}>{t("Next")}</button>
            </nav>
          </>
        )}
      </div>
    </main>
  );
}
