import { Plugin, PluginSettingTab, Setting } from "obsidian";
import {
    DEFAULT_DEV_SUITE_SETTINGS,
    DEFAULT_NOTE_CREATOR_SETTINGS,
    DEFAULT_CLIENT_CONTEXT_SETTINGS,
} from "./types";
import type { DevSuiteSettings } from "./types";
import { loadColorPreview } from "./modules/color-preview/index";
import type { ColorPreviewModule } from "./modules/color-preview/index";
import { loadClientContext } from "./modules/client-context/index";
import { loadPaletteExtractor } from "./modules/palette-extractor/index";
import { loadNoteCreator } from "./modules/note-creator/index";
import { DevPanelView, VIEW_TYPE_DEV_PANEL } from "./modules/dev-panel/index";

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default class DevSuitePlugin extends Plugin {
    settings: DevSuiteSettings;
    colorPreviewModule: ColorPreviewModule | null = null;
    refreshPanel?: () => void;

    async onload() {
        try {
            await this.loadSettings();
            console.log("[DEV] settings loaded");

            // Register the side panel view
            this.registerView(
                VIEW_TYPE_DEV_PANEL,
                (leaf) => new DevPanelView(leaf, this),
            );

            // Wire up refreshPanel so modules can trigger re-renders
            this.refreshPanel = () => {
                for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_DEV_PANEL)) {
                    if (leaf.view instanceof DevPanelView) leaf.view.refresh();
                }
            };

            // Ribbon icon to open the panel
            this.addRibbonIcon("layout-dashboard", "[DEV] Open Dev Suite panel", () => {
                void this.activatePanel();
            });

            // Command to open the panel
            this.addCommand({
                id: "dev-open-panel",
                name: "[DEV] Open Dev Suite panel",
                callback: () => { void this.activatePanel(); },
            });

            if (this.settings.modules.colorPreview) {
                this.colorPreviewModule = loadColorPreview(this);
                console.log("[DEV] color-preview loaded");
            }

            if (this.settings.modules.clientContext) {
                loadClientContext(this);
                console.log("[DEV] client-context loaded");
            }

            if (this.settings.modules.paletteExtractor) {
                loadPaletteExtractor(this, this.colorPreviewModule ?? undefined);
                console.log("[DEV] palette-extractor loaded");
            }

            if (this.settings.modules.noteCreator) {
                loadNoteCreator(this);
                console.log("[DEV] note-creator loaded");
            }

            this.addSettingTab(new DevSuiteSettingTab(this.app, this));
            console.log("[DEV] Dev Suite fully loaded");
        } catch (err) {
            console.error("[DEV] Failed to load Dev Suite:", err);
            throw err;
        }
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_DEV_PANEL);
    }

    async activatePanel(): Promise<void> {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_DEV_PANEL)[0];
        if (!leaf) {
            leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(false);
            await leaf.setViewState({ type: VIEW_TYPE_DEV_PANEL, active: true });
        }
        workspace.revealLeaf(leaf);
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_DEV_SUITE_SETTINGS,
            await this.loadData()
        ) as DevSuiteSettings;

        this.settings.modules = Object.assign(
            {},
            DEFAULT_DEV_SUITE_SETTINGS.modules,
            this.settings.modules
        );
        this.settings.colorPreview = Object.assign(
            {},
            DEFAULT_DEV_SUITE_SETTINGS.colorPreview,
            this.settings.colorPreview
        );
        this.settings.noteCreator = Object.assign(
            {},
            DEFAULT_NOTE_CREATOR_SETTINGS,
            this.settings.noteCreator
        );
        this.settings.clientContext = Object.assign(
            {},
            DEFAULT_CLIENT_CONTEXT_SETTINGS,
            this.settings.clientContext
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

class DevSuiteSettingTab extends PluginSettingTab {
    plugin: DevSuitePlugin;

    constructor(app: import("obsidian").App, plugin: DevSuitePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // ── Module toggles ─────────────────────────────────────────────────
        new Setting(containerEl).setHeading().setName("Dev tools — module toggles");
        new Setting(containerEl)
            .setDesc("Toggle modules on/off independently. Changes take effect after reloading the plugin (Ctrl/Cmd+R in Obsidian).");

        const moduleToggles: { key: keyof DevSuiteSettings["modules"]; label: string }[] = [
            { key: "colorPreview",    label: "Color preview"           },
            { key: "clientContext",   label: "Client context switcher" },
            { key: "paletteExtractor", label: "Palette extractor"      },
            { key: "noteCreator",     label: "Smart note creator"      },
        ];

        for (const { key, label } of moduleToggles) {
            new Setting(containerEl)
                .setName(label)
                .addToggle((t) => t
                    .setValue(this.plugin.settings.modules[key])
                    .onChange(async (v) => {
                        this.plugin.settings.modules[key] = v;
                        await this.plugin.saveSettings();
                    }));
        }

        // ── Color Preview ──────────────────────────────────────────────────
        if (this.plugin.colorPreviewModule) {
            this.plugin.colorPreviewModule.renderSettings(containerEl);
        }

        // ── Client Context ─────────────────────────────────────────────────
        new Setting(containerEl).setHeading().setName("Client context");

        new Setting(containerEl)
            .setName("Clients folder")
            .setDesc("Root folder where client subfolders are created.")
            .addText((t) => t
                .setPlaceholder("Clients")
                .setValue(this.plugin.settings.clientContext.clientsFolder)
                .onChange(async (v) => {
                    this.plugin.settings.clientContext.clientsFolder = v.trim() || "Clients";
                    await this.plugin.saveSettings();
                }));

        // ── Note Creator ───────────────────────────────────────────────────
        new Setting(containerEl).setHeading().setName("Note creator");

        new Setting(containerEl)
            .setName("Default folder")
            .setDesc("Where new notes are created when no client is active. Leave blank for vault root.")
            .addText((t) => t
                .setPlaceholder("Notes")
                .setValue(this.plugin.settings.noteCreator.defaultFolder)
                .onChange(async (v) => {
                    this.plugin.settings.noteCreator.defaultFolder = v.trim();
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Open after create")
            .setDesc("Open the new note immediately after creation.")
            .addToggle((t) => t
                .setValue(this.plugin.settings.noteCreator.openAfterCreate)
                .onChange(async (v) => {
                    this.plugin.settings.noteCreator.openAfterCreate = v;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Intercept new note")
            .setDesc("Show a prompt to use Note Creator when a note is created outside it.")
            .addToggle((t) => t
                .setValue(this.plugin.settings.noteCreator.interceptNewNote)
                .onChange(async (v) => {
                    this.plugin.settings.noteCreator.interceptNewNote = v;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Warn on missing frontmatter")
            .setDesc("Show a warning (once per file) when opening a note without required frontmatter.")
            .addToggle((t) => t
                .setValue(this.plugin.settings.noteCreator.warnOnMissingFrontmatter)
                .onChange(async (v) => {
                    this.plugin.settings.noteCreator.warnOnMissingFrontmatter = v;
                    await this.plugin.saveSettings();
                }));

    }
}
