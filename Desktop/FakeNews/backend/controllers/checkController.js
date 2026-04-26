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

  const checkDoc = new Check({ id: checkId, inputType: url ? "url" : "text", originalInput: url || text, status: "processing" });
  await trySave(checkDoc);

  try {
    let extractedText = text;
    if (url) extractedText = await scrapeUrl(url);

    let mlResult = { prediction: "uncertain", confidence: 0.5 };
    try {
      const mlResp = await axios.post(`${ML_URL}/predict`, { text: extractedText }, { timeout: 10000 });
      mlResult = mlResp.data;
    } catch (e) {
      console.warn("ML service unavailable, using fallback:", e.message);
      mlResult = mockMLPredict(extractedText);
    }

    const searchResults = await searchNews(extractedText.slice(0, 200), extractedText);

    let agentResult;
    try {
      const agentResp = await axios.post(`${ML_URL}/agent`, { text: extractedText, ml_prediction: mlResult, search_results: searchResults }, { timeout: 30000 });
      agentResult = agentResp.data;
    } catch (e) {
      console.warn("Agent unavailable, using rule-based fallback:", e.message);
      agentResult = ruleBasedAgent(mlResult, searchResults);
    }

    const processingTimeMs = Date.now() - startTime;
    const result = {
      id: checkId, status: "completed",
      inputType: url ? "url" : "text", originalInput: url || text,
      extractedText: extractedText.slice(0, 500) + "...",
      mlPrediction: mlResult.prediction, mlConfidence: mlResult.confidence,
      modelUsed: mlResult.model_used || mlResult.modelUsed || null,
      finalVerdict: agentResult.final_verdict, confidenceScore: agentResult.confidence_score,
      explanation: agentResult.explanation,
      sources: agentResult.sources || searchResults.slice(0, 5),
      searchResults: searchResults.slice(0, 5),
      ragChunks: agentResult.rag_chunks || agentResult.ragChunks || [],
      reasoningSteps: agentResult.reasoning_steps || agentResult.reasoningSteps || [],
      processingTimeMs, createdAt: new Date().toISOString(),
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

function mockMLPredict(text) {
  const fakeKeywords = ["shocking", "explosive", "secret", "they don't want you", "miracle", "hoax", "conspiracy"];
  const lower = text.toLowerCase();
  const fakeScore = fakeKeywords.filter((k) => lower.includes(k)).length;
  const confidence = Math.min(0.5 + fakeScore * 0.1, 0.95);
  return { prediction: fakeScore >= 2 ? "fake" : fakeScore === 1 ? "uncertain" : "real", confidence };
}

function ruleBasedAgent(mlResult, searchResults) {
  const hasCorroboration = searchResults.length >= 3;
  let verdict, confidence, explanation;
  if (mlResult.prediction === "fake" && !hasCorroboration) {
    verdict = "FAKE"; confidence = Math.round(mlResult.confidence * 100);
    explanation = "The ML model flagged this content as likely fake, and no corroborating sources were found.";
  } else if (mlResult.prediction === "real" && hasCorroboration) {
    verdict = "REAL"; confidence = Math.round(mlResult.confidence * 100);
    explanation = `The ML model classified this as real with ${searchResults.length} corroborating sources found.`;
  } else if (mlResult.prediction === "fake" && hasCorroboration) {
    verdict = "LIKELY FAKE"; confidence = Math.round(mlResult.confidence * 80);
    explanation = "The ML model suggests fake, but some related sources exist. Exercise caution.";
  } else if (mlResult.prediction === "real" && !hasCorroboration) {
    verdict = "LIKELY REAL"; confidence = Math.round(mlResult.confidence * 70);
    explanation = "The ML model leans real, but limited corroboration found.";
  } else {
    verdict = "UNCERTAIN"; confidence = 50;
    explanation = "Insufficient evidence to make a definitive determination.";
  }
  return { final_verdict: verdict, confidence_score: confidence, explanation, sources: searchResults.slice(0, 5), rag_chunks: [] };
}
