"""
Axiom Backend — Main Application
FastAPI server with REST + WebSocket endpoints for the verification pipeline.

Run: uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""
import asyncio
import json
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import config
from models import (
    VerifyRequest, VerifyResponse, VerificationSession,
    WSEvent, WSEventType, RiskAction
)
from services.orchestrator import run_verification, run_verification_streaming
from services.claim_extractor import extract_claims
from agents import AGENT_MAP, ALL_AGENTS


# ─── Lifespan ───

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 50)
    print("  AXIOM — Epistemic Verification Engine")
    print(f"  Mode: {'DEMO' if config.DEMO_MODE else 'LIVE'}")
    print(f"  LLM: {config.LLM_PROVIDER}")
    print(f"  Actian: {config.ACTIAN_VECTORAI_HOST}:{config.ACTIAN_VECTORAI_PORT}")
    print(f"  Thresholds: allow>{config.RISK_THRESHOLD_ALLOW} rewrite>{config.RISK_THRESHOLD_REWRITE}")
    print("=" * 50)
    yield
    print("Axiom shutting down.")


# ─── App ───

app = FastAPI(
    title="Axiom",
    description="Runtime factuality guardrails for AI outputs",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store (swap for Redis/Postgres in production)
sessions: dict[str, VerificationSession] = {}


# ─── Health ───

@app.get("/")
async def root():
    return {
        "service": "axiom",
        "version": "1.0.0",
        "mode": "demo" if config.DEMO_MODE else "live",
        "status": "ok",
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "demo_mode": config.DEMO_MODE}


# ─── REST Endpoints ───

@app.post("/api/verify", response_model=VerifyResponse)
async def verify(req: VerifyRequest):
    """
    Full synchronous verification pipeline.
    Extracts claims, runs all agents, aggregates risk, settles.
    Returns complete results.
    """
    try:
        session = await run_verification(
            prompt=req.prompt,
            response=req.response,
            domain=req.domain,
        )
        sessions[session.id] = session
        return VerifyResponse(session=session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/extract-claims")
async def extract_claims_endpoint(req: VerifyRequest):
    """Extract claims from an AI response without running verification."""
    try:
        claims = await extract_claims(req.response, req.domain)
        return {
            "claims": [
                {
                    "id": c.id,
                    "text": c.text,
                    "type": c.type.value,
                    "severity": c.severity.value,
                    "source_text": c.source_text,
                }
                for c in claims
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    """Retrieve a completed verification session."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.model_dump()


@app.get("/api/sessions")
async def list_sessions():
    """List all verification sessions."""
    return {
        "sessions": [
            {
                "id": s.id,
                "prompt": s.prompt[:100],
                "overall_action": s.overall_action.value if s.overall_action else None,
                "claims_count": len(s.claims),
                "created_at": s.created_at.isoformat(),
            }
            for s in sessions.values()
        ]
    }


@app.get("/api/agents")
async def list_agents():
    """List available verification agents."""
    return {
        "agents": [
            {
                "name": a.name,
                "specialty": a.specialty,
            }
            for a in ALL_AGENTS
        ]
    }


# ─── WebSocket Endpoint ───

class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def send_event(self, ws: WebSocket, event: WSEvent):
        await ws.send_json({
            "type": event.type.value,
            "data": event.data,
            "timestamp": event.timestamp.isoformat(),
        })

    async def broadcast(self, event: WSEvent):
        for ws in self.active:
            try:
                await self.send_event(ws, event)
            except Exception:
                pass


manager = ConnectionManager()


@app.websocket("/ws/verify")
async def websocket_verify(ws: WebSocket):
    """
    WebSocket endpoint for streaming verification.
    
    Client sends:
        {"prompt": "...", "response": "...", "domain": "finance"}
    
    Server streams WSEvent objects:
        session_created → claims_extracted → agent_quote (×N) → 
        risk_update (×N) → settlement
    """
    await manager.connect(ws)
    try:
        while True:
            # Wait for verification request
            data = await ws.receive_json()
            prompt = data.get("prompt", "")
            response = data.get("response", "")
            domain = data.get("domain", "finance")

            if not response:
                await manager.send_event(ws, WSEvent(
                    type=WSEventType.ERROR,
                    data={"message": "Response text is required."},
                ))
                continue

            # Stream verification events
            async for event in run_verification_streaming(prompt, response, domain):
                await manager.send_event(ws, event)

    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        try:
            await manager.send_event(ws, WSEvent(
                type=WSEventType.ERROR,
                data={"message": str(e)},
            ))
        except Exception:
            pass
        manager.disconnect(ws)


# ─── Demo Endpoints ───

@app.post("/api/demo/finance-false")
async def demo_finance_false():
    """Pre-baked finance hallucination demo."""
    return await verify(VerifyRequest(
        prompt="Summarize Acme Corp's Q3 2024 financial performance.",
        response=(
            "Acme Corp delivered exceptional results in Q3 2024. "
            "Revenue grew 28% quarter-over-quarter to $2.19 billion. "
            "Operating margins expanded to 34.2%, up from 29.1% in Q2. "
            "The company also announced a $2 billion stock buyback program. "
            "Acme remains headquartered in San Francisco."
        ),
        domain="finance",
    ))


@app.post("/api/demo/finance-true")
async def demo_finance_true():
    """Pre-baked finance verification demo."""
    return await verify(VerifyRequest(
        prompt="What was NVIDIA's Q4 FY2024 revenue?",
        response=(
            "NVIDIA reported Q4 FY2024 revenue of $22.1 billion, "
            "beating expectations of $20.4 billion. "
            "Data center revenue increased 409% year-over-year to $18.4 billion. "
            "Gaming revenue was $2.9 billion."
        ),
        domain="finance",
    ))


@app.post("/api/demo/legal-false")
async def demo_legal_false():
    """Pre-baked legal hallucination demo."""
    return await verify(VerifyRequest(
        prompt="Find case law on hospital peer review privilege.",
        response=(
            "In Harrison v. Mercy General Hospital (2019), the Seventh Circuit "
            "held that peer review findings are absolutely privileged under the HCQIA. "
            "In Thompson v. Regional Medical Center (2021), the court extended this "
            "privilege to electronic communications. "
            "The privilege has been consistently upheld across federal circuits."
        ),
        domain="legal",
    ))


# ─── Run ───

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=True,
    )
