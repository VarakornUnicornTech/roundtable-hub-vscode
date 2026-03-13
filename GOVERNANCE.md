# RoundTable Hub Governance

## Built & Used in Production

> RoundTable Hub is the official VS Code extension companion for the [RoundTable Framework](https://github.com/VarakornUnicornTech/unicorn_roundtable_framework_repo). Both are actively used in production by [Unicorn Tech Integration Co., Ltd.](https://github.com/VarakornUnicornTech) — powered by Claude Code, governed by the RoundTable Framework, and directed by a human Commander.

## Project Leadership

### Owner (Commander)
- Final authority on all decisions
- Sole merge authority for `main` branch
- Controls Marketplace publishing
- GitHub: [@VarakornUnicornTech](https://github.com/VarakornUnicornTech)

### Maintainers
- Review and merge PRs to `dev`/`staging`
- Triage issues, manage labels
- See [MAINTAINERS.md](MAINTAINERS.md)

## Contributor Tiers

| Tier | Role | Permissions | How to Earn |
|------|------|------------|-------------|
| 1 | Contributor | Fork, PR, issues | First PR |
| 2 | Trusted Contributor | Assigned issues, advisory reviews | 3+ merged PRs |
| 3 | Reviewer | Binding review approval | Invitation, 10+ reviews |
| 4 | Maintainer | Merge to dev/staging | Commander approval |
| 5 | Owner | Merge to main, Marketplace publish | Commander only |

## Decision Making

- **Minor changes:** Lazy consensus (1 maintainer approval)
- **Significant changes:** Commander approval required
- **Commander's decision is final**

## Release Process

1. Semantic versioning (MAJOR.MINOR.PATCH)
2. CHANGELOG.md updated
3. `npm run package` produces .vsix
4. Commander publishes to VS Code Marketplace
5. Release tagged on `main`

## Amendments

Changes to this document require Commander approval with 7-day comment period.
