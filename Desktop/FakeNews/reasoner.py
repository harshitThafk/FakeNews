"""
Fake News Agent — v2 (Deep Reasoning + Cited Sources)
══════════════════════════════════════════════════════
Multi-step agentic pipeline:

  Step 1 → Linguistic analysis of the claim
  Step 2 → ML model signal assessment
  Step 3 → Fact-check database lookup (explicit ratings)
  Step 4 → News source corroboration (count + credibility)
  Step 5 → RAG evidence retrieval and semantic matching
  Step 6 → Source contradiction detection
  Step 7 → Composite scoring + verdict
  Step 8 → Generate detailed cited explanation

Each reasoning step is logged and returned for transparency.
Sources are cited inline in the explanation with [1], [2] notation.
"""

import logging
import os
import re
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# Fact-check rating → verdict mapping
FACTCHECK_VERDICT_MAP = {
    # False
    "false": -90, "pants on fire": -95, "four pinocchios": -90, "pants-on-fire": -95,
    "incorrect": -80, "mostly false": -70, "misleading": -60, "half true": -30,
    "unproven": -20, "unverified": -20, "disputed": -40, "lacks context": -25,
    "not true": -85, "fake": -90, "fabricated": -95, "hoax": -95, "satire": -80,
    # True
    "true": 90, "mostly true": 70, "correct": 80, "accurate": 80,
    "verified": 75, "confirmed": 80, "real": 85, "fact": 85,
    "three pinocchios": -60, "two pinocchios": -40, "one pinocchio": -20, "geppetto checkmark": 80,
}


class FakeNewsAgent:
    def __init__(self, rag_pipeline=None):
        self.rag = rag_pipeline
        self.use_llm = bool(os.getenv("OPENAI_API_KEY"))
        if self.use_llm:
            logger.info("LLM-enhanced agent mode active (GPT-4o-mini)")
        else:
            logger.info("Rule-based agent v2 active")

    async def analyze(
        self,
        text: str,
        ml_prediction: Dict[str, Any],
        search_results: List[Dict],
    ) -> Dict[str, Any]:
        """Full agentic analysis with cited reasoning."""

        reasoning_steps = []
        evidence_log = []

        # ── Step 1: Linguistic analysis ────────────────────────────────
        linguistic = ml_prediction.get("features", {}).get("linguistic_signals", {})
        fake_signals = linguistic.get("fake_signals", {})
        real_signals = linguistic.get("real_signals", {})

        if fake_signals:
            signal_desc = ", ".join([f"{cat} ({', '.join(sigs[:2])})" for cat, sigs in list(fake_signals.items())[:3]])
            reasoning_steps.append(f"🔍 Linguistic analysis detected fake-news patterns: {signal_desc}")
        if real_signals:
            signal_desc = ", ".join([f"{cat}" for cat in list(real_signals.keys())[:3]])
            reasoning_steps.append(f"✓ Credibility signals found: {signal_desc}")
        if not fake_signals and not real_signals:
            reasoning_steps.append("⚪ Linguistic analysis: neutral writing style detected")

        # ── Step 2: ML model signal ────────────────────────────────────
        ml_label = ml_prediction.get("prediction", "uncertain")
        ml_conf = float(ml_prediction.get("confidence", 0.5))
        model_used = ml_prediction.get("model_used", "unknown")
        reasoning_steps.append(
            f"🤖 ML Model ({model_used}): predicts {ml_label.upper()} "
            f"with {ml_conf:.0%} confidence"
        )

        # ── Step 3: Fact-check results ──────────────────────────────────
        fact_checks = [r for r in search_results if r.get("type") == "fact-check" or r.get("credibility") == "fact-check"]
        factcheck_score = 0
        factcheck_summary = []

        for fc in fact_checks:
            rating = (fc.get("factCheckRating") or fc.get("snippet", "")).lower()
            publisher = fc.get("factCheckPublisher") or fc.get("source", "Unknown")
            score_delta = self._parse_factcheck_rating(rating)
            factcheck_score += score_delta
            direction = "FALSE" if score_delta < 0 else "TRUE" if score_delta > 0 else "MIXED"
            factcheck_summary.append(f"{publisher}: '{fc.get('factCheckRating', rating[:50])}' → {direction}")
            evidence_log.append({
                "type": "fact_check", "source": publisher,
                "rating": fc.get("factCheckRating", rating[:80]),
                "url": fc.get("url"), "score_contribution": score_delta,
            })

        if fact_checks:
            fc_avg = factcheck_score / len(fact_checks)
            reasoning_steps.append(
                f"✅ Found {len(fact_checks)} fact-check result(s): " +
                " | ".join(factcheck_summary[:3])
            )
        else:
            reasoning_steps.append("⚠️ No dedicated fact-check results found for this claim")

        # ── Step 4: News source corroboration ──────────────────────────
        news_results = [r for r in search_results if r.get("type") in ("news", None) and r.get("credibility") != "fact-check"]
        high_cred = [r for r in news_results if r.get("credibility") == "high"]
        med_cred  = [r for r in news_results if r.get("credibility") == "medium"]
        low_cred  = [r for r in news_results if r.get("credibility") == "low"]
        wiki      = [r for r in search_results if r.get("type") == "encyclopedia"]

        corroboration_score = 0
        if len(high_cred) >= 3:
            corroboration_score = 35
        elif len(high_cred) == 2:
            corroboration_score = 25
        elif len(high_cred) == 1:
            corroboration_score = 15
        elif len(med_cred) >= 3:
            corroboration_score = 10
        elif len(news_results) == 0:
            corroboration_score = -15
        if len(low_cred) > len(high_cred):
            corroboration_score -= 20

        reasoning_steps.append(
            f"📰 Source analysis: {len(high_cred)} high-credibility, "
            f"{len(med_cred)} medium, {len(low_cred)} low-credibility sources | "
            f"{'Wikipedia context available' if wiki else 'No Wikipedia context'}"
        )

        # Add high-cred sources to evidence log
        for r in high_cred[:5]:
            evidence_log.append({
                "type": "corroboration", "source": r.get("source"),
                "title": r.get("title"), "url": r.get("url"),
                "snippet": r.get("snippet", "")[:200],
            })

        # ── Step 5: RAG evidence retrieval ─────────────────────────────
        rag_chunks = []
        rag_sources = []
        if self.rag and search_results:
            rag_chunks = self.rag.index_search_results(search_results, text[:300])
            rag_sources = [r.get("source", "") for r in search_results[:5]]
            reasoning_steps.append(
                f"🧠 RAG retrieved {len(rag_chunks)} relevant evidence chunks "
                f"from the indexed sources"
            )
        else:
            reasoning_steps.append("⚪ RAG: no source documents available for retrieval")

        rag_boost = min(len(rag_chunks) * 5, 20)

        # ── Step 6: Contradiction detection ────────────────────────────
        contradictions = self._detect_contradictions(search_results)
        if contradictions:
            reasoning_steps.append(
                f"⚡ Contradiction detected: sources disagree on this topic "
                f"({len(contradictions)} conflicting signal(s))"
            )
        else:
            reasoning_steps.append("✓ No direct contradictions found among sources")

        # ── Step 7: Composite scoring ───────────────────────────────────
        composite = self._compute_composite_score(
            ml_label, ml_conf, factcheck_score, corroboration_score, rag_boost,
            len(fact_checks), len(contradictions), linguistic
        )
        reasoning_steps.append(
            f"📊 Composite score: {composite['score']:+.1f} | "
            f"ML={composite['ml_contribution']:+.1f}, "
            f"FactCheck={composite['factcheck_contribution']:+.1f}, "
            f"Sources={composite['source_contribution']:+.1f}, "
            f"RAG={composite['rag_contribution']:+.1f}, "
            f"Linguistic={composite['linguistic_contribution']:+.1f}"
        )

        # ── Step 8: Verdict + cited explanation ────────────────────────
        verdict_data = self._determine_verdict(composite["score"])
        reasoning_steps.append(
            f"🏁 Final verdict: {verdict_data['verdict']} ({verdict_data['confidence']}% confidence)"
        )

        # Use LLM if available, otherwise generate structured rule-based explanation
        if self.use_llm:
            explanation, cited_sources = await self._llm_explanation(
                text, verdict_data, ml_prediction, search_results, rag_chunks, reasoning_steps
            )
        else:
            explanation, cited_sources = self._build_cited_explanation(
                text, verdict_data, ml_label, ml_conf, model_used,
                fact_checks, high_cred, med_cred, low_cred, wiki,
                rag_chunks, linguistic, contradictions, composite
            )

        return {
            "final_verdict": verdict_data["verdict"],
            "confidence_score": verdict_data["confidence"],
            "explanation": explanation,
            "cited_sources": cited_sources,
            "sources": self._format_sources(search_results),
            "rag_chunks": rag_chunks,
            "reasoning_steps": reasoning_steps,
            "evidence_log": evidence_log,
            "score_breakdown": composite,
        }

    # ── Composite Scoring ─────────────────────────────────────────────────

    def _compute_composite_score(
        self, ml_label, ml_conf, factcheck_score, corroboration_score,
        rag_boost, num_factchecks, num_contradictions, linguistic
    ) -> Dict[str, float]:
        """
        Weighted composite score:
          - Fact-checks:   40% weight (highest — explicit human verification)
          - ML model:      25% weight
          - Source corroboration: 20%
          - RAG evidence:  10%
          - Linguistic:    5%
        """
        # ML contribution
        if ml_label == "fake":
            ml_contrib = -25 * ml_conf
        elif ml_label == "real":
            ml_contrib = 25 * ml_conf
        else:
            ml_contrib = 0.0

        # Fact-check contribution (dominant if present)
        if num_factchecks > 0:
            fc_avg = factcheck_score / num_factchecks
            fc_contrib = min(max(fc_avg * 0.4, -40), 40)
        else:
            fc_contrib = 0.0

        # Source corroboration
        src_contrib = float(corroboration_score) * 0.20

        # RAG
        rag_contrib = float(rag_boost) * 0.10

        # Linguistic
        fs = linguistic.get("fake_score", 0) if linguistic else 0
        rs = linguistic.get("real_score", 0) if linguistic else 0
        if fs + rs > 0:
            ling_ratio = (rs - fs) / (rs + fs)
            ling_contrib = ling_ratio * 5
        else:
            ling_contrib = 0.0

        # Contradiction penalty
        contradiction_penalty = num_contradictions * -3

        total = ml_contrib + fc_contrib + src_contrib + rag_contrib + ling_contrib + contradiction_penalty

        return {
            "score": round(total, 2),
            "ml_contribution": round(ml_contrib, 2),
            "factcheck_contribution": round(fc_contrib, 2),
            "source_contribution": round(src_contrib, 2),
            "rag_contribution": round(rag_contrib, 2),
            "linguistic_contribution": round(ling_contrib, 2),
            "contradiction_penalty": round(contradiction_penalty, 2),
        }

    def _determine_verdict(self, score: float) -> Dict[str, Any]:
        if score <= -30:
            return {"verdict": "FAKE", "confidence": min(95, int(60 + abs(score)))}
        elif score <= -12:
            return {"verdict": "LIKELY FAKE", "confidence": min(82, int(55 + abs(score)))}
        elif score >= 28:
            return {"verdict": "REAL", "confidence": min(95, int(55 + score))}
        elif score >= 12:
            return {"verdict": "LIKELY REAL", "confidence": min(80, int(52 + score))}
        else:
            return {"verdict": "UNCERTAIN", "confidence": 50}

    def _parse_factcheck_rating(self, rating_text: str) -> int:
        if not rating_text:
            return 0
        lower = rating_text.lower()
        for key, val in FACTCHECK_VERDICT_MAP.items():
            if key in lower:
                return val
        return 0

    def _detect_contradictions(self, search_results: List[Dict]) -> List[str]:
        """Look for sources that explicitly mark something as fact-checked false vs corroborating."""
        fc_false = [r for r in search_results if r.get("type") == "fact-check" and
                    any(w in (r.get("factCheckRating") or "").lower()
                        for w in ["false", "fake", "incorrect", "misleading"])]
        fc_true = [r for r in search_results if r.get("type") == "fact-check" and
                   any(w in (r.get("factCheckRating") or "").lower()
                       for w in ["true", "correct", "accurate", "verified"])]
        contradictions = []
        if fc_false and fc_true:
            contradictions.append(f"fact-checkers disagree: {len(fc_false)} say false, {len(fc_true)} say true")
        return contradictions

    # ── Explanation Generation ────────────────────────────────────────────

    def _build_cited_explanation(
        self, text, verdict_data, ml_label, ml_conf, model_used,
        fact_checks, high_cred, med_cred, low_cred, wiki,
        rag_chunks, linguistic, contradictions, composite
    ) -> Tuple[str, List[Dict]]:
        """Build a detailed explanation with inline [N] source citations."""

        verdict = verdict_data["verdict"]
        confidence = verdict_data["confidence"]
        cited_sources = []
        ref_num = [1]  # mutable counter

        def add_source(source_dict) -> str:
            n = ref_num[0]
            cited_sources.append({"ref": n, **source_dict})
            ref_num[0] += 1
            return f"[{n}]"

        paragraphs = []

        # Opening verdict statement
        verb = {
            "FAKE": "determined to be **FAKE**",
            "LIKELY FAKE": "assessed as **LIKELY FAKE**",
            "UNCERTAIN": "**UNCERTAIN** — insufficient evidence for a definitive verdict",
            "LIKELY REAL": "assessed as **LIKELY REAL**",
            "REAL": "verified as **REAL**",
        }.get(verdict, verdict)

        paragraphs.append(f"This claim has been {verb} with {confidence}% confidence based on a multi-layer analysis.")

        # Fact-check findings (most authoritative — mention first)
        if fact_checks:
            fc_parts = []
            for fc in fact_checks[:3]:
                ref = add_source({
                    "title": fc.get("title", fc.get("source", "Fact Checker")),
                    "url": fc.get("url", "#"),
                    "source": fc.get("factCheckPublisher") or fc.get("source"),
                    "credibility": "fact-check",
                    "factCheckRating": fc.get("factCheckRating"),
                })
                rating = fc.get("factCheckRating", "rated")
                publisher = fc.get("factCheckPublisher") or fc.get("source", "A fact-checker")
                fc_parts.append(f"{publisher} rated this claim as **\"{rating}\"** {ref}")
            paragraphs.append("**Fact-Check Findings:** " + "; ".join(fc_parts) + ".")
        else:
            paragraphs.append("**Fact-Check Findings:** No dedicated fact-check results were found for this specific claim in major fact-check databases.")

        # ML model assessment
        model_label = model_used.replace("_", " ").title()
        caps_ratio = linguistic.get("caps_ratio", 0) if linguistic else 0
        exclamations = linguistic.get("exclamation_count", 0) if linguistic else 0
        fake_sigs = linguistic.get("fake_signals", {}) if linguistic else {}
        real_sigs = linguistic.get("real_signals", {}) if linguistic else {}

        ml_para = f"**ML Analysis ({model_label}):** The classifier predicted {ml_label.upper()} with {ml_conf:.0%} confidence."
        if fake_sigs:
            top_cats = list(fake_sigs.keys())[:2]
            ml_para += f" Linguistic patterns consistent with misinformation were detected, including {' and '.join(top_cats)}."
        if real_sigs:
            top_cats = list(real_sigs.keys())[:2]
            ml_para += f" Credibility indicators were also present: {' and '.join(top_cats)}."
        if caps_ratio > 0.1:
            ml_para += f" Notably, {caps_ratio:.0%} of words were written in ALL CAPS — a common tactic in sensationalist content."
        if exclamations > 3:
            ml_para += f" The text contains {exclamations} exclamation marks, indicating emotional manipulation."
        paragraphs.append(ml_para)

        # Source corroboration
        if high_cred:
            src_parts = []
            for r in high_cred[:4]:
                ref = add_source({
                    "title": r.get("title", "Article"),
                    "url": r.get("url", "#"),
                    "source": r.get("source"),
                    "credibility": "high",
                    "snippet": r.get("snippet", "")[:150],
                })
                src_parts.append(f"{r.get('source', 'a credible source')} {ref}")
            paragraphs.append(
                f"**Corroborating Sources:** Coverage was found from {len(high_cred)} high-credibility "
                f"outlet(s): {', '.join(src_parts)}."
            )
        elif med_cred:
            src_parts = []
            for r in med_cred[:3]:
                ref = add_source({
                    "title": r.get("title", "Article"),
                    "url": r.get("url", "#"),
                    "source": r.get("source"),
                    "credibility": "medium",
                    "snippet": r.get("snippet", "")[:150],
                })
                src_parts.append(f"{r.get('source', 'a source')} {ref}")
            paragraphs.append(
                f"**Source Corroboration:** Limited coverage found from medium-credibility sources: {', '.join(src_parts)}. "
                "No coverage from tier-1 outlets (Reuters, AP, BBC, etc.)."
            )
        else:
            paragraphs.append(
                "**Source Corroboration:** No corroborating coverage was found from credible news outlets. "
                "Legitimate news stories are typically reported by multiple independent organizations."
            )

        if low_cred:
            lc_names = ", ".join(set(r.get("source", "unknown") for r in low_cred[:3]))
            paragraphs.append(
                f"⚠️ **Low-Credibility Sources:** This claim appears on known low-credibility outlets: {lc_names}. "
                "These sources have a documented history of publishing misinformation."
            )

        # Wikipedia context
        if wiki:
            ref = add_source({
                "title": wiki[0].get("title", "Wikipedia"),
                "url": wiki[0].get("url", "#"),
                "source": "Wikipedia",
                "credibility": "high",
                "snippet": wiki[0].get("snippet", "")[:150],
            })
            paragraphs.append(
                f"**Encyclopedic Context:** Wikipedia provides relevant background on this topic {ref}. "
                f"{wiki[0].get('snippet', '')[:200]}"
            )

        # RAG evidence
        if rag_chunks:
            paragraphs.append(
                f"**Evidence Retrieval (RAG):** Semantic search across indexed sources retrieved "
                f"{len(rag_chunks)} relevant evidence chunks, which were used to inform this verdict."
            )

        # Contradictions
        if contradictions:
            paragraphs.append(
                f"⚡ **Conflicting Evidence:** {'; '.join(contradictions)}. "
                "This disagreement increases uncertainty in the verdict."
            )

        # Verdict reasoning
        score = composite["score"]
        if verdict in ("FAKE", "LIKELY FAKE"):
            paragraphs.append(
                f"**Verdict Reasoning:** Multiple signals converge toward misinformation: "
                f"ML model, {'confirmed by dedicated fact-checkers, ' if fact_checks else ''}"
                f"{'absence of coverage from credible news outlets, ' if not high_cred else ''}"
                f"and linguistic markers typical of fake news content. "
                f"(Composite score: {score:+.1f})"
            )
        elif verdict in ("REAL", "LIKELY REAL"):
            paragraphs.append(
                f"**Verdict Reasoning:** Evidence supports the authenticity of this claim: "
                f"ML model assessment, {'fact-checker confirmation, ' if fact_checks else ''}"
                f"coverage from {len(high_cred)} credible source(s), "
                f"and credible writing style indicators. "
                f"(Composite score: {score:+.1f})"
            )
        else:
            paragraphs.append(
                f"**Verdict Reasoning:** Evidence is mixed or insufficient. "
                f"The claim could not be definitively verified or refuted. "
                f"Independent verification through trusted news sources is recommended. "
                f"(Composite score: {score:+.1f})"
            )

        explanation = "\n\n".join(paragraphs)
        return explanation, cited_sources

    async def _llm_explanation(
        self, text, verdict_data, ml_prediction, search_results, rag_chunks, reasoning_steps
    ) -> Tuple[str, List[Dict]]:
        """Use GPT-4o-mini for rich explanations with citations."""
        try:
            import openai
            import json
            client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

            sources_text = []
            for i, r in enumerate(search_results[:8], 1):
                cred = r.get("credibility", "unknown")
                src = r.get("source") or r.get("factCheckPublisher", "Unknown")
                rating = f" | Rating: {r['factCheckRating']}" if r.get("factCheckRating") else ""
                snippet = (r.get("snippet") or "")[:200]
                sources_text.append(f"[{i}] {src} ({cred} credibility){rating}: {snippet}")

            rag_text = "\n".join(rag_chunks[:4]) if rag_chunks else "None"

            prompt = f"""You are a professional, evidence-based fact-checker like PolitiFact or Reuters Fact Check.

CLAIM TO ANALYZE:
{text[:600]}

VERDICT DETERMINED: {verdict_data['verdict']} ({verdict_data['confidence']}% confidence)

ML MODEL: {ml_prediction.get('prediction', '?').upper()} ({ml_prediction.get('confidence', 0):.0%}) via {ml_prediction.get('model_used', 'unknown')}

SOURCES FOUND ({len(search_results)} total):
{chr(10).join(sources_text)}

RAG EVIDENCE:
{rag_text}

Write a detailed fact-check explanation (4-5 paragraphs) that:
1. States the verdict clearly upfront
2. Cites specific sources inline using [N] notation matching the numbered sources above
3. Explains what fact-checkers found (if any)
4. Discusses corroborating or contradicting coverage with citations
5. Notes any linguistic red flags or credibility signals
6. Ends with a clear actionable conclusion

Be specific and evidence-based. Cite sources for every major claim. Mention source names explicitly.
Return JSON: {{"explanation": "...", "cited_refs": [1, 2, 3]}}"""

            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                response_format={"type": "json_object"},
                max_tokens=1000,
            )

            data = json.loads(response.choices[0].message.content)
            explanation = data.get("explanation", "")
            cited_refs = data.get("cited_refs", [])

            cited_sources = [
                {
                    "ref": i,
                    "title": search_results[i - 1].get("title", ""),
                    "url": search_results[i - 1].get("url", "#"),
                    "source": search_results[i - 1].get("source") or search_results[i - 1].get("factCheckPublisher", ""),
                    "credibility": search_results[i - 1].get("credibility", "unknown"),
                    "factCheckRating": search_results[i - 1].get("factCheckRating"),
                }
                for i in cited_refs if 1 <= i <= len(search_results)
            ]

            reasoning_steps.append("✨ GPT-4o-mini generated cited explanation")
            return explanation, cited_sources

        except Exception as e:
            logger.warning(f"LLM explanation failed: {e}. Using rule-based.")
            return self._build_cited_explanation(
                text, verdict_data,
                ml_prediction.get("prediction", "uncertain"),
                float(ml_prediction.get("confidence", 0.5)),
                ml_prediction.get("model_used", "unknown"),
                [r for r in search_results if r.get("type") == "fact-check"],
                [r for r in search_results if r.get("credibility") == "high"],
                [r for r in search_results if r.get("credibility") == "medium"],
                [r for r in search_results if r.get("credibility") == "low"],
                [r for r in search_results if r.get("type") == "encyclopedia"],
                rag_chunks,
                ml_prediction.get("features", {}).get("linguistic_signals", {}),
                [],
                {"score": 0, "ml_contribution": 0, "factcheck_contribution": 0,
                 "source_contribution": 0, "rag_contribution": 0, "linguistic_contribution": 0},
            )

    def _format_sources(self, search_results: List[Dict]) -> List[Dict]:
        return [
            {
                "title": r.get("title", "Unknown"),
                "url": r.get("url", "#"),
                "source": r.get("source") or r.get("factCheckPublisher", "Unknown"),
                "snippet": (r.get("snippet") or "")[:250],
                "credibility": r.get("credibility", "unknown"),
                "factCheckRating": r.get("factCheckRating"),
                "type": r.get("type", "news"),
                "publishedAt": r.get("publishedAt"),
            }
            for r in search_results[:8]
        ]
