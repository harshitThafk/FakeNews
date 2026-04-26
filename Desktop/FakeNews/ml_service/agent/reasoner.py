"""
Fake News Agent — Agentic AI Reasoner
"""

import logging
import os
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


class FakeNewsAgent:
    def __init__(self, rag_pipeline=None):
        self.rag = rag_pipeline
        self.use_llm = True  # Enable LLM synthesis for better reasoning

    def _validate_search_results(self, claim_text: str, search_results: List[Dict]) -> tuple:
        """Validate search results against the original claim to filter out irrelevant results."""
        claim_lower = claim_text.lower()
        relevant = []
        irrelevant = []
        contradicting = []

        # Extract key entities and concepts from the claim
        claim_words = set(claim_lower.split())
        # Focus on proper nouns and key terms
        key_terms = []
        for word in claim_words:
            if len(word) > 3 and (word[0].isupper() or word in ['died', 'death', 'dead', 'killed', 'murdered', 'passed', 'funeral', 'obituary', 'cancer', 'illness', 'hospital', 'emergency', 'tragedy', 'accident', 'crash', 'shooting', 'attack', 'war', 'conflict', 'election', 'president', 'government', 'scandal', 'corruption', 'fraud', 'hoax', 'fake', 'conspiracy', 'secret', 'exposed', 'shocking', 'breaking', 'exclusive']):
                key_terms.append(word)

        for result in search_results:
            title = (result.get("title") or "").lower()
            snippet = (result.get("snippet") or "").lower()
            content = f"{title} {snippet}"

            # Check if the result mentions key terms from the claim
            matches = sum(1 for term in key_terms if term in content)

            # For claims about specific people/events, require direct matches
            if len(key_terms) > 0:
                # If we have proper nouns, they should appear in the result
                proper_nouns = [w for w in key_terms if w[0].isupper()]
                if proper_nouns:
                    proper_matches = sum(1 for noun in proper_nouns if noun.lower() in content)
                    if proper_matches == 0:
                        # Check if this result contradicts the claim
                        if self._result_contradicts_claim(claim_text, content):
                            contradicting.append(result)
                        else:
                            irrelevant.append(result)
                        continue

            # Require at least some relevance
            if matches >= len(key_terms) * 0.5 or any(term in title for term in key_terms[:2]):
                relevant.append(result)
            else:
                irrelevant.append(result)

        return relevant, irrelevant, contradicting

    def _result_contradicts_claim(self, claim_text: str, result_content: str) -> bool:
        """Check if a search result contradicts the original claim."""
        claim_lower = claim_text.lower()
        result_lower = result_content.lower()

        # For death claims, check if result mentions the person is alive/recently active
        if 'died' in claim_lower or 'dead' in claim_lower or 'death' in claim_lower:
            alive_indicators = ['alive', 'living', 'active', 'speaking', 'tweeted', 'posted', 'announced', 'said', 'stated', 'confirmed']
            if any(indicator in result_lower for indicator in alive_indicators):
                return True

        # For event claims, check for denial or fact-check ratings
        if 'fact check' in result_lower or 'false' in result_lower or 'debunked' in result_lower:
            return True

        return False

    async def analyze(self, text: str, ml_prediction: Dict[str, Any], search_results: List[Dict]) -> Dict[str, Any]:
        logger.info(f"Agent analyze called - use_llm: {self.use_llm}")
        if self.use_llm:
            logger.info("LLM-enhanced agent mode active (GPT-4o-mini)")
        else:
            logger.info("Rule-based agent mode active (no OPENAI_API_KEY)")
        reasoning_steps = []

        ml_label = ml_prediction.get("prediction", "uncertain")
        ml_conf = float(ml_prediction.get("confidence", 0.5))
        reasoning_steps.append(f"ML model predicts: {ml_label.upper()} (confidence: {ml_conf:.0%})")

        # Validate search results against the claim
        relevant_results, irrelevant_results, contradicting_results = self._validate_search_results(text, search_results)
        reasoning_steps.append(f"Search validation: {len(relevant_results)} relevant, {len(irrelevant_results)} irrelevant, {len(contradicting_results)} contradicting results out of {len(search_results)} total")

        rag_chunks = []
        if self.rag and relevant_results:
            rag_chunks = self.rag.index_search_results(relevant_results, text[:200])
            reasoning_steps.append(f"RAG retrieved {len(rag_chunks)} relevant evidence chunks from {len(relevant_results)} validated sources")
        else:
            reasoning_steps.append("No relevant search results available for RAG retrieval")

        high_cred = sum(1 for r in relevant_results if r.get("credibility") == "high")
        low_cred = sum(1 for r in relevant_results if r.get("credibility") == "low")
        fact_check = sum(1 for r in relevant_results if r.get("credibility") == "fact-check")
        total_sources = len(relevant_results)
        reasoning_steps.append(f"Source analysis: {total_sources} relevant sources — {high_cred} high credibility, {fact_check} fact-check, {low_cred} low credibility")

        if self.use_llm:
            result = await self._llm_synthesize(text, ml_prediction, relevant_results, rag_chunks, reasoning_steps)
        else:
            result = self._rule_synthesize(ml_label, ml_conf, relevant_results, rag_chunks, reasoning_steps, contradicting_results)

        result["rag_chunks"] = rag_chunks
        result["reasoning_steps"] = reasoning_steps
        result["sources"] = self._format_sources(relevant_results)

        logger.info(f"Final result: {result['final_verdict']} ({result['confidence_score']}%)")
        return result

    def _rule_synthesize(self, ml_label, ml_conf, search_results, rag_chunks, reasoning_steps, contradicting_results=None):
        contradicting_results = contradicting_results or []
        high_cred = sum(1 for r in search_results if r.get("credibility") == "high")
        low_cred = sum(1 for r in search_results if r.get("credibility") == "low")
        fact_check = sum(1 for r in search_results if r.get("credibility") == "fact-check")
        total = len(search_results)
        score = 0

        # Check for contradicting results
        contradicting_count = len(contradicting_results)
        if contradicting_count > 0:
            score -= contradicting_count * 30  # Strong penalty for contradicting evidence
            reasoning_steps.append(f"Found {contradicting_count} contradicting search results - strong evidence against claim")

        # ML prediction has strong influence
        if ml_label == "fake":
            score -= 50 * ml_conf  # Increased penalty for fake
        elif ml_label == "real":
            score += 50 * ml_conf  # Increased bonus for real

        # Source credibility adjustments
        if total == 0:
            score -= 15  # Increased penalty for no sources
            reasoning_steps.append("No relevant sources found - claim lacks corroboration")
        else:
            # Fact checks are most important
            score += fact_check * 40
            score += high_cred * 25
            score -= low_cred * 15

            # Multiple high-cred sources strongly support real
            if high_cred >= 3:
                score += 35
            elif high_cred >= 2:
                score += 20
            elif high_cred == 1:
                score += 10

            # Low credibility sources hurt real claims
            if low_cred > high_cred + fact_check:
                score -= 25

        # RAG evidence
        if len(rag_chunks) >= 3:
            score += 15
        elif len(rag_chunks) == 0 and ml_label == "fake":
            score -= 10  # Less penalty if no sources found

        reasoning_steps.append(f"Composite reasoning score: {score:.1f} (ML: {ml_label} {ml_conf:.1%}, Sources: {total} total, {high_cred} high, {fact_check} fact-check, {low_cred} low)")

        # More aggressive thresholds
        if score <= -30:
            verdict, confidence = "FAKE", min(95, 60 + abs(score))
            explanation = self._explain_fake(ml_conf, high_cred, low_cred, total, rag_chunks)
        elif score <= -10:
            verdict, confidence = "LIKELY FAKE", min(85, 55 + abs(score))
            explanation = self._explain_likely_fake(ml_conf, total, rag_chunks)
        elif score >= 40:
            verdict, confidence = "REAL", min(95, 50 + score)
            explanation = self._explain_real(ml_conf, high_cred, total, rag_chunks)
        elif score >= 20:
            verdict, confidence = "LIKELY REAL", min(85, 50 + score // 2)
            explanation = self._explain_likely_real(ml_conf, high_cred, total)
        else:
            verdict, confidence = "UNCERTAIN", 50
            explanation = self._explain_uncertain(ml_label, ml_conf, total)

        reasoning_steps.append(f"Final verdict: {verdict} ({confidence}% confidence)")
        return {"final_verdict": verdict, "confidence_score": int(confidence), "explanation": explanation}

    async def _llm_synthesize(self, text, ml_prediction, search_results, rag_chunks, reasoning_steps):
        try:
            import groq, json
            client = groq.Groq(api_key=os.getenv("GROQ_API_KEY"))

            # Build rich evidence block
            evidence_lines = []
            for i, r in enumerate(search_results[:8], 1):
                cred = r.get("credibility", "unknown")
                source = r.get("source", "Unknown")
                snippet = r.get("snippet", "")[:250]
                rating = f' → Fact-check rating: "{r["factCheckRating"]}"' if r.get("factCheckRating") else ""
                evidence_lines.append(f"[{i}] [{cred.upper()}] {source}{rating}\n    {snippet}")

            evidence_block = "\n".join(evidence_lines) if evidence_lines else "No sources found."
            rag_block = "\n".join(f"• {c}" for c in rag_chunks[:4]) if rag_chunks else "None."

            prompt = f"""You are an expert fact-checker and misinformation analyst. Analyze the claim below using all provided evidence.

CLAIM TO ANALYZE:
{text[:800]}

ML MODEL SIGNAL:
- Prediction: {ml_prediction.get('prediction','uncertain').upper()}
- Confidence: {float(ml_prediction.get('confidence',0.5)):.0%}
- Model: {ml_prediction.get('model_used','unknown')}

SEARCH EVIDENCE ({len(search_results)} sources):
{evidence_block}

RAG RETRIEVED CONTEXT:
{rag_block}

INSTRUCTIONS:
- Weigh fact-check sources most heavily
- Consider source credibility ratings
- Be specific about what evidence supports your verdict
- If fact-checkers have rated this claim, prioritize their rating

Respond ONLY with valid JSON:
{{
  "final_verdict": "FAKE" | "LIKELY FAKE" | "UNCERTAIN" | "LIKELY REAL" | "REAL",
  "confidence_score": <integer 0-100>,
  "explanation": "<3-4 sentences citing specific sources and evidence. Mention fact-check ratings if present.>"
}}"""

            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": "You are a professional fact-checker. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
            )
            result = json.loads(response.choices[0].message.content)
            reasoning_steps.append(f"Groq Llama-3.1-8B synthesized verdict using {len(search_results)} sources and {len(rag_chunks)} RAG chunks")
            return result
        except Exception as e:
            logger.warning(f"LLM synthesis failed: {e}. Falling back to rule-based.")
            return self._rule_synthesize(
                ml_prediction.get("prediction", "uncertain"),
                float(ml_prediction.get("confidence", 0.5)),
                search_results, rag_chunks, reasoning_steps
            )

    def _format_sources(self, search_results):
        return [{"title": r.get("title","Unknown"), "url": r.get("url","#"), "source": r.get("source","Unknown"), "snippet": r.get("snippet",""), "credibility": r.get("credibility","unknown")} for r in search_results[:6]]

    def _explain_fake(self, ml_conf, high_cred, low_cred, total, rag_chunks):
        parts = [f"The ML classifier flagged this content as FAKE with {ml_conf:.0%} confidence."]
        if total == 0:
            parts.append("No corroborating sources were found through live search.")
        elif low_cred > 0:
            parts.append(f"{low_cred} low-credibility source(s) found, none from reputable outlets.")
        if not rag_chunks:
            parts.append("RAG retrieval found no supporting evidence from known reliable sources.")
        return " ".join(parts)

    def _explain_likely_fake(self, ml_conf, total, rag_chunks):
        return f"The ML model leans toward FAKE ({ml_conf:.0%} confidence), and only {total} sources were found with limited corroboration. Treat with caution and verify through trusted news outlets."

    def _explain_real(self, ml_conf, high_cred, total, rag_chunks):
        return f"The ML model assessed this as REAL ({ml_conf:.0%} confidence). This is supported by {total} sources, including {high_cred} high-credibility outlet(s). RAG evidence retrieval found consistent information across sources."

    def _explain_likely_real(self, ml_conf, high_cred, total):
        return f"The ML model leans toward real ({ml_conf:.0%}). Found {total} sources with {high_cred} credible outlet(s). This appears genuine but independent verification is recommended."

    def _explain_uncertain(self, ml_label, ml_conf, total):
        return f"The ML model is uncertain (prediction: {ml_label}, {ml_conf:.0%}). Only {total} sources found with mixed signals. Unable to make a definitive determination — please investigate further."
