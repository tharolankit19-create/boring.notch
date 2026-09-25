"use client";
import { FormEvent, useEffect, useState } from "react";

export default function DownloadClient({ token }: { token: string }) {
  const [state, setState] = useState<"checking"|"paid"|"unpaid">("checking");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      for (let attempt = 0; attempt < 8 && !cancelled; attempt++) {
        const query = token ? `?token=${encodeURIComponent(token)}` : "";
        const response = await fetch(`/api/access/status${query}`, { cache: "no-store" });
        const data = await response.json();
        if (data.paid) { setState("paid"); return; }
        if (attempt < 7) await new Promise(resolve => setTimeout(resolve, 1500));
      }
      if (!cancelled) setState("unpaid");
    }
    check();
    return () => { cancelled = true; };
  }, [token]);

  async function requestLink(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/access/request", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email })
    });
    setSent(true);
  }

  const href = token ? `/api/download?token=${encodeURIComponent(token)}` : "/api/download";
  return (
    <main className="download-page">
      <a href="/" className="brand"><span className="brand-mark">N</span>NotchSignal</a>
      <section className="download-card">
        {state === "checking" && <><div className="spinner" /><h1>Confirming payment…</h1><p>We’re waiting for server-side confirmation from Dodo Payments. This page never unlocks from a redirect alone.</p></>}
        {state === "paid" && <><div className="confirmed">✓</div><h1>Payment confirmed</h1><p>Your current NotchSignal release is ready.</p><a className="primary download-button" href={href}>Download .dmg</a><small>macOS 14+ · Universal build after release verification</small></>}
        {state === "unpaid" && <><h1>Already purchased?</h1><p>Enter the email used at checkout. If a paid purchase exists, we’ll send a secure one-hour access link.</p><form onSubmit={requestLink}><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><button className="primary" type="submit">Email access link</button></form>{sent&&<p className="sent">If that email has a purchase, the link is on its way.</p>}</>}
      </section>
    </main>
  );
}
