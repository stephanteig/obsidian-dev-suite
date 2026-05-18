# Dev Suite [DEV]

> **Development sandbox plugin for Obsidian.**
> Bundles multiple sub-plugins into one testable codebase. Not published to the Obsidian community registry — install manually or via BRAT.

All user-facing elements are prefixed with `[DEV]` so the plugin is always visually distinct from production plugins installed alongside it.

---

## Installation

### Option A — BRAT (recommended)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) lets you install and update GitHub-hosted plugins that aren't in the community store.

1. Install **Obsidian42 - BRAT** from the Obsidian community plugins list
2. Open BRAT settings → **Add Beta plugin**
3. Enter: `stephanteig/obsidian-dev-suite`
4. Click **Add plugin** — BRAT downloads and installs automatically
5. Enable **Dev Suite [DEV]** in Settings → Community Plugins

To update later: BRAT settings → **Check for updates**.

### Option B — Manual install

1. Go to the [latest release](https://github.com/stephanteig/obsidian-dev-suite/releases/latest)
2. Download `main.js`, `manifest.json`, and `styles.css`
3. Create the folder `.obsidian/plugins/dev-suite/` in your vault
4. Copy the three files into that folder
5. Reload Obsidian and enable **Dev Suite [DEV]** in Settings → Community Plugins

> **Note:** `dev-suite` and the production `color-preview` plugin **cannot both be active at the same time** — both register the same Markdown code block processors. Disable the production plugin before enabling dev-suite.

---

## Modules

| Module | Description |
|---|---|
| **Color Preview** | Renders `color` and `palette` fenced code blocks as visual swatches. Click to copy values or edit hex via system color picker. Detects hex/rgb/hsl inline in notes. |
| **Client Context** | Tracks an active "client space". Creates client folders and index notes. Shows active client as a colored dot in the status bar and a highlighted ribbon icon. Supports per-client accent colors. |
| **Palette Extractor** | Scans the current note for hex, rgb(), and hsl() values and inserts a `palette` block. Skips existing `color`/`palette` blocks and deduplicates results. |
| **Smart Note Creator** | A three-step modal (title → type → details) that creates structured notes with frontmatter. Types: Meeting, Project, Client Brief, Research, Quick note, Reference. Intercepts Obsidian's default new-note action (toggle). Warns on first open when a note is missing frontmatter (dismissable per file). |
| **Dev Panel** | Side panel (right sidebar) controlling all modules. Active client section with smart dashboard button — "Update dashboard" regenerates an Overview stats table and per-type note tables from the client folder without overwriting manual content. |

---

## Commands

```
[DEV] Open Dev Suite panel

[DEV] Client context: Switch space
[DEV] Client context: Open client dashboard
[DEV] Client context: Create new client
[DEV] Client context: Set color for active client

[DEV] Note creator: New note (modal)
[DEV] Note creator: Scan and repair frontmatter
[DEV] Note creator: Apply template to current note

[DEV] Palette extractor: Extract palette from note
[DEV] Color preview: Extract palette from note

[DEV] Color preview: Insert color (color picker)
[DEV] Color preview: Insert color (type hex)
[DEV] Color preview: Insert color from clipboard
[DEV] Color preview: Insert empty color block
[DEV] Color preview: Convert selection to color block
```

---

## Tech stack

- **TypeScript** — compiled with esbuild
- **Obsidian Plugin API** + CodeMirror 6
- **No external UI frameworks** — pure `createEl()` + CSS custom properties

---

## Project structure

```
obsidian-dev-suite/
├── main.ts                        # Plugin entry — loads all modules
├── types.ts                       # Shared settings interfaces
├── styles.css                     # All module styles + design tokens
├── manifest.json
├── modules/
│   ├── shared/
│   │   ├── dev-modal.ts           # Abstract base class for all modals
│   │   └── client-switcher.ts     # Shared FuzzySuggestModal
│   ├── client-context/index.ts
│   ├── palette-extractor/index.ts
│   ├── note-creator/index.ts
│   ├── color-preview/index.ts
│   └── dev-panel/index.ts         # Side panel ItemView
└── CLAUDE.md                      # Full developer docs for Claude Code
```

---

## Build & deploy (local dev)

```bash
npm install
npm run build

# Copy to your vault
cp main.js "/path/to/vault/.obsidian/plugins/dev-suite/main.js"
cp styles.css "/path/to/vault/.obsidian/plugins/dev-suite/styles.css"
```

Reload Obsidian with `Cmd+R`.

---

## Architecture notes

### DevModal

All modals extend `DevModal` (`modules/shared/dev-modal.ts`) instead of Obsidian's `Modal` directly. This provides:

- **Header** — icon + title, auto-rendered
- **Client banner** — appears automatically when a client is active; includes a Switch button
- **Step indicator** — CSS progress bar, shown when `getStepCount()` is implemented
- **Body / Footer** — separate containers, never mix actions into body

### Dashboard generation

"Update dashboard" in the Dev Panel scans the active client's folder via `metadataCache`, groups notes by their `type` frontmatter field, and writes a block of tables into the dashboard file. The block is wrapped in HTML comment markers so manual content above and below is never touched:

```
<!-- dev:generated:start -->
## Overview
| Notes | Last activity | Types | Updated |
...
## Meetings (3)
| Note | Date | Attendees |
...
<!-- dev:generated:end -->
```

### CSS design tokens

```css
--dev-radius-sm / -md / -lg
--dev-space-xs / -sm / -md / -lg
--dev-transition
--dev-client-color   /* per-client accent, overridden via inline style */
```

---

## Changelog

### 0.1.0 — 2026-05-18

- **Dev Panel** side panel controlling all modules
- **Dashboard auto-generation** — Update dashboard generates Overview stats + per-type note tables (Meetings, Projects, Research, etc.) from the client folder; manual content is preserved via HTML comment markers
- **Intercept fix** — new-note notice no longer floods on Obsidian startup reload
- **Frontmatter warning** — warns on first open of notes missing required fields; dismissable per file
- **Settings toggles** — independently enable/disable the intercept notice and frontmatter warning
- **Client Context** — colored dot status bar, ribbon icon, per-client color picker
- **Note Creator** — client banner with inline switch, client mismatch warning, apply template command
- **Bug fixes** — status bar load timing, switch space reliability, palette extractor code block filter
