import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { normalizeStats } from "@/lib/normalize-stats";
import { normalizeMoves } from "@/lib/normalize-moves";

const openai = new OpenAI();

const IMAGE_PROMPT = (name: string, appearance: string) =>
  `A 16-bit SNES-style pixel art creature named "${name}". ${appearance}. Front-facing full body on a solid blue (#4a90d9) background. 16-color palette, bold outlines. No text or UI elements.`;

const STAT_BUDGET = 280;

const STATS_PROMPT = (name: string) =>
  `You are a game designer. Generate battle stats, a vivid visual appearance, a short backstory, and two battle moves for a stage 1 baby monster named "${name}".
Return ONLY a JSON object with these fields:
{
  "hp": number, "attack": number, "defense": number, "speed": number,
  "backstory": string,
  "appearance": string,
  "moves": [{ "name": string, "effect": "strike" | "guard" | "rush" }, { "name": string, "effect": "strike" | "guard" | "rush" }]
}
Stats should be integers 30-100 and feel thematic for the name. Distribute exactly ${STAT_BUDGET} points across hp/attack/defense/speed.
The backstory should be 1-2 sentences in a fun retro RPG style.
The appearance should be a vivid 1-2 sentence visual description of the creature's body, colors, distinctive features, and personality — be specific and creative, not generic. Think of it as art direction for a pixel artist.
Each move has a name (creative, thematic) and an effect type: "strike" (reliable), "guard" (defensive), or "rush" (heavy hitter). Give each monster a different combination.`;

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
      hp: number; attack: number; defense: number; speed: number;
      backstory: string; appearance: string;
      moves: { name: string; effect: string }[];
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
