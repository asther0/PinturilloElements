import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Server-only: OPENAI_API_KEY never leaves this module.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_STROKES = 30;
const MAX_POINTS_PER_STROKE = 500;
const MAX_CANDIDATES = 20;
const MAX_CANDIDATE_LENGTH = 40;

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

const DIFFICULTY_INSTRUCTIONS: Record<Difficulty, string> = {
  easy: "Difficulty is easy: prefer the most obvious match among the candidates.",
  medium: "Difficulty is medium: pick the single most likely word among the candidates.",
  hard: "Difficulty is hard: weigh the subtle drawing clues carefully before picking exactly one word.",
};

export async function POST(request: NextRequest) {
  try {
    const body: {
      strokes?: unknown;
      candidates?: unknown;
      difficulty?: unknown;
    } = await request.json();

    if (!Array.isArray(body.candidates)) {
      return NextResponse.json({ error: "Missing candidates" }, { status: 400 });
    }

    const candidates = (body.candidates as unknown[])
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
      .map((c) => c.slice(0, MAX_CANDIDATE_LENGTH))
      .slice(0, MAX_CANDIDATES);

    if (candidates.length === 0) {
      return NextResponse.json({ error: "Missing candidates" }, { status: 400 });
    }

    let difficulty: Difficulty = "medium";
    if (body.difficulty !== undefined) {
      if (
        typeof body.difficulty !== "string" ||
        !(DIFFICULTIES as readonly string[]).includes(body.difficulty)
      ) {
        return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
      }
      difficulty = body.difficulty as Difficulty;
    }

    const strokes = (Array.isArray(body.strokes) ? body.strokes : [])
      .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === "object")
      .slice(0, MAX_STROKES)
      .map((s) => ({
        points: Array.isArray(s.points)
          ? (s.points as unknown as Array<{ x: number; y: number }>).slice(0, MAX_POINTS_PER_STROKE)
          : [],
        color: typeof s.color === "string" ? s.color : "",
        width: typeof s.width === "number" ? s.width : 0,
        tool:
          typeof s.tool === "string" && (s.tool === "pen" || s.tool === "eraser")
            ? s.tool
            : "pen",
      }));

    const strokePoints = strokes.reduce((sum, s) => sum + s.points.length, 0);
    if (strokePoints === 0) {
      return NextResponse.json({ guess: "" });
    }

    const strokesDesc = strokes
      .map(
        (s, i) =>
          `Stroke ${i + 1}: ${s.tool} with color ${s.color}, width ${s.width}, ${s.points.length} points`
      )
      .join("\n");

    const candidateList = candidates.join(", ");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a drawing-guessing assistant. Given a description of drawing strokes and a list of candidate words, pick the single most likely word being drawn. Respond with ONLY a JSON object: {\"guess\": \"<word>\"}. The guess must be exactly one of the provided candidate words. No other text.",
        },
        {
          role: "user",
          content: `${DIFFICULTY_INSTRUCTIONS[difficulty]}\n\nStrokes:\n${strokesDesc}\n\nCandidates: ${candidateList}\n\nReturn JSON:`,
        },
      ],
      temperature: 0.2,
      max_tokens: 60,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    let parsed: { guess?: unknown } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Invalid model output yields no guess.
    }

    const modelGuess = typeof parsed.guess === "string" ? parsed.guess.trim() : "";
    const match = candidates.find(
      (candidate) => candidate.toLowerCase() === modelGuess.toLowerCase()
    );

    return NextResponse.json({ guess: match || "" });
  } catch (err) {
    // Never log or return the API key
    console.error("Agent guess endpoint error:", err instanceof Error ? err.message : "Unknown");
    return NextResponse.json({ guess: "" }, { status: 500 });
  }
}
