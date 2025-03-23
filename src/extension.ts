import * as vscode from "vscode";
import DeepSeekViewProvider from "./providers/DeepSeekProvider";

/**
 * Main entry point for the DeepSeek VS Code extension.
 * This function is called when the extension is activated.
 * It sets up the webview provider and registers necessary commands.
 * 
 * @function activate
 * @param {vscode.ExtensionContext} context - The context in which the extension runs
 */
export function activate(context: vscode.ExtensionContext) {
  console.log("DeepSeek Extension: Activation started");
  
  try {
    // Create the WebviewViewProvider
    const provider = new DeepSeekViewProvider(context.extensionUri);
    
    // Register commands
    const viewType = "deepseek-ext.view";
    
    /**
     * Command that opens the DeepSeek panel in the VS Code sidebar.
     * This is registered as 'deepseek-ext.openView' and can be triggered from the command palette.
     */
    const openViewCommand = vscode.commands.registerCommand('deepseek-ext.openView', async () => {
      try {
        await vscode.commands.executeCommand('workbench.view.extension.deepseek-ext');
      } catch (err) {
        console.error("Error opening DeepSeek view:", err);
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
    console.log("DeepSeek Extension: Successfully activated");
    
  } catch (error) {
    // Log any errors during activation
    console.error("DeepSeek Extension: Error during activation", error);
    vscode.window.showErrorMessage(`DeepSeek Extension activation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Cleanup function called when the extension is deactivated.
 * Currently doesn't need to perform any cleanup actions.
 * 
 * @function deactivate
 */
export function deactivate() {}
