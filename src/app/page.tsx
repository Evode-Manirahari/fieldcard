"use client";

import { useEffect, useRef, useState } from "react";
import type { TeachableCard } from "@/lib/types";

/** Pre-written jobs so the demo never depends on improvising or a live mic. */
const SAMPLE_JOBS: { label: string; note: string; answer: string }[] = [
  {
    label: "Weak capacitor",
    note: "Carrier 4-ton condenser — compressor was humming but not starting and tripping the breaker after a few seconds. Checked the run capacitor: rated 45 microfarads, measured 22. Swapped it and the unit started clean.",
    answer:
      "I knew it was the capacitor and not the contactor because the contactor was pulling in fine and I had line voltage on both sides. A weak cap reads low on the meter and you see the compressor try to start and stall. Safety: I discharged the capacitor with an insulated screwdriver before touching the terminals — they hold a charge even with the power off.",
  },
  {
    label: "Frozen coil",
    note: "No-cooling call. Indoor coil was a solid block of ice. Let it thaw, checked the filter — completely clogged. Airflow was choked so the coil dropped below freezing. Replaced the filter and confirmed the refrigerant charge was fine.",
    answer:
      "The tell that it was airflow and not low refrigerant was that the whole coil iced evenly and the filter was black. Low charge usually ices up starting at the metering device first. I told the customer to change the filter every 90 days. Safety: I shut the system off and let it thaw fully before restarting so I didn't slug the compressor with liquid.",
  },
  {
    label: "No heat",
    note: "Gas furnace, no-heat call. Inducer ran but no ignition. Found the flame sensor coated in white residue. Cleaned it with steel wool, furnace lit and stayed lit.",
    answer:
      "A dirty flame sensor lets the furnace light then drop out after a few seconds because it can't prove flame — that's the giveaway versus a bad igniter, where it never lights at all. I cleaned it lightly with steel wool, not sandpaper, so I didn't gouge the rod. Safety: I shut off the gas and killed power at the switch before pulling the sensor.",
  },
];

const SAVED_KEY = "fieldcard.saved.v1";

/** Minimal MediaRecorder wrapper. stop() resolves with the recorded Blob. */
function useRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.start();
    recorderRef.current = mr;
    setRecording(true);
  }

  function stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const mr = recorderRef.current;
      if (!mr) return resolve(new Blob());
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        mr.stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        resolve(blob);
      };
      mr.stop();
    });
  }

  return { recording, start, stop };
}

async function transcribe(blob: Blob): Promise<string> {
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": blob.type || "audio/webm" },
    body: blob,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Transcription failed.");
  return data.transcript as string;
}

/** A textarea you can either type into or fill by recording your voice. */
function VoiceField({
  value,
  onChange,
  placeholder,
  onError,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onError: (msg: string) => void;
  disabled?: boolean;
}) {
  const { recording, start, stop } = useRecorder();
  const [transcribing, setTranscribing] = useState(false);

  async function toggle() {
    try {
      if (!recording) {
        await start();
        return;
      }
      const blob = await stop();
      setTranscribing(true);
      const text = await transcribe(blob);
      onChange(value ? `${value} ${text}`.trim() : text);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Recording failed.");
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="min-h-28 w-full resize-y rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 outline-none focus:border-orange-500"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || transcribing}
        className={`self-start rounded-full px-4 py-1.5 text-sm font-medium transition ${
          recording
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-zinc-900 text-white hover:bg-zinc-700"
        } disabled:opacity-50`}
      >
        {transcribing ? "Transcribing…" : recording ? "■ Stop recording" : "● Record"}
      </button>
    </div>
  );
}

export default function Home() {
  const [jobNote, setJobNote] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [sampleAnswer, setSampleAnswer] = useState("");
  const [card, setCard] = useState<TeachableCard | null>(null);
  const [saved, setSaved] = useState<TeachableCard[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the saved-card library from this browser.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {
      // ignore malformed storage
    }
  }, []);

  function persist(next: TeachableCard[]) {
    setSaved(next);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      // ignore quota / private-mode errors
    }
  }

  function loadSample(s: (typeof SAMPLE_JOBS)[number]) {
    setError(null);
    setQuestions([]);
    setAnswer("");
    setCard(null);
    setJobNote(s.note);
    setSampleAnswer(s.answer);
  }

  async function getDebrief() {
    setError(null);
    setBusy("debrief");
    try {
      const res = await fetch("/api/debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: jobNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Debrief failed.");
      setQuestions(data.questions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Debrief failed.");
    } finally {
      setBusy(null);
    }
  }

  async function hearQuestions() {
    setError(null);
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: questions.join(". ") }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Speech failed.");
      }
      const buf = await res.arrayBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
      await new Audio(url).play();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speech failed.");
    }
  }

  async function compileCard() {
    setError(null);
    setBusy("card");
    try {
      const debrief = questions
        .map((q, i) => `Q${i + 1}: ${q}`)
        .join("\n")
        .concat(`\n\nTech's answers:\n${answer}`);
      const res = await fetch("/api/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobNote, debrief }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Card compile failed.");
      setCard(data.card);
      if (data.card) persist([data.card, ...saved]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Card compile failed.");
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setJobNote("");
    setQuestions([]);
    setAnswer("");
    setSampleAnswer("");
    setCard(null);
    setError(null);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Field<span className="text-orange-600">Card</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Capture a job by voice → AI asks two sharp questions → compile a teachable card.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      {/* Step 1 — capture the job */}
      <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          1 · Capture the job
        </h2>
        <p className="mb-3 text-sm text-zinc-600">
          Describe what you just did, like you would to a coworker in the truck.
        </p>
        <VoiceField
          value={jobNote}
          onChange={setJobNote}
          onError={setError}
          placeholder="e.g. Replaced a failed run capacitor on a 4-ton Carrier condenser; compressor was tripping on start…"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400">Try a sample:</span>
          {SAMPLE_JOBS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => loadSample(s)}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-700 transition hover:border-orange-500 hover:text-orange-600"
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={getDebrief}
          disabled={!jobNote.trim() || busy !== null}
          className="mt-4 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
        >
          {busy === "debrief" ? "Thinking…" : "Get debrief questions"}
        </button>
      </section>

      {/* Step 2 — answer the debrief */}
      {questions.length > 0 && (
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              2 · Answer the debrief
            </h2>
            <button
              type="button"
              onClick={hearQuestions}
              className="text-xs font-medium text-orange-600 hover:underline"
            >
              🔊 Hear it
            </button>
          </div>
          <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-zinc-800">
            {questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
          <VoiceField
            value={answer}
            onChange={setAnswer}
            onError={setError}
            placeholder="Answer both questions out loud…"
          />
          {sampleAnswer && answer !== sampleAnswer && (
            <button
              type="button"
              onClick={() => setAnswer(sampleAnswer)}
              className="mt-2 text-xs text-zinc-500 hover:text-orange-600 hover:underline"
            >
              ↳ fill the sample answer
            </button>
          )}
          <div>
            <button
              type="button"
              onClick={compileCard}
              disabled={!answer.trim() || busy !== null}
              className="mt-4 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
            >
              {busy === "card" ? "Compiling…" : "Compile teachable card"}
            </button>
          </div>
        </section>
      )}

      {/* Result — the card */}
      {card && <CardView card={card} />}

      {(jobNote || card) && (
        <button
          type="button"
          onClick={reset}
          className="text-sm text-zinc-500 hover:text-zinc-800 hover:underline"
        >
          ↺ Start over
        </button>
      )}

      {/* Saved library — cards accumulate into a knowledge base */}
      {saved.length > 0 && (
        <section className="mt-10 border-t border-zinc-200 pt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Knowledge base · {saved.length} card{saved.length === 1 ? "" : "s"}
            </h2>
            <button
              type="button"
              onClick={() => persist([])}
              className="text-xs text-zinc-400 hover:text-red-600 hover:underline"
            >
              Clear
            </button>
          </div>
          <ul className="space-y-1.5">
            {saved.map((c, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setCard(c)}
                  className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm transition hover:border-orange-400"
                >
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                    {c.trade}
                  </span>
                  <span className="truncate text-zinc-800">{c.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function CardView({ card }: { card: TeachableCard }) {
  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm">
      <div className="border-b border-zinc-200 bg-zinc-900 px-5 py-4">
        <span className="rounded-full bg-orange-600 px-2 py-0.5 text-xs font-semibold text-white">
          {card.trade}
        </span>
        <h2 className="mt-2 text-lg font-bold text-white">{card.title}</h2>
      </div>
      <dl className="space-y-4 p-5 text-sm">
        <Field label="Symptom" value={card.symptom} />
        <Field label="Root cause" value={card.rootCause} />
        <div>
          <dt className="font-semibold text-zinc-500">Fix steps</dt>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-zinc-800">
            {card.fixSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
        {card.tools.length > 0 && (
          <div>
            <dt className="font-semibold text-zinc-500">Tools</dt>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {card.tools.map((t, i) => (
                <span
                  key={i}
                  className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <dt className="font-semibold text-red-700">⚠ Safety</dt>
          <dd className="mt-0.5 text-red-900">{card.safetyNote}</dd>
        </div>
      </dl>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-zinc-800">{value}</dd>
    </div>
  );
}
