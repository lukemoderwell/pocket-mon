'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { fetchMonstersWithStats, toMonster } from '@/lib/fetch-monsters';
import { RetroCard } from '@/components/retro-card';
import { RetroButton } from '@/components/retro-button';
import { MonsterDetailSheet } from '@/components/monster-detail-sheet';
import { MatchFight } from '@/components/match-fight';
import { EvolutionCutscene } from '@/components/evolution-cutscene';
import type { LeaderboardEntry, Monster, SortMode } from '@/lib/types';

const SORT_OPTIONS: { mode: SortMode; label: string }[] = [
  { mode: 'wins', label: 'Wins' },
  { mode: 'alpha', label: 'A–Z' },
  { mode: 'newest', label: 'New' },
];

type PageMode = 'list' | 'fighting' | 'evolving' | 'result';

export default function PokedexPage() {
  const [monsters, setMonsters] = useState<LeaderboardEntry[]>([]);
  const [selectedMonster, setSelectedMonster] =
    useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('wins');

  // Quick battle state
  const [mode, setMode] = useState<PageMode>('list');
  const [battleMonster, setBattleMonster] = useState<Monster | null>(null);
  const [opponentMonster, setOpponentMonster] = useState<Monster | null>(null);
  const [lastWinner, setLastWinner] = useState<string | null>(null);
  const [evolvingMonster, setEvolvingMonster] = useState<Monster | null>(null);

  const fetchAll = useCallback(async () => {
    const entries = await fetchMonstersWithStats();
    setMonsters(entries);
    setLoading(false);
  }, []);

  // Fetch on mount + re-fetch when page regains focus
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') fetchAll();
    }
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchAll]);

  const sortedMonsters = useMemo(() => {
    const sorted = [...monsters];
    switch (sortMode) {
      case 'alpha':
        sorted.sort((a, b) => a.monster_name.localeCompare(b.monster_name));
        break;
      case 'wins':
        sorted.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
        break;
      case 'newest':
        sorted.sort((a, b) =>
          b.created_at > a.created_at
            ? 1
            : b.created_at < a.created_at
              ? -1
              : 0,
        );
        break;
    }
    return sorted;
  }, [monsters, sortMode]);

  function startQuickBattle() {
    if (!selectedMonster) return;
    const others = monsters.filter((m) => m.id !== selectedMonster.id);
    if (others.length === 0) return;
    const opponent = others[Math.floor(Math.random() * others.length)];
    setBattleMonster(toMonster(selectedMonster));
    setOpponentMonster(toMonster(opponent));
    setSelectedMonster(null);
    setMode('fighting');
  }

  async function checkEvolutionEligibility(monster: Monster): Promise<boolean> {
    if (monster.stage >= 3) return false;

    const { data: fresh } = await supabase
      .from('monsters')
      .select('stage, evo_threshold_2, evo_threshold_3')
      .eq('id', monster.id)
      .single();

    if (!fresh) return false;

    const stage = fresh.stage ?? monster.stage;
    if (stage >= 3) return false;

    const threshold =
      stage === 1 ? fresh.evo_threshold_2 : fresh.evo_threshold_3;
    if (threshold == null) return false;

    const { count } = await supabase
      .from('battles')
      .select('*', { count: 'exact', head: true })
      .eq('winner_id', monster.id);

    return (count ?? 0) >= threshold;
  }

  async function handleFightComplete(result: {
    winner: Monster;
    loser: Monster;
  }) {
    setLastWinner(result.winner.name);

    const { error: insertError } = await supabase
      .from('battles')
      .insert({ winner_id: result.winner.id, loser_id: result.loser.id });
    if (insertError) {
      console.error('Failed to save battle:', insertError);
    }

    // Check evolution eligibility for the winner
    const eligible = await checkEvolutionEligibility(result.winner);
    if (eligible) {
      setEvolvingMonster(result.winner);
      setMode('evolving');
    } else {
      setMode('result');
    }
  }

  function handleEvolutionComplete() {
    setEvolvingMonster(null);
    setMode('result');
  }

  function handleBackToList() {
    setMode('list');
    setBattleMonster(null);
    setOpponentMonster(null);
    setLastWinner(null);
    fetchAll();
  }

  // ─── Fighting mode ──────────────────────────────────────────────
  if (mode === 'fighting' && battleMonster && opponentMonster) {
    return (
      <MatchFight
        monsterA={battleMonster}
        monsterB={opponentMonster}
        playerAName={battleMonster.name}
        playerBName={opponentMonster.name}
        onComplete={handleFightComplete}
      />
    );
  }

  // ─── Evolving mode ─────────────────────────────────────────────
  if (mode === 'evolving' && evolvingMonster) {
    return (
      <EvolutionCutscene
        monster={evolvingMonster}
        playerIndex={0}
        onComplete={handleEvolutionComplete}
      />
    );
  }

  // ─── Result mode ────────────────────────────────────────────────
  if (mode === 'result') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
        <motion.p
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="font-retro text-sm text-retro-gold"
        >
          {lastWinner} wins!
        </motion.p>
        <RetroButton onClick={handleBackToList}>Back to Pokedex</RetroButton>
      </div>
    );
  }

  // ─── List mode ──────────────────────────────────────────────────
  return (
    <div className="flex min-h-dvh flex-col items-center gap-6 p-6">
      {/* Header */}
      <div className="w-full max-w-sm flex items-center justify-between">
        <Link
          href="/"
          className="font-retro text-[9px] text-retro-white/40 hover:text-retro-white/70 transition-colors"
        >
          ← Back
        </Link>
        <h1 className="font-retro text-sm text-retro-gold">Pokedex</h1>
        <span className="font-retro text-[9px] text-retro-white/30">
          {monsters.length}
        </span>
      </div>

      {/* Sort controls */}
      <div className="w-full max-w-sm flex items-center gap-2">
        <span className="font-retro text-[7px] text-retro-white/30 shrink-0">
          Sort
        </span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            onClick={() => setSortMode(opt.mode)}
            className={`font-retro text-[7px] px-2 py-1 rounded transition-colors ${
              sortMode === opt.mode
                ? 'bg-retro-gold text-retro-black'
                : 'bg-retro-white/5 text-retro-white/40 hover:bg-retro-white/10'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Monster list */}
      <div className="w-full max-w-sm">
        {loading ? (
          <p className="font-retro text-[8px] text-retro-white/30 text-center py-8">
            Loading...
          </p>
        ) : sortedMonsters.length === 0 ? (
          <RetroCard>
            <p className="font-retro text-[8px] text-retro-white/40 text-center">
              No monsters yet. Start a game to create some!
            </p>
          </RetroCard>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedMonsters.map((entry, i) => (
              <motion.button
                key={`${entry.monster_name}-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.6) }}
                onClick={() => setSelectedMonster(entry)}
                className="flex items-center gap-4 p-3 rounded pixel-border bg-retro-dark hover:bg-retro-white/5 active:bg-retro-white/10 transition-colors text-left"
              >
                <span className="font-retro text-[9px] text-retro-white/30 w-5 shrink-0 text-right">
                  {i + 1}
                </span>
                <div className="relative h-12 w-12 shrink-0 overflow-hidden border-2 border-retro-white bg-[#4a90d9]">
                  <Image
                    src={entry.image_url}
                    alt={entry.monster_name}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-retro text-[9px] text-retro-white truncate">
                      {entry.monster_name}
                    </span>
                    {entry.gender && (
                      <span
                        className={`text-[6px] shrink-0 ${
                          entry.gender === 'male'
                            ? 'text-retro-blue'
                            : 'text-pink-400'
                        }`}
                      >
                        {entry.gender === 'male' ? '\u2642' : '\u2640'}
                      </span>
                    )}
                    <div className="flex gap-0.5 shrink-0">
                      {entry.evo_threshold_2 != null ? (
                        [1, 2, 3].map((s) => (
                          <span
                            key={s}
                            className={`text-[6px] ${
                              s <= entry.stage
                                ? 'text-retro-gold'
                                : 'text-retro-white/20'
                            }`}
                          >
                            ◆
                          </span>
                        ))
                      ) : (
                        <span className="text-[6px] text-retro-gold">◆</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 font-retro text-[7px]">
                    <span>
                      <span className="text-retro-green">{entry.wins}W</span>
                      <span className="text-retro-white/20"> / </span>
                      <span className="text-retro-accent">{entry.losses}L</span>
                    </span>
                    <span className="text-retro-gold">ATK {entry.attack}</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Monster Detail Sheet */}
      <MonsterDetailSheet
        entry={selectedMonster}
        onClose={() => setSelectedMonster(null)}
        onQuickBattle={monsters.length >= 2 ? startQuickBattle : undefined}
      />
    </div>
  );
}
