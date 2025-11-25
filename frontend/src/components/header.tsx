import { useState } from "react";
import logo from "../assets/img/1 ShkermitRTX.png";

export default function Header() {
  const [open, setOpen] = useState(false);

  const MenuItems = [
    { name: "Home", href: "/" },
    { name: "Games", href: "/games" },
    { name: "Pictures", href: "/pictures" },
  ];

  return (
    <header className="flex items-center justify-between p-4 bg-green-900 sticky top-0 z-20">
      <a href="/">
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Shkermit Logo"
            className="h-10 w-10 rounded-full"
          />
          <h1 className="text-2xl font-bold">Shkermit</h1>
        </div>
      </a>

      {/* Desktop nav */}
      <nav className="hidden md:block">
        <ul className="flex gap-4">
          {MenuItems.map((item) => (
            <li key={item.name}>
              <a
                href={item.href}
                className="text-lg text-white hover:underline"
              >
                {item.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile burger button */}
      <button
        className="md:hidden p-2 rounded hover:bg-green-800 focus:outline-none"
        onClick={() => setOpen((s) => !s)}
        aria-label="Toggle menu"
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
      <div
        className={`absolute top-full left-0 right-0 md:hidden bg-green-900 transition-transform transform origin-top ${
          open ? "scale-y-100" : "scale-y-0 pointer-events-none"
        }`}
        style={{ zIndex: 30 }}
      >
        <ul className="flex flex-col gap-2 p-4">
          {MenuItems.map((item) => (
            <li key={item.name}>
              <a
                href={item.href}
                className="block text-lg text-white hover:underline"
                onClick={() => setOpen(false)}
              >
                {item.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
