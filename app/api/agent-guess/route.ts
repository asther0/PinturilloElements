import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { strokes, candidates } = body as {
      strokes?: Array<{
        points: Array<{ x: number; y: number }>;
        color: string;
        width: number;
        tool: "pen" | "eraser";
      }>;
      candidates?: string[];
    };

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ error: "Missing candidates" }, { status: 400 });
    }

    const strokesDesc = (strokes || [])
      .map((s, i) => `Stroke ${i + 1}: ${s.tool} with color ${s.color}, width ${s.width}, ${s.points.length} points`)
      .join("\n");

    const candidateList = candidates.join(", ");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a drawing-guessing assistant. Given a description of drawing strokes and a list of candidate words, pick the single most likely word being drawn. Respond with ONLY a JSON object: {\"guess\": \"<word>\"}. No other text.",
        },
        {
          role: "user",
          content: `Strokes:\n${strokesDesc}\n\nCandidates: ${candidateList}\n\nReturn JSON:`,
        },
      ],
      temperature: 0.2,
      max_tokens: 60,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    let parsed: { guess?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // If JSON parse fails, fallback to empty
    }

    const guess = parsed.guess || candidates[0];

    return NextResponse.json({ guess });
  } catch (err) {
    // Never log or return the API key
    console.error("Agent guess endpoint error:", err instanceof Error ? err.message : "Unknown");
    return NextResponse.json({ guess: "" }, { status: 500 });
  }
}
