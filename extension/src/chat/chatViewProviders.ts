import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { UploadFilePart, apiClient } from "../apiClient";

export class RaasChatViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly extUri: vscode.Uri) {}

  resolveWebviewView(view: vscode.WebviewView) {
    const webview = view.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extUri, "media")]
    };
    webview.html = this.getHtml(webview);

    webview.onDidReceiveMessage(async (msg) => {
      if (msg?.type !== "chat") return;

      try {
        const files: UploadFilePart[] = [];
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

        const res = await apiClient.sendChatForm(String(msg.text ?? ""), files);
        webview.postMessage({ type: "response", text: res.response, success: true });
      } catch (e: any) {
        webview.postMessage({ type: "response", text: `Error: ${e.message}`, success: false });
      }
    });
  }

  private getHtml(webview: vscode.Webview) {
    const htmlPath = vscode.Uri.joinPath(this.extUri, "media", "chat.html");
    let html = fs.readFileSync(htmlPath.fsPath, "utf-8");

    // replace placeholders
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extUri, "media", "styles.css"));
    html = html.replace(/{{styles}}/g, String(cssUri));

    return html;
  }
}
