"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";

interface EggCatchProps {
  onComplete: (won: boolean) => void;
}

interface Sparkle {
  id: number;
  x: number; // 0-100 percent
  y: number;
  speed: number;
}

const DURATION = 6000;
const TARGET_CATCHES = 8;
const SPAWN_INTERVAL = 400;

export function EggCatch({ onComplete }: EggCatchProps) {
  const [started, setStarted] = useState(false);
  const [catches, setCatches] = useState(0);
  const [basketX, setBasketX] = useState(50);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const gameArea = useRef<HTMLDivElement>(null);
  const ended = useRef(false);
  const nextId = useRef(0);

  // Move basket with touch/mouse
  const handleMove = useCallback(
    (clientX: number) => {
      if (!started || !gameArea.current) return;
      const rect = gameArea.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      setBasketX(Math.max(5, Math.min(95, x)));
    },
    [started]
  );

  // Game loop
  useEffect(() => {
    if (!started || ended.current) return;

    const startTime = Date.now();
    let lastSpawn = 0;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, DURATION - elapsed);
      setTimeLeft(remaining);

      // Spawn sparkles
      if (elapsed - lastSpawn > SPAWN_INTERVAL) {
        lastSpawn = elapsed;
        const id = nextId.current++;
        setSparkles((prev: Sparkle[]) => [
          ...prev,
          { id, x: Math.random() * 80 + 10, y: 0, speed: 1.5 + Math.random() * 1.5 },
        ]);
      }

      // Move sparkles down and check catches
      setSparkles((prev: Sparkle[]) => {
        const alive: Sparkle[] = [];
        for (const s of prev) {
          const newY = s.y + s.speed;
          if (newY >= 85) {
            // Check catch with current basket position
            setBasketX((bx: number) => {
              if (Math.abs(s.x - bx) < 15) {
                setCatches((c: number) => c + 1);
              }
              return bx;
            });
            continue; // Remove sparkle
          }
          alive.push({ ...s, y: newY });
        }
        return alive;
      });

      if (remaining <= 0) {
        ended.current = true;
        clearInterval(interval);
        setCatches((c: number) => {
          setTimeout(() => onComplete(c >= TARGET_CATCHES), 500);
          return c;
        });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [started, onComplete]);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-xs">
      <p className="font-retro text-[10px] text-retro-gold uppercase">
        Egg Catch!
      </p>
      <p className="font-retro text-[8px] text-retro-white/60">
        {!started ? "Tap to start!" : `Catch ${TARGET_CATCHES} sparkles!`}
      </p>

      {/* Score & timer */}
      {started && (
        <div className="flex w-full justify-between font-retro text-[8px]">
          <span className="text-retro-green">{catches}/{TARGET_CATCHES}</span>
          <span className="text-retro-white/40">{Math.ceil(timeLeft / 1000)}s</span>
        </div>
      )}

      {/* Game area */}
      <div
        ref={gameArea}
        className="relative w-full h-64 bg-retro-dark border-2 border-retro-white/30 overflow-hidden touch-none"
        onClick={(e: React.MouseEvent) => {
          if (!started) setStarted(true);
          handleMove(e.clientX);
        }}
        onMouseMove={(e: React.MouseEvent) => handleMove(e.clientX)}
        onTouchMove={(e: React.TouchEvent) => {
          e.preventDefault();
          handleMove(e.touches[0].clientX);
        }}
      >
        {/* Sparkles */}
        {sparkles.map((s: Sparkle) => (
          <motion.div
            key={s.id}
            className="absolute w-4 h-4 text-retro-gold text-center text-sm leading-4"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
          >
            *
          </motion.div>
        ))}

        {/* Basket */}
        <div
          className="absolute bottom-2 w-10 h-6 bg-retro-gold/80 border-2 border-retro-gold rounded-b-lg transition-[left] duration-75"
          style={{ left: `calc(${basketX}% - 20px)` }}
        />

        {!started && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-retro text-[10px] text-retro-white/40">TAP TO START</p>
          </div>
        )}
      </div>
    </div>
  );
}
