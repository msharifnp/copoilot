import * as vscode from "vscode";

export const config = {
  get endpoint(): string {
    const raw = vscode.workspace.getConfiguration("raas").get<string>("serverUrl", "http://localhost:8000/api/v1");
    return raw.replace(/\/+$/, ""); // strip trailing slash
  },
  get timeout(): number {
    return vscode.workspace.getConfiguration("raas").get<number>("timeout", 10000);
  },
  get debounceMs(): number {
    return vscode.workspace.getConfiguration("raas").get<number>("debounceMs", 300);
  }
};
