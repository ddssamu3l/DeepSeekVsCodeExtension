import * as vscode from "vscode";
import LoCopilotViewProvider from "./providers/LoCopilotProvider";

// Maintain a reference to the provider for disposal
let locopilotProvider: LoCopilotViewProvider | undefined;

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
    locopilotProvider = new LoCopilotViewProvider(context.extensionUri);
    
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
    
    /**
     * Command that refreshes the workspace map used for context.
     * This is registered as 'locopilot-ext.refreshWorkspaceMap' and can be triggered from the command palette.
     */
    const refreshMapCommand = vscode.commands.registerCommand('locopilot-ext.refreshWorkspaceMap', async () => {
      try {
        if (locopilotProvider) {
          await locopilotProvider.refreshWorkspaceMap();
          vscode.window.showInformationMessage('LoCopilot: Workspace map refreshed successfully.');
        } else {
          vscode.window.showErrorMessage('LoCopilot provider not initialized.');
        }
      } catch (err) {
        console.error("Error refreshing workspace map:", err);
        vscode.window.showErrorMessage(`Failed to refresh workspace map: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
    context.subscriptions.push(refreshMapCommand);
    
    // Register the provider
    const disposable = vscode.window.registerWebviewViewProvider(
      viewType,
      locopilotProvider,
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
 * Properly disposes of resources, particularly the file watcher.
 * 
 * @function deactivate
 */
export function deactivate() {
  if (locopilotProvider) {
    console.log("LoCopilot Extension: Disposing provider resources");
    locopilotProvider.dispose();
    locopilotProvider = undefined;
  }
}
