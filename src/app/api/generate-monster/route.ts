import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { normalizeStats } from "@/lib/normalize-stats";
import { normalizeMoves } from "@/lib/normalize-moves";

const openai = new OpenAI();

const IMAGE_PROMPT = (name: string, appearance: string) =>
  `A 16-bit SNES-style pixel art creature named "${name}". ${appearance}. Design principles: simple readable silhouette with ONE distinctive feature, large expressive eyes, 2-3 main colors in a cohesive palette, friendly rounded proportions even if tough. Front-facing full body on a solid blue (#4a90d9) background. Bold dark outlines, clean pixel shading. No text or UI elements.`;

const STAT_BUDGET = 340;

const STATS_PROMPT = (name: string) =>
  `You are a creature designer for a monster battling game. Generate stats, appearance, a Pokedex entry, and two battle moves for a stage 1 baby monster named "${name}".
Return ONLY a JSON object with these fields:
{
  "hp": number, "attack": number, "defense": number, "sp_attack": number, "speed": number,
  "backstory": string,
  "appearance": string,
  "moves": [{ "name": string, "effect": "strike" | "guard" | "rush" | "drain" | "stun", "category": "physical" | "special" }, { "name": string, "effect": "strike" | "guard" | "rush" | "drain" | "stun", "category": "physical" | "special" }]
}

STATS: Integers 30-100. Distribute exactly ${STAT_BUDGET} points across hp/attack/defense/sp_attack/speed. Create a distinct archetype — don't make all stats similar. A physical bruiser should have high attack but low sp_attack. A mystic creature should have high sp_attack but low attack. Tanks have high hp+defense but low speed, etc.

BACKSTORY: Write a Pokedex-style field observation — 1-2 sentences about the creature's biology, behavior, or habitat. NOT an origin story. Think nature documentary, not fantasy novel.
Examples of the tone:
- "For some time after its birth, it uses the nutrients that are packed into the seed on its back in order to grow."
- "The flame on its tail shows the strength of its life-force. If it is weak, the flame also burns weakly."
- "It digs deep burrows to live in. When in danger, it rolls up its body to withstand attacks."

APPEARANCE: A vivid 1-2 sentence visual description for a pixel artist. Focus on: one distinctive body feature, specific colors, personality expressed through posture/expression. Aim for a design that reads clearly as a small silhouette.

MOVES: Each move has a name (creative, thematic), an effect type, and a category. Give the monster two DIFFERENT effect types — variety makes battles more interesting.
Effects: "strike" (reliable damage), "guard" (defensive, reduces incoming damage), "rush" (heavy hitter but leaves user exposed), "drain" (vampiric — deals damage AND heals the attacker, great for sustain fighters), "stun" (chance to skip opponent's turn).
Category: "physical" (uses Attack stat) or "special" (uses Sp. Attack stat). Match category to the monster's archetype.`;

export async function POST(req: Request) {
  try {
    const { name } = await req.json();

    if (!name || typeof name !== "string" || name.length > 30) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    // Check if monster already exists (upsert behavior)
    const { data: existing } = await supabase
      .from("monsters")
      .select("*")
      .eq("name", name.trim())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ monster: existing });
    }

    // Step 1: Generate stats, appearance, backstory, and moves
    const statsResult = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: STATS_PROMPT(name) }],
      response_format: { type: "json_object" },
    });

    const raw = JSON.parse(
      statsResult.choices[0].message.content ?? "{}"
    ) as {
      hp: number; attack: number; defense: number; sp_attack: number; speed: number;
      backstory: string; appearance: string;
      moves: { name: string; effect: string; category: string }[];
    };
    const stats = normalizeStats(raw, STAT_BUDGET, 100);
    const backstory = typeof raw.backstory === "string" ? raw.backstory : "";
    const appearance = typeof raw.appearance === "string" ? raw.appearance : "";
    const moves = normalizeMoves(raw.moves, 1);

    // Step 2: Generate image using the AI-written appearance
    const imageResult = await openai.images.generate({
      model: "gpt-image-1",
      prompt: IMAGE_PROMPT(name, appearance || `A small, cute baby creature with fantastical monster traits`),
      n: 1,
      size: "1024x1024",
      quality: "medium",
    });

    // Generate random evolution thresholds
    const evo_threshold_2 = Math.floor(Math.random() * 6) + 5;  // 5-10
    const evo_threshold_3 = Math.floor(Math.random() * 16) + 15; // 15-30

    // Upload image to Supabase Storage
    const imageB64 = imageResult.data?.[0]?.b64_json;
    if (!imageB64) {
      return NextResponse.json(
        { error: "Image generation failed" },
        { status: 500 }
      );
    }

    const imageBuffer = Buffer.from(imageB64, "base64");
    const fileName = `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("monsters")
      .upload(fileName, imageBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Image upload failed" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("monsters").getPublicUrl(fileName);

    // Insert monster into database
    const { data: monster, error: insertError } = await supabase
      .from("monsters")
      .insert({
        name: name.trim(),
        hp: stats.hp,
        attack: stats.attack,
        defense: stats.defense,
        sp_attack: stats.sp_attack,
        speed: stats.speed,
        image_url: publicUrl,
        backstory,
        appearance,
        moves,
        stage: 1,
        evo_threshold_2,
        evo_threshold_3,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save monster" },
        { status: 500 }
      );
    }

    return NextResponse.json({ monster });
  } catch (error) {
    console.error("Generate monster error:", error);
    return NextResponse.json(
      { error: "Monster generation failed" },
      { status: 500 }
    );
  }
}
