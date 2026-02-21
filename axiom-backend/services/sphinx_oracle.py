"""
Sphinx Oracle Integration
Settlement layer that reasons over conflicting evidence to produce
final verdicts and natural-language rationale.

In production: calls Sphinx AI API.
In demo: generates rationale from agent assessment data.
"""
import httpx
import json
from models import (
    ClaimVerification, Settlement, RiskAction, Verdict, FindingType
)
from config import config


async def settle(
    session_id: str,
    verifications: list[ClaimVerification],
    overall_action: RiskAction,
) -> Settlement:
    """
    Produce a settlement report for the entire verification session.
    """
    # Try Sphinx API first
    if not config.DEMO_MODE and config.SPHINX_API_KEY:
        return await _settle_sphinx(session_id, verifications, overall_action)

    # Demo mode: generate from assessment data
    return _settle_local(session_id, verifications, overall_action)


async def _settle_sphinx(
    session_id: str,
    verifications: list[ClaimVerification],
    overall_action: RiskAction,
) -> Settlement:
    """Call Sphinx AI API for settlement adjudication."""
    try:
        # Build context for Sphinx
        claims_context = []
        for v in verifications:
            claims_context.append({
                "claim": v.claim.text,
                "risk_score": v.risk_score,
                "verdict": v.verdict.value,
                "assessments": [
                    {
                        "agent": a.agent_name,
                        "position": a.position.value,
                        "confidence": a.confidence,
                        "summary": a.summary,
                        "findings_count": len(a.findings),
                    }
                    for a in v.assessments
                ],
            })

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{config.SPHINX_API_URL}/reason",
                headers={
                    "Authorization": f"Bearer {config.SPHINX_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "task": "settlement_adjudication",
                    "context": {
                        "session_id": session_id,
                        "claims": claims_context,
                        "overall_action": overall_action.value,
                    },
                    "instructions": "Reason over the evidence from all verification agents. Produce a settlement verdict, confidence score, summary rationale, and recommendation. Focus on whether the claims are supported by evidence and highlight the most critical issues.",
                },
                timeout=20.0,
            )
            data = resp.json()

            return Settlement(
                session_id=session_id,
                oracle="Sphinx Reasoning Engine",
                confidence=data.get("confidence", 0.90),
                summary=data.get("summary", "Settlement produced by Sphinx."),
                evidence_supporting=data.get("supporting", 0),
                evidence_contradicting=data.get("contradicting", 0),
                evidence_neutral=data.get("neutral", 0),
                recommendation=data.get("recommendation", "Review required."),
            )

    except Exception as e:
        print(f"Sphinx API failed: {e}, falling back to local settlement")
        return _settle_local(session_id, verifications, overall_action)


def _settle_local(
    session_id: str,
    verifications: list[ClaimVerification],
    overall_action: RiskAction,
) -> Settlement:
    """Generate settlement from agent assessment data (demo mode)."""

    # Count evidence across all verifications
    total_supporting = 0
    total_contradicting = 0
    total_neutral = 0

    for v in verifications:
        for a in v.assessments:
            for f in a.findings:
                if f.type in (FindingType.CONFIRMED, FindingType.SUPPORTS, FindingType.CONSISTENT):
                    total_supporting += 1
                elif f.type in (FindingType.CONTRADICTION, FindingType.NOT_FOUND, FindingType.INCONSISTENCY):
                    total_contradicting += 1
                elif f.type in (FindingType.FLAG, FindingType.PATTERN):
                    total_neutral += 1

    # Count claim verdicts
    false_claims = [v for v in verifications if v.verdict == Verdict.FALSE]
    true_claims = [v for v in verifications if v.verdict == Verdict.TRUE]
    uncertain_claims = [v for v in verifications if v.verdict == Verdict.UNCERTAIN]

    total = len(verifications)

    # Build summary
    if false_claims and not true_claims:
        summary = f"All {total} claims failed verification. "
        summary += f"Found {total_contradicting} pieces of contradicting evidence across all agents. "
        summary += "No supporting evidence found for any claim."
        confidence = 0.95
    elif false_claims:
        summary = f"{len(false_claims)} of {total} claims are FALSE. "
        summary += f"{len(true_claims)} claim(s) verified TRUE. "
        # List the false claims
        false_texts = [v.claim.text[:50] for v in false_claims[:3]]
        summary += f"Failed claims: {'; '.join(false_texts)}."
        confidence = 0.90
    elif true_claims and len(true_claims) == total:
        summary = f"All {total} claims verified TRUE with {total_supporting} corroborating sources. "
        summary += "No contradicting evidence found."
        confidence = 0.97
    else:
        summary = f"{len(uncertain_claims)} claim(s) require further review. "
        summary += f"{len(true_claims)} verified, {len(false_claims)} failed."
        confidence = 0.75

    # Build recommendation
    if overall_action == RiskAction.BLOCK:
        recommendation = "Block output entirely. "
        if false_claims:
            recommendation += f"Rewrite the following claims with verified data: "
            recommendation += "; ".join(v.claim.text[:60] for v in false_claims[:3])
            recommendation += ". Flag session for human review."
    elif overall_action == RiskAction.REWRITE:
        recommendation = "Rewrite flagged claims with verified data before delivering to user. "
        if uncertain_claims:
            recommendation += f"{len(uncertain_claims)} claim(s) need manual verification."
    else:
        recommendation = "Allow output. All claims passed verification. No modifications needed."

    return Settlement(
        session_id=session_id,
        oracle="Sphinx Reasoning Engine",
        confidence=round(confidence, 2),
        summary=summary,
        evidence_supporting=total_supporting,
        evidence_contradicting=total_contradicting,
        evidence_neutral=total_neutral,
        recommendation=recommendation,
    )
