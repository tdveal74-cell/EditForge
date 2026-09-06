/* The unchanged Scrollcraft engine has no teardown API; document navigation
   releases its observers. Its stylesheet is loaded only on this landing page. */
/* eslint-disable @next/next/no-location-assign-relative-destination, @next/next/no-css-tags */
"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Script from "next/script";

type SCWindow = Window & {
  ScrollCraft?: { mount: (root: HTMLElement) => unknown; instances: unknown[] };
};
const takes = [
  {
    id: "a",
    name: "The arrival",
    note: "Two figures. One held frame.",
    duration: 6.041667,
  },
  {
    id: "b",
    name: "The encounter",
    note: "Watch the space between them.",
    duration: 6.041667,
  },
];
function MotionPortrait() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const stopped = useRef(false);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting &&
          !reduce.matches &&
          !connection?.saveData &&
          !stopped.current
        ) {
          video.src ||= "/films/tsws-a.mp4";
          video
            .play()
            .then(() => {
              setPlaying(true);
              setAvailable(true);
            })
            .catch(() => setPlaying(false));
        } else {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, []);
  async function toggle() {
    const v = ref.current;
    if (!v) return;
    if (playing) {
      v.pause();
      stopped.current = true;
      setPlaying(false);
    } else {
      v.src ||= "/films/tsws-a.mp4";
      stopped.current = false;
      try {
        await v.play();
        setPlaying(true);
        setAvailable(true);
      } catch {
        setAvailable(false);
      }
    }
  }
  return (
    <figure className="hero-motion" data-sc-parallax="-0.08">
      <div className="motion-frame">
        <video
          ref={ref}
          muted
          loop
          playsInline
          preload="none"
          poster="/films/tsws-a.webp"
          aria-label="TSWS studio example: Auren and Vespera in the labyrinth"
        />
        <button
          onClick={() => void toggle()}
          aria-label={playing ? "Pause studio motion" : "Play studio motion"}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
        <span className="motion-label">
          {playing ? "MOTION STUDY" : available ? "PAUSED" : "PLAY MOTION"}
        </span>
      </div>
      <figcaption>TSWS / studio example</figcaption>
    </figure>
  );
}
function ConformDesk() {
  const [take, setTake] = useState(0);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const t = takes[take];
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          v.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(v);
    return () => {
      observer.disconnect();
      v.pause();
    };
  }, []);
  function choose(i: number) {
    video.current?.pause();
    setPlaying(false);
    setTake(i);
    setPosition(0);
    setLoaded(false);
    setError("");
  }
  async function play() {
    const v = video.current;
    if (!v) return;
    if (playing) {
      v.pause();
      setPlaying(false);
      return;
    }
    if (!loaded) {
      v.src = `/films/tsws-${t.id}.mp4`;
      setLoaded(true);
    }
    try {
      await v.play();
      setPlaying(true);
    } catch {
      setError("Playback needs another tap, or open the original clip below.");
    }
  }
  function seek(value: number) {
    const v = video.current;
    setPosition(value);
    if (!v) return;
    if (!loaded) {
      v.src = `/films/tsws-${t.id}.mp4`;
      v.onloadedmetadata = () => {
        v.currentTime = value;
      };
      setLoaded(true);
    } else if (v.readyState >= 1) v.currentTime = value;
  }
  return (
    <section
      className="conform-act"
      id="conform"
      data-sc-act="pin"
      data-sc-span="1.35"
    >
      <div className="sc-stage conform-stage">
        <div className="conform-copy">
          <p className="forge-eyebrow">02 / THE CONFORM DESK</p>
          <h2>
            A feeling is made
            <br />
            one frame
            <br />
            <em>at a time.</em>
          </h2>
          <p>
            Stay close to the work. Audition the take, find the pause, and leave
            room for the moment to land.
          </p>
          <a className="forge-link" href="/canvas?workflow=micro-drama">
            Make a micro drama <span>↗</span>
          </a>
        </div>
        <div
          className="conform-console"
          data-sc-verify-state={`take:${t.id},time:${position.toFixed(1)}`}
        >
          <div className="console-top">
            <span>TSWS / WORKING FOOTAGE</span>
            <span>STUDIO EXAMPLE</span>
          </div>
          <div className="conform-picture">
            <video
              key={t.id}
              ref={video}
              controls={false}
              playsInline
              muted
              poster={`/films/tsws-${t.id}.webp`}
              preload="none"
              onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
              onEnded={() => setPlaying(false)}
              onError={() =>
                setError(
                  "This browser could not play the clip. Open the original below.",
                )
              }
              aria-label={`${t.name}: TSWS studio example`}
            />
            <div className="picture-margin">
              <span>
                THE SPACE
                <br />
                BETWEEN
                <br />
                THE WORDS
              </span>
              <span>
                FRAME STUDY
                <br />
                PORTRAIT / 9:16
              </span>
            </div>
          </div>
          <div className="console-controls">
            <button
              aria-label={
                playing ? "Pause selected take" : "Play selected take"
              }
              onClick={() => void play()}
            >
              {playing ? "Ⅱ Pause" : "▶ Play take"}
            </button>
            <span className="timecode">
              00:{String(Math.floor(position)).padStart(2, "0")}:
              {String(Math.floor((position % 1) * 24)).padStart(2, "0")}{" "}
              <span>/ {t.duration.toFixed(2)}s</span>
            </span>
          </div>
          <label className="scrubber">
            <span className="sr-only">Scrub selected take</span>
            <input
              type="range"
              min="0"
              max={t.duration - 0.05}
              step=".04"
              value={position}
              onChange={(e) => seek(Number(e.target.value))}
            />
          </label>
          <div className="take-picker" aria-label="Choose a studio take">
            {takes.map((item, i) => (
              <button
                key={item.id}
                aria-pressed={take === i}
                onClick={() => choose(i)}
              >
                <span>
                  0{i + 1} / {item.name}
                </span>
                <small>{item.note}</small>
              </button>
            ))}
          </div>
          {error && (
            <p className="home-error" role="alert">
              {error} <a href={`/films/tsws-${t.id}.mp4`}>Open original ↗</a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
export function FlagshipHome() {
  const root = useRef<HTMLElement>(null);
  const mounted = useRef(false);
  const [brief, setBrief] = useState("");
  const [workflow, setWorkflow] = useState("micro-drama");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  function mount() {
    if (root.current && !mounted.current && (window as SCWindow).ScrollCraft) {
      mounted.current = true;
      (window as SCWindow).ScrollCraft!.mount(root.current);
    }
  }
  async function begin(e: React.FormEvent) {
    e.preventDefault();
    setStarting(true);
    setError("");
    try {
      const { newProject } = await import("@/modules/canvas/model");
      const p = newProject(workflow, brief);
      const res = await fetch("/api/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", project: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the brief.");
      window.location.assign(
        `/canvas?project=${encodeURIComponent(data.project.id)}`,
      );
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
  }
  return (
    <main className="flagship-home" ref={root} id="editforge-dossier">
      <link rel="stylesheet" href="/scrollcraft/scrollcraft.css" />
      <Script
        src="/scrollcraft/scrollcraft.js"
        strategy="afterInteractive"
        onReady={mount}
      />
      <section className="forge-hero" data-sc-act="flow">
        <div className="hero-structure" aria-hidden="true">
          <span>EF / STUDIO</span>
          <div />
        </div>
        <div className="hero-copy">
          <p className="forge-eyebrow">
            <span className="little-cross">+</span> AN INDEPENDENT PRODUCTION
            UNIVERSE
          </p>
          <h1>
            Good stories.
            <br />
            Extraordinary
            <br />
            <span>execution.</span>
          </h1>
          <div className="hero-intro">
            <p>
              Your ideas deserve a studio.
              <br />
              Meet the place where the brief becomes the film.
            </p>
            <a className="forge-button" href="/canvas">
              Open Canvas <span aria-hidden="true">↗</span>
            </a>
            <a className="hero-secondary" href="#conform">
              Explore the work
            </a>
          </div>
        </div>
        <div className="hero-art">
          <figure className="hero-still" data-sc-parallax="0.055">
            <div className="still-topline">
              <span>01 / THE OPENING FRAME</span>
              <span>16:9</span>
            </div>
            <Image
              src="/canvas/stills/film.webp"
              alt="Two silhouettes share a quiet rooftop at dusk under a single warm lamp"
              width={1792}
              height={1008}
              unoptimized
              priority
            />
            <figcaption>
              <span>LET THE MOMENT BREATHE.</span>
              <span>Reference study / Film</span>
            </figcaption>
          </figure>
          <MotionPortrait />
        </div>
        <div className="hero-bottom">
          <span>CONCEPT → CANVAS → CUT → DELIVERY</span>
          <p>Craft at every stage.</p>
          <span>EDITFORGE / EST. FOR THE WORK</span>
        </div>
      </section>
      <section className="method-strip" data-sc-act="flow">
        <p className="forge-eyebrow">01 / A CLEAR LINE THROUGH PRODUCTION</p>
        <div>
          <h2>
            One creative thread.
            <br />
            <em>All the way through.</em>
          </h2>
          <p>
            The idea, its references, the voice, the motion, the finished cut.
            Canvas brings the pieces together, with the Floor Agent beside you
            and the whole studio within reach.
          </p>
        </div>
        <ol data-sc-stagger="80">
          <li data-sc-in>
            <span>01</span>
            <strong>Direct</strong>
            <p>
              Bring the brief.
              <br />
              Build the graph.
            </p>
          </li>
          <li data-sc-in>
            <span>02</span>
            <strong>Create</strong>
            <p>
              Render the still.
              <br />
              Give it a voice.
            </p>
          </li>
          <li data-sc-in>
            <span>03</span>
            <strong>Refine</strong>
            <p>
              Watch the take.
              <br />
              Find the feeling.
            </p>
          </li>
          <li data-sc-in>
            <span>04</span>
            <strong>Deliver</strong>
            <p>
              Review with intent.
              <br />
              Ship with confidence.
            </p>
          </li>
        </ol>
      </section>
      <ConformDesk />
      <section className="department-section" data-sc-act="flow">
        <div className="department-heading">
          <p className="forge-eyebrow">03 / THE HOUSE OF ROOMS</p>
          <h2>
            Big ambition.
            <br />
            <em>Room to make it.</em>
          </h2>
          <p>
            A dedicated space for each part of the production. One connected
            place for the work.
          </p>
        </div>
        <div className="department-index">
          <a href="/canvas" className="featured-department">
            <div>
              <span className="forge-eyebrow">01 / CANVAS</span>
              <h3>Ideas, connected.</h3>
              <p>
                A visual workflow for film, micro dramas, products, talent and
                social. Talk to the Floor Agent, upload your material, and
                direct the next take.
              </p>
              <span className="department-enter">Enter Canvas ↗</span>
            </div>
            <Image
              src="/canvas/stills/cinematic.webp"
              alt="A cinematic reference of a woman walking through a rain-soaked city at night"
              width={640}
              height={420}
              unoptimized
              loading="lazy"
            />
          </a>
          <a href="/voice" className="department-row">
            <span>02</span>
            <h3>Voice & performance</h3>
            <p>Give the words their weight.</p>
            <span>↗</span>
          </a>
          <a href="/dailies" className="department-row">
            <span>03</span>
            <h3>Dailies & review</h3>
            <p>Find the take worth keeping.</p>
            <span>↗</span>
          </a>
          <a href="/color" className="department-row">
            <span>04</span>
            <h3>Color & finishing</h3>
            <p>A look that serves the story.</p>
            <span>↗</span>
          </a>
          <a href="/export" className="department-row">
            <span>05</span>
            <h3>Master & delivery</h3>
            <p>Earn the final frame.</p>
            <span>↗</span>
          </a>
        </div>
      </section>
      <section className="closing-brief" data-sc-act="flow">
        <div>
          <p className="forge-eyebrow">04 / YOUR NEXT PRODUCTION</p>
          <h2>
            What are
            <br />
            we <em>making?</em>
          </h2>
          <p>
            A scene. A series. Something only you could imagine.
            <br />
            Start with the idea. We’ll meet you on the floor.
          </p>
        </div>
        <form onSubmit={begin}>
          <label htmlFor="production-brief">THE BRIEF</label>
          <textarea
            id="production-brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="A rooftop. Two strangers. One letter neither of them should open…"
            rows={4}
            required
            maxLength={6000}
          />
          <label htmlFor="workflow-choice">THE WORKFLOW</label>
          <select
            id="workflow-choice"
            value={workflow}
            onChange={(e) => setWorkflow(e.target.value)}
          >
            <option value="micro-drama">Micro Drama</option>
            <option value="film">Film</option>
            <option value="product">Product</option>
            <option value="ugc">UGC</option>
            <option value="talent">Talent</option>
            <option value="youtube">YouTube</option>
            <option value="social">Social</option>
          </select>
          <button type="submit" className="forge-button" disabled={starting}>
            {starting ? "Opening your project…" : "Take it to Canvas"}
            <span>↗</span>
          </button>
          {error && (
            <p role="alert" className="home-error">
              {error}
            </p>
          )}
          <noscript>
            <p>
              Open <a href="/canvas">Canvas</a> to create your project with
              JavaScript enabled.
            </p>
          </noscript>
        </form>
      </section>
    </main>
  );
}
