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
const vscode = __importStar(require("vscode"));
const apiClient_1 = require("../apiClient");
const config_1 = require("../config");
class RaaSInlineCompletionProvider {
    constructor() {
        this.lastRequest = 0;
        this.minTriggerLength = 3; // Don't suggest on very short input
    }
    async provideInlineCompletionItems(document, position, context, token) {
        // Debounce
        const now = Date.now();
        if (now - this.lastRequest < config_1.config.debounceMs) {
            return { items: [] };
        }
        this.lastRequest = now;
        // Check cancellation
        if (token.isCancellationRequested) {
            return { items: [] };
        }
        // Don't trigger on very short content or empty lines
        const currentLine = document.lineAt(position.line).text;
        const beforeCursor = currentLine.substring(0, position.character);
        if (beforeCursor.trim().length < this.minTriggerLength) {
            return { items: [] };
        }
        try {
            // Get more context for inline completions
            const beforeRange = new vscode.Range(new vscode.Position(Math.max(0, position.line - 15), 0), position);
            const afterRange = new vscode.Range(position, new vscode.Position(Math.min(document.lineCount - 1, position.line + 3), 0));
            const beforeText = document.getText(beforeRange);
            const afterText = document.getText(afterRange);
            const fullText = beforeText + afterText;
            console.log(`[RaaS Inline] Language: ${document.languageId}, Trigger: "${beforeCursor.slice(-10)}"`);
            // Call completion API
            const response = await apiClient_1.apiClient.completeCode({
                text: fullText,
                language: document.languageId,
                context: {
                    before: beforeText,
                    after: afterText,
                    line: position.line,
                    mode: "inline" // Indicate this is inline completion
                },
                user_id: "sharif_111",
                file_path: document.uri.fsPath
            });
            const completionText = (response.completion || "").trim();
            if (!completionText) {
                console.log('[RaaS Inline] No completion returned from API');
                return { items: [] };
            }
            console.log(`[RaaS Inline] Got completion: ${completionText.slice(0, 50)}...`);
            // Create inline completion item
            const item = new vscode.InlineCompletionItem(completionText, new vscode.Range(position, position));
            return { items: [item] };
        }
        catch (error) {
            console.error(`[RaaS Inline] Error:`, error);
            return { items: [] };
        }
    }
}
exports.RaaSInlineCompletionProvider = RaaSInlineCompletionProvider;
//# sourceMappingURL=inlineProvider.js.map