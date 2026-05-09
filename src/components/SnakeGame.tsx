import { useEffect, useRef, useState, useCallback } from 'react';
import './SnakeGame.css';

const CELL = 28;
const COLS = 20;
const ROWS = 20;

type SpeedKey = 'slow' | 'medium' | 'fast' | 'turbo';
const SPEEDS: Record<SpeedKey, { label: string; ms: number }> = {
  slow:   { label: 'Slow',   ms: 300 },
  medium: { label: 'Medium', ms: 180 },
  fast:   { label: 'Fast',   ms: 100 },
  turbo:  { label: 'Turbo',  ms: 55  },
};

type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Point = { x: number; y: number };

function randomFood(snake: Point[]): Point {
  let food: Point;
  do {
    food = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    };
  } while (snake.some((s) => s.x === food.x && s.y === food.y));
  return food;
}

function move(head: Point, dir: Dir): Point {
  switch (dir) {
    case 'UP':    return { x: head.x, y: head.y - 1 };
    case 'DOWN':  return { x: head.x, y: head.y + 1 };
    case 'LEFT':  return { x: head.x - 1, y: head.y };
    case 'RIGHT': return { x: head.x + 1, y: head.y };
  }
}

const OPPOSITE: Record<Dir, Dir> = {
  UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
};

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const snakeRef  = useRef<Point[]>([{ x: 10, y: 10 }]);
  const dirRef    = useRef<Dir>('RIGHT');
  const nextRef   = useRef<Dir>('RIGHT');
  const foodRef   = useRef<Point>(randomFood(snakeRef.current));
  const scoreRef  = useRef(0);
  const aliveRef  = useRef(true);
  const startedRef = useRef(false);

  const [score, setScore]     = useState(0);
  const [dead, setDead]       = useState(false);
  const [started, setStarted] = useState(false);
  const [speed, setSpeed]     = useState<SpeedKey>('medium');

  // touch tracking
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const reset = useCallback(() => {
    snakeRef.current  = [{ x: 10, y: 10 }];
    dirRef.current    = 'RIGHT';
    nextRef.current   = 'RIGHT';
    foodRef.current   = randomFood(snakeRef.current);
    scoreRef.current  = 0;
    aliveRef.current  = true;
    startedRef.current = true;
    setScore(0);
    setDead(false);
    setStarted(true);
  }, []);

  // draw a single frame
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = COLS * CELL;
    const H = ROWS * CELL;

    // background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    // grid (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke();
    }

    // food
    const f = foodRef.current;
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(
      f.x * CELL + CELL / 2,
      f.y * CELL + CELL / 2,
      CELL / 2 - 2,
      0, Math.PI * 2
    );
    ctx.fill();

    // snake body
    const snake = snakeRef.current;
    snake.forEach((seg, i) => {
      const isHead = i === 0;
      ctx.fillStyle = isHead ? '#27ae60' : '#2ecc71';
      const padding = isHead ? 1 : 2;
      ctx.beginPath();
      ctx.roundRect(
        seg.x * CELL + padding,
        seg.y * CELL + padding,
        CELL - padding * 2,
        CELL - padding * 2,
        isHead ? 6 : 3
      );
      ctx.fill();
    });

    // face on head
    if (snake.length > 0) {
      const h = snake[0];
      const hx = h.x * CELL;
      const hy = h.y * CELL;
      const dir = dirRef.current;

      // tongue — sticks out from the front edge
      const stemLen  = CELL * 0.42;
      const forkLen  = CELL * 0.22;
      const forkSpread = CELL * 0.16;
      // base of tongue (center of front edge)
      const tb = {
        RIGHT: { x: hx + CELL,     y: hy + CELL / 2, dx: 1,  dy: 0  },
        LEFT:  { x: hx,            y: hy + CELL / 2, dx: -1, dy: 0  },
        UP:    { x: hx + CELL / 2, y: hy,            dx: 0,  dy: -1 },
        DOWN:  { x: hx + CELL / 2, y: hy + CELL,     dx: 0,  dy: 1  },
      }[dir];
      const midX = tb.x + tb.dx * stemLen;
      const midY = tb.y + tb.dy * stemLen;
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tb.x, tb.y);
      ctx.lineTo(midX, midY);
      ctx.stroke();
      // fork tips (perpendicular spread)
      const px = tb.dy;   // perp x = dy of direction
      const py = tb.dx;   // perp y = dx of direction
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(midX + tb.dx * forkLen + px * forkSpread, midY + tb.dy * forkLen + py * forkSpread);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(midX + tb.dx * forkLen - px * forkSpread, midY + tb.dy * forkLen - py * forkSpread);
      ctx.stroke();

      // eyes — two white circles with dark pupils, near the front of the head
      const eyeR   = CELL * 0.135;
      const pupilR = eyeR * 0.55;
      const eyeOffset = CELL * 0.22;
      const eyeSpread = CELL * 0.22;
      const eyePairs: Record<Dir, [number, number, number, number][]> = {
        RIGHT: [[hx + CELL - eyeOffset * 2, hy + CELL / 2 - eyeSpread, 1, 0],
                [hx + CELL - eyeOffset * 2, hy + CELL / 2 + eyeSpread, 1, 0]],
        LEFT:  [[hx + eyeOffset * 2,        hy + CELL / 2 - eyeSpread, -1, 0],
                [hx + eyeOffset * 2,        hy + CELL / 2 + eyeSpread, -1, 0]],
        UP:    [[hx + CELL / 2 - eyeSpread, hy + eyeOffset * 2,        0, -1],
                [hx + CELL / 2 + eyeSpread, hy + eyeOffset * 2,        0, -1]],
        DOWN:  [[hx + CELL / 2 - eyeSpread, hy + CELL - eyeOffset * 2, 0, 1],
                [hx + CELL / 2 + eyeSpread, hy + CELL - eyeOffset * 2, 0, 1]],
      };
      eyePairs[dir].forEach(([cx, cy, pdx, pdy]) => {
        // white
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx, cy, eyeR, 0, Math.PI * 2);
        ctx.fill();
        // pupil (shifted toward front)
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(cx + pdx * eyeR * 0.35, cy + pdy * eyeR * 0.35, pupilR, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, []);

  // game tick
  const tick = useCallback(() => {
    if (!aliveRef.current) return;

    dirRef.current = nextRef.current;
    const head = move(snakeRef.current[0], dirRef.current);

    // wall collision
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      aliveRef.current = false;
      setDead(true);
      return;
    }
    // self collision
    if (snakeRef.current.some((s) => s.x === head.x && s.y === head.y)) {
      aliveRef.current = false;
      setDead(true);
      return;
    }

    const ate = head.x === foodRef.current.x && head.y === foodRef.current.y;
    const newSnake = [head, ...snakeRef.current];
    if (!ate) newSnake.pop();

    snakeRef.current = newSnake;

    if (ate) {
      foodRef.current = randomFood(newSnake);
      scoreRef.current += 10;
      setScore(scoreRef.current);
    }

    draw();
  }, [draw]);

  // game loop — restarts whenever speed changes
  useEffect(() => {
    if (!started) { draw(); return; }
    const id = setInterval(tick, SPEEDS[speed].ms);
    return () => clearInterval(id);
  }, [started, speed, tick, draw]);

  // keyboard
  useEffect(() => {
    const MAP: Record<string, Dir> = {
      ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
      w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
    };
    const onKey = (e: KeyboardEvent) => {
      const d = MAP[e.key];
      if (!d) return;
      e.preventDefault();
      if (!startedRef.current) { reset(); return; }
      if (d !== OPPOSITE[dirRef.current]) nextRef.current = d;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reset]);

  // touch
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      if (!startedRef.current) reset();
      return;
    }
    let d: Dir;
    if (Math.abs(dx) > Math.abs(dy)) {
      d = dx > 0 ? 'RIGHT' : 'LEFT';
    } else {
      d = dy > 0 ? 'DOWN' : 'UP';
    }
    if (!startedRef.current) { reset(); return; }
    if (d !== OPPOSITE[dirRef.current]) nextRef.current = d;
  };

  // D-pad button handler
  const press = (d: Dir) => {
    if (!startedRef.current) { reset(); return; }
    if (d !== OPPOSITE[dirRef.current]) nextRef.current = d;
  };

  return (
    <div className="game-wrapper">
      <h1 className="game-title">Snake</h1>
      <div className="top-bar">
        <div className="score-board">Score: <span>{score}</span></div>
        <div className="speed-selector">
          {(Object.keys(SPEEDS) as SpeedKey[]).map((key) => (
            <button
              key={key}
              className={`speed-btn${speed === key ? ' active' : ''}`}
              onClick={() => setSpeed(key)}
            >
              {SPEEDS[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          width={COLS * CELL}
          height={ROWS * CELL}
          className="game-canvas"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        />
        {!started && (
          <div className="overlay" onClick={reset}>
            <p>Tap or press any arrow key</p>
            <p className="sub">to start</p>
          </div>
        )}
        {dead && (
          <div className="overlay" onClick={reset}>
            <p className="game-over">Game Over</p>
            <p className="final-score">Score: {score}</p>
            <button className="restart-btn" onClick={reset}>Play Again</button>
          </div>
        )}
      </div>

      {/* On-screen D-pad for mobile */}
      <div className="dpad">
        <button className="dpad-btn up"    onClick={() => press('UP')}>▲</button>
        <div className="dpad-row">
          <button className="dpad-btn left"  onClick={() => press('LEFT')}>◀</button>
          <button className="dpad-btn right" onClick={() => press('RIGHT')}>▶</button>
        </div>
        <button className="dpad-btn down"  onClick={() => press('DOWN')}>▼</button>
      </div>
    </div>
  );
}
