"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useGameStore } from "@/lib/store";
import { RetroButton } from "@/components/retro-button";
import { RetroCard } from "@/components/retro-card";
import { MonsterCard } from "@/components/monster-card";
import type { Monster } from "@/lib/types";

export default function CreatePage() {
  const router = useRouter();
  const {
    players,
    playerCount,
    currentPlayerIndex,
    genStatus,
    setPlayerName,
    setPlayerMonster,
    setGenStatus,
    advancePlayer,
    allMonstersReady,
    initTournament,
  } = useGameStore();

  const [monsterName, setMonsterName] = useState("");
  const [error, setError] = useState("");

  // Have all players submitted their names?
  const allSubmitted = currentPlayerIndex >= playerCount;

  /** Fire monster generation in background, advance to next player immediately */
  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!monsterName.trim()) return;

    const idx = currentPlayerIndex;
    const name = monsterName.trim();

    // Store player name
    setPlayerName(idx, name);
    setGenStatus(idx, "generating");

    // Fire-and-forget: generation happens in background
    generateMonster(idx, name);

    // Immediately advance UI
    setMonsterName("");
    setError("");
    advancePlayer();
  }

  async function generateMonster(idx: number, name: string) {
    try {
      const res = await fetch("/api/generate-monster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setPlayerMonster(idx, data.monster as Monster);
      setGenStatus(idx, "ready");
    } catch {
      setGenStatus(idx, "error");
    }
  }

  function handleRetry(idx: number) {
    const name = players[idx].name;
    if (!name) return;
    setGenStatus(idx, "generating");
    generateMonster(idx, name);
  }

  function handleStartTournament() {
    initTournament();
    router.push("/battle");
  }

  const ready = allMonstersReady();

  // ─── Waiting Room (all players have submitted) ─────────────────────
  if (allSubmitted) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
        <h1 className="font-retro text-sm text-retro-gold">Waiting Room</h1>
        <p className="font-retro text-[8px] text-retro-white/50">
          {ready
            ? "All monsters ready!"
            : "Monsters are being generated..."}
        </p>

        <div className="w-full max-w-xs flex flex-col gap-3">
          {players.map((player, i) => (
            <RetroCard key={i}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-retro text-[8px] text-retro-white/50">
                    Player {i + 1}
                  </p>
                  <p className="font-retro text-xs text-retro-white truncate">
                    {player.name}
                  </p>
                </div>
                <StatusBadge status={genStatus[i]} />
                {genStatus[i] === "error" && (
                  <RetroButton
                    variant="secondary"
                    onClick={() => handleRetry(i)}
                    className="text-[8px] px-2 py-1"
                  >
                    Retry
                  </RetroButton>
                )}
              </div>
              {genStatus[i] === "ready" && player.monster && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="mt-3 overflow-hidden"
                >
                  <MonsterCard monster={player.monster} />
                </motion.div>
              )}
            </RetroCard>
          ))}
        </div>

        <RetroButton
          onClick={handleStartTournament}
          disabled={!ready}
          className="text-sm px-8 py-3"
        >
          Start Tournament
        </RetroButton>
      </div>
    );
  }

  // ─── Input View (current player names their monster) ───────────────
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <h1 className="font-retro text-sm text-retro-gold">
        Player {currentPlayerIndex + 1} of {playerCount}
      </h1>
      <p className="font-retro text-[10px] text-retro-white/60">
        Name your monster
      </p>

      <RetroCard className="w-full max-w-xs">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <label className="font-retro text-[8px] text-retro-white/60">
            Monster Name
          </label>
          <input
            type="text"
            value={monsterName}
            onChange={(e) => setMonsterName(e.target.value)}
            maxLength={30}
            placeholder="e.g. Flamezard"
            className="w-full border-2 border-retro-white bg-retro-black px-3 py-2 font-retro text-xs text-retro-white placeholder:text-retro-white/30 focus:border-retro-accent focus:outline-none"
            autoFocus
          />

          {error && (
            <p className="font-retro text-[8px] text-retro-accent">{error}</p>
          )}

          <RetroButton type="submit" disabled={!monsterName.trim()}>
            Create Monster
          </RetroButton>
        </form>
      </RetroCard>

      {/* Progress dots showing who has submitted */}
      <div className="flex gap-2">
        {Array.from({ length: playerCount }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 border border-retro-white/40 ${
              i < currentPlayerIndex
                ? "bg-retro-gold"
                : i === currentPlayerIndex
                  ? "bg-retro-accent"
                  : "bg-transparent"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    idle: { text: "Waiting", color: "text-retro-white/40" },
    generating: { text: "Generating...", color: "text-retro-gold animate-pulse" },
    ready: { text: "Ready!", color: "text-retro-green" },
    error: { text: "Failed", color: "text-retro-accent" },
  }[status] ?? { text: status, color: "text-retro-white/40" };

  return (
    <span className={`font-retro text-[8px] ${config.color}`}>
      {config.text}
    </span>
  );
}
