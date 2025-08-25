import * as vscode from "vscode";
import { apiClient } from "../apiClient";
import { config } from "../config";

export class RaaSInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  private last = 0;

  async provideInlineCompletionItems(
    doc: vscode.TextDocument,
    pos: vscode.Position
  ): Promise<vscode.InlineCompletionList> {
    const now = Date.now();
    if (now - this.last < config.debounceMs) return { items: [] };
    this.last = now;

    const before = doc.getText(new vscode.Range(new vscode.Position(Math.max(0, pos.line - 5), 0), pos));
    const after = doc.getText(new vscode.Range(pos, new vscode.Position(Math.min(doc.lineCount - 1, pos.line + 2), 0)));

    try {
      const { completion } = await apiClient.completeCode({
        text: before + after,
        language: doc.languageId,
        context: { before, after, line: pos.line, mode: "inline" }
      });

      const text = (completion || "").trim();
      if (!text) return { items: [] };

      const item = new vscode.InlineCompletionItem(text, new vscode.Range(pos, pos));
      return { items: [item] };
    } catch {
      return { items: [] };
    }
  }
}
