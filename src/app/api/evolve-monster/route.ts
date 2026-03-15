import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { normalizeStats } from '@/lib/normalize-stats';
import { normalizeMoves } from '@/lib/normalize-moves';
import { assignPassive } from '@/lib/passive-abilities';
import type { Move } from '@/lib/types';

const openai = new OpenAI();

const STAGE_CONFIG = {
  2: { budget: 430, maxStat: 120 },
  3: { budget: 520, maxStat: 140 },
} as const;

const STAGE_DESCRIPTORS: Record<number, string> = {
  2: 'Mid-evolution form. The creature has undergone a dramatic transformation — it has gained a surprising new body feature (new limbs, wings, horns, tail, armor plates, extra eyes, etc.) that was NOT present before. Its signature feature from stage 1 has grown and changed purpose. The body proportions have shifted noticeably. More aggressive or confident presence.',
  3: "Final apex form. A radical transformation — the creature is barely recognizable compared to stage 1. Massive new features dominate the design (huge wings, full armor, multiple limbs, dramatic crests, etc.). The signature feature has become the creature's entire identity. Powerful, imposing, awe-inspiring. Think the dramatic leap from Dragonair to Dragonite or Magikarp to Gyarados.",
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
EVOLUTION DESIGN RULES — think dramatic Pokemon evolutions like Magikarp→Gyarados, Charmeleon→Charizard, Dragonair→Dragonite, Poliwhirl→Poliwrath:
- Keep the SAME color palette. Do NOT change the core colors.
- The creature should fill about ${stage === 2 ? '60%' : '85%'} of the frame (previous form filled ${stage === 2 ? '40%' : '60%'}).
- MOST IMPORTANT: Add ${stage === 2 ? 'ONE surprising new feature' : 'TWO or more dramatic new features'} that did NOT exist in the previous form. Examples of new features to add:
  * New limbs or wings (a quadruped might stand upright, a snake might sprout legs)
  * Horns, crests, antlers, or crown-like growths
  * Armor plates, spikes, or a shell
  * A dramatically different tail (longer, split, bladed, flaming)
  * Extra eyes, fangs, or a completely new face shape
  * Floating elements, auras, or energy emanating from the body
- The signature feature from stage ${stage - 1} should TRANSFORM, not just get bigger — it should change purpose or form.
- Body proportions should shift dramatically — ${stage === 2 ? 'stance can change (e.g. drop to all fours, or rear up on hind legs), body can elongate or bulk up' : 'the creature should look like an apex predator, barely recognizable from its baby form'}.
- The creature must still be RECOGNIZABLE through its colors and evolved signature feature, but should feel like a dramatic transformation, not a minor size increase.
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
  bodyType: string | null,
  currentWeight: number | null,
) =>
  `You are a creature designer. Generate evolved stats, appearance, Pokedex entry, and ${stage >= 3 ? 'three' : 'two'} upgraded battle moves for a stage ${stage} monster named "${name}".
${currentAppearance ? `Current appearance (stage ${stage - 1}): "${currentAppearance}"` : ''}
${bodyType ? `Previous body type: ${bodyType} (this CAN change through evolution — a quadruped might become bipedal, a serpentine creature might gain wings, etc.)` : ''}
${currentWeight ? `Current weight: ${currentWeight} kg (the evolved form should be noticeably heavier)` : ''}
${currentMoves.length > 0 ? `Current moves: ${currentMoves.map((m) => `${m.name} (${m.effect}, ${(m as Move & { category?: string }).category || 'physical'})`).join(', ')}.` : ''}
Return ONLY a JSON object with these fields:
{
  "hp": number, "attack": number, "defense": number, "sp_attack": number, "speed": number,
  "backstory": string,
  "appearance": string,
  "weight": number,
  "moves": [${stage >= 3 ? '{ move1 }, { move2 }, { move3 — a NEW third move with a DIFFERENT effect type }' : '{ move1 }, { move2 }'}]
}
Each move: { "name": string, "effect": "strike" | "guard" | "rush" | "drain" | "stun", "category": "physical" | "special", "accuracy": number }

WEIGHT: The evolved form's weight in kg. ${stage === 2 ? 'Stage 2 creatures are typically 1.5-3x heavier than their baby form as they grow.' : 'Stage 3 creatures are typically 2-4x heavier than stage 2, reflecting full maturity.'} ${currentWeight ? `The previous form weighed ${currentWeight} kg.` : ''}

STATS: Integers 30-${stage === 2 ? 120 : 140}. Distribute exactly ${budget} points across hp/attack/defense/sp_attack/speed. Maintain the monster's archetype but amplify its strengths.

BACKSTORY: Write a Pokedex-style field observation about the evolved form — 1-2 sentences about new abilities, changed behavior, or ecological role. NOT an origin story. Think nature documentary. The backstory should reflect how the creature's signature feature has developed.

APPEARANCE: Describe a DRAMATIC visual transformation. Think about how real Pokemon evolve with surprising changes — Charmeleon sprouting wings to become Charizard, Poliwhirl becoming a muscular fighter as Poliwrath, Slowpoke gaining a Shellder on its tail.

RULES:
- SAME color palette as the current appearance. Mention the specific colors by name.
- The signature feature from stage ${stage - 1} should TRANSFORM — not just grow bigger, but change purpose or form entirely.
${stage === 2 ? `- Add ONE surprising new body feature that was NOT present before: wings, horns, a tail blade, armor plates, an extra pair of arms, a crest, etc. Pick something unexpected but thematically fitting.
- The body proportions should shift noticeably — the creature can change stance (quadruped→bipedal or vice versa), elongate, bulk up dramatically, or change shape.
- Think Charmeleon vs Charmander: not just bigger, but a completely different vibe and silhouette.` : `- Add TWO or more dramatic new features not present before. The creature should be barely recognizable from its stage 1 form.
- The body should be radically different — massive, imposing, with a completely transformed silhouette.
- Think Gyarados vs Magikarp, Dragonite vs Dragonair: a jaw-dropping transformation that surprises.`}
- 1-2 vivid sentences describing the evolved form's most striking new features.

MOVES: Evolve the current moves into stronger thematic versions. The move names should reflect the creature's growing power and its signature feature.
${stage === 2 ? '- Moves should feel stronger and more confident — the creature is growing into its power. Hits land harder, abilities are more controlled.' : '- Moves should feel devastating, overwhelming — the creature has reached full power and mastery.\n- Stage 3 gets a THIRD move! Add a new move with a different effect type from the first two. This represents the creature unlocking its ultimate ability at apex form.'}
Keep the same effect types as the current moves for the first two. All moves MUST have DIFFERENT effect types.
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
            monster.body_type ?? null,
            monster.weight ?? null,
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
      weight?: number;
      moves: { name: string; effect: string; category: string; accuracy?: number }[];
    };
    const stats = normalizeStats(raw, config.budget, config.maxStat);
    const backstory =
      typeof raw.backstory === 'string' ? raw.backstory : monster.backstory;
    const appearance = typeof raw.appearance === 'string' ? raw.appearance : '';
    const weight = typeof raw.weight === 'number' && raw.weight > 0 ? raw.weight : null;
    const moves = normalizeMoves(raw.moves, toStage);
    const passive = assignPassive(stats);

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

    // Step 2: Generate evolved image
    // Try images.edit with previous sprite as reference for visual consistency.
    // Falls back to images.generate if the reference approach fails.
    let imageResult;
    const evoPrompt = EVO_IMAGE_PROMPT(
      monster.name,
      toStage,
      appearance,
      monster.appearance ?? '',
    );

    // Attempt to fetch previous sprite as a reference image
    let previousImageFile: File | null = null;
    if (monster.image_url) {
      try {
        const imgResponse = await fetch(monster.image_url);
        if (imgResponse.ok) {
          const imgBlob = await imgResponse.blob();
          previousImageFile = new File([imgBlob], 'previous.png', { type: 'image/png' });
        }
      } catch (fetchErr) {
        console.warn('Could not fetch previous sprite for reference:', fetchErr);
      }
    }

    try {
      if (previousImageFile) {
        // Use images.edit with previous sprite as visual reference
        imageResult = await openai.images.edit({
          model: 'gpt-image-1',
          image: previousImageFile,
          prompt: evoPrompt,
          n: 1,
          size: '1024x1024',
        });
      } else {
        imageResult = await openai.images.generate({
          model: 'gpt-image-1',
          prompt: evoPrompt,
          n: 1,
          size: '1024x1024',
          quality: 'medium',
        });
      }
    } catch (imgErr: unknown) {
      const err = imgErr as { code?: string; status?: number; error?: unknown; message?: string };
      console.error('Image generation failed:', {
        code: err.code,
        status: err.status,
        message: err.message,
        error: err.error,
      });
      if (err.code === 'moderation_blocked') {
        console.warn('Retrying with simplified prompt');
        imageResult = await openai.images.generate({
          model: 'gpt-image-1',
          prompt: `A 16-bit SNES-style pixel art creature named "${monster.name}". Stage ${toStage} evolved form. Front-facing full body on a solid blue (#4a90d9) background. Bold dark outlines, clean pixel shading, simple readable silhouette, large expressive eyes. No text or UI elements.`,
          n: 1,
          size: '1024x1024',
          quality: 'medium',
        });
      } else if (previousImageFile) {
        // If edit with reference failed for non-moderation reason, retry without reference
        console.warn('Retrying without image reference');
        imageResult = await openai.images.generate({
          model: 'gpt-image-1',
          prompt: evoPrompt,
          n: 1,
          size: '1024x1024',
          quality: 'medium',
        });
      } else {
        throw imgErr;
      }
    }

    // Upload new image
    const imageB64 = imageResult.data?.[0]?.b64_json;
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
      passive: monster.passive ?? null,
      weight: monster.weight ?? null,
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
      passive,
      stage: toStage,
      weight,
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
