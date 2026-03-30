/**
 * User-facing copy for integrations (Jira comments, etc.).
 */
export const messages = {
  jira: {
    /** Posted as a comment after moving an issue to POST_READ_STATUS (e.g. In Progress). */
    takenIntoProcessingComment: 'Ticket taken into processing.',
    /** Posted by BA when analysis is complete and AI Teammate is dispatched. */
    baAnalysisComplete: 'Business Analyst analysis complete. Dispatching AI Teammate.',
    /** Posted by BA when ticket lacks required information. */
    baAnalysisIncomplete: 'Business Analyst could not extract sufficient requirements. See questions below.',
  },
} as const;
