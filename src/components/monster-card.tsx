"use client";

import Image from "next/image";
import { RetroCard } from "./retro-card";
import type { Monster } from "@/lib/types";

interface MonsterCardProps {
  monster: Monster;
  highlight?: boolean;
  compact?: boolean;
}

export function MonsterCard({ monster, highlight, compact }: MonsterCardProps) {
  return (
    <RetroCard
      className={highlight ? "ring-2 ring-retro-gold ring-offset-2 ring-offset-retro-black" : ""}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-32 w-32 overflow-hidden border-2 border-retro-white bg-[#4a90d9]">
          <Image
            src={monster.image_url}
            alt={monster.name}
            fill
            className="object-contain"
            unoptimized
          />
        </div>
        <div className="flex items-center gap-2">
          <h3 className="font-retro text-xs text-retro-gold">{monster.name}</h3>
          <StageIndicator stage={monster.stage} />
        </div>
        <div className="grid w-full grid-cols-2 gap-x-4 gap-y-1 text-[8px]">
          <StatRow label="HP" value={monster.hp} color="text-retro-green" />
          <StatRow label="ATK" value={monster.attack} color="text-retro-accent" />
          <StatRow label="DEF" value={monster.defense} color="text-retro-blue" />
          <StatRow label="SPD" value={monster.speed} color="text-retro-gold" />
        </div>
        {!compact && monster.backstory && (
          <p className="font-retro text-[7px] text-retro-white/50 text-center leading-relaxed">
            {monster.backstory}
          </p>
        )}
      </div>
    </RetroCard>
  );
}

function StageIndicator({ stage }: { stage: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map((s) => (
        <span
          key={s}
          className={`text-[8px] ${
            s <= stage ? "text-retro-gold" : "text-retro-white/20"
          }`}
        >
          ◆
        </span>
      ))}
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
