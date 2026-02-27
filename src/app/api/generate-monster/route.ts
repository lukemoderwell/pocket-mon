import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";

const openai = new OpenAI();

const IMAGE_PROMPT = (name: string) =>
  `A 16-bit SNES-style pixel art monster named "${name}". Front-facing full body on a solid blue (#4a90d9) background. 16-color palette, bold outlines, cute but fierce. No text or UI elements.`;

const STATS_PROMPT = (name: string) =>
  `You are a game designer. Generate battle stats for a monster named "${name}".
Return ONLY a JSON object with these fields (integers 30-100):
{ "hp": number, "attack": number, "defense": number, "speed": number }
Stats should feel thematic for the name. Total of all stats should be between 180-320 to keep balance.`;

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

    // Generate image + stats in parallel
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

    // Parse stats
    const stats = JSON.parse(
      statsResult.choices[0].message.content ?? "{}"
    ) as { hp: number; attack: number; defense: number; speed: number };

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
