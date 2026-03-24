# Project constitution

These principles govern all automated and manual work in this repository.

## Quality

- Prefer small, reviewable changes with clear intent.
- Preserve existing patterns unless a task explicitly requires a new approach.

## Testing

- Add or update tests when behavior changes.
- Do not weaken existing tests to make a change pass without product approval.

## Security & configuration

- Do not commit secrets. Use environment variables or GitHub secrets.
- Validate inputs at system boundaries.

## Delivery

- Keep the codebase buildable and typecheck clean after each logical change.
- Document non-obvious decisions where the code cannot speak for itself.
