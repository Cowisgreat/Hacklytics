"""
Claim Extractor
Parses an LLM-generated response into structured, verifiable claims.
Uses LLM-based extraction when API keys are available, falls back to
rule-based extraction for demo mode.
"""
import re
import json
import httpx
from models import Claim, ClaimType, Severity
from config import config


# ─── Patterns for rule-based extraction ───

NUMERIC_PATTERNS = [
    r'(\d+\.?\d*)\s*%',                      # percentages
    r'\$\s*(\d+\.?\d*)\s*(billion|million|B|M|bn|mn)',  # dollar amounts
    r'(\d+\.?\d*)\s*x',                       # multipliers
]

CASE_LAW_PATTERN = r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+v\.\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Corp|Inc|LLC|LLP|Hospital|Center|Medical|County)\.?)?)\s*\((\d{4})\)'

EVENT_KEYWORDS = ["announced", "launched", "acquired", "merged", "filed", "settled", "signed", "approved"]


async def extract_claims_llm(response_text: str, domain: str = "finance") -> list[Claim]:
    """Extract claims using an LLM API call."""

    system_prompt = """You are a claim extraction engine. Given an AI-generated text response, extract all verifiable factual claims.

For each claim, output a JSON array where each element has:
- "text": the claim as a short declarative sentence
- "type": one of NUMERIC, ENTITY, EVENT, CASE_LAW, LEGAL, QUOTE, CAUSAL
- "severity": one of CRITICAL, HIGH, MED, LOW (based on how damaging it would be if wrong)
- "source_text": the exact span from the original text

Focus on claims that are:
1. Verifiable against external sources
2. Specific (not vague opinions)
3. Factual assertions (not hedged speculation)

Return ONLY valid JSON. No markdown, no explanation."""

    user_prompt = f"Domain: {domain}\n\nText to analyze:\n{response_text}"

    try:
        if config.LLM_PROVIDER == "anthropic" and config.ANTHROPIC_API_KEY:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": config.ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "claude-sonnet-4-20250514",
                        "max_tokens": 2000,
                        "system": system_prompt,
                        "messages": [{"role": "user", "content": user_prompt}],
                    },
                    timeout=30.0,
                )
                data = resp.json()
                text = data["content"][0]["text"]
                claims_data = json.loads(text.strip().strip("```json").strip("```"))

        elif config.LLM_PROVIDER == "openai" and config.OPENAI_API_KEY:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {config.OPENAI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "temperature": 0.1,
                    },
                    timeout=30.0,
                )
                data = resp.json()
                text = data["choices"][0]["message"]["content"]
                claims_data = json.loads(text.strip().strip("```json").strip("```"))
        else:
            return extract_claims_rules(response_text, domain)

        claims = []
        for i, cd in enumerate(claims_data):
            claims.append(Claim(
                id=f"CLM-{i+1:03d}",
                text=cd["text"],
                type=ClaimType(cd.get("type", "NUMERIC")),
                severity=Severity(cd.get("severity", "MED")),
                source_text=cd.get("source_text", cd["text"]),
            ))
        return claims

    except Exception as e:
        print(f"LLM extraction failed: {e}, falling back to rules")
        return extract_claims_rules(response_text, domain)


def extract_claims_rules(response_text: str, domain: str = "finance") -> list[Claim]:
    """Rule-based fallback claim extraction using regex patterns."""
    claims = []
    sentences = re.split(r'(?<=[.!?])\s+', response_text)
    claim_idx = 0

    for sent in sentences:
        sent = sent.strip()
        if len(sent) < 15:
            continue

        claim_type = None
        severity = Severity.MED

        # Check for case law citations
        case_match = re.search(CASE_LAW_PATTERN, sent)
        if case_match:
            claim_type = ClaimType.CASE_LAW
            severity = Severity.CRITICAL

        # Check for numeric claims
        elif any(re.search(p, sent) for p in NUMERIC_PATTERNS):
            claim_type = ClaimType.NUMERIC
            # Higher severity for larger numbers or percentages > 20%
            pct_match = re.search(r'(\d+\.?\d*)\s*%', sent)
            dollar_match = re.search(r'\$\s*(\d+\.?\d*)\s*(billion|B|bn)', sent, re.IGNORECASE)
            if pct_match and float(pct_match.group(1)) > 20:
                severity = Severity.HIGH
            if dollar_match:
                severity = Severity.HIGH

        # Check for event claims
        elif any(kw in sent.lower() for kw in EVENT_KEYWORDS):
            claim_type = ClaimType.EVENT
            severity = Severity.HIGH

        # Entity claims (contains proper nouns)
        elif re.search(r'[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,}', sent):
            claim_type = ClaimType.ENTITY
            severity = Severity.LOW

        if claim_type:
            claim_idx += 1
            claims.append(Claim(
                id=f"CLM-{claim_idx:03d}",
                text=sent,
                type=claim_type,
                severity=severity,
                source_text=sent,
            ))

    return claims


async def extract_claims(response_text: str, domain: str = "finance") -> list[Claim]:
    """Main entry point — tries LLM first, falls back to rules."""
    if config.DEMO_MODE:
        return extract_claims_rules(response_text, domain)
    return await extract_claims_llm(response_text, domain)
