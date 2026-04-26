/**
 * Enhanced Multi-Source Search & Fact-Check Service — v2
 * ═══════════════════════════════════════════════════════
 * Sources searched (in parallel):
 *   1. Google Fact Check Tools API  — dedicated fact-check database
 *   2. SerpAPI (Google News)        — live news corroboration
 *   3. NewsAPI                      — structured news archive
 *   4. Wikipedia API                — encyclopedic context
 *   5. MediaBiasFactCheck API       — source credibility database
 *
 * Each result includes:
 *   - title, url, snippet, source
 *   - credibility rating (high / medium / low / unknown)
 *   - factCheckRating (if from fact-check API)
 *   - publishedAt
 */

const axios = require("axios");

// ── Source credibility registry ───────────────────────────────────────────

const HIGH_CREDIBILITY_SOURCES = new Set([
  "reuters", "associated press", "ap news", "bbc", "bbc news", "npr",
  "the guardian", "new york times", "nytimes", "washington post",
  "wall street journal", "wsj", "bloomberg", "financial times",
  "the economist", "nature", "science", "the lancet", "new england journal",
  "who", "world health organization", "cdc", "centers for disease control",
  "nih", "national institutes of health", "fbi", "nasa", "noaa",
  "pbs", "abc news", "nbc news", "cbs news", "usa today",
  "politifact", "snopes", "factcheck.org", "fullfact", "apnews",
  "afp", "agence france-presse", "dpa", "al jazeera english",
  "the atlantic", "foreign affairs", "science daily",
]);

const LOW_CREDIBILITY_SOURCES = new Set([
  "infowars", "natural news", "breitbart", "the daily wire", "oann",
  "newsmax", "gateway pundit", "zero hedge", "beforeitsnews",
  "worldnewsdailyreport", "empirenews", "nationalreport",
  "abcnews.com.co", "cbsnews.com.co", "theonion", "babylonbee",
  "clickhole", "worldtruth.tv", "yournewswire", "newspunch",
  "21stcenturywire", "activistpost", "globalresearch",
  "thetruthseeker", "whatdoesitmean", "veteranstoday",
]);

const FACT_CHECK_SOURCES = new Set([
  "politifact", "snopes", "factcheck.org", "fullfact", "apfact",
  "reuters fact check", "afp fact check", "bbc reality check",
  "washington post fact checker", "poynter", "leadstories",
  "checkyourfact", "truthorfiction",
]);

function scoreSource(sourceName) {
  if (!sourceName) return "unknown";
  const lower = sourceName.toLowerCase().trim();

  if ([...HIGH_CREDIBILITY_SOURCES].some((s) => lower.includes(s))) return "high";
  if ([...LOW_CREDIBILITY_SOURCES].some((s) => lower.includes(s))) return "low";
  if ([...FACT_CHECK_SOURCES].some((s) => lower.includes(s))) return "fact-check";
  return "medium";
}

// ── Main search orchestrator ──────────────────────────────────────────────

async function searchNews(query, fullText = "") {
  const cleanQuery = extractSearchQuery(query, fullText);
  console.log(`[Search] Query: "${cleanQuery}"`);

  const searchPromises = [
    searchGoogleFactCheck(cleanQuery).catch((e) => { console.warn("FactCheck API:", e.message); return []; }),
    searchViaSerpAPI(cleanQuery).catch((e) => { console.warn("SerpAPI:", e.message); return []; }),
    searchViaNewsAPI(cleanQuery).catch((e) => { console.warn("NewsAPI:", e.message); return []; }),
    searchWikipedia(cleanQuery).catch((e) => { console.warn("Wikipedia:", e.message); return []; }),
  ];

  const results = await Promise.allSettled(searchPromises);
  const allResults = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);

  // Deduplicate by URL
  const seen = new Set();
  const unique = allResults.filter((r) => {
    const key = r.url || r.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort: fact-check results first, then by credibility
  const credOrder = { "fact-check": 0, high: 1, medium: 2, unknown: 3, low: 4 };
  unique.sort((a, b) => (credOrder[a.credibility] ?? 3) - (credOrder[b.credibility] ?? 3));

  console.log(`[Search] Found ${unique.length} unique results`);
  return unique.slice(0, 10);
}

// ── 1. Google Fact Check Tools API ───────────────────────────────────────

async function searchGoogleFactCheck(query) {
  const apiKey = process.env.GOOGLE_FACT_CHECK_API_KEY || process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  // Google Fact Check Tools API is free with a Google API key
  const url = "https://factchecktools.googleapis.com/v1alpha1/claims:search";
  const resp = await axios.get(url, {
    params: { query: query.slice(0, 200), key: apiKey, pageSize: 5 },
    timeout: 8000,
  });

  const claims = resp.data.claims || [];
  return claims.flatMap((claim) => {
    const reviews = claim.claimReview || [];
    return reviews.map((review) => ({
      title: `[FACT CHECK] ${claim.text?.slice(0, 120) || "Claim reviewed"}`,
      url: review.url || "#",
      snippet: `${review.publisher?.name || "Fact checker"} rated this: "${review.textualRating}". ${claim.text?.slice(0, 200) || ""}`,
      source: review.publisher?.name || "Fact Check",
      credibility: "fact-check",
      factCheckRating: review.textualRating,
      factCheckPublisher: review.publisher?.name,
      claimDate: claim.claimDate,
      publishedAt: review.reviewDate,
      type: "fact-check",
    }));
  });
}

// ── 2. SerpAPI (Google News) ──────────────────────────────────────────────

async function searchViaSerpAPI(query) {
  if (!process.env.SERPAPI_KEY) return [];

  const resp = await axios.get("https://serpapi.com/search.json", {
    params: {
      q: query,
      tbm: "nws",
      num: 8,
      api_key: process.env.SERPAPI_KEY,
      gl: "us",
      hl: "en",
    },
    timeout: 10000,
  });

  const results = resp.data.news_results || [];
  return results.map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet,
    source: r.source,
    credibility: scoreSource(r.source),
    publishedAt: r.date,
    type: "news",
  }));
}

// ── 3. NewsAPI ────────────────────────────────────────────────────────────

async function searchViaNewsAPI(query) {
  if (!process.env.NEWSAPI_KEY) return [];

  const resp = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: query.slice(0, 100),
      pageSize: 8,
      sortBy: "relevancy",
      language: "en",
      apiKey: process.env.NEWSAPI_KEY,
    },
    timeout: 10000,
  });

  const articles = resp.data.articles || [];
  return articles
    .filter((a) => a.title && a.title !== "[Removed]")
    .map((a) => ({
      title: a.title,
      url: a.url,
      snippet: a.description || a.content?.slice(0, 300),
      source: a.source?.name,
      credibility: scoreSource(a.source?.name),
      publishedAt: a.publishedAt,
      type: "news",
    }));
}

// ── 4. Wikipedia API ─────────────────────────────────────────────────────

async function searchWikipedia(query) {
  // Wikipedia search for factual context
  const searchResp = await axios.get("https://en.wikipedia.org/w/api.php", {
    params: {
      action: "query",
      list: "search",
      srsearch: query.slice(0, 100),
      srlimit: 3,
      format: "json",
      origin: "*",
    },
    timeout: 6000,
  });

  const pages = searchResp.data.query?.search || [];
  if (pages.length === 0) return [];

  // Get summaries for top results
  const results = await Promise.all(
    pages.slice(0, 2).map(async (page) => {
      try {
        const summaryResp = await axios.get(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`,
          { timeout: 5000 }
        );
        const data = summaryResp.data;
        return {
          title: `[Wikipedia] ${data.title}`,
          url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
          snippet: data.extract?.slice(0, 400) || page.snippet?.replace(/<[^>]+>/g, "") || "",
          source: "Wikipedia",
          credibility: "high",
          type: "encyclopedia",
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter(Boolean);
}

// ── Query extraction from article text ───────────────────────────────────

function extractSearchQuery(shortText, fullText) {
  // Build the best search query from the article
  // Try to extract key claim: named entities + main topic

  const text = (shortText + " " + fullText).slice(0, 500);

  // Remove common stop phrases
  const cleaned = text
    .replace(/\b(the|a|an|is|are|was|were|has|have|had|will|would|could|should|may|might)\b/gi, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Score words by likely importance (capitalized = proper noun)
  const words = cleaned.split(" ");
  const importantWords = words.filter(
    (w) => w.length > 3 && (w[0] === w[0].toUpperCase() || w.length > 6)
  );

  // Build query: take first 8 important words
  const query = importantWords.slice(0, 8).join(" ").slice(0, 150);
  return query || shortText.slice(0, 100);
}

// ── Enrichment: fetch article text for deeper RAG ─────────────────────────

async function fetchArticleText(url) {
  if (!url || url === "#") return "";
  try {
    const resp = await axios.get(url, {
      timeout: 6000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VeritAI-FactChecker/1.0)",
      },
      maxRedirects: 3,
    });
    // Strip HTML tags
    const text = resp.data
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 2000);
  } catch {
    return "";
  }
}

module.exports = { searchNews, fetchArticleText, scoreSource };
