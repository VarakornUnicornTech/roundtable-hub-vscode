# Changelog

All notable changes to the RoundTable Hub extension will be documented in this file.

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
