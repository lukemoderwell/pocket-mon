import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { normalizeStats } from '@/lib/normalize-stats';
import { normalizeMoves } from '@/lib/normalize-moves';
import type { Move } from '@/lib/types';

const openai = new OpenAI();

const STAGE_CONFIG = {
  2: { budget: 430, maxStat: 120 },
  3: { budget: 520, maxStat: 140 },
} as const;

const STAGE_DESCRIPTORS: Record<number, string> = {
  2: 'Mid-evolution adolescent form. Leaner and more agile than its baby form. Its signature feature from stage 1 has grown more prominent and functional — what was once a small trait is now a defining part of its silhouette. More confident stance, sharper eyes, clearly faster and more capable.',
  3: "Final apex form. The signature feature now dominates the design — it has become the creature's primary weapon or defining trait. Powerful, commanding presence. The body has matured fully: taller, stronger, battle-ready. The creature's identity IS its evolved feature.",
};

const EVO_IMAGE_PROMPT = (
  name: string,
  stage: number,
  appearance: string,
  previousAppearance: string,
) =>
  `A 16-bit SNES-style pixel art monster named "${name}".
Previous form (stage ${stage - 1}): "${previousAppearance}"
Evolved form (stage ${stage}): ${appearance || STAGE_DESCRIPTORS[stage]}
EVOLUTION DESIGN RULES (like Treecko → Grovyle → Sceptile):
- SAME color palette as the previous form. Do NOT change colors.
- The signature feature from stage ${stage - 1} must GROW and become more prominent — ${stage === 2 ? 'what was a small hint becomes a functional trait' : "the trait now dominates the design and IS the creature's identity/weapon"}.
- Same body type, ${stage === 2 ? 'leaner and more agile' : 'taller, stronger, and more powerful'}.
- This must look like the SAME creature grown up, not a different creature.
Front-facing full body on a solid blue (#4a90d9) background. Bold dark outlines, clean pixel shading, simple readable silhouette, large expressive eyes. No text or UI elements.`;

/** Stripped-down fallback prompt without GPT appearance text that may have triggered moderation */
const EVO_IMAGE_FALLBACK_PROMPT = (
  name: string,
  stage: number,
) =>
  `A 16-bit SNES-style pixel art monster named "${name}". This is the stage ${stage} evolved form. ${STAGE_DESCRIPTORS[stage]}
Front-facing full body on a solid blue (#4a90d9) background. Bold dark outlines, clean pixel shading, simple readable silhouette, large expressive eyes. No text or UI elements.`;

const EVO_STATS_PROMPT = (
  name: string,
  stage: number,
  budget: number,
  currentMoves: Move[],
  currentAppearance: string,
) =>
  `You are a creature designer. Generate evolved stats, appearance, Pokedex entry, and two upgraded battle moves for a stage ${stage} monster named "${name}".
${currentAppearance ? `Current appearance (stage ${stage - 1}): "${currentAppearance}"` : ''}
${currentMoves.length > 0 ? `Current moves: ${currentMoves.map((m) => `${m.name} (${m.effect}, ${(m as Move & { category?: string }).category || 'physical'})`).join(', ')}.` : ''}
Return ONLY a JSON object with these fields:
{
  "hp": number, "attack": number, "defense": number, "sp_attack": number, "speed": number,
  "backstory": string,
  "appearance": string,
  "moves": [{ "name": string, "effect": "strike" | "guard" | "rush" | "drain" | "stun", "category": "physical" | "special", "accuracy": number }, { "name": string, "effect": "strike" | "guard" | "rush" | "drain" | "stun", "category": "physical" | "special", "accuracy": number }]
}

STATS: Integers 30-${stage === 2 ? 120 : 140}. Distribute exactly ${budget} points across hp/attack/defense/sp_attack/speed. Maintain the monster's archetype but amplify its strengths.

BACKSTORY: Write a Pokedex-style field observation about the evolved form — 1-2 sentences about new abilities, changed behavior, or ecological role. NOT an origin story. Think nature documentary. The backstory should reflect how the creature's signature feature has developed.

APPEARANCE: Describe how the creature has evolved visually. Follow these rules inspired by how real Pokemon evolve (e.g. Treecko → Grovyle → Sceptile):
- SAME exact color palette as the current appearance. Do NOT change or add colors.
- The creature's signature/distinctive feature from stage ${stage - 1} must GROW and become more prominent:
${stage === 2 ? '  - What was a small decorative trait is now a functional, eye-catching feature. The body is leaner and more agile.' : "  - The feature now DOMINATES the design — it IS the creature's identity and primary weapon/tool. The body is fully mature, powerful, and commanding."}
- Same body type and proportions, just ${stage === 2 ? 'taller and sleeker' : 'larger, stronger, and more imposing'}.
- 1-2 vivid sentences. Mention the specific colors from the current appearance by name.

MOVES: Evolve the current moves into stronger thematic versions. The move names should reflect the creature's growing power and its signature feature.
${stage === 2 ? '- Moves should feel faster, sharper, more confident — the creature is coming into its own.' : '- Moves should feel devastating, masterful — the creature has fully mastered its abilities.'}
Keep the same effect types as the current moves. The two moves MUST have DIFFERENT effect types.
Effect types:
- "strike": Reliable damage. Accuracy 0.85-1.0. Melee contact moves should be 1.0, ranged projectile moves (blasts, beams, thrown objects) should be lower.
- "guard": Defensive, reduces incoming damage. Always accuracy 1.0.
- "rush": Heavy hit but leaves user exposed. Accuracy 0.6-0.8. Wild charges are less accurate, focused strikes can be higher.
- "drain": Vampiric — deals damage AND heals the attacker. Accuracy 0.8-0.95. Contact drain is more accurate than ranged drain.
- "stun": Chance to skip opponent's next turn. Accuracy 0.7-0.9. Direct stuns are more accurate than ranged/psychic stuns.
Accuracy: A number reflecting how the creature attacks. Melee/contact = more accurate, ranged/projectile = less accurate.
Category: "physical" or "special". If the creature has high sp_attack or uses magical/elemental/psychic abilities, at least one move SHOULD be "special". Creatures that are pure brute fighters can keep both physical.`;

export async function POST(req: Request) {
  try {
    const { monster_id } = await req.json();

    if (!monster_id || typeof monster_id !== 'string') {
      return NextResponse.json(
        { error: 'Invalid monster_id' },
        { status: 400 },
      );
    }

    // Fetch current monster
    const { data: monster, error: fetchError } = await supabase
      .from('monsters')
      .select('*')
      .eq('id', monster_id)
      .single();

    if (fetchError || !monster) {
      return NextResponse.json({ error: 'Monster not found' }, { status: 404 });
    }

    if (monster.stage >= 3) {
      return NextResponse.json(
        { error: 'Already at max stage' },
        { status: 400 },
      );
    }

    // Count wins for this monster
    const { count: winCount } = await supabase
      .from('battles')
      .select('*', { count: 'exact', head: true })
      .eq('winner_id', monster_id);

    const wins = winCount ?? 0;
    const fromStage = monster.stage as number;
    const toStage = fromStage + 1;

    // Check threshold
    const thresholdKey = `evo_threshold_${toStage}` as
      | 'evo_threshold_2'
      | 'evo_threshold_3';
    const threshold = monster[thresholdKey];
    if (threshold === null || wins < threshold) {
      return NextResponse.json(
        { error: 'Not enough wins to evolve', wins, threshold },
        { status: 400 },
      );
    }

    const config = STAGE_CONFIG[toStage as 2 | 3];
    const currentMoves: Move[] = Array.isArray(monster.moves)
      ? monster.moves
      : [];

    // Step 1: Generate stats, appearance, backstory, and evolved moves
    const statsResult = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'user',
          content: EVO_STATS_PROMPT(
            monster.name,
            toStage,
            config.budget,
            currentMoves,
            monster.appearance ?? '',
          ),
        },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = JSON.parse(statsResult.choices[0].message.content ?? '{}') as {
      hp: number;
      attack: number;
      defense: number;
      sp_attack: number;
      speed: number;
      backstory: string;
      appearance: string;
      moves: { name: string; effect: string; category: string; accuracy?: number }[];
    };
    const stats = normalizeStats(raw, config.budget, config.maxStat);
    const backstory =
      typeof raw.backstory === 'string' ? raw.backstory : monster.backstory;
    const appearance = typeof raw.appearance === 'string' ? raw.appearance : '';
    const moves = normalizeMoves(raw.moves, toStage);

    console.log('Evolution stats debug:', {
      monsterName: monster.name,
      fromStage,
      toStage,
      rawFromGPT: {
        hp: raw.hp,
        attack: raw.attack,
        defense: raw.defense,
        sp_attack: raw.sp_attack,
        speed: raw.speed,
      },
      normalized: stats,
      existing: {
        hp: monster.hp,
        attack: monster.attack,
        defense: monster.defense,
        sp_attack: monster.sp_attack,
        speed: monster.speed,
      },
    });

    // Step 2: Generate image using the evolved appearance
    let imageB64: string | undefined;
    try {
      const imageResult = await openai.images.generate({
        model: 'gpt-image-1',
        prompt: EVO_IMAGE_PROMPT(
          monster.name,
          toStage,
          appearance,
          monster.appearance ?? '',
        ),
        n: 1,
        size: '1024x1024',
        quality: 'medium',
      });
      imageB64 = imageResult.data?.[0]?.b64_json;
    } catch (imgError: unknown) {
      // If moderation blocked the detailed prompt, retry with a generic fallback
      const code = imgError instanceof Object && 'code' in imgError ? (imgError as { code: string }).code : '';
      if (code === 'moderation_blocked') {
        console.warn('Image moderation blocked, retrying with fallback prompt');
        const fallbackResult = await openai.images.generate({
          model: 'gpt-image-1',
          prompt: EVO_IMAGE_FALLBACK_PROMPT(monster.name, toStage),
          n: 1,
          size: '1024x1024',
          quality: 'medium',
        });
        imageB64 = fallbackResult.data?.[0]?.b64_json;
      } else {
        throw imgError;
      }
    }
    if (!imageB64) {
      return NextResponse.json(
        { error: 'Evolution image generation failed' },
        { status: 500 },
      );
    }

    const imageBuffer = Buffer.from(imageB64, 'base64');
    const fileName = `${monster.name.toLowerCase().replace(/\s+/g, '-')}-stage${toStage}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from('monsters')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Evolution image upload failed' },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('monsters').getPublicUrl(fileName);

    // Save current stage as a snapshot in evolution_history
    const existingHistory: unknown[] = Array.isArray(monster.evolution_history)
      ? monster.evolution_history
      : [];
    const snapshot = {
      stage: fromStage,
      hp: monster.hp,
      attack: monster.attack,
      defense: monster.defense,
      sp_attack: monster.sp_attack ?? 50,
      speed: monster.speed,
      image_url: monster.image_url,
      backstory: monster.backstory,
      appearance: monster.appearance ?? '',
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
      .from('monsters')
      .update({
        ...updatePayload,
        evolution_history: [...existingHistory, snapshot],
      })
      .eq('id', monster_id)
      .select()
      .single());

    if (updateError?.code === 'PGRST204') {
      // Column doesn't exist yet - update without it
      ({ data: evolved, error: updateError } = await supabase
        .from('monsters')
        .update(updatePayload)
        .eq('id', monster_id)
        .select()
        .single());
    }

    if (updateError || !evolved) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to save evolution' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      monster: evolved,
      fromStage,
      toStage,
    });
  } catch (error) {
    console.error('Evolve monster error:', error);
    return NextResponse.json({ error: 'Evolution failed' }, { status: 500 });
  }
}
