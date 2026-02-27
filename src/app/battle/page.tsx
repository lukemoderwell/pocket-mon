"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store";
import { BracketView } from "@/components/bracket-view";
import { MatchFight } from "@/components/match-fight";
import { EvolutionCutscene } from "@/components/evolution-cutscene";
import { supabase } from "@/lib/supabase";
import type { BattleRound } from "@/lib/battle-engine";
import type { Monster } from "@/lib/types";

type PageMode = "bracket" | "fighting" | "evolving";

export default function BattlePage() {
  const router = useRouter();
  const {
    players,
    tournament,
    setMatchResult,
    advanceMatch,
    phase,
    saveBattle,
    pendingEvolution,
    setPendingEvolution,
    setPlayerMonster,
  } = useGameStore();
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

  async function checkEvolutionEligibility(
    monster: Monster,
    playerIndex: number
  ): Promise<boolean> {
    if (monster.stage >= 3) return false;

    const thresholdKey =
      monster.stage === 1 ? "evo_threshold_2" : "evo_threshold_3";
    const threshold = monster[thresholdKey as keyof Monster] as number | null;
    if (threshold === null) return false;

    // Count total wins for this monster
    const { count } = await supabase
      .from("battles")
      .select("*", { count: "exact", head: true })
      .eq("winner_id", monster.id);

    return (count ?? 0) >= threshold;
  }

  async function handleFightComplete(result: {
    winner: Monster;
    loser: Monster;
    rounds: BattleRound[];
    narration: string;
  }) {
    if (activeMatchIndex === null) return;

    const match = tournament!.matches[activeMatchIndex];
    const playerAMonster = players[match.playerA!]?.monster;
    const winnerPlayerIdx =
      playerAMonster && playerAMonster.id === result.winner.id
        ? match.playerA!
        : match.playerB!;

    setMatchResult(
      activeMatchIndex,
      winnerPlayerIdx,
      result.rounds.map(
        (r) => `${r.attacker} uses ${r.moveName}! ${r.damage} damage to ${r.defender}`
      ),
      result.narration
    );

    // Save battle immediately
    await saveBattle(result.winner.id, result.loser.id);

    // Check if winner qualifies for evolution
    const eligible = await checkEvolutionEligibility(
      result.winner,
      winnerPlayerIdx
    );

    if (eligible) {
      setPendingEvolution({
        monsterId: result.winner.id,
        playerIndex: winnerPlayerIdx,
      });
      setMode("evolving");
    } else {
      advanceMatch();
      setMode("bracket");
      setActiveMatchIndex(null);
    }
  }

  function handleEvolutionComplete(evolved: Monster) {
    if (pendingEvolution) {
      // Update the player's monster with evolved version
      setPlayerMonster(pendingEvolution.playerIndex, evolved);
    }
    setPendingEvolution(null);
    advanceMatch();
    setMode("bracket");
    setActiveMatchIndex(null);
  }

  // ─── Evolving mode ────────────────────────────────────────────────
  if (mode === "evolving" && pendingEvolution) {
    const monster = players[pendingEvolution.playerIndex]?.monster;
    if (!monster) {
      setMode("bracket");
      return null;
    }

    return (
      <EvolutionCutscene
        monster={monster}
        playerIndex={pendingEvolution.playerIndex}
        onComplete={handleEvolutionComplete}
      />
    );
  }

  // ─── Fighting mode ─────────────────────────────────────────────────
  if (mode === "fighting" && activeMatchIndex !== null) {
    const match = tournament.matches[activeMatchIndex];
    const monsterA = players[match.playerA!]?.monster;
    const monsterB = players[match.playerB!]?.monster;

    if (!monsterA || !monsterB) {
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
