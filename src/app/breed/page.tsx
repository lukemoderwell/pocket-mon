"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { RetroButton } from "@/components/retro-button";
import { RetroCard } from "@/components/retro-card";
import { EggHatch } from "@/components/egg-hatch";
import { supabase } from "@/lib/supabase";
import { canBreed, canBreedTogether } from "@/lib/breeding";
import type { Monster } from "@/lib/types";

type PageMode = "select" | "confirm" | "hatching" | "generating" | "result";

export default function BreedPage() {
  const router = useRouter();
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [breedable, setBreedable] = useState<Monster[]>([]);
  const [loading, setLoading] = useState(true);
  const [parentA, setParentA] = useState<Monster | null>(null);
  const [parentB, setParentB] = useState<Monster | null>(null);
  const [mode, setMode] = useState<PageMode>("select");
  const [babyName, setBabyName] = useState("");
  const [offspring, setOffspring] = useState<Monster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Fetch all breedable monsters
  useEffect(() => {
    async function fetchBreedable() {
      const { data } = await supabase
        .from("monsters")
        .select("*")
        .in("stage", [1, 3]);

      if (data) {
        const all = data as Monster[];
        // Filter to actually breedable ones
        const eligible = all.filter((m) => canBreed(m));
        setMonsters(all);
        setBreedable(eligible);
      }
      setLoading(false);
    }
    fetchBreedable();
  }, []);

  // Get compatible mates for selected parent
  const getCompatible = useCallback(
    (selected: Monster) => {
      return breedable.filter((m: Monster) => {
        const check = canBreedTogether(selected, m);
        return check.ok;
      });
    },
    [breedable]
  );

  const handleSelectA = (m: Monster) => {
    setParentA(m);
    setParentB(null);
    setError(null);
  };

  const handleSelectB = (m: Monster) => {
    if (!parentA) return;
    const check = canBreedTogether(parentA, m);
    if (!check.ok) {
      setError(check.reason ?? "Cannot breed these two");
      return;
    }
    setParentB(m);
    setError(null);
  };

  const handleConfirm = () => {
    if (!parentA || !parentB || !babyName.trim()) return;
    setMode("hatching");
  };

  const handleHatchSuccess = async () => {
    if (!parentA || !parentB) return;
    setMode("generating");
    setGenerating(true);

    try {
      // Determine mother/father
      const motherId = parentA.gender === "female" ? parentA.id : parentB.id;
      const fatherId = parentA.gender === "male" ? parentA.id : parentB.id;

      const res = await fetch("/api/breed-monster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mother_id: motherId,
          father_id: fatherId,
          name: babyName.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Breeding failed");
      }

      const data = await res.json();
      setOffspring(data.monster);
      setMode("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Breeding failed");
      setMode("select");
    } finally {
      setGenerating(false);
    }
  };

  const handleHatchFail = () => {
    setMode("confirm");
  };

  const motherName =
    parentA?.gender === "female" ? parentA.name : parentB?.name ?? "";
  const fatherName =
    parentA?.gender === "male" ? parentA.name : parentB?.name ?? "";

  // ─── Hatching mini-games ─────────────────────────────────────
  if (mode === "hatching") {
    return (
      <EggHatch
        motherName={motherName || parentA?.name || "Mom"}
        fatherName={fatherName || parentB?.name || "Dad"}
        onHatch={handleHatchSuccess}
        onFail={handleHatchFail}
      />
    );
  }

  // ─── Generating offspring ─────────────────────────────────────
  if (mode === "generating") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-retro-black">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-retro-gold/30 border-t-retro-gold rounded-full"
        />
        <p className="font-retro text-[10px] text-retro-white/50 animate-pulse">
          Creating offspring...
        </p>
      </div>
    );
  }

  // ─── Result — show offspring ──────────────────────────────────
  if (mode === "result" && offspring) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="flex flex-col items-center gap-4"
        >
          <p className="font-retro text-[10px] text-retro-white/60">
            A hatchling was born!
          </p>
          <span className="font-retro text-[7px] text-pink-400 border border-pink-400/40 px-2 py-0.5">
            Stage 0 - Hatchling
          </span>

          <div className="relative h-40 w-40 overflow-hidden border-4 border-retro-gold bg-[#4a90d9]">
            <Image
              src={offspring.image_url}
              alt={offspring.name}
              fill
              className="object-contain"
              unoptimized
            />
          </div>

          <h2 className="font-retro text-sm text-retro-gold">
            {offspring.name}
          </h2>

          {/* Gender badge */}
          <span
            className={`font-retro text-[8px] px-2 py-0.5 border ${
              offspring.gender === "female"
                ? "text-pink-400 border-pink-400/40"
                : "text-blue-400 border-blue-400/40"
            }`}
          >
            {offspring.gender === "female" ? "\u2640 Female" : "\u2642 Male"}
          </span>

          <p className="font-retro text-[8px] text-retro-white/50 text-center max-w-xs">
            {offspring.backstory}
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[8px] font-retro">
            <StatRow label="HP" value={offspring.hp} />
            <StatRow label="ATK" value={offspring.attack} />
            <StatRow label="DEF" value={offspring.defense} />
            <StatRow label="SP.ATK" value={offspring.sp_attack} />
            <StatRow label="SPD" value={offspring.speed} />
          </div>

          {/* Moves */}
          {offspring.moves?.length > 0 && (
            <div className="flex flex-col items-center gap-1 mt-1">
              <span className="font-retro text-[7px] text-retro-white/40 uppercase">
                Moves
              </span>
              <div className="flex gap-3">
                {offspring.moves.map((move: { name: string }) => (
                  <span
                    key={move.name}
                    className="font-retro text-[8px] text-retro-gold"
                  >
                    {move.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Parents */}
          <p className="font-retro text-[7px] text-retro-white/30 mt-2">
            Parents: {parentA?.name} + {parentB?.name}
          </p>
          <p className="font-retro text-[7px] text-retro-green/60 mt-1">
            Evolves 3 times: 0 &rarr; 1 &rarr; 2 &rarr; 3
          </p>
        </motion.div>

        <div className="flex gap-3">
          <RetroButton
            onClick={() => {
              setMode("select");
              setParentA(null);
              setParentB(null);
              setOffspring(null);
              setBabyName("");
            }}
            variant="secondary"
          >
            Breed Again
          </RetroButton>
          <RetroButton onClick={() => router.push("/")}>Home</RetroButton>
        </div>
      </div>
    );
  }

  // ─── Selection / Confirm UI ───────────────────────────────────
  const compatibleMates = parentA ? getCompatible(parentA) : [];
  const listToShow = parentA ? compatibleMates : breedable;
  const selectingLabel = parentA
    ? `Choose a mate for ${parentA.name}`
    : "Choose the first parent";

  return (
    <div className="flex min-h-dvh flex-col items-center gap-6 p-6">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center"
      >
        <h1 className="font-retro text-sm text-retro-gold mb-1">Breeding</h1>
        <p className="font-retro text-[7px] text-retro-white/40">
          Combine two creatures to create an egg
        </p>
      </motion.div>

      {/* Selected parents display */}
      {(parentA || parentB) && (
        <div className="flex items-center gap-4">
          {parentA && (
            <ParentBadge
              monster={parentA}
              onClick={() => {
                setParentA(null);
                setParentB(null);
                setMode("select");
              }}
            />
          )}
          {parentA && (
            <span className="font-retro text-retro-gold text-sm">+</span>
          )}
          {parentB ? (
            <ParentBadge
              monster={parentB}
              onClick={() => {
                setParentB(null);
                setMode("select");
              }}
            />
          ) : (
            parentA && (
              <div className="w-16 h-16 border-2 border-dashed border-retro-white/20 flex items-center justify-center">
                <span className="font-retro text-[8px] text-retro-white/30">?</span>
              </div>
            )
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="font-retro text-[8px] text-retro-accent">{error}</p>
      )}

      {/* Confirm mode with name input */}
      {parentA && parentB && mode !== "result" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3 w-full max-w-xs"
        >
          <RetroCard className="w-full">
            <label className="font-retro text-[8px] text-retro-white/60 block mb-2">
              Name the offspring:
            </label>
            <input
              type="text"
              value={babyName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBabyName(e.target.value.slice(0, 30))}
              placeholder="Enter a name..."
              className="w-full bg-retro-black border-2 border-retro-white/30 px-3 py-2 font-retro text-[10px] text-retro-white placeholder:text-retro-white/20 focus:border-retro-gold outline-none"
            />
          </RetroCard>

          <RetroButton
            onClick={handleConfirm}
            disabled={!babyName.trim()}
          >
            Breed!
          </RetroButton>
        </motion.div>
      )}

      {/* Monster list */}
      {(!parentA || !parentB) && (
        <>
          <p className="font-retro text-[8px] text-retro-white/50">
            {loading ? "Loading..." : selectingLabel}
          </p>

          {!loading && listToShow.length === 0 && (
            <div className="text-center">
              <p className="font-retro text-[8px] text-retro-white/40 mb-2">
                {parentA
                  ? "No compatible mates found. Need opposite gender."
                  : "No breedable monsters found. Creatures need to reach stage 3 first."}
              </p>
              <RetroButton onClick={() => router.push("/")} variant="secondary">
                Back
              </RetroButton>
            </div>
          )}

          <div className="w-full max-w-sm flex flex-col gap-2">
            {listToShow.map((m: Monster) => (
              <button
                key={m.id}
                onClick={() => (parentA ? handleSelectB(m) : handleSelectA(m))}
                className="flex items-center gap-3 p-2 border-2 border-retro-white/10 hover:border-retro-gold/50 transition-colors bg-retro-dark"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden border-2 border-retro-white bg-[#4a90d9]">
                  <Image
                    src={m.image_url}
                    alt={m.name}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-retro text-[9px] text-retro-white truncate">
                      {m.name}
                    </span>
                    <span
                      className={`font-retro text-[7px] ${
                        m.gender === "female"
                          ? "text-pink-400"
                          : m.gender === "male"
                          ? "text-blue-400"
                          : "text-retro-white/30"
                      }`}
                    >
                      {m.gender === "female" ? "\u2640" : m.gender === "male" ? "\u2642" : "?"}
                    </span>
                  </div>
                  <div className="flex gap-3 font-retro text-[7px]">
                    <span className="text-retro-white/40">
                      Stage {m.stage}
                    </span>
                    {m.passive && (
                      <span className="text-retro-gold/60">{m.passive}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Back button */}
      <RetroButton onClick={() => router.push("/")} variant="secondary">
        Back to Lobby
      </RetroButton>
    </div>
  );
}

function ParentBadge({
  monster,
  onClick,
}: {
  monster: Monster;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 group">
      <div className="relative h-16 w-16 overflow-hidden border-2 border-retro-gold bg-[#4a90d9] group-hover:border-retro-accent transition-colors">
        <Image
          src={monster.image_url}
          alt={monster.name}
          fill
          className="object-contain"
          unoptimized
        />
      </div>
      <span className="font-retro text-[7px] text-retro-white/60 truncate max-w-[72px]">
        {monster.name}
      </span>
      <span
        className={`font-retro text-[7px] ${
          monster.gender === "female" ? "text-pink-400" : "text-blue-400"
        }`}
      >
        {monster.gender === "female" ? "\u2640" : "\u2642"}
      </span>
    </button>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-retro-white/60">{label}</span>
      <span className="text-retro-white">{value}</span>
    </div>
  );
}
