# FieldCard

**Capture a job by voice → AI asks two sharp follow-up questions → compile a teachable card.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FEvode-Manirahari%2Ffieldcard&project-name=fieldcard&repository-name=fieldcard&env=ANTHROPIC_API_KEY&envDescription=Claude%20API%20key%20%28required%29.%20Add%20DEEPGRAM_API_KEY%20for%20the%20full%20voice%20loop%3A%20speech-to-text%20%2B%20Aura%20TTS.&envLink=https%3A%2F%2Fgithub.com%2FEvode-Manirahari%2Ffieldcard%2Fblob%2Fmain%2F.env.example)

A hackathon-scoped demo of the voice-debrief loop: a field technician describes a job they
just finished, an LLM acts as a sharp supervisor and asks the two questions that surface the
teachable knowledge a junior tech would miss, then compiles a reviewed, structured knowledge
card from the answers.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind
- **Deepgram** — end-to-end voice: `nova-3` speech-to-text with **keyterm prompting**
  (boosts trade jargon: *capacitor, contactor, microfarads…*) + **Aura** text-to-speech
- **Claude Sonnet 4.6** (`@anthropic-ai/sdk`, structured outputs) — debrief questions + card
- **ElevenLabs** — alternate TTS, behind `TTS_PROVIDER=elevenlabs`

### Sponsor tech

- **Deepgram** — STT (nova-3 + keyterm prompting) *and* TTS (Aura): the whole voice loop runs on Deepgram.
- **Anthropic** — Sonnet 4.6 with structured outputs (`output_config.format`) for schema-valid questions + cards.
- **ElevenLabs** — drop-in TTS alternative (`TTS_PROVIDER=elevenlabs`).
- **Vercel** — one-click deploy (button above).

## Run it

```bash
pnpm install
cp .env.example .env.local   # fill in your keys
pnpm dev                     # http://localhost:3000
```

Only `ANTHROPIC_API_KEY` is strictly required. Without `DEEPGRAM_API_KEY` you type notes
instead of recording; without `ELEVENLABS_API_KEY` questions just show as text.

## Deploy to Vercel

**One click:** use the button at the top. It clones the repo, prompts for `ANTHROPIC_API_KEY`,
and builds. On the *Configure Project* screen, add `DEEPGRAM_API_KEY` for the full voice loop
(speech-to-text **and** Aura TTS). To use ElevenLabs for TTS instead, also add
`TTS_PROVIDER=elevenlabs` + `ELEVENLABS_API_KEY`. The app runs without any voice key (type-only),
so the deploy never blocks on a missing key.

**Or from the CLI:**

```bash
pnpm dlx vercel                            # link + preview deploy
pnpm dlx vercel env add ANTHROPIC_API_KEY  # repeat for DEEPGRAM_API_KEY, ELEVENLABS_API_KEY
pnpm dlx vercel --prod                     # production deploy
```

`vercel.json` pins the Next.js framework; the API routes run as Node serverless functions with
`maxDuration = 30s` so model and transcription calls don't time out. No other build config needed.

## Demo script (~90s)

1. **Capture** — hit Record and describe a real job: *"Replaced a failed run capacitor on a
   4-ton Carrier condenser — compressor was tripping on start, measured the cap at 28µF on a
   45µF rating…"*
2. **Debrief** — "Get debrief questions." Claude asks two specific questions (e.g. *"How did
   you confirm the capacitor was the cause and not the contactor?"*). Hit **🔊 Hear it**.
3. **Answer** — record your answers to both.
4. **Compile** — out comes a structured teachable card: symptom, root cause, fix steps, tools,
   and a safety note.

## How it works

```
voice ─▶ /api/transcribe (Deepgram nova-3 + keyterm) ─▶ job note
job note ─▶ /api/debrief (Sonnet, JSON schema) ─▶ 2 questions ─▶ /api/speak (Deepgram Aura)
job note + answers ─▶ /api/card (Sonnet, JSON schema) ─▶ TeachableCard
```

All LLM calls use Sonnet 4.6 with structured outputs (`output_config.format`) so the API
returns schema-valid JSON — no brittle parsing. Swap `DEBRIEF_MODEL` in `src/lib/anthropic.ts`
to `claude-opus-4-8` for maximum reasoning quality.
