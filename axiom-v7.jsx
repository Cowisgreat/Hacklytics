import { useState, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis, ReferenceLine } from "recharts";

const C = {
  bg: "#06070a", surface: "#0c0d12", surfaceAlt: "#10121a",
  border: "#1e2130", borderHover: "#2a2e42",
  accent: "#e2a855", accentDim: "#e2a85515", accentBorder: "#e2a85530",
  green: "#4ade80", greenBg: "#4ade800d", greenBorder: "#4ade8028",
  red: "#fb7185", redBg: "#fb71850d", redBorder: "#fb718528",
  amber: "#fbbf24",
  blue: "#60a5fa", cyan: "#22d3ee", purple: "#c084fc",
  white: "#f8fafc", text: "#e2e8f0", muted: "#94a3b8", dim: "#64748b", dimmer: "#475569", darkest: "#334155",
};
const MONO = `'SF Mono','JetBrains Mono','Fira Code',monospace`;
const SANS = `-apple-system,'Inter','Segoe UI',sans-serif`;

const AGENTS = {
  NumericVerifier: { icon: "⊞", color: C.cyan, name: "NumericVerifier", source: "SEC EDGAR · Court DB", subtitle: "Structured Data & Numeric Validation", desc: "Extracts numeric assertions and cross-references them against authoritative sources — SEC filings, court records, earnings transcripts. Catches fabricated statistics, magnitude errors, and misquoted figures.", methodology: ["Parse claim for numeric entities (%, $, ratios, dates)", "Query authoritative databases for matching entity + metric + period", "Compare values against source within tolerance bands", "Flag anomalies (>2σ from norm), unit errors, temporal misalignment"], tools: ["SEC EDGAR API", "Court records", "Statistical anomaly detection"] },
  RetrieverAgent: { icon: "⊚", color: C.blue, name: "RetrieverAgent", source: "Actian VectorAI DB", subtitle: "Semantic Evidence Retrieval via Actian VectorAI", desc: "Embeds claims into vectors and queries Actian VectorAI DB for semantically similar verified facts, prior claims, and source documents. Finds supporting and contradicting evidence ranked by similarity.", methodology: ["Embed claim text (384-dim sentence-transformer)", "Query Actian VectorAI DB across multiple indexes", "Score docs as SUPPORTS / CONTRADICTS / NEUTRAL", "Compute weighted stance (relevance × recency × authority)"], tools: ["Actian VectorAI DB", "Sentence-transformer", "Multi-index retrieval"] },
  ConsistencyBot: { icon: "⊘", color: C.amber, name: "ConsistencyBot", source: "Sphinx reasoning", subtitle: "Cross-Claim Logical Consistency", desc: "Analyzes all claims together to find logical, arithmetic, and temporal contradictions. Catches errors where individual claims seem plausible but are mathematically impossible together.", methodology: ["Build constraint graph linking all claims", "Check arithmetic consistency", "Verify temporal coherence", "Flag jointly impossible claim sets"], tools: ["Constraint solver", "Arithmetic engine", "Sphinx reasoning"] },
};
const AN = ["NumericVerifier", "RetrieverAgent", "ConsistencyBot"];

// Demo step order for progress indicator
const DEMO_STEPS = [
  { key: "INTRO", label: "Context", short: "1" },
  { key: "PROMPT", label: "Prompt", short: "2" },
  { key: "RESPONSE", label: "AI response", short: "3" },
  { key: "VERIFYING", label: "Verify", short: "4" },
  { key: "VERDICT", label: "Verdict", short: "5" },
];

// ─── Slideshow (enterprise risk framing) ───
const SLIDES = [
  { title: "Lawyers cited 6 fake cases", body: "ChatGPT invented every citation. Both attorneys sanctioned. Enterprise AI without verification = liability.", color: C.red, year: "Mata v. Avianca · 2023" },
  { title: "Air Canada liable for chatbot lie", body: "AI promised a discount that didn't exist. Court held the company responsible. High-risk AI demands guardrails.", color: C.red, year: "2024" },
  { title: "In high-risk workflows, one error = regulatory exposure.", body: "Axiom verifies every claim against authoritative sources before output reaches your team. Audit-ready. Governance-first.", color: C.white, year: "" },
];

// ─── Scenarios ───
const SCENARIOS = {
  finance_false: {
    id: "finance_false", label: "Finance · Hallucination", icon: "📉", color: C.red,
    tagline: "AI fabricates earnings data. Axiom blocks a $50M mistake.",
    domain: "FINANCE", company: "Meridian Health Partners", companyDesc: "Healthcare investment fund · $2.4B AUM",
    analyst: "Sarah Chen, Senior Analyst",
    context: "Meridian is evaluating Acme Corp for a $50M allocation. Sarah asks the firm's AI to summarize Acme's quarterly performance.",
    prompt: "Summarize Acme Corp's Q3 2024 financial performance, including revenue growth, margins, and capital allocation.",
    response: `Acme Corp delivered exceptional results in Q3 2024. Revenue grew 28% quarter-over-quarter to $2.19 billion, driven by strong demand in their cloud healthcare platform. Operating margins expanded to 34.2%, up from 29.1% in Q2. The company also announced a $2 billion stock buyback program. Acme remains headquartered in San Francisco and continues investing in AI-powered healthcare infrastructure.`,
    claims: [
      { id: "CLM-001", text: "Revenue grew 28% quarter-over-quarter", type: "NUMERIC", severity: "CRITICAL", bad: true, highlight: "28% quarter-over-quarter", riskScore: 0.08, verdict: "FALSE", action: "BLOCK", rationale: "SEC filing shows actual growth of 7.6%. The 28% figure is fabricated.",
        agents: { NumericVerifier: { pos: "SHORT", conf: 0.92, summary: "SEC 10-Q shows 7.6%, not 28%.", findings: [{ type: "CONTRADICTION", text: "SEC 10-Q: Q3 $1.84B vs Q2 $1.71B — actual growth 7.6%.", source: "SEC EDGAR · Acme 10-Q", rel: 0.97 }, { type: "CONTRADICTION", text: "CFO: 'solid single-digit sequential growth.'", source: "Earnings Transcript", rel: 0.91 }, { type: "FLAG", text: "28% QoQ is 3.2σ above historical mean of 5.2%.", source: "Historical analysis", rel: 0.84 }] }, RetrieverAgent: { pos: "SHORT", conf: 0.88, summary: "3 contradicting docs. 0 supporting.", findings: [{ type: "CONTRADICTION", text: "Nearest verified: 'Acme grew 7.6% QoQ' (sim: 0.94).", source: "Actian VectorAI · Claims Index", rel: 0.94 }, { type: "PATTERN", text: "LLM previously hallucinated '32% QoQ' for same entity.", source: "Actian VectorAI · Hallucination Archive", rel: 0.82 }] }, ConsistencyBot: { pos: "SHORT", conf: 0.85, summary: "Revenue + margin claims arithmetically impossible.", findings: [{ type: "INCONSISTENCY", text: "28% rev growth + 4.1% COGS growth → margins ~38.6%, not 34.2%.", source: "Cross-claim arithmetic", rel: 0.93 }] } } },
      { id: "CLM-002", text: "Operating margins expanded to 34.2%", type: "NUMERIC", severity: "HIGH", bad: true, highlight: "34.2%", riskScore: 0.15, verdict: "FALSE", action: "BLOCK", rationale: "Actual margin ~30.8% based on filed data.",
        agents: { NumericVerifier: { pos: "SHORT", conf: 0.87, summary: "Calculated margin from filing: 30.8%.", findings: [{ type: "CONTRADICTION", text: "Revenue $1.84B, COGS $1.274B → margin ~30.8%.", source: "SEC EDGAR · 10-Q", rel: 0.94 }] }, RetrieverAgent: { pos: "SHORT", conf: 0.82, summary: "Analysts cite ~30-31%.", findings: [{ type: "CONTRADICTION", text: "Analyst consensus: 30-31% operating margin.", source: "Actian VectorAI · Analyst Index", rel: 0.88 }] }, ConsistencyBot: { pos: "SHORT", conf: 0.90, summary: "Depends on fabricated revenue. Unreliable.", findings: [{ type: "INCONSISTENCY", text: "If CLM-001 is false, margin calculation collapses.", source: "Dependency analysis", rel: 0.95 }] } } },
      { id: "CLM-003", text: "$2B stock buyback announced", type: "EVENT", severity: "HIGH", bad: true, highlight: "$2 billion stock buyback", riskScore: 0.05, verdict: "FALSE", action: "BLOCK", rationale: "No buyback in any filing or press release. Fabricated.",
        agents: { NumericVerifier: { pos: "SHORT", conf: 0.95, summary: "No 8-K or press release mentions buyback.", findings: [{ type: "NOT_FOUND", text: "No 8-K, PR, or board resolution in 120 days.", source: "SEC 8-K + PR scan", rel: 0.96 }] }, RetrieverAgent: { pos: "SHORT", conf: 0.91, summary: "Zero matching documents.", findings: [{ type: "NOT_FOUND", text: "No 'Acme + buyback' docs in 2024.", source: "Actian VectorAI", rel: 0.93 }] }, ConsistencyBot: { pos: "SHORT", conf: 0.80, summary: "Standalone fabrication.", findings: [{ type: "FLAG", text: "Event has no dependency on other claims.", source: "Dependency analysis", rel: 0.78 }] } } },
      { id: "CLM-004", text: "Headquartered in San Francisco", type: "ENTITY", severity: "LOW", bad: false, highlight: "San Francisco", riskScore: 0.94, verdict: "TRUE", action: "ALLOW", rationale: "Confirmed across multiple sources.",
        agents: { NumericVerifier: { pos: "LONG", conf: 0.98, summary: "SEC filing confirms SF HQ.", findings: [{ type: "CONFIRMED", text: "10-K: 100 Market St, San Francisco.", source: "SEC EDGAR · 10-K", rel: 0.99 }] }, RetrieverAgent: { pos: "LONG", conf: 0.97, summary: "Multiple sources confirm.", findings: [{ type: "SUPPORTS", text: "Website, LinkedIn, Crunchbase all list SF.", source: "Actian VectorAI · Entity Index", rel: 0.98 }] }, ConsistencyBot: { pos: "LONG", conf: 0.95, summary: "Consistent.", findings: [{ type: "CONSISTENT", text: "No contradictions.", source: "Consistency check", rel: 0.96 }] } } },
    ],
    impact: "Without Axiom, the investment committee would have approved a $50M allocation on fabricated data. Axiom blocked the output — decision integrity preserved, audit trail complete.",
    settlement: { oracle: "Sphinx", confidence: 0.94, summary: "3 of 4 claims FALSE. Revenue, margin, and buyback fabricated. Only HQ verified.", evidence: { supporting: 2, contradicting: 10, neutral: 1 }, recommendation: "Block output. Rewrite with verified figures." },
  },
  finance_true: {
    id: "finance_true", label: "Finance · Verified", icon: "📈", color: C.green,
    tagline: "AI reports accurate NVIDIA data. Axiom verifies in 11 seconds.",
    domain: "FINANCE", company: "Apex Capital", companyDesc: "Quantitative hedge fund · $800M AUM",
    analyst: "James Park, PM",
    context: "James needs verified NVIDIA data for position sizing.",
    prompt: "What was NVIDIA's Q4 FY2024 revenue and data center performance?",
    response: `NVIDIA reported Q4 FY2024 revenue of $22.1 billion, beating expectations of $20.4 billion. Data center revenue increased 409% year-over-year to $18.4 billion. Gaming revenue was $2.9 billion. NVIDIA is the largest semiconductor company by market cap.`,
    claims: [
      { id: "CLM-010", text: "Q4 revenue of $22.1 billion", type: "NUMERIC", severity: "HIGH", bad: false, highlight: "$22.1 billion", riskScore: 0.93, verdict: "TRUE", action: "ALLOW", rationale: "Confirmed against SEC 10-K.",
        agents: { NumericVerifier: { pos: "LONG", conf: 0.96, summary: "$22.103B in 10-K.", findings: [{ type: "CONFIRMED", text: "SEC 10-K: $22.103B. Matches.", source: "SEC EDGAR · NVIDIA 10-K", rel: 0.99 }] }, RetrieverAgent: { pos: "LONG", conf: 0.93, summary: "7 sources confirm.", findings: [{ type: "SUPPORTS", text: "Reuters, Bloomberg, CNBC, IR release all confirm.", source: "Actian VectorAI · News", rel: 0.97 }] }, ConsistencyBot: { pos: "LONG", conf: 0.91, summary: "Segments sum correctly.", findings: [{ type: "CONSISTENT", text: "DC + Gaming + others ≈ $22.1B.", source: "Arithmetic", rel: 0.95 }] } } },
      { id: "CLM-011", text: "Data center revenue +409% YoY", type: "NUMERIC", severity: "HIGH", bad: false, highlight: "409% year-over-year", riskScore: 0.91, verdict: "TRUE", action: "ALLOW", rationale: "Consistent with FY2023 DC of $3.6B.",
        agents: { NumericVerifier: { pos: "LONG", conf: 0.94, summary: "$3.6B → $18.4B = ~411%.", findings: [{ type: "CONFIRMED", text: "FY2023 DC $3.6B → FY2024 $18.4B. Growth ~411%.", source: "SEC EDGAR", rel: 0.96 }] }, RetrieverAgent: { pos: "LONG", conf: 0.92, summary: "Widely reported.", findings: [{ type: "SUPPORTS", text: "Press release: '409% YoY DC growth.'", source: "NVIDIA IR", rel: 0.98 }] }, ConsistencyBot: { pos: "LONG", conf: 0.90, summary: "Aligns with absolutes.", findings: [{ type: "CONSISTENT", text: "Rate matches absolute figures.", source: "Cross-check", rel: 0.93 }] } } },
      { id: "CLM-012", text: "Gaming revenue $2.9 billion", type: "NUMERIC", severity: "MED", bad: false, highlight: "$2.9 billion", riskScore: 0.92, verdict: "TRUE", action: "ALLOW", rationale: "Matches SEC filing ($2.865B rounds to $2.9B).",
        agents: { NumericVerifier: { pos: "LONG", conf: 0.95, summary: "10-K: $2.865B.", findings: [{ type: "CONFIRMED", text: "Gaming $2.865B rounds to $2.9B.", source: "SEC EDGAR", rel: 0.97 }] }, RetrieverAgent: { pos: "LONG", conf: 0.91, summary: "Confirmed.", findings: [{ type: "SUPPORTS", text: "Analysts cite $2.9B gaming.", source: "Actian VectorAI", rel: 0.90 }] }, ConsistencyBot: { pos: "LONG", conf: 0.93, summary: "Sums to total.", findings: [{ type: "CONSISTENT", text: "Part of segment validation.", source: "Arithmetic", rel: 0.94 }] } } },
    ],
    impact: "All 3 claims verified in 11 seconds. Compliance-ready: every figure traceable to SEC filings. No manual fact-check before the trade.",
    settlement: { oracle: "Sphinx", confidence: 0.97, summary: "All claims TRUE. Confirmed across SEC filings, press releases, and 12 corroborating sources.", evidence: { supporting: 12, contradicting: 0, neutral: 0 }, recommendation: "Allow output." },
  },
  legal_false: {
    id: "legal_false", label: "Legal · Fake Case Law", icon: "⚖️", color: C.purple,
    tagline: "AI invents court rulings. Axiom prevents Rule 11 sanctions.",
    domain: "LEGAL", company: "Whitfield & Associates LLP", companyDesc: "Litigation firm · Healthcare & IP",
    analyst: "David Whitfield, Managing Partner",
    context: "David is preparing a motion to dismiss in a malpractice case and needs supporting precedent.",
    prompt: "Find case law supporting hospital peer review committee privilege from discovery.",
    response: `In Harrison v. Mercy General Hospital (2019), the Seventh Circuit held peer review findings absolutely privileged under the HCQIA. The court stated 'without robust confidentiality protections, physicians will refuse to participate.' In Thompson v. Regional Medical Center (2021), the privilege was extended to electronic communications. The privilege has been consistently upheld across circuits.`,
    claims: [
      { id: "CLM-020", text: "Harrison v. Mercy General Hospital (2019) — 7th Circuit", type: "CASE_LAW", severity: "CRITICAL", bad: true, highlight: "Harrison v. Mercy General Hospital (2019)", riskScore: 0.04, verdict: "FALSE", action: "BLOCK", rationale: "This case does not exist. Entirely fabricated citation.",
        agents: { NumericVerifier: { pos: "SHORT", conf: 0.94, summary: "No such case in any 7th Circuit opinion.", findings: [{ type: "NOT_FOUND", text: "No 'Harrison v. Mercy General Hospital' in any year.", source: "Federal court DB · 7th Circuit", rel: 0.98 }, { type: "FLAG", text: "Quoted language appears in zero indexed opinions.", source: "Full-text opinion search", rel: 0.91 }] }, RetrieverAgent: { pos: "SHORT", conf: 0.90, summary: "Phantom citation pattern match.", findings: [{ type: "PATTERN", text: "Plausible names + recent year + real court = nonexistent case.", source: "Actian VectorAI · Hallucination Archive", rel: 0.89 }, { type: "CONTRADICTION", text: "Real leading case: Mem'l Hosp. v. Shadur (7th Cir. 1981).", source: "Actian VectorAI · Case Law", rel: 0.93 }] }, ConsistencyBot: { pos: "SHORT", conf: 0.87, summary: "HCQIA provides qualified immunity, not absolute privilege.", findings: [{ type: "INCONSISTENCY", text: "42 U.S.C. § 11111 = qualified immunity, not absolute privilege.", source: "Statutory analysis", rel: 0.92 }] } } },
      { id: "CLM-021", text: "Thompson v. Regional Medical Center (2021)", type: "CASE_LAW", severity: "CRITICAL", bad: true, highlight: "Thompson v. Regional Medical Center (2021)", riskScore: 0.03, verdict: "FALSE", action: "BLOCK", rationale: "Also fabricated. Second phantom citation.",
        agents: { NumericVerifier: { pos: "SHORT", conf: 0.96, summary: "No such case exists.", findings: [{ type: "NOT_FOUND", text: "Not in any federal or state reporter.", source: "Court databases", rel: 0.97 }] }, RetrieverAgent: { pos: "SHORT", conf: 0.92, summary: "Two phantom cites in one response.", findings: [{ type: "PATTERN", text: "Two fabricated cites = strong hallucination signal.", source: "Actian VectorAI · Pattern", rel: 0.91 }] }, ConsistencyBot: { pos: "SHORT", conf: 0.89, summary: "Claims to extend Harrison — which also doesn't exist.", findings: [{ type: "INCONSISTENCY", text: "Thompson 'extends' Harrison. Both fabricated. Entire chain is fictional.", source: "Dependency analysis", rel: 0.94 }] } } },
      { id: "CLM-022", text: "Privilege consistently upheld across circuits", type: "LEGAL", severity: "MED", bad: true, highlight: "consistently upheld across federal circuits", riskScore: 0.18, verdict: "FALSE", action: "REWRITE", rationale: "Overly broad. Several circuits have significant exceptions.",
        agents: { NumericVerifier: { pos: "SHORT", conf: 0.72, summary: "Too broad.", findings: [{ type: "FLAG", text: "'Consistently across all circuits' overstates consensus.", source: "Circuit analysis", rel: 0.80 }] }, RetrieverAgent: { pos: "SHORT", conf: 0.78, summary: "Exceptions exist.", findings: [{ type: "CONTRADICTION", text: "9th Cir. (Agster v. Maricopa) + 3rd Cir. narrower test.", source: "Actian VectorAI · Case Law", rel: 0.85 }] }, ConsistencyBot: { pos: "SHORT", conf: 0.70, summary: "Sweeping generalization.", findings: [{ type: "FLAG", text: "Universal circuit claims are almost always overstatements.", source: "Legal reasoning", rel: 0.75 }] } } },
    ],
    impact: "Without Axiom, the firm would have filed fabricated citations — Rule 11 sanctions, malpractice exposure, reputational risk. Axiom blocked; matter escalated to human counsel with full audit trail.",
    settlement: { oracle: "Sphinx", confidence: 0.96, summary: "2 citations completely fabricated. Third is an overstatement. No cited authority exists.", evidence: { supporting: 0, contradicting: 9, neutral: 0 }, recommendation: "Block entirely. Direct to Westlaw/LexisNexis." },
  },
};
const SL_LIST = ["finance_false", "finance_true", "legal_false"];

function lerp(a, b, t) { return a + (b - a) * t; }
function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function Tag({ color, children }) { return <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color, background: color + "14", border: `1px solid ${color}25`, padding: "3px 8px", borderRadius: 4, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{children}</span>; }
function SL({ children }) { return <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, letterSpacing: "0.14em", marginBottom: 8, marginTop: 24 }}>{children}</div>; }
function RiskBar({ score, small }) { const col = score > 0.7 ? C.green : score > 0.4 ? C.amber : C.red; return <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ flex: 1, height: small ? 4 : 6, background: C.border, borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${score * 100}%`, background: col, borderRadius: 3, transition: "width 0.6s ease" }} /></div><span style={{ fontFamily: MONO, fontSize: small ? 10 : 12, fontWeight: 700, color: col, minWidth: 36 }}>{(score * 100).toFixed(0)}%</span></div>; }
function FC({ f }) { const tc = { CONTRADICTION: C.red, CONFIRMED: C.green, SUPPORTS: C.green, FLAG: C.amber, INCONSISTENCY: C.red, CONSISTENT: C.green, PATTERN: C.purple, NOT_FOUND: C.red }; return <div style={{ padding: 14, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 8 }}><div style={{ display: "flex", gap: 6, marginBottom: 8 }}><Tag color={tc[f.type] || C.muted}>{f.type}</Tag><span style={{ fontFamily: MONO, fontSize: 9, color: C.darkest, marginLeft: "auto" }}>{(f.rel * 100).toFixed(0)}%</span></div><div style={{ fontFamily: SANS, fontSize: 12, color: C.text, lineHeight: 1.75, marginBottom: 8 }}>{f.text}</div><div style={{ fontFamily: MONO, fontSize: 9, color: C.dim }}>📄 {f.source}</div></div>; }

function Drawer({ open, onClose, title, accent, children }) {
  if (!open) return null;
  return <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={onClose}>
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} />
    <div onClick={e => e.stopPropagation()} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "min(560px, 92vw)", background: C.surface, borderLeft: `1px solid ${C.border}`, animation: "slideRight 0.25s ease", overflowY: "auto" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: C.surface, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{accent && <div style={{ width: 3, height: 16, background: accent, borderRadius: 2 }} />}<span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: C.white }}>{title}</span></div>
        <button onClick={onClose} style={{ fontFamily: MONO, fontSize: 18, color: C.dim, background: "none", border: "none", cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  </div>;
}

function Btn({ children, onClick, color = C.accent, filled, s }) {
  const [h, setH] = useState(false);
  return <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", padding: "12px 28px", borderRadius: 8, cursor: "pointer", transition: "all 0.2s", background: filled ? color : h ? color + "18" : "transparent", color: filled ? C.bg : color, border: filled ? "none" : `1px solid ${color}35`, transform: h ? "translateY(-1px)" : "none", ...s }}>{children}</button>;
}

function StepBar({ current }) {
  const idx = DEMO_STEPS.findIndex(s => s.key === current);
  if (idx === -1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 16 }}>
      {DEMO_STEPS.map((step, i) => {
        const done = i < idx; const active = i === idx;
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 11, fontWeight: 700, background: active ? C.accent : done ? C.green : C.surface, color: active || done ? C.bg : C.dim, border: `1px solid ${active ? C.accent : done ? C.green : C.border}` }}>{done ? "✓" : step.short}</div>
            {i < DEMO_STEPS.length - 1 && <div style={{ width: 24, height: 2, background: i < idx ? C.green : C.border, borderRadius: 1 }} />}
          </div>
        );
      })}
      <span style={{ fontFamily: MONO, fontSize: 9, color: C.dim, marginLeft: 10, letterSpacing: "0.08em" }}>{DEMO_STEPS[idx].label.toUpperCase()}</span>
    </div>
  );
}

// ═══════════════════════════════════════
export default function AxiomV7() {
  const [screen, setScreen] = useState("LANDING");
  const [slideIdx, setSlideIdx] = useState(0);
  const [sid, setSid] = useState(null);
  const [prices, setPrices] = useState([]);
  const [pills, setPills] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [showClaims, setShowClaims] = useState(false);
  const [showAdv, setShowAdv] = useState(false);
  const ref = useRef(null);

  const S = sid ? SCENARIOS[sid] : null;
  const last = prices.length > 0 ? prices[prices.length - 1].p : 0.5;
  const pc = screen === "VERDICT" ? (S?.claims[0]?.bad ? C.red : C.green) : last > 0.5 ? C.green : last < 0.3 ? C.red : C.amber;

  const cleanup = useCallback(() => { if (ref.current) clearInterval(ref.current); }, []);
  useEffect(() => () => cleanup(), [cleanup]);
  const reset = useCallback(() => { cleanup(); setPrices([]); setPills([]); setDrawer(null); setShowClaims(false); setShowAdv(false); }, [cleanup]);

  const select = (id) => { reset(); setSid(id); setScreen("INTRO"); };
  const goHome = () => { reset(); setSid(null); setSlideIdx(0); setScreen("LANDING"); };

  const startVerify = useCallback(() => {
    if (!S) return;
    setScreen("VERIFYING");
    const c0 = S.claims[0]; let t = 0; const total = 20, settle = 16;
    ref.current = setInterval(() => {
      t++; if (t > total) { clearInterval(ref.current); return; }
      const p = Math.max(0.02, Math.min(0.98, lerp(c0.bad ? 0.72 : 0.67, c0.riskScore, ease(Math.min(t / settle, 1))) + (Math.random() - 0.5) * 0.02));
      setPrices(prev => [...prev, { t, p }]);
      if (t % 2 === 0 && t < settle) {
        const n = AN[Math.floor(Math.random() * 3)]; const ag = AGENTS[n];
        const side = c0.bad ? (Math.random() > 0.15 ? "SHORT" : "LONG") : (Math.random() > 0.15 ? "LONG" : "SHORT");
        setPills(prev => [...prev, { id: `${t}${Math.random()}`, name: n, icon: ag.icon, color: ag.color, side, p }]);
      }
      if (t === settle + 2) setScreen("VERDICT");
    }, 220);
  }, [S]);

  const renderResp = () => {
    if (!S || !showClaims) return <span>{S?.response}</span>;
    let text = S.response; const parts = []; let idx = 0;
    S.claims.filter(c => c.bad).forEach(c => { const i = text.indexOf(c.highlight, idx); if (i === -1) return; if (i > idx) parts.push({ t: text.slice(idx, i) }); parts.push({ t: c.highlight, hl: true }); idx = i + c.highlight.length; });
    if (idx < text.length) parts.push({ t: text.slice(idx) });
    return parts.map((p, i) => p.hl ? <span key={i} style={{ color: C.red, borderBottom: `2px solid ${C.red}`, paddingBottom: 1 }}>{p.t}</span> : <span key={i}>{p.t}</span>);
  };

  const agentDraw = (name, claim) => {
    const t = AGENTS[name]; const f = claim?.agents?.[name]; if (!t || !f) return null;
    return <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}><span style={{ fontSize: 28 }}>{t.icon}</span><div><div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: t.color }}>{t.name}</div><div style={{ fontSize: 11, color: C.muted }}>{t.subtitle}</div></div></div>
      <SL>ABOUT</SL><div style={{ fontSize: 12, color: C.muted, lineHeight: 1.85, padding: "12px 14px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>{t.desc}</div>
      <SL>METHODOLOGY</SL><div style={{ padding: "12px 14px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>{t.methodology.map((s, i) => <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < t.methodology.length - 1 ? `1px solid ${C.border}` : "none" }}><span style={{ fontFamily: MONO, fontSize: 10, color: C.darkest, minWidth: 20 }}>{i + 1}.</span><span style={{ fontSize: 12, color: C.muted, lineHeight: 1.65 }}>{s}</span></div>)}</div>
      <SL>TOOLS</SL><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{t.tools.map((x, i) => <Tag key={i} color={t.color}>{x}</Tag>)}</div>
      <SL>POSITION</SL><div style={{ display: "flex", gap: 14, padding: 12, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}><div><div style={{ fontFamily: MONO, fontSize: 8, color: C.dim }}>SIDE</div><div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800, color: f.pos === "SHORT" ? C.red : C.green }}>{f.pos}</div></div><div><div style={{ fontFamily: MONO, fontSize: 8, color: C.dim }}>CONF</div><div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800, color: C.white }}>{(f.conf * 100).toFixed(0)}%</div></div></div>
      <SL>SUMMARY</SL><div style={{ fontSize: 12, color: C.white, lineHeight: 1.8, padding: 12, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>{f.summary}</div>
      <SL>EVIDENCE ({f.findings.length})</SL>{f.findings.map((x, i) => <FC key={i} f={x} />)}
    </>;
  };

  const claimDraw = (idx) => {
    if (!S) return null; const c = S.claims[idx]; const vc = c.bad ? C.red : C.green;
    return <>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}><Tag color={vc}>{c.verdict}</Tag><Tag color={c.action === "ALLOW" ? C.green : c.action === "REWRITE" ? C.amber : C.red}>{c.action}</Tag><Tag color={c.severity === "CRITICAL" ? C.red : c.severity === "HIGH" ? C.amber : C.green}>{c.severity}</Tag></div>
      <div style={{ fontSize: 16, fontWeight: 600, color: C.white, lineHeight: 1.6, marginBottom: 16 }}>"{c.text}"</div>
      <SL>RISK SCORE</SL><RiskBar score={c.riskScore} />
      <SL>RATIONALE</SL><div style={{ fontSize: 12, color: C.text, lineHeight: 1.85, padding: 14, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>{c.rationale}</div>
      <SL>AGENT ASSESSMENTS</SL>
      {AN.map(n => { const ag = AGENTS[n]; const f = c.agents[n]; return <div key={n} onClick={() => setDrawer({ type: "agent", name: n, claimIdx: idx })} style={{ padding: 12, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 6, cursor: "pointer", transition: "border-color 0.2s" }} onMouseEnter={e => e.currentTarget.style.borderColor = ag.color + "50"} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><span>{ag.icon}</span><span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: ag.color }}>{n}</span><Tag color={f.pos === "SHORT" ? C.red : C.green}>{f.pos}</Tag><span style={{ fontFamily: MONO, fontSize: 9, color: C.muted, marginLeft: "auto" }}>{(f.conf * 100).toFixed(0)}%</span><span style={{ color: C.darkest }}>→</span></div>
        <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>{f.summary}</div>
      </div>; })}
    </>;
  };

  const settleDraw = () => {
    if (!S) return null; const r = S.settlement; const hasBad = S.claims.some(c => c.bad); const vc = hasBad ? C.red : C.green;
    return <>
      <SL>OVERALL</SL><div style={{ textAlign: "center", padding: 20, borderRadius: 10, background: vc + "10", border: `1px solid ${vc}30`, marginBottom: 8 }}><div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 800, color: vc }}>{hasBad ? "ISSUES FOUND" : "ALL VERIFIED"}</div><div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginTop: 4 }}>{r.oracle} · {(r.confidence * 100).toFixed(0)}% confidence</div></div>
      <SL>CLAIM RESULTS</SL>{S.claims.map((c, i) => <div key={c.id} onClick={() => setDrawer({ type: "claim", idx: i })} style={{ padding: 12, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 6, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.borderColor = (c.bad ? C.red : C.green) + "40"} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}><div style={{ display: "flex", gap: 6, marginBottom: 4 }}><span style={{ fontFamily: MONO, fontSize: 9, color: C.darkest }}>{c.id}</span><Tag color={c.bad ? C.red : C.green}>{c.verdict}</Tag><Tag color={c.action === "ALLOW" ? C.green : c.action === "REWRITE" ? C.amber : C.red}>{c.action}</Tag><span style={{ marginLeft: "auto", color: C.darkest }}>→</span></div><div style={{ fontSize: 11, color: C.text }}>{c.text}</div></div>)}
      <SL>REASONING</SL><div style={{ fontSize: 12, color: C.text, lineHeight: 1.85, padding: 14, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>{r.summary}</div>
      <SL>EVIDENCE</SL><div style={{ display: "flex", gap: 8 }}>{[{ l: "SUPPORTING", v: r.evidence.supporting, c: C.green }, { l: "CONTRADICTING", v: r.evidence.contradicting, c: C.red }, { l: "NEUTRAL", v: r.evidence.neutral, c: C.muted }].map(e => <div key={e.l} style={{ flex: 1, padding: 12, background: C.bg, borderRadius: 6, border: `1px solid ${C.border}`, textAlign: "center" }}><div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800, color: e.c }}>{e.v}</div><div style={{ fontFamily: MONO, fontSize: 7, color: C.dim, marginTop: 2 }}>{e.l}</div></div>)}</div>
      <SL>RECOMMENDATION</SL><div style={{ fontSize: 12, color: C.muted, lineHeight: 1.85, padding: 14, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>{r.recommendation}</div>
      <SL>IMPACT</SL><div style={{ fontSize: 12, color: C.accent, lineHeight: 1.85, padding: 14, background: C.accentDim, borderRadius: 8, border: `1px solid ${C.accentBorder}` }}>{S.impact}</div>
    </>;
  };

  const slide = SLIDES[slideIdx];

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: C.bg, fontFamily: SANS, color: C.white, display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
        @keyframes stampIn{0%{opacity:0;transform:scale(2)}50%{opacity:1;transform:scale(.94)}100%{transform:scale(1)}}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 24px var(--gc,transparent)}50%{box-shadow:0 0 48px var(--gc,transparent)}}
        @keyframes slideRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes glow{0%,100%{filter:drop-shadow(0 0 12px currentColor);opacity:1}50%{filter:drop-shadow(0 0 28px currentColor);opacity:.95}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes borderGlow{0%,100%{box-shadow:0 0 8px ${C.accent}40}50%{box-shadow:0 0 20px ${C.accent}70, 0 0 30px ${C.accent}30}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
      `}</style>

      {/* ══════ LANDING — flashy hero + use case explainer ══════ */}
      {screen === "LANDING" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: `linear-gradient(${C.accent} 1px, transparent 1px), linear-gradient(90deg, ${C.accent} 1px, transparent 1px)`, backgroundSize: "48px 48px", animation: "float 8s ease-in-out infinite" }} />
          <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 800, height: 800, borderRadius: "50%", background: `radial-gradient(circle, ${C.accent}12 0%, ${C.cyan}06 40%, transparent 65%)`, backgroundSize: "200% 200%", animation: "gradientShift 12s ease infinite" }} />
          <div style={{ position: "absolute", bottom: "20%", right: "10%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${C.blue}08 0%, transparent 60%)`, filter: "blur(40px)" }} />

          <div style={{ position: "relative", textAlign: "center", animation: "fadeUp 0.8s ease" }}>
            <div style={{ fontFamily: MONO, fontSize: 80, fontWeight: 800, letterSpacing: "0.14em", lineHeight: 1, marginBottom: 12, animation: "fadeUp 0.8s ease 0.2s both", background: `linear-gradient(135deg, ${C.accent} 0%, ${C.cyan} 50%, ${C.accent} 100%)`, backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", textShadow: "none", filter: "drop-shadow(0 0 24px rgba(226,168,85,0.4))" }}>
              AXIOM
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.white, marginBottom: 10, maxWidth: 500, margin: "0 auto", animation: "fadeUp 0.8s ease 0.3s both", textShadow: `0 0 30px ${C.accent}30` }}>
              AI you can trust for high-stakes decisions.
            </div>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 20, animation: "fadeUp 0.8s ease 0.4s both" }}>
              Enterprise factuality guardrails · Verify before any output reaches your team
            </div>
            <div style={{ maxWidth: 520, margin: "0 auto 28px", padding: "16px 20px", background: "linear-gradient(135deg, rgba(226,168,85,0.08) 0%, rgba(34,211,238,0.06) 100%)", border: `1px solid ${C.accent}30`, borderRadius: 12, animation: "fadeUp 0.8s ease 0.45s both, borderGlow 3s ease-in-out infinite" }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.accent, letterSpacing: "0.15em", marginBottom: 8 }}>THE USE CASE</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.75 }}>
                Your team asks AI for a summary or an answer. <span style={{ color: C.accent }}>Before that answer reaches anyone</span>, Axiom pulls out every factual claim, runs it through 3 verifiers (SEC/court data, vector DB, logic), and <span style={{ color: C.green }}>allows</span>, <span style={{ color: C.amber }}>rewrites</span>, or <span style={{ color: C.red }}>blocks</span> — with a full audit trail. So you can use AI for big decisions without getting burned.
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", animation: "fadeUp 0.8s ease 0.5s both" }}>
              <button onClick={() => { setPrices([]); setPills([]); setDrawer(null); setShowClaims(false); setShowAdv(false); setSid("finance_false"); setScreen("INTRO"); }} style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", padding: "14px 32px", borderRadius: 10, cursor: "pointer", background: `linear-gradient(135deg, ${C.accent} 0%, #c9943a 100%)`, color: C.bg, border: "none", boxShadow: `0 0 24px ${C.accent}50, 0 4px 14px rgba(0,0,0,0.3)`, transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = `0 0 36px ${C.accent}70, 0 6px 20px rgba(0,0,0,0.35)`; }} onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 0 24px ${C.accent}50, 0 4px 14px rgba(0,0,0,0.3)`; }}>SEE DEMO ▸</button>
              <Btn onClick={() => setScreen("SLIDESHOW")} color={C.accent}>THE RISK</Btn>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 28, flexWrap: "wrap", animation: "fadeUp 0.8s ease 0.7s both" }}>
              {["Actian VectorAI", "Sphinx", "Databricks", "SafetyKit"].map(t => (
                <span key={t} style={{ fontFamily: MONO, fontSize: 8, color: C.darkest, padding: "5px 10px", border: `1px solid ${C.border}`, borderRadius: 6, letterSpacing: "0.06em", background: C.surface }}>{t}</span>
              ))}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.darkest, letterSpacing: "0.12em", marginTop: 20, animation: "fadeUp 0.8s ease 0.8s both" }}>
              FOR ENTERPRISES · HIGH-RISK AI · HACKLYTICS 2026
            </div>
          </div>
        </div>
      )}

      {/* ══════ SLIDESHOW — 3 punchy problem slides ══════ */}
      {screen === "SLIDESHOW" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, position: "relative" }}>
          <div key={slideIdx} style={{ maxWidth: 500, textAlign: "center", animation: "fadeUp 0.4s ease" }}>
            {slide.year && <div style={{ fontFamily: MONO, fontSize: 9, color: C.darkest, letterSpacing: "0.18em", marginBottom: 12 }}>{slide.year}</div>}
            <div style={{ fontSize: 28, fontWeight: 800, color: slide.color, lineHeight: 1.35, marginBottom: 16, textShadow: slide.color !== C.white ? `0 0 20px ${slide.color}50` : "none" }}>{slide.title}</div>
            <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.75 }}>{slide.body}</div>
          </div>
          <div style={{ position: "absolute", bottom: 50, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {SLIDES.map((_, i) => (
                <div key={i} onClick={() => setSlideIdx(i)} style={{ width: i === slideIdx ? 22 : 8, height: 8, borderRadius: 4, cursor: "pointer", transition: "all 0.3s", background: i === slideIdx ? C.accent : C.border }} />
              ))}
            </div>
            {slideIdx < SLIDES.length - 1 ? (
              <Btn onClick={() => setSlideIdx(slideIdx + 1)} color={C.accent}>NEXT ▸</Btn>
            ) : (
              <Btn onClick={() => setScreen("SCENARIOS")} color={C.accent} filled>SEE ENTERPRISE DEMO ▸</Btn>
            )}
            <button onClick={() => setScreen("SCENARIOS")} style={{ fontFamily: MONO, fontSize: 9, color: C.darkest, background: "none", border: "none", cursor: "pointer" }}>Skip →</button>
          </div>
        </div>
      )}

      {/* ══════ SCENARIOS — enterprise high-stakes ══════ */}
      {screen === "SCENARIOS" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, animation: "fadeUp 0.5s ease" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: C.accent, letterSpacing: "0.25em", marginBottom: 8 }}>HIGH-STAKES USE CASES</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 8 }}>Enterprise scenarios · Audit-ready verdicts</div>
          <div style={{ fontSize: 12, color: C.dim, marginBottom: 24 }}>Investment committees, legal, compliance — verify before the decision</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
            {SL_LIST.map(id => {
              const s = SCENARIOS[id];
              const outcome = s.claims.some(c => c.bad) ? (id === "legal_false" ? "Prevented sanctions" : "Blocked $50M mistake") : "Verified in 11s";
              return (
                <div key={id} onClick={() => select(id)} style={{ width: 220, padding: "22px 18px", background: `linear-gradient(145deg, ${C.surface} 0%, ${C.surfaceAlt} 100%)`, border: `2px solid ${C.border}`, borderRadius: 16, cursor: "pointer", textAlign: "left", transition: "all 0.3s ease", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.transform = "translateY(-6px) scale(1.02)"; e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,0.3), 0 0 30px ${s.color}40`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.2)"; }}>
                  <div style={{ fontSize: 36, marginBottom: 10, filter: `drop-shadow(0 0 8px ${s.color}60)` }}>{s.icon}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: s.color, marginBottom: 4, textShadow: `0 0 12px ${s.color}50` }}>{s.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 6 }}>{outcome}</div>
                  <div style={{ fontSize: 10, color: C.dim, lineHeight: 1.5 }}>{s.tagline}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
            {["Actian VectorAI", "Sphinx", "Databricks", "SafetyKit"].map(t => (
              <span key={t} style={{ fontFamily: MONO, fontSize: 8, color: C.darkest, padding: "4px 8px", border: `1px solid ${C.border}`, borderRadius: 4, letterSpacing: "0.06em" }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* ══════ INTRO — one line + go ══════ */}
      {screen === "INTRO" && S && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, animation: "fadeUp 0.5s ease" }}>
          <div style={{ maxWidth: 580, width: "100%" }}>
            <StepBar current="INTRO" />
            <div style={{ padding: "12px 16px", background: `${C.accent}12`, border: `1px solid ${C.accent}30`, borderRadius: 10, marginBottom: 20 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.accent, letterSpacing: "0.1em", marginBottom: 6 }}>USE CASE</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.65 }}>AI gives an answer → Axiom extracts every claim → 3 verifiers check against real data (SEC, Vector DB, Sphinx) → we <span style={{ color: C.green }}>allow</span>, <span style={{ color: C.amber }}>rewrite</span>, or <span style={{ color: C.red }}>block</span> before it reaches your team.</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 12 }}><Tag color={S.color}>{S.domain}</Tag></div>
              <div style={{ fontSize: 15, color: C.text, marginBottom: 20, lineHeight: 1.6 }}>{S.context}</div>
              <Btn onClick={() => setScreen("PROMPT")} color={C.accent} filled>RUN DEMO ▸</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ══════ PROMPT ══════ */}
      {screen === "PROMPT" && S && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, animation: "fadeUp 0.5s ease" }}>
          <div style={{ maxWidth: 600, width: "100%" }}>
            <StepBar current="PROMPT" />
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, letterSpacing: "0.15em", marginBottom: 10 }}>PROMPT</div>
            <div style={{ padding: "18px 22px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, color: C.text, lineHeight: 1.7, fontStyle: "italic", borderLeft: `3px solid ${C.accent}`, marginBottom: 20 }}>"{S.prompt}"</div>
            <div style={{ textAlign: "center" }}><Btn onClick={() => setScreen("RESPONSE")} color={C.accent} filled>AI RESPONSE ▸</Btn></div>
          </div>
        </div>
      )}

      {/* ══════ RESPONSE ══════ */}
      {screen === "RESPONSE" && S && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, animation: "fadeUp 0.5s ease" }}>
          <div style={{ maxWidth: 700, width: "100%" }}>
            <StepBar current={showClaims ? "RESPONSE" : "RESPONSE"} />
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, letterSpacing: "0.15em", marginBottom: 10 }}>AI SAID THIS</div>
            <div style={{ padding: 22, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, color: C.text, lineHeight: 1.85, marginBottom: 16 }}>{renderResp()}</div>
            {!showClaims ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, color: C.muted, marginBottom: 14 }}>In high-risk workflows you need more than trust. <span style={{ color: C.accent, fontWeight: 600 }}>Axiom</span> verifies every claim against authoritative sources before it reaches your team — audit-ready.</div>
                <Btn onClick={() => setShowClaims(true)} color={S.claims.some(c => c.bad) ? C.red : C.green} filled>VERIFY WITH AXIOM ▸</Btn>
              </div>
            ) : (
              <div style={{ animation: "fadeUp 0.5s ease" }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, letterSpacing: "0.1em", marginBottom: 8 }}>{S.claims.length} CLAIMS</div>
                {S.claims.map(c => <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 4, flexWrap: "wrap" }}><span style={{ fontFamily: MONO, fontSize: 9, color: C.darkest }}>{c.id}</span><Tag color={c.severity === "CRITICAL" ? C.red : c.severity === "HIGH" ? C.amber : C.green}>{c.severity}</Tag><span style={{ fontSize: 11, color: C.text, flex: 1, minWidth: 140 }}>{c.text}</span></div>)}
                <div style={{ marginTop: 16, padding: "14px 16px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: C.accent, letterSpacing: "0.1em", marginBottom: 10 }}>WHERE THE VERIFIERS RUN</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {AN.map(n => {
                      const ag = AGENTS[n];
                      return (
                        <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.surface, border: `1px solid ${ag.color}30`, borderRadius: 6 }}>
                          <span style={{ fontSize: 16, color: ag.color }}>{ag.icon}</span>
                          <div>
                            <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: ag.color }}>{n.replace("ConsistencyBot", "Consistency")}</div>
                            <div style={{ fontFamily: MONO, fontSize: 8, color: C.dim }}>← {ag.source}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <Btn onClick={startVerify} color={C.accent} filled>RUN VERIFICATION ▸</Btn>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════ VERIFYING — big score + 3 agents with sources ══════ */}
      {screen === "VERIFYING" && S && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 32px", animation: "fadeUp 0.4s ease" }}>
          <div style={{ width: "100%", maxWidth: 760 }}>
            <StepBar current="VERIFYING" />
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, letterSpacing: "0.12em", marginBottom: 4 }}>LIVE VERIFICATION</div>
              <div style={{ fontSize: 12, color: C.muted }}>"{S.claims[0].text.slice(0, 50)}…"</div>
            </div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.dim, letterSpacing: "0.1em", marginBottom: 4 }}>FACTUALITY SCORE</div>
              <div style={{ fontFamily: MONO, fontSize: 64, fontWeight: 800, color: pc, transition: "color 0.3s", textShadow: `0 0 40px ${pc}60, 0 0 80px ${pc}30`, lineHeight: 1, animation: "glow 2s ease-in-out infinite" }}>{(last * 100).toFixed(0)}<span style={{ fontSize: 24, color: C.dimmer }}>%</span></div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, letterSpacing: "0.1em", marginBottom: 10, textAlign: "center" }}>3 INDEPENDENT VERIFIERS · EACH QUERIES A DIFFERENT SOURCE</div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 12 }}>
              {AN.map((n, i) => {
                const ag = AGENTS[n];
                const targetConf = S.claims[0].agents[n].conf;
                const anim = Math.min(1, (prices.length / 8) * (1 + i * 0.2));
                const w = targetConf * anim * 100;
                return (
                  <div key={n} onClick={() => setDrawer({ type: "agent", name: n, claimIdx: 0 })} style={{ flex: 1, maxWidth: 200, padding: "16px 18px", background: `linear-gradient(180deg, ${C.surface} 0%, ${C.bg} 100%)`, border: `2px solid ${C.border}`, borderRadius: 12, textAlign: "center", transition: "all 0.25s", cursor: "pointer", boxShadow: `0 0 0 0 ${ag.color}00` }} onMouseEnter={e => { e.currentTarget.style.borderColor = ag.color; e.currentTarget.style.boxShadow = `0 0 24px ${ag.color}50, 0 0 40px ${ag.color}20`; }} onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}>
                    <div style={{ fontSize: 24, marginBottom: 6, filter: `drop-shadow(0 0 6px ${ag.color}80)` }}>{ag.icon}</div>
                    <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: ag.color }}>{n.replace("ConsistencyBot", "Consistency")}</div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: C.dim, marginTop: 2, marginBottom: 8 }}>← {ag.source}</div>
                    <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${w}%`, background: `linear-gradient(90deg, ${ag.color} 0%, ${ag.color}dd 100%)`, borderRadius: 4, transition: "width 0.5s ease", boxShadow: `0 0 10px ${ag.color}60` }} />
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: ag.color, marginTop: 6, fontWeight: 700 }}>{(targetConf * 100).toFixed(0)}%</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center", minHeight: 24 }}>
              {pills.slice(-5).map(a => <div key={a.id} style={{ fontFamily: MONO, fontSize: 9, padding: "4px 10px", borderRadius: 16, background: a.side === "SHORT" ? C.redBg : C.greenBg, border: `1px solid ${a.side === "SHORT" ? C.redBorder : C.greenBorder}`, color: a.side === "SHORT" ? C.red : C.green, animation: "slideIn 0.3s ease", whiteSpace: "nowrap" }}>{a.icon} {a.name} {a.side === "SHORT" ? "↓" : "↑"}</div>)}
            </div>
          </div>
        </div>
      )}

      {/* ══════ VERDICT — big stamp + impact + sponsors ══════ */}
      {screen === "VERDICT" && S && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 32px", overflow: "auto" }}>
          <div style={{ maxWidth: 640, width: "100%", paddingTop: 8 }}>
            <StepBar current="VERDICT" />
            <div style={{ textAlign: "center", marginBottom: 20, animation: "stampIn 0.6s ease" }}>
              <div onClick={() => setDrawer({ type: "settlement" })} style={{ display: "inline-block", padding: "20px 56px", borderRadius: 14, cursor: "pointer", background: S.claims.some(c => c.bad) ? `linear-gradient(135deg, ${C.red} 0%, #e85a6e 100%)` : `linear-gradient(135deg, ${C.green} 0%, #22c55d 100%)`, color: S.claims.some(c => c.bad) ? "#fff" : "#0a0a0a", fontFamily: MONO, fontSize: 20, fontWeight: 800, letterSpacing: "0.15em", boxShadow: S.claims.some(c => c.bad) ? `0 0 40px ${C.red}70, 0 0 80px ${C.red}30, 0 6px 24px rgba(0,0,0,0.4)` : `0 0 40px ${C.green}70, 0 0 80px ${C.green}30, 0 6px 24px rgba(0,0,0,0.4)`, transition: "all 0.2s", border: `2px solid ${S.claims.some(c => c.bad) ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.15)"}` }}
                onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.06)"; e.currentTarget.style.filter = "brightness(1.1)"; }} onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.filter = "none"; }}>
                {S.claims.some(c => c.bad) ? "■ OUTPUT BLOCKED" : "✓ OUTPUT ALLOWED"}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, marginTop: 6 }}>Settlement by <span style={{ color: C.accent }}>Sphinx</span> · aggregates 3 verifiers</div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.darkest, marginTop: 4, cursor: "pointer" }} onClick={() => setDrawer({ type: "settlement" })}>Full audit trail →</div>
            </div>
            <div style={{ padding: "14px 18px", background: C.surface, border: `1px solid ${C.accentBorder}`, borderRadius: 10, marginBottom: 20, animation: "fadeUp 0.4s ease 0.2s both" }}>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>{S.impact}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20, animation: "fadeUp 0.4s ease 0.25s both" }}>
              {S.claims.map((c, i) => {
                const vc = c.bad ? C.red : C.green;
                return (
                  <div key={c.id} onClick={() => setDrawer({ type: "claim", idx: i })} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", borderLeft: `3px solid ${vc}` }}>
                    <span style={{ fontFamily: MONO, fontSize: 16, color: vc }}>{c.bad ? "✕" : "✓"}</span>
                    <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{c.text}</span>
                    <Tag color={vc}>{c.verdict}</Tag>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
              {["Actian VectorAI", "Sphinx", "Databricks", "SafetyKit"].map(t => (
                <span key={t} style={{ fontFamily: MONO, fontSize: 8, color: C.darkest, padding: "5px 10px", border: `1px solid ${C.border}`, borderRadius: 4, letterSpacing: "0.06em" }}>{t}</span>
              ))}
            </div>
            <div style={{ textAlign: "center", animation: "fadeUp 0.4s ease 0.4s both" }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, letterSpacing: "0.12em", marginBottom: 10 }}>TRY ANOTHER</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {SL_LIST.filter(id => id !== sid).map(id => {
                  const s = SCENARIOS[id];
                  return (
                    <div key={id} onClick={() => select(id)} style={{ padding: "10px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = s.color + "50"} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                      <span style={{ fontSize: 18 }}>{s.icon}</span>
                      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: s.color }}>{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {!["LANDING", "SLIDESHOW"].includes(screen) && (
        <div style={{ padding: "10px 24px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, fontFamily: MONO, fontSize: 8, color: C.darkest }}>
          <span style={{ cursor: "pointer" }} onClick={goHome} onMouseEnter={e => e.currentTarget.style.color = C.accent} onMouseLeave={e => e.currentTarget.style.color = C.darkest}>← HOME</span>
          <span style={{ cursor: "pointer" }} onClick={() => setScreen("SCENARIOS")} onMouseEnter={e => e.currentTarget.style.color = C.accent} onMouseLeave={e => e.currentTarget.style.color = C.darkest}>ALL SCENARIOS</span>
          {screen === "VERIFYING" && <span style={{ color: C.dim }}>Click verifier cards for details</span>}
          {screen === "VERDICT" && <span style={{ color: C.dim }}>Click claim or stamp for details</span>}
          <span>ACTIAN VECTORAI · SPHINX · DATABRICKS</span>
        </div>
      )}

      {/* DRAWER */}
      <Drawer open={!!drawer} onClose={() => setDrawer(null)}
        title={drawer?.type === "agent" ? AGENTS[drawer.name]?.name : drawer?.type === "claim" ? `Claim ${S?.claims[drawer.idx]?.id}` : "Settlement Report"}
        accent={drawer?.type === "agent" ? AGENTS[drawer.name]?.color : drawer?.type === "claim" ? (S?.claims[drawer.idx]?.bad ? C.red : C.green) : C.accent}>
        {drawer?.type === "agent" && agentDraw(drawer.name, S?.claims[drawer.claimIdx])}
        {drawer?.type === "claim" && claimDraw(drawer.idx)}
        {drawer?.type === "settlement" && settleDraw()}
      </Drawer>
    </div>
  );
}
