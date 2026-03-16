'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { useGameStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { RetroButton } from '@/components/retro-button';
import { RetroCard } from '@/components/retro-card';
import { MonsterDetailSheet } from '@/components/monster-detail-sheet';
import { MatchFight } from '@/components/match-fight';
import { EvolutionCutscene } from '@/components/evolution-cutscene';
import { fetchMonstersWithStats, toMonster } from '@/lib/fetch-monsters';
import { canBattleAgainst } from '@/lib/battle-engine';
import type { LeaderboardEntry, Monster } from '@/lib/types';

const PLAYER_OPTIONS = [2, 3, 4, 5, 6, 7, 8];

type PageMode = 'lobby' | 'fighting' | 'evolving' | 'result';

export default function Home() {
  const router = useRouter();
  const { setPhase, reset, playerCount, setPlayerCount, initPlayers } =
    useGameStore();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedMonster, setSelectedMonster] =
    useState<LeaderboardEntry | null>(null);

  // Quick battle state
  const [mode, setMode] = useState<PageMode>('lobby');
  const [battleMonster, setBattleMonster] = useState<Monster | null>(null);
  const [opponentMonster, setOpponentMonster] = useState<Monster | null>(null);
  const [lastWinner, setLastWinner] = useState<string | null>(null);
  const [evolvingMonster, setEvolvingMonster] = useState<Monster | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    const entries = await fetchMonstersWithStats({
      onlyWithBattles: true,
      limit: 5,
    });
    setLeaderboard(entries);
  }, []);

  // Fetch on mount + re-fetch when page regains focus (e.g. returning from battle)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') fetchLeaderboard();
    }
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchLeaderboard]);

  function handleStart() {
    reset();
    setPlayerCount(playerCount);
    initPlayers();
    setPhase('create');
    router.push('/create');
  }

  function startQuickBattle() {
    if (!selectedMonster) return;
    const myMonster = toMonster(selectedMonster);
    // Filter opponents by stage compatibility (stage 0 can only fight stage 0-1)
    const others = leaderboard.filter((m) => {
      if (m.id === selectedMonster.id) return false;
      const opp = toMonster(m);
      return canBattleAgainst(myMonster, opp).ok;
    });
    if (others.length === 0) return;
    const opponent = others[Math.floor(Math.random() * others.length)];
    setBattleMonster(myMonster);
    setOpponentMonster(toMonster(opponent));
    setSelectedMonster(null);
    setMode('fighting');
  }

  async function checkEvolutionEligibility(monster: Monster): Promise<boolean> {
    if (monster.stage >= 3) return false;

    const { data: fresh } = await supabase
      .from('monsters')
      .select('stage, evo_threshold_1, evo_threshold_2, evo_threshold_3')
      .eq('id', monster.id)
      .single();

    if (!fresh) return false;

    const stage = fresh.stage ?? monster.stage;
    if (stage >= 3) return false;

    const threshold =
      stage === 0
        ? fresh.evo_threshold_1
        : stage === 1
          ? fresh.evo_threshold_2
          : fresh.evo_threshold_3;
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

  function handleBackToLobby() {
    setMode('lobby');
    setBattleMonster(null);
    setOpponentMonster(null);
    setLastWinner(null);
    fetchLeaderboard();
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
        <RetroButton onClick={handleBackToLobby}>Back</RetroButton>
      </div>
    );
  }

  // ─── Lobby mode ─────────────────────────────────────────────────
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      {/* Title */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center"
      >
        <h1 className="font-retro text-xl text-retro-gold mb-2">Pocket Mon</h1>
        <p className="font-retro text-[8px] text-retro-white/50">
          Create monsters. Battle friends. Win glory.
        </p>
      </motion.div>

      {/* Player Count Selector */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex flex-col items-center gap-2"
      >
        <p className="font-retro text-[8px] text-retro-white/60">Players</p>
        <div className="flex gap-2">
          {PLAYER_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setPlayerCount(n)}
              className={`font-retro text-xs w-8 h-8 border-2 transition-colors ${
                playerCount === n
                  ? 'border-retro-gold bg-retro-gold/20 text-retro-gold'
                  : 'border-retro-white/30 text-retro-white/50 hover:border-retro-white/60'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Start Button */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-3"
      >
        <RetroButton onClick={handleStart} className="text-sm px-8 py-4">
          Battle
        </RetroButton>
        <RetroButton
          onClick={() => router.push('/breed')}
          variant="secondary"
          className="text-sm px-8 py-4"
        >
          Breed
        </RetroButton>
      </motion.div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-sm"
        >
          <RetroCard>
            <h2 className="font-retro text-[10px] text-retro-gold mb-4 text-center">
              Leaderboard
            </h2>
            <div className="flex flex-col gap-3">
              {leaderboard.map((entry, i) => (
                <button
                  key={`${entry.monster_name}-${i}`}
                  onClick={() => setSelectedMonster(entry)}
                  className="flex items-center gap-4 p-2 -mx-2 rounded transition-colors hover:bg-retro-white/5 active:bg-retro-white/10 text-left"
                >
                  <span className="font-retro text-xs text-retro-accent w-5 shrink-0">
                    {i + 1}.
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
                        {entry.stage === 0 && (
                          <span className="text-[6px] text-pink-400">
                            &#9826;
                          </span>
                        )}
                        {[1, 2, 3].map((s) => (
                          <span
                            key={s}
                            className={`text-[6px] ${
                              s <= entry.stage
                                ? 'text-retro-gold'
                                : 'text-retro-white/20'
                            }`}
                          >
                            &#9670;
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3 font-retro text-[7px]">
                      <span>
                        <span className="text-retro-green">{entry.wins}W</span>
                        <span className="text-retro-white/20"> / </span>
                        <span className="text-retro-accent">
                          {entry.losses}L
                        </span>
                      </span>
                      <span className="text-retro-gold">
                        ATK {entry.attack}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <Link
              href="/pokedex"
              className="block mt-4 font-retro text-[8px] text-retro-white/40 text-center hover:text-retro-white/70 transition-colors"
            >
              View All →
            </Link>
          </RetroCard>
        </motion.div>
      )}

      {/* Monster Detail Sheet */}
      <MonsterDetailSheet
        entry={selectedMonster}
        onClose={() => setSelectedMonster(null)}
        onQuickBattle={leaderboard.length >= 2 ? startQuickBattle : undefined}
      />

      {/* Footer */}
      <p className="font-retro text-[6px] text-retro-white/20">
        Pass the phone. Create. Battle.
      </p>
    </div>
  );
}
