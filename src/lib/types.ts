export interface Monster {
  id: string;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  image_url: string;
  created_at: string;
}

export interface Battle {
  id: string;
  winner_id: string;
  loser_id: string;
  created_at: string;
}

export interface Player {
  name: string;
  monster: Monster | null;
}

export interface LeaderboardEntry {
  monster_name: string;
  wins: number;
  losses: number;
  attack: number;
  image_url: string;
}

export type GamePhase = "lobby" | "create" | "bracket" | "battle" | "results";

export type MonsterGenStatus = "idle" | "generating" | "ready" | "error";

export interface BracketMatch {
  /** Index into flat bracket array */
  index: number;
  round: number;
  /** Player indices or null for bye/TBD */
  playerA: number | null;
  playerB: number | null;
  /** Index of winning player after match completes */
  winner: number | null;
  battleLog: string[];
  narration: string;
}

export interface TournamentState {
  matches: BracketMatch[];
  totalRounds: number;
  currentMatchIndex: number;
  champion: number | null;
}
