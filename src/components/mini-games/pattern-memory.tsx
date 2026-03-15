"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface PatternMemoryProps {
  onComplete: (won: boolean) => void;
}

const ARROWS = ["up", "down", "left", "right"] as const;
type Arrow = (typeof ARROWS)[number];

const ARROW_SYMBOLS: Record<Arrow, string> = {
  up: "\u25B2",
  down: "\u25BC",
  left: "\u25C0",
  right: "\u25B6",
};

const SEQUENCE_LENGTH = 4;
const SHOW_DELAY = 600; // ms between showing each arrow

export function PatternMemory({ onComplete }: PatternMemoryProps) {
  const [phase, setPhase] = useState<"ready" | "showing" | "input" | "result">("ready");
  const [sequence, setSequence] = useState<Arrow[]>([]);
  const [showIndex, setShowIndex] = useState(-1);
  const [inputIndex, setInputIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const ended = useRef(false);

  // Generate random sequence
  useEffect(() => {
    const seq: Arrow[] = [];
    for (let i = 0; i < SEQUENCE_LENGTH; i++) {
      seq.push(ARROWS[Math.floor(Math.random() * ARROWS.length)]);
    }
    setSequence(seq);
  }, []);

  // Show sequence one by one
  const startShowing = useCallback(() => {
    setPhase("showing");
    setShowIndex(0);
  }, []);

  useEffect(() => {
    if (phase !== "showing") return;
    if (showIndex >= SEQUENCE_LENGTH) {
      setTimeout(() => setPhase("input"), 400);
      return;
    }

    const timer = setTimeout(() => {
      setShowIndex((i: number) => i + 1);
    }, SHOW_DELAY);

    return () => clearTimeout(timer);
  }, [phase, showIndex]);

  const handleInput = useCallback(
    (arrow: Arrow) => {
      if (phase !== "input") return;

      if (arrow === sequence[inputIndex]) {
        const nextIndex = inputIndex + 1;
        setInputIndex(nextIndex);

        if (nextIndex >= SEQUENCE_LENGTH) {
          setPhase("result");
          if (!ended.current) {
            ended.current = true;
            setTimeout(() => onComplete(mistakes === 0), 800);
          }
        }
      } else {
        setMistakes((m: number) => {
          const newMistakes = m + 1;
          if (newMistakes >= 2) {
            setPhase("result");
            if (!ended.current) {
              ended.current = true;
              setTimeout(() => onComplete(false), 800);
            }
          }
          return newMistakes;
        });
      }
    },
    [phase, sequence, inputIndex, mistakes, onComplete]
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-retro text-[10px] text-retro-gold uppercase">
        Pattern Memory!
      </p>
      <p className="font-retro text-[8px] text-retro-white/60">
        {phase === "ready" && "Watch the pattern, then repeat it!"}
        {phase === "showing" && "Watch carefully..."}
        {phase === "input" && `Repeat the pattern! (${inputIndex}/${SEQUENCE_LENGTH})`}
        {phase === "result" && (mistakes < 2 ? "Perfect!" : "Too many mistakes!")}
      </p>

      {/* Display area */}
      <div className="w-24 h-24 flex items-center justify-center border-2 border-retro-white/30 bg-retro-dark">
        <AnimatePresence mode="wait">
          {phase === "showing" && showIndex < SEQUENCE_LENGTH && (
            <motion.span
              key={`show-${showIndex}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-4xl text-retro-gold"
            >
              {ARROW_SYMBOLS[sequence[showIndex]]}
            </motion.span>
          )}
          {phase === "result" && (
            <motion.span
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              className={`font-retro text-sm ${mistakes < 2 ? "text-retro-green" : "text-retro-accent"}`}
            >
              {mistakes < 2 ? "OK!" : "X"}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Arrow buttons */}
      <div className="grid grid-cols-3 gap-2 w-36">
        <div />
        <ArrowButton
          arrow="up"
          onPress={handleInput}
          disabled={phase !== "input"}
        />
        <div />
        <ArrowButton
          arrow="left"
          onPress={handleInput}
          disabled={phase !== "input"}
        />
        <ArrowButton
          arrow="down"
          onPress={handleInput}
          disabled={phase !== "input"}
        />
        <ArrowButton
          arrow="right"
          onPress={handleInput}
          disabled={phase !== "input"}
        />
      </div>

      {phase === "ready" && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={startShowing}
          className="font-retro text-[10px] text-retro-gold border-2 border-retro-gold px-4 py-2 hover:bg-retro-gold/10"
        >
          Ready!
        </motion.button>
      )}
    </div>
  );
}

function ArrowButton({
  arrow,
  onPress,
  disabled,
}: {
  arrow: Arrow;
  onPress: (a: Arrow) => void;
  disabled: boolean;
}) {
  return (
    <motion.button
      whileTap={disabled ? {} : { scale: 0.85 }}
      onClick={() => !disabled && onPress(arrow)}
      disabled={disabled}
      className={`w-10 h-10 flex items-center justify-center border-2 text-xl transition-colors ${
        disabled
          ? "border-retro-white/10 text-retro-white/20"
          : "border-retro-white/50 text-retro-white hover:bg-retro-white/10 active:bg-retro-white/20"
      }`}
    >
      {ARROW_SYMBOLS[arrow]}
    </motion.button>
  );
}
