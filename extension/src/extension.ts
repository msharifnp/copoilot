import * as vscode from "vscode";
import { RaasChatViewProvider } from "./chat/chatViewProviders";
import { RaaSCompletionProvider } from "./completion/completionProvider";
import { RaaSInlineCompletionProvider } from "./completion/inlineProvider";

export function activate(ctx: vscode.ExtensionContext) {
  console.log("[RaaS] activate()");

  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider("raasChatView", new RaasChatViewProvider(ctx.extensionUri)),
    vscode.commands.registerCommand("raas.openChat", () =>
      vscode.commands.executeCommand("workbench.view.extension.raasChat")
    ),

    // Completions (menu)
    vscode.languages.registerCompletionItemProvider(
      [
        { language: "python" }, { language: "javascript" }, { language: "typescript" },
        { language: "java" }, { language: "cpp" }, { language: "c" }
      ],
      new RaaSCompletionProvider(),
      ".", " ", "\n", "\t"
    ),

    // Inline (ghost text)
    vscode.languages.registerInlineCompletionItemProvider(
      [
        { language: "python" }, { language: "javascript" }, { language: "typescript" },
        { language: "java" }, { language: "cpp" }, { language: "c" }
      ],
      new RaaSInlineCompletionProvider()
    )
  );
}

export function deactivate() {}
