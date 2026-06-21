import { getAnthropic, DEBRIEF_MODEL } from "@/lib/anthropic";

// Give the serverless function headroom for the model round-trip.
export const maxDuration = 30;

const CARD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "Short, specific card title." },
    trade: { type: "string", description: "e.g. HVAC, Electrical, Plumbing." },
    symptom: { type: "string", description: "What the tech observed on site." },
    rootCause: { type: "string", description: "The underlying cause." },
    fixSteps: {
      type: "array",
      description: "Ordered steps a junior tech would follow.",
      items: { type: "string" },
    },
    tools: { type: "array", items: { type: "string" } },
    safetyNote: { type: "string", description: "The key safety boundary." },
  },
  required: ["title", "trade", "symptom", "rootCause", "fixSteps", "tools", "safetyNote"],
} as const;

const SYSTEM = `You compile reviewed, teachable knowledge cards for field technicians from a job
debrief. Given the original job note plus the tech's answers to follow-up questions, write one
tight card a junior tech could act on. Be concrete and trade-accurate. Never invent facts that
are not supported by the note or answers — if the safety boundary is unclear, say so plainly in
safetyNote rather than guessing.`;

export async function POST(req: Request) {
  const client = getAnthropic();
  if (!client) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY not set — add it to .env.local." },
      { status: 501 },
    );
  }

  const { jobNote, debrief } = (await req.json()) as {
    jobNote?: string;
    debrief?: string;
  };
  if (!jobNote?.trim()) {
    return Response.json({ error: "Missing job note." }, { status: 400 });
  }

  const response = await client.messages.create({
    model: DEBRIEF_MODEL,
    max_tokens: 1200,
    thinking: { type: "disabled" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: CARD_SCHEMA },
    },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Original job note:\n${jobNote}\n\nDebrief Q&A:\n${debrief ?? "(no answers given)"}`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  const card = block && "text" in block ? JSON.parse(block.text) : null;
  return Response.json({ card });
}
