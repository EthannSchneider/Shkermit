import { useNavigate } from 'react-router-dom';

type Game = {
  path: string;
  name: string;
  description: string;
  icon: string;
  available: boolean;
};

const games: Game[] = [
  {
    path: '/games/clicker',
    name: 'Shkermit Clicker',
    description: 'Click on Shkermit to earn shkermites! Upgrade your click power and automate your Shkermit production.',
    icon: '🖱️',
    available: true
  },
  {
    path: '/games/snake',
    name: 'Snake',
    description: 'Classic snake game! Guide the snake to eat food and grow longer while avoiding collisions.',
    icon: '🐍',
    available: true
  },
  {
    path: '/games/tetris',
    name: 'Tetris',
    description: 'Classic block-stacking puzzle! Arrange falling tetrominoes to complete lines and score points.',
    icon: '🎮',
    available: false
  },
  {
    path: '/games/pacman',
    name: 'Pac-Man',
    description: 'Maze-chasing classic! Guide Pac-Man through the maze collecting dots while avoiding ghosts.',
    icon: '👻',
    available: false
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

        <div className="mt-16 text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 inline-block max-w-2xl">
            <h3 className="text-2xl font-bold mb-4 text-purple-300">🎮 Available Games</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {games.map((game) => (
                <div
                  key={game.path}
                  onClick={() => {
                    if (game.available) navigate(game.path);
                  }}
                  className="bg-white/5 rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-colors text-center flex flex-col justify-between h-40 w-40"
                >
                  <div className="text-3xl mb-2">{game.icon}</div>
                  <div className="text-sm font-bold">{game.name}</div>
                  <div className={`text-xs font-bold mt-2 px-3 py-1 rounded ${game.available ? 'bg-purple-600' : 'bg-yellow-600'}`}>
                    {game.available ? 'Play Now' : 'Planned'}
                  </div>
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
