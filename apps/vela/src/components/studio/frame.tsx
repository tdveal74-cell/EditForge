import type { Enhance, Grade, Motif, SkinArea } from "@/lib/studio/model";

function skinMask(area: SkinArea): string | undefined {
  if (area === "all") return undefined;
  if (area === "eyes") {
    return "radial-gradient(ellipse 16% 9% at 36% 40%, #000 55%, transparent 72%), radial-gradient(ellipse 16% 9% at 64% 40%, #000 55%, transparent 72%)";
  }
  if (area === "mouth") return "radial-gradient(ellipse 22% 11% at 50% 64%, #000 55%, transparent 74%)";
  return "radial-gradient(ellipse 42% 58% at 50% 46%, #000 60%, transparent 76%)";
}

function skinAmounts(enhance: Enhance) {
  const texture = enhance.texture / 100;
  const freckles = enhance.freckles / 100;
  const smooth = enhance.smoothness / 100;
  const detail = enhance.detail / 100;
  if (enhance.pass === "unpolish") return { pores: 0.28 + texture * 0.7, freckles: freckles * 0.9, even: smooth * 0.15, detail: 0.24 + detail * 0.5, shine: 0 };
  if (enhance.pass === "shine") return { pores: texture * 0.3, freckles: freckles * 0.2, even: 0.1 + smooth * 0.3, detail: detail * 0.25, shine: 0.5 };
  if (enhance.pass === "retouch") return { pores: texture * 0.2, freckles: freckles * 0.15, even: 0.42 + smooth * 0.45, detail: detail * 0.2, shine: 0.22 };
  return { pores: 0.2 + texture * 0.65, freckles: 0.12 + freckles * 0.75, even: smooth * 0.3, detail: 0.14 + detail * 0.45, shine: 0.06 };
}

export function Frame({ motif, grade, enhance }: { motif: Motif; grade?: Grade; enhance?: Enhance }) {
  const depth = grade?.depth ?? 0;
  const blur = depth > 0 ? `blur(${(depth / 18).toFixed(2)}px)` : undefined;
  const gradeFilter = grade
    ? `brightness(${(1 + grade.exposure / 140).toFixed(3)}) contrast(${(1 + grade.contrast / 120).toFixed(3)}) saturate(${(1 + grade.saturation / 100).toFixed(3)}) sepia(${Math.max(0, grade.warmth) / 180}) hue-rotate(${(-Math.min(0, grade.warmth) * 0.6).toFixed(2)}deg)`
    : "";
  const skin = enhance ? skinAmounts(enhance) : null;

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-ink"
      style={{ filter: gradeFilter || undefined }}
    >
      <div className="absolute inset-0" style={{ filter: blur }}>
        <Backdrop motif={motif} />
      </div>
      <Subject motif={motif} />
      {skin && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            maskImage: enhance ? skinMask(enhance.area) : undefined,
            WebkitMaskImage: enhance ? skinMask(enhance.area) : undefined,
            maskComposite: "add",
            WebkitMaskComposite: "source-over",
          }}
        >
          {skin.pores > 0.02 && (
            <div
              className="absolute inset-0 mix-blend-overlay"
              style={{
                opacity: skin.pores,
                backgroundImage:
                  "radial-gradient(circle, color-mix(in srgb, var(--color-ink) 70%, var(--color-copper)) 0.4px, transparent 0.9px)",
                backgroundSize: "4px 4px",
              }}
            />
          )}
          {skin.freckles > 0.02 && (
            <div
              className="absolute inset-0"
              style={{
                opacity: skin.freckles,
                backgroundImage:
                  "radial-gradient(circle at 42% 44%, var(--color-copper) 0 1.5px, transparent 2px), radial-gradient(circle at 58% 48%, var(--color-copper) 0 1px, transparent 1.8px), radial-gradient(circle at 48% 56%, var(--color-copper) 0 1.2px, transparent 2px), radial-gradient(circle at 63% 40%, var(--color-copper) 0 0.8px, transparent 1.6px), radial-gradient(circle at 36% 52%, var(--color-copper) 0 1px, transparent 1.7px)",
              }}
            />
          )}
          {skin.detail > 0.02 && (
            <div
              className="absolute inset-0 mix-blend-overlay"
              style={{
                opacity: skin.detail,
                backgroundImage: "repeating-linear-gradient(90deg, transparent 0 2px, color-mix(in srgb, var(--color-paper) 55%, transparent) 2px 3px)",
              }}
            />
          )}
          {skin.even > 0.02 && <div className="absolute inset-0 bg-paper" style={{ opacity: skin.even * 0.28 }} />}
          {skin.shine > 0.02 && (
            <div
              className="absolute inset-0 mix-blend-multiply"
              style={{
                opacity: skin.shine,
                background: "radial-gradient(ellipse 30% 18% at 58% 36%, transparent, rgb(16 17 14) 70%)",
              }}
            />
          )}
        </div>
      )}
      {grade && grade.vignette > 0 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle, transparent 40%, rgb(16 17 14 / ${(grade.vignette / 100).toFixed(2)}) 100%)`,
          }}
        />
      )}
    </div>
  );
}

function Backdrop({ motif }: { motif: Motif }) {
  if (motif === "rain" || motif === "alley") {
    return (
      <div className="absolute inset-0 bg-panel">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "repeating-linear-gradient(108deg, transparent 0 12px, rgb(243 238 228 / 0.28) 12px 13px)",
          }}
        />
      </div>
    );
  }
  if (motif === "lantern") {
    return <div className="absolute inset-0 bg-ink" />;
  }
  if (motif === "steam") {
    return (
      <div className="absolute inset-0 bg-panel">
        <div className="absolute bottom-0 left-1/4 h-2/3 w-1/2 rounded-full bg-paper/30 blur-2xl" />
        <div className="absolute bottom-6 right-1/4 h-1/2 w-1/3 rounded-full bg-copper/30 blur-2xl" />
      </div>
    );
  }
  if (motif === "city") {
    return <div className="absolute inset-0 bg-ink" />;
  }
  if (motif === "wave") {
    return <div className="absolute inset-0 bg-ink" />;
  }
  return <div className="absolute inset-0 bg-panel" />;
}

function Subject({ motif }: { motif: Motif }) {
  if (motif === "rain") {
    return (
      <>
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-raise" />
        <div className="absolute bottom-1/3 left-6 h-1/2 w-3 bg-copper" />
        <div className="absolute bottom-1/3 right-10 h-2/5 w-2 bg-paper/70" />
      </>
    );
  }
  if (motif === "lantern") {
    return (
      <div className="absolute inset-x-3 bottom-4 top-8 flex items-end justify-between">
        {[46, 70, 54, 80, 40].map((height, index) => (
          <span
            key={height + index}
            className="w-5 rounded-full bg-copper sm:w-7"
            style={{ height: `${height}%`, opacity: 0.45 + (index % 3) * 0.18 }}
          />
        ))}
      </div>
    );
  }
  if (motif === "hands") {
    return (
      <>
        <div className="absolute bottom-8 left-8 h-16 w-24 -rotate-12 rounded-full bg-paper/80" />
        <div className="absolute bottom-10 left-24 h-14 w-28 rotate-6 rounded-full bg-paper" />
        <div className="absolute bottom-16 left-20 h-8 w-8 rounded-full bg-copper" />
      </>
    );
  }
  if (motif === "alley") {
    return (
      <>
        <div className="absolute inset-y-0 left-0 w-1/3 origin-bottom -skew-x-6 bg-raise" />
        <div className="absolute inset-y-0 right-0 w-1/3 origin-bottom skew-x-6 bg-raise" />
        <div className="absolute bottom-0 left-1/3 right-1/3 h-1/4 bg-panel" />
        <div className="absolute left-1/2 top-1/3 h-16 w-2 -translate-x-1/2 bg-copper" />
      </>
    );
  }
  if (motif === "steam") {
    return <div className="absolute bottom-8 left-1/2 h-10 w-16 -translate-x-1/2 rounded-md bg-raise" />;
  }
  if (motif === "mic") {
    return (
      <>
        <div className="absolute left-1/2 top-1/4 h-16 w-12 -translate-x-1/2 rounded-full border-4 border-copper" />
        <div className="absolute left-1/2 top-1/2 h-24 w-1 -translate-x-1/2 bg-paper" />
        <div className="absolute left-1/2 top-[70%] h-3 w-16 -translate-x-1/2 rounded-full bg-mute" />
      </>
    );
  }
  if (motif === "wave") {
    const bars = [30, 55, 40, 80, 48, 70, 36, 62, 44, 76];
    return (
      <div className="absolute inset-x-4 bottom-6 top-8 flex items-end gap-1">
        {bars.map((height, index) => (
          <span
            key={`${height}-${index}`}
            className={index % 2 === 0 ? "flex-1 bg-copper" : "flex-1 bg-mute"}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    );
  }
  if (motif === "city") {
    const tops = ["h-1/3", "h-1/2", "h-2/5", "h-3/5", "h-1/4", "h-2/5"];
    return (
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-1 px-2">
        {tops.map((height, index) => (
          <span key={height + index} className={`${height} flex-1 ${index === 3 ? "bg-copper" : "bg-raise"}`} />
        ))}
      </div>
    );
  }
  return (
    <div className="absolute inset-0 grid place-items-center">
      <span className="font-display text-4xl text-paper">V</span>
    </div>
  );
}
