"""
Base Verification Agent
All agents inherit from this and implement the `verify` method.
"""
from abc import ABC, abstractmethod
from models import Claim, AgentAssessment
import time


class BaseAgent(ABC):
    name: str = "BaseAgent"
    specialty: str = ""

    @abstractmethod
    async def verify(self, claim: Claim, context: dict = None) -> AgentAssessment:
        """Verify a single claim and return an assessment."""
        pass

    def _timed_assessment(self, start: float, **kwargs) -> AgentAssessment:
        """Helper to create an assessment with latency tracking."""
        return AgentAssessment(
            agent_name=self.name,
            latency_ms=round((time.time() - start) * 1000, 1),
            **kwargs,
        )
