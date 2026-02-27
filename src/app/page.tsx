"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { useGameStore } from "@/lib/store";
import { RetroButton } from "@/components/retro-button";
import { RetroCard } from "@/components/retro-card";
import { BottomSheet } from "@/components/bottom-sheet";
import { MonsterDetail } from "@/components/monster-detail";
import { supabase } from "@/lib/supabase";
import type { LeaderboardEntry } from "@/lib/types";

const PLAYER_OPTIONS = [2, 3, 4, 5, 6, 7, 8];

export default function Home() {
  const router = useRouter();
  const { setPhase, reset, playerCount, setPlayerCount, initPlayers } =
    useGameStore();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedMonster, setSelectedMonster] = useState<LeaderboardEntry | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    // Fetch battles and compute stats client-side (avoids relying on a DB view)
    const { data: battles } = await supabase
      .from("battles")
      .select("winner_id, loser_id");
    if (!battles || battles.length === 0) return;

    // Tally wins and losses per monster id
    const stats = new Map<string, { wins: number; losses: number }>();
    for (const b of battles) {
      const w = stats.get(b.winner_id) ?? { wins: 0, losses: 0 };
      w.wins++;
      stats.set(b.winner_id, w);

      const l = stats.get(b.loser_id) ?? { wins: 0, losses: 0 };
      l.losses++;
      stats.set(b.loser_id, l);
    }

    // Fetch monster details for the monsters that have battle records
    const monsterIds = [...stats.keys()];
    const { data: monsters } = await supabase
      .from("monsters")
      .select("id, name, hp, attack, defense, speed, image_url, backstory, stage, moves")
      .in("id", monsterIds);
    if (!monsters) return;

    // Merge and sort by wins desc, then by win rate
    const entries: LeaderboardEntry[] = monsters
      .map((m) => {
        const s = stats.get(m.id) ?? { wins: 0, losses: 0 };
        return {
          monster_name: m.name,
          wins: s.wins,
          losses: s.losses,
          hp: m.hp ?? 0,
          attack: m.attack,
          defense: m.defense ?? 0,
          speed: m.speed ?? 0,
          image_url: m.image_url,
          backstory: m.backstory ?? "",
          stage: m.stage ?? 1,
          moves: Array.isArray(m.moves) ? m.moves : [],
        };
      })
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
      .slice(0, 5);

    setLeaderboard(entries);
  }, []);

  // Fetch on mount + re-fetch when page regains focus (e.g. returning from battle)
  useEffect(() => {
    fetchLeaderboard();

    function handleVisibility() {
      if (document.visibilityState === "visible") fetchLeaderboard();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchLeaderboard]);

  function handleStart() {
    reset();
    setPlayerCount(playerCount);
    initPlayers();
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

      {/* Player Count Selector */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex flex-col items-center gap-2"
      >
        <p className="font-retro text-[8px] text-retro-white/60">Players</p>
        <div className="flex gap-2">
          {PLAYER_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setPlayerCount(n)}
              className={`font-retro text-xs w-8 h-8 border-2 transition-colors ${
                playerCount === n
                  ? "border-retro-gold bg-retro-gold/20 text-retro-gold"
                  : "border-retro-white/30 text-retro-white/50 hover:border-retro-white/60"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
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
          className="w-full max-w-sm"
        >
          <RetroCard>
            <h2 className="font-retro text-[10px] text-retro-gold mb-4 text-center">
              Leaderboard
            </h2>
            <div className="flex flex-col gap-3">
              {leaderboard.map((entry, i) => (
                <button
                  key={`${entry.monster_name}-${i}`}
                  onClick={() => setSelectedMonster(entry)}
                  className="flex items-center gap-4 p-2 -mx-2 rounded transition-colors hover:bg-retro-white/5 active:bg-retro-white/10 text-left"
                >
                  <span className="font-retro text-xs text-retro-accent w-5 shrink-0">
                    {i + 1}.
                  </span>
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden border-2 border-retro-white bg-[#4a90d9]">
                    <Image
                      src={entry.image_url}
                      alt={entry.monster_name}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-retro text-[9px] text-retro-white truncate">
                        {entry.monster_name}
                      </span>
                      <div className="flex gap-0.5 shrink-0">
                        {[1, 2, 3].map((s) => (
                          <span
                            key={s}
                            className={`text-[6px] ${
                              s <= entry.stage ? "text-retro-gold" : "text-retro-white/20"
                            }`}
                          >
                            ◆
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3 font-retro text-[7px]">
                      <span>
                        <span className="text-retro-green">{entry.wins}W</span>
                        <span className="text-retro-white/20"> / </span>
                        <span className="text-retro-accent">{entry.losses}L</span>
                      </span>
                      <span className="text-retro-gold">ATK {entry.attack}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <Link
              href="/pokedex"
              className="block mt-4 font-retro text-[8px] text-retro-white/40 text-center hover:text-retro-white/70 transition-colors"
            >
              View All →
            </Link>
          </RetroCard>
        </motion.div>
      )}

      {/* Monster Detail Sheet */}
      <BottomSheet
        open={selectedMonster !== null}
        onClose={() => setSelectedMonster(null)}
      >
        {selectedMonster && <MonsterDetail entry={selectedMonster} />}
      </BottomSheet>

      {/* Footer */}
      <p className="font-retro text-[6px] text-retro-white/20">
        Pass the phone. Create. Battle.
      </p>
    </div>
  );
}
