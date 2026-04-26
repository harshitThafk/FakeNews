"""
Fake News Classifier — v3 (Groq LLM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIMARY: Groq LLM (Llama 3.1 70B Versatile)
         Semantic understanding + context awareness
FALLBACK: Linguistic pattern analysis (if Groq fails)
"""

import os
import re
import logging
import json
from typing import Dict, Any
from groq import Groq

logger = logging.getLogger(__name__)

class FakeNewsClassifier:
    def __init__(self, fallback_mode=False):
        self.groq_client = None
        self.fallback_mode = fallback_mode
        self.model_name = "llama-3.1-8b-instant"  # Using 8b instant for faster, versatile responses
        
    def load_or_train(self):
        """Initialize Groq client"""
        try:
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                logger.warning("GROQ_API_KEY not found in environment")
                self.fallback_mode = True
                return
                
            self.groq_client = Groq(api_key=api_key)
            logger.info(f"✅ Groq LLM loaded: {self.model_name}")
        except Exception as e:
            logger.warning(f"Failed to load Groq: {e}")
            self.fallback_mode = True

    def predict(self, text: str) -> Dict[str, Any]:
        """Predict if text is fake/real using Groq LLM"""
        if not text or len(text.strip()) < 15:
            return {"prediction": "uncertain", "confidence": 0.5, "features": {}, "model_used": "none"}
        
        clean = self._clean_text(text)
        
        if self.groq_client and not self.fallback_mode:
            return self._groq_predict(clean)
        else:
            return self._heuristic_predict(clean)

    def _groq_predict(self, text: str) -> Dict[str, Any]:
        """Use Groq LLM for semantic analysis"""
        try:
            prompt = f"""Analyze this claim/statement for misinformation indicators.

CLAIM: {text[:1500]}

Evaluate based on:
1. Sensationalism (shocking, explosive, miraculous claims)
2. Lack of sources or attribution
3. Emotional manipulation tactics
4. Conspiracy language
5. Logical consistency
6. Use of qualified language (allegedly, reportedly, etc.)

Respond ONLY with valid JSON:
{{
  "prediction": "fake" | "real" | "uncertain",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of key indicators",
  "indicators": {{"sensational": bool, "unattributed": bool, "emotional": bool, "conspiracy": bool}}
}}

IMPORTANT: Return ONLY valid JSON, no other text."""

            message = self.groq_client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert fact-checker and misinformation analyst. Analyze claims for signs of fake news. Always respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,
                max_tokens=500,
            )
            
            response_text = message.choices[0].message.content.strip()
            
            # Extract JSON if wrapped in code blocks
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
                response_text = response_text.strip()
            
            result = json.loads(response_text)
            
            # Validate and normalize result
            prediction = result.get("prediction", "uncertain").lower()
            if prediction not in ["fake", "real", "uncertain"]:
                prediction = "uncertain"
            
            confidence = float(result.get("confidence", 0.5))
            confidence = max(0.0, min(1.0, confidence))
            
            return {
                "prediction": prediction,
                "confidence": round(confidence, 4),
                "features": {
                    "reasoning": result.get("reasoning", ""),
                    "indicators": result.get("indicators", {}),
                    "model": self.model_name
                },
                "model_used": "groq_llm"
            }
            
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parsing error from Groq: {e}")
            return self._heuristic_predict(text)
        except Exception as e:
            logger.error(f"Groq prediction error: {e}")
            return self._heuristic_predict(text)

    def _heuristic_predict(self, text: str) -> Dict[str, Any]:
        """Fallback linguistic analysis"""
        analysis = self._linguistic_analysis(text)
        fake_score, real_score = analysis["fake_score"], analysis["real_score"]
        total = fake_score + real_score
        
        if total == 0:
            return {
                "prediction": "uncertain",
                "confidence": 0.5,
                "features": {"linguistic_signals": analysis},
                "model_used": "heuristic"
            }
        
        fake_ratio = fake_score / total
        
        if fake_ratio > 0.65:
            conf = min(0.45 + fake_ratio * 0.45, 0.88)
            return {
                "prediction": "fake",
                "confidence": round(conf, 4),
                "features": {"linguistic_signals": analysis},
                "model_used": "heuristic"
            }
        elif fake_ratio < 0.35:
            conf = min(0.45 + (1 - fake_ratio) * 0.45, 0.85)
            return {
                "prediction": "real",
                "confidence": round(conf, 4),
                "features": {"linguistic_signals": analysis},
                "model_used": "heuristic"
            }
        
        return {
            "prediction": "uncertain",
            "confidence": 0.5,
            "features": {"linguistic_signals": analysis},
            "model_used": "heuristic"
        }

    def _linguistic_analysis(self, text: str) -> Dict[str, Any]:
        """Linguistic pattern analysis as fallback"""
        text_lower = text.lower()
        words = text_lower.split()
        total_words = max(len(words), 1)

        FAKE_PATTERNS = {
            "sensationalism": ["shocking", "bombshell", "explosive", "jaw-dropping", "mind-blowing",
                               "unbelievable", "outrageous", "scandalous", "horrifying", "terrifying"],
            "conspiracy_language": ["deep state", "new world order", "they don't want you", "what they're hiding",
                                    "mainstream media won't", "silenced", "censored", "suppressed", "cover-up",
                                    "shadow government", "globalists", "cabal", "elites are"],
            "urgency_manipulation": ["share before deleted", "urgent:", "breaking:", "must read",
                                     "share immediately", "going viral", "act now", "spread the word"],
            "pseudo_authority": ["doctors hate this", "scientists baffled", "experts stunned",
                                 "officials shocked", "governments fear", "big pharma"],
            "emotional_manipulation": ["wake up", "sheeple", "brainwashed", "open your eyes",
                                       "do your own research", "you won't believe", "exposed:"],
        }

        REAL_PATTERNS = {
            "attributed_sourcing": ["according to", "said in a statement", "told reporters",
                                    "confirmed by", "spokesperson said", "researchers found", "study shows"],
            "institutional_references": ["published in", "peer-reviewed", "journal of", "university of",
                                         "institute of", "department of", "ministry of"],
            "hedging_language": ["reportedly", "allegedly", "sources say", "analysts suggest",
                                 "is expected to", "may indicate"],
            "precise_data": ["%", "percent", "million", "billion", "statistics show", "survey of"],
            "balanced_reporting": ["however", "on the other hand", "critics say", "opponents argue",
                                   "some experts disagree"],
        }

        found_fake, found_real = {}, {}
        fake_score, real_score = 0, 0

        for cat, patterns in FAKE_PATTERNS.items():
            matches = [p for p in patterns if p in text_lower]
            if matches:
                found_fake[cat] = matches
                fake_score += len(matches) * (2 if cat in ["conspiracy_language", "urgency_manipulation"] else 1)

        for cat, patterns in REAL_PATTERNS.items():
            matches = [p for p in patterns if p in text_lower]
            if matches:
                found_real[cat] = matches
                real_score += len(matches) * (2 if cat in ["attributed_sourcing", "institutional_references"] else 1)

        caps_words = sum(1 for w in words if w.isupper() and len(w) > 2)
        caps_ratio = caps_words / total_words
        exclamations = text.count("!")
        
        if caps_ratio > 0.1: fake_score += 3
        if exclamations > 3: fake_score += 2

        return {
            "fake_signals": found_fake,
            "real_signals": found_real,
            "fake_score": fake_score,
            "real_score": real_score,
            "caps_ratio": round(caps_ratio, 3),
            "exclamation_count": exclamations,
        }

    def _clean_text(self, text: str) -> str:
        """Clean text for analysis"""
        text = re.sub(r"http\S+", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()
