export type MoveEffect = "strike" | "guard" | "rush" | "drain" | "stun";
export type MoveCategory = "physical" | "special";

export interface Move {
  name: string;
  effect: MoveEffect;
  category: MoveCategory;
  power: number;
  cooldown: number;
  accuracy: number; // 0.0 - 1.0, chance to hit (before dodge)
  priority?: boolean; // if true, this move always goes first regardless of speed
}

/** Passive abilities assigned to monsters */
export type PassiveAbility =
  | "thick_skin"    // -15% incoming damage
  | "quick_feet"    // +15% dodge chance
  | "vampiric"      // heal 10% of damage dealt on every attack
  | "fierce"        // +20% damage when HP < 33%
  | "steady"        // immune to stun
  | "reckless";     // rush moves gain +25% power but no extra accuracy penalty

export type BodyType =
  | "bipedal"
  | "quadruped"
  | "serpentine"
  | "avian"
  | "insectoid"
  | "amorphous"
  | "floating"
  | "aquatic";

export interface StageSnapshot {
  stage: number;
  hp: number;
  attack: number;
  defense: number;
  sp_attack: number;
  speed: number;
  image_url: string;
  backstory: string;
  appearance: string;
  moves: Move[];
  passive?: PassiveAbility;
  weight?: number;
}

export type MonsterGender = "male" | "female";

export interface Monster {
  id: string;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  sp_attack: number;
  speed: number;
  image_url: string;
  backstory: string;
  appearance: string;
  moves: Move[];
  passive?: PassiveAbility;
  gender?: MonsterGender;
  stage: number;
  evolution_history: StageSnapshot[];
  evo_threshold_1: number | null;
  evo_threshold_2: number | null;
  evo_threshold_3: number | null;
  body_type?: BodyType;
  weight?: number;
  created_at: string;
}

export interface Egg {
  id: string;
  name: string;
  mother_id: string;
  father_id: string;
  inherited_moves: Move[];
  inherited_passive?: PassiveAbility;
  appearance_hint: string;
  hatched: boolean;
  monster_id?: string;
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
  id: string;
  monster_name: string;
  wins: number;
  losses: number;
  attack: number;
  hp: number;
  defense: number;
  sp_attack: number;
  speed: number;
  image_url: string;
  backstory: string;
  stage: number;
  moves: Move[];
  gender?: MonsterGender;
  evolution_history?: StageSnapshot[];
  evo_threshold_2?: number | null;
  body_type?: BodyType;
  passive?: PassiveAbility;
  weight?: number;
  created_at: string;
}

export type SortMode = "wins" | "alpha" | "newest";

export interface EvolutionResult {
  monster: Monster;
  fromStage: number;
  toStage: number;
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
  /** True if this match is a permanent bye (no real players will ever appear) */
  isBye: boolean;
}

export interface TournamentState {
  matches: BracketMatch[];
  totalRounds: number;
  currentMatchIndex: number;
  champion: number | null;
}
