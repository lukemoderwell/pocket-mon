import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { BattleRound } from "@/lib/battle-engine";

const openai = new OpenAI();

export async function POST(req: Request) {
  try {
    const { rounds, winnerName, loserName } = (await req.json()) as {
      rounds: BattleRound[];
      winnerName: string;
      loserName: string;
    };

    const keyMoments = rounds.slice(0, 8).map((r) => {
      if (r.wasStunned) return `${r.attacker} is stunned and can't move!`;
      let line = `${r.attacker} uses ${r.moveName || "an attack"} (${r.moveCategory || "physical"} ${r.moveEffect || "strike"}) on ${r.defender} for ${r.damage} damage`;
      if (r.healAmount > 0) line += `, draining ${r.healAmount} HP`;
      if (r.stunned) line += ` — ${r.defender} is stunned!`;
      if (r.moveEffect === "guard") line += ` and raises defense`;
      if (r.moveEffect === "rush") line += ` but is left exposed`;
      return line;
    });

    const prompt = `You are a dramatic 16-bit RPG battle narrator. Write a short, exciting battle narration (4-6 sentences) for this monster fight.

Winner: ${winnerName}
Loser: ${loserName}
Total rounds: ${rounds.length}

Key moments:
${keyMoments.join("\n")}

Write in the style of a classic SNES RPG. Be dramatic but concise. Use present tense. Reference specific moves, tactical moments (guards, exposures, drains, stuns), and momentum shifts. No emojis.`;

    const result = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
    });

    const narration = result.choices[0].message.content ?? "A fierce battle ensued!";

    return NextResponse.json({ narration });
  } catch (error) {
    console.error("Narration error:", error);
    return NextResponse.json({
      narration: "An epic battle took place! The stronger monster prevailed!",
    });
  }
}
