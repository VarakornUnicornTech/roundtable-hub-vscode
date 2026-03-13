# Contributing to RoundTable Hub

Thank you for your interest in contributing to RoundTable Hub — the VS Code extension companion for the RoundTable Framework.

## Built & Used in Production

> **This extension is built and used in production** by [Unicorn Tech Integration Co., Ltd.](https://github.com/VarakornUnicornTech) — fully powered by Claude Code, governed by the [RoundTable Framework](https://github.com/VarakornUnicornTech/unicorn_roundtable_framework_repo), and directed by a human Commander. We use this extension daily alongside the framework. If you're looking for an AI development tool built by practitioners who use it — you've found it.

## Code of Conduct

By participating, you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs
- Use the [Bug Report](https://github.com/VarakornUnicornTech/roundtable-hub-vscode/issues/new?template=bug_report.md) template
- Include your VS Code version, extension version, and OS
- Provide steps to reproduce

### Suggesting Features
- Use the [Feature Request](https://github.com/VarakornUnicornTech/roundtable-hub-vscode/issues/new?template=feature_request.md) template

### Submitting Pull Requests
All contributions welcome — from typo fixes to new features.

## Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) 18+
- [VS Code](https://code.visualstudio.com/) 1.110.0+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (for testing with framework)
- Git 2.30+

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/roundtable-hub-vscode.git
cd roundtable-hub-vscode
git remote add upstream https://github.com/VarakornUnicornTech/roundtable-hub-vscode.git
npm install
```

### Build & Test

```bash
# Compile TypeScript
npm run compile

# Watch mode (auto-recompile)
npm run watch

# Lint
npm run lint

# Package extension (.vsix)
npm run package
```

### Debug in VS Code
1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. Test the extension in the new VS Code window

## Branch Strategy

```
feature/* ──> dev ──> staging ──> main
fix/*     ──> dev ──> staging ──> main
hotfix/*  ──> staging ──> main (+ cherry-pick to dev)
```

| Branch | Purpose | Who Merges |
|--------|---------|-----------|
| `main` | Production / Marketplace releases | Owner only |
| `staging` | Pre-release validation | Maintainer |
| `dev` | Integration | Maintainer |

## Pull Request Process

1. Fork and branch from `dev`
2. Make changes, test locally with `F5`
3. Run `npm run lint` and `npm run compile` — must pass
4. Submit PR to `dev` with the PR template filled out
5. Maintainer reviews and merges

## Commit Message Convention

```
type(scope): description
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
**Scopes:** `ui`, `webview`, `api`, `config`, `ci`, `docs`

## AI Agent Contributors

See [docs/AI_AGENTS.md](docs/AI_AGENTS.md) for guidelines. AI-generated PRs must be disclosed and human-sponsored.

## License

Contributions are licensed under [MIT](LICENSE).

---

*Thank you for helping improve RoundTable Hub!*
