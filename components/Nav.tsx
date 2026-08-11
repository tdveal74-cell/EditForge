import Link from "next/link";

const links = [
  { href: "/studio", label: "Studio" },
  { href: "/voice", label: "Voice" },
  { href: "/avatar", label: "Avatar" },
  { href: "/gen-video", label: "Gen video" },
  { href: "/stock", label: "Stock" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/projects", label: "Projects" },
  { href: "/timeline", label: "Timeline" },
  { href: "/color", label: "Grade" },
  { href: "/rubric", label: "Rubric" },
  { href: "/export", label: "Export" },
  { href: "/nle", label: "NLE" },
  { href: "/render", label: "Render" },
];

export function Nav() {
  return (
    <header className="border-b border-border bg-surface-elevated/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
        <Link href="/" className="text-xs font-medium uppercase tracking-[0.2em] text-amber">EditForge</Link>
        <nav className="flex flex-wrap gap-x-3 gap-y-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-xs text-navy/70 transition-colors duration-flagship hover:text-navy">{l.label}</Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
