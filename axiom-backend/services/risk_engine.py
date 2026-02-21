"""
Risk Aggregation Engine
Combines multiple agent assessments into a single risk score per claim.
Uses weighted consensus (not simple averaging) to preserve disagreement signal.
Determines allow/rewrite/block action based on configurable thresholds.
"""
from models import (
    Claim, ClaimVerification, AgentAssessment, AgentSide,
    Verdict, RiskAction, Severity
)
from config import config


# Agent reliability weights (can be calibrated over time)
AGENT_WEIGHTS = {
    "NumericVerifier": 1.0,
    "RetrieverAgent": 0.9,
    "ConsistencyBot": 0.8,
}

# Severity multipliers — higher severity = stricter thresholds
SEVERITY_MULTIPLIERS = {
    Severity.CRITICAL: 1.20,
    Severity.HIGH: 1.10,
    Severity.MED: 1.00,
    Severity.LOW: 0.85,
}


def aggregate_risk(
    claim: Claim,
    assessments: list[AgentAssessment],
) -> ClaimVerification:
    """
    Aggregate agent assessments into a final risk score + action.

    The key insight: we don't just average confidence scores.
    We weight by agent reliability and evidence quality, and
    surface disagreement as risk.
    """
    if not assessments:
        return ClaimVerification(
            claim=claim,
            risk_score=0.50,
            verdict=Verdict.UNCERTAIN,
            action=RiskAction.BLOCK,
            rationale="No agent assessments available.",
            assessments=assessments,
        )

    # ─── Step 1: Compute weighted truth probability ───
    # Each agent "votes" with a truth probability:
    #   LONG position → truth_prob = confidence
    #   SHORT position → truth_prob = 1 - confidence
    weighted_sum = 0.0
    weight_total = 0.0

    for a in assessments:
        w = AGENT_WEIGHTS.get(a.agent_name, 0.8)

        # Weight by evidence quality (number and relevance of findings)
        if a.findings:
            avg_relevance = sum(f.relevance for f in a.findings) / len(a.findings)
            evidence_weight = 0.7 + 0.3 * avg_relevance  # 0.7 to 1.0
        else:
            evidence_weight = 0.5

        effective_weight = w * evidence_weight

        if a.position == AgentSide.LONG:
            truth_prob = a.confidence
        else:
            truth_prob = 1.0 - a.confidence

        weighted_sum += truth_prob * effective_weight
        weight_total += effective_weight

    risk_score = weighted_sum / weight_total if weight_total > 0 else 0.5

    # ─── Step 2: Disagreement penalty ───
    # If agents disagree, widen uncertainty (reduce risk_score toward 0.5)
    positions = [a.position for a in assessments]
    long_count = positions.count(AgentSide.LONG)
    short_count = positions.count(AgentSide.SHORT)

    if long_count > 0 and short_count > 0:
        # There's disagreement — apply penalty proportional to minority share
        minority_share = min(long_count, short_count) / len(positions)
        disagreement_penalty = minority_share * 0.15  # max 0.075 for 50/50 split
        # Push risk_score toward 0.5
        risk_score = risk_score * (1 - disagreement_penalty) + 0.5 * disagreement_penalty

    # ─── Step 3: Severity adjustment ───
    severity_mult = SEVERITY_MULTIPLIERS.get(claim.severity, 1.0)

    # For high severity claims, we need MORE confidence to allow
    # This effectively raises the threshold
    adjusted_allow = config.RISK_THRESHOLD_ALLOW * severity_mult
    adjusted_rewrite = config.RISK_THRESHOLD_REWRITE * severity_mult

    # Clamp thresholds
    adjusted_allow = min(adjusted_allow, 0.95)
    adjusted_rewrite = min(adjusted_rewrite, adjusted_allow - 0.05)

    # ─── Step 4: Determine verdict and action ───
    if risk_score >= adjusted_allow:
        verdict = Verdict.TRUE
        action = RiskAction.ALLOW
    elif risk_score >= adjusted_rewrite:
        verdict = Verdict.UNCERTAIN
        action = RiskAction.REWRITE
    else:
        verdict = Verdict.FALSE
        action = RiskAction.BLOCK

    # ─── Step 5: Generate rationale ───
    rationale = _generate_rationale(claim, assessments, risk_score, verdict, action)

    return ClaimVerification(
        claim=claim,
        risk_score=round(risk_score, 4),
        verdict=verdict,
        action=action,
        rationale=rationale,
        assessments=assessments,
    )


def _generate_rationale(
    claim: Claim,
    assessments: list[AgentAssessment],
    risk_score: float,
    verdict: Verdict,
    action: RiskAction,
) -> str:
    """Generate human-readable rationale for the verification result."""
    parts = []

    short_agents = [a for a in assessments if a.position == AgentSide.SHORT]
    long_agents = [a for a in assessments if a.position == AgentSide.LONG]

    if verdict == Verdict.FALSE:
        parts.append(f"Claim scored {risk_score:.0%} factuality.")
        if short_agents:
            agent_names = ", ".join(a.agent_name for a in short_agents)
            parts.append(f"{len(short_agents)}/3 verifiers flagged issues ({agent_names}).")
            # Include top finding
            all_findings = [f for a in short_agents for f in a.findings]
            if all_findings:
                top = max(all_findings, key=lambda f: f.relevance)
                parts.append(f"Key finding: {top.text[:120]}")

    elif verdict == Verdict.TRUE:
        parts.append(f"Claim verified with {risk_score:.0%} confidence.")
        if long_agents:
            parts.append(f"{len(long_agents)}/3 verifiers confirmed.")
            total_evidence = sum(len(a.findings) for a in long_agents)
            parts.append(f"{total_evidence} supporting evidence items found.")

    else:
        parts.append(f"Claim scored {risk_score:.0%} — insufficient confidence to allow or block.")
        parts.append("Routed for human review with suggested rewrites.")

    return " ".join(parts)


def determine_overall_action(verifications: list[ClaimVerification]) -> RiskAction:
    """Determine the overall action for the entire response based on all claim verifications."""
    if not verifications:
        return RiskAction.BLOCK

    actions = [v.action for v in verifications]

    # If ANY critical/high severity claim is blocked, block the whole response
    for v in verifications:
        if v.action == RiskAction.BLOCK and v.claim.severity in (Severity.CRITICAL, Severity.HIGH):
            return RiskAction.BLOCK

    # If any claim needs rewriting, the response needs rewriting
    if RiskAction.REWRITE in actions:
        return RiskAction.REWRITE

    # If any claim is blocked (even low severity), at least rewrite
    if RiskAction.BLOCK in actions:
        return RiskAction.REWRITE

    return RiskAction.ALLOW
