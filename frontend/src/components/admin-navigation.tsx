import { NavLink } from "react-router-dom";

export default function AdminNavigation() {
  return (
    <nav className="admin-navigation" aria-label="Administration">
      <NavLink to="/admin/users">Users</NavLink>
      <NavLink to="/admin/pictures">Pictures</NavLink>
    </nav>
  );
}
