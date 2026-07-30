import { useNavigate } from 'react-router-dom';

type Game = {
  path: string;
  name: string;
  description: string;
  icon: string;
};

const games: Game[] = [
  {
    path: '/games/clicker',
    name: 'Shkermit Clicker',
    description: 'Click on Shkermit to earn shkermites! Upgrade your click power and automate your Shkermit production.',
    icon: '🖱️',
  },
];

export default function Games() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-linear-to-b from-purple-900 via-indigo-900 to-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-transparent bg-clip-text bg-linear-to-b from-purple-400 to-pink-500">
          🎮 Game Haven
        </h1>

        <div className="text-center mb-12">
          <p className="text-xl text-gray-300">
            Welcome to our collection of Shkermit-inspired games! Choose a game below to start playing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <div
              key={game.path}
              onClick={() => navigate(game.path)}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl cursor-pointer transition-all duration-200 hover:scale-105 hover:bg-white/20 border border-purple-400/50"
            >
              <div className="text-6xl mb-4 text-center">{game.icon}</div>
              <h2 className="text-2xl font-bold text-center mb-3 text-purple-300">{game.name}</h2>
              <p className="text-gray-300 text-center leading-relaxed">{game.description}</p>
              <div className="mt-4 text-center">
                <span className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold">
                  Play Now →
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 inline-block max-w-2xl">
            <h3 className="text-2xl font-bold mb-4 text-purple-300">🎮 Available Games</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {games.map((game) => (
                <div
                  key={game.path}
                  onClick={() => navigate(game.path)}
                  className="bg-white/5 rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-colors text-center"
                >
                  <div className="text-3xl mb-2">{game.icon}</div>
                  <div className="text-sm font-bold">{game.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-400">
            More games coming soon! Stay tuned! 🚀
          </p>
        </div>
      </div>
    </div>
  );
}
