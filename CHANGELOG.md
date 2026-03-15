# Changelog

All notable changes to the RoundTable Hub extension will be documented in this file.

## [1.4.0] - 2026-03-15

### Added
- **Push to Hub button** — One-click sync workspace data (tickets, sessions, briefings) to RoundTable Hub database via API or CLI fallback
- **`roundtable.hubApiUrl` setting** — Configure Hub API server URL (default: `http://localhost:5200`)
- **`roundtable.hubApiPath` setting** — Configure Hub.Api project path for CLI fallback (auto-detected if empty)

---

## [1.3.0] - 2026-03-14

### Changed
- **All features are now FREE** — Pro/Trial gate removed entirely; all features unlocked for everyone (monetization revisited in 1 year)
- **Setup Project button** — Now shows "N Projects Configured" when projects exist, instead of always showing "Setup Project"
- **Update Framework → Update Preview** — Button renamed; now copies `/template preview` to clipboard and focuses Claude Code instead of opening a terminal
- **FREE badge** replaces PRO/TRIAL badge in sidebar header
- Removed Upgrade to Pro card, trial banner, and license key prompt from sidebar

### Fixed
- Framework version no longer shows "vunknown" — `template-version.json` is now reliably copied during installation from the framework repository

---

## [1.2.2] - 2026-03-13

### Fixed
- **Roster Viewer** — now supports Framework v1.3.0 path (`.claude/agents/`) with fallback to legacy (`.claude/Team Roster/`)
- **Policy Browser** — now supports Framework v1.3.0 path (`.claude/TeamDocument/1. Policies/`) with fallback to legacy (`.claude/policies/`)
- **Health Check** — auto-detects Framework version and checks correct file paths and names for both v1.3.0+ and legacy

### Changed
- All 3 services use automatic path detection — fully backward compatible with older Framework versions

---

## [1.2.1] - 2026-03-12

### Added
- **60-Day Free Trial** — All Pro features automatically unlocked for 60 days on first install, no license key required
- **Trial status banner** — Shows remaining trial days with quick links to enter key or purchase
- **"Already have a license key?"** link in Upgrade card — direct access to license settings
- **TRIAL badge** in sidebar header during active trial period

### Changed
- Pro unlock logic now checks both license key AND trial status
- Trial start date persisted via VS Code globalState (survives reinstalls on same machine)

---

## [1.2.0] - 2026-03-12

### Added
- **Policy Browser** (Pro) — Browse and open all governance policy files directly from the sidebar
- **Team Roster Viewer** (Pro) — View teams, members, roles, and responsibilities in a collapsible tree view
- **Session Statistics** (Pro) — Activity metrics: total sessions, daily averages, streaks, and participant tracking

### Changed
- Async license validation now runs on extension startup with 24-hour cache
- License key changes automatically trigger re-validation and sidebar refresh
- Updated README with full Free vs Pro feature comparison
- Expanded "Upgrade to Pro" feature list in sidebar to include all Pro features

---

## [1.1.0] - 2026-03-12

### Added
- **Visual ProjectEnvironment Editor** (Pro) — Add, edit, and remove projects through a sidebar form UI instead of editing markdown manually
- **Quick Session Open** (Free) — One-click button to create/open today's RoundTable session file
- **Framework Health Check** (Pro) — Verify framework integrity with a score and detailed file-by-file status report

---

## [1.0.2] - 2026-03-12

### Changed
- Updated purchase URL to live LemonSqueezy checkout link

---

## [1.0.1] - 2026-03-12

### Changed
- Updated README for v1.0.0 Pro features — removed outdated "Coming Soon" labels, added Session Log Dashboard and Pro License System descriptions, removed broken shields.io badges

---

## [1.0.0] - 2026-03-12

### Added
- **Pro License System** — LemonSqueezy license key validation with offline fallback
- **Session Log Dashboard** — Browse RoundTable session history directly from sidebar (Pro)
- **Purchase Flow** — One-click upgrade button linking to LemonSqueezy storefront
- Pro/Free badge display in sidebar header
- License key configuration in VS Code Settings

### Changed
- Sidebar dynamically shows Pro or Free features based on license status
- Updated extension icon to new logo design
- Removed external badge images from README

### Notes
- First monetized release — Pro features require a valid license key
- Free tier includes: Install, Setup, Check for Updates
- Pro tier adds: Update Framework, Session Log Dashboard

---

## [0.1.2] - 2026-03-12

### Changed
- Updated extension icon to new logo design
- Removed external badge images from README to prevent broken images on Marketplace

---

## [0.1.1] - 2026-03-12

### Added
- Post-install welcome dialog with "Getting Started" guide options (English / Thai)
- GETTING_STARTED.md and GETTING_STARTED_TH.md included in framework template
- Gallery banner for VS Code Marketplace listing
- Machine Learning category for better discoverability
- Version, installs, and license badges in README
- Commands reference table in README
- Known Issues and Contributing sections in README
- CHANGELOG.md for version history

### Changed
- Post-install dialog now offers Getting Started guide instead of just Setup Project

---

## [0.1.0] - 2026-03-12

### Added
- One-click RoundTable Framework installation from GitHub
- Visual ProjectEnvironment setup wizard (Centralized/Decentralized mode)
- Automatic version check on startup with update notifications
- Smart Update Manager with file-by-file diff and selective apply (Pro)
- Auto-backup before updates with one-click rollback (Pro)
- Branded sidebar webview with framework status dashboard
- Activity Bar icon for quick access
- Configurable settings: repository URL, license key, auto-check updates

### Notes
- Initial public release on VS Code Marketplace
- Requires VS Code 1.110.0 or later
- Requires Git installed and available in PATH
