// ─── Shared types for obsidian-dev-suite ─────────────────────────────────────
// Import this in main.ts and in each module — never import from main.ts in modules.

import type { Plugin } from "obsidian";

// ── Color Preview settings ────────────────────────────────────────────────────

export interface ColorPreviewSettings {
    swatchHeight: number;
    maxWidth: number;
    showColorName: boolean;
}

export const DEFAULT_COLOR_PREVIEW_SETTINGS: ColorPreviewSettings = {
    swatchHeight: 80,
    maxWidth: 320,
    showColorName: true,
};

// ── Note Creator settings ─────────────────────────────────────────────────────

export interface NoteCreatorSettings {
    defaultFolder: string;
    openAfterCreate: boolean;
    interceptNewNote: boolean;
    warnOnMissingFrontmatter: boolean;
    dismissedFormatWarnings: string[];
}

export const DEFAULT_NOTE_CREATOR_SETTINGS: NoteCreatorSettings = {
    defaultFolder: "",
    openAfterCreate: true,
    interceptNewNote: true,
    warnOnMissingFrontmatter: true,
    dismissedFormatWarnings: [],
};

// ── Client Context settings ───────────────────────────────────────────────────

export interface ClientContextSettings {
    activeClient: string;               // empty string = Private / no active client
    clientsFolder: string;              // root folder where client folders live
    clientColors: Record<string, string>; // clientName → hex color, e.g. { "Acme": "#4A90D9" }
}

export const DEFAULT_CLIENT_CONTEXT_SETTINGS: ClientContextSettings = {
    activeClient: "",
    clientsFolder: "Clients",
    clientColors: {},
};

// ── Module toggle settings ────────────────────────────────────────────────────

export interface ModuleToggles {
    clientContext: boolean;
    paletteExtractor: boolean;
    noteCreator: boolean;
    colorPreview: boolean;
}

// ── Top-level plugin settings ─────────────────────────────────────────────────

export interface DevSuiteSettings {
    modules: ModuleToggles;
    colorPreview: ColorPreviewSettings;
    noteCreator: NoteCreatorSettings;
    clientContext: ClientContextSettings;
}

export const DEFAULT_DEV_SUITE_SETTINGS: DevSuiteSettings = {
    modules: {
        clientContext: true,
        paletteExtractor: true,
        noteCreator: true,
        colorPreview: true,
    },
    colorPreview: { ...DEFAULT_COLOR_PREVIEW_SETTINGS },
    noteCreator: { ...DEFAULT_NOTE_CREATOR_SETTINGS },
    clientContext: { ...DEFAULT_CLIENT_CONTEXT_SETTINGS },
};

// ── Plugin interface that modules receive ─────────────────────────────────────
// Modules accept this type instead of importing DevSuitePlugin from main.ts
// to avoid circular dependencies.

export type DevPlugin = Plugin & {
    settings: DevSuiteSettings;
    saveSettings(): Promise<void>;
    refreshPanel?: () => void;
};
