# FieldCard

**Capture a job by voice → AI asks two sharp follow-up questions → compile a teachable card.**

A hackathon-scoped demo of the voice-debrief loop: a field technician describes a job they
just finished, an LLM acts as a sharp supervisor and asks the two questions that surface the
teachable knowledge a junior tech would miss, then compiles a reviewed, structured knowledge
card from the answers.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind
- **Deepgram** `nova-3` — speech-to-text
- **Claude Sonnet 4.6** (`@anthropic-ai/sdk`, structured outputs) — debrief questions + card
- **ElevenLabs** — optional text-to-speech ("Hear it")

## Run it

```bash
pnpm install
cp .env.example .env.local   # fill in your keys
pnpm dev                     # http://localhost:3000
```

Only `ANTHROPIC_API_KEY` is strictly required. Without `DEEPGRAM_API_KEY` you type notes
instead of recording; without `ELEVENLABS_API_KEY` questions just show as text.

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
voice ─▶ /api/transcribe (Deepgram) ─▶ job note
job note ─▶ /api/debrief (Sonnet, JSON schema) ─▶ 2 questions ─▶ /api/speak (ElevenLabs)
job note + answers ─▶ /api/card (Sonnet, JSON schema) ─▶ TeachableCard
```

All LLM calls use Sonnet 4.6 with structured outputs (`output_config.format`) so the API
returns schema-valid JSON — no brittle parsing. Swap `DEBRIEF_MODEL` in `src/lib/anthropic.ts`
to `claude-opus-4-8` for maximum reasoning quality.
