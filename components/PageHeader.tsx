import type { ReactNode } from "react";
import Image from "next/image";

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: Props) {
  const media = [
    "/canvas/stills/cinematic.webp",
    "/canvas/stills/film.webp",
    "/canvas/stills/product.webp",
    "/canvas/stills/talent.webp",
    "/canvas/stills/social.webp",
  ][title.length % 5];
  return (
    <header className="page-header-premium">
      <div className="page-header-copy">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-600">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-navy/65">{description}</p>
        ) : null}
      </div>
      <div className="page-header-visual">
        <figure aria-hidden="true">
          <Image src={media} alt="" width={320} height={180} sizes="(max-width: 700px) 42vw, 220px" unoptimized />
          <span>EF / {eyebrow}</span>
        </figure>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
