import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/rubric", label: "Rubric" },
  { href: "/projects", label: "Projects" },
  { href: "/presets", label: "TSWS presets" },
  { href: "/jobs", label: "Jobs" },
];

export function Nav() {
  return (
    <header className="border-b border-border bg-surface-elevated/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-xs font-medium uppercase tracking-[0.2em] text-amber">
          EditForge
        </Link>
        <nav className="flex flex-wrap gap-4">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-navy/70 transition-colors duration-flagship hover:text-navy"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
