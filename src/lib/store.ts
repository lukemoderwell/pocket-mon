"use client";

import { create } from "zustand";
import type {
  Monster,
  GamePhase,
  Player,
  MonsterGenStatus,
  TournamentState,
} from "./types";
import { buildBracket, findNextPlayableMatch, advanceWinner } from "./bracket";

interface GameState {
  phase: GamePhase;
  playerCount: number;
  players: Player[];
  currentPlayerIndex: number;
  genStatus: MonsterGenStatus[];
  tournament: TournamentState | null;

  // Actions
  setPhase: (phase: GamePhase) => void;
  setPlayerCount: (count: number) => void;
  initPlayers: () => void;
  setPlayerName: (index: number, name: string) => void;
  setPlayerMonster: (index: number, monster: Monster) => void;
  advancePlayer: () => void;
  setGenStatus: (index: number, status: MonsterGenStatus) => void;
  allMonstersReady: () => boolean;

  // Tournament
  initTournament: () => void;
  setMatchResult: (
    matchIndex: number,
    winnerPlayerIndex: number,
    log: string[],
    narration: string
  ) => void;
  advanceMatch: () => void;

  reset: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: "lobby",
  playerCount: 2,
  players: [
    { name: "", monster: null },
    { name: "", monster: null },
  ],
  currentPlayerIndex: 0,
  genStatus: ["idle", "idle"],
  tournament: null,

  setPhase: (phase) => set({ phase }),

  setPlayerCount: (count) => set({ playerCount: Math.max(2, Math.min(8, count)) }),

  initPlayers: () => {
    const { playerCount } = get();
    const players: Player[] = Array.from({ length: playerCount }, () => ({
      name: "",
      monster: null,
    }));
    const genStatus: MonsterGenStatus[] = Array.from(
      { length: playerCount },
      () => "idle"
    );
    set({ players, genStatus, currentPlayerIndex: 0, tournament: null });
  },

  setPlayerName: (index, name) =>
    set((state) => {
      const players = [...state.players];
      players[index] = { ...players[index], name };
      return { players };
    }),

  setPlayerMonster: (index, monster) =>
    set((state) => {
      const players = [...state.players];
      players[index] = { ...players[index], monster };
      return { players };
    }),

  advancePlayer: () =>
    set((state) => ({
      currentPlayerIndex: state.currentPlayerIndex + 1,
    })),

  setGenStatus: (index, status) =>
    set((state) => {
      const genStatus = [...state.genStatus];
      genStatus[index] = status;
      return { genStatus };
    }),

  allMonstersReady: () => {
    const { genStatus } = get();
    return genStatus.every((s) => s === "ready");
  },

  initTournament: () => {
    const { playerCount } = get();
    const tournament = buildBracket(playerCount);
    set({ tournament, phase: "bracket" });
  },

  setMatchResult: (matchIndex, winnerPlayerIndex, log, narration) =>
    set((state) => {
      if (!state.tournament) return {};
      const tournament = { ...state.tournament, matches: [...state.tournament.matches] };
      // Deep clone the match being updated
      tournament.matches[matchIndex] = {
        ...tournament.matches[matchIndex],
        battleLog: log,
        narration,
      };
      advanceWinner(tournament, matchIndex, winnerPlayerIndex);
      return { tournament };
    }),

  advanceMatch: () =>
    set((state) => {
      if (!state.tournament) return {};
      const next = findNextPlayableMatch(state.tournament);
      if (next !== null) {
        return {
          tournament: { ...state.tournament, currentMatchIndex: next },
          phase: "bracket",
        };
      }
      // Tournament over
      return { phase: "results" };
    }),

  reset: () =>
    set({
      phase: "lobby",
      playerCount: 2,
      players: [
        { name: "", monster: null },
        { name: "", monster: null },
      ],
      currentPlayerIndex: 0,
      genStatus: ["idle", "idle"],
      tournament: null,
    }),
}));
