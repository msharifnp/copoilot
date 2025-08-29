// import * as vscode from "vscode";
// import { RaasChatViewProvider } from "./chat/chatViewProviders";
// import { RaaSCompletionProvider } from "./completion/completionProvider";
// import { RaaSInlineCompletionProvider } from "./completion/inlineProvider";

// export function activate(context: vscode.ExtensionContext) {
//   console.log("[RaaS] Extension activating...");

//   // Register chat view provider
//   const chatProvider = new RaasChatViewProvider(context.extensionUri);
//   context.subscriptions.push(
//     vscode.window.registerWebviewViewProvider("raasChatView", chatProvider, {
//       webviewOptions: {
//         retainContextWhenHidden: true
//       }
//     })
//   );

//   // Register commands
//   context.subscriptions.push(
//     vscode.commands.registerCommand("raas.openChat", () => {
//       vscode.commands.executeCommand("workbench.view.extension.raasChat");
//     })
//   );

//   // Register completion providers with better language support
//   const supportedLanguages = [
//     "python", "javascript", "typescript", "java", "cpp", "c", 
//     "csharp", "go", "rust", "php", "ruby", "swift", "kotlin",
//     "sql", "html", "css", "dart", "scala"
//   ];

//   // Standard completion provider (Ctrl+Space)
//   context.subscriptions.push(
//     vscode.languages.registerCompletionItemProvider(
//       supportedLanguages.map(lang => ({ language: lang })),
//       new RaaSCompletionProvider(),
//       ".", " ", "\n", "\t", "(", "[", "{"
//     )
//   );

//   // Inline completion provider (ghost text)
//   context.subscriptions.push(
//     vscode.languages.registerInlineCompletionItemProvider(
//       supportedLanguages.map(lang => ({ language: lang })),
//       new RaaSInlineCompletionProvider()
//     )
//   );

//   console.log("[RaaS] Extension activated successfully!");
// }

// export function deactivate() {
//   console.log("[RaaS] Extension deactivated");
// }




import * as vscode from "vscode";
import { RaasChatViewProvider } from "./chat/chatViewProviders";
import { RaaSCompletionProvider } from "./completion/completionProvider";
import { RaaSInlineCompletionProvider } from "./completion/inlineProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log("[RaaS] Extension activating…");

  // ---- Chat webview
  const chatProvider = new RaasChatViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("raasChatView", chatProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // ---- Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("raas.openChat", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.raasChat");
    })
  );

  // ---- Languages to support
  const langs = [
    // core
    "python", "javascript", "typescript", "java", "cpp", "c",
    "csharp", "go", "rust", "php", "ruby", "swift", "kotlin",
    "sql", "html", "css", "dart", "scala",
    // extras that VS Code often uses
    "json", "yaml", "markdown", "plaintext",
    "shellscript", "powershell",
    "javascriptreact", "typescriptreact"
  ];

  // Use schemes so untitled/new files get completions too
  const selector: vscode.DocumentSelector = [
    ...langs.map(l => ({ language: l, scheme: "file" as const })),
    ...langs.map(l => ({ language: l, scheme: "untitled" as const }))
  ];

  // ---- Trigger characters (standard completion)
  const triggers = [".", " ", "=", ":", "(", "[", "{", ",", "'", "\"", ">", "<", "/"];

  // ---- Register providers
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector,
      new RaaSCompletionProvider(),
      ...triggers
    )
  );

  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      selector,
      new RaaSInlineCompletionProvider()
    )
  );

  console.log("[RaaS] Extension activated successfully!");
}

export function deactivate() {
  console.log("[RaaS] Extension deactivated");
}
