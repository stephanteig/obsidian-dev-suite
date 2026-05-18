// ─── Client Context Switcher — Module 1 ──────────────────────────────────────

import {
    App,
    Modal,
    Notice,
    Setting,
    TFile,
    moment,
} from "obsidian";
import type { DevPlugin } from "../../types";
import { ClientSwitcherModal } from "../shared/client-switcher";

// ── Module loader ─────────────────────────────────────────────────────────────

export function loadClientContext(plugin: DevPlugin): void {

    // ── Status bar ────────────────────────────────────────────────────────────
    const statusBar = plugin.addStatusBarItem();
    statusBar.addClass("dev-cc-status");
    plugin.registerDomEvent(statusBar, "click", () => openSwitcher());

    // ── Ribbon icon ───────────────────────────────────────────────────────────
    const ribbon = plugin.addRibbonIcon("users", "[DEV] Client context", () => openSwitcher());
    ribbon.addClass("dev-cc-ribbon");

    // Wait for workspace layout before touching the DOM
    plugin.app.workspace.onLayoutReady(() => {
        renderStatusBar(statusBar, plugin);
        updateRibbon(ribbon, plugin);
    });

    // ── Shared update helper ──────────────────────────────────────────────────
    function syncUI(): void {
        renderStatusBar(statusBar, plugin);
        updateRibbon(ribbon, plugin);
        plugin.refreshPanel?.();
    }

    function openSwitcher(): void {
        new ClientSwitcherModal(plugin.app, plugin, async (client) => {
            plugin.settings.clientContext.activeClient = client;
            await plugin.saveSettings();
            syncUI();
            new Notice(`[DEV] Active space: ${client || "Private"}`);
        }).open();
    }

    // ── Commands ──────────────────────────────────────────────────────────────
    plugin.addCommand({
        id: "dev-cc-switch-space",
        name: "[DEV] Client context: Switch space",
        callback: () => openSwitcher(),
    });

    plugin.addCommand({
        id: "dev-cc-open-dashboard",
        name: "[DEV] Client context: Open client dashboard",
        callback: () => { void openDashboard(plugin); },
    });

    plugin.addCommand({
        id: "dev-cc-create-client",
        name: "[DEV] Client context: Create new client",
        callback: () => {
            new NewClientModal(plugin.app, plugin, () => syncUI()).open();
        },
    });

    plugin.addCommand({
        id: "dev-cc-set-client-color",
        name: "[DEV] Client context: Set color for active client",
        callback: () => {
            const { activeClient } = plugin.settings.clientContext;
            if (!activeClient) {
                new Notice("[DEV] Client context — no active client. Switch to a client space first.");
                return;
            }
            new SetClientColorModal(plugin.app, plugin, activeClient, () => syncUI()).open();
        },
    });
}

// ── Status bar renderer ───────────────────────────────────────────────────────
// Uses createEl so we can show a colored dot next to the client name.

function renderStatusBar(el: HTMLElement, plugin: DevPlugin): void {
    el.empty();
    const { activeClient, clientColors } = plugin.settings.clientContext;
    const color = activeClient ? (clientColors?.[activeClient] ?? null) : null;

    const dot = el.createSpan("dev-cc-dot");
    if (color) {
        dot.style.setProperty("background", color);
    } else if (!activeClient) {
        dot.addClass("is-private");
    }

    el.createSpan({ text: activeClient || "Private", cls: "dev-cc-label" });
}

// ── Ribbon updater ────────────────────────────────────────────────────────────

function updateRibbon(el: HTMLElement, plugin: DevPlugin): void {
    const { activeClient } = plugin.settings.clientContext;
    el.setAttr(
        "aria-label",
        activeClient ? `[DEV] Active space: ${activeClient}` : "[DEV] Active space: Private",
    );
    el.toggleClass("dev-cc-ribbon-active", !!activeClient);
}

// ── New Client Modal ──────────────────────────────────────────────────────────

class NewClientModal extends Modal {
    private clientName = "";

    constructor(
        app: App,
        private readonly plugin: DevPlugin,
        private readonly onCreated: () => void,
    ) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: "[DEV] Create new client" });

        new Setting(contentEl)
            .setName("Client name")
            .addText((t) => {
                t.setPlaceholder("Acme Corp")
                    .onChange((v) => { this.clientName = v; });
                t.inputEl.style.width = "100%";
                t.inputEl.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") void this.createClient();
                });
                setTimeout(() => t.inputEl.focus(), 30);
            });

        const footer = contentEl.createDiv("dev-nc-footer");
        const createBtn = footer.createEl("button", { text: "Create", cls: "mod-cta" });
        createBtn.addEventListener("click", () => { void this.createClient(); });
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private async createClient(): Promise<void> {
        const name = this.clientName.trim();
        if (!name) {
            new Notice("[DEV] Client context — client name is required.");
            return;
        }

        const { clientsFolder } = this.plugin.settings.clientContext;
        const clientPath = `${clientsFolder}/${name}`;

        if (this.app.vault.getAbstractFileByPath(clientPath)) {
            new Notice(`[DEV] Client "${name}" already exists.`);
            return;
        }

        try {
            if (!this.app.vault.getAbstractFileByPath(clientsFolder)) {
                await this.app.vault.createFolder(clientsFolder);
            }
            await this.app.vault.createFolder(clientPath);

            const today = moment().format("YYYY-MM-DD");
            const slug = name.toLowerCase().replace(/\s+/g, "-");
            const indexContent = [
                "---",
                `title: "${name}"`,
                `tags: ["client/${slug}"]`,
                `date: ${today}`,
                "type: client",
                "---",
                "",
                `# ${name}`,
                "",
                "## Overview",
                "",
                "## Notes",
                "",
                "## Tasks",
                "",
            ].join("\n");

            const indexFile = await this.app.vault.create(
                `${clientPath}/${name}.md`,
                indexContent,
            );

            this.plugin.settings.clientContext.activeClient = name;
            await this.plugin.saveSettings();

            this.close();
            this.onCreated();
            new Notice(`[DEV] Client "${name}" created and set as active space.`);

            await this.app.workspace.getLeaf(false).openFile(indexFile);
        } catch (err) {
            console.error("[DEV] Create client error:", err);
            new Notice(`[DEV] Failed to create client: ${String(err)}`);
        }
    }
}

// ── Set Client Color Modal ────────────────────────────────────────────────────

class SetClientColorModal extends Modal {
    private color: string;

    constructor(
        app: App,
        private readonly plugin: DevPlugin,
        private readonly clientName: string,
        private readonly onSaved: () => void,
    ) {
        super(app);
        this.color = plugin.settings.clientContext.clientColors?.[clientName] ?? "#4A90D9";
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: `[DEV] Color for "${this.clientName}"` });

        new Setting(contentEl)
            .setName("Client color")
            .setDesc("Used as the accent color in the status bar and modal banners.")
            .addColorPicker((cp) =>
                cp.setValue(this.color)
                    .onChange((v) => { this.color = v; })
            );

        const footer = contentEl.createDiv("dev-nc-footer");

        const cancel = footer.createEl("button", { text: "Cancel" });
        cancel.addEventListener("click", () => this.close());

        const save = footer.createEl("button", { text: "Save", cls: "mod-cta" });
        save.addEventListener("click", () => { void this.save(); });
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private async save(): Promise<void> {
        if (!this.plugin.settings.clientContext.clientColors) {
            this.plugin.settings.clientContext.clientColors = {};
        }
        this.plugin.settings.clientContext.clientColors[this.clientName] = this.color;
        await this.plugin.saveSettings();
        this.close();
        this.onSaved();
        new Notice(`[DEV] Color saved for "${this.clientName}".`);
    }
}

// ── Open client dashboard ─────────────────────────────────────────────────────

async function openDashboard(plugin: DevPlugin): Promise<void> {
    const { activeClient, clientsFolder } = plugin.settings.clientContext;

    if (!activeClient) {
        new Notice("[DEV] Client context — no active client. Switch to a client space first.");
        return;
    }

    const indexPath = `${clientsFolder}/${activeClient}/${activeClient}.md`;
    const file = plugin.app.vault.getAbstractFileByPath(indexPath);

    if (file instanceof TFile) {
        await plugin.app.workspace.getLeaf(false).openFile(file);
    } else {
        new Notice(`[DEV] No dashboard found for "${activeClient}" at ${indexPath}`);
    }
}
