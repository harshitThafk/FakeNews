const axios = require("axios");
const cheerio = require("cheerio");

exports.scrapeUrl = async (url) => {
  try {
    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FakeNewsChecker/1.0)" },
    });
    const $ = cheerio.load(data);

    // Remove noise
    $("script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar").remove();

    // Try article-specific selectors first
    const selectors = ["article", "main", ".article-body", ".post-content", ".entry-content", "#content"];
    for (const sel of selectors) {
      const text = $(sel).text().trim();
      if (text.length > 200) return text.slice(0, 3000);
    }

    // Fallback: all paragraphs
    const paragraphs = $("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((t) => t.length > 50)
      .join(" ");

    if (paragraphs.length > 100) return paragraphs.slice(0, 3000);

    return $("body").text().replace(/\s+/g, " ").trim().slice(0, 3000);
  } catch (err) {
    throw new Error(`Failed to scrape URL: ${err.message}`);
  }
};
