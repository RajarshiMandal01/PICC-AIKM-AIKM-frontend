# PICC - AIKM - AIKM Frontend

> Part of **Nubo Native Platform (NNP)** ·
> Area: **Platform Infrastructure and Core Components (PICC)** · License: **Apache-2.0**

Frontend application for the AI Knowledge Management (AIKM) experience in the
Nubo Native Platform. The app is built with React, Vite, TypeScript, Material UI,
Tailwind CSS, and shared NNP styles.

> 📦 This repository contains the runnable frontend source for knowledge
> management, SQL query support, platform component configuration, and related
> AIKM workflows.
> Contributors: please read [CONTRIBUTING.md](CONTRIBUTING.md) before pushing
> code, and never commit secrets, `.env` files, credentials, tokens, or real
> deployment URLs.

## Run the project

Prerequisites:

- Node.js 20 or newer
- npm 10 or newer
- Access to required private packages, such as the shared NNP styles package
- Backend service URLs for the target environment

Install dependencies:

```bash
npm install
```

Create an uncommitted local environment file from the example:

```bash
cp .env.example .env.local
```

Replace the placeholder values in `.env.local` with environment-specific values.

Run locally:

```bash
npm run dev
```

Build, preview, and lint:

```bash
npm run build
npm run preview
npm run lint
```

If installation fails while fetching a private package, configure npm or Git
access using approved credentials. Do not place tokens directly in
`package.json`, committed scripts, or documentation.

## Community & contributing

- 🤝 [Contributing guide](CONTRIBUTING.md) · 📜 [Code of Conduct](CODE_OF_CONDUCT.md)
- 👥 [Maintainers](MAINTAINERS.md)

Contact: **contribution@nubons.com**

## License

Licensed under the **Apache License 2.0** — see [LICENSE](LICENSE).
