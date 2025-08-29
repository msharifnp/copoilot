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
exports.RaasChatViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const apiClient_1 = require("../apiClient");
class RaasChatViewProvider {
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }
    resolveWebviewView(webviewView) {
        this._view = webviewView;
        const webview = webviewView.webview;
        webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
        };
        webview.html = this.getHtml(webview);
        webview.onDidReceiveMessage(async (message) => {
            console.log(`[RaaS] Received message type: ${message?.type}`);
            if (message?.type === "init-session") {
                // Store session ID from webview
                this._sessionId = message.sessionId;
                console.log(`[RaaS] Session initialized: ${this._sessionId}`);
                return;
            }
            if (message?.type !== "chat")
                return;
            try {
                // Use existing session ID or the one from message
                const sessionId = this._sessionId || message.sessionId;
                console.log(`[RaaS] Using session ID: ${sessionId}`);
                const incoming = Array.isArray(message.files) ? message.files : [];
                const files = incoming.map((f) => ({
                    name: String(f.filename || f.name || "file"),
                    type: String(f.mimeType || f.type || "application/octet-stream"),
                    data: Buffer.from(String(f.contentBase64 || f.base64 || ""), "base64"),
                }));
                console.log(`[RaaS] Processing: text=${!!message.text}, files=${files.length}, session=${sessionId}`);
                // Pass session ID to API client
                const res = await apiClient_1.apiClient.sendChatForm(message.text || "", files, sessionId);
                // Update our session ID if the server returned one
                if (res.session_id) {
                    this._sessionId = res.session_id;
                }
                webview.postMessage({
                    type: "response",
                    text: res.response,
                    success: true,
                    sessionId: this._sessionId
                });
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error(`[RaaS] Chat error: ${msg}`);
                this._view?.webview.postMessage({
                    type: "response",
                    text: `Error: ${msg}`,
                    success: false
                });
            }
        });
    }
    getHtml(webview) {
        const htmlPath = vscode.Uri.joinPath(this.extensionUri, "media", "chat.html");
        const html = fs.readFileSync(htmlPath.fsPath, "utf-8");
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "styles.css"));
        return html.replace("{{chat_css}}", String(cssUri));
    }
}
exports.RaasChatViewProvider = RaasChatViewProvider;
RaasChatViewProvider.viewType = "raasChatView";
//# sourceMappingURL=chatViewProviders.js.map