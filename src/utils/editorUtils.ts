import * as vscode from "vscode";

// Returns the text that is currently selected by the user's cursor
export function getCurrentFileContent(): string {
  const editor = vscode.window.activeTextEditor;
  return editor ? editor.document.getText() : "";
}

// returns the entire text content of the file displayed in the current VS Code window
export function getSelectedText(): string {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const selection = editor.selection;
    return selection.isEmpty ? "" : editor.document.getText(selection);
  }
  return "";
}
