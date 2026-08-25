const crypto = require("crypto");
const { db } = require("../db");
const { callClaude } = require("./claude");

const CACHE_TTL_DAYS = 14;
const FETCH_TIMEOUT_MS = 5000;

if (!process.env.SERPAPI_KEY) {
  console.warn("[serpCheck] Missing env var: SERPAPI_KEY - SERP checks disabled, will return [].");
}

async function getCachedSerpResults(keyword) {
  const result = await db.execute({
    sql: `SELECT results_json FROM serp_cache
          WHERE keyword = ? AND checked_at >= datetime('now', ?)`,
    args: [keyword, `-${CACHE_TTL_DAYS} days`],
  });
  const row = result.rows[0];
  if (!row) return null;
  return JSON.parse(row.results_json);
}

/**
 * Calls SerpAPI's Google Search endpoint for the top 3 organic results.
 * Never throws - returns [] if unconfigured or the call fails for any
 * reason, so callers can degrade gracefully.
 */
async function fetchTopResults(keyword) {
  if (!process.env.SERPAPI_KEY) return [];

  try {
    const url =
      "https://serpapi.com/search?" +
      new URLSearchParams({
        engine: "google",
        q: keyword,
        api_key: process.env.SERPAPI_KEY,
        num: "3",
      });

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[serpCheck] SerpAPI request failed (${res.status}) for "${keyword}"`);
      return [];
    }

    const data = await res.json();
    const organic = data.organic_results || [];

    return organic.slice(0, 3).map((r) => ({
      title: r.title || "",
      url: r.link || "",
      snippet: r.snippet || "",
    }));
  } catch (err) {
    console.error(`[serpCheck] fetchTopResults failed for "${keyword}":`, err.message || err);
    return [];
  }
}

function stripHtml(html) {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function buildClassifyPrompt({ url, title, snippet, trimmedContent }) {
  return (
    "Classify this web page as exactly one word: blog, service, or other.\n\n" +
    "blog = informational article, guide, news piece, or explainer.\n" +
    "service = property listing, agent contact page, developer project page, or " +
    "transactional/booking page.\n" +
    "other = forums, PDFs, unclear pages, or anything that doesn't fit the above.\n\n" +
    "URL: " + url + "\n" +
    "Title: " + title + "\n" +
    "Snippet: " + snippet + "\n" +
    "Page content (first 500 chars): " + trimmedContent + "\n\n" +
    "Respond with exactly one word: blog, service, or other. No other text."
  );
}

/**
 * Fetches a URL's page and asks Claude to classify it as blog/service/other.
 * Never throws - returns "other" on any fetch/timeout/parse failure.
 */
async function classifyUrl(url, title, snippet) {
  let trimmedContent = "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) return "other";

    const html = await res.text();
    trimmedContent = stripHtml(html).slice(0, 500);
  } catch (err) {
    console.error(`[serpCheck] classifyUrl fetch failed for "${url}":`, err.message || err);
    return "other";
  }

  try {
    const rawText = await callClaude({
      model: process.env.CLAUDE_MODEL,
      maxTokens: 10,
      prompt: buildClassifyPrompt({ url, title, snippet, trimmedContent }),
    });

    const classification = (rawText || "").trim().toLowerCase();
    if (["blog", "service", "other"].includes(classification)) {
      return classification;
    }
    return "other";
  } catch (err) {
    console.error(`[serpCheck] classifyUrl Claude call failed for "${url}":`, err.message || err);
    return "other";
  }
}

/**
 * Main entry point: cache-first, then live SerpAPI lookup + per-result
 * classification + cache write. Returns [] if unconfigured or every
 * lookup path fails - never throws.
 */
async function checkKeywordSerp(keyword) {
  const cached = await getCachedSerpResults(keyword);
  if (cached) return cached;

  const results = await fetchTopResults(keyword);
  if (results.length === 0) return [];

  const classifications = await Promise.all(
    results.map((r) => classifyUrl(r.url, r.title, r.snippet))
  );

  const classified = results.map((r, i) => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet,
    classification: classifications[i],
  }));

  await db.execute({
    sql: `INSERT INTO serp_cache (id, keyword, results_json, checked_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(keyword) DO UPDATE SET
            results_json = excluded.results_json,
            checked_at = excluded.checked_at`,
    args: [crypto.randomUUID(), keyword, JSON.stringify(classified)],
  });

  return classified;
}

module.exports = { getCachedSerpResults, fetchTopResults, classifyUrl, checkKeywordSerp };
