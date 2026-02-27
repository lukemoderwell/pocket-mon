"use client";

import { create } from "zustand";
import type { Monster, GamePhase, Player } from "./types";

interface GameState {
  phase: GamePhase;
  players: [Player, Player];
  currentPlayerIndex: 0 | 1;
  battleLog: string[];
  winner: Monster | null;
  loser: Monster | null;

  // Actions
  setPhase: (phase: GamePhase) => void;
  setPlayerName: (index: 0 | 1, name: string) => void;
  setPlayerMonster: (index: 0 | 1, monster: Monster) => void;
  advancePlayer: () => void;
  setBattleResult: (winner: Monster, loser: Monster, log: string[]) => void;
  reset: () => void;
}

const initialPlayers: [Player, Player] = [
  { name: "", monster: null },
  { name: "", monster: null },
];

export const useGameStore = create<GameState>((set) => ({
  phase: "lobby",
  players: [{ ...initialPlayers[0] }, { ...initialPlayers[1] }],
  currentPlayerIndex: 0,
  battleLog: [],
  winner: null,
  loser: null,

  setPhase: (phase) => set({ phase }),

  setPlayerName: (index, name) =>
    set((state) => {
      const players = [...state.players] as [Player, Player];
      players[index] = { ...players[index], name };
      return { players };
    }),

  setPlayerMonster: (index, monster) =>
    set((state) => {
      const players = [...state.players] as [Player, Player];
      players[index] = { ...players[index], monster };
      return { players };
    }),

  advancePlayer: () =>
    set((state) => ({
      currentPlayerIndex: state.currentPlayerIndex === 0 ? 1 : 0,
    })),

  setBattleResult: (winner, loser, log) =>
    set({ winner, loser, battleLog: log }),

  reset: () =>
    set({
      phase: "lobby",
      players: [{ name: "", monster: null }, { name: "", monster: null }],
      currentPlayerIndex: 0,
      battleLog: [],
      winner: null,
      loser: null,
    }),
}));
