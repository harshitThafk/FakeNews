"""
RAG (Retrieval-Augmented Generation) Pipeline
- Converts search results → embeddings
- Stores in FAISS vector store
- Retrieves most relevant chunks for agent reasoning
"""

import logging
import numpy as np
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class RAGPipeline:
    def __init__(self):
        self.encoder = None
        self.index = None
        self.documents: List[str] = []
        self.metadata: List[Dict] = []
        self._init_encoder()
        self._init_index()

    def _init_encoder(self):
        """Load sentence transformer for embeddings."""
        try:
            from sentence_transformers import SentenceTransformer
            self.encoder = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("✅ Sentence transformer loaded")
        except Exception as e:
            logger.warning(f"Sentence transformer unavailable: {e}. Using TF-IDF fallback.")
            self._init_tfidf_fallback()

    def _init_tfidf_fallback(self):
        """TF-IDF based similarity when sentence-transformers not available."""
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        self.tfidf = TfidfVectorizer(max_features=5000, stop_words="english")
        self.cosine_similarity = cosine_similarity
        self.use_tfidf = True

    def _init_index(self):
        """Initialize FAISS index."""
        try:
            import faiss
            self.faiss = faiss
            self.embedding_dim = 384  # all-MiniLM-L6-v2 dimension
            self.index = faiss.IndexFlatIP(self.embedding_dim)  # Inner product (cosine)
            logger.info("✅ FAISS index initialized")
        except Exception as e:
            logger.warning(f"FAISS unavailable: {e}. Using numpy fallback.")
            self.index = None

    def add_documents(self, texts: List[str], metadata: Optional[List[Dict]] = None):
        """Embed and index new documents."""
        if not texts:
            return

        self.documents.extend(texts)
        self.metadata.extend(metadata or [{}] * len(texts))

        if self.encoder and self.index is not None:
            try:
                embeddings = self.encoder.encode(texts, normalize_embeddings=True)
                self.index.add(embeddings.astype(np.float32))
            except Exception as e:
                logger.warning(f"Embedding failed: {e}")
        elif hasattr(self, "tfidf"):
            # Rebuild TF-IDF matrix
            self.tfidf_matrix = self.tfidf.fit_transform(self.documents)

    def retrieve(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Retrieve most relevant document chunks for a query."""
        if not self.documents:
            return []

        try:
            if self.encoder and self.index is not None and self.index.ntotal > 0:
                return self._faiss_retrieve(query, top_k)
            elif hasattr(self, "tfidf") and hasattr(self, "tfidf_matrix"):
                return self._tfidf_retrieve(query, top_k)
        except Exception as e:
            logger.warning(f"Retrieval failed: {e}")

        return []

    def _faiss_retrieve(self, query: str, top_k: int) -> List[Dict]:
        query_emb = self.encoder.encode([query], normalize_embeddings=True).astype(np.float32)
        scores, indices = self.index.search(query_emb, min(top_k, self.index.ntotal))
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and float(score) > 0.3:
                results.append({
                    "text": self.documents[idx][:500],
                    "score": float(score),
                    "metadata": self.metadata[idx] if idx < len(self.metadata) else {},
                })
        return results

    def _tfidf_retrieve(self, query: str, top_k: int) -> List[Dict]:
        query_vec = self.tfidf.transform([query])
        sims = self.cosine_similarity(query_vec, self.tfidf_matrix)[0]
        top_indices = sims.argsort()[::-1][:top_k]
        
        return [
            {
                "text": self.documents[i][:500],
                "score": float(sims[i]),
                "metadata": self.metadata[i] if i < len(self.metadata) else {},
            }
            for i in top_indices
            if sims[i] > 0.1
        ]

    def index_search_results(self, search_results: List[Dict], query: str) -> List[str]:
        """
        Given live search results, chunk + index them, then retrieve relevant chunks.
        Returns list of relevant text snippets.
        """
        if not search_results:
            return []

        # Prepare chunks
        chunks = []
        meta = []
        for r in search_results:
            parts = []
            if r.get("title"):
                parts.append(r["title"])
            if r.get("snippet"):
                parts.append(r["snippet"])
            if parts:
                chunks.append(" | ".join(parts))
                meta.append({"source": r.get("source", ""), "url": r.get("url", ""), "credibility": r.get("credibility", "unknown")})

        # Reset and re-index for this query (ephemeral RAG)
        self.documents = []
        self.metadata = []
        if self.index is not None:
            self.index.reset()
        elif hasattr(self, "tfidf"):
            self.tfidf_matrix = None

        self.add_documents(chunks, meta)
        results = self.retrieve(query, top_k=5)
        
        return [r["text"] for r in results]
