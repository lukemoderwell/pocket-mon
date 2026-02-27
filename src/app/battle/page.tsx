"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { useGameStore } from "@/lib/store";
import { runBattle, type BattleRound } from "@/lib/battle-engine";
import { HealthBar } from "@/components/health-bar";
import { RetroButton } from "@/components/retro-button";

type BattlePhase = "intro" | "fighting" | "finished";

export default function BattlePage() {
  const router = useRouter();
  const { players, setBattleResult, setPhase } = useGameStore();
  const [battlePhase, setBattlePhase] = useState<BattlePhase>("intro");
  const [currentRound, setCurrentRound] = useState(0);
  const [rounds, setRounds] = useState<BattleRound[]>([]);
  const [hp1, setHp1] = useState(0);
  const [hp2, setHp2] = useState(0);
  const [lastHit, setLastHit] = useState<0 | 1 | null>(null);
  const [narration, setNarration] = useState("");

  const m1 = players[0].monster;
  const m2 = players[1].monster;

  // Redirect if no monsters
  useEffect(() => {
    if (!m1 || !m2) {
      router.push("/");
    }
  }, [m1, m2, router]);

  // Initialize HP
  useEffect(() => {
    if (m1 && m2) {
      setHp1(m1.hp);
      setHp2(m2.hp);
    }
  }, [m1, m2]);

  const startBattle = useCallback(() => {
    if (!m1 || !m2) return;
    const result = runBattle(m1, m2);
    setRounds(result.rounds);
    setBattlePhase("fighting");
  }, [m1, m2]);

  // Animate rounds one by one
  useEffect(() => {
    if (battlePhase !== "fighting" || rounds.length === 0) return;
    if (currentRound >= rounds.length) {
      // Battle is over
      finishBattle();
      return;
    }

    const timer = setTimeout(() => {
      const round = rounds[currentRound];
      // Determine which monster was hit
      const hitMonster = round.defender === m1?.name ? 0 : 1;
      setLastHit(hitMonster);

      // Update HP values based on round data
      if (hitMonster === 0) {
        setHp1(round.defenderHp);
      } else {
        setHp2(round.defenderHp);
      }

      // Clear hit animation
      setTimeout(() => setLastHit(null), 450);

      setCurrentRound((r) => r + 1);
    }, 800);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battlePhase, currentRound, rounds]);

  async function finishBattle() {
    if (!m1 || !m2) return;

    const winner = hp1 > 0 ? m1 : m2;
    const loser = hp1 > 0 ? m2 : m1;

    setBattleResult(winner, loser, []);
    setBattlePhase("finished");

    // Get AI narration
    try {
      const res = await fetch("/api/battle-narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rounds,
          winnerName: winner.name,
          loserName: loser.name,
        }),
      });
      const data = await res.json();
      setNarration(data.narration);
    } catch {
      setNarration("An epic battle has concluded!");
    }
  }

  function handleContinue() {
    setPhase("results");
    router.push("/results");
  }

  if (!m1 || !m2) return null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between p-4">
      {/* Opponent (top) */}
      <div className="flex w-full items-start justify-between gap-2">
        <div className="flex-1">
          <HealthBar current={hp2} max={m2.hp} label={m2.name} />
        </div>
        <motion.div
          className={`relative h-28 w-28 overflow-hidden border-2 border-retro-white ${lastHit === 1 ? "animate-blink" : ""}`}
          animate={lastHit === 1 ? { x: [0, -8, 8, -4, 0] } : {}}
          transition={{ duration: 0.3 }}
        >
          <Image
            src={m2.image_url}
            alt={m2.name}
            fill
            className="object-contain"
            unoptimized
          />
        </motion.div>
      </div>

      {/* Battle log / narration area */}
      <div className="my-4 w-full">
        <AnimatePresence mode="wait">
          {battlePhase === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <p className="font-retro text-xs text-retro-gold text-center">
                {m1.name} vs {m2.name}
              </p>
              <RetroButton onClick={startBattle}>Fight!</RetroButton>
            </motion.div>
          )}

          {battlePhase === "fighting" && (
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

          {battlePhase === "finished" && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <p className="font-retro text-xs text-retro-gold">Battle Over!</p>
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
              <RetroButton onClick={handleContinue}>See Results</RetroButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Player monster (bottom) */}
      <div className="flex w-full items-end justify-between gap-2">
        <motion.div
          className={`relative h-28 w-28 overflow-hidden border-2 border-retro-white ${lastHit === 0 ? "animate-blink" : ""}`}
          animate={lastHit === 0 ? { x: [0, 8, -8, 4, 0] } : {}}
          transition={{ duration: 0.3 }}
        >
          <Image
            src={m1.image_url}
            alt={m1.name}
            fill
            className="object-contain"
            unoptimized
          />
        </motion.div>
        <div className="flex-1">
          <HealthBar current={hp1} max={m1.hp} label={m1.name} />
        </div>
      </div>
    </div>
  );
}
