"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RaaSInlineCompletionProvider = void 0;
// src/completion/inlineProvider.ts
const vscode = __importStar(require("vscode"));
const apiClient_1 = require("../apiClient");
const config_1 = require("../config");
class RaaSInlineCompletionProvider {
    constructor() {
        this.last = 0;
    }
    async provideInlineCompletionItems(doc, pos) {
        const now = Date.now();
        if (now - this.last < config_1.config.debounceMs)
            return { items: [] };
        this.last = now;
        const before = doc.getText(new vscode.Range(new vscode.Position(Math.max(0, pos.line - 5), 0), pos));
        const after = doc.getText(new vscode.Range(pos, new vscode.Position(Math.min(doc.lineCount - 1, pos.line + 2), 0)));
        try {
            const { completion } = await apiClient_1.apiClient.completeCode({
                text: before + after,
                language: doc.languageId,
                context: { before, after, line: pos.line, mode: "inline" }
            });
            const text = (completion || "").trim();
            if (!text)
                return { items: [] };
            const item = new vscode.InlineCompletionItem(text, new vscode.Range(pos, pos));
            return { items: [item] };
        }
        catch {
            return { items: [] };
        }
    }
}
exports.RaaSInlineCompletionProvider = RaaSInlineCompletionProvider;
//# sourceMappingURL=inlineProvider.js.map