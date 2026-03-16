# Mini-Game Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 4 existing tap-heavy egg-hatching mini-games with 6 new touch-first games, each using a distinct gesture, and simplify the orchestrator to a single random game.

**Architecture:** Each game is a standalone React component with `onComplete(won: boolean)`. The `EggHatch` orchestrator picks 1 random game — win hatches the egg, lose returns to breed screen. All touch input uses native touch events with mouse fallback, no canvas.

**Tech Stack:** React, framer-motion (`motion/react`), TypeScript, Tailwind CSS with retro-* design tokens

---

### Task 1: Simplify EggHatch Orchestrator

**Files:**
- Modify: `src/components/egg-hatch.tsx`

**Step 1: Rewrite EggHatch to single-game mode**

Replace the entire component. Key changes:
- Remove `gameIndex`, `wins`, `losses`, `lastResult` state
- Remove `GAMES_TO_PLAY`, `WINS_NEEDED` constants
- Remove `selectedGames` memo, `handleGameComplete` multi-game logic, `advanceFromResult`, `minigame-result` phase
- Keep phases: `intro` | `minigame` | `hatching` | `failed`
- Pick 1 random game on mount, play it, `onComplete(true)` = hatching, `onComplete(false)` = failed

```tsx
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RetroButton } from "./retro-button";
import {
  TapFrenzy,
  EggRoll,
  ShellScratch,
  WarmTheEgg,
  EggToss,
  CrackTiming,
} from "./mini-games";

type HatchPhase = "intro" | "minigame" | "hatching" | "failed";

interface EggHatchProps {
  motherName: string;
  fatherName: string;
  onHatch: () => void;
  onFail: () => void;
}

const MINI_GAMES = [
  { name: "Tap Frenzy", component: TapFrenzy },
  { name: "Egg Roll", component: EggRoll },
  { name: "Shell Scratch", component: ShellScratch },
  { name: "Warm the Egg", component: WarmTheEgg },
  { name: "Egg Toss", component: EggToss },
  { name: "Crack Timing", component: CrackTiming },
] as const;

export function EggHatch({ motherName, fatherName, onHatch, onFail }: EggHatchProps) {
  const [phase, setPhase] = useState<HatchPhase>("intro");

  const selectedGame = useMemo(
    () => MINI_GAMES[Math.floor(Math.random() * MINI_GAMES.length)],
    []
  );

  const handleGameComplete = useCallback(
    (won: boolean) => {
      setPhase(won ? "hatching" : "failed");
    },
    []
  );

  useEffect(() => {
    if (phase === "hatching") {
      const timer = setTimeout(() => onHatch(), 2500);
      return () => clearTimeout(timer);
    }
  }, [phase, onHatch]);

  const CurrentGame = phase === "minigame" ? selectedGame.component : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-retro-black overflow-hidden">
      <AnimatePresence mode="wait">
        {phase === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-24 h-28 bg-retro-gold/20 border-4 border-retro-gold rounded-[50%] flex items-center justify-center"
            >
              <span className="text-3xl">&#129370;</span>
            </motion.div>
            <div className="text-center">
              <p className="font-retro text-[10px] text-retro-white/60 mb-2">An egg appeared!</p>
              <p className="font-retro text-[8px] text-retro-white/40">{motherName} + {fatherName}</p>
            </div>
            <div className="text-center">
              <p className="font-retro text-[8px] text-retro-white/50 mb-3">
                Complete the mini-game to hatch the egg!
              </p>
            </div>
            <RetroButton onClick={() => setPhase("minigame")}>Start!</RetroButton>
          </motion.div>
        )}

        {phase === "minigame" && CurrentGame && (
          <motion.div
            key="game"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="flex flex-col items-center gap-4 w-full px-6"
          >
            <CurrentGame onComplete={handleGameComplete} />
          </motion.div>
        )}

        {phase === "hatching" && (
          <motion.div
            key="hatching"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              animate={{
                x: [0, -6, 6, -8, 8, -4, 4, 0],
                rotate: [0, -5, 5, -8, 8, -3, 3, 0],
              }}
              transition={{ duration: 1.5, repeat: 1 }}
              className="w-24 h-28 bg-retro-gold/20 border-4 border-retro-gold rounded-[50%] flex items-center justify-center"
            >
              <span className="text-3xl">&#129370;</span>
            </motion.div>
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="font-retro text-sm text-retro-gold"
            >
              Hatching...!
            </motion.p>
          </motion.div>
        )}

        {phase === "failed" && (
          <motion.div
            key="failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div className="w-24 h-28 bg-retro-white/5 border-4 border-retro-white/20 rounded-[50%] flex items-center justify-center">
              <span className="text-3xl opacity-50">&#129370;</span>
            </motion.div>
            <p className="font-retro text-[10px] text-retro-accent">The egg didn&apos;t hatch...</p>
            <p className="font-retro text-[8px] text-retro-white/40">Maybe next time!</p>
            <RetroButton onClick={onFail} variant="secondary">Back</RetroButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

**Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: Errors about missing game exports (EggRoll, ShellScratch, etc.) — that's expected, we'll add them next.

**Step 3: Commit**

```bash
git add src/components/egg-hatch.tsx
git commit -m "Simplify EggHatch to single random game orchestrator"
```

---

### Task 2: Rebuild Tap Frenzy

**Files:**
- Modify: `src/components/mini-games/tap-frenzy.tsx`

**Step 1: Rewrite Tap Frenzy**

Mostly the same logic but clean up the tap target to be more egg-themed and ensure touch events work well. The current version is solid — minor polish only.

Keep the existing implementation as-is. It already uses `onClick` which handles both tap and click. The big round button with `whileTap={{ scale: 0.9 }}` is good mobile UX.

No changes needed to this file.

**Step 2: Commit (skip if no changes)**

---

### Task 3: Create Egg Roll

**Files:**
- Create: `src/components/mini-games/egg-roll.tsx`

**Step 1: Implement Egg Roll**

Player drags left/right to guide an egg down a path. Obstacles scroll upward. Hit 2 obstacles = fail. Reach the bottom = win.

```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";

interface EggRollProps {
  onComplete: (won: boolean) => void;
}

interface Obstacle {
  id: number;
  x: number; // 0-100 percent
  y: number; // 0-100 percent (starts at 100, scrolls to 0)
  width: number; // percent width
}

const DURATION = 6000;
const OBSTACLE_COUNT = 6;
const EGG_SIZE = 12; // percent

export function EggRoll({ onComplete }: EggRollProps) {
  const [started, setStarted] = useState(false);
  const [eggX, setEggX] = useState(50);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [hits, setHits] = useState(0);
  const [progress, setProgress] = useState(0);
  const gameArea = useRef<HTMLDivElement>(null);
  const ended = useRef(false);

  // Generate obstacles on mount
  useEffect(() => {
    const obs: Obstacle[] = [];
    for (let i = 0; i < OBSTACLE_COUNT; i++) {
      const width = 25 + Math.random() * 30; // 25-55% width
      obs.push({
        id: i,
        x: Math.random() * (100 - width),
        y: 100 + (i + 1) * 20, // staggered below viewport
        width,
      });
    }
    setObstacles(obs);
  }, []);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!started || !gameArea.current) return;
      const rect = gameArea.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      setEggX(Math.max(EGG_SIZE / 2, Math.min(100 - EGG_SIZE / 2, x)));
    },
    [started]
  );

  // Game loop
  useEffect(() => {
    if (!started || ended.current) return;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(1, elapsed / DURATION);
      setProgress(pct);

      // Move obstacles upward
      setObstacles((prev) =>
        prev.map((o) => ({ ...o, y: o.y - 0.8 }))
      );

      // Check collisions at egg position (egg is at y ~15% from top)
      const eggY = 15;
      setObstacles((prev) => {
        let newHits = 0;
        const updated = prev.map((o) => {
          if (o.y < -10) return o; // already passed
          // Collision check
          const eggLeft = eggX - EGG_SIZE / 2;
          const eggRight = eggX + EGG_SIZE / 2;
          const obsLeft = o.x;
          const obsRight = o.x + o.width;
          const verticalOverlap = Math.abs(o.y - eggY) < 6;
          const horizontalOverlap = eggLeft < obsRight && eggRight > obsLeft;

          if (verticalOverlap && horizontalOverlap && o.y > -10) {
            newHits++;
            return { ...o, y: -20 }; // mark as hit
          }
          return o;
        });

        if (newHits > 0) {
          setHits((h) => {
            const total = h + newHits;
            if (total >= 2 && !ended.current) {
              ended.current = true;
              setTimeout(() => onComplete(false), 500);
            }
            return total;
          });
        }

        return updated;
      });

      if (pct >= 1 && !ended.current) {
        ended.current = true;
        clearInterval(interval);
        setHits((h) => {
          setTimeout(() => onComplete(h < 2), 500);
          return h;
        });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [started, eggX, onComplete]);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-xs">
      <p className="font-retro text-[10px] text-retro-gold uppercase">Egg Roll!</p>
      <p className="font-retro text-[8px] text-retro-white/60">
        {!started ? "Tap to start!" : "Dodge the obstacles!"}
      </p>

      {started && (
        <div className="w-full h-2 bg-retro-dark border border-retro-white/30">
          <motion.div
            className="h-full bg-retro-green"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      <div
        ref={gameArea}
        className="relative w-full h-72 bg-retro-dark border-2 border-retro-white/30 overflow-hidden touch-none"
        onClick={(e) => {
          if (!started) setStarted(true);
          handleMove(e.clientX);
        }}
        onMouseMove={(e) => handleMove(e.clientX)}
        onTouchStart={(e) => {
          if (!started) setStarted(true);
          handleMove(e.touches[0].clientX);
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          handleMove(e.touches[0].clientX);
        }}
      >
        {/* Egg */}
        <div
          className="absolute top-[15%] w-8 h-10 bg-retro-gold/80 border-2 border-retro-gold rounded-[50%] flex items-center justify-center transition-[left] duration-75 -translate-x-1/2"
          style={{ left: `${eggX}%` }}
        >
          <span className="text-sm">&#129370;</span>
        </div>

        {/* Obstacles */}
        {obstacles.map((o) => (
          <div
            key={o.id}
            className="absolute h-4 bg-retro-accent/70 border border-retro-accent"
            style={{
              left: `${o.x}%`,
              top: `${o.y}%`,
              width: `${o.width}%`,
            }}
          />
        ))}

        {/* Hit counter */}
        {started && (
          <div className="absolute top-2 right-2 font-retro text-[8px] text-retro-white/40">
            {hits}/2 hits
          </div>
        )}

        {!started && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-retro text-[10px] text-retro-white/40">TAP TO START</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles in isolation**

Run: `npx tsc --noEmit 2>&1 | grep egg-roll`
Expected: No errors for this file specifically.

**Step 3: Commit**

```bash
git add src/components/mini-games/egg-roll.tsx
git commit -m "Add Egg Roll mini-game (drag to dodge obstacles)"
```

---

### Task 4: Create Shell Scratch

**Files:**
- Create: `src/components/mini-games/shell-scratch.tsx`

**Step 1: Implement Shell Scratch**

Player rubs/drags across the egg to scratch away a dark overlay, revealing the glow underneath. Uses a grid of cells that get "scratched" when touched.

```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";

interface ShellScratchProps {
  onComplete: (won: boolean) => void;
}

const GRID_SIZE = 8; // 8x8 grid
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const WIN_THRESHOLD = 0.75; // scratch 75% to win
const DURATION = 5000;

export function ShellScratch({ onComplete }: ShellScratchProps) {
  const [started, setStarted] = useState(false);
  const [scratched, setScratched] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const gameArea = useRef<HTMLDivElement>(null);
  const ended = useRef(false);

  const scratchAt = useCallback(
    (clientX: number, clientY: number) => {
      if (!started || !gameArea.current || ended.current) return;
      const rect = gameArea.current.getBoundingClientRect();
      const x = Math.floor(((clientX - rect.left) / rect.width) * GRID_SIZE);
      const y = Math.floor(((clientY - rect.top) / rect.height) * GRID_SIZE);
      if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;
      const idx = y * GRID_SIZE + x;
      setScratched((prev) => {
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
    },
    [started]
  );

  // Timer
  useEffect(() => {
    if (!started || ended.current) return;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const remaining = Math.max(0, DURATION - (Date.now() - startTime));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        ended.current = true;
        clearInterval(interval);
        setScratched((current) => {
          const pct = current.size / TOTAL_CELLS;
          setTimeout(() => onComplete(pct >= WIN_THRESHOLD), 500);
          return current;
        });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [started, onComplete]);

  // Check for early win
  useEffect(() => {
    if (!started || ended.current) return;
    const pct = scratched.size / TOTAL_CELLS;
    if (pct >= WIN_THRESHOLD) {
      ended.current = true;
      setTimeout(() => onComplete(true), 500);
    }
  }, [scratched, started, onComplete]);

  const progress = scratched.size / TOTAL_CELLS;

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-xs">
      <p className="font-retro text-[10px] text-retro-gold uppercase">Shell Scratch!</p>
      <p className="font-retro text-[8px] text-retro-white/60">
        {!started ? "Tap to start!" : "Scratch the shell to reveal the egg!"}
      </p>

      {started && (
        <>
          <div className="w-full h-2 bg-retro-dark border border-retro-white/30">
            <motion.div
              className="h-full bg-retro-accent"
              style={{ width: `${(timeLeft / DURATION) * 100}%` }}
            />
          </div>
          <div className="w-full h-4 bg-retro-dark border border-retro-white/30">
            <motion.div
              className="h-full bg-retro-green"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </>
      )}

      <div
        ref={gameArea}
        className="relative w-56 h-56 bg-retro-dark border-2 border-retro-white/30 overflow-hidden touch-none select-none"
        onClick={(e) => {
          if (!started) {
            setStarted(true);
            return;
          }
          scratchAt(e.clientX, e.clientY);
        }}
        onMouseMove={(e) => {
          if (e.buttons > 0) scratchAt(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          if (!started) {
            setStarted(true);
            return;
          }
          scratchAt(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          scratchAt(e.touches[0].clientX, e.touches[0].clientY);
        }}
      >
        {/* Glowing egg underneath */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-40 bg-retro-gold/30 border-2 border-retro-gold rounded-[50%] flex items-center justify-center">
            <span className="text-4xl">&#129370;</span>
          </div>
        </div>

        {/* Scratch overlay grid */}
        <div
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
          }}
        >
          {Array.from({ length: TOTAL_CELLS }).map((_, i) => (
            <div
              key={i}
              className={`transition-opacity duration-150 ${
                scratched.has(i) ? "opacity-0" : "bg-retro-dark"
              }`}
            />
          ))}
        </div>

        {!started && (
          <div className="absolute inset-0 flex items-center justify-center bg-retro-dark/80">
            <p className="font-retro text-[10px] text-retro-white/40">TAP TO START</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/mini-games/shell-scratch.tsx
git commit -m "Add Shell Scratch mini-game (rub to reveal egg)"
```

---

### Task 5: Create Warm the Egg

**Files:**
- Create: `src/components/mini-games/warm-the-egg.tsx`

**Step 1: Implement Warm the Egg**

Player draws circles around the egg. Track angle from center, accumulate total angle change. Each full revolution (360 degrees) increments the temperature. Need ~5 revolutions to win.

```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";

interface WarmTheEggProps {
  onComplete: (won: boolean) => void;
}

const DURATION = 7000;
const REVOLUTIONS_NEEDED = 5;
const TARGET_ANGLE = REVOLUTIONS_NEEDED * 360;

export function WarmTheEgg({ onComplete }: WarmTheEggProps) {
  const [started, setStarted] = useState(false);
  const [totalAngle, setTotalAngle] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const gameArea = useRef<HTMLDivElement>(null);
  const lastAngle = useRef<number | null>(null);
  const ended = useRef(false);

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!started || !gameArea.current || ended.current) return;
      const rect = gameArea.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);

      if (lastAngle.current !== null) {
        let delta = angle - lastAngle.current;
        // Normalize to -180..180
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        setTotalAngle((prev) => prev + Math.abs(delta));
      }
      lastAngle.current = angle;
    },
    [started]
  );

  const handleEnd = useCallback(() => {
    lastAngle.current = null;
  }, []);

  // Timer
  useEffect(() => {
    if (!started || ended.current) return;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const remaining = Math.max(0, DURATION - (Date.now() - startTime));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        ended.current = true;
        clearInterval(interval);
        setTotalAngle((current) => {
          setTimeout(() => onComplete(current >= TARGET_ANGLE), 500);
          return current;
        });
      }
    }, 50);
    return () => clearInterval(interval);
  }, [started, onComplete]);

  // Early win check
  useEffect(() => {
    if (!started || ended.current) return;
    if (totalAngle >= TARGET_ANGLE) {
      ended.current = true;
      setTimeout(() => onComplete(true), 500);
    }
  }, [totalAngle, started, onComplete]);

  const progress = Math.min(1, totalAngle / TARGET_ANGLE);
  // Temperature color from blue to red
  const tempHue = 240 - progress * 240; // 240 (blue) to 0 (red)

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-xs">
      <p className="font-retro text-[10px] text-retro-gold uppercase">Warm the Egg!</p>
      <p className="font-retro text-[8px] text-retro-white/60">
        {!started ? "Tap to start!" : "Draw circles to warm it up!"}
      </p>

      {started && (
        <div className="flex w-full gap-2">
          <div className="flex-1 h-2 bg-retro-dark border border-retro-white/30">
            <motion.div
              className="h-full bg-retro-accent"
              style={{ width: `${(timeLeft / DURATION) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Temperature gauge */}
      {started && (
        <div className="w-6 h-40 bg-retro-dark border-2 border-retro-white/30 relative flex flex-col-reverse overflow-hidden">
          <motion.div
            className="w-full"
            style={{
              height: `${progress * 100}%`,
              backgroundColor: `hsl(${tempHue}, 80%, 50%)`,
            }}
          />
        </div>
      )}

      <div
        ref={gameArea}
        className="relative w-56 h-56 flex items-center justify-center touch-none select-none"
        onClick={() => {
          if (!started) setStarted(true);
        }}
        onMouseMove={(e) => {
          if (e.buttons > 0) handleMove(e.clientX, e.clientY);
        }}
        onMouseUp={handleEnd}
        onTouchStart={(e) => {
          if (!started) {
            setStarted(true);
            return;
          }
          handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchEnd={handleEnd}
      >
        {/* Circular guide */}
        <div className="absolute w-44 h-44 rounded-full border-2 border-dashed border-retro-white/15" />

        {/* Egg */}
        <motion.div
          animate={started ? { scale: [1, 1.03, 1] } : {}}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="w-20 h-24 border-4 rounded-[50%] flex items-center justify-center"
          style={{
            borderColor: `hsl(${tempHue}, 80%, 50%)`,
            backgroundColor: `hsl(${tempHue}, 40%, 20%)`,
          }}
        >
          <span className="text-3xl">&#129370;</span>
        </motion.div>

        {!started && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-retro text-[10px] text-retro-white/40">TAP TO START</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/mini-games/warm-the-egg.tsx
git commit -m "Add Warm the Egg mini-game (circular motion to heat)"
```

---

### Task 6: Create Egg Toss

**Files:**
- Create: `src/components/mini-games/egg-toss.tsx`

**Step 1: Implement Egg Toss**

Swipe upward to toss the egg. Swipe velocity determines height. Nest target at random height. Best of 3 tosses, need 2 hits.

```tsx
"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface EggTossProps {
  onComplete: (won: boolean) => void;
}

const ROUNDS = 3;
const WINS_NEEDED = 2;
const NEST_TOLERANCE = 12; // percent tolerance for landing

export function EggToss({ onComplete }: EggTossProps) {
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [eggY, setEggY] = useState(85); // percent from top (85 = bottom)
  const [tossing, setTossing] = useState(false);
  const [result, setResult] = useState<"hit" | "miss" | null>(null);
  const [nestY] = useState(() => 20 + Math.random() * 40); // 20-60% from top
  const touchStart = useRef<{ y: number; time: number } | null>(null);
  const ended = useRef(false);

  const handleTossEnd = useCallback(
    (endY: number) => {
      if (tossing || ended.current) return;
      const start = touchStart.current;
      if (!start) return;

      const dy = start.y - endY; // positive = upward swipe
      const dt = Date.now() - start.time;
      if (dy < 20 || dt > 1000) {
        // Not a real swipe
        touchStart.current = null;
        return;
      }

      const velocity = dy / dt; // pixels per ms
      // Map velocity to egg height (higher velocity = higher toss)
      // velocity 0.2-2.0 maps to 85% (bottom) to 5% (top)
      const targetY = Math.max(5, Math.min(85, 85 - velocity * 60));

      setTossing(true);
      setEggY(targetY);

      // Check hit after animation
      setTimeout(() => {
        const isHit = Math.abs(targetY - nestY) < NEST_TOLERANCE;
        setResult(isHit ? "hit" : "miss");
        const newHits = isHit ? hits + 1 : hits;
        if (isHit) setHits(newHits);

        setTimeout(() => {
          const newRound = round + 1;

          // Check early win/loss
          if (newHits >= WINS_NEEDED && !ended.current) {
            ended.current = true;
            onComplete(true);
            return;
          }
          const roundsLeft = ROUNDS - newRound;
          if (roundsLeft + newHits < WINS_NEEDED && !ended.current) {
            ended.current = true;
            onComplete(false);
            return;
          }

          if (newRound >= ROUNDS) {
            if (!ended.current) {
              ended.current = true;
              onComplete(newHits >= WINS_NEEDED);
            }
            return;
          }

          setRound(newRound);
          setEggY(85);
          setTossing(false);
          setResult(null);
          touchStart.current = null;
        }, 800);
      }, 400);
    },
    [tossing, hits, round, nestY, onComplete]
  );

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-xs">
      <p className="font-retro text-[10px] text-retro-gold uppercase">Egg Toss!</p>
      <p className="font-retro text-[8px] text-retro-white/60">
        Swipe up to toss the egg into the nest!
      </p>

      {/* Score */}
      <div className="flex gap-2">
        {Array.from({ length: ROUNDS }).map((_, i) => (
          <span
            key={i}
            className={`w-3 h-3 border-2 ${
              i < round + (result !== null ? 1 : 0)
                ? i < hits + (i === round && result === "hit" ? 1 : 0)
                  ? "bg-retro-green border-retro-green"
                  : "bg-retro-accent border-retro-accent"
                : "border-retro-white/30"
            }`}
          />
        ))}
      </div>

      <div
        className="relative w-full h-72 bg-retro-dark border-2 border-retro-white/30 overflow-hidden touch-none select-none"
        onMouseDown={(e) => {
          touchStart.current = { y: e.clientY, time: Date.now() };
        }}
        onMouseUp={(e) => handleTossEnd(e.clientY)}
        onTouchStart={(e) => {
          touchStart.current = { y: e.touches[0].clientY, time: Date.now() };
        }}
        onTouchEnd={(e) => handleTossEnd(e.changedTouches[0].clientY)}
      >
        {/* Nest target */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-16 h-6 flex items-center justify-center"
          style={{ top: `${nestY}%` }}
        >
          <div className="w-14 h-5 bg-retro-gold/20 border-2 border-retro-gold rounded-b-lg" />
        </div>

        {/* Target zone indicator */}
        <div
          className="absolute left-0 right-0 border-t border-b border-dashed border-retro-green/20"
          style={{
            top: `${nestY - NEST_TOLERANCE}%`,
            height: `${NEST_TOLERANCE * 2}%`,
          }}
        />

        {/* Egg */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 w-10 h-12 bg-retro-gold/60 border-2 border-retro-gold rounded-[50%] flex items-center justify-center"
          animate={{ top: `${eggY}%` }}
          transition={{ type: "spring", damping: 15, stiffness: 200 }}
        >
          <span className="text-lg">&#129370;</span>
        </motion.div>

        {/* Result flash */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <span
                className={`font-retro text-lg ${
                  result === "hit" ? "text-retro-green" : "text-retro-accent"
                }`}
              >
                {result === "hit" ? "NICE!" : "MISS!"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/mini-games/egg-toss.tsx
git commit -m "Add Egg Toss mini-game (swipe to launch egg into nest)"
```

---

### Task 7: Create Crack Timing

**Files:**
- Create: `src/components/mini-games/crack-timing.tsx`

**Step 1: Implement Crack Timing**

Power indicator oscillates across a bar. Green zone in the middle. Tap when indicator is in zone. 3 rounds, each faster. Need 2/3.

```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";

interface CrackTimingProps {
  onComplete: (won: boolean) => void;
}

const ROUNDS = 3;
const WINS_NEEDED = 2;
const ZONE_WIDTH = 20; // percent width of green zone
const ZONE_START = 40; // percent from left

export function CrackTiming({ onComplete }: CrackTimingProps) {
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [indicatorX, setIndicatorX] = useState(0);
  const [result, setResult] = useState<"hit" | "miss" | null>(null);
  const [active, setActive] = useState(true);
  const animFrame = useRef<number>(0);
  const startTime = useRef(Date.now());
  const ended = useRef(false);

  // Speed increases each round
  const speed = 0.08 + round * 0.03;

  // Animate indicator
  useEffect(() => {
    if (!active) return;
    startTime.current = Date.now();

    function animate() {
      const elapsed = Date.now() - startTime.current;
      // Oscillate 0-100 using sine wave
      const x = 50 + Math.sin(elapsed * speed * 0.01) * 50;
      setIndicatorX(x);
      animFrame.current = requestAnimationFrame(animate);
    }

    animFrame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame.current);
  }, [active, speed]);

  const handleTap = useCallback(() => {
    if (!active || result !== null || ended.current) return;

    cancelAnimationFrame(animFrame.current);
    setActive(false);

    const isHit = indicatorX >= ZONE_START && indicatorX <= ZONE_START + ZONE_WIDTH;
    setResult(isHit ? "hit" : "miss");

    const newHits = isHit ? hits + 1 : hits;
    if (isHit) setHits(newHits);

    setTimeout(() => {
      const newRound = round + 1;

      if (newHits >= WINS_NEEDED && !ended.current) {
        ended.current = true;
        onComplete(true);
        return;
      }
      const roundsLeft = ROUNDS - newRound;
      if (roundsLeft + newHits < WINS_NEEDED && !ended.current) {
        ended.current = true;
        onComplete(false);
        return;
      }
      if (newRound >= ROUNDS) {
        if (!ended.current) {
          ended.current = true;
          onComplete(newHits >= WINS_NEEDED);
        }
        return;
      }

      setRound(newRound);
      setResult(null);
      setActive(true);
    }, 700);
  }, [active, result, indicatorX, hits, round, onComplete]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-xs">
      <p className="font-retro text-[10px] text-retro-gold uppercase">Crack Timing!</p>
      <p className="font-retro text-[8px] text-retro-white/60">
        Tap when the marker is in the green zone!
      </p>

      {/* Score */}
      <div className="flex gap-2">
        {Array.from({ length: ROUNDS }).map((_, i) => (
          <span
            key={i}
            className={`w-3 h-3 border-2 ${
              i < round + (result !== null ? 1 : 0)
                ? i < hits + (i === round && result === "hit" ? 1 : 0)
                  ? "bg-retro-green border-retro-green"
                  : "bg-retro-accent border-retro-accent"
                : "border-retro-white/30"
            }`}
          />
        ))}
      </div>

      {/* Timing bar */}
      <button
        className="relative w-full h-12 bg-retro-dark border-2 border-retro-white/30 overflow-hidden touch-none"
        onClick={handleTap}
        onTouchStart={(e) => {
          e.preventDefault();
          handleTap();
        }}
      >
        {/* Green zone */}
        <div
          className="absolute top-0 bottom-0 bg-retro-green/30 border-x-2 border-retro-green/60"
          style={{ left: `${ZONE_START}%`, width: `${ZONE_WIDTH}%` }}
        />

        {/* Indicator */}
        <motion.div
          className={`absolute top-0 bottom-0 w-1 ${
            result === "hit"
              ? "bg-retro-green"
              : result === "miss"
              ? "bg-retro-accent"
              : "bg-retro-white"
          }`}
          style={{ left: `${indicatorX}%` }}
        />
      </button>

      {/* Result flash */}
      {result && (
        <motion.p
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`font-retro text-xs ${
            result === "hit" ? "text-retro-green" : "text-retro-accent"
          }`}
        >
          {result === "hit" ? "CRACK!" : "MISS!"}
        </motion.p>
      )}

      {/* Egg visualization */}
      <div className="w-16 h-20 bg-retro-gold/20 border-4 border-retro-gold rounded-[50%] flex items-center justify-center relative overflow-hidden">
        <span className="text-2xl">&#129370;</span>
        {/* Cracks based on hits */}
        {hits >= 1 && (
          <div className="absolute top-2 left-3 w-4 h-4 border-l-2 border-retro-white/60 rotate-12" />
        )}
        {hits >= 2 && (
          <div className="absolute top-4 right-2 w-3 h-5 border-r-2 border-retro-white/60 -rotate-12" />
        )}
      </div>

      <p className="font-retro text-[7px] text-retro-white/30">
        Round {round + 1}/{ROUNDS}
      </p>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/mini-games/crack-timing.tsx
git commit -m "Add Crack Timing mini-game (tap in green zone to crack egg)"
```

---

### Task 8: Update Index & Delete Old Games

**Files:**
- Modify: `src/components/mini-games/index.ts`
- Delete: `src/components/mini-games/timing-ring.tsx`
- Delete: `src/components/mini-games/pattern-memory.tsx`
- Delete: `src/components/mini-games/egg-catch.tsx`

**Step 1: Update index.ts exports**

```ts
export { TapFrenzy } from "./tap-frenzy";
export { EggRoll } from "./egg-roll";
export { ShellScratch } from "./shell-scratch";
export { WarmTheEgg } from "./warm-the-egg";
export { EggToss } from "./egg-toss";
export { CrackTiming } from "./crack-timing";
```

**Step 2: Delete old game files**

```bash
rm src/components/mini-games/timing-ring.tsx
rm src/components/mini-games/pattern-memory.tsx
rm src/components/mini-games/egg-catch.tsx
```

**Step 3: Verify everything compiles**

Run: `npx tsc --noEmit`
Expected: Clean, no errors.

**Step 4: Commit**

```bash
git add -A src/components/mini-games/
git commit -m "Replace old mini-games with 6 touch-first games"
```

---

### Task 9: Smoke Test in Browser

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Manual testing checklist**

Navigate to the breed page and trigger each mini-game. For each game verify:
- [ ] Game loads without console errors
- [ ] Touch/mouse input works
- [ ] Win condition triggers `onComplete(true)` -> hatching animation
- [ ] Lose condition triggers `onComplete(false)` -> "egg didn't hatch" screen
- [ ] Game fits on mobile viewport (max-w-xs constraint)

**Step 3: Fix any issues found, commit fixes**
