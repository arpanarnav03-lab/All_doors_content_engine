const { StateGraph, END } = require("@langchain/langgraph");
const { BlogState } = require("./state");
const { draftNode } = require("./nodes/draftNode");
const { validateNode } = require("./nodes/validateNode");
const { critiqueNode } = require("./nodes/critiqueNode");
const { fixNode } = require("./nodes/fixNode");

// Node key is "generateDraft", not "draft" - this LangGraph version
// (1.4.13) throws at graph-construction time if a node name collides
// with a state channel name ("draft is already being used as a state
// attribute... cannot also be used as a node name"), and the state has
// its own "draft" field holding the actual blog object. Verified this
// collision directly before settling on the rename.
const graph = new StateGraph(BlogState)
  .addNode("generateDraft", draftNode)
  .addNode("validate", validateNode)
  .addNode("critique", critiqueNode)
  .addNode("fix", fixNode)
  .addEdge("generateDraft", "validate")
  .addConditionalEdges("validate", (state) => {
    // If the draft failed to parse, retry drafting (up to maxRetries) rather
    // than proceeding to critique on a null draft.
    if (!state.draft) {
      return state.attempt > state.maxRetries ? END : "generateDraft";
    }
    return "critique";
  })
  .addConditionalEdges("critique", (state) => {
    const totalIssues = state.structuralIssues.length + state.editorialIssues.length;
    if (totalIssues === 0) return END;
    if (state.fixAttempted) return END; // only one fix attempt, per existing behavior
    return "fix";
  })
  .addEdge("fix", "validate") // re-validate the fixed draft, same as current re-validation logic
  .setEntryPoint("generateDraft");

const compiledGraph = graph.compile();

async function runBlogGraph(item, opts = {}) {
  const initialState = {
    item,
    targetWords: opts.targetWords || process.env.BLOG_TARGET_WORDS || 800,
    keywordData: opts.keywordData || {},
    maxRetries: opts.maxRetries ?? 2,
  };

  const result = await compiledGraph.invoke(initialState);

  const allIssues = [...result.structuralIssues, ...result.editorialIssues];

  if (!result.draft) {
    return { blog: null, valid: false, issues: ["All generation attempts returned malformed JSON"] };
  }

  return {
    blog: result.draft,
    valid: allIssues.length === 0,
    issues: allIssues,
  };
}

module.exports = { runBlogGraph };
