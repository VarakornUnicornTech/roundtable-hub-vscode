# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x.x | Yes |
| < 1.0 | No |

## Reporting a Vulnerability

**DO NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

1. **Preferred:** Use [GitHub Security Advisories](https://github.com/VarakornUnicornTech/roundtable-hub-vscode/security/advisories/new)
2. **Alternative:** Contact [@VarakornUnicornTech](https://github.com/VarakornUnicornTech) directly

### Response Timeline

| Action | Timeframe |
|--------|-----------|
| Acknowledgment | 48 hours |
| Initial assessment | 7 days |
| Fix development | 30 days |
| Public disclosure | 90 days |

## Security Scope

### In Scope
- VS Code extension security (webview XSS, command injection)
- Data handling (credentials, API keys, user data)
- Extension permissions and privilege escalation
- Supply chain risks in dependencies

### Out of Scope
- VS Code platform vulnerabilities (report to Microsoft)
- Claude Code CLI vulnerabilities (report to Anthropic)

## Principles

1. **No secrets in code** — never commit API keys or credentials
2. **Minimal permissions** — request only necessary VS Code APIs
3. **Secure webviews** — CSP headers, input sanitization
4. **Dependency hygiene** — Dependabot monitors updates

## Hall of Fame

| Researcher | Date | Description |
|-----------|------|-------------|
| *Be the first!* | — | — |
