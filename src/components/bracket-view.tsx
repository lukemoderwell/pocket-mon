"use client";

import { motion } from "motion/react";
import { RetroCard } from "./retro-card";
import { RetroButton } from "./retro-button";
import type { Player, TournamentState } from "@/lib/types";

interface BracketViewProps {
  tournament: TournamentState;
  players: Player[];
  onFight: (matchIndex: number) => void;
}

export function BracketView({ tournament, players, onFight }: BracketViewProps) {
  const { matches, totalRounds, currentMatchIndex } = tournament;

  function getPlayerLabel(playerIdx: number | null): string {
    if (playerIdx === null) return "BYE";
    return players[playerIdx]?.monster?.name ?? players[playerIdx]?.name ?? `P${playerIdx + 1}`;
  }

  const roundNames = (round: number, total: number): string => {
    if (round === total) return "Final";
    if (round === total - 1) return "Semifinal";
    return `Round ${round}`;
  };

  return (
    <div className="flex min-h-dvh flex-col items-center gap-6 p-6">
      <h1 className="font-retro text-sm text-retro-gold">Tournament</h1>

      {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => {
        const roundMatches = matches.filter((m) => m.round === round);
        // Skip rounds with only bye matches
        const hasRealMatch = roundMatches.some(
          (m) => m.playerA !== null && m.playerB !== null
        );
        if (!hasRealMatch && round !== totalRounds) return null;

        return (
          <motion.div
            key={round}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: round * 0.1 }}
            className="w-full max-w-xs"
          >
            <p className="font-retro text-[10px] text-retro-gold mb-2">
              {roundNames(round, totalRounds)}
            </p>
            <div className="flex flex-col gap-2">
              {roundMatches.map((match) => {
                // Skip pure bye matches (both null)
                if (match.playerA === null && match.playerB === null)
                  return null;

                const isCurrent = match.index === currentMatchIndex;
                const isPlayable =
                  match.winner === null &&
                  match.playerA !== null &&
                  match.playerB !== null;
                const isComplete = match.winner !== null;
                const isUpcoming =
                  !isComplete &&
                  (match.playerA === null || match.playerB === null);

                return (
                  <RetroCard
                    key={match.index}
                    className={
                      isCurrent && isPlayable
                        ? "ring-2 ring-retro-accent ring-offset-1 ring-offset-retro-black"
                        : ""
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-retro text-[8px] ${
                              isComplete && match.winner === match.playerA
                                ? "text-retro-gold"
                                : "text-retro-white"
                            }`}
                          >
                            {getPlayerLabel(match.playerA)}
                          </span>
                          <span className="font-retro text-[8px] text-retro-white/30">
                            vs
                          </span>
                          <span
                            className={`font-retro text-[8px] ${
                              isComplete && match.winner === match.playerB
                                ? "text-retro-gold"
                                : "text-retro-white"
                            }`}
                          >
                            {getPlayerLabel(match.playerB)}
                          </span>
                        </div>
                      </div>
                      {isCurrent && isPlayable && (
                        <RetroButton
                          onClick={() => onFight(match.index)}
                          className="text-[8px] px-3 py-1"
                        >
                          Fight!
                        </RetroButton>
                      )}
                      {isComplete && (
                        <span className="font-retro text-[8px] text-retro-green">
                          Done
                        </span>
                      )}
                      {isUpcoming && (
                        <span className="font-retro text-[8px] text-retro-white/30">
                          TBD
                        </span>
                      )}
                    </div>
                  </RetroCard>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
