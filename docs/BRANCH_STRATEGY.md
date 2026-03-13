# Branch Strategy

## Three-Tier Model

```
feature/* ──> dev ──> staging ──> main
fix/*     ──> dev ──> staging ──> main
hotfix/*  ──> staging ──> main (+ cherry-pick to dev)
```

| Branch | Purpose | Who Merges | Protection |
|--------|---------|-----------|-----------|
| `main` | Marketplace releases | Owner only | 1 review + CI + Owner approval |
| `staging` | Pre-release testing | Maintainer | 1 review + CI |
| `dev` | Integration | Maintainer | CI pass |
| `feature/*` | New features | Author (PR to dev) | None |

## Merge Strategies

| Direction | Strategy |
|-----------|----------|
| feature → dev | Squash merge |
| dev → staging | Merge commit |
| staging → main | Merge commit |

## Release Flow

1. Features accumulate in `dev`
2. PR: dev → staging (maintainer review)
3. Test extension in staging
4. PR: staging → main (Owner approval)
5. Tag release, publish to Marketplace
