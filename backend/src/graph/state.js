const { Annotation } = require("@langchain/langgraph");

const BlogState = Annotation.Root({
  item: Annotation({ reducer: (_, y) => y }),
  targetWords: Annotation({ reducer: (_, y) => y, default: () => 800 }),
  keywordData: Annotation({ reducer: (_, y) => y, default: () => ({}) }),
  draft: Annotation({ reducer: (_, y) => y, default: () => null }),
  structuralIssues: Annotation({ reducer: (_, y) => y, default: () => [] }),
  editorialIssues: Annotation({ reducer: (_, y) => y, default: () => [] }),
  attempt: Annotation({ reducer: (_, y) => y, default: () => 0 }),
  maxRetries: Annotation({ reducer: (_, y) => y, default: () => 2 }),
  fixAttempted: Annotation({ reducer: (_, y) => y, default: () => false }),
  parseError: Annotation({ reducer: (_, y) => y, default: () => null }),
});

module.exports = { BlogState };
