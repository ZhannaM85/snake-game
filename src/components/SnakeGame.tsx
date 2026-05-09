import { useEffect, useRef, useState, useCallback } from 'react';
import './SnakeGame.css';

const CELL = 45;
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
type FruitType = 'apple' | 'orange' | 'strawberry' | 'grape' | 'watermelon' | 'lemon';
type Food = Point & { fruit: FruitType };

const FRUITS: FruitType[] = ['apple', 'orange', 'strawberry', 'grape', 'watermelon', 'lemon'];
const FOOD_COUNT = 3;

function randomFood(snake: Point[], others: Point[] = []): Food {
  let pos: Point;
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (
    snake.some((s) => s.x === pos.x && s.y === pos.y) ||
    others.some((o) => o.x === pos.x && o.y === pos.y)
  );
  return { ...pos, fruit: FRUITS[Math.floor(Math.random() * FRUITS.length)] };
}

function initFoods(snake: Point[]): Food[] {
  const foods: Food[] = [];
  for (let i = 0; i < FOOD_COUNT; i++) foods.push(randomFood(snake, foods));
  return foods;
}

// ── fruit drawing helpers ────────────────────────────────────────────────────

function shine(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.28, cy - r * 0.28, r * 0.28, r * 0.17, -Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();
}

function stem(ctx: CanvasRenderingContext2D, cx: number, topY: number) {
  ctx.strokeStyle = '#6d4c41';
  ctx.lineWidth = Math.max(1.5, CELL * 0.055);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + CELL * 0.04, topY);
  ctx.quadraticCurveTo(cx + CELL * 0.15, topY - CELL * 0.18, cx + CELL * 0.12, topY - CELL * 0.26);
  ctx.stroke();
  // leaf
  const lx = cx + CELL * 0.12, ly = topY - CELL * 0.14;
  ctx.fillStyle = '#27ae60';
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.bezierCurveTo(lx + CELL * 0.22, ly - CELL * 0.2, lx + CELL * 0.3, ly + CELL * 0.08, lx, ly + CELL * 0.05);
  ctx.fill();
}

function drawApple(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const g = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.28, r * 0.08, cx, cy, r);
  g.addColorStop(0, '#ff7675'); g.addColorStop(0.55, '#e74c3c'); g.addColorStop(1, '#922b21');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  shine(ctx, cx, cy, r);
  stem(ctx, cx, cy - r + 1);
}

function drawOrange(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const g = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.28, r * 0.08, cx, cy, r);
  g.addColorStop(0, '#ffeaa7'); g.addColorStop(0.4, '#fdcb6e'); g.addColorStop(1, '#e17055');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  shine(ctx, cx, cy, r);
  // navel dot at bottom
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.72, r * 0.14, 0, Math.PI * 2); ctx.fill();
  stem(ctx, cx, cy - r + 1);
}

function drawStrawberry(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // body — teardrop path
  const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.1, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#ff7675'); g.addColorStop(0.6, '#e74c3c'); g.addColorStop(1, '#922b21');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx, cy + r);                                            // bottom tip
  ctx.bezierCurveTo(cx - r * 1.0, cy + r * 0.3, cx - r * 1.0, cy - r * 0.5, cx, cy - r * 0.55);
  ctx.bezierCurveTo(cx + r * 1.0, cy - r * 0.5, cx + r * 1.0, cy + r * 0.3, cx, cy + r);
  ctx.fill();
  // seeds — tiny yellow-white dots
  const seeds: [number, number][] = [
    [-0.3, -0.25], [0.2, -0.35], [-0.1, 0.05], [0.35, 0.1],
    [-0.35, 0.25], [0.1, 0.4],   [-0.05, -0.6],
  ];
  ctx.fillStyle = 'rgba(255,255,180,0.9)';
  for (const [sx, sy] of seeds) {
    ctx.beginPath();
    ctx.ellipse(cx + sx * r, cy + sy * r, r * 0.09, r * 0.13, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // crown leaves
  ctx.fillStyle = '#27ae60';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.52);
    ctx.bezierCurveTo(
      cx + i * r * 0.35, cy - r * 1.05,
      cx + i * r * 0.45, cy - r * 0.9,
      cx + i * r * 0.2, cy - r * 0.55,
    );
    ctx.fill();
  }
}

function drawGrape(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.08, cx, cy, r);
  g.addColorStop(0, '#a29bfe'); g.addColorStop(0.5, '#6c5ce7'); g.addColorStop(1, '#4834d4');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  shine(ctx, cx, cy, r);
  // tiny stem nub
  ctx.strokeStyle = '#6d4c41';
  ctx.lineWidth = Math.max(1.5, CELL * 0.05);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy - r - CELL * 0.18);
  ctx.stroke();
}

function drawWatermelon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // green rind
  ctx.fillStyle = '#27ae60';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // white layer
  ctx.fillStyle = '#ecf0f1';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2); ctx.fill();
  // red flesh
  const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.05, cx, cy, r * 0.82);
  g.addColorStop(0, '#ff7675'); g.addColorStop(1, '#d63031');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2); ctx.fill();
  // seeds
  ctx.fillStyle = '#2d3436';
  const seeds: [number, number, number][] = [
    [-0.22, -0.18, 0.4], [0.25, -0.1, -0.3], [-0.05, 0.3, 0.1],
    [0.3, 0.28, 0.5],    [-0.3, 0.25, -0.5],
  ];
  for (const [sx, sy, angle] of seeds) {
    ctx.beginPath();
    ctx.ellipse(cx + sx * r, cy + sy * r, r * 0.08, r * 0.14, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  shine(ctx, cx, cy, r);
}

function drawLemon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.05, cx, cy, r);
  g.addColorStop(0, '#ffeaa7'); g.addColorStop(0.5, '#fdcb6e'); g.addColorStop(1, '#f9a825');
  ctx.fillStyle = g;
  // oval body
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 1.1, r * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  // pointed tips
  ctx.fillStyle = '#f9a825';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * r * 1.0, cy, r * 0.18, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  shine(ctx, cx, cy, r * 0.9);
}

function drawFruit(ctx: CanvasRenderingContext2D, food: Food) {
  const cx = food.x * CELL + CELL / 2;
  const cy = food.y * CELL + CELL / 2 + CELL * 0.05;
  const r  = CELL / 2 - CELL * 0.08;
  switch (food.fruit) {
    case 'apple':       drawApple(ctx, cx, cy, r);       break;
    case 'orange':      drawOrange(ctx, cx, cy, r);      break;
    case 'strawberry':  drawStrawberry(ctx, cx, cy, r);  break;
    case 'grape':       drawGrape(ctx, cx, cy, r);       break;
    case 'watermelon':  drawWatermelon(ctx, cx, cy, r);  break;
    case 'lemon':       drawLemon(ctx, cx, cy, r);       break;
  }
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
  const foodRef   = useRef<Food[]>(initFoods(snakeRef.current));
  const scoreRef  = useRef(0);
  const aliveRef  = useRef(true);
  const startedRef = useRef(false);

  const [score, setScore]     = useState(0);
  const [dead, setDead]       = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused]   = useState(false);
  const [speed, setSpeed]     = useState<SpeedKey>('medium');

  const pausedRef = useRef(false);

  // touch tracking
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // audio
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playTurn = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ac  = audioCtxRef.current;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(260, ac.currentTime + 0.07);
    gain.gain.setValueAtTime(0.18, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.09);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.09);
  }, []);

  const playEat = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ac = audioCtxRef.current;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ac.currentTime + 0.06);
    gain.gain.setValueAtTime(0.22, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.18);
  }, []);

  const playGameOver = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ac = audioCtxRef.current;
    // three descending notes
    const notes = [330, 220, 110];
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = 'sawtooth';
      const t = ac.currentTime + i * 0.18;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.15);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }, []);

  // turbo music
  const turboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turboStepRef  = useRef(0);
  // deliberately dissonant sequence: jumps between clashing semitones
  const TURBO_SEQ = [262, 277, 523, 185, 440, 466, 196, 554, 330, 622, 311, 698, 208, 587, 415, 233];

  const stopTurboMusic = useCallback(() => {
    if (turboTimerRef.current !== null) {
      clearTimeout(turboTimerRef.current);
      turboTimerRef.current = null;
    }
  }, []);

  const startTurboMusic = useCallback(() => {
    stopTurboMusic();
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();

    const tick = () => {
      const ac = audioCtxRef.current;
      if (!ac) return;

      const step = turboStepRef.current++;
      const freq  = TURBO_SEQ[step % TURBO_SEQ.length];
      const squeal = Math.random() < 0.18;      // occasional high squeal
      const dual   = Math.random() < 0.3;       // sometimes two notes at once

      const play = (f: number, vol: number, dur: number) => {
        const osc  = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(squeal ? f * 4 : f, ac.currentTime);
        if (squeal) osc.frequency.exponentialRampToValueAtTime(f * 2, ac.currentTime + dur);
        gain.gain.setValueAtTime(vol, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + dur);
      };

      play(freq, 0.07, 0.11);
      if (dual) play(TURBO_SEQ[(step + 5) % TURBO_SEQ.length], 0.05, 0.09);

      // random interval 80–160 ms for chaotic rhythm
      const next = 80 + Math.floor(Math.random() * 80);
      turboTimerRef.current = setTimeout(tick, next);
    };

    tick();
  }, [stopTurboMusic]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (speed === 'turbo' && started && !dead && !paused) {
      startTurboMusic();
    } else {
      stopTurboMusic();
    }
    return stopTurboMusic;
  }, [speed, started, dead, paused, startTurboMusic, stopTurboMusic]);

  const reset = useCallback(() => {
    snakeRef.current  = [{ x: 10, y: 10 }];
    dirRef.current    = 'RIGHT';
    nextRef.current   = 'RIGHT';
    foodRef.current   = initFoods(snakeRef.current);
    scoreRef.current  = 0;
    aliveRef.current  = true;
    startedRef.current = true;
    pausedRef.current = false;
    setScore(0);
    setDead(false);
    setStarted(true);
    setPaused(false);
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
    foodRef.current.forEach((f) => drawFruit(ctx, f));

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
      playGameOver();
      return;
    }
    // self collision
    if (snakeRef.current.some((s) => s.x === head.x && s.y === head.y)) {
      aliveRef.current = false;
      setDead(true);
      playGameOver();
      return;
    }

    const eatenIdx = foodRef.current.findIndex((f) => f.x === head.x && f.y === head.y);
    const ate = eatenIdx >= 0;
    const newSnake = [head, ...snakeRef.current];
    if (!ate) newSnake.pop();

    snakeRef.current = newSnake;

    if (ate) {
      const newFoods = [...foodRef.current];
      newFoods[eatenIdx] = randomFood(newSnake, newFoods.filter((_, i) => i !== eatenIdx));
      foodRef.current = newFoods;
      scoreRef.current += 10;
      setScore(scoreRef.current);
      playEat();
    }

    draw();
  }, [draw, playEat, playGameOver]);

  // game loop — restarts whenever speed or pause changes
  useEffect(() => {
    if (!started || paused) { draw(); return; }
    const id = setInterval(tick, SPEEDS[speed].ms);
    return () => clearInterval(id);
  }, [started, paused, speed, tick, draw]);

  const togglePause = useCallback(() => {
    if (!startedRef.current || !aliveRef.current) return;
    pausedRef.current = !pausedRef.current;
    setPaused((p) => !p);
  }, []);

  // keyboard
  useEffect(() => {
    const MAP: Record<string, Dir> = {
      ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
      w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
      }
      const d = MAP[e.key];
      if (!d) return;
      e.preventDefault();
      if (!startedRef.current) { reset(); return; }
      if (pausedRef.current) return;
      if (d !== OPPOSITE[dirRef.current] && d !== nextRef.current) {
        nextRef.current = d;
        playTurn();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reset, playTurn, togglePause]);

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
    if (d !== OPPOSITE[dirRef.current] && d !== nextRef.current) {
      nextRef.current = d;
      playTurn();
    }
  };

  // D-pad button handler
  const press = (d: Dir) => {
    if (!startedRef.current) { reset(); return; }
    if (d !== OPPOSITE[dirRef.current] && d !== nextRef.current) {
      nextRef.current = d;
      playTurn();
    }
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
        {paused && !dead && (
          <div className="overlay" onClick={togglePause}>
            <p className="pause-title">Paused</p>
            <p className="sub">Press ESC or tap to resume</p>
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
          <button className="dpad-btn pause-center" onClick={togglePause}>
            {paused ? '▶' : '⏸'}
          </button>
          <button className="dpad-btn right" onClick={() => press('RIGHT')}>▶</button>
        </div>
        <button className="dpad-btn down"  onClick={() => press('DOWN')}>▼</button>
      </div>
    </div>
  );
}
