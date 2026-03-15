import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { normalizeStats } from "@/lib/normalize-stats";
import { normalizeMoves } from "@/lib/normalize-moves";
import { canBreedTogether, getParents, inheritMoves, inheritPassive } from "@/lib/breeding";
import type { Monster, Move } from "@/lib/types";

const openai = new OpenAI();

const STAT_BUDGET = 260; // Stage 0 hatchling budget (weaker than stage 1's 340)

const IMAGE_PROMPT = (name: string, appearance: string) =>
  `A 16-bit SNES-style pixel art creature named "${name}". ${appearance}. Design principles: simple readable silhouette with ONE distinctive feature, large expressive eyes, 2-3 main colors in a cohesive palette, friendly rounded proportions even if tough. This is a TINY HATCHLING creature — very small, extremely cute, just born from an egg. Front-facing full body on a solid blue (#4a90d9) background. Bold dark outlines, clean pixel shading. No text or UI elements.`;

const OFFSPRING_PROMPT = (
  name: string,
  mother: Monster,
  father: Monster,
  inheritedMoves: Move[],
  inheritedPassive: string | undefined,
) =>
  `You are a creature designer for a monster battling game. Generate stats, appearance, a Pokedex entry, and two battle moves for a brand new BABY monster named "${name}".

This creature is the OFFSPRING of two parents:
- Mother: "${mother.name}" — ${mother.appearance}
- Father: "${father.name}" — ${father.appearance}

The baby should be a unique blend of both parents — combining visual traits, elemental themes, and personality from both. It should look like it could be THEIR child, but be its own distinct creature.

Inherited moves from parents: ${inheritedMoves.map((m) => `${m.name} (${m.effect}, ${m.category})`).join(", ")}
${inheritedPassive ? `Inherited passive ability: ${inheritedPassive}` : ""}

Return ONLY a JSON object with these fields:
{
  "hp": number, "attack": number, "defense": number, "sp_attack": number, "speed": number,
  "backstory": string,
  "appearance": string,
  "moves": [{ "name": string, "effect": "strike" | "guard" | "rush" | "drain" | "stun", "category": "physical" | "special", "accuracy": number }, { "name": string, "effect": "strike" | "guard" | "rush" | "drain" | "stun", "category": "physical" | "special", "accuracy": number }]
}

STATS: Integers 30-80. Distribute exactly ${STAT_BUDGET} points across hp/attack/defense/sp_attack/speed. This is a STAGE 0 HATCHLING — much weaker than a normal stage 1 creature. Stats should be low but loosely reflect a blend of its parents' strengths.

BACKSTORY: Write a Pokedex-style entry about this newly hatched creature. Mention traits it inherited from its parents. 1-2 sentences, nature-documentary tone.

APPEARANCE: Describe the tiny hatchling's visual design. It should blend features from both parents — maybe the mother's coloring with the father's body shape, or vice versa. Keep it VERY small, extremely cute, and newborn-looking — this is a stage 0 hatchling, even smaller than a normal baby creature. 1-2 vivid sentences.

MOVES: Create two tiny hatchling-versions of the inherited parent moves. Keep the same effect types (${inheritedMoves.map((m) => m.effect).join(", ")}) but give them new names fitting the hatchling's theme. These are much weaker, cuter versions of the parent moves — a hatchling's first attempts at using its abilities.
Effect types:
- "strike": Reliable damage. Accuracy 0.85-1.0.
- "guard": Defensive. Always accuracy 1.0.
- "rush": Heavy hit, leaves user exposed. Accuracy 0.6-0.8.
- "drain": Vampiric. Accuracy 0.8-0.95.
- "stun": Chance to skip opponent turn. Accuracy 0.7-0.9.
Category: "physical" or "special". Match to the creature's traits.`;

export async function POST(req: Request) {
  try {
    const { mother_id, father_id, name } = await req.json();

    if (!mother_id || !father_id || !name) {
      return NextResponse.json(
        { error: "mother_id, father_id, and name are required" },
        { status: 400 }
      );
    }

    if (typeof name !== "string" || name.length > 30) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    // Fetch both parents
    const [{ data: motherData }, { data: fatherData }] = await Promise.all([
      supabase.from("monsters").select("*").eq("id", mother_id).single(),
      supabase.from("monsters").select("*").eq("id", father_id).single(),
    ]);

    if (!motherData || !fatherData) {
      return NextResponse.json({ error: "Parent not found" }, { status: 404 });
    }

    const mother = motherData as Monster;
    const father = fatherData as Monster;

    // Validate breeding eligibility
    const check = canBreedTogether(mother, father);
    if (!check.ok) {
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }

    // Determine inherited traits
    const parents = getParents(mother, father);
    const inheritedMoves = inheritMoves(parents.mother, parents.father);
    const inheritedPassive = inheritPassive(parents.mother, parents.father);

    // Generate offspring stats and appearance via GPT
    const statsResult = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: OFFSPRING_PROMPT(
            name,
            parents.mother,
            parents.father,
            inheritedMoves,
            inheritedPassive
          ),
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = JSON.parse(
      statsResult.choices[0].message.content ?? "{}"
    ) as {
      hp: number;
      attack: number;
      defense: number;
      sp_attack: number;
      speed: number;
      backstory: string;
      appearance: string;
      moves: { name: string; effect: string; category: string; accuracy?: number }[];
    };

    const stats = normalizeStats(raw, STAT_BUDGET, 80);
    const backstory = typeof raw.backstory === "string" ? raw.backstory : "";
    const appearance = typeof raw.appearance === "string" ? raw.appearance : "";
    const moves = normalizeMoves(raw.moves, 0);
    const passive = inheritedPassive ?? undefined;
    const gender = Math.random() < 0.5 ? "male" : "female";

    // Generate image
    let imageResult;
    try {
      imageResult = await openai.images.generate({
        model: "gpt-image-1",
        prompt: IMAGE_PROMPT(name, appearance || "A small, cute baby creature with traits from two different monster parents"),
        n: 1,
        size: "1024x1024",
        quality: "medium",
      });
    } catch (imgErr: unknown) {
      const err = imgErr as { code?: string };
      if (err.code === "moderation_blocked") {
        imageResult = await openai.images.generate({
          model: "gpt-image-1",
          prompt: `A 16-bit SNES-style pixel art baby creature named "${name}". A small, cute newly hatched monster with fantastical traits. Front-facing full body on a solid blue (#4a90d9) background. Bold dark outlines, clean pixel shading, simple readable silhouette, large expressive eyes. No text or UI elements.`,
          n: 1,
          size: "1024x1024",
          quality: "medium",
        });
      } else {
        throw imgErr;
      }
    }

    const imageB64 = imageResult.data?.[0]?.b64_json;
    if (!imageB64) {
      return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
    }

    const imageBuffer = Buffer.from(imageB64, "base64");
    const fileName = `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("monsters")
      .upload(fileName, imageBuffer, { contentType: "image/png", upsert: false });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Image upload failed" }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("monsters").getPublicUrl(fileName);

    // Generate evolution thresholds for the offspring (3 evolutions: 0→1→2→3)
    const evo_threshold_1 = Math.floor(Math.random() * 3) + 3;   // 3-5 wins for stage 0→1
    const evo_threshold_2 = Math.floor(Math.random() * 6) + 8;   // 8-13 wins for stage 1→2
    const evo_threshold_3 = Math.floor(Math.random() * 11) + 18; // 18-28 wins for stage 2→3

    // Insert offspring into database at stage 0 (hatchling)
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
        passive,
        gender,
        stage: 0,
        evo_threshold_1,
        evo_threshold_2,
        evo_threshold_3,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json({ error: "Failed to save offspring" }, { status: 500 });
    }

    return NextResponse.json({
      monster,
      mother: { id: parents.mother.id, name: parents.mother.name },
      father: { id: parents.father.id, name: parents.father.name },
    });
  } catch (error) {
    console.error("Breed monster error:", error);
    return NextResponse.json({ error: "Breeding failed" }, { status: 500 });
  }
}
