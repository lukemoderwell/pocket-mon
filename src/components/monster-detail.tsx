'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import type {
  LeaderboardEntry,
  MoveEffect,
  PassiveAbility,
  StageSnapshot,
} from '@/lib/types';
import { PASSIVE_NAMES, PASSIVE_DESCRIPTIONS } from '@/lib/passive-abilities';

interface MonsterDetailProps {
  entry: LeaderboardEntry;
}

const EFFECT_COLORS: Record<MoveEffect, string> = {
  strike: 'text-retro-white bg-retro-white/10',
  guard: 'text-retro-blue bg-retro-blue/10',
  rush: 'text-retro-accent bg-retro-accent/10',
  drain: 'text-retro-green bg-retro-green/10',
  stun: 'text-yellow-400 bg-yellow-400/10',
  charge: 'text-retro-gold bg-retro-gold/10',
};

// Stage labels removed - keeping selector minimal

export function MonsterDetail({ entry }: MonsterDetailProps) {
  const [copied, setCopied] = useState(false);
  const [viewingStage, setViewingStage] = useState(entry.stage);

  // Build a map of stage -> snapshot data
  const stageData = useMemo(() => {
    const map = new Map<number, StageSnapshot>();

    if (entry.evolution_history) {
      for (const snap of entry.evolution_history) {
        map.set(snap.stage, snap);
      }
    }

    map.set(entry.stage, {
      stage: entry.stage,
      hp: entry.hp,
      attack: entry.attack,
      defense: entry.defense,
      sp_attack: entry.sp_attack,
      speed: entry.speed,
      image_url: entry.image_url,
      backstory: entry.backstory,
      appearance: '',
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
      {/* Evolution stage selector — just tappable diamonds */}
      {hasHistory && (
        <div className="flex items-center gap-3">
          {[0, 1, 2, 3].map((s) => {
            const exists = stageData.has(s);
            const isViewing = s === viewingStage;
            const isReached = s <= entry.stage;

            if (s === 0 && !exists) return null;

            return (
              <button
                key={s}
                onClick={() => exists && setViewingStage(s)}
                disabled={!exists}
                className={`relative p-2 text-base transition-all ${
                  isViewing
                    ? s === 0
                      ? 'text-pink-400 scale-150'
                      : 'text-retro-gold scale-150'
                    : isReached && exists
                      ? s === 0
                        ? 'text-pink-400/40 active:scale-125'
                        : 'text-retro-gold/40 active:scale-125'
                      : 'text-retro-white/15'
                } ${exists ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {s === 0 ? '\u2662' : '\u2666'}
                <span
                  className={`absolute inset-0 flex items-center justify-center font-retro text-[6px] ${
                    isViewing ? 'text-retro-black' : 'text-retro-black/60'
                  }`}
                >
                  {s}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Monster image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewingStage}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="relative h-40 w-40 overflow-hidden border-2 border-retro-white bg-[#4a90d9]"
        >
          <Image
            src={current.image_url}
            alt={entry.monster_name}
            fill
            className="object-contain"
            unoptimized
          />
        </motion.div>
      </AnimatePresence>

      {/* Name + copy + gender */}
      <div className="flex items-center gap-2">
        <button
          onClick={copyName}
          className="font-retro text-sm text-retro-gold hover:text-retro-gold/80 active:scale-95 transition-all"
          title="Copy name"
        >
          {copied ? 'Copied!' : entry.monster_name}
        </button>
        {entry.gender && (
          <span
            className={`font-retro text-xs ${
              entry.gender === 'male' ? 'text-retro-blue' : 'text-pink-400'
            }`}
            title={entry.gender === 'male' ? 'Male' : 'Female'}
          >
            {entry.gender === 'male' ? '\u2642' : '\u2640'}
          </span>
        )}
        {!hasHistory && (
          <div className="flex gap-0.5">
            {entry.stage === 0 && (
              <span className="text-[10px] text-pink-400">{'\u2662'}</span>
            )}
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`text-[10px] ${
                  s <= entry.stage ? 'text-retro-gold' : 'text-retro-white/20'
                }`}
              >
                {'\u2666'}
              </span>
            ))}
          </div>
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
        <StatRow
          label="SP.ATK"
          value={current.sp_attack}
          color="text-purple-400"
        />
        <StatRow label="SPD" value={current.speed} color="text-retro-gold" />
      </div>

      {/* Passive trait */}
      {entry.passive && (
        <div className="w-full max-w-[240px] flex flex-col gap-1">
          <span className="font-retro text-[7px] text-retro-white/30 uppercase">
            Passive
          </span>
          <div className="pixel-border bg-retro-dark/50 px-2 py-1.5">
            <span className="font-retro text-[8px] text-retro-gold">
              {PASSIVE_NAMES[entry.passive as PassiveAbility] ?? entry.passive}
            </span>
            <p className="font-retro text-[6px] text-retro-white/40 mt-0.5">
              {PASSIVE_DESCRIPTIONS[entry.passive as PassiveAbility] ?? ''}
            </p>
          </div>
        </div>
      )}

      {/* Moves */}
      {current.moves.length > 0 && (
        <div className="w-full max-w-[240px] flex flex-col gap-2">
          <span className="font-retro text-[7px] text-retro-white/30 uppercase">
            Moves
          </span>
          {current.moves.map((move) => (
            <div
              key={move.name}
              className="pixel-border bg-retro-dark/50 px-2 py-1.5"
            >
              <div className="flex justify-between items-center mb-1">
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
              <div className="flex gap-3 font-retro text-[6px] text-retro-white/40">
                <span>
                  PWR{' '}
                  <span className="text-retro-accent">
                    {move.power?.toFixed(1) ?? '?'}
                  </span>
                </span>
                <span>
                  ACC{' '}
                  <span className="text-retro-blue">
                    {move.accuracy != null
                      ? `${Math.round(move.accuracy * 100)}%`
                      : '100%'}
                  </span>
                </span>
                <span>
                  CD{' '}
                  <span className="text-retro-gold">{move.cooldown ?? 0}</span>
                </span>
                <span className="uppercase">
                  {move.category === 'special' ? (
                    <span className="text-purple-400">SP.ATK</span>
                  ) : (
                    <span className="text-retro-accent/60">ATK</span>
                  )}
                </span>
              </div>
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
