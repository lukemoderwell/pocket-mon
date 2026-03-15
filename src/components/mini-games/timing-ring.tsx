"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";

interface TimingRingProps {
  onComplete: (won: boolean) => void;
}

const RING_DURATION = 2000; // ms for ring to shrink
const HIT_WINDOW = 0.15; // ±15% of target size is a hit
const ROUNDS = 3;

export function TimingRing({ onComplete }: TimingRingProps) {
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [ringScale, setRingScale] = useState(2.5);
  const [result, setResult] = useState<"hit" | "miss" | null>(null);
  const [started, setStarted] = useState(false);
  const animFrame = useRef<number>(0);
  const startTime = useRef(0);
  const ended = useRef(false);

  const startRound = useCallback(() => {
    setRingScale(2.5);
    setResult(null);
    startTime.current = Date.now();

    function animate() {
      const elapsed = Date.now() - startTime.current;
      const progress = Math.min(1, elapsed / RING_DURATION);
      // Shrink from 2.5 to 0.5
      const scale = 2.5 - progress * 2.0;
      setRingScale(scale);

      if (progress < 1) {
        animFrame.current = requestAnimationFrame(animate);
      } else {
        // Missed - ring shrank past target
        setResult("miss");
        setTimeout(() => {
          advanceRound(false);
        }, 500);
      }
    }

    animFrame.current = requestAnimationFrame(animate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const advanceRound = useCallback(
    (wasHit: boolean) => {
      const newHits = wasHit ? hits + 1 : hits;
      if (wasHit) setHits(newHits);
      const newRound = round + 1;

      if (newRound >= ROUNDS) {
        if (!ended.current) {
          ended.current = true;
          setTimeout(() => onComplete(newHits >= 2), 500);
        }
        return;
      }

      setRound(newRound);
      setTimeout(() => startRound(), 600);
    },
    [hits, round, onComplete, startRound]
  );

  useEffect(() => {
    if (!started) return;
    startRound();
    return () => cancelAnimationFrame(animFrame.current);
  }, [started, startRound]);

  const handleTap = useCallback(() => {
    if (!started) {
      setStarted(true);
      return;
    }
    if (result !== null) return;

    cancelAnimationFrame(animFrame.current);

    // Target is scale 1.0, check if within window
    const distance = Math.abs(ringScale - 1.0);
    const wasHit = distance <= HIT_WINDOW * 2;

    setResult(wasHit ? "hit" : "miss");
    setTimeout(() => advanceRound(wasHit), 500);
  }, [started, result, ringScale, advanceRound]);

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-retro text-[10px] text-retro-gold uppercase">
        Timing Ring!
      </p>
      <p className="font-retro text-[8px] text-retro-white/60">
        {!started ? "Tap to start!" : `Hit when the ring aligns! (${round + 1}/${ROUNDS})`}
      </p>

      {/* Score */}
      <div className="flex gap-2">
        {Array.from({ length: ROUNDS }).map((_, i) => (
          <span
            key={i}
            className={`w-3 h-3 border-2 ${
              i < hits
                ? "bg-retro-green border-retro-green"
                : i < round
                ? "bg-retro-accent border-retro-accent"
                : "border-retro-white/30"
            }`}
          />
        ))}
      </div>

      {/* Ring area */}
      <button
        onClick={handleTap}
        className="relative w-48 h-48 flex items-center justify-center"
      >
        {/* Target ring (fixed) */}
        <div className="absolute w-20 h-20 rounded-full border-4 border-retro-gold/60" />

        {/* Shrinking ring */}
        {started && (
          <motion.div
            className={`absolute rounded-full border-4 ${
              result === "hit"
                ? "border-retro-green"
                : result === "miss"
                ? "border-retro-accent"
                : "border-retro-white"
            }`}
            style={{
              width: `${ringScale * 80}px`,
              height: `${ringScale * 80}px`,
            }}
          />
        )}

        {/* Result flash */}
        {result && (
          <motion.p
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`font-retro text-xs ${
              result === "hit" ? "text-retro-green" : "text-retro-accent"
            }`}
          >
            {result === "hit" ? "HIT!" : "MISS!"}
          </motion.p>
        )}

        {!started && (
          <p className="font-retro text-[10px] text-retro-white/40">TAP</p>
        )}
      </button>
    </div>
  );
}
