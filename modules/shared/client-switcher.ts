// ─── ClientSwitcherModal — shared between client-context and note-creator ─────
//
// Extracted here to avoid a circular import between the two modules.
// Both modules import this class from modules/shared/client-switcher.

import { App, FuzzySuggestModal, FuzzyMatch, TFolder } from "obsidian";
import type { DevPlugin } from "../../types";

export class ClientSwitcherModal extends FuzzySuggestModal<string> {
    constructor(
        app: App,
        private readonly plugin: DevPlugin,
        private readonly onSelect: (client: string) => Promise<void>,
    ) {
        super(app);
        this.setPlaceholder("Switch to a client space…");
    }

    getItems(): string[] {
        const { clientsFolder } = this.plugin.settings.clientContext;
        const clients = this.plugin.app.vault
            .getAllLoadedFiles()
            .filter((f): f is TFolder =>
                f instanceof TFolder && f.parent?.path === clientsFolder
            )
            .map((f) => f.name)
            .sort();
        return ["Private", ...clients];
    }

    getItemText(item: string): string { return item; }

    renderSuggestion(value: FuzzyMatch<string>, el: HTMLElement): void {
        const item = value.item;
        const row = el.createDiv("dev-cc-suggest-row");

        const dot = row.createSpan("dev-cc-dot");
        if (item === "Private") {
            dot.addClass("is-private");
        } else {
            const color = this.plugin.settings.clientContext.clientColors?.[item];
            if (color) dot.style.setProperty("background", color);
        }

        row.createSpan({ text: item, cls: "dev-cc-suggest-label" });
    }

    onChooseItem(item: string): void {
        void this.onSelect(item === "Private" ? "" : item);
    }
}
