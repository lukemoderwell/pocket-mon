"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "motion/react";
import { useGameStore } from "@/lib/store";
import { RetroButton } from "@/components/retro-button";
import { RetroCard } from "@/components/retro-card";
import { supabase } from "@/lib/supabase";
import type { LeaderboardEntry } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const { setPhase, reset } = useGameStore();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    async function fetchLeaderboard() {
      const { data } = await supabase
        .from("leaderboard")
        .select("*")
        .limit(5);
      if (data) setLeaderboard(data as LeaderboardEntry[]);
    }
    fetchLeaderboard();
  }, []);

  function handleStart() {
    reset();
    setPhase("create");
    router.push("/create");
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      {/* Title */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center"
      >
        <h1 className="font-retro text-xl text-retro-gold mb-2">
          Pocket Mon
        </h1>
        <p className="font-retro text-[8px] text-retro-white/50">
          Create monsters. Battle friends. Win glory.
        </p>
      </motion.div>

      {/* Start Button */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <RetroButton onClick={handleStart} className="text-sm px-10 py-4">
          Start Game
        </RetroButton>
      </motion.div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-xs"
        >
          <RetroCard>
            <h2 className="font-retro text-[10px] text-retro-gold mb-3 text-center">
              Leaderboard
            </h2>
            <div className="flex flex-col gap-2">
              {leaderboard.map((entry, i) => (
                <div
                  key={entry.monster_name}
                  className="flex items-center gap-3"
                >
                  <span className="font-retro text-[10px] text-retro-accent w-4">
                    {i + 1}.
                  </span>
                  <div className="relative h-8 w-8 overflow-hidden border border-retro-white bg-[#4a90d9]">
                    <Image
                      src={entry.image_url}
                      alt={entry.monster_name}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <span className="font-retro text-[8px] flex-1 truncate">
                    {entry.monster_name}
                  </span>
                  <span className="font-retro text-[8px] text-retro-gold">
                    {entry.wins}W
                  </span>
                </div>
              ))}
            </div>
          </RetroCard>
        </motion.div>
      )}

      {/* Footer */}
      <p className="font-retro text-[6px] text-retro-white/20">
        Pass the phone. Create. Battle.
      </p>
    </div>
  );
}
