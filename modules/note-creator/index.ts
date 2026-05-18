// ─── Smart Note Creator — Module 5 ───────────────────────────────────────────

import {
    App,
    Editor,
    MarkdownView,
    Notice,
    Setting,
    TFile,
    moment,
    setIcon,
} from "obsidian";
import type { DevPlugin } from "../../types";
import { DevModal } from "../shared/dev-modal";
import { ClientSwitcherModal } from "../shared/client-switcher";

// ── Note type definitions ─────────────────────────────────────────────────────

interface NoteTypeField {
    key: string;
    label: string;
    placeholder: string;
}

interface NoteType {
    id: string;
    label: string;
    icon: string;
    extraFields: NoteTypeField[];
}

const NOTE_TYPES: NoteType[] = [
    {
        id: "meeting", label: "Meeting", icon: "users",
        extraFields: [
            { key: "attendees", label: "Attendees", placeholder: "Name, Name, ..." },
            { key: "resources", label: "Resources", placeholder: "Note or link" },
        ],
    },
    {
        id: "project", label: "Project", icon: "folder-open",
        extraFields: [
            { key: "client",   label: "Client",   placeholder: "" },
            { key: "status",   label: "Status",   placeholder: "Active" },
            { key: "deadline", label: "Deadline", placeholder: "YYYY-MM-DD" },
        ],
    },
    {
        id: "brief", label: "Client brief", icon: "file-text",
        extraFields: [
            { key: "client", label: "Client", placeholder: "" },
        ],
    },
    {
        id: "research", label: "Research", icon: "search",
        extraFields: [
            { key: "source", label: "Source", placeholder: "URL or reference" },
            { key: "topic",  label: "Topic",  placeholder: "" },
        ],
    },
    {
        id: "quick", label: "Quick note", icon: "zap",
        extraFields: [],
    },
    {
        id: "reference", label: "Reference", icon: "link",
        extraFields: [
            { key: "url", label: "URL", placeholder: "https://" },
        ],
    },
];

// ── Flag to suppress intercept notice for notes we create ourselves ───────────
let creatingOurOwnNote = false;

// ── Module loader ─────────────────────────────────────────────────────────────

export function loadNoteCreator(plugin: DevPlugin): void {
    plugin.addCommand({
        id: "dev-nc-new-note",
        name: "[DEV] Note creator: New note (modal)",
        callback: () => {
            new NoteCreatorModal(plugin.app, plugin).open();
        },
    });

    plugin.addCommand({
        id: "dev-nc-repair-frontmatter",
        name: "[DEV] Note creator: Scan and repair frontmatter",
        callback: () => {
            void repairFrontmatter(plugin);
        },
    });

    plugin.addCommand({
        id: "dev-nc-apply-template",
        name: "[DEV] Note creator: Apply template to current note",
        editorCallback: (editor: Editor, ctx) => {
            const file = ctx.file;
            if (!file) {
                new Notice("[DEV] Note creator — no active file.");
                return;
            }
            new ApplyTemplateModal(plugin.app, plugin, file, editor).open();
        },
    });

    // Intercept Obsidian's default new-note action.
    // Shows a brief non-blocking notice with an "Open Note Creator" button.
    plugin.registerEvent(
        plugin.app.vault.on("create", (abstractFile) => {
            if (!(abstractFile instanceof TFile)) return;
            if (abstractFile.extension !== "md") return;
            if (creatingOurOwnNote) return; // we made it ourselves — don't intercept

            const notice = new Notice("", 8000);
            notice.messageEl.addClass("dev-nc-intercept-notice");

            notice.messageEl.createDiv({
                text: "New note created. Use Note Creator for structured notes?",
                cls: "dev-nc-intercept-text",
            });

            const btn = notice.messageEl.createEl("button", {
                text: "Open Note Creator",
                cls: "dev-nc-intercept-btn",
            });
            btn.addEventListener("click", () => {
                notice.hide();
                new NoteCreatorModal(plugin.app, plugin).open();
            });
        })
    );
}

// ── Note Creator Modal ────────────────────────────────────────────────────────
// Extends DevModal for consistent header / client banner / step indicator layout.

class NoteCreatorModal extends DevModal {
    private step = 1;
    private title = "";
    private selectedType: NoteType = NOTE_TYPES[4]; // Quick note default
    private tags = "";
    private extraValues: Record<string, string> = {};

    constructor(app: App, plugin: DevPlugin) {
        super(app, plugin);
        this.title = moment().format("YYYY-MM-DD") + " ";
    }

    // ── DevModal interface ────────────────────────────────────────────────────

    getModalTitle(): string { return "New note"; }
    getModalIcon(): string  { return "file-plus"; }
    getStepCount(): number  { return 3; }
    getCurrentStep(): number { return this.step; }

    renderBody(): void   { this.renderStepBody(); }
    renderFooter(): void { this.renderStepFooter(); }

    // When the banner "Switch" button is clicked, open the switcher in-place.
    protected onSwitchClient(): void {
        new ClientSwitcherModal(this.app, this.plugin, async (client) => {
            this.plugin.settings.clientContext.activeClient = client;
            await this.plugin.saveSettings();
            this.refreshBanner();
            // Re-render step 3 body so the client field and warning update
            if (this.step === 3) this.transition(3);
            new Notice(`[DEV] Active space: ${client || "Private"}`);
        }).open();
    }

    // ── Step transitions ──────────────────────────────────────────────────────

    private transition(nextStep: number): void {
        this.step = nextStep;
        this.bodyEl.empty();
        this.footerEl.empty();
        this.refreshStepIndicator();
        this.renderStepBody();
        this.renderStepFooter();
    }

    private renderStepBody(): void {
        if (this.step === 1) this.renderStep1Body();
        else if (this.step === 2) this.renderStep2Body();
        else this.renderStep3Body();
    }

    private renderStepFooter(): void {
        if (this.step === 1) this.renderStep1Footer();
        else if (this.step === 2) this.renderStep2Footer();
        else this.renderStep3Footer();
    }

    // ── Step 1: Title ─────────────────────────────────────────────────────────

    private renderStep1Body(): void {
        new Setting(this.bodyEl)
            .setName("Note title")
            .setDesc("Edit the date prefix or replace it entirely.")
            .addText((t) => {
                t.setValue(this.title).onChange((v) => { this.title = v; });
                t.inputEl.style.width = "100%";
                t.inputEl.addEventListener("keydown", (e) => {
                    if (e.key === "Enter" && this.title.trim()) this.goNext();
                });
                setTimeout(() => {
                    t.inputEl.focus();
                    t.inputEl.setSelectionRange(t.inputEl.value.length, t.inputEl.value.length);
                }, 30);
            });
    }

    private renderStep1Footer(): void {
        this.addFooterButton("Next →", true, () => this.goNext());
    }

    private goNext(): void {
        if (!this.title.trim()) {
            new Notice("[DEV] Note creator — title is required.");
            return;
        }
        this.transition(2);
    }

    // ── Step 2: Type picker ───────────────────────────────────────────────────

    private renderStep2Body(): void {
        const grid = this.bodyEl.createDiv("dev-nc-type-grid");

        for (const type of NOTE_TYPES) {
            const card = grid.createDiv("dev-nc-type-card");
            if (type.id === this.selectedType.id) card.addClass("is-selected");

            const iconEl = card.createDiv("dev-nc-type-icon");
            setIcon(iconEl, type.icon);
            card.createEl("span", { text: type.label, cls: "dev-nc-type-label" });

            card.addEventListener("click", () => {
                this.selectedType = type;
                this.extraValues = {};
                this.transition(3);
            });
        }
    }

    private renderStep2Footer(): void {
        this.addFooterButton("← Back", false, () => this.transition(1));
    }

    // ── Step 3: Details ───────────────────────────────────────────────────────

    private renderStep3Body(): void {
        const activeClient = this.plugin.settings.clientContext.activeClient;

        new Setting(this.bodyEl)
            .setName("Tags")
            .setDesc("Comma-separated.")
            .addText((t) => {
                t.setPlaceholder("tag1, tag2, ...")
                    .setValue(this.tags)
                    .onChange((v) => { this.tags = v; });
                t.inputEl.style.width = "100%";
            });

        for (const field of this.selectedType.extraFields) {
            const prefill = field.key === "client" && activeClient ? activeClient : "";
            const initialValue = this.extraValues[field.key] ?? prefill;
            // Seed extraValues so the mismatch warning can detect stale client values
            // after switching the active client via the banner on step 3.
            if (field.key === "client" && !(field.key in this.extraValues)) {
                this.extraValues[field.key] = initialValue;
            }
            new Setting(this.bodyEl)
                .setName(field.label)
                .addText((t) => {
                    t.setPlaceholder(field.placeholder)
                        .setValue(initialValue)
                        .onChange((v) => { this.extraValues[field.key] = v; });
                    t.inputEl.style.width = "100%";
                });
        }

        // Client mismatch warning: shown when the "client" field value differs from
        // the active space — only possible after switching via the banner on step 3.
        const clientField = this.extraValues["client"];

        if (activeClient && clientField !== undefined && clientField !== activeClient) {
            const warn = this.bodyEl.createDiv("dev-nc-client-warning");
            const iconWrap = warn.createSpan("dev-nc-warning-icon");
            setIcon(iconWrap, "alert-triangle");
            warn.createSpan({
                text: `Active space is "${activeClient}" but note will use client "${clientField}".`,
                cls: "dev-nc-warning-text",
            });
        }
    }

    private renderStep3Footer(): void {
        this.addFooterButton("← Back", false, () => this.transition(2));
        this.addFooterButton("Create note", true, () => { void this.createNote(); });
    }

    // ── Create file ───────────────────────────────────────────────────────────

    private async createNote(): Promise<void> {
        const title = this.title.trim();
        if (!title) {
            new Notice("[DEV] Note creator — title is required.");
            return;
        }

        const { activeClient, clientsFolder } = this.plugin.settings.clientContext;
        const defaultFolder = this.plugin.settings.noteCreator.defaultFolder;
        const folder = activeClient ? `${clientsFolder}/${activeClient}` : defaultFolder;
        const today = moment().format("YYYY-MM-DD");

        const tagList = [
            this.selectedType.id,
            ...this.tags.split(",").map((t) => t.trim()).filter(Boolean),
        ];

        const extraLines: string[] = [];
        for (const field of this.selectedType.extraFields) {
            const val = this.extraValues[field.key]?.trim() ?? "";
            if (val) extraLines.push(`${field.key}: "${val}"`);
        }
        if (this.selectedType.id === "brief") extraLines.push('type: brief');

        const frontmatter = [
            "---",
            `title: "${title}"`,
            `tags: [${tagList.map((t) => `"${t}"`).join(", ")}]`,
            `date: ${today}`,
            ...extraLines,
            "---",
            "",
            "",
        ].join("\n");

        const safeName = title.replace(/[\\/:*?"<>|]/g, "-");
        const base = folder ? `${folder}/${safeName}` : safeName;
        let path = `${base}.md`;
        let counter = 1;
        while (this.app.vault.getAbstractFileByPath(path)) {
            path = `${base} ${counter++}.md`;
        }

        try {
            await ensureFolder(this.app, folder);
            creatingOurOwnNote = true;
            const file = await this.app.vault.create(path, frontmatter);
            creatingOurOwnNote = false;
            this.close();

            if (this.plugin.settings.noteCreator.openAfterCreate) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
                const editor = this.app.workspace.activeEditor?.editor;
                if (editor) {
                    const line = frontmatter.split("\n").length - 1;
                    editor.setCursor({ line, ch: 0 });
                }
            }

            new Notice(`[DEV] Created: ${safeName}`);
        } catch (err) {
            creatingOurOwnNote = false;
            console.error("[DEV] Note creator error:", err);
            new Notice(`[DEV] Failed to create note: ${String(err)}`);
        }
    }
}

// ── Apply Template Modal ──────────────────────────────────────────────────────
// Lets the user pick a note type and merges the template's frontmatter fields
// into an existing note without overwriting its current content.

class ApplyTemplateModal extends DevModal {
    constructor(
        app: App,
        plugin: DevPlugin,
        private readonly file: TFile,
        private readonly editor: Editor,
    ) {
        super(app, plugin);
    }

    getModalTitle(): string { return "Apply template"; }
    getModalIcon(): string  { return "file-input"; }

    renderBody(): void {
        this.bodyEl.createEl("p", {
            text: "Choose a note type to merge into the current note. Existing frontmatter fields are kept.",
            cls: "dev-nc-apply-desc",
        });

        const grid = this.bodyEl.createDiv("dev-nc-type-grid");

        for (const type of NOTE_TYPES) {
            const card = grid.createDiv("dev-nc-type-card");
            const iconEl = card.createDiv("dev-nc-type-icon");
            setIcon(iconEl, type.icon);
            card.createEl("span", { text: type.label, cls: "dev-nc-type-label" });

            card.addEventListener("click", () => {
                void this.applyTemplate(type);
                this.close();
            });
        }
    }

    renderFooter(): void {
        this.addFooterButton("Cancel", false, () => this.close());
    }

    private async applyTemplate(type: NoteType): Promise<void> {
        const content = this.editor.getValue();
        const cache = this.plugin.app.metadataCache.getFileCache(this.file);
        const existingFm = cache?.frontmatter ?? {};
        const today = moment().format("YYYY-MM-DD");
        const activeClient = this.plugin.settings.clientContext.activeClient;

        // Build the fields to add — only those not already present
        const newFields: Record<string, string> = {};
        if (!existingFm["title"]) newFields["title"] = `"${this.file.basename}"`;
        if (!existingFm["tags"])  newFields["tags"]  = `["${type.id}"]`;
        if (!existingFm["date"])  newFields["date"]  = today;

        for (const field of type.extraFields) {
            if (!existingFm[field.key]) {
                if (field.key === "client" && activeClient) {
                    newFields["client"] = `"${activeClient}"`;
                }
                // Leave other optional fields blank — don't add empty values
            }
        }

        if (Object.keys(newFields).length === 0 && existingFm["tags"]) {
            new Notice("[DEV] Note already has all required frontmatter fields.");
            return;
        }

        // If no frontmatter exists yet, create a minimal block
        let patched: string;
        if (!content.startsWith("---")) {
            const lines = [
                "---",
                `title: "${this.file.basename}"`,
                `tags: ["${type.id}"]`,
                `date: ${today}`,
                "---",
                "",
                content,
            ].join("\n");
            patched = lines;
        } else {
            patched = insertFrontmatterFields(content, newFields);
        }

        await this.plugin.app.vault.modify(this.file, patched);
        this.editor.setValue(patched);
        new Notice(`[DEV] Template "${type.label}" applied to ${this.file.basename}.`);
    }
}

// ── Scan and repair frontmatter ───────────────────────────────────────────────

async function repairFrontmatter(plugin: DevPlugin): Promise<void> {
    const files = plugin.app.vault.getMarkdownFiles();
    const today = moment().format("YYYY-MM-DD");
    const repaired: string[] = [];
    const skipped: string[] = [];

    for (const file of files) {
        const cache = plugin.app.metadataCache.getFileCache(file);
        const fm = cache?.frontmatter;

        if (!fm) {
            skipped.push(`- [[${file.basename}]] — no frontmatter (skipped)`);
            continue;
        }

        const missing: Record<string, string> = {};
        if (!fm["title"]) missing["title"] = `"${file.basename}"`;
        if (!fm["date"])  missing["date"]  = today;
        if (!fm["tags"])  missing["tags"]  = "[]";

        if (Object.keys(missing).length === 0) continue;

        const content = await plugin.app.vault.read(file);
        const patched = insertFrontmatterFields(content, missing);
        await plugin.app.vault.modify(file, patched);
        repaired.push(`- [[${file.basename}]] — added: ${Object.keys(missing).join(", ")}`);
    }

    if (repaired.length === 0) {
        new Notice("[DEV] Frontmatter scan — all notes are complete. No repairs needed.");
        return;
    }

    const reportPath = `[DEV] Frontmatter repair ${today}.md`;
    const reportContent = [
        "---",
        `title: "[DEV] Frontmatter repair report"`,
        `date: ${today}`,
        'tags: ["dev", "repair-report"]',
        "---",
        "",
        `# [DEV] Frontmatter repair — ${today}`,
        "",
        `${repaired.length} file(s) repaired. ${skipped.length} file(s) had no frontmatter and were skipped.`,
        "",
        "## Repaired",
        "",
        ...repaired,
        ...(skipped.length > 0 ? ["", "## Skipped (no frontmatter)", "", ...skipped] : []),
    ].join("\n");

    try {
        const existing = plugin.app.vault.getAbstractFileByPath(reportPath);
        let reportFile: TFile;
        if (existing instanceof TFile) {
            await plugin.app.vault.modify(existing, reportContent);
            reportFile = existing;
        } else {
            reportFile = await plugin.app.vault.create(reportPath, reportContent);
        }
        await plugin.app.workspace.getLeaf(false).openFile(reportFile);
        new Notice(`[DEV] Frontmatter repair — ${repaired.length} file(s) updated.`);
    } catch (err) {
        console.error("[DEV] Frontmatter repair error:", err);
        new Notice("[DEV] Frontmatter repair failed — see console.");
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Insert missing fields into an existing frontmatter block.
// Never overwrites fields that already exist.
function insertFrontmatterFields(
    content: string,
    fields: Record<string, string>
): string {
    if (!content.startsWith("---")) return content;
    const closeIdx = content.indexOf("\n---", 3);
    if (closeIdx === -1) return content;

    const fieldLines = Object.entries(fields)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");

    return content.slice(0, closeIdx) + "\n" + fieldLines + content.slice(closeIdx);
}

// Create a folder path recursively if it doesn't exist.
async function ensureFolder(app: App, path: string): Promise<void> {
    if (!path) return;
    const parts = path.split("/");
    let current = "";
    for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        if (!app.vault.getAbstractFileByPath(current)) {
            await app.vault.createFolder(current);
        }
    }
}
