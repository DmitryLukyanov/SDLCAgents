# Jira Message Templates

These templates contain the text posted as Jira issue comments by the SDLC pipeline.
They are loaded at startup via `loadTemplate` in `src/lib/messages.ts` and exposed
through the `messages.jira` object.

---

## Templates

### `jira-taken.md`

**Posted when:** A Jira issue is moved to the "In Progress" (or configured
`POST_READ_STATUS`) status, signalling the pipeline has picked it up.

**Placeholders:** _None — static text._

---

### `jira-ba-complete.md`

**Posted when:** The Business Analyst agent finishes analysis successfully and
all required spec-kit fields have been extracted.

**Placeholders:** _None — static text._

---

### `jira-ba-incomplete.md`

**Posted when:** The Business Analyst agent cannot extract sufficient requirements
from the ticket. Clarification questions are appended to this comment by the caller
before posting.

**Placeholders:** _None — static text._

---

## How templates are loaded

```ts
import { loadTemplate } from './template-utils.js';

loadTemplate(import.meta.url, 'templates', '<filename>.md')
```

`loadTemplate` resolves the path relative to the calling file, reads the file
synchronously at module load time, and trims leading/trailing whitespace.
