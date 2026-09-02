const { applyTargetedFix } = require("../../services/targetedFix");

async function fixNode(state) {
  const combinedIssues = [...state.structuralIssues, ...state.editorialIssues];
  console.log(
    `Found ${combinedIssues.length} issue(s) for "${state.item.Headline}" ` +
    `(${state.structuralIssues.length} structural, ${state.editorialIssues.length} editorial) - attempting targeted fix.`
  );
  const fixedBlog = await applyTargetedFix(state.draft, combinedIssues);
  if (!fixedBlog) {
    console.warn(`Targeted fix failed to parse for "${state.item.Headline}" - keeping original draft.`);
    return { fixAttempted: true }; // draft stays as-is, issues stay as-is
  }
  return { draft: fixedBlog, fixAttempted: true };
}

module.exports = { fixNode };
