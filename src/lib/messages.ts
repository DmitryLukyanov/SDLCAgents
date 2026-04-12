/**
 * User-facing copy for integrations (Jira comments, etc.).
 */
import { loadTemplate } from './template-utils.js';

export const messages = {
  jira: {
    /** Posted as a comment after moving an issue to POST_READ_STATUS (e.g. In Progress). */
    takenIntoProcessingComment: loadTemplate(import.meta.url, 'templates', 'jira-taken.md'),
    /** Posted by BA when analysis is complete and AI Teammate is dispatched. */
    baAnalysisComplete: loadTemplate(import.meta.url, 'templates', 'jira-ba-complete.md'),
    /** Posted by BA when ticket lacks required information. */
    baAnalysisIncomplete: loadTemplate(import.meta.url, 'templates', 'jira-ba-incomplete.md'),
  },
};
