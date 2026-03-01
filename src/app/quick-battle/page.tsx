"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "@/lib/supabase";
import { MatchFight } from "@/components/match-fight";
import { RetroButton } from "@/components/retro-button";
import type { Monster } from "@/lib/types";

type Phase = "pick" | "fighting" | "done";

interface DbMonster {
  id: string;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  sp_attack: number;
  speed: number;
  image_url: string;
  backstory: string;
  appearance: string;
  moves: Monster["moves"];
  stage: number;
  evolution_history: Monster["evolution_history"];
  evo_threshold_2: number | null;
  evo_threshold_3: number | null;
  created_at: string;
}

function toMonster(m: DbMonster): Monster {
  return {
    id: m.id,
    name: m.name,
    hp: m.hp ?? 0,
    attack: m.attack,
    defense: m.defense ?? 0,
    sp_attack: m.sp_attack ?? 0,
    speed: m.speed ?? 0,
    image_url: m.image_url,
    backstory: m.backstory ?? "",
    appearance: m.appearance ?? "",
    moves: Array.isArray(m.moves) ? m.moves : [],
    stage: m.stage ?? 1,
    evolution_history: Array.isArray(m.evolution_history)
      ? m.evolution_history
      : [],
    evo_threshold_2: m.evo_threshold_2,
    evo_threshold_3: m.evo_threshold_3,
    created_at: m.created_at ?? "",
  };
}

export default function QuickBattlePage() {
  const router = useRouter();
  const [allMonsters, setAllMonsters] = useState<Monster[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Monster | null>(null);
  const [opponent, setOpponent] = useState<Monster | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [lastWinner, setLastWinner] = useState<string | null>(null);

  const fetchMonsters = useCallback(async () => {
    const { data } = await supabase.from("monsters").select("*");
    if (data) {
      setAllMonsters(data.map((m: DbMonster) => toMonster(m)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMonsters();
  }, [fetchMonsters]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allMonsters;
    const q = search.toLowerCase();
    return allMonsters.filter((m) => m.name.toLowerCase().includes(q));
  }, [allMonsters, search]);

  function pickMonster(monster: Monster) {
    setPicked(monster);
    // Pick a random opponent that isn't the same monster
    const others = allMonsters.filter((m) => m.id !== monster.id);
    if (others.length === 0) return;
    const rand = others[Math.floor(Math.random() * others.length)];
    setOpponent(rand);
  }

  function startFight() {
    if (!picked || !opponent) return;
    setPhase("fighting");
  }

  async function handleFightComplete(result: {
    winner: Monster;
    loser: Monster;
  }) {
    setLastWinner(result.winner.name);
    setPhase("done");

    // Save battle to DB
    try {
      await supabase
        .from("battles")
        .insert({ winner_id: result.winner.id, loser_id: result.loser.id });
    } catch {
      // Non-critical — battle still happened locally
    }
  }

  function playAgain() {
    setPicked(null);
    setOpponent(null);
    setLastWinner(null);
    setSearch("");
    setPhase("pick");
  }

  function reroll() {
    if (!picked) return;
    const others = allMonsters.filter((m) => m.id !== picked.id);
    if (others.length === 0) return;
    setOpponent(others[Math.floor(Math.random() * others.length)]);
  }

  // ─── Fighting mode ──────────────────────────────────────────────
  if (phase === "fighting" && picked && opponent) {
    return (
      <MatchFight
        monsterA={picked}
        monsterB={opponent}
        playerAName="You"
        playerBName="Wild"
        onComplete={handleFightComplete}
      />
    );
  }

  // ─── Done mode ──────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
        <motion.p
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="font-retro text-sm text-retro-gold"
        >
          {lastWinner} wins!
        </motion.p>
        <div className="flex gap-3">
          <RetroButton onClick={playAgain}>Again</RetroButton>
          <RetroButton variant="secondary" onClick={() => router.push("/")}>
            Home
          </RetroButton>
        </div>
      </div>
    );
  }

  // ─── Pick mode ──────────────────────────────────────────────────
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
        <h1 className="font-retro text-sm text-retro-gold">Quick Battle</h1>
        <span className="w-10" />
      </div>

      <p className="font-retro text-[8px] text-retro-white/50 text-center max-w-xs">
        Pick your monster, face a random opponent. No tokens spent!
      </p>

      {/* Matchup preview */}
      <AnimatePresence>
        {picked && opponent && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-sm"
          >
            <div className="pixel-border bg-retro-dark p-4 flex items-center justify-between gap-2">
              {/* Your pick */}
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className="relative h-16 w-16 overflow-hidden border-2 border-retro-white bg-[#4a90d9]">
                  <Image
                    src={picked.image_url}
                    alt={picked.name}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <span className="font-retro text-[7px] text-retro-white truncate max-w-[80px]">
                  {picked.name}
                </span>
              </div>

              <span className="font-retro text-xs text-retro-gold shrink-0">
                VS
              </span>

              {/* Opponent */}
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className="relative h-16 w-16 overflow-hidden border-2 border-retro-white bg-[#4a90d9]">
                  <Image
                    src={opponent.image_url}
                    alt={opponent.name}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <span className="font-retro text-[7px] text-retro-white truncate max-w-[80px]">
                  {opponent.name}
                </span>
              </div>
            </div>

            <div className="flex gap-2 mt-3 justify-center">
              <RetroButton onClick={startFight} className="text-[9px] px-6 py-2">
                Fight!
              </RetroButton>
              <RetroButton
                variant="secondary"
                onClick={reroll}
                className="text-[9px] px-4 py-2"
              >
                Reroll
              </RetroButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="w-full max-w-sm">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search monsters..."
          className="w-full bg-retro-dark border-2 border-retro-white/30 px-3 py-2 font-retro text-[9px] text-retro-white placeholder:text-retro-white/20 focus:border-retro-gold outline-none transition-colors"
        />
      </div>

      {/* Monster list */}
      <div className="w-full max-w-sm flex-1">
        {loading ? (
          <p className="font-retro text-[8px] text-retro-white/30 text-center py-8">
            Loading...
          </p>
        ) : filtered.length === 0 ? (
          <p className="font-retro text-[8px] text-retro-white/30 text-center py-8">
            {allMonsters.length === 0
              ? "No monsters yet. Play a game first!"
              : "No matches found."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((monster, i) => (
              <motion.button
                key={monster.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
                onClick={() => pickMonster(monster)}
                className={`flex items-center gap-3 p-2 rounded pixel-border transition-colors text-left ${
                  picked?.id === monster.id
                    ? "bg-retro-gold/10 border-retro-gold"
                    : "bg-retro-dark hover:bg-retro-white/5 active:bg-retro-white/10"
                }`}
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden border-2 border-retro-white bg-[#4a90d9]">
                  <Image
                    src={monster.image_url}
                    alt={monster.name}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-retro text-[8px] text-retro-white truncate">
                      {monster.name}
                    </span>
                    <div className="flex gap-0.5 shrink-0">
                      {[1, 2, 3].map((s) => (
                        <span
                          key={s}
                          className={`text-[5px] ${
                            s <= monster.stage
                              ? "text-retro-gold"
                              : "text-retro-white/20"
                          }`}
                        >
                          ◆
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="font-retro text-[6px] text-retro-white/30">
                    ATK {monster.attack} / DEF {monster.defense} / SPD{" "}
                    {monster.speed}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
