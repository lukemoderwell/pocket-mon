import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { normalizeStats } from "@/lib/normalize-stats";

const openai = new OpenAI();

const IMAGE_PROMPT = (name: string) =>
  `A 16-bit SNES-style pixel art baby creature named "${name}". Based on a real animal but with fantastical monster traits. Small, round, chibi proportions with oversized eyes and a tiny body. Adorable and innocent like a young animal cub or hatchling. Front-facing full body on a solid blue (#4a90d9) background. 16-color palette, bold outlines. No text or UI elements.`;

const STAT_BUDGET = 280;

const STATS_PROMPT = (name: string) =>
  `You are a game designer. Generate battle stats and a short backstory for a monster named "${name}".
Return ONLY a JSON object with these fields:
{ "hp": number, "attack": number, "defense": number, "speed": number, "backstory": string }
Stats should be integers 30-100 and feel thematic for the name. Distribute exactly ${STAT_BUDGET} points across hp/attack/defense/speed.
The backstory should be 1-2 sentences describing the monster's origin or personality, written in a fun retro RPG style.`;

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

    // Generate image + stats/backstory in parallel
    const [imageResult, statsResult] = await Promise.all([
      openai.images.generate({
        model: "gpt-image-1",
        prompt: IMAGE_PROMPT(name),
        n: 1,
        size: "1024x1024",
        quality: "medium",
      }),
      openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: STATS_PROMPT(name) }],
        response_format: { type: "json_object" },
      }),
    ]);

    // Parse stats + backstory, normalize to fixed budget
    const raw = JSON.parse(
      statsResult.choices[0].message.content ?? "{}"
    ) as { hp: number; attack: number; defense: number; speed: number; backstory: string };
    const stats = normalizeStats(raw, STAT_BUDGET, 100);
    const backstory = typeof raw.backstory === "string" ? raw.backstory : "";

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
