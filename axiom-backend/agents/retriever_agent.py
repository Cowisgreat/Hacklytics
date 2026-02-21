"""
RetrieverAgent
Semantic evidence retrieval using Actian VectorAI DB.
Embeds claims and queries for similar verified facts, analyst reports,
case law, and known hallucination patterns.

In production: connects to Actian VectorAI DB via psycopg2.
In demo: uses in-memory mock vector store with cosine similarity.
"""
import time
import json
import numpy as np
from typing import Optional
from agents.base import BaseAgent
from models import (
    Claim, ClaimType, AgentAssessment, AgentSide,
    Finding, FindingType
)
from config import config

# ─── Mock vector store for demo mode ───
# In production, these would be actual embeddings in Actian VectorAI DB

MOCK_VERIFIED_CLAIMS = [
    {"text": "Acme Corp revenue grew 7.6% QoQ in Q3 2024", "verdict": True, "domain": "finance"},
    {"text": "NVIDIA Q4 FY2024 revenue was $22.1 billion", "verdict": True, "domain": "finance"},
    {"text": "NVIDIA data center revenue grew 409% year-over-year", "verdict": True, "domain": "finance"},
    {"text": "Acme Corp operating margins were approximately 30.8% in Q3", "verdict": True, "domain": "finance"},
]

MOCK_HALLUCINATION_ARCHIVE = [
    {"text": "Acme Corp revenue grew 32% QoQ", "original_verdict": False, "pattern": "inflated_growth"},
    {"text": "Harrison v. Mercy General Hospital (2019)", "original_verdict": False, "pattern": "phantom_citation"},
    {"text": "Thompson v. Regional Medical Center (2021)", "original_verdict": False, "pattern": "phantom_citation"},
    {"text": "Smith v. County Hospital (2020) established absolute privilege", "original_verdict": False, "pattern": "phantom_citation"},
]

MOCK_ANALYST_DATA = [
    {"text": "Analyst consensus for Acme Corp Q3 growth: 6-9% QoQ", "domain": "finance"},
    {"text": "14 sell-side analysts modeled Acme growth below 15%", "domain": "finance"},
    {"text": "NVIDIA Q4 beat consensus of $20.4B by 8.3%", "domain": "finance"},
]


class RetrieverAgent(BaseAgent):
    name = "RetrieverAgent"
    specialty = "Semantic evidence retrieval via Actian VectorAI"

    def __init__(self):
        self._encoder = None
        self._actian_conn = None

    def _get_encoder(self):
        """Lazy-load sentence transformer."""
        if self._encoder is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._encoder = SentenceTransformer(config.EMBEDDING_MODEL)
            except ImportError:
                self._encoder = "mock"
        return self._encoder

    def _get_actian_connection(self):
        """Get connection to Actian VectorAI DB."""
        if self._actian_conn is None and not config.DEMO_MODE:
            try:
                import psycopg2
                self._actian_conn = psycopg2.connect(
                    host=config.ACTIAN_VECTORAI_HOST,
                    port=config.ACTIAN_VECTORAI_PORT,
                    dbname=config.ACTIAN_VECTORAI_DB,
                    user=config.ACTIAN_VECTORAI_USER,
                    password=config.ACTIAN_VECTORAI_PASSWORD,
                )
            except Exception as e:
                print(f"Actian VectorAI connection failed: {e}")
                return None
        return self._actian_conn

    async def verify(self, claim: Claim, context: dict = None) -> AgentAssessment:
        start = time.time()
        context = context or {}

        # Try real Actian VectorAI DB first
        conn = self._get_actian_connection()
        if conn and not config.DEMO_MODE:
            return await self._verify_actian(claim, conn, context, start)

        # Demo mode: mock vector similarity
        return self._verify_mock(claim, context, start)

    async def _verify_actian(self, claim: Claim, conn, context: dict, start: float) -> AgentAssessment:
        """Query real Actian VectorAI DB for evidence."""
        try:
            encoder = self._get_encoder()
            if encoder == "mock":
                return self._verify_mock(claim, context, start)

            # Embed the claim
            embedding = encoder.encode(claim.text).tolist()

            cursor = conn.cursor()

            # Query verified claims index
            cursor.execute("""
                SELECT text, verdict, similarity(embedding, %s::vector) as sim
                FROM verified_claims
                ORDER BY sim DESC
                LIMIT 5
            """, (str(embedding),))
            verified_results = cursor.fetchall()

            # Query hallucination archive
            cursor.execute("""
                SELECT text, pattern, similarity(embedding, %s::vector) as sim
                FROM hallucination_archive
                ORDER BY sim DESC
                LIMIT 3
            """, (str(embedding),))
            hallucination_results = cursor.fetchall()

            # Query analyst reports
            cursor.execute("""
                SELECT text, similarity(embedding, %s::vector) as sim
                FROM analyst_reports
                ORDER BY sim DESC
                LIMIT 3
            """, (str(embedding),))
            analyst_results = cursor.fetchall()

            cursor.close()

            # Process results into findings
            findings = []
            supporting = 0
            contradicting = 0

            for text, verdict, sim in verified_results:
                if sim > 0.7:
                    if verdict:
                        findings.append(Finding(
                            type=FindingType.SUPPORTS,
                            text=f"Verified claim: '{text}' (similarity: {sim:.2f})",
                            source="Actian VectorAI · Verified Claims Index",
                            relevance=sim,
                        ))
                        supporting += 1
                    else:
                        findings.append(Finding(
                            type=FindingType.CONTRADICTION,
                            text=f"Contradicting verified claim: '{text}' (similarity: {sim:.2f})",
                            source="Actian VectorAI · Verified Claims Index",
                            relevance=sim,
                        ))
                        contradicting += 1

            for text, pattern, sim in hallucination_results:
                if sim > 0.75:
                    findings.append(Finding(
                        type=FindingType.PATTERN,
                        text=f"Hallucination pattern match: '{text}' (pattern: {pattern}, similarity: {sim:.2f})",
                        source="Actian VectorAI · Hallucination Archive",
                        relevance=sim,
                    ))
                    contradicting += 1

            if contradicting > supporting:
                position = AgentSide.SHORT
                confidence = min(0.95, 0.60 + contradicting * 0.10)
                summary = f"{contradicting} contradicting doc(s). {supporting} supporting."
            else:
                position = AgentSide.LONG
                confidence = min(0.95, 0.60 + supporting * 0.08)
                summary = f"{supporting} supporting doc(s). {contradicting} contradicting."

            return self._timed_assessment(
                start, claim_id=claim.id, position=position,
                confidence=confidence, summary=summary, findings=findings,
            )

        except Exception as e:
            print(f"Actian query failed: {e}")
            return self._verify_mock(claim, context, start)

    def _verify_mock(self, claim: Claim, context: dict, start: float) -> AgentAssessment:
        """Mock vector similarity for demo mode."""
        findings = []
        claim_lower = claim.text.lower()

        # Simple keyword matching as mock similarity
        supporting = 0
        contradicting = 0

        # Check against verified claims
        for vc in MOCK_VERIFIED_CLAIMS:
            sim = self._mock_similarity(claim.text, vc["text"])
            if sim > 0.3:
                # Check if the verified claim supports or contradicts
                if self._claims_agree(claim.text, vc["text"]):
                    findings.append(Finding(
                        type=FindingType.SUPPORTS,
                        text=f"Nearest verified claim: '{vc['text']}' (similarity: {sim:.2f})",
                        source="Actian VectorAI · Verified Claims Index",
                        relevance=min(0.99, sim + 0.2),
                    ))
                    supporting += 1
                else:
                    findings.append(Finding(
                        type=FindingType.CONTRADICTION,
                        text=f"Contradicting verified claim: '{vc['text']}' (similarity: {sim:.2f})",
                        source="Actian VectorAI · Verified Claims Index",
                        relevance=min(0.99, sim + 0.2),
                    ))
                    contradicting += 1

        # Check hallucination archive
        for ha in MOCK_HALLUCINATION_ARCHIVE:
            sim = self._mock_similarity(claim.text, ha["text"])
            if sim > 0.35:
                findings.append(Finding(
                    type=FindingType.PATTERN,
                    text=f"Hallucination pattern match: '{ha['text']}' (pattern: {ha['pattern']})",
                    source="Actian VectorAI · Hallucination Archive",
                    relevance=min(0.95, sim + 0.15),
                ))
                contradicting += 1

        # Check analyst data
        for ad in MOCK_ANALYST_DATA:
            sim = self._mock_similarity(claim.text, ad["text"])
            if sim > 0.25:
                findings.append(Finding(
                    type=FindingType.SUPPORTS if supporting > contradicting else FindingType.CONTRADICTION,
                    text=f"Analyst data: '{ad['text']}'",
                    source="Actian VectorAI · Analyst Reports Index",
                    relevance=min(0.92, sim + 0.15),
                ))

        # No matches at all
        if not findings:
            if claim.type == ClaimType.CASE_LAW:
                findings.append(Finding(
                    type=FindingType.NOT_FOUND,
                    text="No matching case law found in any indexed legal database.",
                    source="Actian VectorAI · Case Law Index",
                    relevance=0.90,
                ))
                contradicting += 1
            else:
                findings.append(Finding(
                    type=FindingType.FLAG,
                    text="No similar claims found in evidence index. Unable to corroborate.",
                    source="Actian VectorAI · Full Index",
                    relevance=0.50,
                ))

        if contradicting > supporting:
            position = AgentSide.SHORT
            confidence = min(0.95, 0.55 + contradicting * 0.12)
            summary = f"{contradicting} contradicting doc(s). {supporting} supporting."
        elif supporting > 0:
            position = AgentSide.LONG
            confidence = min(0.95, 0.55 + supporting * 0.10)
            summary = f"{supporting} corroborating source(s). {contradicting} contradicting."
        else:
            position = AgentSide.SHORT
            confidence = 0.55
            summary = "Insufficient evidence to corroborate claim."

        return self._timed_assessment(
            start, claim_id=claim.id, position=position,
            confidence=confidence, summary=summary, findings=findings,
        )

    def _mock_similarity(self, a: str, b: str) -> float:
        """Simple word-overlap similarity for demo mode."""
        words_a = set(a.lower().split())
        words_b = set(b.lower().split())
        if not words_a or not words_b:
            return 0.0
        overlap = len(words_a & words_b)
        return overlap / max(len(words_a), len(words_b))

    def _claims_agree(self, claim_text: str, verified_text: str) -> bool:
        """Heuristic: do these two claims say similar or contradictory things?"""
        import re
        # Extract numbers from both
        claim_nums = [float(m.group(1)) for m in re.finditer(r'(\d+\.?\d*)', claim_text)]
        verified_nums = [float(m.group(1)) for m in re.finditer(r'(\d+\.?\d*)', verified_text)]

        if claim_nums and verified_nums:
            # If the primary numbers are close, they agree
            if abs(claim_nums[0] - verified_nums[0]) / max(verified_nums[0], 1) < 0.15:
                return True
            return False

        # If no numbers, check keyword overlap
        return self._mock_similarity(claim_text, verified_text) > 0.5
