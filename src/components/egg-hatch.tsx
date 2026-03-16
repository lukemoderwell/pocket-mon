"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RetroButton } from "./retro-button";
import {
  TapFrenzy,
  EggRoll,
  ShellScratch,
  WarmTheEgg,
  EggToss,
  CrackTiming,
} from "./mini-games";

type HatchPhase = "intro" | "minigame" | "hatching" | "failed";

interface EggHatchProps {
  motherName: string;
  fatherName: string;
  onHatch: () => void;
  onFail: () => void;
}

const MINI_GAMES = [
  { name: "Tap Frenzy", component: TapFrenzy },
  { name: "Egg Roll", component: EggRoll },
  { name: "Shell Scratch", component: ShellScratch },
  { name: "Warm the Egg", component: WarmTheEgg },
  { name: "Egg Toss", component: EggToss },
  { name: "Crack Timing", component: CrackTiming },
] as const;

export function EggHatch({ motherName, fatherName, onHatch, onFail }: EggHatchProps) {
  const [phase, setPhase] = useState<HatchPhase>("intro");

  const selectedGame = useMemo(
    () => MINI_GAMES[Math.floor(Math.random() * MINI_GAMES.length)],
    []
  );

  const handleGameComplete = useCallback(
    (won: boolean) => {
      setPhase(won ? "hatching" : "failed");
    },
    []
  );

  useEffect(() => {
    if (phase === "hatching") {
      const timer = setTimeout(() => onHatch(), 2500);
      return () => clearTimeout(timer);
    }
  }, [phase, onHatch]);

  const CurrentGame = phase === "minigame" ? selectedGame.component : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-retro-black overflow-hidden">
      <AnimatePresence mode="wait">
        {phase === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-24 h-28 bg-retro-gold/20 border-4 border-retro-gold rounded-[50%] flex items-center justify-center"
            >
              <span className="text-3xl">&#129370;</span>
            </motion.div>
            <div className="text-center">
              <p className="font-retro text-[10px] text-retro-white/60 mb-2">An egg appeared!</p>
              <p className="font-retro text-[8px] text-retro-white/40">{motherName} + {fatherName}</p>
            </div>
            <div className="text-center">
              <p className="font-retro text-[8px] text-retro-white/50 mb-3">
                Complete the mini-game to hatch the egg!
              </p>
            </div>
            <RetroButton onClick={() => setPhase("minigame")}>Start!</RetroButton>
          </motion.div>
        )}

        {phase === "minigame" && CurrentGame && (
          <motion.div
            key="game"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="flex flex-col items-center gap-4 w-full px-6"
          >
            <CurrentGame onComplete={handleGameComplete} />
          </motion.div>
        )}

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

        {phase === "failed" && (
          <motion.div
            key="failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div className="w-24 h-28 bg-retro-white/5 border-4 border-retro-white/20 rounded-[50%] flex items-center justify-center">
              <span className="text-3xl opacity-50">&#129370;</span>
            </motion.div>
            <p className="font-retro text-[10px] text-retro-accent">The egg didn&apos;t hatch...</p>
            <p className="font-retro text-[8px] text-retro-white/40">Maybe next time!</p>
            <RetroButton onClick={onFail} variant="secondary">Back</RetroButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
