"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useGameStore } from "@/lib/store";
import { MonsterCard } from "@/components/monster-card";
import { RetroButton } from "@/components/retro-button";
import { RetroCard } from "@/components/retro-card";

export default function ResultsPage() {
  const router = useRouter();
  const { players, tournament, reset } = useGameStore();

  const champion =
    tournament?.champion !== null && tournament?.champion !== undefined
      ? players[tournament.champion]
      : null;

  useEffect(() => {
    if (!tournament || tournament.champion === null) {
      router.push("/");
    }
  }, [tournament, router]);

  function handlePlayAgain() {
    reset();
    router.push("/");
  }

  if (!tournament || !champion) return null;

  // Build round summary
  const completedMatches = tournament.matches.filter(
    (m) => m.winner !== null && m.playerA !== null && m.playerB !== null
  );

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", bounce: 0.5 }}
      >
        <h1 className="font-retro text-sm text-retro-gold text-center">
          Champion!
        </h1>
      </motion.div>

      {champion.monster && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <MonsterCard monster={champion.monster} highlight />
          <p className="font-retro text-[8px] text-retro-white/50 text-center mt-2">
            {champion.name}&apos;s monster
          </p>
        </motion.div>
      )}

      {/* Match Results */}
      {completedMatches.length > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="w-full max-w-xs"
        >
          <RetroCard>
            <h2 className="font-retro text-[10px] text-retro-gold mb-2 text-center">
              Match Results
            </h2>
            <div className="flex flex-col gap-1">
              {completedMatches.map((match, i) => {
                const winnerName =
                  players[match.winner!]?.monster?.name ?? "???";
                const loserIdx =
                  match.winner === match.playerA
                    ? match.playerB!
                    : match.playerA!;
                const loserName =
                  players[loserIdx]?.monster?.name ?? "???";

                return (
                  <div
                    key={i}
                    className="flex justify-between font-retro text-[8px]"
                  >
                    <span className="text-retro-green">{winnerName}</span>
                    <span className="text-retro-white/30">beat</span>
                    <span className="text-retro-accent">{loserName}</span>
                  </div>
                );
              })}
            </div>
          </RetroCard>
        </motion.div>
      )}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="font-retro text-[8px] text-retro-green"
      >
        {completedMatches.length} battle{completedMatches.length !== 1 ? "s" : ""} recorded!
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <RetroButton onClick={handlePlayAgain}>Play Again</RetroButton>
      </motion.div>
    </div>
  );
}
