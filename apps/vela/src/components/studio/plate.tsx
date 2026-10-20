import { useEffect, useState } from "react";
import { SkinFinish } from "@/components/studio/frame";
import { Presenter } from "@/components/studio/presenter";
import { audioUrl } from "@/lib/studio/audio-files";
import type { Enhance, Likeness, Look } from "@/lib/studio/model";
import { useJaw } from "@/lib/studio/performance";

export function usePlate(id: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) {
      setUrl(null);
      return;
    }
    let live = true;
    setUrl(null);
    void audioUrl(id).then((next) => {
      if (live) setUrl(next);
    }).catch(() => { if (live) setUrl(null); });
    return () => {
      live = false;
    };
  }, [id]);
  return url;
}

export function Face({
  look,
  mouth,
  label,
  plateUrl,
  enhance,
  likeness,
}: {
  look: Look;
  mouth: boolean;
  label?: string;
  plateUrl: string | null;
  enhance: Enhance;
  likeness: Likeness;
}) {
  if (!plateUrl) return <Presenter look={look} mouth={mouth} label={label} />;
  return <LivingPlate plateUrl={plateUrl} enhance={enhance} likeness={likeness} label={label} />;
}

function LivingPlate({
  plateUrl,
  enhance,
  likeness,
  label,
}: {
  plateUrl: string;
  enhance: Enhance;
  likeness: Likeness;
  label?: string;
}) {
  const jaw = useJaw();
  const [pose, setPose] = useState({ breath: 0.5, blink: 0 });
  useEffect(() => {
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quiet) return;
    let frame = 0;
    let blink = 0;
    const loop = (now: number) => {
      const breath = Math.sin(now / 980) * 0.5 + 0.5;
      if (blink <= 0 && Math.random() < 0.012) blink = 1;
      blink = Math.max(0, blink - 0.08);
      setPose({ breath, blink });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);
  const hold = likeness.identity / 100;
  const yaw = (pose.breath - 0.5) * 1.8;
  const lift = pose.breath * 1.4 + jaw * 5;
  return (
    <div className="relative h-full w-full overflow-hidden bg-ink">
      {label && <p className="absolute top-2 left-2 z-10 text-xs tracking-wide text-copper uppercase">{label}</p>}
      <img
        src={plateUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_18%]"
        style={{
          transform: `translateY(${lift.toFixed(2)}px) rotate(${yaw.toFixed(2)}deg) scale(${(1 + jaw * 0.012).toFixed(3)})`,
          filter: `contrast(${(1.04 + (1 - hold) * 0.12).toFixed(3)}) saturate(${(0.9 + hold * 0.12).toFixed(3)})`,
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%] overflow-hidden">
        <img
          src={plateUrl}
          alt=""
          className="absolute inset-x-0 bottom-0 h-[250%] w-full max-w-none object-cover object-[center_78%]"
          style={{ transform: `translateY(${(jaw * 14).toFixed(2)}px)` }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0" style={{ opacity: 0.25 + (1 - hold) * 0.55 }}>
        <SkinFinish enhance={enhance} />
      </div>
      <span className="pointer-events-none absolute rounded-full bg-paper" style={{ left: "35%", top: "37%", width: "2.2%", height: "2.2%", opacity: likeness.catchlight / 140 }} />
      <span className="pointer-events-none absolute rounded-full bg-paper" style={{ left: "61%", top: "37%", width: "2.2%", height: "2.2%", opacity: likeness.catchlight / 140 }} />
      <span className="pointer-events-none absolute rounded-full border border-paper/80" style={{ left: "33%", top: "35%", width: "7%", height: "5%", opacity: likeness.iris / 160 }} />
      <span className="pointer-events-none absolute rounded-full border border-paper/80" style={{ left: "59%", top: "35%", width: "7%", height: "5%", opacity: likeness.iris / 160 }} />
      <span className="pointer-events-none absolute bg-ink" style={{ left: "31%", top: "34%", width: "12%", height: `${pose.blink * 9}%`, opacity: pose.blink * 0.85, borderRadius: "40%" }} />
      <span className="pointer-events-none absolute bg-ink" style={{ left: "57%", top: "34%", width: "12%", height: `${pose.blink * 9}%`, opacity: pose.blink * 0.85, borderRadius: "40%" }} />
      <span className="pointer-events-none absolute rounded-full bg-ink" style={{ left: "30%", top: "44%", width: "16%", height: "5%", opacity: likeness.underEye / 280, filter: "blur(2px)" }} />
      <span className="pointer-events-none absolute rounded-full bg-ink" style={{ left: "54%", top: "44%", width: "16%", height: "5%", opacity: likeness.underEye / 280, filter: "blur(2px)" }} />
      <span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-copper"
        style={{ top: "61%", width: "16%", height: `${3 + jaw * 5}%`, opacity: likeness.lip / 220 }}
      />
    </div>
  );
}
