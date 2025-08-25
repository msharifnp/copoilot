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
    const chatProvider = new chatViewProviders_1.RaasChatViewProvider(ctx.extensionUri);
    const completionProvider = new completionProvider_1.RaaSCompletionProvider();
    const langs = ["python", "javascript", "typescript", "java", "cpp", "c", "go", "rust"];
    ctx.subscriptions.push(vscode.window.registerWebviewViewProvider("raasChatView", chatProvider), vscode.languages.registerCompletionItemProvider(langs, completionProvider, ".", " ", "\n", "\t"), vscode.commands.registerCommand("raas.openChat", () => vscode.commands.executeCommand("workbench.view.extension.raasChat")), vscode.languages.registerInlineCompletionItemProvider([{ language: "python" }, { language: "javascript" }, { language: "typescript" }, { language: "java" }, { language: "cpp" }, { language: "c" }], new inlineProvider_1.RaaSInlineCompletionProvider()));
}
function deactivate() { }
// import * as vscode from "vscode";
// import { RaasChatViewProvider } from "./chat/chatViewProviders";
// export function activate(ctx: vscode.ExtensionContext) {
//   console.log("[RaaS] activate() - TESTING");
//   try {
//     const chatProvider = new RaasChatViewProvider(ctx.extensionUri);
//     console.log("[RaaS] ChatProvider created successfully");
//     const disposable = vscode.window.registerWebviewViewProvider("raasChatView", chatProvider);
//     console.log("[RaaS] WebviewViewProvider registered");
//     ctx.subscriptions.push(disposable);
//     console.log("[RaaS] Extension fully activated");
//   } catch (error) {
//     console.error("[RaaS] Activation failed:", error);
//   }
// }
// export function deactivate() {
//   console.log("[RaaS] deactivate()");
// }
//# sourceMappingURL=extension.js.map