"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { RetroButton } from "./retro-button";
import type { Monster, EvolutionResult } from "@/lib/types";

type CutscenePhase = "announce" | "shaking" | "flash" | "reveal" | "done";

interface EvolutionCutsceneProps {
  monster: Monster;
  playerIndex: number;
  onComplete: (evolved: Monster) => void;
}

export function EvolutionCutscene({
  monster,
  playerIndex,
  onComplete,
}: EvolutionCutsceneProps) {
  const [phase, setPhase] = useState<CutscenePhase>("announce");
  const [evolved, setEvolved] = useState<Monster | null>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerEvolution = useCallback(async () => {
    try {
      const res = await fetch("/api/evolve-monster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monster_id: monster.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Evolution failed");
      }

      const data: EvolutionResult = await res.json();
      setEvolved(data.monster);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evolution failed");
    }
  }, [monster.id]);

  // Guard against double-triggering evolution (React Strict Mode
  // double-invokes effects, and the `evolved` state change can also
  // re-fire this effect while still in "announce" phase).
  const evolutionStarted = useRef(false);

  // Phase sequencing
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    if (phase === "announce") {
      if (!evolutionStarted.current) {
        evolutionStarted.current = true;
        triggerEvolution();
      }
      timers.push(setTimeout(() => setPhase("shaking"), 2000));
    } else if (phase === "shaking") {
      timers.push(setTimeout(() => setPhase("flash"), 2500));
    } else if (phase === "flash") {
      timers.push(setTimeout(() => setPhase("reveal"), 600));
    } else if (phase === "reveal" && evolved) {
      timers.push(setTimeout(() => setPhase("done"), 500));
    }

    return () => timers.forEach(clearTimeout);
  }, [phase, evolved, triggerEvolution]);

  // If we hit reveal but API hasn't returned yet, wait
  useEffect(() => {
    if (phase === "reveal" && evolved) {
      const t = setTimeout(() => setPhase("done"), 500);
      return () => clearTimeout(t);
    }
  }, [phase, evolved]);

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-retro-black">
        <p className="font-retro text-xs text-retro-accent">{error}</p>
        <RetroButton onClick={() => onComplete(monster)}>
          Continue
        </RetroButton>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-retro-black overflow-hidden">
      {/* Announce phase */}
      <AnimatePresence mode="wait">
        {phase === "announce" && (
          <motion.div
            key="announce"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <p className="font-retro text-[10px] text-retro-white/60">
              What&apos;s happening?!
            </p>
            <h2 className="font-retro text-sm text-retro-gold text-center">
              {monster.name} is evolving!
            </h2>
          </motion.div>
        )}

        {/* Shaking sprite */}
        {phase === "shaking" && (
          <motion.div
            key="shaking"
            className="relative h-40 w-40 overflow-hidden border-2 border-retro-gold bg-[#4a90d9]"
            animate={{
              x: [0, -4, 4, -6, 6, -3, 3, 0],
              filter: [
                "brightness(1)",
                "brightness(1.5)",
                "brightness(1)",
                "brightness(2)",
                "brightness(1)",
                "brightness(2.5)",
              ],
            }}
            transition={{
              x: { duration: 2.5, repeat: Infinity, ease: "linear" },
              filter: { duration: 2.5, ease: "easeIn" },
            }}
          >
            <Image
              src={monster.image_url}
              alt={monster.name}
              fill
              className="object-contain"
              unoptimized
            />
          </motion.div>
        )}

        {/* White flash */}
        {phase === "flash" && (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.6, times: [0, 0.1, 0.7, 1] }}
            className="fixed inset-0 bg-white z-50"
          />
        )}

        {/* Reveal new form */}
        {(phase === "reveal" || phase === "done") && evolved && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, scale: 1.2 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative h-40 w-40 overflow-hidden border-2 border-retro-gold bg-[#4a90d9]">
              <Image
                src={evolved.image_url}
                alt={evolved.name}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <h2 className="font-retro text-sm text-retro-gold text-center">
              {evolved.name} evolved to Stage {evolved.stage}!
            </h2>

            {/* Stat deltas */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[8px] font-retro">
              <StatDelta label="HP" before={monster.hp} after={evolved.hp} />
              <StatDelta label="ATK" before={monster.attack} after={evolved.attack} />
              <StatDelta label="DEF" before={monster.defense} after={evolved.defense} />
              <StatDelta label="SPD" before={monster.speed} after={evolved.speed} />
            </div>

            {/* New moves */}
            {evolved.moves && evolved.moves.length > 0 && (
              <div className="flex flex-col items-center gap-1 mt-2">
                <span className="font-retro text-[7px] text-retro-white/40 uppercase">New Moves</span>
                <div className="flex gap-3">
                  {evolved.moves.map((move) => (
                    <span key={move.name} className="font-retro text-[8px] text-retro-gold">
                      {move.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {phase === "done" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <RetroButton onClick={() => onComplete(evolved)}>
                  Continue
                </RetroButton>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Waiting for API during reveal */}
        {phase === "reveal" && !evolved && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="h-40 w-40 border-2 border-retro-gold bg-[#4a90d9] animate-pulse" />
            <p className="font-retro text-[10px] text-retro-white/50 animate-pulse">
              Evolving...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatDelta({
  label,
  before,
  after,
}: {
  label: string;
  before: number;
  after: number;
}) {
  const diff = after - before;
  return (
    <div className="flex justify-between gap-3">
      <span className="text-retro-white/60">{label}</span>
      <span>
        <span className="text-retro-white/40">{before}</span>
        <span className="text-retro-white/30"> → </span>
        <span className="text-retro-white">{after}</span>
        {diff > 0 && (
          <span className="text-retro-green ml-1">+{diff}</span>
        )}
      </span>
    </div>
  );
}
