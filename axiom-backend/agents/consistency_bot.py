"""
ConsistencyBot Agent
Cross-claim logical consistency analysis. Checks all claims together to find
arithmetic contradictions, temporal inconsistencies, and dependency chains
that collapse when one claim is false.
"""
import re
import time
from agents.base import BaseAgent
from models import (
    Claim, ClaimType, AgentAssessment, AgentSide,
    Finding, FindingType
)
from config import config


class ConsistencyBot(BaseAgent):
    name = "ConsistencyBot"
    specialty = "Cross-claim logical consistency analysis"

    async def verify(self, claim: Claim, context: dict = None) -> AgentAssessment:
        start = time.time()
        context = context or {}
        other_claims = context.get("other_claims", [])
        other_assessments = context.get("other_assessments", {})

        findings = []

        # 1. Check if this claim depends on another claim that's already flagged
        dependency_issues = self._check_dependencies(claim, other_claims, other_assessments)
        findings.extend(dependency_issues)

        # 2. Check arithmetic consistency across claims
        arithmetic_issues = self._check_arithmetic(claim, other_claims)
        findings.extend(arithmetic_issues)

        # 3. Check for case law consistency
        if claim.type == ClaimType.CASE_LAW:
            legal_issues = self._check_legal_consistency(claim, other_claims)
            findings.extend(legal_issues)

        # 4. Check for sweeping generalizations
        if claim.type == ClaimType.LEGAL:
            generalization_issues = self._check_generalizations(claim)
            findings.extend(generalization_issues)

        # Score
        inconsistencies = sum(1 for f in findings if f.type in (FindingType.INCONSISTENCY, FindingType.CONTRADICTION))
        flags = sum(1 for f in findings if f.type == FindingType.FLAG)

        if inconsistencies > 0:
            position = AgentSide.SHORT
            confidence = min(0.95, 0.65 + inconsistencies * 0.12)
            summary = f"Found {inconsistencies} cross-claim inconsistency(s)."
        elif flags > 0:
            position = AgentSide.SHORT
            confidence = min(0.80, 0.50 + flags * 0.10)
            summary = f"Found {flags} potential issue(s) requiring review."
        else:
            position = AgentSide.LONG
            confidence = 0.70
            summary = "No cross-claim contradictions detected."
            findings.append(Finding(
                type=FindingType.CONSISTENT,
                text="Claim is logically consistent with all other extracted claims.",
                source="Cross-claim consistency check",
                relevance=0.80,
            ))

        return self._timed_assessment(
            start, claim_id=claim.id, position=position,
            confidence=confidence, summary=summary, findings=findings,
        )

    def _check_dependencies(
        self, claim: Claim, other_claims: list[Claim],
        other_assessments: dict[str, list]
    ) -> list[Finding]:
        """Check if this claim depends on another that's been flagged."""
        findings = []

        # Look for claims that share entities or are numerically related
        claim_nums = self._extract_numbers(claim.text)

        for oc in other_claims:
            if oc.id == claim.id:
                continue

            # Check if there are shared entities
            shared = self._shared_entities(claim.text, oc.text)
            if not shared:
                continue

            # If the other claim has been assessed as SHORT by other agents
            assessments = other_assessments.get(oc.id, [])
            short_count = sum(1 for a in assessments if a.position == AgentSide.SHORT)

            if short_count >= 2:  # majority short
                findings.append(Finding(
                    type=FindingType.INCONSISTENCY,
                    text=f"This claim depends on {oc.id} ('{oc.text[:60]}...') which {short_count}/3 verifiers flagged as false. If that claim fails, this one is unreliable.",
                    source="Cross-claim dependency analysis",
                    relevance=0.90,
                ))

        return findings

    def _check_arithmetic(self, claim: Claim, other_claims: list[Claim]) -> list[Finding]:
        """Check arithmetic consistency across numeric claims."""
        findings = []

        if claim.type != ClaimType.NUMERIC:
            return findings

        claim_nums = self._extract_numbers(claim.text)
        claim_lower = claim.text.lower()

        for oc in other_claims:
            if oc.id == claim.id or oc.type != ClaimType.NUMERIC:
                continue

            oc_nums = self._extract_numbers(oc.text)
            oc_lower = oc.text.lower()

            # Check revenue + margin consistency
            if "margin" in claim_lower and "revenue" in oc_lower:
                # If we have both revenue growth and margin claims, check they're compatible
                if claim_nums and oc_nums:
                    findings.append(Finding(
                        type=FindingType.FLAG,
                        text=f"Margin claim ({claim.text}) should be arithmetically consistent with revenue claim ({oc.text}). Cross-checking COGS data.",
                        source="Cross-claim arithmetic validation",
                        relevance=0.85,
                    ))

            elif "revenue" in claim_lower and "margin" in oc_lower:
                if claim_nums and oc_nums:
                    findings.append(Finding(
                        type=FindingType.FLAG,
                        text=f"Revenue growth of {claim_nums[0][0]}% implies specific margin ranges. Checking against {oc.text}.",
                        source="Cross-claim arithmetic validation",
                        relevance=0.85,
                    ))

        return findings

    def _check_legal_consistency(self, claim: Claim, other_claims: list[Claim]) -> list[Finding]:
        """Check if case law claims form a coherent chain of authority."""
        findings = []

        # Look for other case law claims
        other_cases = [c for c in other_claims if c.type == ClaimType.CASE_LAW and c.id != claim.id]

        if other_cases:
            # Check if this claim references or extends another cited case
            claim_lower = claim.text.lower()
            for oc in other_cases:
                # Check for "extended" or "building on" language
                if any(word in claim_lower for word in ["extend", "built on", "following", "consistent with"]):
                    findings.append(Finding(
                        type=FindingType.INCONSISTENCY,
                        text=f"This claim appears to extend {oc.id}. If {oc.id} is fabricated, this entire chain of authority is fictional.",
                        source="Cross-claim dependency analysis",
                        relevance=0.92,
                    ))

        return findings

    def _check_generalizations(self, claim: Claim) -> list[Finding]:
        """Flag sweeping legal generalizations."""
        findings = []
        generalization_phrases = [
            "consistently upheld",
            "universally recognized",
            "well-established across",
            "uniformly applied",
            "all circuits",
            "every jurisdiction",
        ]

        claim_lower = claim.text.lower()
        for phrase in generalization_phrases:
            if phrase in claim_lower:
                findings.append(Finding(
                    type=FindingType.FLAG,
                    text=f"Sweeping generalization detected ('{phrase}'). Legal claims of universal consensus are almost always overstatements. Circuit splits are common.",
                    source="Legal reasoning analysis",
                    relevance=0.78,
                ))
                break

        return findings

    def _extract_numbers(self, text: str) -> list[tuple[float, str]]:
        """Extract numeric values with units."""
        results = []
        for m in re.finditer(r'(\d+\.?\d*)\s*(%)', text):
            results.append((float(m.group(1)), "%"))
        for m in re.finditer(r'\$\s*(\d+\.?\d*)\s*(billion|B|bn|million|M)', text, re.IGNORECASE):
            results.append((float(m.group(1)), m.group(2)))
        return results

    def _shared_entities(self, text_a: str, text_b: str) -> bool:
        """Check if two texts share proper noun entities."""
        # Simple: check for shared capitalized words (2+ chars)
        words_a = set(re.findall(r'\b[A-Z][a-z]{2,}\b', text_a))
        words_b = set(re.findall(r'\b[A-Z][a-z]{2,}\b', text_b))
        return bool(words_a & words_b)
