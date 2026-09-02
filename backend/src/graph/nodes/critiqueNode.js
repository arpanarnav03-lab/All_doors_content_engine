const { critiqueEditorial } = require("../../services/editorialCritique");

async function critiqueNode(state) {
  if (!state.draft) {
    return { editorialIssues: [] }; // nothing to critique if draft generation failed
  }
  const editorialIssues = await critiqueEditorial(state.draft);
  return { editorialIssues };
}

module.exports = { critiqueNode };
