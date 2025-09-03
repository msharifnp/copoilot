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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const chatViewProviders_1 = require("./chat/chatViewProviders");
const completionProvider_1 = require("./completion/completionProvider");
const inlineProvider_1 = require("./completion/inlineProvider");
const apiClient_1 = require("./apiClient");
function activate(context) {
    console.log("[RaaS] Extension activating...");
    // ---- Chat webview
    const chatProvider = new chatViewProviders_1.RaasChatViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("raasChatView", chatProvider, {
        webviewOptions: { retainContextWhenHidden: true }
    }));
    // ---- Languages to support
    const langs = [
        "python", "javascript", "typescript", "java", "cpp", "c",
        "csharp", "go", "rust", "php", "ruby", "swift", "kotlin",
        "sql", "html", "css", "dart", "scala",
        "json", "yaml", "markdown", "plaintext",
        "shellscript", "powershell",
        "javascriptreact", "typescriptreact"
    ];
    const selector = [
        ...langs.map(l => ({ language: l, scheme: "file" })),
        ...langs.map(l => ({ language: l, scheme: "untitled" }))
    ];
    // ---- Trigger characters
    const triggers = [".", " ", "=", ":", "(", "[", "{", ",", "'", "\"", ">", "<", "/"];
    // ---- Register providers
    const completionProvider = new completionProvider_1.RaaSCompletionProvider();
    const inlineProvider = new inlineProvider_1.RaaSInlineCompletionProvider();
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(selector, completionProvider, ...triggers));
    context.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider(selector, inlineProvider));
    // ---- Commands
    context.subscriptions.push(vscode.commands.registerCommand("raas.openChat", async () => {
        await vscode.commands.executeCommand("workbench.view.extension.raasChat");
    }));
    // Debug command to test completion endpoint
    context.subscriptions.push(vscode.commands.registerCommand("raas.testCompletion", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage("No active editor found");
            return;
        }
        try {
            vscode.window.showInformationMessage("Testing completion endpoint...");
            // In your VS Code extension, send more context:
            const document = editor.document;
            const position = editor.selection.active;
            // --- Expanded context (fix: use offsetAt)
            const fullText = document.getText();
            const offset = document.offsetAt(position);
            const beforeText = fullText.slice(0, offset);
            const afterText = fullText.slice(offset);
            // const document = editor.document;
            // const position = editor.selection.active;
            // // Get some context
            // const beforeText = document.getText(new vscode.Range(
            //   new vscode.Position(Math.max(0, position.line - 5), 0), 
            //   position
            // ));
            console.log(`[RaaS Debug] Testing completion for language: ${document.languageId}`);
            const response = await apiClient_1.apiClient.completeCode({
                text: beforeText + "\n# Complete this code",
                language: document.languageId,
                context: {
                    before: beforeText,
                    after: afterText,
                    line: position.line,
                    mode: "test"
                },
                user_id: "sharif_111",
                file_path: document.uri.fsPath
            });
            if (response.completion) {
                vscode.window.showInformationMessage(`Completion successful! Length: ${response.completion.length}`);
                console.log(`[RaaS Debug] Completion result:`, response.completion);
            }
            else {
                vscode.window.showWarningMessage("No completion returned from API");
            }
        }
        catch (error) {
            console.error("[RaaS Debug] Test completion failed:", error);
            vscode.window.showErrorMessage(`Completion test failed: ${error.message}`);
        }
    }));
    // Command to check API health
    context.subscriptions.push(vscode.commands.registerCommand("raas.checkHealth", async () => {
        try {
            const isHealthy = await apiClient_1.apiClient.checkHealth();
            if (isHealthy) {
                vscode.window.showInformationMessage("RaaS API is healthy!");
            }
            else {
                vscode.window.showErrorMessage("RaaS API health check failed");
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Health check error: ${error.message}`);
        }
    }));
    console.log("[RaaS] Extension activated successfully!");
}
function deactivate() {
    console.log("[RaaS] Extension deactivated");
}
//# sourceMappingURL=extension.js.map