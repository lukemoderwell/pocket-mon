"use client";

import { useState } from "react";
import Image from "next/image";
import type { LeaderboardEntry, MoveEffect } from "@/lib/types";

interface MonsterDetailProps {
  entry: LeaderboardEntry;
}

const EFFECT_COLORS: Record<MoveEffect, string> = {
  strike: "text-retro-white bg-retro-white/10",
  guard: "text-retro-blue bg-retro-blue/10",
  rush: "text-retro-accent bg-retro-accent/10",
};

export function MonsterDetail({ entry }: MonsterDetailProps) {
  const [copied, setCopied] = useState(false);

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
          src={entry.image_url}
          alt={entry.monster_name}
          fill
          className="object-contain"
          unoptimized
        />
      </div>

      {/* Name + stage + copy */}
      <div className="flex items-center gap-2">
        <button
          onClick={copyName}
          className="font-retro text-sm text-retro-gold hover:text-retro-gold/80 active:scale-95 transition-all"
          title="Copy name"
        >
          {copied ? "Copied!" : entry.monster_name}
        </button>
        <div className="flex gap-0.5">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={`text-[10px] ${
                s <= entry.stage ? "text-retro-gold" : "text-retro-white/20"
              }`}
            >
              ◆
            </span>
          ))}
        </div>
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
        <StatRow label="HP" value={entry.hp} color="text-retro-green" />
        <StatRow label="ATK" value={entry.attack} color="text-retro-accent" />
        <StatRow label="DEF" value={entry.defense} color="text-retro-blue" />
        <StatRow label="SPD" value={entry.speed} color="text-retro-gold" />
      </div>

      {/* Moves */}
      {entry.moves.length > 0 && (
        <div className="w-full max-w-[240px] flex flex-col gap-1.5">
          <span className="font-retro text-[7px] text-retro-white/30 uppercase">
            Moves
          </span>
          {entry.moves.map((move) => (
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
      {entry.backstory && (
        <p className="font-retro text-[7px] text-retro-white/50 text-center leading-relaxed max-w-[260px]">
          {entry.backstory}
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
