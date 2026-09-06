/* Full document navigation releases the unchanged Scrollcraft runtime on exit. */
/* eslint-disable @next/next/no-html-link-for-pages */
"use client";
import { usePathname } from "next/navigation";
const departments = [
  {
    name: "Create",
    links: [
      ["Canvas", "/canvas"],
      ["Studio", "/studio"],
      ["Pipeline", "/pipeline"],
      ["Projects", "/projects"],
      ["Timeline", "/timeline"],
    ],
  },
  {
    name: "Media",
    links: [
      ["Voice", "/voice"],
      ["Avatar", "/avatar"],
      ["Generative video", "/gen-video"],
      ["Stock", "/stock"],
      ["Audio", "/audio"],
    ],
  },
  {
    name: "Finish",
    links: [
      ["Grade", "/color"],
      ["Long form", "/longform"],
      ["Review", "/review"],
      ["Rubric", "/rubric"],
      ["Export", "/export"],
    ],
  },
  {
    name: "Systems",
    links: [
      ["NLE bridge", "/nle"],
      ["Render", "/render"],
      ["Hardware", "/hardware"],
      ["Jobs", "/jobs"],
    ],
  },
];
export function Nav() {
  const pathname = usePathname();
  return (
    <header className="forge-nav">
      <a className="forge-brand" href="/" aria-label="EditForge home">
        <span className="brand-mark" aria-hidden="true">
          E<span>F</span>
        </span>
        <span>
          EDITFORGE<small>THE PRODUCTION STUDIO</small>
        </span>
      </a>
      <nav aria-label="Main navigation">
        {[
          ["Canvas", "/canvas"],
          ["Studio", "/studio"],
          ["Dailies", "/dailies"],
        ].map(([label, href]) => (
          <a
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
          >
            {label}
          </a>
        ))}
        <details className="departments-menu">
          <summary>
            Departments <span aria-hidden="true">+</span>
          </summary>
          <div className="department-dropdown">
            {departments.map((d) => (
              <div key={d.name}>
                <p>{d.name}</p>
                {d.links.map(([name, href]) => (
                  <a
                    key={href}
                    href={href}
                    aria-current={pathname === href ? "page" : undefined}
                  >
                    {name}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </details>
      </nav>
      <a className="nav-cta" href="/canvas">
        Enter the studio <span aria-hidden="true">↗</span>
      </a>
    </header>
  );
}
