import * as vscode from "vscode";
import { apiClient } from "../apiClient";
import { config } from "../config";

export class RaaSCompletionProvider implements vscode.CompletionItemProvider {
  private lastRequest = 0;

  async provideCompletionItems(
    document: vscode.TextDocument, 
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[]> {
    
    // Debounce
    const now = Date.now();
    if (now - this.lastRequest < config.debounceMs) {
      return [];
    }
    this.lastRequest = now;

    // Check if request was cancelled
    if (token.isCancellationRequested) {
      return [];
    }

    try {
      // Get surrounding context (more context for better completions)
      const beforeRange = new vscode.Range(
        new vscode.Position(Math.max(0, position.line - 10), 0), 
        position
      );
      const afterRange = new vscode.Range(
        position, 
        new vscode.Position(Math.min(document.lineCount - 1, position.line + 5), 0)
      );

      const beforeText = document.getText(beforeRange);
      const afterText = document.getText(afterRange);
      const fullText = beforeText + afterText;

      console.log(`[RaaS Completion] Language: ${document.languageId}, Position: ${position.line}:${position.character}`);

      // Call completion API with proper payload
      const response = await apiClient.completeCode({
        text: fullText,
        language: document.languageId,
        context: {
          before: beforeText,
          after: afterText,
          line: position.line,
          mode: "completion" // Indicate this is standard completion
        },
        user_id: "sharif_111", // Add user_id if required by your API
        file_path: document.uri.fsPath // Add file path for project context
      });

      const completionText = (response.completion || "").trim();
      
      if (!completionText) {
        console.log('[RaaS Completion] No completion returned from API');
        return [];
      }

      console.log(`[RaaS Completion] Got completion: ${completionText.slice(0, 50)}...`);

      // Create completion item
      const firstLine = completionText.split('\n')[0] || "RaaS Suggestion";
      const item = new vscode.CompletionItem(firstLine, vscode.CompletionItemKind.Snippet);
      
      item.insertText = new vscode.SnippetString(completionText);
      item.detail = "🤖 RaaS AI Completion";
      item.documentation = new vscode.MarkdownString(`AI-generated code completion\n\nLanguage: ${document.languageId}`);
      item.sortText = "00000"; // High priority
      item.preselect = true;
      item.command = {
        command: 'editor.action.triggerSuggest',
        title: 'Re-trigger completions'
      };

      return [item];

    } catch (error) {
      console.error(`[RaaS Completion] Error:`, error);
      // Return empty array instead of throwing
      return [];
    }
  }
}

