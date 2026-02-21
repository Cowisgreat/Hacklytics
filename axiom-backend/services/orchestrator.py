"""
Verification Orchestrator
Coordinates the full Axiom pipeline:
1. Extract claims from LLM response
2. Run all agents in parallel on each claim
3. Aggregate risk scores
4. Settle with Sphinx oracle
5. Determine overall action

Supports both synchronous (REST) and streaming (WebSocket) modes.
"""
import asyncio
from typing import AsyncGenerator, Optional
from models import (
    VerificationSession, Claim, ClaimVerification,
    AgentAssessment, AgentSide, WSEvent, WSEventType,
    RiskAction
)
from agents import ALL_AGENTS
from services.claim_extractor import extract_claims
from services.risk_engine import aggregate_risk, determine_overall_action
from services.sphinx_oracle import settle


async def run_verification(
    prompt: str,
    response: str,
    domain: str = "finance",
) -> VerificationSession:
    """
    Run the full verification pipeline synchronously.
    Returns a complete VerificationSession.
    """
    session = VerificationSession(prompt=prompt, llm_response=response)

    # Step 1: Extract claims
    claims = await extract_claims(response, domain)
    session.claims = claims

    if not claims:
        session.overall_action = RiskAction.ALLOW
        return session

    # Step 2: Verify each claim with all agents
    all_verifications = []
    all_assessments = {}  # claim_id -> list of assessments (for ConsistencyBot)

    for claim in claims:
        # Run agents in parallel for this claim
        context = {
            "other_claims": [c for c in claims if c.id != claim.id],
            "other_assessments": all_assessments,
            "domain": domain,
        }

        agent_tasks = [agent.verify(claim, context) for agent in ALL_AGENTS]
        assessments = await asyncio.gather(*agent_tasks, return_exceptions=True)

        # Filter out any errors
        valid_assessments = [a for a in assessments if isinstance(a, AgentAssessment)]

        # Store for cross-claim dependency checking
        all_assessments[claim.id] = valid_assessments

        # Aggregate into verification result
        verification = aggregate_risk(claim, valid_assessments)
        all_verifications.append(verification)

    session.verifications = all_verifications

    # Step 3: Determine overall action
    overall_action = determine_overall_action(all_verifications)
    session.overall_action = overall_action

    # Step 4: Settlement
    settlement = await settle(session.id, all_verifications, overall_action)
    session.settlement = settlement

    return session


async def run_verification_streaming(
    prompt: str,
    response: str,
    domain: str = "finance",
) -> AsyncGenerator[WSEvent, None]:
    """
    Run the verification pipeline with streaming events.
    Yields WSEvent objects for real-time UI updates.
    """
    session = VerificationSession(prompt=prompt, llm_response=response)

    # Emit session created
    yield WSEvent(
        type=WSEventType.SESSION_CREATED,
        data={"session_id": session.id, "prompt": prompt},
    )

    # Step 1: Extract claims
    claims = await extract_claims(response, domain)
    session.claims = claims

    yield WSEvent(
        type=WSEventType.CLAIMS_EXTRACTED,
        data={
            "claims": [
                {
                    "id": c.id,
                    "text": c.text,
                    "type": c.type.value,
                    "severity": c.severity.value,
                }
                for c in claims
            ],
        },
    )

    if not claims:
        yield WSEvent(
            type=WSEventType.ACTION,
            data={"action": "ALLOW", "reason": "No verifiable claims found."},
        )
        return

    await asyncio.sleep(0.3)  # Brief pause for UI

    # Step 2: Verify each claim
    all_verifications = []
    all_assessments = {}

    for claim_idx, claim in enumerate(claims):
        context = {
            "other_claims": [c for c in claims if c.id != claim.id],
            "other_assessments": all_assessments,
            "domain": domain,
        }

        # Run agents — stream each agent's result as it completes
        for agent in ALL_AGENTS:
            assessment = await agent.verify(claim, context)

            # Emit agent quote event
            yield WSEvent(
                type=WSEventType.AGENT_QUOTE,
                data={
                    "claim_id": claim.id,
                    "agent_name": assessment.agent_name,
                    "position": assessment.position.value,
                    "confidence": assessment.confidence,
                    "summary": assessment.summary,
                    "findings_count": len(assessment.findings),
                },
            )

            if claim.id not in all_assessments:
                all_assessments[claim.id] = []
            all_assessments[claim.id].append(assessment)

            await asyncio.sleep(0.2)  # Stagger for visual effect

        # Aggregate risk for this claim
        verification = aggregate_risk(claim, all_assessments[claim.id])
        all_verifications.append(verification)

        # Emit risk update
        yield WSEvent(
            type=WSEventType.RISK_UPDATE,
            data={
                "claim_id": claim.id,
                "risk_score": verification.risk_score,
                "verdict": verification.verdict.value,
                "action": verification.action.value,
                "rationale": verification.rationale,
            },
        )

        await asyncio.sleep(0.3)

    session.verifications = all_verifications

    # Step 3: Overall action
    overall_action = determine_overall_action(all_verifications)
    session.overall_action = overall_action

    # Step 4: Settlement
    settlement = await settle(session.id, all_verifications, overall_action)
    session.settlement = settlement

    yield WSEvent(
        type=WSEventType.SETTLEMENT,
        data={
            "session_id": session.id,
            "oracle": settlement.oracle,
            "confidence": settlement.confidence,
            "summary": settlement.summary,
            "evidence_supporting": settlement.evidence_supporting,
            "evidence_contradicting": settlement.evidence_contradicting,
            "evidence_neutral": settlement.evidence_neutral,
            "recommendation": settlement.recommendation,
            "overall_action": overall_action.value,
        },
    )
