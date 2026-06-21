// Give the serverless function headroom for the ElevenLabs round-trip.
export const maxDuration = 30;

// Optional text-to-speech via ElevenLabs, matching the ACT voice stack.
// Returns audio/mpeg the browser can play. Degrades gracefully when no key is set.
export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ELEVENLABS_API_KEY not set — questions will show as text only." },
      { status: 501 },
    );
  }

  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) {
    return Response.json({ error: "Missing text." }, { status: 400 });
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_turbo_v2_5" }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return Response.json({ error: `ElevenLabs error: ${detail}` }, { status: 502 });
  }

  const audio = await res.arrayBuffer();
  return new Response(audio, { headers: { "Content-Type": "audio/mpeg" } });
}
