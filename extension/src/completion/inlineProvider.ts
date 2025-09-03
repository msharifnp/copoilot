import * as vscode from "vscode";
import { apiClient } from "../apiClient";
import { config } from "../config";

export class RaaSInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  private lastRequest = 0;
  private readonly minTriggerLength = 3; // Don't suggest on very short input

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList> {
    
    // Debounce
    const now = Date.now();
    if (now - this.lastRequest < config.debounceMs) {
      return { items: [] };
    }
    this.lastRequest = now;

    // Check cancellation
    if (token.isCancellationRequested) {
      return { items: [] };
    }

    // Don't trigger on very short content or empty lines
    const currentLine = document.lineAt(position.line).text;
    const beforeCursor = currentLine.substring(0, position.character);
    
    if (beforeCursor.trim().length < this.minTriggerLength) {
      return { items: [] };
    }

    try {
      // Get more context for inline completions
      const beforeRange = new vscode.Range(
        new vscode.Position(Math.max(0, position.line - 15), 0),
        position
      );
      const afterRange = new vscode.Range(
        position,
        new vscode.Position(Math.min(document.lineCount - 1, position.line + 3), 0)
      );

      const beforeText = document.getText(beforeRange);
      const afterText = document.getText(afterRange);
      const fullText = beforeText + afterText;

      console.log(`[RaaS Inline] Language: ${document.languageId}, Trigger: "${beforeCursor.slice(-10)}"`);

      // Call completion API
      const response = await apiClient.completeCode({
        text: fullText,
        language: document.languageId,
        context: {
          before: beforeText,
          after: afterText,
          line: position.line,
          mode: "inline" // Indicate this is inline completion
        },
        user_id: "sharif_111",
        file_path: document.uri.fsPath
      });

      const completionText = (response.completion || "").trim();
      
      if (!completionText) {
        console.log('[RaaS Inline] No completion returned from API');
        return { items: [] };
      }

      console.log(`[RaaS Inline] Got completion: ${completionText.slice(0, 50)}...`);

      // Create inline completion item
      const item = new vscode.InlineCompletionItem(
        completionText,
        new vscode.Range(position, position)
      );

      return { items: [item] };

    } catch (error) {
      console.error(`[RaaS Inline] Error:`, error);
      return { items: [] };
    }
  }
}