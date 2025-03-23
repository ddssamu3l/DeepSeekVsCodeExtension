import * as vscode from "vscode";

/**
 * Retrieves text context from the active editor.
 * @function getFileContext
 * @returns {Object} An object containing the active file's content and any selected text
 * @returns {string} fileContent - The full text content of the current file
 * @returns {string} selectedText - The text currently selected by the user
 */
export default function getFileContext(): { fileContent: string; selectedText: string } {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return { fileContent: "", selectedText: "" };
  }
  const fileContent = editor.document.getText();
  const selection = editor.selection;
  const selectedText = selection.isEmpty ? "" : editor.document.getText(selection);
  return { fileContent, selectedText };
}

