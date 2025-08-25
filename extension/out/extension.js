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
function activate(ctx) {
    console.log("[RaaS] activate()");
    ctx.subscriptions.push(vscode.window.registerWebviewViewProvider("raasChatView", new chatViewProviders_1.RaasChatViewProvider(ctx.extensionUri)), vscode.commands.registerCommand("raas.openChat", () => vscode.commands.executeCommand("workbench.view.extension.raasChat")), 
    // Completions (menu)
    vscode.languages.registerCompletionItemProvider([
        { language: "python" }, { language: "javascript" }, { language: "typescript" },
        { language: "java" }, { language: "cpp" }, { language: "c" }
    ], new completionProvider_1.RaaSCompletionProvider(), ".", " ", "\n", "\t"), 
    // Inline (ghost text)
    vscode.languages.registerInlineCompletionItemProvider([
        { language: "python" }, { language: "javascript" }, { language: "typescript" },
        { language: "java" }, { language: "cpp" }, { language: "c" }
    ], new inlineProvider_1.RaaSInlineCompletionProvider()));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map