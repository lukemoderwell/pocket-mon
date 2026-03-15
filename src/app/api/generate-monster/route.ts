import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { normalizeStats } from '@/lib/normalize-stats';
import { normalizeMoves } from '@/lib/normalize-moves';
import { assignPassive } from '@/lib/passive-abilities';

const openai = new OpenAI();

const IMAGE_PROMPT = (name: string, appearance: string, canEvolve: boolean) =>
  `A 16-bit SNES-style pixel art creature named "${name}". ${appearance}. Design principles: simple readable silhouette with ONE distinctive feature, large expressive eyes, 2-3 main colors in a cohesive palette, appealing proportions. ${canEvolve ? 'This is a BABY stage 1 creature — it should look small, young, and cute with a compact body. The creature should fill about 40% of the frame, leaving room for growth.' : 'This is a fully-formed creature that does not evolve — it should look mature, capable, and battle-ready from the start. Not baby-like. Fill about 65% of the frame with a confident, powerful presence.'} Front-facing full body on a solid blue (#4a90d9) background. Bold dark outlines, clean pixel shading. No text or UI elements.`;

// ~20% of monsters are non-evolving (like Tauros, Heracross, Absol)
const NON_EVOLVING_CHANCE = 0.2;
const EVOLVING_BUDGET = 340;
const NON_EVOLVING_BUDGET = 430;

const STATS_PROMPT = (name: string, canEvolve: boolean, budget: number) =>
  `You are a creature designer for a monster battling game. Generate stats, appearance, a Pokedex entry, and ${canEvolve ? 'two' : 'three'} battle moves for ${canEvolve ? 'a stage 1 baby' : 'a fully-formed non-evolving'} monster named "${name}".
Return ONLY a JSON object with these fields:
{
  "hp": number, "attack": number, "defense": number, "sp_attack": number, "speed": number,
  "backstory": string,
  "appearance": string,
  "body_type": "bipedal" | "quadruped" | "serpentine" | "avian" | "insectoid" | "amorphous" | "floating" | "aquatic",
  "weight": number,
  "moves": [${canEvolve ? '{ move1 }, { move2 }' : '{ move1 }, { move2 }, { move3 }'}]
}
Each move: { "name": string, "effect": "strike" | "guard" | "rush" | "drain" | "stun", "category": "physical" | "special", "accuracy": number }

STATS: Integers 30-${canEvolve ? 100 : 140}. Distribute exactly ${budget} points across hp/attack/defense/sp_attack/speed. Create a distinct archetype — don't make all stats similar. A physical bruiser should have high attack but low sp_attack. A mystic creature should have high sp_attack but low attack. Tanks have high hp+defense but low speed, etc.${!canEvolve ? ' Non-evolving monsters are generally stronger and more balanced since they must compete without evolution.' : ''}

BACKSTORY: Write a Pokedex-style field observation — 1-2 sentences about the creature's biology, behavior, or habitat. NOT an origin story. Think nature documentary, not fantasy novel.
Examples of the tone:
- "For some time after its birth, it uses the nutrients that are packed into the seed on its back in order to grow."
- "The flame on its tail shows the strength of its life-force. If it is weak, the flame also burns weakly."
- "It digs deep burrows to live in. When in danger, it rolls up its body to withstand attacks."

BODY_TYPE: Choose the body plan that best fits the creature from: "bipedal", "quadruped", "serpentine", "avian", "insectoid", "amorphous", "floating", "aquatic". This determines how the creature moves and fights.

WEIGHT: A number in kg representing the creature's weight. ${canEvolve ? 'Baby stage 1 creatures are small and light (2-25 kg typically).' : 'Non-evolving creatures vary widely (5-150 kg) depending on their build.'} Match the weight to the body type and stat archetype — tanks are heavier, fast creatures are lighter.

APPEARANCE: A vivid 1-2 sentence visual description for a pixel artist. Focus on: one distinctive body feature, specific colors, personality expressed through posture/expression. Aim for a design that reads clearly as a small silhouette.
IMPORTANT — vary the body type! Not every creature should be round or turtle-like. Choose from diverse body plans: bipedal humanoid, serpentine, avian, insectoid, quadruped, amorphous blob, floating/levitating, tall and lanky, stocky and squat, etc. The body type should match the creature's stat archetype (fast creatures are sleek, tanks are sturdy, etc.).
${canEvolve ? 'This is a BABY stage 1 creature — it should look small, young, and compact. It will grow BIGGER and more imposing when it evolves.' : 'This creature does NOT evolve — it should look fully mature, capable, and battle-ready from the start. Think Tauros, Heracross, or Absol: strong, independent creatures that are complete as-is. NOT baby-like or cute — this is a fully realized design.'}

MOVES: Each move has a name (creative, thematic), an effect type, a category, and an accuracy value. ${canEvolve ? 'The two moves' : 'All three moves'} MUST have DIFFERENT effect types.
Effect types — pick ${canEvolve ? 'TWO' : 'THREE'} different ones from this list:
- "strike": Reliable damage. Accuracy 0.85-1.0. Melee strikes (punches, bites, slashes) should be 1.0. Ranged strikes (shooting water, hurling rocks, fire breath) should be lower (0.85-0.95) since projectiles can miss.
- "guard": Defensive — reduces incoming damage next turn. Always accuracy 1.0.
- "rush": Heavy hit but leaves user exposed. Accuracy 0.6-0.8. Wild, reckless attacks are less accurate (0.6-0.65). Focused charges can be higher (0.75-0.8).
- "drain": Vampiric — deals damage AND heals the attacker. Accuracy 0.8-0.95. Contact drain (biting, leeching) should be higher. Ranged drain (psychic siphon) can be lower.
- "stun": Chance to skip opponent's next turn. Accuracy 0.7-0.9. Direct contact stuns (headbutt, electric touch) should be higher. Ranged stuns (hypnosis, psychic wave) can be lower.
All five effects are equally valid. Do NOT default to strike — match the effect to the creature's personality. A leech-like creature should have drain. A hypnotic creature should have stun. A turtle should have guard.
Accuracy: A number between 0.0 and 1.0. Melee/contact moves are more accurate than ranged/projectile moves. The accuracy should reflect HOW the creature attacks — a claw swipe is precise, a water blast is not.
Category: "physical" (uses Attack stat) or "special" (uses Sp. Attack stat). Match category to the monster's archetype.
IMPORTANT: At least one of the ${canEvolve ? 'two' : 'three'} moves MUST be "special" category if the creature has any magical, elemental, psychic, or energy-based traits. Creatures with high sp_attack MUST have at least one special move. Only pure brute-force fighters should have two physical moves.`;

export async function POST(req: Request) {
  try {
    const { name } = await req.json();

    if (!name || typeof name !== 'string' || name.length > 30) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    // Check if monster already exists (upsert behavior)
    const { data: existing } = await supabase
      .from('monsters')
      .select('*')
      .eq('name', name.trim())
      .maybeSingle();

    if (existing) {
      // Backfill evolution thresholds for pre-migration monsters
      if (
        existing.evo_threshold_2 == null ||
        existing.evo_threshold_3 == null
      ) {
        const evo_threshold_2 =
          existing.evo_threshold_2 ?? Math.floor(Math.random() * 6) + 5;
        const evo_threshold_3 =
          existing.evo_threshold_3 ?? Math.floor(Math.random() * 16) + 15;
        const { data: updated } = await supabase
          .from('monsters')
          .update({ evo_threshold_2, evo_threshold_3 })
          .eq('id', existing.id)
          .select()
          .single();
        return NextResponse.json({
          monster: updated ?? { ...existing, evo_threshold_2, evo_threshold_3 },
        });
      }
      return NextResponse.json({ monster: existing });
    }

    // Determine if this monster can evolve (~80%) or is non-evolving (~20%)
    const canEvolve = Math.random() >= NON_EVOLVING_CHANCE;
    const statBudget = canEvolve ? EVOLVING_BUDGET : NON_EVOLVING_BUDGET;
    const maxStat = canEvolve ? 100 : 140;

    // Step 1: Generate stats, appearance, backstory, and moves
    const statsResult = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'user', content: STATS_PROMPT(name, canEvolve, statBudget) },
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
      body_type?: string;
      weight?: number;
      moves: {
        name: string;
        effect: string;
        category: string;
        accuracy?: number;
      }[];
    };
    const stats = normalizeStats(raw, statBudget, maxStat);
    const backstory = typeof raw.backstory === 'string' ? raw.backstory : '';
    const appearance = typeof raw.appearance === 'string' ? raw.appearance : '';
    const bodyType = typeof raw.body_type === 'string' ? raw.body_type : null;
    const weight =
      typeof raw.weight === 'number' && raw.weight > 0 ? raw.weight : null;
    // Non-evolving monsters get stage 3 move normalization for 3 moves
    const moves = normalizeMoves(raw.moves, canEvolve ? 1 : 3);
    const passive = assignPassive(stats);

    // Step 2: Generate image using the AI-written appearance
    // Try full prompt first; if moderation blocks it, retry with a minimal prompt
    let imageResult;
    try {
      imageResult = await openai.images.generate({
        model: 'gpt-image-1',
        prompt: IMAGE_PROMPT(
          name,
          appearance ||
            (canEvolve
              ? `A small, cute baby creature with fantastical monster traits`
              : `A mature, battle-ready creature with fantastical monster traits`),
          canEvolve,
        ),
        n: 1,
        size: '1024x1024',
        quality: 'medium',
      });
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
        prompt: IMAGE_PROMPT(
          name,
          appearance ||
            (canEvolve
              ? 'A small, cute baby creature with fantastical monster traits'
              : 'A mature, battle-ready creature with fantastical monster traits'),
          canEvolve,
        ),
      });
      if (err.code === 'moderation_blocked') {
        console.warn('Retrying with simplified prompt');
        imageResult = await openai.images.generate({
          model: 'gpt-image-1',
          prompt: `A 16-bit SNES-style pixel art creature named "${name}". ${canEvolve ? 'A small, cute baby creature' : 'A mature, battle-ready creature'} with fantastical monster traits. Front-facing full body on a solid blue (#4a90d9) background. Bold dark outlines, clean pixel shading, simple readable silhouette, large expressive eyes. No text or UI elements.`,
          n: 1,
          size: '1024x1024',
          quality: 'medium',
        });
      } else {
        throw imgErr;
      }
    }

    // Assign gender randomly
    const gender = Math.random() < 0.5 ? 'male' : 'female';

    // Generate random evolution thresholds
    const evo_threshold_2 = Math.floor(Math.random() * 6) + 5; // 5-10
    const evo_threshold_3 = Math.floor(Math.random() * 16) + 15; // 15-30

    // Upload image to Supabase Storage
    const imageB64 = imageResult.data?.[0]?.b64_json;
    if (!imageB64) {
      return NextResponse.json(
        { error: 'Image generation failed' },
        { status: 500 },
      );
    }

    const imageBuffer = Buffer.from(imageB64, 'base64');
    const fileName = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from('monsters')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Image upload failed' },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('monsters').getPublicUrl(fileName);

    // Insert monster into database
    const { data: monster, error: insertError } = await supabase
      .from('monsters')
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
        stage: 1,
        body_type: bodyType,
        weight,
        evo_threshold_2,
        evo_threshold_3,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to save monster' },
        { status: 500 },
      );
    }

    return NextResponse.json({ monster });
  } catch (error) {
    console.error('Generate monster error:', error);
    return NextResponse.json(
      { error: 'Monster generation failed' },
      { status: 500 },
    );
  }
}
