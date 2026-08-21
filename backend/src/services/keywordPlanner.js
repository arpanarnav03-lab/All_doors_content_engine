const { GoogleAdsApi } = require("google-ads-api");
const crypto = require("crypto");
const db = require("../db");

const REQUIRED_ENV = [
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_REFRESH_TOKEN",
  "GOOGLE_ADS_CUSTOMER_ID",
];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);

let client = null;
let customerConfig = null;

if (missingEnv.length > 0) {
  console.warn(
    `[keywordPlanner] Missing env vars: ${missingEnv.join(", ")} - keyword volume lookups disabled, will return null.`
  );
} else {
  client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });
  customerConfig = {
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, ""),
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  };
}

const CACHE_TTL_DAYS = 14;

// Google Ads doesn't expose an explicit "this value is bucketed" flag on
// GenerateKeywordHistoricalMetrics - low-spend/unlinked accounts just get
// avg_monthly_searches rounded to one of a small set of canonical values
// instead of a precise number. Treating an exact match against those known
// buckets as "likely bucketed" is a heuristic, not a guaranteed signal.
const KNOWN_LOW_SPEND_BUCKETS = [0, 10, 100, 1000, 10000, 100000, 1000000, 10000000];

function getCachedVolume(keyword) {
  const row = db
    .prepare(
      `SELECT search_volume, competition, is_bucketed FROM live_keyword_volume
       WHERE keyword = ? AND checked_at >= datetime('now', ?)`
    )
    .get(keyword, `-${CACHE_TTL_DAYS} days`);
  if (!row) return null;
  return {
    search_volume: row.search_volume,
    competition: row.competition,
    is_bucketed: !!row.is_bucketed,
  };
}

/**
 * Calls the Google Ads API for one keyword's historical search volume.
 * Never throws - returns null if the client isn't configured or the call
 * fails for any reason, so callers can degrade gracefully.
 */
async function fetchLiveVolume(keyword) {
  if (!client) return null;

  try {
    const customer = client.Customer(customerConfig);
    const response = await customer.keywordPlanIdeas.generateKeywordHistoricalMetrics({
      customer_id: customerConfig.customer_id,
      keywords: [keyword],
    });

    const result = response && response.results && response.results[0];
    const metrics = result && result.keyword_metrics;
    if (!metrics || metrics.avg_monthly_searches == null) return null;

    const searchVolume = metrics.avg_monthly_searches;
    const isBucketed = KNOWN_LOW_SPEND_BUCKETS.includes(searchVolume);

    return {
      search_volume: searchVolume,
      competition: metrics.competition || null,
      is_bucketed: isBucketed,
    };
  } catch (err) {
    console.error(`[keywordPlanner] fetchLiveVolume failed for "${keyword}":`, err.message || err);
    return null;
  }
}

/**
 * Main entry point: cache-first, then live lookup + cache write. Returns
 * null if the client isn't configured or every lookup path fails - never
 * throws, so callers can proceed without volume data.
 */
async function getKeywordVolume(keyword) {
  if (!keyword) return null;

  const cached = getCachedVolume(keyword);
  if (cached) return cached;

  const live = await fetchLiveVolume(keyword);
  if (!live) return null;

  db.prepare(
    `INSERT INTO live_keyword_volume (id, keyword, search_volume, competition, is_bucketed, checked_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(keyword) DO UPDATE SET
       search_volume = excluded.search_volume,
       competition = excluded.competition,
       is_bucketed = excluded.is_bucketed,
       checked_at = excluded.checked_at`
  ).run(crypto.randomUUID(), keyword, live.search_volume, live.competition, live.is_bucketed ? 1 : 0);

  return live;
}

module.exports = { getCachedVolume, fetchLiveVolume, getKeywordVolume };
