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
  image_url: string;
}

export type GamePhase = "lobby" | "create" | "battle" | "results";
