import * as vscode from "vscode";
import { apiClient } from "../apiClient";
import { config } from "../config";

export class RaaSCompletionProvider implements vscode.CompletionItemProvider {
  private last = 0;

  async provideCompletionItems(doc: vscode.TextDocument, pos: vscode.Position) {
    const now = Date.now();
    if (now - this.last < config.debounceMs) return [];
    this.last = now;

    const before = doc.getText(new vscode.Range(new vscode.Position(Math.max(0, pos.line - 5), 0), pos));
    const after = doc.getText(new vscode.Range(pos, new vscode.Position(Math.min(doc.lineCount - 1, pos.line + 2), 0)));
    const language = this.mapLanguage(doc.languageId);

    try {
      const { completion } = await apiClient.completeCode({
        text: before + after,
        language,
        context: { before, after, line: pos.line }
      });

      const text = (completion || "").trim();
      if (!text) return [];

      const item = new vscode.CompletionItem(text.split("\n")[0] || "RaaS Completion", vscode.CompletionItemKind.Snippet);
      item.insertText = new vscode.SnippetString(text);
      item.detail = "🤖 RaaS AI";
      item.sortText = "00000";
      item.preselect = true;
      return [item];
    } catch {
      return [];
    }
  }

  private mapLanguage(id: string) {
    const m: Record<string, string> = {
      python: "python", javascript: "javascript", typescript: "typescript",
      java: "java", cpp: "cpp", c: "c", go: "go", rust: "rust"
    };
    return m[id] || "python";
  }
}
