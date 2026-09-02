require("dotenv").config();
const { runBlogGraph } = require("../src/graph/blogGraph");

const fakeItem = {
  Headline: "Test headline for graph verification",
  Summary: "A short placeholder summary used only to exercise the graph end to end.",
  DataPoints: "No real data points, this is a test run.",
  Location: "Test Locality",
  UniqueInsight: "Placeholder insight for testing purposes.",
  ContentAngle: "Placeholder content angle for testing purposes.",
  ArticleText: "This is placeholder article text used to verify that the LangGraph StateGraph implementation of runBlogGraph executes end to end without errors.",
  Source: "https://example.com/test-article",
  Date: "Mon, 1 Jan 2026",
};

(async () => {
  console.log("Running graph-based runBlogGraph against a fake item...");
  const result = await runBlogGraph(fakeItem);
  console.log("\n=== RESULT ===");
  console.log("valid:", result.valid);
  console.log("issues:", JSON.stringify(result.issues, null, 2));
  console.log("blog present:", !!result.blog);
  if (result.blog) {
    console.log("headline:", result.blog.headline);
  }
})().catch((err) => {
  console.error("Graph execution failed:", err);
  process.exit(1);
});
