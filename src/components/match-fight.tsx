"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { runBattle, type BattleRound } from "@/lib/battle-engine";
import { HealthBar } from "@/components/health-bar";
import { RetroButton } from "@/components/retro-button";
import type { Monster } from "@/lib/types";

type FightPhase = "intro" | "fighting" | "finished";

interface MatchFightProps {
  monsterA: Monster;
  monsterB: Monster;
  playerAName: string;
  playerBName: string;
  onComplete: (result: {
    winner: Monster;
    loser: Monster;
    rounds: BattleRound[];
    narration: string;
  }) => void;
}

export function MatchFight({
  monsterA,
  monsterB,
  playerAName,
  playerBName,
  onComplete,
}: MatchFightProps) {
  const [phase, setPhase] = useState<FightPhase>("intro");
  const [currentRound, setCurrentRound] = useState(0);
  const [rounds, setRounds] = useState<BattleRound[]>([]);
  const [hp1, setHp1] = useState(monsterA.hp);
  const [hp2, setHp2] = useState(monsterB.hp);
  const [lastHit, setLastHit] = useState<0 | 1 | null>(null);
  const [narration, setNarration] = useState("");
  const [winner, setWinner] = useState<Monster | null>(null);
  const [loser, setLoser] = useState<Monster | null>(null);

  const startBattle = useCallback(() => {
    const result = runBattle(monsterA, monsterB);
    setRounds(result.rounds);
    setPhase("fighting");
  }, [monsterA, monsterB]);

  // Animate rounds
  useEffect(() => {
    if (phase !== "fighting" || rounds.length === 0) return;
    if (currentRound >= rounds.length) {
      finishBattle();
      return;
    }

    const timer = setTimeout(() => {
      const round = rounds[currentRound];
      const hitMonster = round.defender === monsterA.name ? 0 : 1;
      setLastHit(hitMonster);

      if (hitMonster === 0) setHp1(round.defenderHp);
      else setHp2(round.defenderHp);

      setTimeout(() => setLastHit(null), 450);
      setCurrentRound((r) => r + 1);
    }, 800);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentRound, rounds]);

  async function finishBattle() {
    const w = hp1 > 0 ? monsterA : monsterB;
    const l = hp1 > 0 ? monsterB : monsterA;
    setWinner(w);
    setLoser(l);
    setPhase("finished");

    let narr = "An epic battle has concluded!";
    try {
      const res = await fetch("/api/battle-narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rounds,
          winnerName: w.name,
          loserName: l.name,
        }),
      });
      const data = await res.json();
      narr = data.narration || narr;
    } catch {
      // fallback narration already set
    }
    setNarration(narr);
  }

  function handleContinue() {
    if (!winner || !loser) return;
    onComplete({ winner, loser, rounds, narration });
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between p-4">
      {/* Opponent (top) */}
      <div className="w-full">
        <p className="font-retro text-[8px] text-retro-white/40 mb-1">
          {playerBName}
        </p>
        <div className="flex w-full items-start justify-between gap-2">
          <div className="flex-1">
            <HealthBar current={hp2} max={monsterB.hp} label={monsterB.name} />
          </div>
          <motion.div
            className={`relative h-28 w-28 overflow-hidden border-2 border-retro-white ${
              lastHit === 1 ? "animate-blink" : ""
            }`}
            animate={lastHit === 1 ? { x: [0, -8, 8, -4, 0] } : {}}
            transition={{ duration: 0.3 }}
          >
            <Image
              src={monsterB.image_url}
              alt={monsterB.name}
              fill
              className="object-contain"
              unoptimized
            />
          </motion.div>
        </div>
      </div>

      {/* Battle log area */}
      <div className="my-4 w-full">
        <AnimatePresence mode="wait">
          {phase === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <p className="font-retro text-xs text-retro-gold text-center">
                {monsterA.name} vs {monsterB.name}
              </p>
              <RetroButton onClick={startBattle}>Fight!</RetroButton>
            </motion.div>
          )}

          {phase === "fighting" && (
            <motion.div
              key="fighting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pixel-border bg-retro-dark p-3"
            >
              {currentRound > 0 && currentRound <= rounds.length && (
                <p className="font-retro text-[8px] text-retro-white leading-relaxed">
                  {rounds[currentRound - 1].attacker} deals{" "}
                  <span className="text-retro-accent">
                    {rounds[currentRound - 1].damage}
                  </span>{" "}
                  damage to {rounds[currentRound - 1].defender}!
                </p>
              )}
            </motion.div>
          )}

          {phase === "finished" && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <p className="font-retro text-xs text-retro-gold">
                {winner?.name} wins!
              </p>
              {narration ? (
                <div className="pixel-border bg-retro-dark p-3">
                  <p className="font-retro text-[8px] text-retro-white leading-relaxed">
                    {narration}
                  </p>
                </div>
              ) : (
                <p className="font-retro text-[8px] text-retro-white/40 animate-pulse">
                  The narrator gathers their thoughts...
                </p>
              )}
              <RetroButton onClick={handleContinue}>Continue</RetroButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Player monster (bottom) */}
      <div className="w-full">
        <div className="flex w-full items-end justify-between gap-2">
          <motion.div
            className={`relative h-28 w-28 overflow-hidden border-2 border-retro-white ${
              lastHit === 0 ? "animate-blink" : ""
            }`}
            animate={lastHit === 0 ? { x: [0, 8, -8, 4, 0] } : {}}
            transition={{ duration: 0.3 }}
          >
            <Image
              src={monsterA.image_url}
              alt={monsterA.name}
              fill
              className="object-contain"
              unoptimized
            />
          </motion.div>
          <div className="flex-1">
            <HealthBar current={hp1} max={monsterA.hp} label={monsterA.name} />
          </div>
        </div>
        <p className="font-retro text-[8px] text-retro-white/40 mt-1 text-right">
          {playerAName}
        </p>
      </div>
    </div>
  );
}
