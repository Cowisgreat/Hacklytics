"""
Axiom Core Data Models
All Pydantic models for claims, agents, evidence, settlements, and events.
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional
from datetime import datetime
import uuid


# ─── Enums ───

class ClaimType(str, Enum):
    NUMERIC = "NUMERIC"
    ENTITY = "ENTITY"
    EVENT = "EVENT"
    CASE_LAW = "CASE_LAW"
    LEGAL = "LEGAL"
    QUOTE = "QUOTE"
    CAUSAL = "CAUSAL"

class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MED = "MED"
    LOW = "LOW"

class Verdict(str, Enum):
    TRUE = "TRUE"
    FALSE = "FALSE"
    UNCERTAIN = "UNCERTAIN"

class RiskAction(str, Enum):
    ALLOW = "ALLOW"
    REWRITE = "REWRITE"
    BLOCK = "BLOCK"

class AgentSide(str, Enum):
    LONG = "LONG"    # believes claim is true
    SHORT = "SHORT"  # believes claim is false

class EvidenceStance(str, Enum):
    SUPPORTS = "SUPPORTS"
    CONTRADICTS = "CONTRADICTS"
    NEUTRAL = "NEUTRAL"

class FindingType(str, Enum):
    CONFIRMED = "CONFIRMED"
    CONTRADICTION = "CONTRADICTION"
    SUPPORTS = "SUPPORTS"
    FLAG = "FLAG"
    INCONSISTENCY = "INCONSISTENCY"
    CONSISTENT = "CONSISTENT"
    PATTERN = "PATTERN"
    NOT_FOUND = "NOT_FOUND"


# ─── Core Models ───

class Claim(BaseModel):
    id: str = Field(default_factory=lambda: f"CLM-{uuid.uuid4().hex[:6].upper()}")
    text: str
    type: ClaimType
    severity: Severity
    source_text: str = ""  # original text span in LLM response
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Finding(BaseModel):
    type: FindingType
    text: str
    source: str
    relevance: float = Field(ge=0.0, le=1.0)


class AgentAssessment(BaseModel):
    agent_name: str
    claim_id: str
    position: AgentSide
    confidence: float = Field(ge=0.0, le=1.0)
    summary: str
    findings: list[Finding] = []
    latency_ms: float = 0.0


class ClaimVerification(BaseModel):
    claim: Claim
    risk_score: float = Field(ge=0.0, le=1.0)  # 1.0 = definitely true, 0.0 = definitely false
    verdict: Verdict
    action: RiskAction
    rationale: str
    assessments: list[AgentAssessment] = []


class Settlement(BaseModel):
    session_id: str
    oracle: str = "Sphinx Reasoning Engine"
    confidence: float
    summary: str
    evidence_supporting: int = 0
    evidence_contradicting: int = 0
    evidence_neutral: int = 0
    recommendation: str
    settled_at: datetime = Field(default_factory=datetime.utcnow)


class VerificationSession(BaseModel):
    id: str = Field(default_factory=lambda: f"SES-{uuid.uuid4().hex[:8].upper()}")
    prompt: str
    llm_response: str
    claims: list[Claim] = []
    verifications: list[ClaimVerification] = []
    settlement: Optional[Settlement] = None
    overall_action: Optional[RiskAction] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ─── Request / Response Models ───

class VerifyRequest(BaseModel):
    prompt: str
    response: str
    domain: str = "finance"  # finance, legal, healthcare


class VerifyResponse(BaseModel):
    session: VerificationSession


# ─── WebSocket Event Models ───

class WSEventType(str, Enum):
    SESSION_CREATED = "session_created"
    CLAIMS_EXTRACTED = "claims_extracted"
    AGENT_QUOTE = "agent_quote"
    RISK_UPDATE = "risk_update"
    SETTLEMENT = "settlement"
    ACTION = "action"
    ERROR = "error"


class WSEvent(BaseModel):
    type: WSEventType
    data: dict
    timestamp: datetime = Field(default_factory=datetime.utcnow)
