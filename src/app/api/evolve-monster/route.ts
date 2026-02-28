import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { normalizeStats } from "@/lib/normalize-stats";
import { normalizeMoves } from "@/lib/normalize-moves";
import type { Move } from "@/lib/types";

const openai = new OpenAI();

const STAGE_CONFIG = {
  2: { budget: 430, maxStat: 120 },
  3: { budget: 520, maxStat: 140 },
} as const;

const STAGE_DESCRIPTORS: Record<number, string> = {
  2: "Teenage, mid-evolution form. Noticeably larger and leaner than its baby form, with sharper features, narrowed eyes, and a confident aggressive stance. Still growing but clearly more dangerous.",
  3: "Final, fully evolved apex form. Towering, muscular, and intimidating with battle-hardened details, intense piercing eyes, and a powerful dominant pose. A fearsome adult creature at the peak of its strength.",
};

const EVO_IMAGE_PROMPT = (name: string, stage: number, appearance: string) =>
  `A 16-bit SNES-style pixel art monster named "${name}". ${appearance || STAGE_DESCRIPTORS[stage]} Design principles: simple readable silhouette with ONE distinctive feature, large expressive eyes, 2-3 main colors in a cohesive palette. Front-facing full body on a solid blue (#4a90d9) background. Bold dark outlines, clean pixel shading. No text or UI elements.`;

const EVO_STATS_PROMPT = (name: string, stage: number, budget: number, currentMoves: Move[]) =>
  `You are a creature designer. Generate evolved stats, appearance, Pokedex entry, and two upgraded battle moves for a stage ${stage} monster named "${name}".
${currentMoves.length > 0 ? `Current moves: ${currentMoves.map(m => `${m.name} (${m.effect}, ${(m as Move & { category?: string }).category || "physical"})`).join(", ")}. Evolve these into stronger thematic versions, keeping their categories.` : ""}
Return ONLY a JSON object with these fields:
{
  "hp": number, "attack": number, "defense": number, "sp_attack": number, "speed": number,
  "backstory": string,
  "appearance": string,
  "moves": [{ "name": string, "effect": "strike" | "guard" | "rush" | "drain" | "stun", "category": "physical" | "special" }, { "name": string, "effect": "strike" | "guard" | "rush" | "drain" | "stun", "category": "physical" | "special" }]
}

STATS: Integers 30-${stage === 2 ? 120 : 140}. Distribute exactly ${budget} points across hp/attack/defense/sp_attack/speed. Maintain the monster's archetype but amplify its strengths.

BACKSTORY: Write a Pokedex-style field observation about the evolved form — 1-2 sentences about new abilities, changed behavior, or ecological role. NOT an origin story. Think nature documentary.

APPEARANCE: A vivid 1-2 sentence visual description showing how the creature has grown — larger, more dramatic features, evolved distinctive trait. Clear silhouette, expressive.

MOVES: Upgraded versions with more powerful names. Effects: "strike" (reliable), "guard" (defensive), "rush" (heavy but risky), "drain" (heals on hit), "stun" (chance to skip turn). Category: "physical" or "special".`;

export async function POST(req: Request) {
  try {
    const { monster_id } = await req.json();

    if (!monster_id || typeof monster_id !== "string") {
      return NextResponse.json({ error: "Invalid monster_id" }, { status: 400 });
    }

    // Fetch current monster
    const { data: monster, error: fetchError } = await supabase
      .from("monsters")
      .select("*")
      .eq("id", monster_id)
      .single();

    if (fetchError || !monster) {
      return NextResponse.json({ error: "Monster not found" }, { status: 404 });
    }

    if (monster.stage >= 3) {
      return NextResponse.json({ error: "Already at max stage" }, { status: 400 });
    }

    // Count wins for this monster
    const { count: winCount } = await supabase
      .from("battles")
      .select("*", { count: "exact", head: true })
      .eq("winner_id", monster_id);

    const wins = winCount ?? 0;
    const fromStage = monster.stage as number;
    const toStage = fromStage + 1;

    // Check threshold
    const thresholdKey = `evo_threshold_${toStage}` as "evo_threshold_2" | "evo_threshold_3";
    const threshold = monster[thresholdKey];
    if (threshold === null || wins < threshold) {
      return NextResponse.json(
        { error: "Not enough wins to evolve", wins, threshold },
        { status: 400 }
      );
    }

    const config = STAGE_CONFIG[toStage as 2 | 3];
    const currentMoves: Move[] = Array.isArray(monster.moves) ? monster.moves : [];

    // Step 1: Generate stats, appearance, backstory, and evolved moves
    const statsResult = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: EVO_STATS_PROMPT(monster.name, toStage, config.budget, currentMoves) }],
      response_format: { type: "json_object" },
    });

    const raw = JSON.parse(
      statsResult.choices[0].message.content ?? "{}"
    ) as {
      hp: number; attack: number; defense: number; sp_attack: number; speed: number;
      backstory: string; appearance: string;
      moves: { name: string; effect: string; category: string }[];
    };
    const stats = normalizeStats(raw, config.budget, config.maxStat);
    const backstory = typeof raw.backstory === "string" ? raw.backstory : monster.backstory;
    const appearance = typeof raw.appearance === "string" ? raw.appearance : "";
    const moves = normalizeMoves(raw.moves, toStage);

    console.log("Evolution stats debug:", {
      monsterName: monster.name,
      fromStage,
      toStage,
      rawFromGPT: { hp: raw.hp, attack: raw.attack, defense: raw.defense, sp_attack: raw.sp_attack, speed: raw.speed },
      normalized: stats,
      existing: { hp: monster.hp, attack: monster.attack, defense: monster.defense, sp_attack: monster.sp_attack, speed: monster.speed },
    });

    // Step 2: Generate image using the evolved appearance
    const imageResult = await openai.images.generate({
      model: "gpt-image-1",
      prompt: EVO_IMAGE_PROMPT(monster.name, toStage, appearance),
      n: 1,
      size: "1024x1024",
      quality: "medium",
    });

    // Upload new image
    const imageB64 = imageResult.data?.[0]?.b64_json;
    if (!imageB64) {
      return NextResponse.json(
        { error: "Evolution image generation failed" },
        { status: 500 }
      );
    }

    const imageBuffer = Buffer.from(imageB64, "base64");
    const fileName = `${monster.name.toLowerCase().replace(/\s+/g, "-")}-stage${toStage}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("monsters")
      .upload(fileName, imageBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Evolution image upload failed" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("monsters").getPublicUrl(fileName);

    // Save current stage as a snapshot in evolution_history
    const existingHistory: unknown[] = Array.isArray(monster.evolution_history) ? monster.evolution_history : [];
    const snapshot = {
      stage: fromStage,
      hp: monster.hp,
      attack: monster.attack,
      defense: monster.defense,
      sp_attack: monster.sp_attack ?? 50,
      speed: monster.speed,
      image_url: monster.image_url,
      backstory: monster.backstory,
      appearance: monster.appearance ?? "",
      moves: Array.isArray(monster.moves) ? monster.moves : [],
    };

    // Build update payload - only include evolution_history if column exists
    const updatePayload: Record<string, unknown> = {
      hp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      sp_attack: stats.sp_attack,
      speed: stats.speed,
      image_url: publicUrl,
      backstory,
      appearance,
      moves,
      stage: toStage,
    };

    // Try with evolution_history first, fall back without it
    let evolved, updateError;
    ({ data: evolved, error: updateError } = await supabase
      .from("monsters")
      .update({ ...updatePayload, evolution_history: [...existingHistory, snapshot] })
      .eq("id", monster_id)
      .select()
      .single());

    if (updateError?.code === "PGRST204") {
      // Column doesn't exist yet - update without it
      ({ data: evolved, error: updateError } = await supabase
        .from("monsters")
        .update(updatePayload)
        .eq("id", monster_id)
        .select()
        .single());
    }

    if (updateError || !evolved) {
      console.error("Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to save evolution" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      monster: evolved,
      fromStage,
      toStage,
    });
  } catch (error) {
    console.error("Evolve monster error:", error);
    return NextResponse.json(
      { error: "Evolution failed" },
      { status: 500 }
    );
  }
}
