const { validateBlog } = require("../../blogGraph");

async function validateNode(state) {
  if (!state.draft) {
    return { structuralIssues: [state.parseError ? `Malformed JSON response: ${state.parseError}` : "No draft to validate"] };
  }
  const { issues } = validateBlog(state.draft);
  return { structuralIssues: issues };
}

module.exports = { validateNode };
