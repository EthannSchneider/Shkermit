import { useTranslation } from 'react-i18next';
import { NavLink } from "react-router-dom";

export default function AdminNavigation() {
  const { t } = useTranslation();
  return (
    <nav className="admin-navigation" aria-label={t("Administration")}>
      <NavLink to="/admin/users">{t("Users")}</NavLink>
      <NavLink to="/admin/pictures">{t("Pictures")}</NavLink>
    </nav>
  );
}
