/**
 * Browser dictation via the Web Speech API (free, replaceable). Falls back
 * to typing when unsupported; errors are surfaced to the caller.
 */
type RecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

function ctor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function dictationSupported(): boolean {
  return typeof window !== "undefined" && ctor() !== null;
}

export interface Dictation {
  stop: () => void;
}

export function startDictation(handlers: { onText: (finalText: string, interim: string) => void; onError: (message: string) => void; onEnd: () => void }, lang = "en-US"): Dictation | null {
  const C = ctor();
  if (!C) return null;
  const rec = new C();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;
  let finalText = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]!;
      const t = r[0]?.transcript ?? "";
      if (r.isFinal) finalText += (finalText ? " " : "") + t.trim();
      else interim += t;
    }
    handlers.onText(finalText, interim);
  };
  rec.onerror = (e) => handlers.onError(e.error === "not-allowed" ? "Microphone access was denied." : `Dictation error: ${e.error}`);
  rec.onend = () => handlers.onEnd();
  try {
    rec.start();
  } catch (err) {
    handlers.onError(err instanceof Error ? err.message : "Could not start dictation");
    return null;
  }
  return { stop: () => rec.stop() };
}
