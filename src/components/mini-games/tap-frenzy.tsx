"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";

interface TapFrenzyProps {
  onComplete: (won: boolean) => void;
}

const DURATION = 5000; // 5 seconds
const TARGET = 20; // taps needed to win

export function TapFrenzy({ onComplete }: TapFrenzyProps) {
  const [taps, setTaps] = useState(0);
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const startTime = useRef<number>(0);
  const ended = useRef(false);

  const handleTap = useCallback(() => {
    if (!started) {
      setStarted(true);
      startTime.current = Date.now();
      return;
    }
    setTaps((t: number) => t + 1);
  }, [started]);

  useEffect(() => {
    if (!started || ended.current) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      const remaining = Math.max(0, DURATION - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        ended.current = true;
        clearInterval(interval);
        // Check after one more render
        setTaps((current: number) => {
          setTimeout(() => onComplete(current >= TARGET), 500);
          return current;
        });
      }
    }, 50);
    return () => clearInterval(interval);
  }, [started, onComplete]);

  const progress = Math.min(1, taps / TARGET);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-xs">
      <p className="font-retro text-[10px] text-retro-gold uppercase">
        Tap Frenzy!
      </p>
      <p className="font-retro text-[8px] text-retro-white/60">
        {!started ? "Tap to start!" : `Tap ${TARGET} times!`}
      </p>

      {/* Timer */}
      {started && (
        <div className="w-full h-2 bg-retro-dark border border-retro-white/30">
          <motion.div
            className="h-full bg-retro-accent"
            style={{ width: `${(timeLeft / DURATION) * 100}%` }}
          />
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full h-6 bg-retro-dark border-2 border-retro-white/40 relative">
        <motion.div
          className="h-full bg-retro-green"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.1 }}
        />
        <span className="absolute inset-0 flex items-center justify-center font-retro text-[8px] text-white">
          {taps}/{TARGET}
        </span>
      </div>

      {/* Tap button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleTap}
        className="w-32 h-32 rounded-full bg-retro-accent border-4 border-retro-gold font-retro text-sm text-white uppercase shadow-[4px_4px_0_0_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-none"
      >
        TAP!
      </motion.button>
    </div>
  );
}
