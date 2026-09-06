"use client";
import { useEffect, useRef, useState } from "react";

export function VoiceInput({
  onTranscript,
  onError,
  disabled,
}: {
  onTranscript: (s: string) => void;
  onError: (s: string) => void;
  disabled: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const send = useRef(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(
    () => () => {
      send.current = false;
      recorder.current?.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );
  async function start() {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "Recording is unavailable in this browser. Use a current browser over HTTPS, or type your message.",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      stream.current = media;
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
        (t) => MediaRecorder.isTypeSupported(t),
      );
      const rec = new MediaRecorder(
        media,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = rec;
      const chunks: BlobPart[] = [];
      send.current = true;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = async () => {
        media.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        setRecording(false);
        recorder.current = null;
        if (!send.current) return;
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append(
            "audio",
            new Blob(chunks, { type: rec.mimeType }),
            "recording.webm",
          );
          const res = await fetch("/api/canvas/transcribe", {
            method: "POST",
            body: form,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Transcription failed.");
          onTranscript(data.text);
        } catch (e) {
          onError((e as Error).message);
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      setSeconds(0);
      setRecording(true);
      let elapsed = 0;
      timer.current = setInterval(() => {
        elapsed++;
        setSeconds(elapsed);
        if (elapsed >= 60 && rec.state === "recording") rec.stop();
      }, 1000);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      onError(
        (e as Error).name === "NotAllowedError"
          ? "Microphone access was denied. Enable it in browser settings, or type your message."
          : (e as Error).message,
      );
    }
  }
  return (
    <div className="voice-input">
      <button
        type="button"
        className={recording ? "recording" : ""}
        disabled={disabled || transcribing}
        onClick={() => {
          if (recording) recorder.current?.stop();
          else void start();
        }}
      >
        {transcribing
          ? "Transcribing…"
          : recording
            ? `Stop & transcribe · ${seconds}s`
            : "◉ Talk to agent"}
      </button>
      {recording && (
        <button
          type="button"
          onClick={() => {
            send.current = false;
            recorder.current?.stop();
          }}
        >
          Discard recording
        </button>
      )}
      <span>
        {recording
          ? "Microphone on. Stops at 60 seconds."
          : "Recording goes to xAI for transcription. Review the text before sending."}
      </span>
    </div>
  );
}

export function SpeakReply({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );
  function speak() {
    if (!("speechSynthesis" in window)) {
      setError("Spoken replies are unavailable in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    if (speaking) {
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setError("Playback stopped. The full reply is available above.");
    };
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }
  return (
    <div>
      <button
        type="button"
        onClick={speak}
        aria-label={speaking ? "Stop spoken reply" : "Listen to agent reply"}
      >
        {speaking ? "Stop speaking" : "Listen to reply"}
      </button>
      {error && <p role="status">{error}</p>}
    </div>
  );
}
