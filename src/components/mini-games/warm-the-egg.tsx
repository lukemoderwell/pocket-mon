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

  useEffect(() => {
    if (!started || ended.current) return;
    if (totalAngle >= TARGET_ANGLE) {
      ended.current = true;
      setTimeout(() => onComplete(true), 500);
    }
  }, [totalAngle, started, onComplete]);

  const progress = Math.min(1, totalAngle / TARGET_ANGLE);
  const tempHue = 240 - progress * 240;

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
        <div className="absolute w-44 h-44 rounded-full border-2 border-dashed border-retro-white/15" />

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
