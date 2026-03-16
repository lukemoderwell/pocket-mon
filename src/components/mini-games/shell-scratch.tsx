"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";

interface ShellScratchProps {
  onComplete: (won: boolean) => void;
}

const GRID_SIZE = 8;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const WIN_THRESHOLD = 0.75;
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
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-40 bg-retro-gold/30 border-2 border-retro-gold rounded-[50%] flex items-center justify-center">
            <span className="text-4xl">&#129370;</span>
          </div>
        </div>

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
