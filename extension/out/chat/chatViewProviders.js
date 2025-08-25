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
const path = __importStar(require("path"));
const apiClient_1 = require("../apiClient");
class RaasChatViewProvider {
    constructor(extUri) {
        this.extUri = extUri;
    }
    resolveWebviewView(view) {
        const webview = view.webview;
        webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.extUri, "media")]
        };
        webview.html = this.getHtml(webview);
        webview.onDidReceiveMessage(async (msg) => {
            if (msg?.type !== "chat")
                return;
            try {
                const files = [];
                if (msg.pickFile) {
                    const picks = await vscode.window.showOpenDialog({ canSelectMany: true });
                    if (picks) {
                        for (const uri of picks) {
                            const data = await vscode.workspace.fs.readFile(uri);
                            files.push({
                                name: path.basename(uri.fsPath),
                                type: "application/octet-stream",
                                data: Buffer.from(data)
                            });
                        }
                    }
                }
                const res = await apiClient_1.apiClient.sendChatForm(String(msg.text ?? ""), files);
                webview.postMessage({ type: "response", text: res.response, success: true });
            }
            catch (e) {
                webview.postMessage({ type: "response", text: `Error: ${e.message}`, success: false });
            }
        });
    }
    getHtml(webview) {
        const htmlPath = vscode.Uri.joinPath(this.extUri, "media", "chat.html");
        let html = fs.readFileSync(htmlPath.fsPath, "utf-8");
        // replace placeholders
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extUri, "media", "styles.css"));
        html = html.replace(/{{styles}}/g, String(cssUri));
        return html;
    }
}
exports.RaasChatViewProvider = RaasChatViewProvider;
//# sourceMappingURL=chatViewProviders.js.map