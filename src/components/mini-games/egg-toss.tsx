"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface EggTossProps {
  onComplete: (won: boolean) => void;
}

const ROUNDS = 3;
const WINS_NEEDED = 2;
const NEST_TOLERANCE = 12;

export function EggToss({ onComplete }: EggTossProps) {
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [eggY, setEggY] = useState(85);
  const [tossing, setTossing] = useState(false);
  const [result, setResult] = useState<"hit" | "miss" | null>(null);
  const [nestY] = useState(() => 20 + Math.random() * 40);
  const touchStart = useRef<{ y: number; time: number } | null>(null);
  const ended = useRef(false);

  const handleTossEnd = useCallback(
    (endY: number) => {
      if (tossing || ended.current) return;
      const start = touchStart.current;
      if (!start) return;

      const dy = start.y - endY;
      const dt = Date.now() - start.time;
      if (dy < 20 || dt > 1000) {
        touchStart.current = null;
        return;
      }

      const velocity = dy / dt;
      const targetY = Math.max(5, Math.min(85, 85 - velocity * 60));

      setTossing(true);
      setEggY(targetY);

      setTimeout(() => {
        const isHit = Math.abs(targetY - nestY) < NEST_TOLERANCE;
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
        <div
          className="absolute left-1/2 -translate-x-1/2 w-16 h-6 flex items-center justify-center"
          style={{ top: `${nestY}%` }}
        >
          <div className="w-14 h-5 bg-retro-gold/20 border-2 border-retro-gold rounded-b-lg" />
        </div>

        <div
          className="absolute left-0 right-0 border-t border-b border-dashed border-retro-green/20"
          style={{
            top: `${nestY - NEST_TOLERANCE}%`,
            height: `${NEST_TOLERANCE * 2}%`,
          }}
        />

        <motion.div
          className="absolute left-1/2 -translate-x-1/2 w-10 h-12 bg-retro-gold/60 border-2 border-retro-gold rounded-[50%] flex items-center justify-center"
          animate={{ top: `${eggY}%` }}
          transition={{ type: "spring", damping: 15, stiffness: 200 }}
        >
          <span className="text-lg">&#129370;</span>
        </motion.div>

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
