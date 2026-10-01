"use client";
import { useEffect, useRef, useState } from "react";

type DemoState = {
  label: string;
  claude: "Working" | "Needs attention" | "Finished";
  codex: "Working" | "Finished";
  detail: string;
  mode: "monitor" | "attention" | "jump" | "done";
};

const demoStates: DemoState[] = [
  {
    label: "Monitor",
    claude: "Working",
    codex: "Working",
    detail: "Implementing secure download",
    mode: "monitor"
  },
  {
    label: "Attention",
    claude: "Needs attention",
    codex: "Working",
    detail: "Claude is waiting for permission",
    mode: "attention"
  },
  {
    label: "Jump back",
    claude: "Working",
    codex: "Working",
    detail: "Permission granted. Work resumed.",
    mode: "jump"
  },
  {
    label: "Done",
    claude: "Finished",
    codex: "Finished",
    detail: "Both sessions finished",
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

function StatusDot({ status }: { status: DemoState["claude"] | DemoState["codex"] }) {
  const kind = status === "Needs attention" ? "attention" : status === "Finished" ? "done" : "working";
  return <span className={`status-dot ${kind}`} aria-hidden="true" />;
}

function ProductDemo() {
  const [step, setStep] = useState(0);
  const played = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep(value => {
        if (!played.current) {
          played.current = true;
          track("demo_played");
        }
        return (value + 1) % demoStates.length;
      });
    }, 2400);
    return () => window.clearInterval(timer);
  }, []);

  const state = demoStates[step];

  return (
    <div className="product-demo" data-mode={state.mode} aria-label="Animated NotchSignal product demo">
      <div className="demo-copy">
        <div className="demo-kicker">Live product walkthrough</div>
        <h2>{state.mode === "monitor" && "Your agents keep working."}{state.mode === "attention" && "The notch asks when you’re needed."}{state.mode === "jump" && "Jump back to the right terminal."}{state.mode === "done" && "Then it gets quiet again."}</h2>
        <p>{state.detail}</p>
      </div>

      <div className="macbook-wrap">
        <div className="macbook">
          <div className="macbook-screen">
            <div className="screen-menubar">
              <span className="apple-mark">●</span>
              <span>Finder</span>
              <div className="menubar-spacer" />
              <span>9:41</span>
            </div>

            <div className="camera-notch" aria-hidden="true"><span /></div>

            <div className="wallpaper-orb orb-one" />
            <div className="wallpaper-orb orb-two" />

            <div className="terminal-window terminal-left">
              <div className="terminal-title"><span className="traffic red" /><span className="traffic amber" /><span className="traffic green" /><b>claude</b></div>
              <div className="terminal-body">
                <p><span className="prompt">›</span> Build the release payment flow</p>
                <p className="muted-line">Editing website/app/api/download/route.ts</p>
                <p className={state.mode === "attention" ? "permission-line active-line" : "permission-line"}>
                  {state.mode === "attention" ? "Allow command: npm run build?" : state.mode === "jump" ? "Permission allowed ✓" : state.mode === "done" ? "Finished ✓" : "Running tests…"}
                </p>
              </div>
            </div>

            <div className="terminal-window terminal-right">
              <div className="terminal-title"><span className="traffic red" /><span className="traffic amber" /><span className="traffic green" /><b>codex</b></div>
              <div className="terminal-body">
                <p><span className="prompt">›</span> Verify checkout and release gate</p>
                <p className="muted-line">Running web build + API checks</p>
                <p>{state.codex === "Finished" ? "Checks passed ✓" : "Working…"}</p>
              </div>
            </div>

            <div className={`notch-island ${state.mode === "attention" ? "is-expanded" : ""}`}>
              <div className="island-compact">
                <div><StatusDot status={state.claude} /><b>Claude</b></div>
                <span className="island-divider" />
                <strong>{state.claude}</strong>
              </div>

              <div className="agent-popover">
                <div className="popover-head">
                  <div><b>Agents</b><span>{state.mode === "done" ? "2 done" : "2 active"}</span></div>
                  <span className="local-pill">Local</span>
                </div>
                <div className="demo-agent-row">
                  <StatusDot status={state.claude} />
                  <div className="agent-copy"><b>Claude Code</b><span>NotchSignal · {state.claude}</span></div>
                  {state.mode === "attention" && <button type="button" tabIndex={-1}>Open Terminal</button>}
                  {state.mode === "jump" && <span className="row-tag">Opened</span>}
                </div>
                <div className="demo-agent-row">
                  <StatusDot status={state.codex} />
                  <div className="agent-copy"><b>Codex</b><span>website · {state.codex}</span></div>
                </div>
              </div>
            </div>

            <div className="demo-cursor" aria-hidden="true">↖</div>
            <div className="focus-ring" aria-hidden="true" />
          </div>
          <div className="macbook-lip"><span /></div>
        </div>
      </div>

      <div className="demo-steps" role="tablist" aria-label="Demo steps">
        {demoStates.map((item, index) => (
          <button
            key={item.label}
            type="button"
            className={index === step ? "demo-step active" : "demo-step"}
            onClick={() => {
              setStep(index);
              if (!played.current) {
                played.current = true;
                track("demo_played");
              }
            }}
            aria-selected={index === step}
            role="tab"
          >
            <span>0{index + 1}</span>{item.label}
          </button>
        ))}
      </div>
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
