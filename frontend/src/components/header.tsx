import { useTranslation } from 'react-i18next';
import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/img/1 ShkermitRTX.png";
import { useAuth } from "../context/auth-context";
import type { User } from "../lib/api";
import ProfileAvatar from "./profile-avatar";

type AccountLinksProps = {
  loading: boolean;
  loggingOut: boolean;
  mobile?: boolean;
  user: User | null;
  logoutError: string;
  onLogout: () => Promise<void>;
  onNavigate: () => void;
};

function AccountLinks({
  loading,
  loggingOut,
  mobile = false,
  user,
  logoutError,
  onLogout,
  onNavigate,
}: AccountLinksProps) {
  const { t } = useTranslation();
  const [accountOpen, setAccountOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setAccountOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);

  function handleNavigate() {
    setAccountOpen(false);
    onNavigate();
  }
  const linkClass = mobile
    ? "block text-lg text-white hover:underline"
    : "text-lg text-white hover:underline";

  if (loading) return null;
  if (user) {
    return (
      <div ref={containerRef} className={`account-menu${mobile ? " account-menu-mobile" : ""}`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false);
        }}>
        <button ref={triggerRef} type="button" className="account-menu-trigger"
          aria-label={t("Account menu for {{username}}", { username: user.username })}
          aria-expanded={accountOpen} aria-controls={menuId}
          onClick={() => setAccountOpen((value) => !value)}>
          <ProfileAvatar src={user.profilePictureUrl} />
          <span className="account-menu-username">{user.username}</span>
          <svg aria-hidden="true" className={`account-menu-chevron${accountOpen ? " is-open" : ""}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="m6 9 6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div id={menuId} className="account-menu-dropdown" hidden={!accountOpen}>
          <Link to="/account" onClick={handleNavigate}>{t("Account settings")}</Link>
          {user.isAdmin && <Link to="/admin/users" onClick={handleNavigate}>{t("Admin settings")}</Link>}
          <button type="button" className="account-menu-logout" onClick={() => void onLogout()} disabled={loggingOut}>
            {loggingOut ? t("Logging out…") : t("Logout")}
          </button>
          {logoutError && <p className="form-message form-error" role="alert">{t(logoutError)}</p>}
        </div>
      </div>
    );
  }

  return (
    <>
      <Link to="/login" className={linkClass} onClick={onNavigate}>{t("Login")}</Link>
      <Link to="/register" className={`${linkClass} account-cta`} onClick={onNavigate}>{t("Register")}</Link>
    </>
  );
}

export default function Header() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const MenuItems = [
    { name: "Home", href: "/" },
    { name: "Games", href: "/games" },
    { name: "Pictures", href: "/pictures" },
  ];

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await logout();
      setOpen(false);
      navigate("/");
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="flex items-center justify-between p-4 bg-green-900 sticky top-0 z-20">
      <Link to="/">
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt={t("Shkermit Logo")}
            className="h-10 w-10 rounded-full"
          />
          <h1 className="text-2xl font-bold">{t("Shkermit")}</h1>
        </div>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden lg:block">
        <ul className="flex items-center gap-4">
          {MenuItems.map((item) => (
            <li key={item.name}>
              <Link
                to={item.href}
                className="text-lg text-white hover:underline"
              >
                {t(item.name)}
              </Link>
            </li>
          ))}
          <li className="flex items-center gap-4">
            <AccountLinks
              key={user?.id ?? "guest"}
              loading={loading}
              loggingOut={loggingOut}
              user={user}
              logoutError={logoutError}
              onLogout={handleLogout}
              onNavigate={() => setOpen(false)}
            />
          </li>
        </ul>
      </nav>

      {/* Mobile burger button */}
      <button
        className="lg:hidden p-2 rounded hover:bg-green-800 focus-visible:outline-2 focus-visible:outline-lime-300"
        onClick={() => setOpen((s) => !s)}
        aria-label={t("Toggle menu")}
        aria-expanded={open}
      >
        {open ? (
          // X icon
          <svg
            className="w-6 h-6 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          // Hamburger icon
          <svg
            className="w-6 h-6 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        )}
      </button>

      {/* Mobile menu */}
      {open && <div
        className="absolute top-full left-0 right-0 lg:hidden bg-green-900"
        style={{ zIndex: 30 }}
      >
        <ul className="flex flex-col gap-2 p-4">
          {MenuItems.map((item) => (
            <li key={item.name}>
              <Link
                to={item.href}
                className="block text-lg text-white hover:underline"
                onClick={() => setOpen(false)}
              >
                {t(item.name)}
              </Link>
            </li>
          ))}
          <li className="flex flex-col items-start gap-2">
            <AccountLinks
              key={user?.id ?? "guest"}
              loading={loading}
              loggingOut={loggingOut}
              mobile
              user={user}
              logoutError={logoutError}
              onLogout={handleLogout}
              onNavigate={() => setOpen(false)}
            />
          </li>
        </ul>
      </div>}
    </header>
  );
}
