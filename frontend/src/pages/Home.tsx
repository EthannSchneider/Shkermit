import { useTranslation } from 'react-i18next';
import { Link } from "react-router-dom";
import shkermit from "../assets/img/1 ShkermitRTX.png";
import shkermitHead from "../assets/img/3 TeteShkermit RTX.png";
import icedTea from "../assets/img/9 ShkermitDrinkIceTea.png";
import "./home.css";

const games = [
  {
    name: "Shkermit Clicker",
    path: "/games/clicker",
    category: "Click. Upgrade. Repeat.",
    description: "Turn a few clicks into a whole lot of Shkermites.",
    artwork: "clicker",
  },
  {
    name: "Snake",
    path: "/games/snake",
    category: "An old-school classic",
    description: "One more bite. One more turn. Just don’t hit the wall.",
    artwork: "snake",
  },
  {
    name: "Shkermit Stacks",
    path: "/games/tetris",
    category: "Solo, co-op & versus",
    description: "Find your rhythm, clear the board, or challenge a friend.",
    artwork: "stacks",
  },
];

const snakeCells = [31, 32, 33, 34, 44, 54, 64, 65, 66];
const stackCells = [
  "", "", "", "", "", "", "", "",
  "", "", "", "", "", "", "", "",
  "", "", "", "", "", "lime", "", "",
  "", "", "", "", "lime", "lime", "lime", "",
  "", "", "", "", "", "", "", "",
  "", "", "", "", "", "", "", "",
  "", "", "pink", "pink", "", "", "", "",
  "", "", "pink", "pink", "", "", "blue", "",
  "orange", "orange", "orange", "", "", "", "blue", "",
  "orange", "", "lime", "lime", "lime", "", "blue", "blue",
  "blue", "blue", "blue", "blue", "lime", "", "pink", "pink",
];

function GameArtwork({ kind }: { kind: string }) {
  const { t } = useTranslation();
  if (kind === "clicker") {
    return (
      <div className="home-game-art home-clicker-art" aria-hidden="true">
        <span className="home-click-count">{t("+1 Shkermite")}</span>
        <img src={shkermitHead} alt="" loading="lazy" />
        <svg className="home-cursor" viewBox="0 0 32 40" fill="none">
          <path d="M3 3v29l8-8 6 13 7-3-6-12h11L3 3Z" fill="#f7f7ed" stroke="#17231b" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  if (kind === "snake") {
    return (
      <div className="home-game-art home-snake-art" aria-hidden="true">
        <div className="home-snake-board">
          {Array.from({ length: 100 }, (_, cell) => (
            <span
              key={cell}
              className={snakeCells.includes(cell) ? `home-snake-cell${cell === 66 ? " home-snake-head" : ""}` : cell === 38 ? "home-snake-food" : ""}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="home-game-art home-stacks-art" aria-hidden="true">
      <div className="home-stacks-board">
        {stackCells.map((color, cell) => <span key={cell} className={color ? `home-block home-block-${color}` : ""} />)}
      </div>
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  return (
    <main className="home-page">
      <div className="home-container">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <p className="home-eyebrow"><span className="home-pixel-star" aria-hidden="true">✳</span> {t("Welcome to the Shkermiverse")}</p>
            <h1 id="home-title">{t("A little weird.")}<br />{t("A lot of")} <span>{t("Shkermit.")}</span></h1>
            <p className="home-intro">{t("A small corner of the internet for big distractions. Play a game, explore the collection, or settle in with some music.")}</p>
            <div className="home-hero-actions">
              <Link className="home-button" to="/games">{t("Let’s play")} <span aria-hidden="true">→</span></Link>
              <Link className="home-button home-button-secondary" to="/pictures">{t("Explore the gallery")}</Link>
            </div>
            <p className="home-hero-note">{t("Made by Ethann. Powered by questionable ideas.")}</p>
          </div>

          <div className="home-hero-art">
            <div className="home-art-topline"><span>{t("THE ORIGINAL")}</span><span aria-hidden="true">✳</span></div>
            <span className="home-art-word" aria-hidden="true">{t("SHKERMIT")}</span>
            <img src={shkermit} alt={t("Shkermit, the smiling green mascot")} fetchPriority="high" />
            <span className="home-art-sticker">100%<br />{t("Shkermit")}</span>
            <div className="home-art-caption"><span>{t("A familiar face. Sort of.")}</span><span>{t("SHKERMIT.CH")}</span></div>
          </div>
        </section>

        <section className="home-arcade" aria-labelledby="home-arcade-title">
          <div className="home-section-heading">
            <div><p className="home-eyebrow">{t("01 / The arcade")}</p><h2 id="home-arcade-title">{t("Your next little obsession.")}</h2></div>
            <Link className="home-text-link" to="/games/stats">{t("Score boards")} <span aria-hidden="true">→</span></Link>
          </div>
          <div className="home-game-grid">
            {games.map((game) => (
              <Link className="home-game-card" to={game.path} key={game.path}>
                <GameArtwork kind={game.artwork} />
                <div className="home-game-copy">
                  <p className="home-card-eyebrow">{t(game.category)}</p>
                  <h3>{t(game.name)}</h3>
                  <p className="home-card-description">{t(game.description)}</p>
                  <span className="home-card-action">{t("Play now")} <span aria-hidden="true">→</span></span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-gallery-feature" aria-labelledby="home-gallery-title">
          <div className="home-gallery-image">
            <img src={icedTea} alt={t("Shkermit enjoying a glass of iced tea")} loading="lazy" />
            <span className="home-gallery-sticker">{t("A little")}<br />{t("culture.")}</span>
          </div>
          <div className="home-gallery-copy">
            <p className="home-eyebrow">{t("02 / The collection")}</p>
            <h2 id="home-gallery-title">{t("Many faces.")}<br />{t("One Shkermit.")}</h2>
            <p>{t("The original, the remixes, and everything in between. Take a look through the wonderfully strange world of Shkermit pictures.")}</p>
            <Link className="home-button" to="/pictures">{t("Into the gallery")} <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <br/>
      </div>
    </main>
  );
}
