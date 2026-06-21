"use client";

import {
  ArrowSquareOut,
  Check,
  ClockCountdown,
  Coins,
  GithubLogo,
  IdentificationCard,
  LockKey,
  ShieldCheck,
  Star,
  Warning,
  X
} from "@phosphor-icons/react";
import type { Approval, DashboardSnapshot, Purchase, PurchaseStatus, ReputationSnapshot } from "@cspr-sentinel/core";
import { signIn, signOut, useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

type RuntimeState = DashboardSnapshot & { runtimeMode: "simulated" | "testnet" };

const initialInstrument = {
  instrumentId: "CP-LOG-2026-0417",
  issuer: "Northstar Logistics SPV",
  faceValue: 275000,
  currency: "USD",
  maturityDate: "2027-03-31",
  documentHash: "b4f3a12d8c019d31e4c26f78c2219ef0"
};

const statusLabel: Record<PurchaseStatus, string> = {
  requested: "Requested", policy_denied: "Denied", pending_approval: "Needs approval", approved: "Approved",
  paying: "Paying", settled: "Settled", delivered: "Delivered", failed: "Failed"
};

export function Dashboard({ initialState, initialMode }: { initialState: DashboardSnapshot; initialMode: "simulated" | "testnet" }) {
  const [state, setState] = useState<RuntimeState>({ ...initialState, runtimeMode: initialMode });
  const [instrument, setInstrument] = useState(initialInstrument);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const { data: session } = useSession();

  const policy = state.policies[0];
  const pending = useMemo(() => state.approvals.filter((approval) => approval.decision === "pending"), [state.approvals]);
  const delivered = state.purchases.filter((purchase) => purchase.status === "delivered");
  const spent = delivered.reduce((sum, purchase) => sum + purchase.amount, 0);

  async function refresh() {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (response.ok) setState(await response.json() as RuntimeState);
  }

  async function runDemo() {
    setBusy("demo"); setError(null); setReport(null);
    try {
      const response = await fetch("/api/demo/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(instrument) });
      const body = await response.json() as { message?: string; report?: Record<string, unknown> };
      if (!response.ok) throw new Error(body.message ?? "The diligence run failed.");
      setReport(body.report ?? null);
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The diligence run failed."); }
    finally { setBusy(null); }
  }

  async function decide(approval: Approval, decision: "approved" | "rejected") {
    setBusy(approval.id); setError(null);
    try {
      const response = await fetch(`/api/approvals/${approval.purchaseId}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision })
      });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "Approval could not be updated.");
      await refresh();
      if (decision === "approved") {
        const reportResponse = await fetch("/api/demo/report", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(instrument)
        });
        if (reportResponse.ok) setReport(await reportResponse.json() as Record<string, unknown>);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Approval could not be updated."); }
    finally { setBusy(null); }
  }

  async function rate(purchase: Purchase) {
    setBusy(`rating-${purchase.id}`); setError(null);
    try {
      const response = await fetch("/api/ratings", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ purchaseId: purchase.id, score: 4, evidenceHash: purchase.responseHash ?? purchase.requestHash })
      });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "Rating could not be recorded.");
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Rating could not be recorded."); }
    finally { setBusy(null); }
  }

  return (
    <div className="min-h-[100dvh] overflow-x-clip">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_94%,transparent)] px-4 backdrop-blur-sm supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--background)_88%,transparent)] md:px-8">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-white"><ShieldCheck size={21} weight="bold" /></div>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">CSPR Sentinel</p><p className="truncate text-xs text-[var(--text-muted)]">Agent payment control plane</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block"><ModeBadge mode={state.runtimeMode} /></div>
            {session?.user ? (
              <button className="hidden rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-muted)] active:scale-[0.98] sm:block" onClick={() => signOut()}>Sign out</button>
            ) : (
              <button className="hidden items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-muted)] active:scale-[0.98] sm:flex" onClick={() => signIn("github")}><GithubLogo size={17} /> Owner login</button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-[1400px] px-4 py-8 md:px-8 md:py-10">
        <section className="grid min-w-0 gap-8 border-b border-[var(--border)] pb-9 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <p className="mb-3 text-sm font-semibold text-[var(--accent)]">Policy-controlled x402 payments</p>
            <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.02] md:text-5xl">Let agents pay. Keep humans in control.</h1>
            <p className="mt-4 max-w-[65ch] break-words text-pretty text-base leading-relaxed text-[var(--text-muted)]">Autonomous Casper payments, approval thresholds, and verifiable reputation in one MCP-native control plane.</p>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2">
            <Metric label="Spent today" value={`${spent.toFixed(2)} WCSPR`} />
            <Metric label="Pending approvals" value={String(pending.length)} />
            <Metric label="Completed purchases" value={String(delivered.length)} />
            <Metric label="Policy blocks" value={String(state.purchases.filter((item) => item.status === "policy_denied").length)} />
          </div>
        </section>

        {error && <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface))] p-4 text-sm"><Warning className="mt-0.5 shrink-0 text-[var(--danger)]" size={18} /><div><p className="font-semibold">Action failed</p><p className="mt-1 text-[var(--text-muted)]">{error}</p></div></div>}

        <section className="grid gap-6 py-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
          <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 md:p-7">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div><h2 className="text-balance text-2xl font-semibold">RWA diligence run</h2><p className="mt-2 max-w-[60ch] text-pretty text-sm leading-relaxed text-[var(--text-muted)]">The first service pays automatically. The second pauses for owner approval.</p></div>
              <span className="w-fit rounded-md bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">Synthetic data</span>
            </div>
            <div className="mt-7 grid gap-5 md:grid-cols-2">
              <Field label="Instrument ID" value={instrument.instrumentId} onChange={(value) => setInstrument({ ...instrument, instrumentId: value })} />
              <Field label="Issuer" value={instrument.issuer} onChange={(value) => setInstrument({ ...instrument, issuer: value })} />
              <Field label="Face value" value={String(instrument.faceValue)} type="number" onChange={(value) => setInstrument({ ...instrument, faceValue: Number(value) })} />
              <Field label="Maturity date" value={instrument.maturityDate} type="date" onChange={(value) => setInstrument({ ...instrument, maturityDate: value })} />
              <div className="md:col-span-2"><Field label="Document hash" value={instrument.documentHash} mono onChange={(value) => setInstrument({ ...instrument, documentHash: value })} /></div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button onClick={runDemo} disabled={busy !== null} className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white hover:bg-[var(--accent-strong)] active:scale-[0.98] disabled:opacity-50">{busy === "demo" ? "Planning purchases..." : "Run diligence"}</button>
              <p className="text-xs text-[var(--text-muted)]">Uses Anthropic when configured, otherwise a deterministic planner.</p>
            </div>
            {report && <ReportPreview report={report} />}
          </div>

          <aside className="space-y-6">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center gap-3"><LockKey size={20} className="text-[var(--accent)]" /><h2 className="font-semibold">Active policy</h2></div>
              {policy ? <dl className="mt-5 grid grid-cols-2 gap-4">
                <PolicyValue label="Auto-pay limit" value={`${policy.autoApproveLimit.toFixed(2)} WCSPR`} />
                <PolicyValue label="Daily limit" value={`${policy.dailyLimit.toFixed(2)} WCSPR`} />
                <PolicyValue label="Minimum trust" value={`${policy.minimumProviderReputation}/100`} />
                <PolicyValue label="Allowed services" value={String(policy.allowedServiceIds.length)} />
              </dl> : <p className="mt-4 text-sm text-[var(--text-muted)]">No policy configured.</p>}
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
              <h2 className="font-semibold">MCP endpoint</h2>
              <code className="mono mt-3 block overflow-x-auto rounded-lg bg-[var(--surface)] p-3 text-xs">/api/mcp</code>
              <p className="mt-3 text-pretty text-xs leading-relaxed text-[var(--text-muted)]">Five tools expose service discovery, controlled purchasing, status, ratings, and reputation.</p>
            </div>
          </aside>
        </section>

        <section className="border-t border-[var(--border)] py-8">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><h2 className="text-balance text-2xl font-semibold">Approval queue</h2><p className="mt-1 text-sm text-[var(--text-muted)]">High-value requests stop here before any signature is created.</p></div><span className="mono text-sm tabular-nums text-[var(--text-muted)]">{pending.length} pending</span></div>
          {pending.length === 0 ? (
            <EmptyState icon={<ClockCountdown size={28} />} title="No approvals waiting" body="Run the diligence demo to create a policy-gated risk intelligence request." action={<button onClick={runDemo} disabled={busy !== null} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-muted)]">Run diligence</button>} />
          ) : <div className="grid gap-3">{pending.map((approval) => {
            const purchase = state.purchases.find((item) => item.id === approval.purchaseId);
            const service = state.services.find((item) => item.id === purchase?.serviceId);
            return <div key={approval.id} className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0"><p className="font-semibold">{service?.name ?? "Paid service"}</p><p className="mt-1 text-sm text-[var(--text-muted)]">{purchase?.policyReason}</p><p className="mono mt-3 text-xs text-[var(--text-muted)]">{purchase?.amount.toFixed(2)} WCSPR / {purchase?.id}</p></div>
              <div className="flex gap-2"><button onClick={() => decide(approval, "rejected")} disabled={busy !== null} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-muted)] active:scale-[0.98] disabled:opacity-50"><X size={16} /> Reject</button><button onClick={() => decide(approval, "approved")} disabled={busy !== null} className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] active:scale-[0.98] disabled:opacity-50"><Check size={16} /> Approve</button></div>
            </div>;
          })}</div>}
        </section>

        <section className="grid gap-8 border-t border-[var(--border)] py-8 xl:grid-cols-[0.75fr_1.25fr]">
          <div><h2 className="text-balance text-2xl font-semibold">Bilateral trust</h2><p className="mt-2 max-w-[48ch] text-pretty text-sm leading-relaxed text-[var(--text-muted)]">Providers earn trust from verified delivery and buyer ratings. Agents earn it from payment reliability and policy behavior.</p><div className="mt-6 grid gap-3">{state.reputations.map((item) => <ReputationRow key={`${item.subjectType}-${item.subjectId}`} item={item} name={subjectName(state, item)} />)}</div></div>
          <div className="min-w-0"><div className="mb-5 flex items-end justify-between"><div><h2 className="text-balance text-2xl font-semibold">Payment ledger</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Policy decisions and chain evidence for every request.</p></div><Coins size={24} className="text-[var(--accent)]" /></div><PaymentLedger state={state} busy={busy} onRate={rate} /></div>
        </section>
      </main>
      <footer className="border-t border-[var(--border)] px-4 py-6 text-sm text-[var(--text-muted)] md:px-8"><div className="mx-auto flex max-w-[1400px] flex-col justify-between gap-3 sm:flex-row"><p>CSPR Sentinel. Built for the Casper Agentic Buildathon.</p><a className="flex items-center gap-1.5 font-medium text-[var(--text)] hover:text-[var(--accent)]" href="https://github.com" target="_blank" rel="noreferrer">Open-source repository <ArrowSquareOut size={15} /></a></div></footer>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-[var(--surface)] p-4"><dt className="text-xs text-[var(--text-muted)]">{label}</dt><dd className="mono mt-2 text-xl font-semibold tabular-nums">{value}</dd></div>; }

function Field({ label, value, onChange, type = "text", mono = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; mono?: boolean }) {
  return <label className="grid min-w-0 gap-2 text-sm font-medium">{label}<input className={cn("w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[var(--text)] placeholder:text-[var(--text-muted)]", mono && "mono text-xs")} type={type} value={value} onChange={(event) => onChange(event.target.value)} /><span className="sr-only">Enter {label.toLowerCase()}</span></label>;
}

function PolicyValue({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-[var(--text-muted)]">{label}</dt><dd className="mono mt-1.5 text-sm font-semibold tabular-nums">{value}</dd></div>; }

function ModeBadge({ mode }: { mode: "simulated" | "testnet" }) { return <span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", mode === "testnet" ? "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]" : "bg-[var(--surface-muted)] text-[var(--text-muted)]")}>{mode === "testnet" ? "Casper Testnet" : "Simulation mode"}</span>; }

function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action: React.ReactNode }) { return <div className="flex flex-col items-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-10 text-center"><div className="text-[var(--text-muted)]">{icon}</div><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-1 max-w-md text-pretty text-sm text-[var(--text-muted)]">{body}</p><div className="mt-5">{action}</div></div>; }

function ReportPreview({ report }: { report: Record<string, unknown> }) { return <div className="mt-7 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-5"><div className="flex items-center gap-2"><IdentificationCard size={19} className="text-[var(--accent)]" /><h3 className="font-semibold">Report checkpoint</h3></div><p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">{String(report.conclusion ?? "The report is waiting for approved intelligence.")}</p><p className="mt-3 text-xs font-medium text-[var(--warning)]">{String(report.disclaimer ?? "Synthetic demonstration data.")}</p></div>; }

function ReputationRow({ item, name }: { item: ReputationSnapshot; name: string }) { return <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="flex size-10 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--accent)]">{item.subjectType === "agent" ? <ShieldCheck size={20} /> : <IdentificationCard size={20} />}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{name}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">{item.subjectType === "agent" ? "Agent behavior" : "Provider delivery"} / {item.label}</p></div><strong className="mono text-2xl tabular-nums">{item.score}</strong></div>; }

function PaymentLedger({ state, busy, onRate }: { state: RuntimeState; busy: string | null; onRate: (purchase: Purchase) => void }) {
  if (state.purchases.length === 0) return <EmptyState icon={<Coins size={28} />} title="No payment attempts" body="Run the diligence demo to populate the policy and payment ledger." action={<span className="text-xs text-[var(--text-muted)]">Waiting for an agent request</span>} />;
  return <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-[var(--surface-muted)] text-xs text-[var(--text-muted)]"><tr><th className="px-4 py-3 font-medium">Service</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Evidence</th><th className="px-4 py-3 font-medium">Trust</th></tr></thead><tbody>{[...state.purchases].reverse().map((purchase) => { const service = state.services.find((item) => item.id === purchase.serviceId); const rated = state.ratings.some((item) => item.purchaseId === purchase.id); return <tr key={purchase.id} className="border-t border-[var(--border)]"><td className="px-4 py-3.5 font-medium">{service?.name ?? purchase.serviceId}</td><td className="mono px-4 py-3.5 tabular-nums">{purchase.amount.toFixed(2)} WCSPR</td><td className="px-4 py-3.5"><Status status={purchase.status} /></td><td className="mono max-w-44 truncate px-4 py-3.5 text-xs text-[var(--text-muted)]" title={purchase.deployHash}>{purchase.deployHash ?? "Not settled"}</td><td className="px-4 py-3.5">{purchase.status === "delivered" && !rated ? <button onClick={() => onRate(purchase)} disabled={busy !== null} className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--surface-muted)] disabled:opacity-50"><Star size={14} /> Rate 4/5</button> : <span className="text-xs text-[var(--text-muted)]">{rated ? "Recorded" : "Unavailable"}</span>}</td></tr>; })}</tbody></table></div>;
}

function Status({ status }: { status: PurchaseStatus }) { const style = status === "delivered" || status === "settled" ? "text-[var(--success)]" : status === "pending_approval" ? "text-[var(--warning)]" : status === "failed" || status === "policy_denied" ? "text-[var(--danger)]" : "text-[var(--text-muted)]"; return <span className={cn("text-xs font-semibold", style)}>{statusLabel[status]}</span>; }

function subjectName(state: RuntimeState, item: ReputationSnapshot): string { return item.subjectType === "agent" ? state.agents.find((agent) => agent.id === item.subjectId)?.name ?? item.subjectId : state.providers.find((provider) => provider.id === item.subjectId)?.name ?? item.subjectId; }
