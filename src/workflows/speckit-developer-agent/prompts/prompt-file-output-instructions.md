## Output Format

Write every output file using this exact XML format — one block per file:

<file name="relative/path/to/file.md">
...file content here...
</file>

Rules:
- Use the path relative to the feature directory (e.g. "spec.md", "checklists/requirements.md")
- Do not include any prose or explanation outside of `<file>` blocks
- Every required output file must appear as a separate `<file>` block
