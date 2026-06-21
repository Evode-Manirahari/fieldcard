import { getAnthropic, DEBRIEF_MODEL } from "@/lib/anthropic";

// Give the serverless function headroom for the model round-trip.
export const maxDuration = 30;

const QUESTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      description: "Exactly two short follow-up questions, one sentence each.",
      items: { type: "string" },
    },
  },
  required: ["questions"],
} as const;

const SYSTEM = `You are an expert trades supervisor debriefing a field technician right after a job.
You are given a short voice note describing what they did. Ask exactly TWO sharp, specific
follow-up questions that surface the teachable knowledge a junior tech would miss — the root
cause, the judgment call they made, or the safety step. Each question must be a single sentence,
plain-spoken, and answerable in 20 seconds. Do not ask generic questions.`;

export async function POST(req: Request) {
  const client = getAnthropic();
  if (!client) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY not set — add it to .env.local." },
      { status: 501 },
    );
  }

  const { transcript } = (await req.json()) as { transcript?: string };
  if (!transcript?.trim()) {
    return Response.json({ error: "Missing job note." }, { status: 400 });
  }

  const response = await client.messages.create({
    model: DEBRIEF_MODEL,
    max_tokens: 512,
    thinking: { type: "disabled" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: QUESTIONS_SCHEMA },
    },
    system: SYSTEM,
    messages: [{ role: "user", content: `Job note from the tech:\n\n${transcript}` }],
  });

  const block = response.content.find((b) => b.type === "text");
  const questions: string[] =
    block && "text" in block ? JSON.parse(block.text).questions : [];
  return Response.json({ questions });
}
