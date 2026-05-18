// ─── Dev Suite Panel — ItemView ───────────────────────────────────────────────

import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type { DevPlugin } from "../../types";

export const VIEW_TYPE_DEV_PANEL = "dev-suite-panel";

export class DevPanelView extends ItemView {
    constructor(leaf: WorkspaceLeaf, private readonly plugin: DevPlugin) {
        super(leaf);
    }

    getViewType(): string  { return VIEW_TYPE_DEV_PANEL; }
    getDisplayText(): string { return "Dev Suite"; }
    getIcon(): string { return "layout-dashboard"; }

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
        gearBtn.setAttribute("aria-label", "Innstillinger");
        setIcon(gearBtn, "settings");
        gearBtn.addEventListener("click", () => {
            (this.app as any).setting?.open();
            (this.app as any).setting?.openTabById("dev-suite");
        });
    }

    private renderClientSection(root: HTMLElement): void {
        const { activeClient, clientColors } = this.plugin.settings.clientContext;
        const color = activeClient ? (clientColors?.[activeClient] ?? null) : null;
        const body = this.section(root, "Aktiv klient", "users");

        // Status pill
        const pill = body.createDiv("dev-panel-client-pill");
        const dot = pill.createSpan("dev-cc-dot dev-panel-client-dot");
        if (color) dot.style.setProperty("background", color);
        else if (!activeClient) dot.addClass("is-private");

        pill.createEl("span", {
            text: activeClient || "Private",
            cls: "dev-panel-client-name" + (activeClient ? "" : " is-private"),
        });

        const switchBtn = pill.createEl("button", { text: "Bytt", cls: "dev-panel-pill-btn" });
        switchBtn.addEventListener("click", () => this.cmd("dev-cc-switch-space"));

        // Secondary row — only when a client is active
        if (activeClient) {
            const row = body.createDiv("dev-panel-row");
            this.secondaryBtn(row, "palette",           "Sett farge",  () => this.cmd("dev-cc-set-client-color"));
            this.secondaryBtn(row, "layout-dashboard",  "Dashboard",   () => this.cmd("dev-cc-open-dashboard"));
        }

        this.ghostBtn(body, "user-plus", "Opprett ny klient", () => this.cmd("dev-cc-create-client"));
    }

    private renderNoteCreatorSection(root: HTMLElement): void {
        const body = this.section(root, "Note Creator", "file-plus");
        const hasEditor = this.hasActiveEditor();

        this.primaryBtn(body, "file-plus", "Ny note", () => this.cmd("dev-nc-new-note"));

        const row = body.createDiv("dev-panel-row");
        this.secondaryBtn(row, "wrench",     "Reparer frontmatter", () => this.cmd("dev-nc-repair-frontmatter"));
        this.secondaryBtn(row, "file-input", "Bruk mal",             () => this.cmd("dev-nc-apply-template"), !hasEditor);
    }

    private renderPaletteSection(root: HTMLElement): void {
        const body = this.section(root, "Palette Extractor", "pipette");
        const hasEditor = this.hasActiveEditor();

        this.primaryBtn(
            body, "pipette", "Ekstraher palette fra note",
            () => this.cmd("dev-pe-extract-palette"),
            !hasEditor,
        );
    }

    private renderColorSection(root: HTMLElement): void {
        const body = this.section(root, "Color Preview", "palette");
        const hasEditor = this.hasActiveEditor();

        this.primaryBtn(
            body, "pipette", "Sett inn farge (velger)",
            () => this.cmd("dev-cp-insert-color-picker"),
            !hasEditor,
        );

        const row = body.createDiv("dev-panel-row");
        this.secondaryBtn(row, "hash",         "Hex",       () => this.cmd("dev-cp-insert-color-hex"),       !hasEditor);
        this.secondaryBtn(row, "clipboard",    "Utklipp",   () => this.cmd("dev-cp-insert-color-clipboard"), !hasEditor);
        this.secondaryBtn(row, "square-plus",  "Tom blokk", () => this.cmd("dev-cp-insert-color-template"),  !hasEditor);
    }

    private renderModuleStatus(root: HTMLElement): void {
        const body = this.section(root, "Moduler", "box");
        const grid = body.createDiv("dev-panel-module-grid");

        const modules: { key: keyof typeof this.plugin.settings.modules; label: string; icon: string }[] = [
            { key: "colorPreview",     label: "Color Preview",     icon: "palette"   },
            { key: "clientContext",    label: "Client Context",    icon: "users"     },
            { key: "paletteExtractor", label: "Palette Extractor", icon: "pipette"   },
            { key: "noteCreator",      label: "Note Creator",      icon: "file-plus" },
        ];

        for (const { key, label, icon } of modules) {
            const row = grid.createDiv("dev-panel-module-row");
            const left = row.createDiv("dev-panel-module-left");
            const iconEl = left.createSpan("dev-panel-module-icon");
            setIcon(iconEl, icon);
            left.createEl("span", { text: label, cls: "dev-panel-module-label" });
            const badge = row.createEl("span", { cls: "dev-panel-module-badge" });
            const isActive = this.plugin.settings.modules[key];
            badge.addClass(isActive ? "is-active" : "is-inactive");
            badge.setText(isActive ? "Aktiv" : "Av");
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private section(root: HTMLElement, title: string, icon: string): HTMLElement {
        const wrap = root.createDiv("dev-panel-section");
        const hdr  = wrap.createDiv("dev-panel-section-hdr");
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
            btn.setAttribute("aria-label", `${label} — krever aktiv editor`);
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
            btn.setAttribute("aria-label", `${label} — krever aktiv editor`);
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
        const btn = parent.createEl("button", { cls: "dev-panel-btn-ghost" });
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
