import * as vscode from "vscode";
import LoCopilotViewProvider from "./providers/LoCopilotProvider";

/**
 * Main entry point for the LoCopilot VS Code extension.
 * This function is called when the extension is activated.
 * It sets up the webview provider and registers necessary commands.
 * 
 * @function activate
 * @param {vscode.ExtensionContext} context - The context in which the extension runs
 */
export function activate(context: vscode.ExtensionContext) {
  console.log("LoCopilot Extension: Activation started");
  
  try {
    // Create the WebviewViewProvider
    const provider = new LoCopilotViewProvider(context.extensionUri);
    
    // Register commands
    const viewType = "locopilot-ext.view";
    
    /**
     * Command that opens the LoCopilot panel in the VS Code sidebar.
     * This is registered as 'locopilot-ext.openView' and can be triggered from the command palette.
     */
    const openViewCommand = vscode.commands.registerCommand('locopilot-ext.openView', async () => {
      try {
        await vscode.commands.executeCommand('workbench.view.extension.locopilot-ext');
      } catch (err) {
        console.error("Error opening LoCopilot view:", err);
      }
    });
    context.subscriptions.push(openViewCommand);
    
    // Register the provider
    const disposable = vscode.window.registerWebviewViewProvider(
      viewType,
      provider,
      {
        webviewOptions: { 
          retainContextWhenHidden: true
        }
      }
    );
    
    context.subscriptions.push(disposable);
    console.log("LoCopilot Extension: Successfully activated");
    
  } catch (error) {
    // Log any errors during activation
    console.error("LoCopilot Extension: Error during activation", error);
    vscode.window.showErrorMessage(`LoCopilot Extension activation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Cleanup function called when the extension is deactivated.
 * Currently doesn't need to perform any cleanup actions.
 * 
 * @function deactivate
 */
export function deactivate() {}
