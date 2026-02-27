"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store";
import { BracketView } from "@/components/bracket-view";
import { MatchFight } from "@/components/match-fight";
import type { BattleRound } from "@/lib/battle-engine";
import type { Monster } from "@/lib/types";

type PageMode = "bracket" | "fighting";

export default function BattlePage() {
  const router = useRouter();
  const { players, tournament, setMatchResult, advanceMatch, phase } =
    useGameStore();
  const [mode, setMode] = useState<PageMode>("bracket");
  const [activeMatchIndex, setActiveMatchIndex] = useState<number | null>(null);

  // Redirect if no tournament
  useEffect(() => {
    if (!tournament) {
      router.push("/");
    }
  }, [tournament, router]);

  // When phase changes to results, navigate there
  useEffect(() => {
    if (phase === "results") {
      router.push("/results");
    }
  }, [phase, router]);

  if (!tournament) return null;

  function handleFight(matchIndex: number) {
    setActiveMatchIndex(matchIndex);
    setMode("fighting");
  }

  function handleFightComplete(result: {
    winner: Monster;
    loser: Monster;
    rounds: BattleRound[];
    narration: string;
  }) {
    if (activeMatchIndex === null) return;

    const match = tournament!.matches[activeMatchIndex];
    // Determine which player index won
    const playerAMonster = players[match.playerA!]?.monster;
    const winnerPlayerIdx =
      playerAMonster && playerAMonster.id === result.winner.id
        ? match.playerA!
        : match.playerB!;

    setMatchResult(
      activeMatchIndex,
      winnerPlayerIdx,
      result.rounds.map(
        (r) => `${r.attacker} deals ${r.damage} to ${r.defender}`
      ),
      result.narration
    );

    // Advance to next match or finish
    advanceMatch();
    setMode("bracket");
    setActiveMatchIndex(null);
  }

  // ─── Fighting mode ─────────────────────────────────────────────────
  if (mode === "fighting" && activeMatchIndex !== null) {
    const match = tournament.matches[activeMatchIndex];
    const monsterA = players[match.playerA!]?.monster;
    const monsterB = players[match.playerB!]?.monster;

    if (!monsterA || !monsterB) {
      // Shouldn't happen, but recover gracefully
      setMode("bracket");
      return null;
    }

    return (
      <MatchFight
        monsterA={monsterA}
        monsterB={monsterB}
        playerAName={players[match.playerA!].name}
        playerBName={players[match.playerB!].name}
        onComplete={handleFightComplete}
      />
    );
  }

  // ─── Bracket mode ──────────────────────────────────────────────────
  return (
    <BracketView
      tournament={tournament}
      players={players}
      onFight={handleFight}
    />
  );
}
