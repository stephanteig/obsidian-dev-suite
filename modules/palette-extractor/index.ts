// ─── Palette Extractor — Module 4 ────────────────────────────────────────────

import { App, Editor, Modal, Notice, TFile } from "obsidian";
import type { DevPlugin } from "../../types";
import type { ColorPreviewModule } from "../color-preview/index";

// ── Regex patterns ────────────────────────────────────────────────────────────

const HEX6_RE = /#([0-9a-fA-F]{6})/g;
const HEX3_RE = /#([0-9a-fA-F]{3})\b/g;
const RGB_RE  = /rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/gi;
const HSL_RE  = /hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?\s*\)/gi;

// Role labels applied when extracting inside a client folder
const CLIENT_ROLES = ["Primary", "Secondary", "Accent", "Background"];

interface ExtractedColor {
    hex: string;
    name: string;
}

// ── Module loader ─────────────────────────────────────────────────────────────

export function loadPaletteExtractor(plugin: DevPlugin, _colorPreview?: ColorPreviewModule): void {
    plugin.addCommand({
        id: "dev-pe-extract-palette",
        name: "[DEV] Palette extractor: Extract palette from note",
        editorCallback: (editor, ctx) => {
            const file = ctx.file;
            if (!file) {
                new Notice("[DEV] Palette extractor — no active file.");
                return;
            }
            void runExtraction(plugin, editor, file);
        },
    });

    plugin.addCommand({
        id: "dev-cp-extract-palette",
        name: "[DEV] Color preview: Extract palette from note",
        editorCallback: (editor, ctx) => {
            const file = ctx.file;
            if (!file) {
                new Notice("[DEV] Palette extractor — no active file.");
                return;
            }
            void runExtraction(plugin, editor, file);
        },
    });
}

// ── Extraction logic ──────────────────────────────────────────────────────────

async function runExtraction(plugin: DevPlugin, editor: Editor, file: TFile): Promise<void> {
    const content = editor.getValue();
    const text = stripFrontmatterAndCodeBlocks(content);
    let colors = extractColors(text);

    if (colors.length === 0) {
        new Notice("[DEV] Palette extractor — no colour values found in this note.");
        return;
    }

    // Apply client role labels if inside a client folder
    if (isInClientFolder(file, plugin)) {
        colors = colors.map((c, i) => ({
            ...c,
            name: c.name || CLIENT_ROLES[i] || "",
        }));
    }

    const paletteBlock = buildPaletteBlock(colors);
    const existingMatch = /^```palette\n[\s\S]*?^```/m.exec(content);

    if (existingMatch) {
        new ConfirmReplaceModal(plugin.app, colors.length, () => {
            const newContent = content.replace(/^```palette\n[\s\S]*?^```/m, paletteBlock);
            editor.setValue(newContent);
            new Notice(`[DEV] Palette extractor — replaced palette (${colors.length} colours).`);
        }).open();
    } else {
        const newContent = insertAfterFrontmatter(content, paletteBlock);
        editor.setValue(newContent);
        new Notice(`[DEV] Palette extractor — inserted palette (${colors.length} colours).`);
    }
}

// ── Colour extraction helpers ─────────────────────────────────────────────────

function extractColors(text: string): ExtractedColor[] {
    const lines = text.split("\n");
    const seen = new Set<string>();
    const results: ExtractedColor[] = [];

    for (const line of lines) {
        // Hex 6-digit
        HEX6_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = HEX6_RE.exec(line)) !== null) {
            add(seen, results, `#${m[1].toUpperCase()}`, inferName(line, m[0], m.index));
        }

        // Hex 3-digit → expand to 6
        HEX3_RE.lastIndex = 0;
        while ((m = HEX3_RE.exec(line)) !== null) {
            const expanded = m[1].split("").map((c) => c + c).join("");
            add(seen, results, `#${expanded.toUpperCase()}`, inferName(line, m[0], m.index));
        }

        // rgb()
        RGB_RE.lastIndex = 0;
        while ((m = RGB_RE.exec(line)) !== null) {
            const hex = rgbToHex(parseInt(m[1]), parseInt(m[2]), parseInt(m[3]));
            add(seen, results, hex, inferName(line, m[0], m.index));
        }

        // hsl()
        HSL_RE.lastIndex = 0;
        while ((m = HSL_RE.exec(line)) !== null) {
            const rgb = hslToRgb(parseInt(m[1]), parseInt(m[2]), parseInt(m[3]));
            const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
            add(seen, results, hex, inferName(line, m[0], m.index));
        }
    }

    return results;
}

function add(seen: Set<string>, results: ExtractedColor[], hex: string, name: string): void {
    if (!seen.has(hex)) {
        seen.add(hex);
        results.push({ hex, name });
    }
}

// Infer a label from the text surrounding the colour value on the same line
function inferName(line: string, match: string, index: number): string {
    const before = line
        .slice(0, index)
        .replace(/[*_`#!\[\]]/g, "")
        .replace(/\s*[:|=→–\-]+\s*$/, "")
        .trim();

    if (before.length > 0 && before.length <= 30) return before;

    const after = line
        .slice(index + match.length)
        .replace(/[*_`#!\[\]]/g, "")
        .replace(/^[\s:|=→–\-]+/, "")
        .trim();

    if (after.length > 0 && after.length <= 30) return after;

    return "";
}

// Strip frontmatter and fenced code blocks so we don't pick up colours inside them.
// Uses explicit fence tracking — a closing fence must be exactly the same backtick
// run as the opening, with no trailing language specifier. This means ```color
// inside a block does NOT accidentally close an outer ``` fence.
function stripFrontmatterAndCodeBlocks(content: string): string {
    const lines = content.split("\n");
    const result: string[] = [];
    let inFrontmatter = false;
    let openFence: string | null = null; // e.g. "```" or "````"

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trimStart();

        // Frontmatter: opening --- must be the very first line
        if (i === 0 && line === "---") {
            inFrontmatter = true;
            continue;
        }
        if (inFrontmatter) {
            if (line === "---") inFrontmatter = false;
            continue;
        }

        if (openFence === null) {
            // Opening fence: 3+ backticks at the start of the trimmed line
            const m = trimmed.match(/^(`{3,})/);
            if (m) {
                openFence = m[1]; // store just the backtick run, e.g. "```"
                continue;
            }
            result.push(line);
        } else {
            // Closing fence: trimmed line must be exactly openFence with no other
            // non-whitespace characters (language specifiers are not allowed on closing fences).
            if (trimmed.startsWith(openFence) && trimmed.slice(openFence.length).trim() === "") {
                openFence = null;
            }
            // Always skip content inside code blocks — never push to result
        }
    }

    return result.join("\n");
}

// ── Palette block builder ─────────────────────────────────────────────────────

function buildPaletteBlock(colors: ExtractedColor[]): string {
    const lines = colors.map((c) => (c.name ? `${c.name}: ${c.hex}` : c.hex));
    return "```palette\n" + lines.join("\n") + "\n```";
}

function insertAfterFrontmatter(content: string, block: string): string {
    if (content.startsWith("---")) {
        const closeIdx = content.indexOf("\n---", 3);
        if (closeIdx !== -1) {
            const after = content.slice(closeIdx + 4).trimStart();
            return content.slice(0, closeIdx + 4) + "\n\n" + block + "\n\n" + after;
        }
    }
    return block + "\n\n" + content;
}

// ── Colour math helpers ───────────────────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): string {
    return "#" + [r, g, b]
        .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0").toUpperCase())
        .join("");
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    return {
        r: Math.round(f(0) * 255),
        g: Math.round(f(8) * 255),
        b: Math.round(f(4) * 255),
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isInClientFolder(file: TFile, plugin: DevPlugin): boolean {
    const { clientsFolder } = plugin.settings.clientContext;
    return file.path.startsWith(clientsFolder + "/");
}

// ── Confirm replace modal ─────────────────────────────────────────────────────

class ConfirmReplaceModal extends Modal {
    constructor(
        app: App,
        private readonly colorCount: number,
        private readonly onConfirm: () => void,
    ) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: "[DEV] Palette extractor" });
        contentEl.createEl("p", {
            text: `A palette block already exists in this note. Replace it with ${this.colorCount} extracted colour(s)?`,
        });

        const footer = contentEl.createDiv("dev-nc-footer");

        const cancel = footer.createEl("button", { text: "Cancel" });
        cancel.addEventListener("click", () => this.close());

        const replace = footer.createEl("button", { text: "Replace", cls: "mod-cta" });
        replace.addEventListener("click", () => {
            this.close();
            this.onConfirm();
        });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
