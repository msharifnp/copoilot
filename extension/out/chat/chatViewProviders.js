"use strict";
// import * as vscode from "vscode";
// import * as fs from "fs";
// import { apiClient, UploadFilePart,ChatResponse } from "../apiClient";
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
exports.RaasChatViewProvider = void 0;
// export class RaasChatViewProvider implements vscode.WebviewViewProvider {
//   public static readonly viewType = "raasChatView";
//   private _view?: vscode.WebviewView;
//   constructor(private readonly extensionUri: vscode.Uri) {}
//   resolveWebviewView(webviewView: vscode.WebviewView): void {
//     this._view = webviewView;
//     const webview = webviewView.webview;
//     webview.options = {
//       enableScripts: true,
//       localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
//     };
//     webview.html = this.getHtml(webview);
//     webview.onDidReceiveMessage(async (message) => {
//       if (message?.type !== "chat") return;
//       try {
//         const incoming = Array.isArray(message.files) ? message.files : [];
//         const files: UploadFilePart[] = incoming.map((f: any) => ({
//           name: String(f.name || "file"),
//           type: String(f.type || "application/octet-stream"),
//           data: Buffer.from(String(f.base64 || ""), "base64"),
//         }));
//         console.log(`[RaaS] Webview sent text=${!!message.text} files=${files.length}`);
//         const res: ChatResponse = await apiClient.sendChatForm(message.text || "", files); // ✅ typed
//         webview.postMessage({ type: "response", text: res.response, success: true });
//       } catch (e) {
//         const msg = e instanceof Error ? e.message : String(e);
//         this._view?.webview.postMessage({ type: "response", text: msg, success: false });
//       }
//     });
//   }
//   private getHtml(webview: vscode.Webview) {
//     const htmlPath = vscode.Uri.joinPath(this.extensionUri, "media", "chat.html");
//     const html = fs.readFileSync(htmlPath.fsPath, "utf-8");
//     const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "styles.css"));
//     return html.replace("{{chat_css}}", String(cssUri));
//   }
// }
// src/chat/chatViewProviders.ts
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const buffer_1 = require("buffer"); // for base64 -> Buffer
const apiClient_1 = require("../apiClient");
function genSessionId() {
    return globalThis?.crypto?.randomUUID?.() ||
        `${Math.random().toString(36).slice(2)}-${Date.now()}`;
}
class RaasChatViewProvider {
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }
    resolveWebviewView(webviewView) {
        this._view = webviewView;
        // Create/fallback a stable sessionId if missing
        if (!this._sessionId)
            this._sessionId = genSessionId();
        const webview = webviewView.webview;
        webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
        };
        webview.html = this.getHtml(webview);
        webview.onDidReceiveMessage(async (message) => {
            try {
                switch (message?.type) {
                    case "init-session": {
                        // chat.html announces its session; we prefer it, but keep fallback
                        if (typeof message.sessionId === "string" && message.sessionId.trim()) {
                            this._sessionId = message.sessionId.trim();
                            console.log(`[RaaS] init-session: ${this._sessionId}`);
                        }
                        return;
                    }
                    case "chat": {
                        // prefer incoming sessionId, fallback to our own stable one
                        const sessionId = (typeof message.sessionId === "string" && message.sessionId.trim())
                            ? message.sessionId.trim()
                            : (this._sessionId ?? (this._sessionId = genSessionId()));
                        const incoming = Array.isArray(message.files) ? message.files : [];
                        // IMPORTANT: map fields from chat.html -> UploadFilePart
                        // chat.html's toB64() sends: { filename, mimeType, size, contentBase64 }
                        const files = incoming.map((f) => ({
                            name: String(f.filename ?? f.name ?? "file"),
                            type: String(f.mimeType ?? f.type ?? "application/octet-stream"),
                            data: buffer_1.Buffer.from(String(f.contentBase64 ?? f.base64 ?? ""), "base64"),
                        }));
                        console.log(`[RaaS] Webview -> extension: text=${!!message.text} files=${files.length} sessionId=${sessionId}`);
                        const res = await apiClient_1.apiClient.sendChatForm(String(message.text || ""), files, sessionId);
                        webview.postMessage({ type: "response", text: res.response, success: true });
                        return;
                    }
                    default:
                        // ignore unknown message types
                        return;
                }
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                this._view?.webview.postMessage({ type: "response", text: msg, success: false });
            }
        });
    }
    getHtml(webview) {
        const htmlPath = vscode.Uri.joinPath(this.extensionUri, "media", "chat.html");
        const html = fs.readFileSync(htmlPath.fsPath, "utf-8");
        // If you actually have styles.css and a placeholder {{chat_css}} in HTML, keep this.
        // Otherwise, it's harmless.
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "styles.css"));
        return html.replace("{{chat_css}}", String(cssUri));
    }
}
exports.RaasChatViewProvider = RaasChatViewProvider;
RaasChatViewProvider.viewType = "raasChatView";
//# sourceMappingURL=chatViewProviders.js.map