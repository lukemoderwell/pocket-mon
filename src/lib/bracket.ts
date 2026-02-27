import type { BracketMatch, TournamentState } from "./types";

/** Smallest power of 2 >= n */
function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Build a single-elimination bracket for `playerCount` players.
 * Pads to next power of 2 — empty slots become byes.
 * Returns the full tournament state ready for play.
 */
export function buildBracket(playerCount: number): TournamentState {
  const size = nextPow2(playerCount);
  const totalRounds = Math.log2(size);
  const matches: BracketMatch[] = [];

  // Round 1: pair players. Indices beyond playerCount are byes (null).
  const round1Count = size / 2;
  for (let i = 0; i < round1Count; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const playerA = a < playerCount ? a : null;
    const playerB = b < playerCount ? b : null;

    // Auto-resolve byes
    let winner: number | null = null;
    if (playerA !== null && playerB === null) winner = playerA;
    if (playerA === null && playerB !== null) winner = playerB;
    // Both null = double bye (no winner, this slot is empty)

    matches.push({
      index: i,
      round: 1,
      playerA,
      playerB,
      winner,
      battleLog: [],
      narration: "",
    });
  }

  // Build subsequent rounds (empty, to be filled as matches complete)
  for (let round = 2; round <= totalRounds; round++) {
    const prevRoundMatches = matches.filter((m) => m.round === round - 1);
    const thisRoundCount = prevRoundMatches.length / 2;
    for (let i = 0; i < thisRoundCount; i++) {
      matches.push({
        index: matches.length,
        round,
        playerA: null,
        playerB: null,
        winner: null,
        battleLog: [],
        narration: "",
      });
    }
  }

  // Propagate bye winners forward through the bracket
  propagateByes(matches, totalRounds);

  const state: TournamentState = {
    matches,
    totalRounds,
    currentMatchIndex: 0,
    champion: null,
  };

  // Set currentMatchIndex to first playable match
  const first = findNextPlayableMatch(state);
  state.currentMatchIndex = first ?? 0;

  return state;
}

/**
 * Propagate bye winners forward through the bracket. Uses a Set to track
 * genuine "permanent bye" matches (will never produce a real fight) so we
 * don't confuse them with pending matches that just haven't been filled yet.
 */
function propagateByes(
  matches: BracketMatch[],
  totalRounds: number
): void {
  // Track match indices that are permanent byes (no real players will ever appear)
  const byeIndices = new Set<number>();

  // Round 1 double byes: both slots empty
  for (const m of matches) {
    if (m.round === 1 && m.playerA === null && m.playerB === null) {
      byeIndices.add(m.index);
    }
  }

  for (let round = 1; round < totalRounds; round++) {
    const roundMatches = matches.filter((m) => m.round === round);
    const nextRoundMatches = matches.filter((m) => m.round === round + 1);

    for (let i = 0; i < roundMatches.length; i += 2) {
      const matchA = roundMatches[i];
      const matchB = roundMatches[i + 1];
      const nextMatch = nextRoundMatches[Math.floor(i / 2)];
      if (!nextMatch) continue;

      // Push bye winners into next round
      if (matchA?.winner !== null) {
        nextMatch.playerA = matchA.winner;
      }
      if (matchB?.winner !== null) {
        nextMatch.playerB = matchB.winner;
      }

      const matchAIsBye = matchA && byeIndices.has(matchA.index);
      const matchBIsBye = matchB && byeIndices.has(matchB.index);

      // Both feeders are permanent byes → this match is also a permanent bye
      if (matchAIsBye && matchBIsBye) {
        byeIndices.add(nextMatch.index);
        continue;
      }

      // One player advanced, other feeder is a permanent bye → auto-advance
      if (nextMatch.playerA !== null && nextMatch.playerB === null && matchBIsBye) {
        nextMatch.winner = nextMatch.playerA;
      } else if (nextMatch.playerB !== null && nextMatch.playerA === null && matchAIsBye) {
        nextMatch.winner = nextMatch.playerB;
      }
    }
  }
}

/** Find the next match that needs to be played (has two players, no winner) */
export function findNextPlayableMatch(
  state: TournamentState
): number | null {
  for (const match of state.matches) {
    if (
      match.winner === null &&
      match.playerA !== null &&
      match.playerB !== null
    ) {
      return match.index;
    }
  }
  return null;
}

/**
 * After a match completes, advance the winner into the next round.
 * Mutates state in place (called inside Zustand set()).
 */
export function advanceWinner(
  state: TournamentState,
  matchIndex: number,
  winnerPlayerIndex: number
): void {
  const match = state.matches[matchIndex];
  match.winner = winnerPlayerIndex;

  // Is this the final match?
  if (match.round === state.totalRounds) {
    state.champion = winnerPlayerIndex;
    return;
  }

  // Find the next-round match this feeds into
  const roundMatches = state.matches.filter((m) => m.round === match.round);
  const posInRound = roundMatches.indexOf(match);
  const nextRoundMatches = state.matches.filter(
    (m) => m.round === match.round + 1
  );
  const nextMatch = nextRoundMatches[Math.floor(posInRound / 2)];
  if (!nextMatch) return;

  // Even position in round → slot A, odd → slot B
  if (posInRound % 2 === 0) {
    nextMatch.playerA = winnerPlayerIndex;
  } else {
    nextMatch.playerB = winnerPlayerIndex;
  }

  // Check if the sibling match (other feeder for nextMatch) has already
  // resolved or is a permanent bye. If so, we may be able to fill nextMatch.
  const siblingIdx = posInRound % 2 === 0 ? posInRound + 1 : posInRound - 1;
  const siblingMatch = roundMatches[siblingIdx];

  if (siblingMatch && siblingMatch.winner !== null) {
    // Sibling already resolved — push its winner into nextMatch
    if (siblingIdx % 2 === 0) {
      nextMatch.playerA = siblingMatch.winner;
    } else {
      nextMatch.playerB = siblingMatch.winner;
    }
  }
}
