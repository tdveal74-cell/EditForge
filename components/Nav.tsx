import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/projects", label: "Projects" },
  { href: "/timeline", label: "Timeline" },
  { href: "/color", label: "Grade" },
  { href: "/captions", label: "Captions" },
  { href: "/rubric", label: "Rubric" },
  { href: "/export", label: "Export" },
  { href: "/presets", label: "Presets" },
  { href: "/jobs", label: "Jobs" },
];

export function Nav() {
  return (
    <header className="border-b border-border bg-surface-elevated/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="text-xs font-medium uppercase tracking-[0.2em] text-amber">EditForge</Link>
        <nav className="flex flex-wrap gap-x-3 gap-y-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-xs text-navy/70 transition-colors duration-flagship hover:text-navy sm:text-sm">{l.label}</Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
