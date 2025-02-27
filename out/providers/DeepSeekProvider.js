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
const vscode = __importStar(require("vscode"));
const ollama_1 = __importDefault(require("ollama"));
const webviewContent_1 = __importDefault(require("../webviewContent"));
// A class that provides the webview for the sidebar
class DeepSeekViewProvider {
    _extensionUri;
    _view;
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    // Called by VS Code when the view should be displayed
    resolveWebviewView(webviewView, _context, _token) {
        try {
            // Store the webview instance
            this._view = webviewView;
            // Configure webview settings
            this._view.webview.options = {
                enableScripts: true,
                localResourceRoots: [this._extensionUri],
            };
            // Set the webview content
            this._updateWebview();
            // Handle messages from the webview
            this._view.webview.onDidReceiveMessage(async (message) => {
                if (message.command === "userPrompt") {
                    await this._handleUserPrompt(message.text);
                }
                else if (message.command === "debug") {
                    // Allow webview to send debug messages
                    console.log("DEBUG from webview:", message.text);
                }
            });
        }
        catch (error) {
            console.error("Error initializing webview:", error);
            vscode.window.showErrorMessage(`DeepSeek webview initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // Update the webview content
    _updateWebview() {
        if (!this._view) {
            console.error("Cannot update webview - view is undefined");
            return;
        }
        try {
            const htmlContent = (0, webviewContent_1.default)();
            this._view.webview.html = htmlContent;
        }
        catch (error) {
            console.error("Error setting webview HTML:", error);
            vscode.window.showErrorMessage(`DeepSeek failed to render content: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // Handle user prompts sent from the webview
    async _handleUserPrompt(userPrompt) {
        if (!this._view) {
            console.error("Cannot handle prompt - view is undefined");
            return;
        }
        let responseText = "";
        console.log("Received user prompt: " + userPrompt);
        try {
            // For immediate feedback while Ollama loads
            this._view.webview.postMessage({
                command: "chatResponse",
                text: "Processing your request with DeepSeek R1...",
            });
            try {
                // Call Ollama with the user's prompt
                console.log("Calling Ollama API with prompt");
                const streamResponse = await ollama_1.default.chat({
                    model: "deepseek-r1:32b",
                    messages: [{ role: "user", content: userPrompt }],
                    stream: true,
                });
                // Stream each chunk to the webview
                for await (const part of streamResponse) {
                    responseText += part.message.content;
                    if (this._view) {
                        this._view.webview.postMessage({
                            command: "chatResponse",
                            text: responseText,
                        });
                    }
                }
                console.log("Finished streaming response from Ollama");
            }
            catch (ollamaError) {
                // If we can't connect to Ollama, send an error response
                console.error("Error with Ollama:", ollamaError);
                if (this._view) {
                    const mockResponse = "Error connecting to Ollama: " +
                        (ollamaError instanceof Error
                            ? ollamaError.message
                            : String(ollamaError));
                    this._view.webview.postMessage({
                        command: "chatResponse",
                        text: mockResponse,
                    });
                }
                // Re-throw for outer catch
                throw ollamaError;
            }
        }
        catch (error) {
            console.error("Error in handleUserPrompt:", error);
            if (this._view) {
                this._view.webview.postMessage({
                    command: "chatResponse",
                    text: "Error: " +
                        (error instanceof Error ? error.message : String(error)),
                });
            }
            vscode.window.showErrorMessage("DeepSeek error: " +
                (error instanceof Error ? error.message : String(error)));
        }
    }
}
exports.default = DeepSeekViewProvider;
//# sourceMappingURL=DeepSeekProvider.js.map