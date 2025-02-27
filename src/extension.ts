import * as vscode from "vscode";
import DeepSeekViewProvider from "./providers/DeepSeekProvider";

// This is the main entry point for your extension
export function activate(context: vscode.ExtensionContext) {
  console.log("DeepSeek Extension: Activation started");
  
  try {
    // Create the WebviewViewProvider
    const provider = new DeepSeekViewProvider(context.extensionUri);
    
    // Register commands
    const viewType = "deepseek-ext.view"; // Must match the ID in package.json
    
    // Command to open the view
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

// This method is called when the extension is deactivated
export function deactivate() {}
