"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { RetroButton } from "./retro-button";
import { TapFrenzy, TimingRing, PatternMemory, EggCatch } from "./mini-games";
import type { Monster } from "@/lib/types";

type HatchPhase =
  | "intro"
  | "minigame"
  | "minigame-result"
  | "hatching"
  | "reveal"
  | "failed";

interface EggHatchProps {
  motherName: string;
  fatherName: string;
  /** Called after the egg successfully hatches — triggers the breed API */
  onHatch: () => void;
  /** Called if the player fails the mini-games */
  onFail: () => void;
}

const MINI_GAMES = [
  { name: "Tap Frenzy", component: TapFrenzy },
  { name: "Timing Ring", component: TimingRing },
  { name: "Pattern Memory", component: PatternMemory },
  { name: "Egg Catch", component: EggCatch },
] as const;

const GAMES_TO_PLAY = 3;
const WINS_NEEDED = 2;

export function EggHatch({ motherName, fatherName, onHatch, onFail }: EggHatchProps) {
  const [phase, setPhase] = useState<HatchPhase>("intro");
  const [gameIndex, setGameIndex] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [lastResult, setLastResult] = useState<boolean | null>(null);

  // Pick 3 random mini-games (no repeats)
  const selectedGames = useMemo(() => {
    const shuffled = [...MINI_GAMES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, GAMES_TO_PLAY);
  }, []);

  const handleGameComplete = useCallback(
    (won: boolean) => {
      setLastResult(won);
      const newWins = won ? wins + 1 : wins;
      const newLosses = won ? losses : losses + 1;

      if (won) setWins(newWins);
      else setLosses(newLosses);

      setPhase("minigame-result");
    },
    [wins, losses]
  );

  const advanceFromResult = useCallback(() => {
    const nextIndex = gameIndex + 1;

    // Check if already won enough
    if (wins + (lastResult ? 1 : 0) >= WINS_NEEDED && lastResult) {
      // Already counted the win in handleGameComplete
      setPhase("hatching");
      return;
    }

    // Check if can't win anymore
    const gamesLeft = GAMES_TO_PLAY - nextIndex;
    if (losses + (lastResult ? 0 : 1) > GAMES_TO_PLAY - WINS_NEEDED && !lastResult) {
      setPhase("failed");
      return;
    }

    if (nextIndex >= GAMES_TO_PLAY) {
      // All games done, check final score
      if (wins >= WINS_NEEDED) {
        setPhase("hatching");
      } else {
        setPhase("failed");
      }
      return;
    }

    setGameIndex(nextIndex);
    setPhase("minigame");
  }, [gameIndex, wins, losses, lastResult]);

  // Auto-advance from hatching to onHatch
  useEffect(() => {
    if (phase === "hatching") {
      const timer = setTimeout(() => onHatch(), 2500);
      return () => clearTimeout(timer);
    }
  }, [phase, onHatch]);

  const CurrentGame = phase === "minigame" ? selectedGames[gameIndex]?.component : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-retro-black overflow-hidden">
      <AnimatePresence mode="wait">
        {/* ─── Intro ─── */}
        {phase === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6"
          >
            {/* Egg sprite */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-24 h-28 bg-retro-gold/20 border-4 border-retro-gold rounded-[50%] flex items-center justify-center"
            >
              <span className="text-3xl">&#129370;</span>
            </motion.div>

            <div className="text-center">
              <p className="font-retro text-[10px] text-retro-white/60 mb-2">
                An egg appeared!
              </p>
              <p className="font-retro text-[8px] text-retro-white/40">
                {motherName} + {fatherName}
              </p>
            </div>

            <div className="text-center">
              <p className="font-retro text-[8px] text-retro-white/50 mb-3">
                Complete mini-games to hatch the egg!
              </p>
              <p className="font-retro text-[7px] text-retro-white/30">
                Win {WINS_NEEDED}/{GAMES_TO_PLAY} games
              </p>
            </div>

            <RetroButton onClick={() => setPhase("minigame")}>
              Start!
            </RetroButton>
          </motion.div>
        )}

        {/* ─── Mini-game ─── */}
        {phase === "minigame" && CurrentGame && (
          <motion.div
            key={`game-${gameIndex}`}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="flex flex-col items-center gap-4 w-full px-6"
          >
            {/* Progress */}
            <div className="flex gap-2 mb-2">
              {selectedGames.map((_: unknown, i: number) => (
                <span
                  key={i}
                  className={`w-3 h-3 border-2 ${
                    i < gameIndex
                      ? i < wins
                        ? "bg-retro-green border-retro-green"
                        : "bg-retro-accent border-retro-accent"
                      : i === gameIndex
                      ? "border-retro-gold"
                      : "border-retro-white/20"
                  }`}
                />
              ))}
            </div>

            <CurrentGame onComplete={handleGameComplete} />
          </motion.div>
        )}

        {/* ─── Mini-game result ─── */}
        {phase === "minigame-result" && (
          <motion.div
            key="result"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.3 }}
              className={`font-retro text-lg ${
                lastResult ? "text-retro-green" : "text-retro-accent"
              }`}
            >
              {lastResult ? "SUCCESS!" : "FAILED!"}
            </motion.div>

            <div className="flex gap-2">
              {Array.from({ length: GAMES_TO_PLAY }).map((_, i) => {
                const completed = i < gameIndex + 1;
                const isWin = i < wins + (i === gameIndex && lastResult ? 1 : 0);
                return (
                  <span
                    key={i}
                    className={`w-3 h-3 border-2 ${
                      completed
                        ? isWin
                          ? "bg-retro-green border-retro-green"
                          : "bg-retro-accent border-retro-accent"
                        : "border-retro-white/20"
                    }`}
                  />
                );
              })}
            </div>

            <RetroButton onClick={advanceFromResult}>
              Continue
            </RetroButton>
          </motion.div>
        )}

        {/* ─── Hatching animation ─── */}
        {phase === "hatching" && (
          <motion.div
            key="hatching"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              animate={{
                x: [0, -6, 6, -8, 8, -4, 4, 0],
                rotate: [0, -5, 5, -8, 8, -3, 3, 0],
              }}
              transition={{ duration: 1.5, repeat: 1 }}
              className="w-24 h-28 bg-retro-gold/20 border-4 border-retro-gold rounded-[50%] flex items-center justify-center"
            >
              <span className="text-3xl">&#129370;</span>
            </motion.div>

            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="font-retro text-sm text-retro-gold"
            >
              Hatching...!
            </motion.p>
          </motion.div>
        )}

        {/* ─── Failed ─── */}
        {phase === "failed" && (
          <motion.div
            key="failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              className="w-24 h-28 bg-retro-white/5 border-4 border-retro-white/20 rounded-[50%] flex items-center justify-center"
            >
              <span className="text-3xl opacity-50">&#129370;</span>
            </motion.div>

            <p className="font-retro text-[10px] text-retro-accent">
              The egg didn&apos;t hatch...
            </p>
            <p className="font-retro text-[8px] text-retro-white/40">
              Maybe next time!
            </p>

            <RetroButton onClick={onFail} variant="secondary">
              Back
            </RetroButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
