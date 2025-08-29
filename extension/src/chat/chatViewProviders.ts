import * as vscode from "vscode";
import * as fs from "fs";
import { apiClient, UploadFilePart, ChatResponse } from "../apiClient";

export class RaasChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "raasChatView";
  private _view?: vscode.WebviewView;
  private _sessionId?: string; // Track session ID at provider level

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
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

      if (message?.type !== "chat") return;

      try {
        // Use existing session ID or the one from message
        const sessionId = this._sessionId || message.sessionId;
        console.log(`[RaaS] Using session ID: ${sessionId}`);

        const incoming = Array.isArray(message.files) ? message.files : [];
        const files: UploadFilePart[] = incoming.map((f: any) => ({
          name: String(f.filename || f.name || "file"),
          type: String(f.mimeType || f.type || "application/octet-stream"),
          data: Buffer.from(String(f.contentBase64 || f.base64 || ""), "base64"),
        }));

        console.log(`[RaaS] Processing: text=${!!message.text}, files=${files.length}, session=${sessionId}`);

        // Pass session ID to API client
        const res: ChatResponse = await apiClient.sendChatForm(
          message.text || "", 
          files, 
          sessionId
        );

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

      } catch (e) {
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

  private getHtml(webview: vscode.Webview) {
    const htmlPath = vscode.Uri.joinPath(this.extensionUri, "media", "chat.html");
    const html = fs.readFileSync(htmlPath.fsPath, "utf-8");
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "styles.css"));
    return html.replace("{{chat_css}}", String(cssUri));
  }
}