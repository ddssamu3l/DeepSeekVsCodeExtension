"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const DeepSeekProvider_1 = __importDefault(require("./providers/DeepSeekProvider"));
/**
 * Main entry point for the DeepSeek VS Code extension.
 * This function is called when the extension is activated.
 * It sets up the webview provider and registers necessary commands.
 *
 * @function activate
 * @param {vscode.ExtensionContext} context - The context in which the extension runs
 */
function activate(context) {
    console.log("DeepSeek Extension: Activation started");
    try {
        // Create the WebviewViewProvider
        const provider = new DeepSeekProvider_1.default(context.extensionUri);
        // Register commands
        const viewType = "deepseek-ext.view";
        /**
         * Command that opens the DeepSeek panel in the VS Code sidebar.
         * This is registered as 'deepseek-ext.openView' and can be triggered from the command palette.
         */
        const openViewCommand = vscode.commands.registerCommand('deepseek-ext.openView', async () => {
            try {
                await vscode.commands.executeCommand('workbench.view.extension.deepseek-ext');
            }
            catch (err) {
                console.error("Error opening DeepSeek view:", err);
            }
        });
        context.subscriptions.push(openViewCommand);
        // Register the provider
        const disposable = vscode.window.registerWebviewViewProvider(viewType, provider, {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        });
        context.subscriptions.push(disposable);
        console.log("DeepSeek Extension: Successfully activated");
    }
    catch (error) {
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
function deactivate() { }
//# sourceMappingURL=extension.js.map