// ─── Dev Suite Panel — ItemView ───────────────────────────────────────────────

import { ItemView, Notice, TFile, WorkspaceLeaf, moment, setIcon } from "obsidian";
import type { DevPlugin } from "../../types";

export const VIEW_TYPE_DEV_PANEL = "dev-suite-panel";

export class DevPanelView extends ItemView {
    constructor(leaf: WorkspaceLeaf, private readonly plugin: DevPlugin) {
        super(leaf);
    }

    getViewType(): string    { return VIEW_TYPE_DEV_PANEL; }
    getDisplayText(): string { return "Dev Suite"; }
    getIcon(): string        { return "layout-dashboard"; }

    async onOpen(): Promise<void> {
        this.renderPanel();
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", () => this.renderPanel())
        );
    }

    async onClose(): Promise<void> {
        this.contentEl.empty();
    }

    refresh(): void {
        this.renderPanel();
    }

    // ── Core render ───────────────────────────────────────────────────────────

    private renderPanel(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("dev-panel");

        this.renderHeader(contentEl);

        if (this.plugin.settings.modules.clientContext) {
            this.renderClientSection(contentEl);
        }
        if (this.plugin.settings.modules.noteCreator) {
            this.renderNoteCreatorSection(contentEl);
        }
        if (this.plugin.settings.modules.paletteExtractor) {
            this.renderPaletteSection(contentEl);
        }
        if (this.plugin.settings.modules.colorPreview) {
            this.renderColorSection(contentEl);
        }

        this.renderModuleStatus(contentEl);
    }

    // ── Sections ──────────────────────────────────────────────────────────────

    private renderHeader(root: HTMLElement): void {
        const header = root.createDiv("dev-panel-header");

        const left = header.createDiv("dev-panel-header-left");
        const logoIcon = left.createSpan("dev-panel-logo-icon");
        setIcon(logoIcon, "boxes");
        left.createEl("span", { text: "Dev Suite", cls: "dev-panel-title" });
        left.createEl("span", { text: "[DEV]", cls: "dev-panel-title-badge" });

        const gearBtn = header.createDiv({ cls: "dev-panel-icon-btn" });
        gearBtn.setAttribute("aria-label", "Settings");
        setIcon(gearBtn, "settings");
        gearBtn.addEventListener("click", () => {
            (this.app as any).setting?.open();
            (this.app as any).setting?.openTabById("dev-suite");
        });
    }

    private renderClientSection(root: HTMLElement): void {
        const { activeClient, clientColors, clientsFolder } = this.plugin.settings.clientContext;
        const color = activeClient ? (clientColors?.[activeClient] ?? null) : null;
        const body = this.section(root, "Active client", "users");

        // Status pill
        const pill = body.createDiv("dev-panel-client-pill");
        const dot = pill.createSpan("dev-cc-dot dev-panel-client-dot");
        if (color) dot.style.setProperty("background", color);
        else if (!activeClient) dot.addClass("is-private");

        pill.createEl("span", {
            text: activeClient || "Private",
            cls: "dev-panel-client-name" + (activeClient ? "" : " is-private"),
        });

        const switchBtn = pill.createEl("button", { text: "Switch", cls: "dev-panel-pill-btn" });
        switchBtn.addEventListener("click", () => this.cmd("dev-cc-switch-space"));

        if (activeClient) {
            // Check if dashboard file exists to determine button label
            const dashPath = `${clientsFolder}/${activeClient}/${activeClient}.md`;
            const dashExists = this.app.vault.getAbstractFileByPath(dashPath) instanceof TFile;

            const row = body.createDiv("dev-panel-row");
            this.secondaryBtn(row, "palette", "Set color", () => this.cmd("dev-cc-set-client-color"));

            // Smart dashboard button: Create or Update
            const dashIcon  = dashExists ? "square-pen"  : "file-plus-2";
            const dashLabel = dashExists ? "Update dashboard" : "Create dashboard";
            this.secondaryBtn(row, dashIcon, dashLabel, () => {
                void this.createOrOpenDashboard(activeClient, clientsFolder, dashPath, dashExists);
            });

            if (dashExists) {
                this.ghostBtn(body, "layout-dashboard", "Open dashboard", () => this.cmd("dev-cc-open-dashboard"));
            }
        }

        this.ghostBtn(body, "user-plus", "Create new client", () => this.cmd("dev-cc-create-client"));
    }

    private renderNoteCreatorSection(root: HTMLElement): void {
        const body = this.section(root, "Note Creator", "file-plus");
        const hasEditor = this.hasActiveEditor();

        this.primaryBtn(body, "file-plus", "New note", () => this.cmd("dev-nc-new-note"));

        const row = body.createDiv("dev-panel-row");
        this.secondaryBtn(row, "wrench",     "Repair frontmatter", () => this.cmd("dev-nc-repair-frontmatter"));
        this.secondaryBtn(row, "file-input", "Apply template",      () => this.cmd("dev-nc-apply-template"), !hasEditor);
    }

    private renderPaletteSection(root: HTMLElement): void {
        const body = this.section(root, "Palette Extractor", "pipette");
        const hasEditor = this.hasActiveEditor();

        this.primaryBtn(
            body, "pipette", "Extract palette from note",
            () => this.cmd("dev-pe-extract-palette"),
            !hasEditor,
        );
    }

    private renderColorSection(root: HTMLElement): void {
        const body = this.section(root, "Color Preview", "palette");
        const hasEditor = this.hasActiveEditor();

        this.primaryBtn(
            body, "pipette", "Insert color (picker)",
            () => this.cmd("dev-cp-insert-color-picker"),
            !hasEditor,
        );

        const row = body.createDiv("dev-panel-row");
        this.secondaryBtn(row, "hash",        "Hex",         () => this.cmd("dev-cp-insert-color-hex"),       !hasEditor);
        this.secondaryBtn(row, "clipboard",   "Clipboard",   () => this.cmd("dev-cp-insert-color-clipboard"), !hasEditor);
        this.secondaryBtn(row, "square-plus", "Empty block", () => this.cmd("dev-cp-insert-color-template"),  !hasEditor);
    }

    private renderModuleStatus(root: HTMLElement): void {
        const body = this.section(root, "Modules", "box");
        const grid = body.createDiv("dev-panel-module-grid");

        const modules: { key: keyof typeof this.plugin.settings.modules; label: string; icon: string }[] = [
            { key: "colorPreview",     label: "Color Preview",     icon: "palette"   },
            { key: "clientContext",    label: "Client Context",    icon: "users"     },
            { key: "paletteExtractor", label: "Palette Extractor", icon: "pipette"   },
            { key: "noteCreator",      label: "Note Creator",      icon: "file-plus" },
        ];

        for (const { key, label, icon } of modules) {
            const row  = grid.createDiv("dev-panel-module-row");
            const left = row.createDiv("dev-panel-module-left");
            const iconEl = left.createSpan("dev-panel-module-icon");
            setIcon(iconEl, icon);
            left.createEl("span", { text: label, cls: "dev-panel-module-label" });
            const badge = row.createEl("span", { cls: "dev-panel-module-badge" });
            const isActive = this.plugin.settings.modules[key];
            badge.addClass(isActive ? "is-active" : "is-inactive");
            badge.setText(isActive ? "Active" : "Off");
        }
    }

    // ── Dashboard create / open ───────────────────────────────────────────────

    private async createOrOpenDashboard(
        clientName: string,
        clientsFolder: string,
        dashPath: string,
        exists: boolean,
    ): Promise<void> {
        let file = this.app.vault.getAbstractFileByPath(dashPath);

        if (!exists || !(file instanceof TFile)) {
            // Ensure parent folders exist
            if (!this.app.vault.getAbstractFileByPath(clientsFolder)) {
                await this.app.vault.createFolder(clientsFolder);
            }
            const clientFolder = `${clientsFolder}/${clientName}`;
            if (!this.app.vault.getAbstractFileByPath(clientFolder)) {
                await this.app.vault.createFolder(clientFolder);
            }

            const today = moment().format("YYYY-MM-DD");
            const slug  = clientName.toLowerCase().replace(/\s+/g, "-");
            const content = [
                "---",
                `title: "${clientName}"`,
                `tags: ["client/${slug}"]`,
                `date: ${today}`,
                "type: client",
                "---",
                "",
                `# ${clientName}`,
                "",
                "## Overview",
                "",
                "## Notes",
                "",
                "## Tasks",
                "",
            ].join("\n");

            file = await this.app.vault.create(dashPath, content);
            new Notice(`[DEV] Dashboard created for "${clientName}".`);
            this.renderPanel(); // refresh so button updates to "Update dashboard"
        }

        if (file instanceof TFile) {
            await this.app.workspace.getLeaf(false).openFile(file);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private section(root: HTMLElement, title: string, icon: string): HTMLElement {
        const wrap   = root.createDiv("dev-panel-section");
        const hdr    = wrap.createDiv("dev-panel-section-hdr");
        const iconEl = hdr.createSpan("dev-panel-section-icon");
        setIcon(iconEl, icon);
        hdr.createEl("span", { text: title, cls: "dev-panel-section-title" });
        return wrap.createDiv("dev-panel-section-body");
    }

    private primaryBtn(
        parent: HTMLElement,
        icon: string,
        label: string,
        onClick: () => void,
        disabled = false,
    ): HTMLElement {
        const btn = parent.createEl("button", { cls: "dev-panel-btn-primary" });
        if (disabled) {
            btn.addClass("is-disabled");
            btn.disabled = true;
            btn.setAttribute("aria-label", `${label} — requires active editor`);
        }
        const iconEl = btn.createSpan("dev-panel-btn-icon");
        setIcon(iconEl, icon);
        btn.createEl("span", { text: label });
        if (!disabled) btn.addEventListener("click", onClick);
        return btn;
    }

    private secondaryBtn(
        parent: HTMLElement,
        icon: string,
        label: string,
        onClick: () => void,
        disabled = false,
    ): HTMLElement {
        const btn = parent.createEl("button", { cls: "dev-panel-btn-secondary" });
        if (disabled) {
            btn.addClass("is-disabled");
            btn.disabled = true;
            btn.setAttribute("aria-label", `${label} — requires active editor`);
        }
        const iconEl = btn.createSpan("dev-panel-btn-icon");
        setIcon(iconEl, icon);
        btn.createEl("span", { text: label });
        if (!disabled) btn.addEventListener("click", onClick);
        return btn;
    }

    private ghostBtn(
        parent: HTMLElement,
        icon: string,
        label: string,
        onClick: () => void,
    ): HTMLElement {
        const btn    = parent.createEl("button", { cls: "dev-panel-btn-ghost" });
        const iconEl = btn.createSpan("dev-panel-btn-icon");
        setIcon(iconEl, icon);
        btn.createEl("span", { text: label });
        btn.addEventListener("click", onClick);
        return btn;
    }

    private cmd(id: string): void {
        (this.app as any).commands?.executeCommandById(`dev-suite:${id}`);
    }

    private hasActiveEditor(): boolean {
        return !!this.app.workspace.activeEditor?.editor;
    }
}
