# ◈ AXIOM

### Runtime Factuality Guardrails for AI Outputs

> *Multiple specialized verifiers independently score each AI-generated claim. Axiom combines their evidence into a single risk signal that can **allow**, **rewrite**, or **block** unsafe outputs — before anyone acts on them.*

**Hacklytics 2026 · Finance Track**

---

## The Problem

AI systems confidently produce false information — fabricated statistics, invented legal citations, fictional events. In high-stakes domains, a single hallucination can trigger catastrophic decisions:

| Incident | What Happened | Impact |
|---|---|---|
| **Mata v. Avianca (2023)** | Lawyers filed a brief citing 6 AI-hallucinated court cases | Both attorneys sanctioned by federal judge |
| **Air Canada Chatbot (2024)** | AI promised a bereavement discount that didn't exist | Airline held legally liable for fabricated policy |
| **Google AI Overview (2024)** | Recommended glue as a pizza cheese substitute | Scraped a Reddit joke, served it as fact to millions |

Current guardrails (confidence scores, prompt engineering, RAG) are insufficient. Confidence scores hide disagreement. Prompt engineering is brittle. RAG doesn't verify — it retrieves.

## The Solution

Axiom is a **claim-level verification engine** that intercepts AI outputs before they reach the user.

### How It Works

```
User Prompt → LLM generates response → Axiom intercepts
                                            │
                                    ┌───────┴───────┐
                                    │  Claim Extractor │
                                    └───────┬───────┘
                                            │
                              ┌─────────────┼─────────────┐
                              ▼             ▼             ▼
                      NumericVerifier  RetrieverAgent  ConsistencyBot
                      (structured DB)  (Actian Vector) (cross-claim)
                              │             │             │
                              └─────────────┼─────────────┘
                                            │
                                    ┌───────┴───────┐
                                    │ Risk Aggregation │
                                    │ (market-based    │
                                    │  consensus)      │
                                    └───────┬───────┘
                                            │
                                    ┌───────┴───────┐
                                    │  Sphinx Oracle  │
                                    │  (settlement)   │
                                    └───────┬───────┘
                                            │
                                    ┌───────┴───────┐
                                    │  Risk Action    │
                                    │  Engine         │
                                    └───────┬───────┘
                                            │
                              ┌─────────────┼──────────────┐
                              ▼             ▼              ▼
                           ALLOW        REWRITE          BLOCK
                        (verified)   (partial issues)  (hallucination)
```

### Three Verification Agents

| Agent | Role | Data Sources |
|---|---|---|
| **⊞ NumericVerifier** | Validates numbers, percentages, dates, and quoted figures against authoritative structured data | SEC EDGAR, court databases, financial feeds |
| **⊚ RetrieverAgent** | Semantic evidence retrieval — finds supporting and contradicting documents via vector similarity | Actian VectorAI DB (verified claims, analyst reports, case law, news) |
| **⊘ ConsistencyBot** | Cross-claim logical analysis — catches claims that are individually plausible but jointly impossible | Constraint solver, arithmetic validation, Sphinx reasoning |

### Risk Aggregation

Instead of naively averaging confidence scores, Axiom uses a **market-based consensus mechanism**: each agent's assessment is weighted by reliability, evidence quality, and claim type. Disagreement between agents is surfaced as risk — which is exactly what matters in high-stakes settings.

### Actions

| Risk Level | Action | Behavior |
|---|---|---|
| High confidence (>80%) | **ALLOW** | Output delivered to user |
| Medium confidence (40–80%) | **REWRITE** | Flagged claims corrected with verified data |
| Low confidence (<40%) | **BLOCK** | Output suppressed, routed to human review |

Every action includes a full audit trail: which agents assessed the claim, what evidence they found, from what sources, and why the action was taken.

---

## Demo Scenarios

The application includes three pre-built scenarios demonstrating Axiom across domains:

### 📉 Finance · Hallucination
*Meridian Health Partners* asks AI to summarize Acme Corp's earnings. The AI fabricates 28% revenue growth (actual: 7.6%), inflated margins, and a nonexistent $2B buyback. Axiom catches all three fabrications and blocks the output.

### 📈 Finance · Verified
*Apex Capital* asks AI for NVIDIA's quarterly results. All claims ($22.1B revenue, 409% DC growth) are confirmed against SEC filings. Axiom verifies and allows the output in 11 seconds.

### ⚖️ Legal · Fabricated Case Law
*Whitfield & Associates* asks AI for peer review privilege precedent. The AI invents two court cases that don't exist (*Harrison v. Mercy General Hospital*, *Thompson v. Regional Medical Center*). Axiom detects the phantom citations and blocks before they enter a court filing — preventing a Mata v. Avianca–style sanctions disaster.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js, React, Tailwind CSS, Recharts | Interactive demo UI with narrative flow |
| **Backend** | FastAPI (Python) | Claim orchestration, agent coordination, WebSocket events |
| **Vector Retrieval** | **Actian VectorAI DB** | Evidence retrieval for RetrieverAgent — stores verified claims, analyst reports, case law, hallucination archive |
| **Oracle / Reasoning** | **Sphinx AI** | Settlement adjudication — reasons over conflicting evidence, produces verdicts and rationale |
| **Data Pipeline** | **Databricks** | Claim extraction pipeline, evaluation benchmarks, agent calibration |
| **Storage** | PostgreSQL | Sessions, claims, evidence, settlements, audit trail |
| **LLM** | Claude / GPT | Response generation, claim extraction |

---

## Sponsor Challenge Integrations

### ✅ Best Use of Actian VectorAI DB
RetrieverAgent uses Actian VectorAI DB as its core evidence layer. Claims are embedded as 384-dimensional vectors and queried across multiple indexes:
- **Verified Claims Index** — previously verified facts with truth labels
- **Analyst Reports Index** — financial research and consensus estimates
- **Case Law Index** — legal citations and judicial opinions
- **Hallucination Archive** — previously detected AI fabrications for pattern matching

```bash
docker pull williamimoh/actian-vectorai-db:1.0b
```

### ✅ Best AI for Human Safety (SafetyKit)
Axiom prevents human harm from AI-generated misinformation by blocking hallucinated outputs before they reach decision-makers. In finance, this prevents misinformed investments. In legal, this prevents sanctions from fabricated citations.

### ✅ Most Unique Application of Sphinx
Sphinx serves as the **settlement oracle** — when verification agents disagree, Sphinx reasons over the conflicting evidence and produces a final verdict with a natural-language rationale explaining why a claim was judged true or false.

### ✅ Databricks Raffle
Databricks is used for the claim extraction and evaluation pipeline — ingesting fact datasets, generating verification benchmarks, and logging agent calibration metrics.

---

## Project Structure

```
axiom/
├── frontend/               # Next.js application
│   ├── components/
│   │   ├── Landing.jsx          # Hero landing page
│   │   ├── Slideshow.jsx        # AI failure slideshow
│   │   ├── ScenarioSelector.jsx # Scenario picker
│   │   ├── NarrativeFlow.jsx    # Step-by-step story
│   │   ├── VerificationView.jsx # Live verification animation
│   │   ├── VerdictView.jsx      # Claim-by-claim results
│   │   └── Drawer.jsx           # Agent/claim/settlement detail panels
│   └── data/
│       └── scenarios.js         # Scenario definitions + evidence
├── backend/                # FastAPI server
│   ├── main.py
│   ├── claim_extractor.py       # LLM-based claim parsing
│   ├── agents/
│   │   ├── numeric_verifier.py
│   │   ├── retriever_agent.py   # Actian VectorAI integration
│   │   └── consistency_bot.py
│   ├── risk_engine.py           # Aggregation + action policy
│   ├── sphinx_oracle.py         # Sphinx settlement integration
│   └── websocket.py             # Real-time event streaming
├── databricks/             # Databricks notebooks
│   └── claim_pipeline.ipynb     # ETL + evaluation pipeline
├── data/
│   └── seed/                    # Seed data for Actian VectorAI
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- Docker (for Actian VectorAI DB)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-team/axiom.git
cd axiom

# Start Actian VectorAI DB
docker pull williamimoh/actian-vectorai-db:1.0b
docker run -d -p 5432:5432 williamimoh/actian-vectorai-db:1.0b

# Backend
cd backend
pip install -r requirements.txt
python main.py

# Frontend
cd ../frontend
npm install
npm run dev
```

The application will be available at `http://localhost:3000`.

---

## Judging Criteria Alignment

| Criteria | How Axiom Delivers |
|---|---|
| **Creativity & Originality** | Novel approach: treats factual verification as a multi-agent consensus problem with market-style risk aggregation |
| **Impact & Relevance** | Directly addresses the #1 barrier to enterprise AI adoption — hallucinations in high-stakes outputs |
| **Scope & Technical Depth** | Full pipeline: claim extraction → multi-agent verification → evidence retrieval → risk aggregation → policy enforcement |
| **Clarity & Engagement** | Narrative-driven demo with real-world scenarios; judges understand the value in 30 seconds |
| **Soundness & Accuracy** | Evidence-grounded verdicts with full audit trail; every claim links back to authoritative sources |

---

## Why Not Just Use Confidence Scores?

A simple average treats every verifier equally and hides disagreement. Axiom weights verifiers by reliability, evidence quality, and claim type — and exposes disagreement as risk. In high-stakes settings, knowing that two agents agree but one strongly disagrees is far more valuable than a single number that averages away the conflict.

---

## Team

| Name | Role |
|---|---|
| [Team Member 1] | Frontend, UI/UX, Demo Engineering |
| [Team Member 2] | Backend, Agent Architecture, Integrations |

---

## Built at Hacklytics 2026 · Georgia Tech

*Finance Track · SafetyKit · Actian VectorAI · Sphinx · Databricks*
