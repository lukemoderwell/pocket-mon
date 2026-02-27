"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useGameStore } from "@/lib/store";
import { MonsterCard } from "@/components/monster-card";
import { RetroButton } from "@/components/retro-button";
import { supabase } from "@/lib/supabase";

export default function ResultsPage() {
  const router = useRouter();
  const { winner, loser, reset } = useGameStore();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!winner || !loser) {
      router.push("/");
      return;
    }

    // Persist battle result
    async function saveBattle() {
      if (!winner || !loser) return;
      const { error } = await supabase.from("battles").insert({
        winner_id: winner.id,
        loser_id: loser.id,
      });
      if (error) console.error("Failed to save battle:", error);
      else setSaved(true);
    }

    saveBattle();
  }, [winner, loser, router]);

  function handlePlayAgain() {
    reset();
    router.push("/");
  }

  if (!winner || !loser) return null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", bounce: 0.5 }}
      >
        <h1 className="font-retro text-sm text-retro-gold text-center">
          Winner!
        </h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <MonsterCard monster={winner} highlight />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 0.6 }}
        className="text-center"
      >
        <p className="font-retro text-[8px] text-retro-white/40 mb-2">
          Defeated
        </p>
        <p className="font-retro text-[10px] text-retro-accent">
          {loser.name}
        </p>
      </motion.div>

      {saved && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-retro text-[8px] text-retro-green"
        >
          Battle recorded!
        </motion.p>
      )}

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
