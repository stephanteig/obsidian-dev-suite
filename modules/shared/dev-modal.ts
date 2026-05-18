// ─── DevModal — base class for all Dev Suite modals ──────────────────────────
//
// Provides a consistent layout:
//   [Header: icon + title]
//   [Client banner: active space + Switch button]  ← hidden when Private
//   [Step indicator]                               ← hidden when getStepCount() returns undefined
//   [Body]
//   [Footer]
//
// Subclasses implement:
//   getModalTitle()   → string
//   getModalIcon()    → Lucide icon name
//   getStepCount()    → number | undefined  (default: undefined = no indicator)
//   getCurrentStep()  → number              (default: 1)
//   renderBody()      → fill this.bodyEl
//   renderFooter()    → fill this.footerEl
//   onSwitchClient()  → called when banner Switch button is clicked (default: no-op)

import { App, Modal, setIcon } from "obsidian";
import type { DevPlugin } from "../../types";

export abstract class DevModal extends Modal {
    protected headerEl!: HTMLElement;
    protected bannerEl!: HTMLElement;
    protected stepIndicatorEl!: HTMLElement;
    protected bodyEl!: HTMLElement;
    protected footerEl!: HTMLElement;

    constructor(
        app: App,
        protected readonly plugin: DevPlugin,
    ) {
        super(app);
    }

    // ── Subclass API ──────────────────────────────────────────────────────────

    abstract getModalTitle(): string;
    abstract getModalIcon(): string;

    getStepCount(): number | undefined { return undefined; }
    getCurrentStep(): number { return 1; }

    abstract renderBody(): void;
    abstract renderFooter(): void;

    /** Override to handle the "Switch" button in the client banner. */
    protected onSwitchClient(): void { /* no-op by default */ }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    onOpen(): void {
        this.modalEl.addClass("dev-modal");

        // Reset any padding Obsidian sets on .modal-content
        const contentEl = this.contentEl;
        contentEl.style.setProperty("padding", "0");
        contentEl.style.setProperty("display", "flex");
        contentEl.style.setProperty("flex-direction", "column");

        this.headerEl        = contentEl.createDiv("dev-modal-header");
        this.bannerEl        = contentEl.createDiv("dev-modal-client-banner");
        this.stepIndicatorEl = contentEl.createDiv("dev-step-indicator");
        this.bodyEl          = contentEl.createDiv("dev-modal-body");
        this.footerEl        = contentEl.createDiv("dev-modal-footer");

        this.drawHeader();
        this.drawBanner();
        this.drawStepIndicator();
        this.renderBody();
        this.renderFooter();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    // ── Internal renderers ────────────────────────────────────────────────────

    private drawHeader(): void {
        const iconEl = this.headerEl.createDiv("dev-modal-header-icon");
        setIcon(iconEl, this.getModalIcon());
        this.headerEl.createEl("h2", {
            text: this.getModalTitle(),
            cls:  "dev-modal-title",
        });
    }

    private drawBanner(): void {
        const activeClient = this.plugin.settings.clientContext.activeClient;

        if (!activeClient) {
            this.bannerEl.addClass("is-hidden");
            return;
        }

        this.bannerEl.createSpan({
            text: `Space: ${activeClient}`,
            cls:  "dev-modal-client-banner__label",
        });

        const switchBtn = this.bannerEl.createEl("button", {
            text: "Switch",
            cls:  "dev-modal-client-banner__switch",
        });
        switchBtn.addEventListener("click", () => this.onSwitchClient());
    }

    private drawStepIndicator(): void {
        const count = this.getStepCount();
        if (!count) {
            this.stepIndicatorEl.style.setProperty("display", "none");
            return;
        }

        const current = this.getCurrentStep();
        for (let i = 1; i <= count; i++) {
            const step = this.stepIndicatorEl.createDiv("dev-step-indicator__step");
            if (i < current)      step.addClass("is-done");
            else if (i === current) step.addClass("is-active");
        }
    }

    // ── Helpers for subclasses ────────────────────────────────────────────────

    /**
     * Rebuild the client banner in-place.
     * Call after the active client changes (e.g. after a switch).
     */
    protected refreshBanner(): void {
        this.bannerEl.empty();
        this.bannerEl.removeClass("is-hidden");

        const activeClient = this.plugin.settings.clientContext.activeClient;
        if (!activeClient) {
            this.bannerEl.addClass("is-hidden");
            return;
        }

        this.bannerEl.createSpan({
            text: `Space: ${activeClient}`,
            cls:  "dev-modal-client-banner__label",
        });
        const switchBtn = this.bannerEl.createEl("button", {
            text: "Switch",
            cls:  "dev-modal-client-banner__switch",
        });
        switchBtn.addEventListener("click", () => this.onSwitchClient());
    }

    /**
     * Rebuild the step indicator in-place.
     * Call when moving between steps.
     */
    protected refreshStepIndicator(): void {
        this.stepIndicatorEl.empty();
        this.drawStepIndicator();
    }

    /**
     * Convenience: add a button to the footer.
     * Returns the created element so callers can store a reference if needed.
     */
    protected addFooterButton(
        text: string,
        isPrimary: boolean,
        onClick: () => void,
    ): HTMLButtonElement {
        const btn = this.footerEl.createEl("button", {
            text,
            cls: isPrimary ? "mod-cta" : undefined,
        });
        btn.addEventListener("click", onClick);
        return btn;
    }
}
