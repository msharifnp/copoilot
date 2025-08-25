import * as vscode from "vscode";
import * as path from "path";
import { UploadFilePart } from "../apiClient";

export async function pickAndReadFiles(): Promise<UploadFilePart[] | undefined> {
  const uris = await vscode.window.showOpenDialog({ canSelectMany: true, title: "Select files to upload" });
  if (!uris?.length) return;
  const parts: UploadFilePart[] = [];
  for (const uri of uris) {
    const u8 = await vscode.workspace.fs.readFile(uri);
    parts.push({ name: path.basename(uri.fsPath || "file"), type: "application/octet-stream", data: Buffer.from(u8) });
  }
  return parts;
}
