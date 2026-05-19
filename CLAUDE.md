# CLAUDE.md — obsidian-dev-suite

This file provides guidance to Claude Code when working in this repository.

---

## Project Overview

**Dev Suite [DEV]** is a multi-module Obsidian plugin used as a development sandbox.
It bundles four sub-plugins into one testable codebase and copies the full source of the
Color Preview plugin so all color rendering is available during development.

Every user-facing element is marked with `[DEV]` — command palette entries, ribbon icons,
modal titles, sidebar view headers, status bar items — so it is always visually distinct
from production plugins.

**Repo:** `obsidian-dev-suite/` (local dev only — not published to Obsidian community)

### Production split (completed 2026-05-18)

The two production clusters have been split out into standalone plugins:

| Plugin | Repo | Modules | Status |
|---|---|---|---|
| **Color Preview** | `stephanteig/obsidian-color-preview` | Color Preview + Palette Extractor | v1.1.0 released |
| **Brief** | `stephanteig/obsidian-brief` | Client Context + Note Creator + Panel | v1.0.0 released |

Dev Suite continues as the sandbox — all `[DEV]`-marked modules remain here for testing.
When new features are ready for production, port them to the relevant standalone plugin.

---

## Tech Stack

- **Language:** TypeScript 4.7, compiled with esbuild
- **Runtime:** Obsidian Plugin API + CodeMirror 6
- **Key CM6 APIs:** `ViewPlugin`, `WidgetType`, `Decoration`, `DecorationSet`, `RangeSetBuilder`
- **Build:** `npm run build` → runs `tsc --noEmit` then `esbuild.config.mjs production`
- **Lint:** `npx eslint main.ts` using `eslint-plugin-obsidianmd`

---

## Source Structure

```
obsidian-dev-suite/
  main.ts                  — plugin entry, loads all modules
  types.ts                 — shared DevSuiteSettings, DevPlugin interfaces
  manifest.json            — id: "dev-suite", name: "Dev Suite [DEV]"
  styles.css               — merged styles from all modules
  package.json / tsconfig.json / esbuild.config.mjs / eslint.config.mjs
  CLAUDE.md                — this file
  modules/
    shared/
      dev-modal.ts               — Abstract base class for all Dev Suite modals
      client-switcher.ts         — ClientSwitcherModal (shared, avoids circular deps)
    client-context/index.ts      — Module 1: Client Context Switcher
    palette-extractor/index.ts   — Module 4: Palette Extractor
    note-creator/index.ts        — Module 5: Smart Note Creator
    color-preview/index.ts       — Color Preview (copied + adapted)
    dev-panel/index.ts           — Side panel ItemView (controls all modules)
```

**Removed:** `modules/research-dashboard/` — deleted per user request (2026-05-18).

---

## Deploy Workflow

```bash
npm run build
cp main.js "/Users/Stephan/Library/Mobile Documents/iCloud~md~obsidian/Documents/Stephan MacbookPro/.obsidian/plugins/dev-suite/main.js"
```

Then reload Obsidian with Cmd+R.

Verify the deploy with:
```bash
md5 main.js
md5 "/Users/Stephan/Library/Mobile Documents/iCloud~md~obsidian/Documents/Stephan MacbookPro/.obsidian/plugins/dev-suite/main.js"
```
Both hashes must match.

**Important:** dev-suite and the production `color-preview` plugin **cannot both be enabled at the same time.** Both register the `"color"` and `"palette"` Markdown code block processors. Obsidian throws a fatal error on duplicate processor names, causing "Failed to load plugin". Always disable the production plugin before enabling dev-suite.

---

## Module Architecture

Each module exports a `load<ModuleName>(plugin: DevPlugin): void` function.
`main.ts` calls each loader after checking the module toggle in settings.

The `DevPlugin` type (in `types.ts`) is:

```typescript
type DevPlugin = Plugin & {
    settings: DevSuiteSettings;
    saveSettings(): Promise<void>;
    refreshPanel?: () => void;   // set in main.ts; modules call this to re-render the side panel
};
```

Modules import `DevPlugin` from `../../types` — never from `../../main` — to avoid
circular dependencies.

The `ColorPreviewModule` class instance is returned by `loadColorPreview()` and passed
to `loadPaletteExtractor()` so the extractor can reuse rendering logic.

### Shared modules

`modules/shared/` contains utilities imported by multiple modules:

- **`dev-modal.ts`** — abstract `DevModal` base class. All Dev Suite modals extend this
  instead of Obsidian's `Modal` directly. Provides: header (icon + title), client banner
  (auto-shown when a client is active, has a Switch button), step indicator, body, footer.
  Subclasses implement `getModalTitle()`, `getModalIcon()`, `renderBody()`, `renderFooter()`.
  Optional: `getStepCount()`, `getCurrentStep()`, `onSwitchClient()`.

- **`client-switcher.ts`** — exports `ClientSwitcherModal`. Extracted here because both
  `client-context` and `note-creator` need it. Importing from a shared location avoids a
  circular dependency between those two modules.

---

## DevModal — Usage Guide

All new modals must extend `DevModal`:

```typescript
import { DevModal } from "../shared/dev-modal";

class MyModal extends DevModal {
    getModalTitle(): string { return "My title"; }
    getModalIcon(): string  { return "lucide-icon-name"; }

    // Optional — omit if no step indicator needed
    getStepCount(): number   { return 3; }
    getCurrentStep(): number { return this.step; }

    renderBody(): void {
        // Use this.bodyEl — never this.contentEl
        this.bodyEl.createEl("p", { text: "Content here" });
    }

    renderFooter(): void {
        this.addFooterButton("Cancel", false, () => this.close());
        this.addFooterButton("Submit", true, () => void this.submit());
    }

    // Override to handle the Switch button in the client banner
    protected onSwitchClient(): void {
        new ClientSwitcherModal(this.app, this.plugin, async (client) => {
            this.plugin.settings.clientContext.activeClient = client;
            await this.plugin.saveSettings();
            this.refreshBanner();
        }).open();
    }
}
```

**When stepping between views** (like `NoteCreatorModal`):
```typescript
private transition(nextStep: number): void {
    this.step = nextStep;
    this.bodyEl.empty();
    this.footerEl.empty();
    this.refreshStepIndicator(); // redraws step bar based on getCurrentStep()
    this.renderBody();
    this.renderFooter();
}
```

**Never use `this.contentEl.empty()`** after `onOpen()` — only empty and refill `bodyEl` and `footerEl`.

---

## Code Pitfalls — ALWAYS APPLY FROM THE FIRST LINE

These come from hard lessons in the Color Preview plugin. Apply proactively:

- **NEVER** use `.innerHTML` — use `setIcon()`, `createEl()`, `createDiv()` instead
- **ALWAYS** add `void` before any promise that is not being awaited
- **ALWAYS** add `.catch(() => {})` on any clipboard API calls
- **NEVER** use `style.opacity` or `style.cssText` directly — use a CSS class in `styles.css`
- **NEVER** use `notice.noticeEl` — use `notice.messageEl`
- **NEVER** use `createEl("h2")` in modal body — `DevModal` handles the header
- **NEVER** use `createEl("h2")` in settings or include the plugin name in a settings heading
- **ALWAYS** wrap DOM writes in `plugin.app.workspace.onLayoutReady()` when called from `onload()`
- **ALWAYS** use `vault.getAllLoadedFiles()` instead of `folder.children` for vault traversal
- Keep `@codemirror/state` pinned at `6.6.0` to match `@codemirror/view@6.38.6`
- If `npm ci` fails in CI, use `--legacy-peer-deps` in the workflow

---

## CSS Design System

All new CSS must use the design tokens defined at the top of `styles.css`:

```css
--dev-radius-sm / -md / -lg   /* border radii */
--dev-space-xs / -sm / -md / -lg  /* spacing scale */
--dev-transition               /* 0.15s ease — for hover/focus transitions */
--dev-client-color             /* per-client accent, defaults to --interactive-accent */
```

**Rules:**
- No inline `style=` for colors or spacing — use tokens and CSS classes
- All interactive elements must have `:hover` states in CSS
- Use `color-mix(in srgb, var(--some-color) N%, transparent)` for tinted backgrounds
- CSS class naming: `dev-<module-abbr>-<element>` e.g. `dev-cc-dot`, `dev-nc-type-card`

### Existing components (ready to use)
| Class | What it renders |
|---|---|
| `.dev-client-badge` | Colored pill with client name |
| `.dev-modal-header/body/footer` | DevModal layout containers |
| `.dev-modal-client-banner` | Active client banner with Switch button |
| `.dev-step-indicator` + `.dev-step-indicator__step` | Step progress bar |
| `.dev-cc-dot` | Colored circle dot (used in status bar and switcher) |
| `.dev-cc-suggest-row` | Suggest list row with dot + label |
| `.dev-nc-type-grid` / `.dev-nc-type-card` | Note type picker grid |
| `.dev-nc-client-warning` | Orange mismatch warning banner |
| `.dev-nc-intercept-notice` | Notice container (flex column, gap 8px) |
| `.dev-nc-notice-header` | Notice title row (flex, space-between) |
| `.dev-nc-notice-close` | X button inside notice header |
| `.dev-nc-notice-actions` | Row of action buttons at notice bottom |
| `.dev-nc-intercept-btn` | Primary action button inside a notice |
| `.dev-nc-notice-dismiss` | "Don't show again" button (ghost style) |
| `.dev-panel-*` | All Dev Panel side-panel components |

---

## Command Naming Convention

All commands MUST follow this format:

```
[DEV] Client context: Switch space
[DEV] Client context: Open client dashboard
[DEV] Client context: Create new client
[DEV] Client context: Set color for active client
[DEV] Palette extractor: Extract palette from note
[DEV] Note creator: New note (modal)
[DEV] Note creator: Scan and repair frontmatter
[DEV] Note creator: Apply template to current note
[DEV] Color preview: Insert color (color picker)
[DEV] Color preview: Insert color (type hex)
[DEV] Color preview: Insert color from clipboard
[DEV] Color preview: Insert empty color block
[DEV] Color preview: Convert selection to color block
[DEV] Color preview: Extract palette from note
```

---

## Pre-Release Checklist

Only run when a module is **functionally complete and ready for review** — not during early
feature development. Run TWICE. Fix all issues found in Pass 1, then re-run from scratch
to confirm a clean result.

### Pass 1 and Pass 2 (run both):

1. **Build**
   ```bash
   npm run build
   ```
   Must exit with zero errors. Fix all TypeScript errors before continuing.

2. **ESLint**
   ```bash
   npx eslint main.ts
   ```
   Must produce zero output — zero errors, zero warnings.

3. **Check manifest.json version field** is correct for this module milestone.

4. **Copy to vault for visual testing:**
   ```bash
   cp main.js "/Users/Stephan/Library/Mobile Documents/iCloud~md~obsidian/Documents/Stephan MacbookPro/.obsidian/plugins/dev-suite/main.js"
   ```
   Reload Obsidian (Cmd+R) and do a visual check of the feature.

5. Confirm all new commands are **prefixed with `[DEV]`** and visible in the command palette.

6. Confirm no `.innerHTML`, no floating promises, no `style.opacity` direct assignments
   appear in any changed files.

After both passes are clean, report:
`✅ Pre-release checklist passed x2 — [module name] is ready.`

---

## Module Toggle System

In Dev Tools settings, each module can be toggled on/off independently.
Toggle state is stored in `plugin.settings.modules`.
Changes take effect after reloading the plugin (Cmd+R in Obsidian).

**Active module toggles:** `colorPreview`, `clientContext`, `paletteExtractor`, `noteCreator`.
`researchDashboard` has been removed entirely.

---

## Current Status (2026-05-18)

### Module status
| Module | Status |
|---|---|
| **Color Preview** | ✅ Fully working — all rendering, interactions, commands pass |
| **Client Context** | ✅ Overhauled — colored dot, ribbon icon, per-client color picker, reliable switcher |
| **Note Creator** | ✅ Overhauled — DevModal layout, banner quick-switch, client warning, intercept (fixed), frontmatter warning, settings toggles |
| **Palette Extractor** | ✅ Bug fixed — code block exclusion now reliable |
| **Dev Panel** | ✅ Side panel controlling all modules — reactive, editor-aware, full section layout |
| **Research Dashboard** | ❌ Removed per user request |

### Bugs fixed (2026-05-18)
| ID | Module | Fix |
|---|---|---|
| B-1 | Client Context | Status bar `renderStatusBar()` wrapped in `workspace.onLayoutReady()` |
| B-2 | Client Context | `ClientSwitcherModal.getItems()` replaced `folder.children` with `vault.getAllLoadedFiles()` |
| B-3 | Palette Extractor | `stripFrontmatterAndCodeBlocks()` rewritten with explicit `openFence` tracking — closing fence must be bare backticks, no language tag |
| B-4 | Note Creator | `vault.on("create")` wrapped in `onLayoutReady` + `ctime > 3s` guard — intercept no longer floods on Obsidian startup reload |

### What was built (2026-05-18)

**Session 1 — Bug fixes + Research Dashboard removal**
- Fixed B-1, B-2, B-3
- Deleted `modules/research-dashboard/index.ts`
- Removed all references from `main.ts`, `types.ts`, `styles.css`

**Session 2 — CSS foundation + shared infrastructure**
- Added design tokens and component CSS (DevModal layout, step indicator, client badge)
- Created `modules/shared/dev-modal.ts` — abstract `DevModal` base class
- Created `modules/shared/client-switcher.ts` — `ClientSwitcherModal` moved here from `client-context`

**Session 3 — Client Context UX overhaul**
- Added `clientColors: Record<string, string>` to `ClientContextSettings`
- `renderStatusBar()` now uses `createEl` with a colored dot (`.dev-cc-dot`) instead of `setText`
- Added ribbon icon (`users`) — highlighted when a client is active
- `SetClientColorModal` — color picker modal for assigning a hex color per client
- New command: `[DEV] Client context: Set color for active client`
- `ClientSwitcherModal.renderSuggestion()` — shows colored dot per client in the suggest list

**Session 4 — Note Creator overhaul**
- `NoteCreatorModal` migrated to `DevModal` — consistent header, client banner, step indicator
- `onSwitchClient()` overridden — opens `ClientSwitcherModal` inline from the banner Switch button; re-renders step 3 body after switch so fields update
- Step 3: orange client mismatch warning when active client ≠ `client` field value
- `vault.on("create")` intercept — shows an 8-second Notice with "Open Note Creator" button when a default new note is created; `creatingOurOwnNote` flag suppresses false positives
- New command: `[DEV] Note creator: Apply template to current note`
- `ApplyTemplateModal` — type picker that merges template frontmatter fields into an existing note via `insertFrontmatterFields()` without touching content

**Session 5 — Dev Panel side panel**
- `modules/dev-panel/index.ts` — new `ItemView` registered as `"dev-suite-panel"`
- Ribbon icon and command to open the panel
- Sections: Active client, Note Creator, Palette Extractor, Color Preview, Module status grid
- Colored client dot, Switch pill-button, Set color, Create/Update/Open dashboard buttons
- Editor-dependent buttons auto-disabled when no editor is active
- Reactive: re-renders on `active-leaf-change` and when modules call `plugin.refreshPanel?.()`
- `createOrOpenDashboard()` — creates folder + dashboard file with template if needed; button label changes to "Update dashboard" once file exists; "Open dashboard" ghost button appears alongside

**Session 7 — Dashboard auto-generation**
- `generateDashboardBlock()` — standalone function in `dev-panel/index.ts`
- Scans client folder with `vault.getAllLoadedFiles()`, reads frontmatter from `metadataCache`
- Groups notes by `type` field; known order: meeting → project → brief → research → reference → quick → other
- Type-specific table columns: meeting gets Attendees, project gets Status + Deadline, research gets Topic, rest get Date only
- Notes sorted by `date` frontmatter descending within each group
- Overview stats row: total notes, last activity (max mtime), type count, generation timestamp
- `GENERATED_START` / `GENERATED_END` HTML comment markers bracket the generated block
- Update path: replaces only between markers — everything outside (manual notes, manual sections) is preserved
- Create path: embeds the generated block in the initial file; old dashboards without markers get it appended

**Session 6 — Intercept fix + frontmatter warning + toggles**
- Fixed B-4: startup reload flood
- Added `interceptNewNote: boolean` and `warnOnMissingFrontmatter: boolean` settings toggles
- Added `dismissedFormatWarnings: string[]` to persist per-file dismiss state
- Intercept notice and frontmatter warning now have a header row with title + X close button
- `workspace.on("file-open")` listener warns (once per file) when required frontmatter fields are missing; "Don't show again" saves the file path to `dismissedFormatWarnings`
- Settings tab: two new toggles for intercept and frontmatter warning
- Dev Panel: "Open dashboard" ghost button alongside Create/Update when dashboard exists

---

## Open Questions / Next Steps

- **Settings tab** — `clientColors` is stored but there is no settings UI for viewing/resetting all client colors at once. Consider adding a "Manage client colors" section.
- **`color-mix()` fallback** — used in `dev-modal-client-banner` and `dev-nc-client-warning`. Supported in Electron 22+ (Obsidian 1.1+). If issues arise on older builds, replace with hardcoded `rgba()`.
- **Production split** — completed. Color Preview v1.1.0 and Brief v1.0.0 are now live. Future features should be prototyped here first, then ported.

---

## Splitting Modules into Individual Plugins

**Done:** Color Preview v1.1.0 (`stephanteig/obsidian-color-preview`) and Brief v1.0.0 (`stephanteig/obsidian-brief`) are the two production plugins split from dev-suite.

When a future module is ready to ship as its own plugin:
1. Copy the module folder to its own repo
2. Copy `modules/shared/dev-modal.ts` and `modules/shared/client-switcher.ts` if needed
3. Create a standalone `manifest.json` and `main.ts`
4. Remove all `[DEV]` prefixes from command names and UI labels
5. Remove DEV visual markers
6. Run the full pre-release checklist twice (ESLint zero errors, build clean, visual test)
7. Publish to Obsidian community plugin registry

The dev plugin is never "finished" — it always exists for testing new features.

---

## Skill: Brand Profile Generator

**Module 2 — this is a Claude Code skill, not an Obsidian UI plugin.**

### Entry Points

| Skill command       | What it does                                                       |
|---------------------|--------------------------------------------------------------------|
| `generate-profile`  | Generate a new brand profile note from provided inputs             |
| `enrich-profile`    | Append missing fields to an existing brand profile note            |
| `generate-brief`    | Generate a client brief (shorter, deliverable-focused)             |
| `check-completeness`| Report which fields are missing from a brand profile               |
| `export-brief`      | Export a clean brief from the profile note (strip dev metadata)    |

### Accepted Inputs

The skill accepts any mix of:
- PDF files (brand guidelines, style guides)
- Images (JPEG/PNG — logos, mood boards, design samples)
- Plain text (raw notes, brief descriptions)
- Existing vault note paths (read with the `Read` tool)
- URLs (fetch with `WebFetch`)

### Output Format

- Outputs Color Preview syntax using `color` and `palette` fenced code blocks
- Writes output to `ClientName/Profil/` by convention
- One note per client — append to existing profile rather than overwriting

### Brand Profile Note Template

```markdown
---
title: Brand Profile — ClientName
tags: [brand-profile, client/clientname]
date: YYYY-MM-DD
client: ClientName
type: brand-profile
---

# ClientName — Brand Profile

## Identity
- **Full name:** 
- **Tagline:** 
- **Industry:** 
- **Founded:** 
- **HQ:** 

## Tone & Voice
- **Primary tone:** 
- **Secondary tone:** 
- **Avoid:** 

## Visual Identity

### Primary Palette
\`\`\`palette
Primary: #RRGGBB
Secondary: #RRGGBB
Accent: #RRGGBB
Background: #RRGGBB
\`\`\`

### Logo Colors (exact)
\`\`\`color
name: Logo Primary
hex: #RRGGBB
rgb: R, G, B
cmyk: C, M, Y, K
pms: PMS XXXX
\`\`\`

## Typography
- **Primary font:** 
- **Secondary font:** 
- **Monospace:** 

## Completeness
- [ ] Identity complete
- [ ] Palette complete (exact values)
- [ ] Typography complete
- [ ] Tone & Voice complete
- [ ] Brief generated
```

### Skill: enrich-brand-colors

Also documented here: this is the batch-processing companion to Module 4 (Palette Extractor).

When run from Claude Code (not the Obsidian UI):
1. Accept a glob pattern or list of note paths
2. For each note: scan for all color values (hex, rgb, hsl)
3. Infer names from surrounding text
4. Generate or update `palette` blocks in each note
5. Write results back to vault using the `Edit` tool

---

## Vault Location

Dev plugin installed in:
```
/Users/Stephan/Library/Mobile Documents/iCloud~md~obsidian/Documents/Stephan MacbookPro/.obsidian/plugins/dev-suite/
```

Color Preview (production) installed in:
```
/Users/Stephan/Library/Mobile Documents/iCloud~md~obsidian/Documents/Stephan MacbookPro/.obsidian/plugins/color-preview/
```
