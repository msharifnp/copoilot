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
        this.lastRequest = 0;
    }
    async provideCompletionItems(document, position, token, context) {
        // Debounce
        const now = Date.now();
        if (now - this.lastRequest < config_1.config.debounceMs) {
            return [];
        }
        this.lastRequest = now;
        // Check if request was cancelled
        if (token.isCancellationRequested) {
            return [];
        }
        try {
            // Get surrounding context (more context for better completions)
            const beforeRange = new vscode.Range(new vscode.Position(Math.max(0, position.line - 10), 0), position);
            const afterRange = new vscode.Range(position, new vscode.Position(Math.min(document.lineCount - 1, position.line + 5), 0));
            const beforeText = document.getText(beforeRange);
            const afterText = document.getText(afterRange);
            const fullText = beforeText + afterText;
            console.log(`[RaaS Completion] Language: ${document.languageId}, Position: ${position.line}:${position.character}`);
            // Call completion API with proper payload
            const response = await apiClient_1.apiClient.completeCode({
                text: fullText,
                language: document.languageId,
                context: {
                    before: beforeText,
                    after: afterText,
                    line: position.line,
                    mode: "completion" // Indicate this is standard completion
                },
                user_id: "sharif_111", // Add user_id if required by your API
                file_path: document.uri.fsPath // Add file path for project context
            });
            const completionText = (response.completion || "").trim();
            if (!completionText) {
                console.log('[RaaS Completion] No completion returned from API');
                return [];
            }
            console.log(`[RaaS Completion] Got completion: ${completionText.slice(0, 50)}...`);
            // Create completion item
            const firstLine = completionText.split('\n')[0] || "RaaS Suggestion";
            const item = new vscode.CompletionItem(firstLine, vscode.CompletionItemKind.Snippet);
            item.insertText = new vscode.SnippetString(completionText);
            item.detail = "🤖 RaaS AI Completion";
            item.documentation = new vscode.MarkdownString(`AI-generated code completion\n\nLanguage: ${document.languageId}`);
            item.sortText = "00000"; // High priority
            item.preselect = true;
            item.command = {
                command: 'editor.action.triggerSuggest',
                title: 'Re-trigger completions'
            };
            return [item];
        }
        catch (error) {
            console.error(`[RaaS Completion] Error:`, error);
            // Return empty array instead of throwing
            return [];
        }
    }
}
exports.RaaSCompletionProvider = RaaSCompletionProvider;
//# sourceMappingURL=completionProvider.js.map