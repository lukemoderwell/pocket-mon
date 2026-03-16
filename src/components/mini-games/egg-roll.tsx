"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";

interface EggRollProps {
  onComplete: (won: boolean) => void;
}

interface Obstacle {
  id: number;
  x: number;
  y: number;
  width: number;
}

const DURATION = 6000;
const OBSTACLE_COUNT = 6;
const EGG_SIZE = 12;

export function EggRoll({ onComplete }: EggRollProps) {
  const [started, setStarted] = useState(false);
  const [eggX, setEggX] = useState(50);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [hits, setHits] = useState(0);
  const [progress, setProgress] = useState(0);
  const gameArea = useRef<HTMLDivElement>(null);
  const ended = useRef(false);

  useEffect(() => {
    const obs: Obstacle[] = [];
    for (let i = 0; i < OBSTACLE_COUNT; i++) {
      const width = 25 + Math.random() * 30;
      obs.push({
        id: i,
        x: Math.random() * (100 - width),
        y: 100 + (i + 1) * 20,
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

  useEffect(() => {
    if (!started || ended.current) return;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(1, elapsed / DURATION);
      setProgress(pct);

      setObstacles((prev) =>
        prev.map((o) => ({ ...o, y: o.y - 0.8 }))
      );

      const eggY = 15;
      setObstacles((prev) => {
        let newHits = 0;
        const updated = prev.map((o) => {
          if (o.y < -10) return o;
          // Read current eggX via setter to avoid stale closure
          let currentEggX = 50;
          setEggX((ex: number) => {
            currentEggX = ex;
            return ex;
          });
          const eggLeft = currentEggX - EGG_SIZE / 2;
          const eggRight = currentEggX + EGG_SIZE / 2;
          const obsLeft = o.x;
          const obsRight = o.x + o.width;
          const verticalOverlap = Math.abs(o.y - eggY) < 6;
          const horizontalOverlap = eggLeft < obsRight && eggRight > obsLeft;

          if (verticalOverlap && horizontalOverlap && o.y > -10) {
            newHits++;
            return { ...o, y: -20 };
          }
          return o;
        });

        if (newHits > 0) {
          setHits((h: number) => {
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
        setHits((h: number) => {
          setTimeout(() => onComplete(h < 2), 500);
          return h;
        });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [started, onComplete]);

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
        onClick={(e: React.MouseEvent) => {
          if (!started) setStarted(true);
          handleMove(e.clientX);
        }}
        onMouseMove={(e: React.MouseEvent) => handleMove(e.clientX)}
        onTouchStart={(e: React.TouchEvent) => {
          if (!started) setStarted(true);
          handleMove(e.touches[0].clientX);
        }}
        onTouchMove={(e: React.TouchEvent) => {
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
        {obstacles.map((o: Obstacle) => (
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
