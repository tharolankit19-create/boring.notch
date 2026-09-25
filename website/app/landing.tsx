"use client";
import { useEffect, useRef, useState } from "react";

const demoStates = [
  { claude: "Working", codex: "Working", detail: "Building checkout flow" },
  { claude: "Needs attention", codex: "Working", detail: "Waiting for permission" },
  { claude: "Working", codex: "Working", detail: "Permission granted" },
  { claude: "Working", codex: "Finished", detail: "Checkout flow finished" }
];

function track(event: string) {
  const body = JSON.stringify({ event });
  if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
  else fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}

function ProductDemo() {
  const [step, setStep] = useState(0);
  const played = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => {
      setStep(value => {
        if (!played.current) { played.current = true; track("demo_played"); }
        return (value + 1) % demoStates.length;
      });
    }, 2200);
    return () => clearInterval(timer);
  }, []);
  const state = demoStates[step];

  return (
    <div className="demo-shell" aria-label="NotchSignal product UI preview">
      <div className="desktop-bar"><span>Finder</span><span>9:41</span></div>
      <div className="notch">
        <div className="notch-cap" />
        <div className="agent-mini">
          <span className={state.claude === "Needs attention" ? "dot attention" : "dot working"} />
          <strong>Claude</strong><span>{state.claude}</span>
        </div>
        <div className={state.claude === "Needs attention" ? "agent-panel expanded" : "agent-panel"}>
          <div className="panel-title"><b>Agents</b><span>Local</span></div>
          <div className="agent-row">
            <span className={state.claude === "Needs attention" ? "dot attention" : "dot working"} />
            <div><b>Claude Code</b><small>NotchSignal · {state.detail}</small></div>
            {state.claude === "Needs attention" && <button type="button">Open Terminal</button>}
          </div>
          <div className="agent-row">
            <span className={state.codex === "Finished" ? "dot done" : "dot working"} />
            <div><b>Codex</b><small>website · {state.codex}</small></div>
            {state.codex !== "Finished" && <button type="button">Open</button>}
          </div>
        </div>
      </div>
      <div className="terminal terminal-a"><span>claude</span><p>Implementing purchase verification…</p></div>
      <div className="terminal terminal-b"><span>codex</span><p>Running tests…</p></div>
      <div className="demo-caption">Product UI preview · no fake performance metrics</div>
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
        pricingTracked.current = true; track("pricing_viewed");
      }
    }, { threshold: 0.5 });
    if (pricingRef.current) observer.observe(pricingRef.current);
    return () => observer.disconnect();
  }, []);

  async function checkout() {
    setBusy(true); setCheckoutError(""); track("checkout_started");
    try {
      const response = await fetch("/api/checkout", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error ?? "Checkout failed");
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Checkout failed");
      setBusy(false);
    }
  }

  return (
    <main>
      <nav className="nav">
        <a href="#" className="brand"><span className="brand-mark">N</span>NotchSignal</a>
        <div className="nav-links"><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></div>
        <button className="nav-cta" onClick={checkout}>Get founding access · $5</button>
      </nav>

      <section className="hero">
        <div className="eyebrow"><span />Local-first agent activity for macOS</div>
        <h1>Your AI agents.<br />Right in the notch.</h1>
        <p className="hero-copy">See what’s running, know when an agent needs you, and jump back without checking five terminals.</p>
        <div className="hero-actions">
          <button className="primary" onClick={checkout} disabled={busy}>{busy ? "Opening checkout…" : "Get founding access — $5"}</button>
          <a className="secondary" href="#demo">Watch demo</a>
        </div>
        <div className="trust-row"><span>One-time purchase</span><span>macOS 14+</span><span>Local agent monitoring</span><span>GPL-3.0 source</span></div>
        {checkoutError && <p className="error">{checkoutError}</p>}
      </section>

      <section id="demo" className="demo-section"><ProductDemo /></section>

      <section className="problem section">
        <p className="kicker">The problem</p>
        <h2>You started three agents.<br />Now you’re checking three windows.</h2>
        <p>Long-running coding agents are useful until monitoring them becomes another job. NotchSignal turns the notch into a quiet status surface and only asks for attention when a provider can truthfully say it needs you.</p>
      </section>

      <section id="features" className="section grid">
        <article><span>01</span><h3>Know what needs you</h3><p>Claude Code lifecycle hooks distinguish working, waiting, permission requests, finish and failure without reading your prompts.</p></article>
        <article><span>02</span><h3>Jump back</h3><p>Open the source terminal quickly. Apple Terminal can return to the matching TTY when available; other terminals fall back to app-level focus.</p></article>
        <article><span>03</span><h3>Keep work alive</h3><p>Optionally keep the Mac awake only while an active agent is working. It turns off when the work stops.</p></article>
        <article><span>04</span><h3>Quiet history</h3><p>Today’s sessions, runtime, completed and failed work stay lightweight and local.</p></article>
      </section>

      <section className="providers section">
        <p className="kicker">Implemented first</p>
        <div className="provider-row"><b>Claude Code</b><span>Rich lifecycle / attention signals</span></div>
        <div className="provider-row"><b>Codex CLI</b><span>Local process status + jump back</span></div>
        <div className="provider-row"><b>Terminal agents</b><span>Generic process-level monitoring</span></div>
        <p className="fine">Cursor and Grok are not advertised as implemented until reliable local adapters exist.</p>
      </section>

      <section className="section utilities">
        <div><p className="kicker">Still useful between runs</p><h2>The best notch utilities stay.</h2></div>
        <p>Media controls, file shelf, system HUDs, calendar, battery, mirror, gestures and display handling remain secondary tools—not the product story.</p>
      </section>

      <section id="pricing" ref={pricingRef} className="pricing section">
        <div className="price-card">
          <p className="kicker">Founding access</p>
          <div className="price">$5 <span>one-time</span></div>
          <p>Early build / founding release. Early buyers keep access to the current v1 product. No fake crossed-out price. No countdown.</p>
          <button className="primary full" onClick={checkout} disabled={busy}>Get founding access — $5</button>
          <small>Checkout collects your email so you can regain download access later.</small>
        </div>
      </section>

      <section id="faq" className="faq section">
        <p className="kicker">FAQ</p>
        <details><summary>Which macOS versions are supported?</summary><p>The current source targets macOS 14.0+. Universal Intel + Apple Silicon packaging is verified by release CI before support is claimed for a shipped build.</p></details>
        <details><summary>Does it work on external or notchless displays?</summary><p>The inherited display/window system supports a software notch surface on compatible displays. Final release QA is recorded per version.</p></details>
        <details><summary>What leaves my Mac?</summary><p>Agent monitoring stays local. The app does not send prompts, source code, terminal contents, tool inputs or project files to product analytics.</p></details>
        <details><summary>Which agents work today?</summary><p>Claude Code has lifecycle-aware status. Codex and supported terminal agents currently have truthful process-level monitoring. Unsupported providers are not faked.</p></details>
        <details><summary>Is NotchSignal open source?</summary><p>Yes. It is a substantially modified GPL-3.0 derivative of Boring Notch. Paid binary access does not remove GPL rights, and corresponding source is published per release.</p></details>
        <details><summary>How do updates work?</summary><p>The app has a version endpoint and secure release flow. Paid buyers regain the current download using the purchase email; binaries are signed/notarized when Apple credentials are configured.</p></details>
        <details><summary>Refunds?</summary><p>The founding release refund policy is shown at checkout and should match the policy configured in Dodo Payments before launch.</p></details>
      </section>

      <section className="final section"><h2>Put your AI agents in the notch.</h2><button className="primary" onClick={checkout}>Get founding access — $5</button></section>
      <footer><span>NotchSignal</span><span>GPL-3.0 · Source available with every distributed build</span></footer>
    </main>
  );
}
