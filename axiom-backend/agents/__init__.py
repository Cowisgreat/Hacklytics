"""Agent registry — single import point for all verification agents."""
from agents.numeric_verifier import NumericVerifier
from agents.retriever_agent import RetrieverAgent
from agents.consistency_bot import ConsistencyBot

ALL_AGENTS = [
    NumericVerifier(),
    RetrieverAgent(),
    ConsistencyBot(),
]

AGENT_MAP = {a.name: a for a in ALL_AGENTS}
