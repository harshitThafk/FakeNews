"""
Fake News Checker - ML Service (FastAPI)
Handles: ML prediction, RAG pipeline, Agentic reasoning
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from models.classifier import FakeNewsClassifier
from rag.pipeline import RAGPipeline
from agent.reasoner import FakeNewsAgent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Global instances (loaded once at startup) ──────────────────────────────
classifier: Optional[FakeNewsClassifier] = None
rag: Optional[RAGPipeline] = None
agent: Optional[FakeNewsAgent] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global classifier, rag, agent
    logger.info("🚀 Loading ML models...")
    
    try:
        classifier = FakeNewsClassifier()
        classifier.load_or_train()
        logger.info("✅ Classifier ready")
    except Exception as e:
        logger.warning(f"⚠️  Classifier failed to load: {e}")
        classifier = FakeNewsClassifier(fallback_mode=True)

    try:
        rag = RAGPipeline()
        logger.info("✅ RAG pipeline ready")
    except Exception as e:
        logger.warning(f"⚠️  RAG failed to init: {e}")

    try:
        agent = FakeNewsAgent(rag_pipeline=rag)
        logger.info("✅ Agent ready")
    except Exception as e:
        logger.warning(f"⚠️  Agent failed to init: {e}")

    yield
    logger.info("Shutting down ML service...")


app = FastAPI(
    title="Fake News Checker ML Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ─────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    text: str


class PredictResponse(BaseModel):
    prediction: str  # "fake" | "real" | "uncertain"
    confidence: float
    features: Optional[Dict[str, Any]] = None


class SearchResult(BaseModel):
    title: Optional[str]
    url: Optional[str]
    snippet: Optional[str]
    source: Optional[str]
    credibility: Optional[str] = "unknown"


class AgentRequest(BaseModel):
    text: str
    ml_prediction: Dict[str, Any]
    search_results: List[SearchResult] = []


class AgentResponse(BaseModel):
    final_verdict: str
    confidence_score: int
    explanation: str
    sources: List[Dict]
    rag_chunks: List[str]
    reasoning_steps: List[str]


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "classifier": classifier is not None,
        "rag": rag is not None,
        "agent": agent is not None,
    }


@app.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    if not classifier:
        raise HTTPException(status_code=503, detail="Classifier not loaded")
    
    if not req.text or len(req.text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Text too short")
    
    try:
        result = classifier.predict(req.text)
        return result
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/agent", response_model=AgentResponse)
async def run_agent(req: AgentRequest):
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not loaded")
    
    try:
        result = await agent.analyze(
            text=req.text,
            ml_prediction=req.ml_prediction,
            search_results=[s.dict() for s in req.search_results],
        )
        return result
    except Exception as e:
        logger.error(f"Agent error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/index")
async def index_documents(documents: List[str]):
    """Add documents to the RAG index (for MLOps pipeline updates)."""
    if not rag:
        raise HTTPException(status_code=503, detail="RAG not loaded")
    rag.add_documents(documents)
    return {"indexed": len(documents)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
