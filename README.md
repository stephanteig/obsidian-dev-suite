# Dev Suite [DEV]

> **Development sandbox plugin for Obsidian.**
> Bundles multiple sub-plugins into one testable codebase. Not published to the Obsidian community registry — local dev only.

All user-facing elements are prefixed with `[DEV]` so the plugin is always visually distinct from production plugins installed alongside it.

---

## Modules

| Module | Description |
|---|---|
| **Color Preview** | Renders `color` and `palette` fenced code blocks as visual swatches. Click to copy values or edit hex via system color picker. Detects hex/rgb/hsl inline in notes. |
| **Client Context Switcher** | Tracks an active "client space". Creates client folders and index notes. Shows active client as a colored dot in the status bar and a highlighted ribbon icon. Supports per-client accent colors. |
| **Palette Extractor** | Scans the current note for hex, rgb(), and hsl() values and inserts a `palette` block. Skips existing `color`/`palette` blocks and deduplicates results. |
| **Smart Note Creator** | A three-step modal (title → type → details) that creates structured notes with frontmatter. Types: Meeting, Project, Client Brief, Research, Quick note, Reference. Intercepts Obsidian's default new-note action. Supports applying templates to existing notes. |

---

## Commands

```
[DEV] Client context: Switch space
[DEV] Client context: Open client dashboard
[DEV] Client context: Create new client
[DEV] Client context: Set color for active client

[DEV] Palette extractor: Extract palette from note
[DEV] Color preview: Extract palette from note

[DEV] Note creator: New note (modal)
[DEV] Note creator: Scan and repair frontmatter
[DEV] Note creator: Apply template to current note

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
│   └── color-preview/index.ts
└── CLAUDE.md                      # Full developer docs for Claude Code
```

---

## Build & deploy

```bash
npm run build

cp main.js "/Users/Stephan/Library/Mobile Documents/iCloud~md~obsidian/Documents/Stephan MacbookPro/.obsidian/plugins/dev-suite/main.js"
```

Reload Obsidian with `Cmd+R`.

> **Note:** `dev-suite` and the production `color-preview` plugin **cannot both be active at the same time** — both register the same Markdown code block processors. Disable the production plugin before enabling dev-suite.

---

## Architecture notes

### DevModal

All modals extend `DevModal` (`modules/shared/dev-modal.ts`) instead of Obsidian's `Modal` directly. This provides:

- **Header** — icon + title, auto-rendered
- **Client banner** — appears automatically when a client is active; includes a Switch button
- **Step indicator** — CSS progress bar, shown when `getStepCount()` is implemented
- **Body / Footer** — separate containers, never mix actions into body

### Shared modules

`modules/shared/` holds utilities imported by multiple modules to avoid circular dependencies. `ClientSwitcherModal` lives here because both `client-context` and `note-creator` need it.

### CSS design tokens

```css
--dev-radius-sm / -md / -lg
--dev-space-xs / -sm / -md / -lg
--dev-transition
--dev-client-color   /* per-client accent, overridden via inline style */
```

---

## Changelog

### 2026-05-18
- Fixed: status bar not rendering on load (wrapped in `onLayoutReady`)
- Fixed: switch space command unreliable (migrated to `getAllLoadedFiles`)
- Fixed: palette extractor picking up colors inside code blocks (explicit fence tracking)
- Removed: Research Dashboard module (deleted per design decision)
- Added: `DevModal` base class and shared CSS design system
- Added: Client Context — colored dot status bar, ribbon icon, per-client color picker
- Added: Note Creator — client banner with inline switch, client mismatch warning, new-note intercept, "Apply template to current note" command
