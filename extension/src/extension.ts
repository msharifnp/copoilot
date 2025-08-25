import * as vscode from "vscode";
import { RaasChatViewProvider } from "./chat/chatViewProviders";
import { RaaSCompletionProvider } from "./completion/completionProvider";
import { RaaSInlineCompletionProvider } from "./completion/inlineProvider";
export function activate(ctx: vscode.ExtensionContext) {
  console.log("[RaaS] activate()");
  const chatProvider = new RaasChatViewProvider(ctx.extensionUri);
  const completionProvider = new RaaSCompletionProvider();

  const langs = ["python","javascript","typescript","java","cpp","c","go","rust"];

  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider("raasChatView", chatProvider),
    vscode.languages.registerCompletionItemProvider(langs, completionProvider, ".", " ", "\n", "\t"),
    vscode.commands.registerCommand("raas.openChat", () => vscode.commands.executeCommand("workbench.view.extension.raasChat")),
    vscode.languages.registerInlineCompletionItemProvider([{language: "python"}, {language: "javascript"}, {language: "typescript"}, {language: "java" }, {language: "cpp"}, {language: "c"}],
    new RaaSInlineCompletionProvider()  
    )
  );
}

export function deactivate() {}

// import * as vscode from "vscode";
// import { RaasChatViewProvider } from "./chat/chatViewProviders";

// export function activate(ctx: vscode.ExtensionContext) {
//   console.log("[RaaS] activate() - TESTING");
  
//   try {
//     const chatProvider = new RaasChatViewProvider(ctx.extensionUri);
//     console.log("[RaaS] ChatProvider created successfully");
    
//     const disposable = vscode.window.registerWebviewViewProvider("raasChatView", chatProvider);
//     console.log("[RaaS] WebviewViewProvider registered");
    
//     ctx.subscriptions.push(disposable);
//     console.log("[RaaS] Extension fully activated");
    
//   } catch (error) {
//     console.error("[RaaS] Activation failed:", error);
//   }
// }

// export function deactivate() {
//   console.log("[RaaS] deactivate()");
// }