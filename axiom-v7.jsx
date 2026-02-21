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
  NumericVerifier: { icon: "⊞", color: C.cyan, name: "NumericVerifier", subtitle: "Structured Data & Numeric Validation", desc: "Extracts numeric assertions and cross-references them against authoritative sources — SEC filings, court records, earnings transcripts. Catches fabricated statistics, magnitude errors, and misquoted figures.", methodology: ["Parse claim for numeric entities (%, $, ratios, dates)", "Query authoritative databases for matching entity + metric + period", "Compare values against source within tolerance bands", "Flag anomalies (>2σ from norm), unit errors, temporal misalignment"], tools: ["SEC EDGAR API", "Court records", "Statistical anomaly detection"] },
  RetrieverAgent: { icon: "⊚", color: C.blue, name: "RetrieverAgent", subtitle: "Semantic Evidence Retrieval via Actian VectorAI", desc: "Embeds claims into vectors and queries Actian VectorAI DB for semantically similar verified facts, prior claims, and source documents. Finds supporting and contradicting evidence ranked by similarity.", methodology: ["Embed claim text (384-dim sentence-transformer)", "Query Actian VectorAI DB across multiple indexes", "Score docs as SUPPORTS / CONTRADICTS / NEUTRAL", "Compute weighted stance (relevance × recency × authority)"], tools: ["Actian VectorAI DB", "Sentence-transformer", "Multi-index retrieval"] },
  ConsistencyBot: { icon: "⊘", color: C.amber, name: "ConsistencyBot", subtitle: "Cross-Claim Logical Consistency", desc: "Analyzes all claims together to find logical, arithmetic, and temporal contradictions. Catches errors where individual claims seem plausible but are mathematically impossible together.", methodology: ["Build constraint graph linking all claims", "Check arithmetic consistency", "Verify temporal coherence", "Flag jointly impossible claim sets"], tools: ["Constraint solver", "Arithmetic engine", "Sphinx reasoning"] },
};
const AN = ["NumericVerifier", "RetrieverAgent", "ConsistencyBot"];

// ─── Slideshow ───
const SLIDES = [
  { title: "\"How many R's in strawberry?\"", body: "GPT confidently said 2. The answer is 3. Millions of people saw this go viral — a simple counting task that AI couldn't handle.", color: C.amber, year: "2024" },
  { title: "Mata v. Avianca", body: "Two lawyers filed a federal court brief citing 6 cases that didn't exist. Every single citation was hallucinated by ChatGPT. Both attorneys were sanctioned by the judge.", color: C.red, year: "2023" },
  { title: "Air Canada chatbot", body: "An AI chatbot promised a customer a bereavement discount that didn't exist. Air Canada was held legally liable for the chatbot's fabricated policy. The airline had to pay.", color: C.red, year: "2024" },
  { title: "Google AI: \"Put glue on pizza\"", body: "Google's AI Overview recommended adding glue to pizza sauce to help cheese stick better. It had scraped a joke from Reddit and presented it as fact to millions of users.", color: C.amber, year: "2024" },
  { title: "The pattern is clear", body: "AI systems confidently produce false information — fabricated data, invented citations, fictional events. In high-stakes domains like finance, law, and healthcare, a single hallucination can cost millions.", color: C.white, year: "" },
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
    impact: "Without Axiom, Meridian would have evaluated a $50M allocation based on fabricated 28% growth.",
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
    impact: "All 3 claims verified in 11 seconds. Zero manual fact-checking needed.",
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
    impact: "Without Axiom, David would have cited fabricated cases in court — risking Rule 11 sanctions, exactly like Mata v. Avianca (2023).",
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
    const c0 = S.claims[0]; let t = 0; const total = 24, settle = 19;
    ref.current = setInterval(() => {
      t++; if (t > total) { clearInterval(ref.current); return; }
      const p = Math.max(0.02, Math.min(0.98, lerp(c0.bad ? 0.71 : 0.68, c0.riskScore, ease(Math.min(t / settle, 1))) + (Math.random() - 0.5) * 0.02));
      setPrices(prev => [...prev, { t, p }]);
      if (t % 2 === 0 && t < settle) {
        const n = AN[Math.floor(Math.random() * 3)]; const ag = AGENTS[n];
        const side = c0.bad ? (Math.random() > 0.15 ? "SHORT" : "LONG") : (Math.random() > 0.15 ? "LONG" : "SHORT");
        setPills(prev => [...prev, { id: `${t}${Math.random()}`, name: n, icon: ag.icon, color: ag.color, side, p }]);
      }
      if (t === settle + 3) setScreen("VERDICT");
    }, 360);
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
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
      `}</style>

      {/* ══════ LANDING — just Axiom ══════ */}
      {screen === "LANDING" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.02, backgroundImage: `linear-gradient(${C.accent} 1px, transparent 1px), linear-gradient(90deg, ${C.accent} 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />
          <div style={{ position: "absolute", top: "35%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${C.accent}06 0%, transparent 60%)` }} />

          <div style={{ position: "relative", textAlign: "center", animation: "fadeUp 0.8s ease" }}>
            <div style={{ fontFamily: MONO, fontSize: 72, fontWeight: 800, letterSpacing: "0.12em", lineHeight: 1, marginBottom: 20, animation: "fadeUp 0.8s ease 0.2s both" }}>
              AXIOM
            </div>
            <div style={{ fontSize: 16, color: C.muted, lineHeight: 1.7, marginBottom: 40, maxWidth: 440, margin: "0 auto 40px", animation: "fadeUp 0.8s ease 0.4s both" }}>
              Runtime factuality guardrails for AI outputs
            </div>
            <div style={{ animation: "fadeUp 0.8s ease 0.6s both" }}>
              <Btn onClick={() => setScreen("SLIDESHOW")} color={C.accent} filled>BEGIN ▸</Btn>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.darkest, letterSpacing: "0.15em", marginTop: 48, animation: "fadeUp 0.8s ease 0.8s both" }}>
              HACKLYTICS 2026
            </div>
          </div>
        </div>
      )}

      {/* ══════ SLIDESHOW — AI failures ══════ */}
      {screen === "SLIDESHOW" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, position: "relative" }}>
          <div key={slideIdx} style={{ maxWidth: 520, textAlign: "center", animation: "fadeUp 0.4s ease" }}>
            {slide.year && <div style={{ fontFamily: MONO, fontSize: 9, color: C.darkest, letterSpacing: "0.2em", marginBottom: 16 }}>{slide.year}</div>}
            <div style={{ fontSize: 28, fontWeight: 700, color: slide.color, lineHeight: 1.4, marginBottom: 16 }}>{slide.title}</div>
            <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.85, maxWidth: 460, margin: "0 auto" }}>{slide.body}</div>
          </div>

          {/* Dots + nav */}
          <div style={{ position: "absolute", bottom: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {SLIDES.map((_, i) => (
                <div key={i} onClick={() => setSlideIdx(i)} style={{
                  width: i === slideIdx ? 24 : 8, height: 8, borderRadius: 4, cursor: "pointer", transition: "all 0.3s",
                  background: i === slideIdx ? C.accent : C.border,
                }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {slideIdx < SLIDES.length - 1 ? (
                <Btn onClick={() => setSlideIdx(slideIdx + 1)} color={C.accent}>NEXT ▸</Btn>
              ) : (
                <Btn onClick={() => setScreen("SCENARIOS")} color={C.accent} filled>SEE HOW AXIOM SOLVES THIS ▸</Btn>
              )}
            </div>
            <button onClick={() => setScreen("SCENARIOS")} style={{ fontFamily: MONO, fontSize: 9, color: C.darkest, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.08em" }}>
              SKIP →
            </button>
          </div>
        </div>
      )}

      {/* ══════ SCENARIOS — selector ══════ */}
      {screen === "SCENARIOS" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, animation: "fadeUp 0.5s ease" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: C.accent, letterSpacing: "0.25em", marginBottom: 10 }}>AXIOM</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 6 }}>See it in action</div>
          <div style={{ fontSize: 13, color: C.dim, marginBottom: 32, maxWidth: 440, textAlign: "center", lineHeight: 1.7 }}>
            Each scenario walks through a real-world use case — from AI-generated financial reports to legal research — and shows how Axiom catches errors before they cause damage.
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {SL_LIST.map(id => {
              const s = SCENARIOS[id];
              return (
                <div key={id} onClick={() => select(id)} style={{ width: 215, padding: "20px 16px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "all 0.25s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = s.color + "50"; e.currentTarget.style.transform = "translateY(-3px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "none"; }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{s.icon}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.label}</div>
                  <Tag color={s.color}>{s.domain}</Tag>
                  <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.6, marginTop: 10 }}>{s.tagline}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 36, flexWrap: "wrap" }}>
            {["Finance Track", "SafetyKit", "Actian VectorAI", "Sphinx Oracle", "Databricks"].map(t => (
              <span key={t} style={{ fontFamily: MONO, fontSize: 8, color: C.darkest, padding: "4px 8px", border: `1px solid ${C.border}`, borderRadius: 4, letterSpacing: "0.08em" }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* ══════ INTRO ══════ */}
      {screen === "INTRO" && S && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, animation: "fadeUp 0.5s ease" }}>
          <div style={{ maxWidth: 580, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}><Tag color={S.color}>{S.domain}</Tag></div>
            <div style={{ padding: 24, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, textAlign: "left", marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 4 }}>{S.company}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.dim, marginBottom: 16 }}>{S.companyDesc}</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.85 }}>{S.context}</div>
            </div>
            <Btn onClick={() => setScreen("PROMPT")} color={C.accent}>SEE THE PROMPT ▸</Btn>
          </div>
        </div>
      )}

      {/* ══════ PROMPT ══════ */}
      {screen === "PROMPT" && S && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, animation: "fadeUp 0.5s ease" }}>
          <div style={{ maxWidth: 620, width: "100%" }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, letterSpacing: "0.2em", marginBottom: 12 }}>PROMPT FROM {S.analyst.toUpperCase()}</div>
            <div style={{ padding: "20px 24px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 15, color: C.text, lineHeight: 1.8, fontStyle: "italic", borderLeft: `3px solid ${C.accent}`, marginBottom: 28 }}>"{S.prompt}"</div>
            <div style={{ textAlign: "center" }}><Btn onClick={() => setScreen("RESPONSE")} color={C.accent}>SEE AI RESPONSE ▸</Btn></div>
          </div>
        </div>
      )}

      {/* ══════ RESPONSE ══════ */}
      {screen === "RESPONSE" && S && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, animation: "fadeUp 0.5s ease" }}>
          <div style={{ maxWidth: 700, width: "100%" }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, letterSpacing: "0.2em", marginBottom: 12 }}>AI-GENERATED RESPONSE</div>
            <div style={{ padding: 24, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, color: C.text, lineHeight: 1.9, marginBottom: 16 }}>{renderResp()}</div>
            {!showClaims ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>This looks convincing. But can we trust it?<br /><span style={{ color: C.accent }}>Axiom</span> intercepts this before anyone acts on it.</div>
                <Btn onClick={() => setShowClaims(true)} color={S.claims.some(c => c.bad) ? C.red : C.green}>SCAN FOR CLAIMS ▸</Btn>
              </div>
            ) : (
              <div style={{ animation: "fadeUp 0.5s ease" }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, letterSpacing: "0.15em", marginBottom: 8 }}>EXTRACTED CLAIMS ({S.claims.length})</div>
                {S.claims.map(c => <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 4, flexWrap: "wrap" }}><span style={{ fontFamily: MONO, fontSize: 9, color: C.darkest }}>{c.id}</span><Tag color={c.severity === "CRITICAL" ? C.red : c.severity === "HIGH" ? C.amber : C.green}>{c.severity}</Tag><Tag color={C.blue}>{c.type}</Tag><span style={{ fontSize: 11, color: C.text, flex: 1, minWidth: 160 }}>{c.text}</span></div>)}
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Running {S.claims.length} claims through <span style={{ color: C.accent }}>3 independent verifiers</span>...</div>
                  <Btn onClick={startVerify} color={C.accent} filled>VERIFY CLAIMS ▸</Btn>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════ VERIFYING ══════ */}
      {screen === "VERIFYING" && S && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 32px", animation: "fadeUp 0.4s ease" }}>
          <div style={{ width: "100%", maxWidth: 800 }}>
            <div style={{ textAlign: "center", marginBottom: 14, borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: C.dim, letterSpacing: "0.12em" }}>VERIFYING · {S.claims[0].id}</span>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>"{S.claims[0].text}"</div>
            </div>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div style={{ fontFamily: MONO, fontSize: 12, color: C.dim, letterSpacing: "0.1em", marginBottom: 4 }}>FACTUALITY SCORE</div>
              <div style={{ fontFamily: MONO, fontSize: 64, fontWeight: 800, color: pc, transition: "color 0.3s", textShadow: `0 0 24px ${pc}33`, lineHeight: 1 }}>{(last * 100).toFixed(1)}<span style={{ fontSize: 24, color: C.dimmer }}>%</span></div>
            </div>
            {showAdv && <div style={{ height: 110, margin: "8px 0", borderRadius: 8, overflow: "hidden", background: C.surface, border: `1px solid ${C.border}`, animation: "fadeIn 0.3s ease" }}><ResponsiveContainer><AreaChart data={prices} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}><defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={pc} stopOpacity={0.25} /><stop offset="95%" stopColor={pc} stopOpacity={0} /></linearGradient></defs><YAxis domain={[0, 1]} hide /><ReferenceLine y={0.5} stroke={C.border} strokeDasharray="4 4" /><Area type="monotone" dataKey="p" stroke={pc} strokeWidth={2.5} fill="url(#tg)" dot={false} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center", minHeight: 28, padding: "6px 0" }}>
              {pills.slice(-6).map(a => <div key={a.id} onClick={() => setDrawer({ type: "agent", name: a.name, claimIdx: 0 })} style={{ fontFamily: MONO, fontSize: 9, padding: "4px 10px", borderRadius: 16, cursor: "pointer", background: a.side === "SHORT" ? C.redBg : C.greenBg, border: `1px solid ${a.side === "SHORT" ? C.redBorder : C.greenBorder}`, color: a.side === "SHORT" ? C.red : C.green, animation: "slideIn 0.3s ease", whiteSpace: "nowrap" }}>{a.icon} {a.name} {a.side === "SHORT" ? "↓ doubts" : "↑ confirms"}</div>)}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
              {AN.map(n => { const ag = AGENTS[n]; return <div key={n} onClick={() => setDrawer({ type: "agent", name: n, claimIdx: 0 })} style={{ padding: "10px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", textAlign: "center", flex: 1, maxWidth: 200, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.borderColor = ag.color + "50"} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}><span style={{ fontSize: 14 }}>{ag.icon}</span><div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: ag.color, marginTop: 2 }}>{n}</div><div style={{ fontFamily: MONO, fontSize: 7, color: C.darkest, marginTop: 4 }}>details →</div></div>; })}
            </div>
            <div style={{ textAlign: "center", marginTop: 10 }}><button onClick={() => setShowAdv(!showAdv)} style={{ fontFamily: MONO, fontSize: 9, color: C.dimmer, background: "none", border: "none", cursor: "pointer" }}>{showAdv ? "▴ HIDE MARKET VIEW" : "▾ ADVANCED: MARKET VIEW"}</button></div>
          </div>
        </div>
      )}

      {/* ══════ VERDICT ══════ */}
      {screen === "VERDICT" && S && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 32px", overflow: "auto" }}>
          <div style={{ maxWidth: 700, width: "100%", paddingTop: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, letterSpacing: "0.2em", marginBottom: 14, textAlign: "center", animation: "fadeUp 0.4s ease" }}>ALL {S.claims.length} CLAIMS ANALYZED</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24, animation: "fadeUp 0.5s ease 0.15s both" }}>
              {S.claims.map((c, i) => { const vc = c.bad ? C.red : C.green; const ac = c.action === "ALLOW" ? C.green : c.action === "REWRITE" ? C.amber : C.red; return (
                <div key={c.id} onClick={() => setDrawer({ type: "claim", idx: i })} style={{ padding: "16px 18px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.2s", borderLeft: `3px solid ${vc}` }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = vc + "40"; e.currentTarget.style.background = C.surfaceAlt; }} onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}><span style={{ fontFamily: MONO, fontSize: 9, color: C.darkest }}>{c.id}</span><Tag color={vc}>{c.verdict}</Tag><Tag color={ac}>{c.action}</Tag><span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 9, color: C.darkest }}>details →</span></div>
                  <div style={{ fontSize: 13, color: C.text, marginBottom: 8, lineHeight: 1.5 }}>"{c.text}"</div>
                  <RiskBar score={c.riskScore} small />
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 6, lineHeight: 1.5 }}>{c.rationale}</div>
                </div>
              ); })}
            </div>
            <div style={{ textAlign: "center", animation: "fadeUp 0.5s ease 0.3s both" }}>
              <div onClick={() => setDrawer({ type: "settlement" })} style={{ display: "inline-block", padding: "14px 36px", borderRadius: 10, cursor: "pointer", background: S.claims.some(c => c.bad) ? C.red : C.green, color: S.claims.some(c => c.bad) ? "#fff" : "#000", fontFamily: MONO, fontSize: 14, fontWeight: 800, letterSpacing: "0.12em", transition: "transform 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                ■ OUTPUT {S.claims.some(c => c.bad) ? "BLOCKED" : "ALLOWED"}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.darkest, marginTop: 6, cursor: "pointer" }} onClick={() => setDrawer({ type: "settlement" })}>Full report →</div>
            </div>
            <div style={{ margin: "24px 0", padding: "16px 20px", background: C.surface, border: `1px solid ${C.accentBorder}`, borderRadius: 10, animation: "fadeUp 0.5s ease 0.5s both" }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.accent, letterSpacing: "0.12em", marginBottom: 6 }}>IMPACT</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8 }}>{S.impact}</div>
            </div>
            {showAdv && prices.length > 0 && <div style={{ height: 55, borderRadius: 8, overflow: "hidden", background: C.surface, border: `1px solid ${C.border}`, marginBottom: 12, animation: "fadeIn 0.3s" }}><ResponsiveContainer><AreaChart data={prices} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}><defs><linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={S.claims[0].bad ? C.red : C.green} stopOpacity={0.2} /><stop offset="95%" stopColor={S.claims[0].bad ? C.red : C.green} stopOpacity={0} /></linearGradient></defs><YAxis domain={[0, 1]} hide /><Area type="monotone" dataKey="p" stroke={S.claims[0].bad ? C.red : C.green} strokeWidth={2} fill="url(#vg)" dot={false} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>}
            <div style={{ textAlign: "center", marginBottom: 8 }}><button onClick={() => setShowAdv(!showAdv)} style={{ fontFamily: MONO, fontSize: 9, color: C.dimmer, background: "none", border: "none", cursor: "pointer" }}>{showAdv ? "▴ HIDE MARKET VIEW" : "▾ ADVANCED: MARKET VIEW"}</button></div>
            <div style={{ marginTop: 20, textAlign: "center", animation: "fadeUp 0.5s ease 0.7s both" }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, letterSpacing: "0.15em", marginBottom: 12 }}>TRY ANOTHER SCENARIO</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {SL_LIST.filter(id => id !== sid).map(id => { const s = SCENARIOS[id]; return (
                  <div key={id} onClick={() => select(id)} style={{ padding: "12px 16px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "all 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = s.color + "50"} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                    <span style={{ fontSize: 20 }}>{s.icon}</span><div style={{ textAlign: "left" }}><div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: s.color }}>{s.label}</div><div style={{ fontSize: 10, color: C.dim }}>{s.tagline.slice(0, 50)}...</div></div>
                  </div>
                ); })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {!["LANDING", "SLIDESHOW"].includes(screen) && (
        <div style={{ padding: "10px 24px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 8, color: C.darkest }}>
          <span style={{ cursor: "pointer" }} onClick={goHome} onMouseEnter={e => e.currentTarget.style.color = C.accent} onMouseLeave={e => e.currentTarget.style.color = C.darkest}>← HOME</span>
          <span style={{ cursor: "pointer" }} onClick={() => setScreen("SCENARIOS")} onMouseEnter={e => e.currentTarget.style.color = C.accent} onMouseLeave={e => e.currentTarget.style.color = C.darkest}>ALL SCENARIOS</span>
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
