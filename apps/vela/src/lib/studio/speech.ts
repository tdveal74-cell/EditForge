type Mouth = (open: boolean) => void;

let token = 0;

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function deviceVoices(): SpeechSynthesisVoice[] {
  if (!canSpeak()) return [];
  return window.speechSynthesis.getVoices();
}

export function naturalVoices(): SpeechSynthesisVoice[] {
  return deviceVoices().slice().sort((a, b) => voiceScore(b) - voiceScore(a));
}

function voiceScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  let score = 0;
  if (/neural|natural|enhanced|premium|siri/.test(name)) score += 6;
  if (name.includes("google")) score += 3;
  if (voice.localService) score += 1;
  if (voice.lang.toLowerCase().startsWith("en")) score += 2;
  return score;
}

export function stopSpeak(): void {
  token += 1;
  if (canSpeak()) window.speechSynthesis.cancel();
}

export function speakLine(
  text: string,
  options: { voiceURI: string; rate: number; pitch: number; onMouth: Mouth; onEnd: (error?: string) => void },
): void {
  if (!canSpeak()) {
    options.onEnd("unavailable");
    return;
  }
  const id = ++token;
  const phrases = text
    .split(/(?<=[.!?])\s+/)
    .map((phrase) => phrase.trim())
    .filter(Boolean);
  const parts = phrases.length ? phrases : [text];
  parts.forEach((phrase, index) => {
    const utterance = new SpeechSynthesisUtterance(phrase);
    const fall = index === parts.length - 1 ? 0.97 : 1;
    utterance.rate = options.rate * fall;
    utterance.pitch = options.pitch * (1 + ((index % 3) - 1) * 0.045);
    const voice = deviceVoices().find((item) => item.voiceURI === options.voiceURI);
    if (voice) utterance.voice = voice;
    utterance.onboundary = () => {
      if (id !== token) return;
      options.onMouth(true);
      window.setTimeout(() => {
        if (id === token) options.onMouth(false);
      }, 90);
    };
    utterance.onend = () => {
      if (id !== token || index !== parts.length - 1) return;
      options.onMouth(false);
      options.onEnd();
    };
    utterance.onerror = (event) => {
      if (id !== token) return;
      options.onMouth(false);
      options.onEnd(event.error);
    };
    window.speechSynthesis.speak(utterance);
  });
}
