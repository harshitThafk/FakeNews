/**
 * Enhanced Multi-Source Search & Fact-Check Service — v2
 */

const axios = require("axios");

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

  const seen = new Set();
  const unique = allResults.filter((r) => {
    const key = r.url || r.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const credOrder = { "fact-check": 0, high: 1, medium: 2, unknown: 3, low: 4 };
  unique.sort((a, b) => (credOrder[a.credibility] ?? 3) - (credOrder[b.credibility] ?? 3));

  console.log(`[Search] Found ${unique.length} unique results`);
  return unique.slice(0, 10);
}

async function searchGoogleFactCheck(query) {
  const apiKey = process.env.GOOGLE_FACT_CHECK_API_KEY;
  if (!apiKey) { console.log("[Search] ⚠️  No GOOGLE_FACT_CHECK_API_KEY"); return []; }
  console.log("[Search] 🔍 Calling Google Fact Check API...");

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

async function searchViaSerpAPI(query) {
  if (!process.env.SERPAPI_KEY) { console.log("[Search] ⚠️  No SERPAPI_KEY"); return []; }
  console.log("[Search] 🔍 Calling SerpAPI...");

  const resp = await axios.get("https://serpapi.com/search.json", {
    params: { q: query, tbm: "nws", num: 8, api_key: process.env.SERPAPI_KEY, gl: "us", hl: "en" },
    timeout: 10000,
  });

  return (resp.data.news_results || []).map((r) => ({
    title: r.title, url: r.link, snippet: r.snippet,
    source: r.source, credibility: scoreSource(r.source),
    publishedAt: r.date, type: "news",
  }));
}

async function searchViaNewsAPI(query) {
  if (!process.env.NEWSAPI_KEY) { console.log("[Search] ⚠️  No NEWSAPI_KEY"); return []; }
  console.log("[Search] 🔍 Calling NewsAPI...");

  const resp = await axios.get("https://newsapi.org/v2/everything", {
    params: { q: query.slice(0, 100), pageSize: 8, sortBy: "relevancy", language: "en", apiKey: process.env.NEWSAPI_KEY },
    timeout: 10000,
  });

  return (resp.data.articles || [])
    .filter((a) => a.title && a.title !== "[Removed]")
    .map((a) => ({
      title: a.title, url: a.url,
      snippet: a.description || a.content?.slice(0, 300),
      source: a.source?.name, credibility: scoreSource(a.source?.name),
      publishedAt: a.publishedAt, type: "news",
    }));
}

async function searchWikipedia(query) {
  const searchResp = await axios.get("https://en.wikipedia.org/w/api.php", {
    params: { action: "query", list: "search", srsearch: query.slice(0, 100), srlimit: 3, format: "json", origin: "*" },
    timeout: 6000,
  });

  const pages = searchResp.data.query?.search || [];
  if (pages.length === 0) return [];

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
          source: "Wikipedia", credibility: "high", type: "encyclopedia",
        };
      } catch { return null; }
    })
  );

  return results.filter(Boolean);
}

function extractSearchQuery(shortText, fullText) {
  const text = (shortText + " " + fullText).slice(0, 500);

  // Remove common stop words
  const cleaned = text
    .replace(/\b(the|a|an|is|are|was|were|has|have|had|will|would|could|should|may|might|this|that|these|those|with|from|they|their|them|when|where|what|how|why|who)\b/gi, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ");

  // Extract proper nouns (capitalized words) and important keywords
  const properNouns = words.filter((w) => w.length > 2 && w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase());
  const importantWords = words.filter((w) => w.length > 4 && ['died', 'death', 'dead', 'killed', 'murdered', 'passed', 'funeral', 'obituary', 'cancer', 'illness', 'hospital', 'emergency', 'tragedy', 'accident', 'crash', 'shooting', 'attack', 'war', 'conflict', 'election', 'president', 'government', 'scandal', 'corruption', 'fraud', 'hoax', 'fake', 'conspiracy', 'secret', 'exposed', 'shocking', 'breaking', 'exclusive'].includes(w.toLowerCase()));

  // Combine and prioritize: proper nouns first, then important keywords
  const queryWords = [...new Set([...properNouns, ...importantWords])];

  // Create a more specific query by combining key elements
  let query = queryWords.slice(0, 6).join(" ");

  // If we have a very short query, add context
  if (query.length < 10) {
    query = shortText.slice(0, 100);
  }

  // Add quotes around the main subject if it's a person/event
  if (properNouns.length > 0) {
    const mainSubject = properNouns[0];
    query = `"${mainSubject}" ${query.replace(mainSubject, '').trim()}`;
  }

  return query.slice(0, 150) || shortText.slice(0, 100);
}

async function fetchArticleText(url) {
  if (!url || url === "#") return "";
  try {
    const resp = await axios.get(url, {
      timeout: 6000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VeritAI-FactChecker/1.0)" },
      maxRedirects: 3,
    });
    const text = resp.data
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 2000);
  } catch { return ""; }
}

module.exports = { searchNews, fetchArticleText, scoreSource };
