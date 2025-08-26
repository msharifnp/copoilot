import * as vscode from "vscode";

function cleanBase(u: string) { return u.replace(/\/+$/, ""); }
function cleanPath(p: string)  { return p.startsWith("/") ? p : `/${p}`; }

export const config = {
  get endpoint(): string {
    const base = vscode.workspace.getConfiguration("raas")
      .get<string>("serverUrl", "http://localhost:8000");
    return cleanBase(base);
  },
  get chatPath(): string {
    return vscode.workspace.getConfiguration("raas")
      .get<string>("chatPath", "/api/v1/chat/form");
  },
  get completionPath(): string {
    return vscode.workspace.getConfiguration("raas")
      .get<string>("completionPath", "/api/v1/code-completion");
  },
  get timeout(): number {
    return vscode.workspace.getConfiguration("raas")
      .get<number>("timeout", 100000);
  },
  get debounceMs(): number {
    return vscode.workspace.getConfiguration("raas")
      .get<number>("debounceMs", 300);
  },

  /** Returns a full URL for either a relative path or an absolute override */
  toUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl; // absolute override
    return this.endpoint + cleanPath(pathOrUrl);           // join to base
  }
};
