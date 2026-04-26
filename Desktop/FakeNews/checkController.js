const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const Check = require("../models/Check");
const { scrapeUrl } = require("../services/scraper");
const { searchNews } = require("../services/search");

const ML_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

async function trySave(doc) {
  try { await doc.save(); } catch (_) {}
}

exports.submitCheck = async (req, res) => {
  const { text, url } = req.body;
  if (!text && !url) return res.status(400).json({ error: "Provide either text or url" });

  const checkId = uuidv4();
  const startTime = Date.now();

  res.json({ id: checkId, status: "processing" });

  if (!global.checkStore) global.checkStore = {};
  global.checkStore[checkId] = { status: "processing" };

  const checkDoc = new Check({
    id: checkId,
    inputType: url ? "url" : "text",
    originalInput: url || text,
    status: "processing",
  });
  await trySave(checkDoc);

  try {
    // ── Step 1: Input Processing ─────────────────────────────────────
    let extractedText = text;
    if (url) {
      extractedText = await scrapeUrl(url);
    }

    // ── Step 2: ML Model Prediction ──────────────────────────────────
    let mlResult = { prediction: "uncertain", confidence: 0.5, model_used: "none" };
    try {
      const mlResp = await axios.post(
        `${ML_URL}/predict`,
        { text: extractedText },
        { timeout: 15000 }
      );
      mlResult = mlResp.data;
    } catch (e) {
      console.warn("ML service unavailable:", e.message);
      mlResult = heuristicPredict(extractedText);
    }

    // ── Step 3: Live Multi-Source Search ─────────────────────────────
    // Pass both a short query and the full text for better query extraction
    const shortQuery = extractedText.slice(0, 200);
    const searchResults = await searchNews(shortQuery, extractedText.slice(0, 800));

    // ── Step 4 + 5: RAG + Deep Agent Reasoning ───────────────────────
    let agentResult;
    try {
      const agentResp = await axios.post(
        `${ML_URL}/agent`,
        {
          text: extractedText.slice(0, 2000),
          ml_prediction: mlResult,
          search_results: searchResults,
        },
        { timeout: 45000 }
      );
      agentResult = agentResp.data;
    } catch (e) {
      console.warn("Agent unavailable:", e.message);
      agentResult = fallbackAgent(mlResult, searchResults);
    }

    const processingTimeMs = Date.now() - startTime;

    const result = {
      id: checkId,
      status: "completed",
      inputType: url ? "url" : "text",
      originalInput: url || text,
      extractedText: extractedText.slice(0, 600) + (extractedText.length > 600 ? "..." : ""),

      // ML
      mlPrediction: mlResult.prediction,
      mlConfidence: mlResult.confidence,
      modelUsed: mlResult.model_used,

      // Agent output
      finalVerdict: agentResult.final_verdict,
      confidenceScore: agentResult.confidence_score,
      explanation: agentResult.explanation,
      citedSources: agentResult.cited_sources || [],

      // Evidence
      sources: agentResult.sources || searchResults.slice(0, 8),
      searchResults: searchResults,
      ragChunks: agentResult.rag_chunks || [],
      reasoningSteps: agentResult.reasoning_steps || [],
      evidenceLog: agentResult.evidence_log || [],
      scoreBreakdown: agentResult.score_breakdown || {},

      processingTimeMs,
      createdAt: new Date().toISOString(),
    };

    global.checkStore[checkId] = result;
    checkDoc.set({ ...result, status: "completed" });
    await trySave(checkDoc);

  } catch (err) {
    console.error("Pipeline error:", err);
    const errResult = { status: "error", error: err.message };
    global.checkStore[checkId] = errResult;
    checkDoc.set(errResult);
    await trySave(checkDoc);
  }
};

exports.getCheckResult = async (req, res) => {
  const { id } = req.params;
  if (global.checkStore?.[id]) return res.json(global.checkStore[id]);
  try {
    const doc = await Check.findOne({ id });
    if (!doc) return res.status(404).json({ error: "Check not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Fallback functions ───────────────────────────────────────────────────

function heuristicPredict(text) {
  const lower = text.toLowerCase();
  const fakeKw = ["shocking", "explosive", "secret", "they don't want", "miracle", "hoax",
                  "conspiracy", "exposed", "urgent:", "share before", "deep state", "wake up sheeple"];
  const realKw = ["according to", "study finds", "researchers say", "officials announced",
                  "published in", "data shows", "percent", "confirmed by"];
  const fakeCount = fakeKw.filter((k) => lower.includes(k)).length;
  const realCount = realKw.filter((k) => lower.includes(k)).length;
  const confidence = Math.min(0.5 + Math.max(fakeCount, realCount) * 0.08, 0.88);
  return {
    prediction: fakeCount > realCount ? "fake" : fakeCount < realCount ? "real" : "uncertain",
    confidence,
    model_used: "heuristic",
  };
}

function fallbackAgent(mlResult, searchResults) {
  const factChecks = searchResults.filter((r) => r.credibility === "fact-check");
  const highCred = searchResults.filter((r) => r.credibility === "high");
  const lowCred = searchResults.filter((r) => r.credibility === "low");

  let score = 0;
  if (mlResult.prediction === "fake") score -= 25 * mlResult.confidence;
  else if (mlResult.prediction === "real") score += 25 * mlResult.confidence;
  if (highCred.length >= 2) score += 30;
  else if (highCred.length === 1) score += 15;
  if (lowCred.length > highCred.length) score -= 20;
  if (searchResults.length === 0) score -= 10;

  let verdict, confidence;
  if (score <= -30) { verdict = "FAKE"; confidence = Math.min(95, 60 + Math.abs(score)); }
  else if (score <= -12) { verdict = "LIKELY FAKE"; confidence = Math.min(80, 55 + Math.abs(score)); }
  else if (score >= 25) { verdict = "REAL"; confidence = Math.min(95, 55 + score); }
  else if (score >= 12) { verdict = "LIKELY REAL"; confidence = Math.min(78, 52 + score); }
  else { verdict = "UNCERTAIN"; confidence = 50; }

  const explanation = buildFallbackExplanation(verdict, mlResult, highCred, lowCred, factChecks, searchResults.length);

  return {
    final_verdict: verdict,
    confidence_score: Math.round(confidence),
    explanation,
    sources: searchResults.slice(0, 8),
    rag_chunks: [],
    reasoning_steps: [
      `ML model: ${mlResult.prediction.toUpperCase()} (${Math.round(mlResult.confidence * 100)}%)`,
      `Sources: ${searchResults.length} found — ${highCred.length} high-credibility`,
      `Composite score: ${score.toFixed(1)} → ${verdict}`,
    ],
    cited_sources: highCred.slice(0, 4).map((r, i) => ({
      ref: i + 1,
      title: r.title,
      url: r.url,
      source: r.source,
      credibility: "high",
    })),
    score_breakdown: { score },
    evidence_log: [],
  };
}

function buildFallbackExplanation(verdict, mlResult, highCred, lowCred, factChecks, totalSources) {
  const parts = [];
  const verdictText = {
    "FAKE": "This claim has been determined to be **FAKE**.",
    "LIKELY FAKE": "This claim has been assessed as **LIKELY FAKE**.",
    "UNCERTAIN": "Evidence is **UNCERTAIN** — a definitive verdict could not be reached.",
    "LIKELY REAL": "This claim appears **LIKELY REAL** based on available evidence.",
    "REAL": "This claim has been verified as **REAL**.",
  }[verdict] || "Verdict is uncertain.";

  parts.push(verdictText);
  parts.push(`**ML Analysis:** The classifier predicted ${mlResult.prediction.toUpperCase()} with ${Math.round(mlResult.confidence * 100)}% confidence.`);

  if (factChecks.length > 0) {
    parts.push(`**Fact-Check Findings:** ${factChecks.length} dedicated fact-check result(s) were found.`);
  } else {
    parts.push("**Fact-Check Findings:** No dedicated fact-check entries found for this claim.");
  }

  if (highCred.length > 0) {
    const names = [...new Set(highCred.map((r) => r.source).filter(Boolean))].slice(0, 4).join(", ");
    parts.push(`**Corroborating Sources:** Found coverage from ${highCred.length} high-credibility outlet(s): ${names}.`);
  } else if (totalSources === 0) {
    parts.push("**Source Corroboration:** No corroborating coverage found. Legitimate news is typically covered by multiple outlets.");
  } else {
    parts.push(`**Source Corroboration:** ${totalSources} sources found, but none from tier-1 credible outlets.`);
  }

  if (lowCred.length > 0) {
    parts.push(`⚠️ **Low-Credibility Sources:** This claim appears on ${lowCred.length} low-credibility outlet(s).`);
  }

  return parts.join("\n\n");
}
