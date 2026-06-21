import type { NextRequest } from "next/server";

// Give the serverless function headroom for the Deepgram round-trip.
export const maxDuration = 30;

// Keyterm prompting (nova-3) — boosts recognition of the trade jargon that
// generic speech-to-text mangles. Each term is sent as its own `keyterm` param.
const TRADE_KEYTERMS = [
  "capacitor",
  "run capacitor",
  "start capacitor",
  "contactor",
  "compressor",
  "condenser",
  "evaporator coil",
  "microfarads",
  "refrigerant",
  "TXV",
  "superheat",
  "subcooling",
  "amperage",
  "voltage drop",
  "breaker",
  "thermostat",
  "blower motor",
];

// Speech-to-text via Deepgram (nova-3) with keyterm prompting.
// The client POSTs the raw audio blob as the request body.
export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "DEEPGRAM_API_KEY not set — type your note instead, or add the key to .env.local.",
      },
      { status: 501 },
    );
  }

  const contentType = req.headers.get("content-type") ?? "audio/webm";
  const audio = await req.arrayBuffer();
  if (audio.byteLength === 0) {
    return Response.json({ error: "Empty audio." }, { status: 400 });
  }

  const params = new URLSearchParams({
    model: "nova-3",
    smart_format: "true",
    punctuate: "true",
  });
  for (const term of TRADE_KEYTERMS) params.append("keyterm", term);

  const dgRes = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
    method: "POST",
    headers: { Authorization: `Token ${apiKey}`, "Content-Type": contentType },
    body: audio,
  });

  if (!dgRes.ok) {
    const detail = await dgRes.text();
    return Response.json({ error: `Deepgram error: ${detail}` }, { status: 502 });
  }

  const data = await dgRes.json();
  const transcript: string =
    data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  return Response.json({ transcript });
}
