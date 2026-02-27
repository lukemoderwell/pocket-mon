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

    const prompt = `You are a dramatic 16-bit RPG battle narrator. Write a short, exciting battle narration (4-6 sentences) for this monster fight.

Winner: ${winnerName}
Loser: ${loserName}
Total rounds: ${rounds.length}

Key moments:
${rounds
  .slice(0, 6)
  .map((r) => `${r.attacker} hits ${r.defender} for ${r.damage} damage`)
  .join("\n")}

Write in the style of a classic SNES RPG. Be dramatic but concise. Use present tense. No emojis.`;

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
