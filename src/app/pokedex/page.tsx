"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabase";
import { RetroCard } from "@/components/retro-card";
import { RetroButton } from "@/components/retro-button";
import { BottomSheet } from "@/components/bottom-sheet";
import { MonsterDetail } from "@/components/monster-detail";
import { MatchFight } from "@/components/match-fight";
import type { LeaderboardEntry, Monster, SortMode } from "@/lib/types";

const SORT_OPTIONS: { mode: SortMode; label: string }[] = [
  { mode: "wins", label: "Wins" },
  { mode: "alpha", label: "A–Z" },
  { mode: "newest", label: "New" },
];

/** Convert a LeaderboardEntry to a Monster for the battle engine */
function toMonster(entry: LeaderboardEntry): Monster {
  return {
    id: entry.id,
    name: entry.monster_name,
    hp: entry.hp,
    attack: entry.attack,
    defense: entry.defense,
    sp_attack: entry.sp_attack,
    speed: entry.speed,
    image_url: entry.image_url,
    backstory: entry.backstory,
    appearance: "",
    moves: entry.moves,
    stage: entry.stage,
    evolution_history: entry.evolution_history ?? [],
    evo_threshold_2: null,
    evo_threshold_3: null,
    created_at: entry.created_at,
  };
}

type PageMode = "list" | "fighting" | "result";

export default function PokedexPage() {
  const [monsters, setMonsters] = useState<LeaderboardEntry[]>([]);
  const [selectedMonster, setSelectedMonster] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("wins");

  // Quick battle state
  const [mode, setMode] = useState<PageMode>("list");
  const [battleMonster, setBattleMonster] = useState<Monster | null>(null);
  const [opponentMonster, setOpponentMonster] = useState<Monster | null>(null);
  const [lastWinner, setLastWinner] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    // Fetch all monsters
    const { data: allMonsters } = await supabase
      .from("monsters")
      .select("*");
    if (!allMonsters) {
      setLoading(false);
      return;
    }

    // Fetch all battles for W/L stats
    const { data: battles } = await supabase
      .from("battles")
      .select("winner_id, loser_id");

    const stats = new Map<string, { wins: number; losses: number }>();
    if (battles) {
      for (const b of battles) {
        const w = stats.get(b.winner_id) ?? { wins: 0, losses: 0 };
        w.wins++;
        stats.set(b.winner_id, w);

        const l = stats.get(b.loser_id) ?? { wins: 0, losses: 0 };
        l.losses++;
        stats.set(b.loser_id, l);
      }
    }

    const entries: LeaderboardEntry[] = allMonsters
      .map((m) => {
        const s = stats.get(m.id) ?? { wins: 0, losses: 0 };
        return {
          id: m.id,
          monster_name: m.name,
          wins: s.wins,
          losses: s.losses,
          hp: m.hp ?? 0,
          attack: m.attack,
          defense: m.defense ?? 0,
          sp_attack: m.sp_attack ?? 0,
          speed: m.speed ?? 0,
          image_url: m.image_url,
          backstory: m.backstory ?? "",
          stage: m.stage ?? 1,
          moves: Array.isArray(m.moves) ? m.moves : [],
          evolution_history: Array.isArray(m.evolution_history) ? m.evolution_history : [],
          created_at: m.created_at ?? "",
        };
      });

    setMonsters(entries);
    setLoading(false);
  }, []);

  // Fetch on mount + re-fetch when page regains focus
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") fetchAll();
    }
    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchAll]);

  const sortedMonsters = useMemo(() => {
    const sorted = [...monsters];
    switch (sortMode) {
      case "alpha":
        sorted.sort((a, b) => a.monster_name.localeCompare(b.monster_name));
        break;
      case "wins":
        sorted.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
        break;
      case "newest":
        sorted.sort((a, b) => (b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : 0));
        break;
    }
    return sorted;
  }, [monsters, sortMode]);

  function startQuickBattle() {
    if (!selectedMonster) return;
    const others = monsters.filter((m) => m.id !== selectedMonster.id);
    if (others.length === 0) return;
    const opponent = others[Math.floor(Math.random() * others.length)];
    setBattleMonster(toMonster(selectedMonster));
    setOpponentMonster(toMonster(opponent));
    setSelectedMonster(null);
    setMode("fighting");
  }

  async function handleFightComplete(result: {
    winner: Monster;
    loser: Monster;
  }) {
    setLastWinner(result.winner.name);
    setMode("result");

    try {
      await supabase
        .from("battles")
        .insert({ winner_id: result.winner.id, loser_id: result.loser.id });
    } catch {
      // Non-critical
    }
  }

  function handleBackToList() {
    setMode("list");
    setBattleMonster(null);
    setOpponentMonster(null);
    setLastWinner(null);
    fetchAll();
  }

  // ─── Fighting mode ──────────────────────────────────────────────
  if (mode === "fighting" && battleMonster && opponentMonster) {
    return (
      <MatchFight
        monsterA={battleMonster}
        monsterB={opponentMonster}
        playerAName={battleMonster.name}
        playerBName={opponentMonster.name}
        onComplete={handleFightComplete}
      />
    );
  }

  // ─── Result mode ────────────────────────────────────────────────
  if (mode === "result") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
        <motion.p
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="font-retro text-sm text-retro-gold"
        >
          {lastWinner} wins!
        </motion.p>
        <RetroButton onClick={handleBackToList}>Back to Pokedex</RetroButton>
      </div>
    );
  }

  // ─── List mode ──────────────────────────────────────────────────
  return (
    <div className="flex min-h-dvh flex-col items-center gap-6 p-6">
      {/* Header */}
      <div className="w-full max-w-sm flex items-center justify-between">
        <Link
          href="/"
          className="font-retro text-[9px] text-retro-white/40 hover:text-retro-white/70 transition-colors"
        >
          ← Back
        </Link>
        <h1 className="font-retro text-sm text-retro-gold">Pokedex</h1>
        <span className="font-retro text-[9px] text-retro-white/30">
          {monsters.length}
        </span>
      </div>

      {/* Sort controls */}
      <div className="w-full max-w-sm flex items-center gap-2">
        <span className="font-retro text-[7px] text-retro-white/30 shrink-0">Sort</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            onClick={() => setSortMode(opt.mode)}
            className={`font-retro text-[7px] px-2 py-1 rounded transition-colors ${
              sortMode === opt.mode
                ? "bg-retro-gold text-retro-black"
                : "bg-retro-white/5 text-retro-white/40 hover:bg-retro-white/10"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Monster list */}
      <div className="w-full max-w-sm">
        {loading ? (
          <p className="font-retro text-[8px] text-retro-white/30 text-center py-8">
            Loading...
          </p>
        ) : sortedMonsters.length === 0 ? (
          <RetroCard>
            <p className="font-retro text-[8px] text-retro-white/40 text-center">
              No monsters yet. Start a game to create some!
            </p>
          </RetroCard>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedMonsters.map((entry, i) => (
              <motion.button
                key={`${entry.monster_name}-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.6) }}
                onClick={() => setSelectedMonster(entry)}
                className="flex items-center gap-4 p-3 rounded pixel-border bg-retro-dark hover:bg-retro-white/5 active:bg-retro-white/10 transition-colors text-left"
              >
                <span className="font-retro text-[9px] text-retro-white/30 w-5 shrink-0 text-right">
                  {i + 1}
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
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Monster Detail Sheet */}
      <BottomSheet
        open={selectedMonster !== null}
        onClose={() => setSelectedMonster(null)}
      >
        {selectedMonster && (
          <>
            <MonsterDetail entry={selectedMonster} />
            {monsters.length >= 2 && (
              <div className="flex justify-center mt-4">
                <RetroButton
                  onClick={startQuickBattle}
                  className="text-[9px] px-6 py-2"
                >
                  Quick Battle
                </RetroButton>
              </div>
            )}
          </>
        )}
      </BottomSheet>
    </div>
  );
}
