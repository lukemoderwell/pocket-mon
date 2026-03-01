'use client';

import { BottomSheet } from '@/components/bottom-sheet';
import { MonsterDetail } from '@/components/monster-detail';
import { RetroButton } from '@/components/retro-button';
import type { LeaderboardEntry } from '@/lib/types';

interface MonsterDetailSheetProps {
  entry: LeaderboardEntry | null;
  onClose: () => void;
  onQuickBattle?: () => void;
}

export function MonsterDetailSheet({
  entry,
  onClose,
  onQuickBattle,
}: MonsterDetailSheetProps) {
  return (
    <BottomSheet open={entry !== null} onClose={onClose}>
      {entry && (
        <>
          <MonsterDetail entry={entry} />
          {onQuickBattle && (
            <div className="flex justify-center mt-4">
              <RetroButton
                onClick={onQuickBattle}
                className="text-[9px] px-6 py-2"
              >
                Quick Battle
              </RetroButton>
            </div>
          )}
        </>
      )}
    </BottomSheet>
  );
}
