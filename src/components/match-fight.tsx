"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { runBattle, type BattleRound } from "@/lib/battle-engine";
import { HealthBar } from "@/components/health-bar";
import { RetroButton } from "@/components/retro-button";
import type { Monster } from "@/lib/types";

type FightPhase = "intro" | "fighting" | "finished";

type TurnPhase = "lunge" | "impact" | "damage" | "effect" | "idle";

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

const EFFECT_CAPTIONS: Record<string, string> = {
  guard: "Defense raised!",
  rush: "Left exposed!",
  drain: "Drained energy!",
  stun: "Stunned!",
};

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
  const [narration, setNarration] = useState("");
  const [winner, setWinner] = useState<Monster | null>(null);
  const [loser, setLoser] = useState<Monster | null>(null);

  // Animation state
  const [turnPhase, setTurnPhase] = useState<TurnPhase>("idle");
  const [activeAttacker, setActiveAttacker] = useState<0 | 1 | null>(null);
  const [damageNumber, setDamageNumber] = useState<{ value: number; target: 0 | 1 } | null>(null);
  const [healNumber, setHealNumber] = useState<{ value: number; target: 0 | 1 } | null>(null);
  const [effectCaption, setEffectCaption] = useState<string | null>(null);
  const [currentCaption, setCurrentCaption] = useState<string | null>(null);
  const [screenShake, setScreenShake] = useState(false);

  const startBattle = useCallback(() => {
    const result = runBattle(monsterA, monsterB);
    setRounds(result.rounds);
    setPhase("fighting");
  }, [monsterA, monsterB]);

  // Animate rounds with staggered phases
  useEffect(() => {
    if (phase !== "fighting" || rounds.length === 0) return;
    if (currentRound >= rounds.length) {
      finishBattle();
      return;
    }

    const round = rounds[currentRound];
    const hitTarget = round.defender === monsterA.name ? 0 : 1;
    const attackerSide = hitTarget === 0 ? 1 : 0;

    // Build caption
    if (round.wasStunned) {
      setCurrentCaption(`${round.attacker} is stunned!`);
    } else {
      setCurrentCaption(
        `${round.attacker} uses ${round.moveName}!`
      );
    }

    if (round.wasStunned) {
      // Stunned turn - just show message and move on
      const timer = setTimeout(() => {
        setCurrentCaption(null);
        setCurrentRound((r) => r + 1);
      }, 800);
      return () => clearTimeout(timer);
    }

    // Phase 1: Lunge (200ms)
    setActiveAttacker(attackerSide as 0 | 1);
    setTurnPhase("lunge");

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Phase 2: Impact (after 200ms, lasts 300ms)
    timers.push(setTimeout(() => {
      setTurnPhase("impact");
      if (round.moveEffect === "rush") setScreenShake(true);

      // Update HP on impact
      if (hitTarget === 0) setHp1(round.defenderHp);
      else setHp2(round.defenderHp);
    }, 200));

    // Phase 3: Damage number (after 350ms, lasts 500ms)
    timers.push(setTimeout(() => {
      setScreenShake(false);
      setTurnPhase("damage");
      setDamageNumber({ value: round.damage, target: hitTarget as 0 | 1 });

      if (round.healAmount > 0) {
        setHealNumber({ value: round.healAmount, target: attackerSide as 0 | 1 });
      }
    }, 350));

    // Phase 4: Effect caption (after 700ms, lasts 400ms)
    timers.push(setTimeout(() => {
      setDamageNumber(null);
      setHealNumber(null);

      if (round.stunned) {
        setEffectCaption("Stunned!");
      } else if (EFFECT_CAPTIONS[round.moveEffect]) {
        setEffectCaption(EFFECT_CAPTIONS[round.moveEffect]);
      }
      setTurnPhase("effect");
    }, 700));

    // Cleanup & advance (after 1100ms)
    timers.push(setTimeout(() => {
      setTurnPhase("idle");
      setActiveAttacker(null);
      setEffectCaption(null);
      setCurrentCaption(null);
      setCurrentRound((r) => r + 1);
    }, 1100));

    return () => timers.forEach(clearTimeout);
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

  // Sprite animation variants
  const getLungeAnimation = (side: 0 | 1) => {
    if (activeAttacker !== side || turnPhase !== "lunge") return {};
    // Bottom monster (0) lunges up, top monster (1) lunges down
    return side === 0 ? { y: -16 } : { y: 16 };
  };

  const getImpactAnimation = (side: 0 | 1) => {
    const hitTarget = rounds[currentRound - 1]?.defender === monsterA.name ? 0 : 1;
    if (side !== hitTarget || turnPhase !== "impact") return {};
    return { x: [0, -8, 8, -4, 0] };
  };

  return (
    <motion.div
      className="flex min-h-dvh flex-col items-center justify-between p-4"
      animate={screenShake ? { x: [0, -4, 4, -2, 2, 0] } : {}}
      transition={{ duration: 0.3 }}
    >
      {/* Opponent (top) */}
      <div className="w-full">
        <p className="font-retro text-[8px] text-retro-white/40 mb-1">
          {playerBName}
        </p>
        <div className="flex w-full items-start justify-between gap-2">
          <div className="flex-1">
            <HealthBar current={hp2} max={monsterB.hp} label={monsterB.name} />
          </div>
          <div className="relative">
            <motion.div
              className={`relative h-28 w-28 overflow-hidden border-2 border-retro-white ${
                turnPhase === "impact" && rounds[currentRound]?.defender === monsterB.name
                  ? "animate-blink"
                  : ""
              }`}
              animate={{
                ...getLungeAnimation(1),
                ...getImpactAnimation(1),
              }}
              transition={{ duration: turnPhase === "lunge" ? 0.2 : 0.3 }}
            >
              <Image
                src={monsterB.image_url}
                alt={monsterB.name}
                fill
                className="object-contain"
                unoptimized
              />
            </motion.div>
            {/* Floating damage number */}
            <AnimatePresence>
              {damageNumber && damageNumber.target === 1 && (
                <motion.div
                  key="dmg-top"
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -32 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 font-retro text-sm text-retro-accent font-bold pointer-events-none"
                >
                  -{damageNumber.value}
                </motion.div>
              )}
              {healNumber && healNumber.target === 1 && (
                <motion.div
                  key="heal-top"
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -32 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute -top-2 right-0 font-retro text-sm text-retro-green font-bold pointer-events-none"
                >
                  +{healNumber.value}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
              className="pixel-border bg-retro-dark p-3 min-h-[48px]"
            >
              {currentCaption && (
                <motion.p
                  key={`caption-${currentRound}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-retro text-[8px] text-retro-white leading-relaxed"
                >
                  {currentCaption}
                  {damageNumber && !rounds[currentRound]?.wasStunned && (
                    <>
                      {" "}
                      <span className="text-retro-accent">
                        {damageNumber.value}
                      </span>{" "}
                      damage!
                    </>
                  )}
                </motion.p>
              )}
              {effectCaption && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-retro text-[8px] text-retro-gold mt-1"
                >
                  {effectCaption}
                </motion.p>
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
          <div className="relative">
            <motion.div
              className={`relative h-28 w-28 overflow-hidden border-2 border-retro-white ${
                turnPhase === "impact" && rounds[currentRound]?.defender === monsterA.name
                  ? "animate-blink"
                  : ""
              }`}
              animate={{
                ...getLungeAnimation(0),
                ...getImpactAnimation(0),
              }}
              transition={{ duration: turnPhase === "lunge" ? 0.2 : 0.3 }}
            >
              <Image
                src={monsterA.image_url}
                alt={monsterA.name}
                fill
                className="object-contain"
                unoptimized
              />
            </motion.div>
            {/* Floating damage number */}
            <AnimatePresence>
              {damageNumber && damageNumber.target === 0 && (
                <motion.div
                  key="dmg-bottom"
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -32 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 font-retro text-sm text-retro-accent font-bold pointer-events-none"
                >
                  -{damageNumber.value}
                </motion.div>
              )}
              {healNumber && healNumber.target === 0 && (
                <motion.div
                  key="heal-bottom"
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -32 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute -top-2 right-0 font-retro text-sm text-retro-green font-bold pointer-events-none"
                >
                  +{healNumber.value}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex-1">
            <HealthBar current={hp1} max={monsterA.hp} label={monsterA.name} />
          </div>
        </div>
        <p className="font-retro text-[8px] text-retro-white/40 mt-1 text-right">
          {playerAName}
        </p>
      </div>
    </motion.div>
  );
}
