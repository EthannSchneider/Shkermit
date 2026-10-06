import { useState, useEffect, useCallback, useRef } from 'react';
import shkermitImage from '../../assets/img/1 ShkermitRTX.png';
import { useAuth } from '../../context/auth-context';
import { useBestScore } from '../../hooks/use-best-score';

const getSavedHighScore = () => {
  const value = Number.parseInt(localStorage.getItem('snakeHighScore') ?? '0', 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

export default function SnakeGame() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(getSavedHighScore);
  const { bestScore, recordScore } = useBestScore('snake', 'classic', highScore);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const GRID_SIZE = 25;
  const CANVAS_SIZE = 600;

  const TILE_COUNT = CANVAS_SIZE / GRID_SIZE;

  const [snake, setSnake] = useState<{ x: number; y: number }[]>([{ x: 12, y: 12 }]);
  const [food, setFood] = useState({ x: 18, y: 18 });
  const [direction, setDirection] = useState({ x: 0, y: 0 });
  const [gameStatus, setGameStatus] = useState<'playing' | 'paused' | 'gameover'>('playing');
  const initialLoadRef = useRef(true);
  const highScoreRef = useRef(highScore);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = shkermitImage;
    img.onload = () => {
      imageRef.current = img;
    };
  }, []);

  const generateFood = useCallback(() => {
    const newFood = {
      x: Math.floor(Math.random() * TILE_COUNT),
      y: Math.floor(Math.random() * TILE_COUNT),
    };

    let onSnake = false;
    do {
      newFood.x = Math.floor(Math.random() * TILE_COUNT);
      newFood.y = Math.floor(Math.random() * TILE_COUNT);

       onSnake = snake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
     } while (onSnake);

     return newFood;
   }, [snake, TILE_COUNT]);

   const resetGame = useCallback(() => {
    setSnake([{ x: 10, y: 10 }]);
    setFood(generateFood());
    setScore(0);
    setDirection({ x: 1, y: 0 });
    setGameOver(false);
    setIsPaused(false);
    setGameStatus('playing');
    setGameStarted(true);
    initialLoadRef.current = true;
  }, [generateFood]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
    }

    if (!gameStarted) {
      if (e.key === 'Enter') {
        resetGame();
      }
      return;
    }

    if (gameStatus === 'gameover') {
      if (e.key === 'Enter') {
        resetGame();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (direction.y !== 1) {
          setDirection({ x: 0, y: -1 });
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (direction.y !== -1) {
          setDirection({ x: 0, y: 1 });
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (direction.x !== 1) {
          setDirection({ x: -1, y: 0 });
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (direction.x !== -1) {
          setDirection({ x: 1, y: 0 });
        }
        break;
      case 'p':
      case 'P':
        e.preventDefault();
        setIsPaused(prev => !prev);
        break;
    }
  }, [gameStarted, direction, gameStatus, resetGame]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const gradient = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    gradient.addColorStop(0, '#22c55e');
    gradient.addColorStop(1, '#16a34a');

    snake.forEach((segment, index) => {
      if (index === 0 && imageRef.current) {
        ctx.drawImage(imageRef.current, segment.x * GRID_SIZE, segment.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
      } else {
        ctx.fillStyle = gradient;
        ctx.shadowBlur = 0;

        ctx.fillRect(
          segment.x * GRID_SIZE + 1,
          segment.y * GRID_SIZE + 1,
          GRID_SIZE - 2,
          GRID_SIZE - 2
        );
      }
    });

    ctx.shadowBlur = 0;

    const foodGradient = ctx.createRadialGradient(
      food.x * GRID_SIZE + GRID_SIZE / 2,
      food.y * GRID_SIZE + GRID_SIZE / 2,
      0,
      food.x * GRID_SIZE + GRID_SIZE / 2,
      food.y * GRID_SIZE + GRID_SIZE / 2,
      GRID_SIZE / 2
    );
    foodGradient.addColorStop(0, '#ef4444');
    foodGradient.addColorStop(1, '#dc2626');

    ctx.fillStyle = foodGradient;
    ctx.beginPath();
    ctx.arc(
      food.x * GRID_SIZE + GRID_SIZE / 2,
      food.y * GRID_SIZE + GRID_SIZE / 2,
      GRID_SIZE / 2 - 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }, [snake, food]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleInput = (e: Event) => {
      const event = e as KeyboardEvent;
      handleKeyDown(event);
    };

    document.addEventListener('keydown', handleInput);
    return () => document.removeEventListener('keydown', handleInput);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!gameStarted) return;

    const interval = setInterval(() => {
      if (gameStatus === 'gameover' || isPaused) return;

      const newHead = {
        x: snake[0].x + direction.x,
        y: snake[0].y + direction.y,
      };

      if (newHead.x < 0 || newHead.x >= TILE_COUNT || newHead.y < 0 || newHead.y >= TILE_COUNT) {
        const newGameStatus: 'playing' | 'paused' | 'gameover' = 'gameover';
        setGameStatus(newGameStatus);
        setGameOver(true);

        if (score > highScoreRef.current) {
          highScoreRef.current = score;
          setHighScore(highScoreRef.current);
          localStorage.setItem('snakeHighScore', highScoreRef.current.toString());
        }
        recordScore(score);
        return;
      }

      if (snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        const newGameStatus: 'playing' | 'paused' | 'gameover' = 'gameover';
        setGameStatus(newGameStatus);
        setGameOver(true);

        if (score > highScoreRef.current) {
          highScoreRef.current = score;
          setHighScore(highScoreRef.current);
          localStorage.setItem('snakeHighScore', highScoreRef.current.toString());
        }
        recordScore(score);
        return;
      }

      const newSnake = [newHead, ...snake];
      setSnake(newSnake);

      if (newHead.x === food.x && newHead.y === food.y) {
        setScore(prev => prev + 10);
        setFood(generateFood());
      } else {
        newSnake.pop();
        setSnake(newSnake);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [gameStarted, snake, direction, food, score, gameStatus, isPaused, TILE_COUNT, generateFood, recordScore]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div className="min-h-screen bg-linear-to-b from-green-900 via-emerald-900 to-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-transparent bg-clip-text bg-linear-to-b from-green-400 to-emerald-500">
          🐍 Snake Game
        </h1>

        <div className="flex flex-col lg:flex-row gap-8 justify-center items-start">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-green-400/50">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="rounded-lg shadow-lg"
            />
            {!gameStarted && (
              <div className="text-center mt-4">
                <p className="text-2xl font-bold text-green-400 mb-2">Press Space to Start!</p>
                <p className="text-gray-300">Use arrow keys to move</p>
              </div>
            )}
            {isPaused && gameStatus === 'gameover' && (
              <div className="text-center mt-4">
                <p className="text-2xl font-bold text-yellow-400 mb-2">Game Over!</p>
                {gameOver && (
                  <p className="text-xl text-white">
                    Score: {score} | High Score: {Math.max(highScore, bestScore)}
                  </p>
                )}
                <button
                  onClick={resetGame}
                  className="mt-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold transition-colors"
                >
                  {isPaused ? 'Resume' : 'Play Again'}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 max-w-md">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-green-400/50">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-green-300 mb-4">📊 Score</h2>
                <div className="text-5xl font-bold text-white mb-2">{score}</div>
                <div className="text-xl text-yellow-400">🏆 High Score: {Math.max(highScore, bestScore)}</div>
                {user && <div className="mt-1 text-xs text-green-200">Saved for {user.username}</div>}
              </div>

              <div className="space-y-4 text-gray-300">
                <div>
                  <h3 className="font-bold text-green-300 mb-2">Keyboard Controls:</h3>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div></div>
                    <div className="bg-green-600/20 rounded-lg p-2 text-center">↑</div>
                    <div></div>
                    <div className="bg-green-600/20 rounded-lg p-2 text-center">←</div>
                    <div className="bg-green-600/20 rounded-lg p-2 text-center">↓</div>
                    <div className="bg-green-600/20 rounded-lg p-2 text-center">→</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <span className="text-2xl">⏸️</span>
                  <span className="text-sm">Press P to pause/resume</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🔄</span>
                  <span className="text-sm">Press Enter or P to play again</span>
                </div>
              </div>
            </div>

            <button
              onClick={resetGame}
              disabled={gameOver && !isPaused}
              className="w-full bg-linear-to-b from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-2xl font-bold text-xl transition-all duration-200 shadow-lg hover:shadow-green-500/30 hover:scale-105"
            >
              {gameOver && !isPaused ? 'Press Enter to Play Again' : 'Start New Game'}
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-400">
            Eat the red food to grow! Avoid hitting the walls or your own tail! 🎯
          </p>
        </div>
      </div>
    </div>
  );
}
