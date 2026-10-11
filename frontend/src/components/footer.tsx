import { Link } from "react-router-dom";
import logo from "../assets/img/1 ShkermitRTX.png";

const linkGroups = [
  {
    title: "Connect",
    links: [
      { label: "Instagram", href: "https://www.instagram.com/shkermit/" },
      { label: "Ethann.ch", href: "https://ethann.ch" },
    ],
  },
  {
    title: "Media",
    links: [
      { label: "Jellyseerr", href: "https://jellyseerr.shkermit.ch/" },
      { label: "Jellyfin", href: "https://jellyfin.shkermit.ch/" },
      { label: "Music", href: "https://music.shkermit.ch/" },
    ],
  },
  {
    title: "Code & projects",
    links: [
      { label: "Shkermit Git", href: "https://git.shkermit.ch/" },
      { label: "Shkermit on GitHub", href: "https://github.com/EthannSchneider/Shkermit" },
      { label: "Compagnie Hydromel", href: "https://github.com/Compagnie-Hydromel" },
    ],
  },
];

function Footer() {
  return (
    <footer className="relative z-10 w-full border-t border-green-700 bg-green-900 px-6 pt-12 pb-6 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-3 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green-200"
            >
              <img src={logo} alt="" className="h-12 w-12 rounded-full" />
              <span className="text-xl font-bold">Shkermit</span>
            </Link>
            <p className="mt-4 max-w-xs font-sans text-sm leading-relaxed text-green-100">
              Games, pictures, music, and a little bit of Shkermit. Explore the rest of the world here.
            </p>
          </div>

          {linkGroups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="mb-4 text-sm text-green-200">{group.title}</h2>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded py-1 font-sans text-base text-green-50 transition-colors hover:text-green-200 hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green-200"
                    >
                      {link.label}
                      <span aria-hidden="true" className="text-green-300">↗</span>
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 border-t border-green-700 pt-6 font-sans text-sm text-green-100">
          <p>&copy; {new Date().getFullYear()} Ethann Schneider. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
