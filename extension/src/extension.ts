import * as vscode from "vscode";
import { RaasChatViewProvider } from "./chat/chatViewProviders";
import { RaaSCompletionProvider } from "./completion/completionProvider";
import { RaaSInlineCompletionProvider } from "./completion/inlineProvider";
import { apiClient } from "./apiClient";

export function activate(context: vscode.ExtensionContext) {
  console.log("[RaaS] Extension activating...");

  // ---- Chat webview
  const chatProvider = new RaasChatViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("raasChatView", chatProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // ---- Languages to support
  const langs = [
    "python", "javascript", "typescript", "java", "cpp", "c",
    "csharp", "go", "rust", "php", "ruby", "swift", "kotlin",
    "sql", "html", "css", "dart", "scala",
    "json", "yaml", "markdown", "plaintext",
    "shellscript", "powershell",
    "javascriptreact", "typescriptreact"
  ];

  const selector: vscode.DocumentSelector = [
    ...langs.map(l => ({ language: l, scheme: "file" as const })),
    ...langs.map(l => ({ language: l, scheme: "untitled" as const }))
  ];

  // ---- Trigger characters
  const triggers = [".", " ", "=", ":", "(", "[", "{", ",", "'", "\"", ">", "<", "/"];

  // ---- Register providers
  const completionProvider = new RaaSCompletionProvider();
  const inlineProvider = new RaaSInlineCompletionProvider();

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector,
      completionProvider,
      ...triggers
    )
  );

  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      selector,
      inlineProvider
    )
  );

  // ---- Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("raas.openChat", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.raasChat");
    })
  );

  // Debug command to test completion endpoint
  context.subscriptions.push(
    vscode.commands.registerCommand("raas.testCompletion", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor found");
        return;
      }

      try {
        vscode.window.showInformationMessage("Testing completion endpoint...");

        // In your VS Code extension, send more context:
        const document = editor.document;
        const position = editor.selection.active;

        // --- Expanded context (fix: use offsetAt)
        const fullText = document.getText();
        const offset = document.offsetAt(position);
        const beforeText = fullText.slice(0, offset);
        const afterText  = fullText.slice(offset);
        
        // const document = editor.document;
        // const position = editor.selection.active;
        
        // // Get some context
        // const beforeText = document.getText(new vscode.Range(
        //   new vscode.Position(Math.max(0, position.line - 5), 0), 
        //   position
        // ));
        
        console.log(`[RaaS Debug] Testing completion for language: ${document.languageId}`);
        
        const response = await apiClient.completeCode({
          text: beforeText + "\n# Complete this code",
          language: document.languageId,
          context: {
            before: beforeText,
            after: afterText,
            line: position.line,
            mode: "test"
          },
          user_id: "sharif_111",
          file_path: document.uri.fsPath
        });

        if (response.completion) {
          vscode.window.showInformationMessage(
            `Completion successful! Length: ${response.completion.length}`
          );
          console.log(`[RaaS Debug] Completion result:`, response.completion);
        } else {
          vscode.window.showWarningMessage("No completion returned from API");
        }

      } catch (error: any) {
        console.error("[RaaS Debug] Test completion failed:", error);
        vscode.window.showErrorMessage(`Completion test failed: ${error.message}`);
      }
    })
  );

  // Command to check API health
  context.subscriptions.push(
    vscode.commands.registerCommand("raas.checkHealth", async () => {
      try {
        const isHealthy = await apiClient.checkHealth();
        if (isHealthy) {
          vscode.window.showInformationMessage("RaaS API is healthy!");
        } else {
          vscode.window.showErrorMessage("RaaS API health check failed");
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Health check error: ${error.message}`);
      }
    })
  );

  console.log("[RaaS] Extension activated successfully!");
}

export function deactivate() {
  console.log("[RaaS] Extension deactivated");
}