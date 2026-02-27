"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store";
import { RetroButton } from "@/components/retro-button";
import { RetroCard } from "@/components/retro-card";
import { MonsterCard } from "@/components/monster-card";
import type { Monster } from "@/lib/types";

export default function CreatePage() {
  const router = useRouter();
  const {
    players,
    currentPlayerIndex,
    setPlayerName,
    setPlayerMonster,
    advancePlayer,
    setPhase,
  } = useGameStore();

  const [monsterName, setMonsterName] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdMonster, setCreatedMonster] = useState<Monster | null>(null);
  const [error, setError] = useState("");

  const currentPlayer = players[currentPlayerIndex];
  const isSecondPlayer = currentPlayerIndex === 1;
  const bothDone = isSecondPlayer && createdMonster;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!monsterName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate-monster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: monsterName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const monster = data.monster as Monster;
      setPlayerMonster(currentPlayerIndex, monster);
      setCreatedMonster(monster);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleNext() {
    if (bothDone) {
      setPhase("battle");
      router.push("/battle");
    } else {
      advancePlayer();
      setCreatedMonster(null);
      setMonsterName("");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <h1 className="font-retro text-sm text-retro-gold">
        Player {currentPlayerIndex + 1}
      </h1>
      <p className="font-retro text-[10px] text-retro-white/60">
        {currentPlayer.name || "Name your monster"}
      </p>

      {!createdMonster ? (
        <RetroCard className="w-full max-w-xs">
          <form onSubmit={handleGenerate} className="flex flex-col gap-4">
            <label className="font-retro text-[8px] text-retro-white/60">
              Monster Name
            </label>
            <input
              type="text"
              value={monsterName}
              onChange={(e) => {
                setMonsterName(e.target.value);
                setPlayerName(currentPlayerIndex, e.target.value);
              }}
              maxLength={30}
              placeholder="e.g. Flamezard"
              disabled={loading}
              className="w-full border-2 border-retro-white bg-retro-black px-3 py-2 font-retro text-xs text-retro-white placeholder:text-retro-white/30 focus:border-retro-accent focus:outline-none"
            />

            {error && (
              <p className="font-retro text-[8px] text-retro-accent">{error}</p>
            )}

            <RetroButton type="submit" disabled={loading || !monsterName.trim()}>
              {loading ? "Generating..." : "Create Monster"}
            </RetroButton>

            {loading && (
              <p className="text-center font-retro text-[8px] text-retro-white/40 animate-pulse">
                AI is crafting your monster...
              </p>
            )}
          </form>
        </RetroCard>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <MonsterCard monster={createdMonster} highlight />
          <RetroButton onClick={handleNext}>
            {bothDone ? "Start Battle!" : "Next Player"}
          </RetroButton>
        </div>
      )}
    </div>
  );
}
