"use client";
import { useEffect, useRef, useState } from "react";

type AgentState = "Working" | "Waiting" | "Needs attention" | "Finished";

type DemoState = {
  label: string;
  title: string;
  detail: string;
  claude: AgentState;
  claudeDetail: string;
  codex: AgentState;
  codexDetail: string;
  mode: "monitor" | "waiting" | "attention" | "jump" | "done";
};

const demoStates: DemoState[] = [
  {
    label: "Working",
    title: "Both agents are moving.",
    detail: "The notch stays quiet while your sessions work in the background.",
    claude: "Working",
    claudeDetail: "Using a tool · 00:24",
    codex: "Working",
    codexDetail: "Process running · 02:18",
    mode: "monitor"
  },
  {
    label: "Waiting",
    title: "See when work pauses.",
    detail: "Claude is waiting for input. Codex can keep running.",
    claude: "Waiting",
    claudeDetail: "Waiting for input",
    codex: "Working",
    codexDetail: "Process running · 02:18",
    mode: "waiting"
  },
  {
    label: "Needs you",
    title: "The notch calls you back.",
    detail: "A permission request gets priority, so you don't miss the moment you're needed.",
    claude: "Needs attention",
    claudeDetail: "Waiting for permission",
    codex: "Working",
    codexDetail: "Process running · 02:18",
    mode: "attention"
  },
  {
    label: "Jump back",
    title: "Return to the right terminal.",
    detail: "In the Mac app, Open focuses the source terminal when it can identify it.",
    claude: "Working",
    claudeDetail: "Session resumed",
    codex: "Working",
    codexDetail: "Process running · 02:18",
    mode: "jump"
  },
  {
    label: "Done",
    title: "Then it gets quiet again.",
    detail: "Finished and failed sessions are recorded in your local history.",
    claude: "Finished",
    claudeDetail: "Session ended",
    codex: "Finished",
    codexDetail: "Completed",
    mode: "done"
  }
];

function track(event: string) {
  const body = JSON.stringify({ event });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true
    }).catch(() => {});
  }
}

function StatusDot({ status }: { status: AgentState }) {
  const kind =
    status === "Needs attention" ? "attention" :
    status === "Finished" ? "done" :
    status === "Waiting" ? "waiting" : "working";
  return <span className={"status-dot " + kind} aria-hidden="true" />;
}

function ProductDemo() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const played = useRef(false);
  const state = demoStates[step];
  const expanded = manualExpanded ?? (state.mode === "attention");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPlaying(false);
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setStep(value => (value + 1) % demoStates.length);
      setManualExpanded(null);
      if (!played.current) {
        played.current = true;
        track("demo_played");
      }
    }, 4200);
    return () => window.clearInterval(timer);
  }, [playing]);

  function chooseStep(index: number) {
    setStep(index);
    setManualExpanded(null);
    setPlaying(false);
    if (!played.current) {
      played.current = true;
      track("demo_played");
    }
  }

  function openAgentPreview() {
    setStep(3);
    setManualExpanded(false);
    setPlaying(false);
    if (!played.current) {
      played.current = true;
      track("demo_played");
    }
  }

  function togglePlayback() {
    setPlaying(value => !value);
    if (!played.current) {
      played.current = true;
      track("demo_played");
    }
  }

  return (
    <div className="product-demo" data-mode={state.mode} aria-label="Interactive NotchSignal product preview">
      <div className="demo-topline">
        <div className="demo-kicker"><span className="preview-dot" /> Interactive product preview</div>
        <button className="demo-play-toggle" type="button" onClick={togglePlayback} aria-pressed={playing}>
          <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>{playing ? "Pause preview" : "Play preview"}
        </button>
      </div>

      <div className="demo-copy" aria-live="polite">
        <h2>{state.title}</h2>
        <p>{state.detail}</p>
      </div>

      <div className="macbook-wrap">
        <div className="macbook">
          <div className="macbook-screen">
            <div className="screen-menubar">
              <span className="apple-mark" aria-hidden="true">●</span>
              <strong>Finder</strong>
              <span>File</span><span>Edit</span><span>View</span><span>Go</span><span>Window</span>
              <div className="menubar-spacer" />
              <span className="menubar-status">Wi-Fi&nbsp; ◖&nbsp; ◉</span>
              <span>9:41</span>
            </div>

            <div className="camera-notch" aria-hidden="true"><span /></div>
            <div className="wallpaper-orb orb-one" />
            <div className="wallpaper-orb orb-two" />
            <div className="wallpaper-ribbon" aria-hidden="true" />

            <div className="terminal-window terminal-left">
              <div className="terminal-title"><span className="traffic red" /><span className="traffic amber" /><span className="traffic green" /><b>Claude Code — Terminal</b><span className="window-state">zsh</span></div>
              <div className="terminal-body">
                <p><span className="prompt">›</span> Review the app lifecycle events</p>
                <p className="muted-line">Inspecting local project files…</p>
                <p className={state.mode === "attention" ? "permission-line active-line" : "permission-line"}>
                  {state.mode === "attention" ? "Permission required · waiting for you" :
                    state.mode === "waiting" ? "Waiting for input…" :
                    state.mode === "jump" ? "Back in the source terminal ✓" :
                    state.mode === "done" ? "Session ended ✓" : "Working · last event 2s ago"}
                </p>
                <div className="terminal-progress"><span style={{ width: state.mode === "done" ? "100%" : state.mode === "attention" ? "68%" : "42%" }} /></div>
              </div>
            </div>

            <div className="terminal-window terminal-right">
              <div className="terminal-title"><span className="traffic red" /><span className="traffic amber" /><span className="traffic green" /><b>Codex — Terminal</b><span className="window-state">zsh</span></div>
              <div className="terminal-body">
                <p><span className="prompt">›</span> Run the regression checks</p>
                <p className="muted-line">Checking changed files…</p>
                <p className="permission-line">{state.codex === "Finished" ? "Checks finished ✓" : "Process running · local"}</p>
                <div className="terminal-progress"><span style={{ width: state.codex === "Finished" ? "100%" : "57%" }} /></div>
              </div>
            </div>

            <div className={"notch-island " + (expanded ? "is-expanded" : "")}>
              <button
                className="island-trigger"
                type="button"
                aria-label={expanded ? "Collapse agent activity preview" : "Expand agent activity preview"}
                aria-expanded={expanded}
                onClick={() => setManualExpanded(!expanded)}
              >
                <span className="island-compact">
                  <span className="island-agent"><StatusDot status={state.claude} /><b>Claude Code</b></span>
                  <span className="island-divider" />
                  <strong>{state.claude}</strong>
                  <span className="island-chevron" aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
                </span>
              </button>

              <div className="agent-popover">
                <div className="popover-head">
                  <div><b>Agents</b><span>{state.mode === "done" ? "0 active · 2 done" : "2 sessions"}</span></div>
                  <span className="local-pill"><i /> Local</span>
                </div>
                <div className="demo-agent-row">
                  <StatusDot status={state.claude} />
                  <div className="agent-copy"><b>Claude Code</b><span>NotchSignal · {state.claudeDetail}</span></div>
                  {state.claude !== "Finished" && state.mode !== "jump" && <button className="open-agent" type="button" onClick={openAgentPreview}>Open</button>}
                  {state.mode === "jump" && <span className="row-tag">Focused</span>}
                  {state.claude === "Finished" && <span className="row-tag done-tag">Done</span>}
                </div>
                <div className="demo-agent-row">
                  <StatusDot status={state.codex} />
                  <div className="agent-copy"><b>Codex</b><span>Workspace · {state.codexDetail}</span></div>
                  {state.codex !== "Finished" && <button className="open-agent" type="button" onClick={openAgentPreview}>Open</button>}
                  {state.codex === "Finished" && <span className="row-tag done-tag">Done</span>}
                </div>
                <div className="popover-footer"><span>↻ Refreshed locally every 5 seconds</span><span>No prompt content stored</span></div>
              </div>
            </div>

            <div className="focus-ring" aria-hidden="true" />
            <div className="desktop-dock" aria-hidden="true"><i>◉</i><i>▣</i><i>⌘</i><i>♫</i><i>⚙</i><span /></div>
          </div>
          <div className="macbook-lip"><span /></div>
        </div>
      </div>

      <div className="demo-steps" role="tablist" aria-label="Choose an agent state">
        {demoStates.map((item, index) => (
          <button
            key={item.label}
            type="button"
            className={index === step ? "demo-step active" : "demo-step"}
            onClick={() => chooseStep(index)}
            aria-selected={index === step}
            role="tab"
          >
            <span>0{index + 1}</span>{item.label}
          </button>
        ))}
      </div>
      <p className="demo-hint">{playing ? "Preview advances automatically · select a state to explore it yourself" : "Paused · select any state, or play the preview again"}</p>
    </div>
  );
}

export default function Landing() {
  const [busy, setBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const pricingRef = useRef<HTMLElement>(null);
  const pricingTracked = useRef(false);

  useEffect(() => {
    track("landing_view");
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && !pricingTracked.current) {
        pricingTracked.current = true;
        track("pricing_viewed");
      }
    }, { threshold: 0.5 });
    if (pricingRef.current) observer.observe(pricingRef.current);
    return () => observer.disconnect();
  }, []);

  async function checkout() {
    setBusy(true);
    setCheckoutError("");
    track("checkout_started");
    try {
      const response = await fetch("/api/checkout", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "Checkout failed");
      }
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Checkout failed");
      setBusy(false);
    }
  }

  return (
    <main>
      <nav className="nav">
        <a href="#" className="brand" aria-label="NotchSignal home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>NotchSignal</span>
        </a>
        <div className="nav-links">
          <a href="#demo">Demo</a>
          <a href="#features">Features</a>
          <a href="#privacy">Privacy</a>
          <a href="#pricing">Pricing</a>
        </div>
        <button className="nav-cta" onClick={checkout} disabled={busy}>Get it for $5</button>
      </nav>

      <section className="hero">
        <div className="eyebrow"><span className="eyebrow-dot" />Built for Claude Code + Codex on macOS</div>
        <h1>Stop checking<br />your agents.</h1>
        <p className="hero-copy">NotchSignal turns your MacBook notch into a quiet control surface for long-running AI coding agents. See what’s working, know when you’re needed, and jump back in one click.</p>
        <div className="hero-actions">
          <button className="primary" onClick={checkout} disabled={busy}>{busy ? "Opening secure checkout…" : "Get NotchSignal — $5 once"}</button>
          <a className="secondary" href="#demo"><span className="play-dot">▶</span> See it work</a>
        </div>
        <div className="hero-proof">
          <span>No subscription</span>
          <span>Local agent monitoring</span>
          <span>macOS 14+</span>
          <span>GPL-3.0 source</span>
        </div>
        {checkoutError && <p className="error" role="status">{checkoutError}</p>}
      </section>

      <section id="demo" className="demo-section">
        <ProductDemo />
      </section>

      <section className="section problem-section">
        <div className="section-label">The behavior we’re replacing</div>
        <div className="problem-grid">
          <div className="problem-copy">
            <h2>Your agent is autonomous.<br />Your attention shouldn’t babysit it.</h2>
            <p>You start Claude in one terminal, Codex in another, switch to your real work—and then keep reopening both just to see whether they are done or blocked.</p>
          </div>
          <div className="comparison">
            <div className="compare-row old">
              <span>Without NotchSignal</span>
              <b>Terminal → Terminal → Terminal → Terminal</b>
              <p>Repeated checking. Lost context. Missed permission prompts.</p>
            </div>
            <div className="compare-row new">
              <span>With NotchSignal</span>
              <b>Work → notch asks → one click → back to work</b>
              <p>The status surface stays peripheral until something actually needs you.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="section features-section">
        <div className="section-label">One job, done properly</div>
        <h2 className="section-title">A control surface, not another AI dashboard.</h2>
        <div className="feature-grid">
          <article>
            <span className="feature-num">01</span>
            <h3>Know what needs you</h3>
            <p>Claude Code lifecycle hooks distinguish working, waiting, permission requests, finish and failure without storing your prompts or source.</p>
          </article>
          <article>
            <span className="feature-num">02</span>
            <h3>Jump back instantly</h3>
            <p>Open the source terminal from the notch. Apple Terminal can return to the matching TTY when available; other terminals fall back to app focus.</p>
          </article>
          <article>
            <span className="feature-num">03</span>
            <h3>Let long runs stay alive</h3>
            <p>Optionally keep the Mac awake while an active agent is working, then release the assertion automatically when the work stops.</p>
          </article>
          <article>
            <span className="feature-num">04</span>
            <h3>Keep useful history, locally</h3>
            <p>See today’s sessions, runtime, completed and failed runs. No fake productivity score and no prompt-content analytics.</p>
          </article>
        </div>
      </section>

      <section className="section provider-section">
        <div className="provider-copy">
          <div className="section-label">Truthful integrations</div>
          <h2>We only show a state when we can actually know it.</h2>
          <p>No fake “12 agents connected” grid. No logos for providers that are not implemented.</p>
        </div>
        <div className="provider-list">
          <div className="provider-row"><div><span className="provider-glyph">C</span><b>Claude Code</b></div><span>Lifecycle + attention signals</span><em>Rich</em></div>
          <div className="provider-row"><div><span className="provider-glyph">⌘</span><b>Codex CLI</b></div><span>Process status + jump back</span><em>Live</em></div>
          <div className="provider-row"><div><span className="provider-glyph">_</span><b>Terminal agents</b></div><span>Generic process monitoring</span><em>Basic</em></div>
        </div>
      </section>

      <section id="privacy" className="section privacy-section">
        <div className="privacy-card">
          <div>
            <div className="section-label">Local by default</div>
            <h2>Your code is not the product.</h2>
          </div>
          <div className="privacy-points">
            <p><span>✓</span> No prompts uploaded by the agent monitor</p>
            <p><span>✓</span> No source code or terminal contents captured</p>
            <p><span>✓</span> Minimal lifecycle metadata for status + local history</p>
            <p><span>✓</span> Purchase analytics are separate from agent activity</p>
          </div>
        </div>
      </section>

      <section id="pricing" ref={pricingRef} className="section pricing-section">
        <div className="price-card">
          <div className="price-main">
            <div className="section-label">Founding access</div>
            <div className="price">$5 <span>one time</span></div>
            <h2>Buy the current v1.<br />Not a promise.</h2>
            <p>Founding access is intentionally simple: pay once for the current NotchSignal v1 product and secure download access tied to your purchase email.</p>
            <button className="primary price-button" onClick={checkout} disabled={busy}>{busy ? "Opening checkout…" : "Buy NotchSignal — $5"}</button>
            <small>Checkout is handled by Dodo Payments. Download access is unlocked only after server-side payment verification.</small>
          </div>
          <div className="price-includes">
            <b>Included</b>
            <p><span>✓</span> Current macOS v1 release</p>
            <p><span>✓</span> Apple Silicon + Intel universal package</p>
            <p><span>✓</span> Claude Code + Codex monitoring</p>
            <p><span>✓</span> Purchase-email access recovery</p>
            <p><span>✓</span> Corresponding GPL source per release</p>
          </div>
        </div>
      </section>

      <section id="faq" className="section faq">
        <div className="section-label">Before you buy</div>
        <h2 className="section-title">Straight answers.</h2>
        <details><summary>Will it run on my MacBook?</summary><p>The project targets macOS 14+. Release CI builds a universal Apple Silicon + Intel app. Notch behavior comes from the Boring Notch foundation; each shipped release is gated behind build/runtime verification.</p></details>
        <details><summary>Does NotchSignal read my prompts or source code?</summary><p>No. The monitoring path stores minimal lifecycle/process metadata needed to represent status. It does not persist prompts, source code, terminal contents or tool payloads.</p></details>
        <details><summary>Which agents are supported?</summary><p>Claude Code has richer lifecycle-aware attention states. Codex and generic supported terminal agents currently use truthful process-level monitoring. Unsupported providers are not presented as working integrations.</p></details>
        <details><summary>Why is it only $5?</summary><p>This is founding access to the current v1. The price is deliberately small while the product is early. There is no fake crossed-out price, countdown or “only 12 spots” claim.</p></details>
        <details><summary>What happens after payment?</summary><p>Dodo redirects you back, but that redirect does not unlock anything by itself. The server verifies payment first; only a verified paid purchase can request the private release download. If you return later, use the checkout email to recover access.</p></details>
        <details><summary>Is it open source?</summary><p>Yes. NotchSignal is a modified GPL-3.0 derivative of Boring Notch. Paying for binary access does not remove your GPL rights; corresponding source is published with distributed releases.</p></details>
      </section>

      <section className="final-cta">
        <div className="final-mark"><span className="brand-mark large"><i /><i /><i /></span></div>
        <h2>Your agents can keep working.<br />You can stop checking.</h2>
        <p>Put the status that matters in the one place already in your line of sight.</p>
        <button className="primary" onClick={checkout} disabled={busy}>Get NotchSignal — $5 once</button>
      </section>

      <footer>
        <a href="#" className="brand"><span className="brand-mark"><i /><i /><i /></span><span>NotchSignal</span></a>
        <span>GPL-3.0 derivative · Corresponding source with distributed releases</span>
      </footer>
    </main>
  );
}
