# Contributing to OmniLog

First off, thank you for considering contributing to OmniLog! It's people like you that make OmniLog such a great tool.

## Where do I go from here?

If you've noticed a bug or have a feature request, please create an issue! It's better to open an issue first to discuss your proposed changes before writing code.

## Developing

OmniLog is a high-performance, privacy-first, client-side log analytics platform operating 100% in the browser.

### Setup

```bash
npm install
```

### Commands

```bash
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # tsc -b && vite build && node scripts/prerender.mjs
npm run preview    # Preview production build
npm run check      # Check contrast + design-tokens
npm run lint       # Run linter
```

### Architecture Constraints

Please keep the following constraints in mind when contributing:

1. **Zero-Egress (Log Data)**:
   - **Never** add `fetch`, `axios`, `XMLHttpRequest`, or any network call that touches log data.
   - **Never** add error reporting or telemetry that violates privacy.

2. **Memory Budget**:
   - Tab RAM must stay ≤ 500 MB regardless of file size.
   - Raw log strings are discarded from Worker memory after each chunk.

3. **Two-Layer Design**:
   - **Main Thread (React)**: UI only. Never touches raw log data directly.
   - **Worker Thread**: All heavy computation (`src/core/workers/logProcessor.worker.ts`).

## Pull Requests

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes (`npm run build` and `npm run check`).
5. Make sure your code lints (`npm run lint`).
6. Issue that pull request!

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).
