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
exports.RaaSCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
const apiClient_1 = require("../apiClient");
const config_1 = require("../config");
class RaaSCompletionProvider {
    constructor() {
        this.last = 0;
    }
    async provideCompletionItems(doc, pos) {
        const now = Date.now();
        if (now - this.last < config_1.config.debounceMs)
            return [];
        this.last = now;
        const before = doc.getText(new vscode.Range(new vscode.Position(Math.max(0, pos.line - 5), 0), pos));
        const after = doc.getText(new vscode.Range(pos, new vscode.Position(Math.min(doc.lineCount - 1, pos.line + 2), 0)));
        const language = this.mapLanguage(doc.languageId);
        try {
            const { completion } = await apiClient_1.apiClient.completeCode({
                text: before + after,
                language,
                context: { before, after, line: pos.line }
            });
            const text = (completion || "").trim();
            if (!text)
                return [];
            const item = new vscode.CompletionItem(text.split("\n")[0] || "RaaS Completion", vscode.CompletionItemKind.Snippet);
            item.insertText = new vscode.SnippetString(text);
            item.detail = "🤖 RaaS AI";
            item.sortText = "00000";
            item.preselect = true;
            return [item];
        }
        catch {
            return [];
        }
    }
    mapLanguage(id) {
        const m = {
            python: "python", javascript: "javascript", typescript: "typescript",
            java: "java", cpp: "cpp", c: "c", go: "go", rust: "rust"
        };
        return m[id] || "python";
    }
}
exports.RaaSCompletionProvider = RaaSCompletionProvider;
//# sourceMappingURL=completionProvider.js.map