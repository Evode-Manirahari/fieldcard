// Give the serverless function headroom for the TTS round-trip.
export const maxDuration = 30;

// Text-to-speech for the debrief questions. Provider is switchable via TTS_PROVIDER:
//   "deepgram" (default) → Deepgram Aura    |    "elevenlabs" → ElevenLabs
// Returns audio/mpeg the browser can play; degrades gracefully when no key is set.
export async function POST(req: Request) {
  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) {
    return Response.json({ error: "Missing text." }, { status: 400 });
  }

  const provider = (process.env.TTS_PROVIDER || "deepgram").toLowerCase();
  return provider === "elevenlabs" ? speakElevenLabs(text) : speakDeepgram(text);
}

// Deepgram Aura — keeps the voice loop end-to-end Deepgram.
async function speakDeepgram(text: string): Promise<Response> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "DEEPGRAM_API_KEY not set — questions will show as text only." },
      { status: 501 },
    );
  }
  const model = process.env.DEEPGRAM_TTS_MODEL || "aura-2-thalia-en";
  const res = await fetch(
    `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}`,
    {
      method: "POST",
      headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    },
  );
  if (!res.ok) {
    const detail = await res.text();
    return Response.json({ error: `Deepgram Aura error: ${detail}` }, { status: 502 });
  }
  const audio = await res.arrayBuffer();
  return new Response(audio, { headers: { "Content-Type": "audio/mpeg" } });
}

// ElevenLabs — set TTS_PROVIDER=elevenlabs to use this instead.
async function speakElevenLabs(text: string): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ELEVENLABS_API_KEY not set — set TTS_PROVIDER=deepgram or add the key." },
      { status: 501 },
    );
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
