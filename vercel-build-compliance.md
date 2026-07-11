---
name: vercel-build-compliance
description: Pre-build validation rule to guarantee code compiles perfectly under Vercel specifications before Git commits.
---

## Vercel Compliance Rules

### 1. Zero-Tolerance Type Safety
* Always run `tsc --noEmit` before proposing code changes.
* Never use `any` unless explicitly required by a strict third-party type.
* Ensure all dynamic routing params match the exact template typing.

### 2. Linting & Next.js Constraints
* Run `next lint` or equivalent framework linters.
* Do not leave unescaped single/double quotes inside JSX. Use `{'text'}` or HTML entities.
* Do not use standard `<img>` tags inside Next.js; enforce `<Image />` component usage.

### 3. Environment Variable Integrity
* Confirm any required process.env variables are accounted for locally or mocked.
* Inform the user immediately if a newly introduced variable needs to be added to the Vercel Dashboard.

### 4. Verification Step
* Before completing a coding task, simulate the environment locally by running:
  `vercel build`
