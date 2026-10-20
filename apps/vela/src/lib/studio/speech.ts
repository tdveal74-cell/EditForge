type Mouth = (open: boolean) => void;

let token = 0;

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function deviceVoices(): SpeechSynthesisVoice[] {
  if (!canSpeak()) return [];
  return window.speechSynthesis.getVoices();
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
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options.rate;
  utterance.pitch = options.pitch;
  const voice = deviceVoices().find((item) => item.voiceURI === options.voiceURI);
  if (voice) utterance.voice = voice;
  let pulsed = false;
  utterance.onboundary = () => {
    if (id !== token) return;
    pulsed = true;
    options.onMouth(true);
    window.setTimeout(() => {
      if (id === token) options.onMouth(false);
    }, 110);
  };
  utterance.onend = () => {
    if (id !== token) return;
    options.onMouth(false);
    options.onEnd();
  };
  utterance.onerror = (event) => {
    if (id !== token) return;
    options.onMouth(false);
    options.onEnd(event.error);
  };
  window.speechSynthesis.speak(utterance);
  window.setTimeout(() => {
    if (id !== token || pulsed || !window.speechSynthesis.speaking) return;
    const tick = () => {
      if (id !== token || !window.speechSynthesis.speaking) {
        options.onMouth(false);
        return;
      }
      options.onMouth(true);
      window.setTimeout(() => {
        if (id === token) options.onMouth(false);
        if (id === token && window.speechSynthesis.speaking) window.setTimeout(tick, 80);
      }, 120);
    };
    tick();
  }, 280);
}
