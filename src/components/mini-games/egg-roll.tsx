"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface EggRollProps {
  onComplete: (won: boolean) => void;
}

const ICONS = ["🔥", "💧", "🌿", "⚡"];
const ROUNDS = 5;
const SHOW_TIME = 1200; // ms to show pattern before input
const TIME_LIMIT = 4000; // ms to complete input per round

export function EggRoll({ onComplete }: EggRollProps) {
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<"showing" | "input" | "feedback">("showing");
  const [round, setRound] = useState(0);
  const [pattern, setPattern] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [timeLeft, setTimeLeft] = useState(1);
  const ended = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generatePattern = useCallback((roundNum: number) => {
    const length = roundNum + 2; // starts at 2, grows each round
    return Array.from({ length }, () => Math.floor(Math.random() * ICONS.length));
  }, []);

  const startRound = useCallback((roundNum: number) => {
    const newPattern = generatePattern(roundNum);
    setPattern(newPattern);
    setPlayerInput([]);
    setPhase("showing");
    setFeedback(null);
    setTimeLeft(1);

    // After showing, switch to input phase
    setTimeout(() => {
      setPhase("input");
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 1 - elapsed / TIME_LIMIT);
        setTimeLeft(remaining);
        if (remaining <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Time ran out = mistake
          if (!ended.current) {
            setMistakes((m) => {
              const total = m + 1;
              if (total >= 2) {
                ended.current = true;
                setFeedback("wrong");
                setTimeout(() => onComplete(false), 800);
              } else {
                setFeedback("wrong");
                setTimeout(() => {
                  if (roundNum + 1 >= ROUNDS) {
                    ended.current = true;
                    onComplete(true);
                  } else {
                    setRound(roundNum + 1);
                  }
                }, 800);
              }
              return total;
            });
          }
        }
      }, 50);
    }, SHOW_TIME);
  }, [generatePattern, onComplete]);

  // Start first round
  useEffect(() => {
    if (started && round === 0) {
      startRound(0);
    }
  }, [started, round, startRound]);

  // Start subsequent rounds
  useEffect(() => {
    if (started && round > 0 && !ended.current) {
      startRound(round);
    }
  }, [round, started, startRound]);

  const handleTap = useCallback((iconIndex: number) => {
    if (phase !== "input" || ended.current) return;

    const nextInput = [...playerInput, iconIndex];
    setPlayerInput(nextInput);

    const pos = nextInput.length - 1;

    // Wrong input
    if (pattern[pos] !== iconIndex) {
      if (timerRef.current) clearInterval(timerRef.current);
      setMistakes((m) => {
        const total = m + 1;
        if (total >= 2) {
          ended.current = true;
          setFeedback("wrong");
          setTimeout(() => onComplete(false), 800);
        } else {
          setFeedback("wrong");
          setTimeout(() => {
            if (round + 1 >= ROUNDS) {
              ended.current = true;
              onComplete(true);
            } else {
              setRound((r) => r + 1);
            }
          }, 800);
        }
        return total;
      });
      return;
    }

    // Completed pattern correctly
    if (nextInput.length === pattern.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      setFeedback("correct");
      setTimeout(() => {
        if (round + 1 >= ROUNDS) {
          if (!ended.current) {
            ended.current = true;
            onComplete(true);
          }
        } else {
          setRound((r) => r + 1);
        }
      }, 600);
    }
  }, [phase, playerInput, pattern, round, onComplete]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!started) {
    return (
      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        <p className="font-retro text-[10px] text-retro-gold uppercase">Pattern Match!</p>
        <p className="font-retro text-[8px] text-retro-white/60">
          Memorize the pattern, then repeat it!
        </p>
        <button
          onClick={() => setStarted(true)}
          className="font-retro text-[10px] text-retro-white/40 animate-pulse"
        >
          TAP TO START
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-xs">
      <p className="font-retro text-[10px] text-retro-gold uppercase">Pattern Match!</p>

      {/* Round indicator */}
      <div className="flex gap-1">
        {Array.from({ length: ROUNDS }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 border border-retro-white/40 ${
              i < round ? "bg-retro-green" : i === round ? "bg-retro-gold" : "bg-transparent"
            }`}
          />
        ))}
      </div>

      {/* Mistakes */}
      <div className="flex gap-1">
        <span className={`font-retro text-[7px] ${mistakes >= 1 ? "text-retro-accent" : "text-retro-white/20"}`}>✕</span>
        <span className={`font-retro text-[7px] ${mistakes >= 2 ? "text-retro-accent" : "text-retro-white/20"}`}>✕</span>
      </div>

      {/* Timer bar (input phase only) */}
      {phase === "input" && (
        <div className="w-full h-2 bg-retro-dark border border-retro-white/30">
          <motion.div
            className={`h-full ${timeLeft > 0.3 ? "bg-retro-green" : "bg-retro-accent"}`}
            style={{ width: `${timeLeft * 100}%` }}
          />
        </div>
      )}

      {/* Pattern display */}
      <div className="w-full min-h-[48px] flex items-center justify-center gap-2 py-2">
        <AnimatePresence mode="wait">
          {phase === "showing" && (
            <motion.div
              key={`show-${round}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex gap-2"
            >
              {pattern.map((iconIdx, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="text-xl"
                >
                  {ICONS[iconIdx]}
                </motion.span>
              ))}
            </motion.div>
          )}

          {phase === "input" && !feedback && (
            <motion.div
              key={`input-${round}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2"
            >
              {pattern.map((_, i) => (
                <span
                  key={i}
                  className={`text-xl ${i < playerInput.length ? "" : "opacity-20"}`}
                >
                  {i < playerInput.length ? ICONS[playerInput[i]] : "?"}
                </span>
              ))}
            </motion.div>
          )}

          {feedback && (
            <motion.p
              key={`feedback-${round}`}
              initial={{ opacity: 0, scale: 1.3 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`font-retro text-[10px] ${
                feedback === "correct" ? "text-retro-green" : "text-retro-accent"
              }`}
            >
              {feedback === "correct" ? "Correct!" : "Wrong!"}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Input buttons */}
      <div className="grid grid-cols-4 gap-2 w-full">
        {ICONS.map((icon, i) => (
          <button
            key={i}
            onClick={() => handleTap(i)}
            disabled={phase !== "input" || !!feedback}
            className={`h-14 border-2 rounded flex items-center justify-center text-2xl transition-colors ${
              phase === "input" && !feedback
                ? "border-retro-white/40 bg-retro-dark active:bg-retro-white/20 active:border-retro-gold"
                : "border-retro-white/10 bg-retro-dark/50 opacity-50"
            }`}
          >
            {icon}
          </button>
        ))}
      </div>

      <p className="font-retro text-[7px] text-retro-white/30">
        {phase === "showing" ? "Memorize..." : phase === "input" && !feedback ? "Your turn!" : ""}
      </p>
    </div>
  );
}
