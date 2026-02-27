import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { normalizeStats } from "@/lib/normalize-stats";

const openai = new OpenAI();

const STAGE_CONFIG = {
  2: { budget: 350, maxStat: 120 },
  3: { budget: 420, maxStat: 140 },
} as const;

const STAGE_DESCRIPTORS: Record<number, string> = {
  2: "Teenage, mid-evolution form. Noticeably larger and leaner than its baby form, with sharper features, narrowed eyes, and a confident aggressive stance. Still growing but clearly more dangerous.",
  3: "Final, fully evolved apex form. Towering, muscular, and intimidating with battle-hardened details, intense piercing eyes, and a powerful dominant pose. A fearsome adult creature at the peak of its strength.",
};

const EVO_IMAGE_PROMPT = (name: string, stage: number) =>
  `A 16-bit SNES-style pixel art monster named "${name}". ${STAGE_DESCRIPTORS[stage]} Front-facing full body on a solid blue (#4a90d9) background. 16-color palette, bold outlines. No text or UI elements.`;

const EVO_STATS_PROMPT = (name: string, stage: number, budget: number) =>
  `You are a game designer. Generate evolved battle stats and an updated backstory for a stage ${stage} monster named "${name}".
Return ONLY a JSON object with these fields:
{ "hp": number, "attack": number, "defense": number, "speed": number, "backstory": string }
Stats should be integers 30-${stage === 2 ? 120 : 140} and feel thematic for an evolved monster. Distribute exactly ${budget} points across hp/attack/defense/speed.
The backstory should be 1-2 sentences describing the monster's evolution, written in a fun retro RPG style.`;

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

    // Generate new image + stats/backstory in parallel
    const [imageResult, statsResult] = await Promise.all([
      openai.images.generate({
        model: "gpt-image-1",
        prompt: EVO_IMAGE_PROMPT(monster.name, toStage),
        n: 1,
        size: "1024x1024",
        quality: "medium",
      }),
      openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: EVO_STATS_PROMPT(monster.name, toStage, config.budget) }],
        response_format: { type: "json_object" },
      }),
    ]);

    // Parse stats + backstory
    const raw = JSON.parse(
      statsResult.choices[0].message.content ?? "{}"
    ) as { hp: number; attack: number; defense: number; speed: number; backstory: string };
    const stats = normalizeStats(raw, config.budget, config.maxStat);
    const backstory = typeof raw.backstory === "string" ? raw.backstory : monster.backstory;

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

    // Update monster in place
    const { data: evolved, error: updateError } = await supabase
      .from("monsters")
      .update({
        hp: stats.hp,
        attack: stats.attack,
        defense: stats.defense,
        speed: stats.speed,
        image_url: publicUrl,
        backstory,
        stage: toStage,
      })
      .eq("id", monster_id)
      .select()
      .single();

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
