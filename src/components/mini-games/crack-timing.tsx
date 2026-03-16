"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";

interface CrackTimingProps {
  onComplete: (won: boolean) => void;
}

const ROUNDS = 3;
const WINS_NEEDED = 2;
const ZONE_WIDTH = 20;
const ZONE_START = 40;

export function CrackTiming({ onComplete }: CrackTimingProps) {
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [indicatorX, setIndicatorX] = useState(0);
  const [result, setResult] = useState<"hit" | "miss" | null>(null);
  const [active, setActive] = useState(true);
  const animFrame = useRef<number>(0);
  const startTime = useRef(Date.now());
  const ended = useRef(false);

  const speed = 0.08 + round * 0.03;

  useEffect(() => {
    if (!active) return;
    startTime.current = Date.now();

    function animate() {
      const elapsed = Date.now() - startTime.current;
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

      <button
        className="relative w-full h-12 bg-retro-dark border-2 border-retro-white/30 overflow-hidden touch-none"
        onClick={handleTap}
        onTouchStart={(e) => {
          e.preventDefault();
          handleTap();
        }}
      >
        <div
          className="absolute top-0 bottom-0 bg-retro-green/30 border-x-2 border-retro-green/60"
          style={{ left: `${ZONE_START}%`, width: `${ZONE_WIDTH}%` }}
        />

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

      <div className="w-16 h-20 bg-retro-gold/20 border-4 border-retro-gold rounded-[50%] flex items-center justify-center relative overflow-hidden">
        <span className="text-2xl">&#129370;</span>
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
