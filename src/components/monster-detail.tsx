"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import type { LeaderboardEntry, MoveEffect, StageSnapshot } from "@/lib/types";

interface MonsterDetailProps {
  entry: LeaderboardEntry;
}

const EFFECT_COLORS: Record<MoveEffect, string> = {
  strike: "text-retro-white bg-retro-white/10",
  guard: "text-retro-blue bg-retro-blue/10",
  rush: "text-retro-accent bg-retro-accent/10",
  drain: "text-retro-green bg-retro-green/10",
  stun: "text-yellow-400 bg-yellow-400/10",
};

export function MonsterDetail({ entry }: MonsterDetailProps) {
  const [copied, setCopied] = useState(false);
  const [viewingStage, setViewingStage] = useState(entry.stage);

  // Build a map of stage -> snapshot data
  const stageData = useMemo(() => {
    const map = new Map<number, StageSnapshot>();

    // Add historical snapshots
    if (entry.evolution_history) {
      for (const snap of entry.evolution_history) {
        map.set(snap.stage, snap);
      }
    }

    // Current stage is always the entry itself
    map.set(entry.stage, {
      stage: entry.stage,
      hp: entry.hp,
      attack: entry.attack,
      defense: entry.defense,
      sp_attack: entry.sp_attack,
      speed: entry.speed,
      image_url: entry.image_url,
      backstory: entry.backstory,
      appearance: "",
      moves: entry.moves,
    });

    return map;
  }, [entry]);

  const hasHistory = stageData.size > 1;
  const current = stageData.get(viewingStage) ?? stageData.get(entry.stage)!;

  async function copyName() {
    await navigator.clipboard.writeText(entry.monster_name);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Monster image */}
      <div className="relative h-40 w-40 overflow-hidden border-2 border-retro-white bg-[#4a90d9]">
        <Image
          src={current.image_url}
          alt={entry.monster_name}
          fill
          className="object-contain"
          unoptimized
        />
      </div>

      {/* Name + stage selector + copy */}
      <div className="flex items-center gap-2">
        <button
          onClick={copyName}
          className="font-retro text-sm text-retro-gold hover:text-retro-gold/80 active:scale-95 transition-all"
          title="Copy name"
        >
          {copied ? "Copied!" : entry.monster_name}
        </button>
        <div className="flex gap-0.5">
          {[1, 2, 3].map((s) => {
            const isReached = s <= entry.stage;
            const isViewing = s === viewingStage;
            const canClick = hasHistory && stageData.has(s);

            return (
              <button
                key={s}
                onClick={() => canClick && setViewingStage(s)}
                disabled={!canClick}
                className={`text-[10px] transition-all ${
                  isViewing
                    ? "text-retro-gold scale-125"
                    : isReached
                      ? "text-retro-gold/50 hover:text-retro-gold/80"
                      : "text-retro-white/20"
                } ${canClick ? "cursor-pointer" : "cursor-default"}`}
              >
                ◆
              </button>
            );
          })}
        </div>
        {viewingStage !== entry.stage && (
          <span className="font-retro text-[7px] text-retro-white/30">
            Stage {viewingStage}
          </span>
        )}
      </div>

      {/* Win / Loss */}
      <div className="flex gap-4 font-retro text-xs">
        <span>
          <span className="text-retro-white/40">W </span>
          <span className="text-retro-green">{entry.wins}</span>
        </span>
        <span>
          <span className="text-retro-white/40">L </span>
          <span className="text-retro-accent">{entry.losses}</span>
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid w-full max-w-[240px] grid-cols-2 gap-x-6 gap-y-2 font-retro text-[9px]">
        <StatRow label="HP" value={current.hp} color="text-retro-green" />
        <StatRow label="ATK" value={current.attack} color="text-retro-accent" />
        <StatRow label="DEF" value={current.defense} color="text-retro-blue" />
        <StatRow label="SP.ATK" value={current.sp_attack} color="text-purple-400" />
        <StatRow label="SPD" value={current.speed} color="text-retro-gold" />
      </div>

      {/* Moves */}
      {current.moves.length > 0 && (
        <div className="w-full max-w-[240px] flex flex-col gap-1.5">
          <span className="font-retro text-[7px] text-retro-white/30 uppercase">
            Moves
          </span>
          {current.moves.map((move) => (
            <div key={move.name} className="flex justify-between items-center">
              <span className="font-retro text-[8px] text-retro-white/80">
                {move.name}
              </span>
              <span
                className={`font-retro text-[6px] px-1.5 py-0.5 uppercase ${
                  EFFECT_COLORS[move.effect] || EFFECT_COLORS.strike
                }`}
              >
                {move.effect}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Backstory */}
      {current.backstory && (
        <p className="font-retro text-[7px] text-retro-white/50 text-center leading-relaxed max-w-[260px]">
          {current.backstory}
        </p>
      )}
    </div>
  );
}

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-retro-white/60">{label}</span>
      <span className={color}>{value}</span>
    </div>
  );
}
