import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { normalizeStats } from '@/lib/normalize-stats';
import { normalizeMoves } from '@/lib/normalize-moves';
import { assignPassive } from '@/lib/passive-abilities';
import type { Move } from '@/lib/types';

const openai = new OpenAI();

const STAGE_CONFIG = {
  1: { budget: 340, maxStat: 100 },
  2: { budget: 430, maxStat: 120 },
  3: { budget: 520, maxStat: 140 },
} as const;

const STAGE_DESCRIPTORS: Record<number, string> = {
  1: 'Baby form growing into a proper creature. Still small but its features are becoming more defined and recognizable. Its signature traits from its hatchling form are taking shape — hints of what it will become. More alert eyes, slightly sturdier build.',
  2: 'Mid-evolution adolescent form. Leaner and more agile than its baby form. Its signature feature from stage 1 has grown more prominent and functional — what was once a small trait is now a defining part of its silhouette. More confident stance, sharper eyes, clearly faster and more capable.',
  3: "Final apex form. The signature feature now dominates the design — it has become the creature's primary signature ability or defining trait. Powerful, commanding presence. The body has matured fully: taller, stronger, battle-ready. The creature's identity IS its evolved feature.",
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
EVOLUTION DESIGN GUIDELINES:
- Keep the SAME color palette. Do NOT change the core colors.
- The creature should fill about ${stage === 2 ? '60%' : '85%'} of the frame (previous form filled ${stage === 2 ? '40%' : '60%'}).
- The evolution should feel driven by the creature's story and biology — let the appearance description guide you.
- The creature should be recognizable as the same species through color and its evolved signature feature.
Front-facing full body on a solid blue (#4a90d9) background. Bold dark outlines, clean pixel shading, simple readable silhouette, large expressive eyes. No text or UI elements.`;

/** Stripped-down fallback prompt without GPT appearance text that may have triggered moderation */
const EVO_IMAGE_FALLBACK_PROMPT = (name: string, stage: number) =>
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
  currentBackstory: string,
) =>
  `You are a creature designer. Generate evolved stats, appearance, Pokedex entry, and ${stage >= 3 ? 'three' : 'two'} upgraded battle moves for a stage ${stage} monster named "${name}".${stage === 1 ? '\nThis creature was HATCHED FROM AN EGG and is growing from a tiny hatchling (stage 0) into a proper baby creature (stage 1). It should still be small and cute but more capable.' : ''}
${currentAppearance ? `Current appearance (stage ${stage - 1}): "${currentAppearance}"` : ''}
${currentBackstory ? `Current backstory: "${currentBackstory}"` : ''}
${bodyType ? `Previous body type: ${bodyType}` : ''}
${currentWeight ? `Current weight: ${currentWeight} kg` : ''}
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

STATS: Integers 30-${stage === 1 ? 100 : stage === 2 ? 120 : 140}. Distribute exactly ${budget} points across hp/attack/defense/sp_attack/speed. Maintain the monster's archetype but amplify its strengths.

BACKSTORY: Write a new Pokedex-style field observation for this evolved form — 1-2 sentences. Think nature documentary narrated by a fascinated researcher. The backstory should BUILD on the previous one and explain WHY the creature evolved the way it did.

Great evolution backstories root fantasy in real biology:
- Slowpoke evolves when a Shellder bites its tail while fishing — inspired by parasitic symbiosis
- Magikarp's relentless struggle upstream transforms it into Gyarados — like salmon that physically transform during spawning runs
- Cubone's grief over its mother hardens into Marowak's fierce independence — mimics how some animals' hormones permanently change after trauma
- Vileplume's flower releases toxic pollen — like the real corpse flower Rafflesia, which is parasitic and smells of decay

Draw from real phenomena to explain the transformation:
- Metamorphosis: caterpillar→butterfly, tadpole→frog, larval sea squirt→sessile adult
- Behavioral shifts: solitary juveniles becoming pack hunters, prey animals becoming apex predators
- Environmental adaptation: deep-sea pressure creating bioluminescence, volcanic heat forging mineral armor
- Symbiotic events: a parasite that becomes beneficial, a hitchhiker organism that fuses permanently
- Hormonal/chemical changes: chromatophore activation, venom glands maturing, electric organ development

Use the current backstory as a springboard — what happened next in this creature's life that caused it to change? The most memorable entries reveal something the reader didn't expect.

APPEARANCE: Describe how the creature looks now. Keep the same color palette and mention the specific colors by name.

Let the backstory drive the visual design. The creature's story should explain its new form — how its behavior, habitat, or biology shaped what it became. Some evolutions are subtle (Ivysaur is just a bigger Bulbasaur with a blooming flower). Others are surprising (Remoraid the fish becomes Octillery the octopus). Most are somewhere in between. Be creative and let the creature's narrative guide you.

${stage === 2 ? `Good stage 2 evolutions: the signature feature develops and becomes functional. The creature is bigger and more capable. Sometimes the evolution is natural growth (Wartortle), sometimes something unexpected happens along the way (Metapod). Let the backstory decide.` : `Good stage 3 evolutions: the creature reaches its final form. Sometimes that's a natural culmination (Venusaur), sometimes it's a complete metamorphosis (Butterfree from Metapod). The most memorable final evolutions feel inevitable once you know the story — but surprising if you don't.`}

1-2 vivid sentences. Focus on what makes this evolved form visually distinct from the previous stage.

APPEARANCE: Describe how the creature has evolved visually. Follow these rules inspired by how real Pokemon evolve (e.g. Treecko → Grovyle → Sceptile):
- SAME exact color palette as the current appearance. Do NOT change or add colors.
- The creature's signature/distinctive feature from stage ${stage - 1} must GROW and become more prominent:
${stage === 1 ? '  - The hatchling traits are becoming more defined. Still tiny and cute but recognizable as a proper creature now.' : stage === 2 ? '  - What was a small decorative trait is now a functional, eye-catching feature. The body is leaner and more agile.' : "  - The feature now DOMINATES the design — it IS the creature's identity and signature ability. The body is fully mature, powerful, and commanding."}
- Same body type and proportions, just ${stage === 1 ? 'slightly bigger and sturdier' : stage === 2 ? 'taller and sleeker' : 'larger, stronger, and more imposing'}.
- 1-2 vivid sentences. Mention the specific colors from the current appearance by name.

MOVES: Evolve the current moves into stronger thematic versions. The move names should reflect the creature's growing power and its signature feature.
${stage === 1 ? '- Moves should feel like a baby creature growing into its abilities — still cute but becoming capable.' : stage === 2 ? '- Moves should feel faster, sharper, more confident — the creature is coming into its own.' : '- Moves should feel devastating, masterful — the creature has fully mastered its abilities.\n- Stage 3 gets a THIRD move! Add a new move with a different effect type from the first two. This represents the creature unlocking a new ability at its apex form.'}
${stage === 2 ? '- Moves should feel stronger and more confident — the creature is growing into its power. Hits land harder, abilities are more controlled.' : '- Moves should feel devastating, overwhelming — the creature has reached full power and mastery.'}
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
      | 'evo_threshold_1'
      | 'evo_threshold_2'
      | 'evo_threshold_3';
    const threshold = monster[thresholdKey];
    if (threshold === null || wins < threshold) {
      return NextResponse.json(
        { error: 'Not enough wins to evolve', wins, threshold },
        { status: 400 },
      );
    }

    const config = STAGE_CONFIG[toStage as 1 | 2 | 3];
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
            monster.backstory ?? '',
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
      moves: {
        name: string;
        effect: string;
        category: string;
        accuracy?: number;
      }[];
    };
    const stats = normalizeStats(raw, config.budget, config.maxStat);
    const backstory =
      typeof raw.backstory === 'string' ? raw.backstory : monster.backstory;
    const appearance = typeof raw.appearance === 'string' ? raw.appearance : '';
    const weight =
      typeof raw.weight === 'number' && raw.weight > 0 ? raw.weight : null;
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
          previousImageFile = new File([imgBlob], 'previous.png', {
            type: 'image/png',
          });
        }
      } catch (fetchErr) {
        console.warn(
          'Could not fetch previous sprite for reference:',
          fetchErr,
        );
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
      const err = imgErr as {
        code?: string;
        status?: number;
        error?: unknown;
        message?: string;
      };
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
