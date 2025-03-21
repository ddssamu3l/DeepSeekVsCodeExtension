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
    _conversationHistory = [];
    _currentModel = "deepseek-r1:14b"; // default model
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
                else if (message.command === "clearConversation") {
                    this._clearConversation();
                }
                else if (message.command === "debug") {
                    // Allow webview to send debug messages
                    console.log("DEBUG from webview:", message.text);
                }
                else if (message.command === "checkModelInstalled") {
                    await this._checkModelInstalled(message.modelName);
                }
                else if (message.command === "setModel") {
                    console.log("DeepSeek model set to: " + message.modelName);
                    this._currentModel = message.modelName;
                }
            });
            // set the system prompt to prepare the DeepSeek agent
            this._conversationHistory.push({ role: "system", content: "You are an agent that exists in a VsCode extension where there is a chat interface that the user can communicate to you with." });
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
            // After a short delay, send conversation history if available
            setTimeout(() => {
                if (this._view && this._conversationHistory.length > 0) {
                    this._view.webview.postMessage({
                        command: "loadConversation",
                        messages: this._conversationHistory
                    });
                }
            }, 300);
        }
        catch (error) {
            console.error("Error setting webview HTML:", error);
            vscode.window.showErrorMessage(`DeepSeek failed to render content: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // Clear the conversation history
    _clearConversation() {
        // clear all messages except for the system prompt
        this._conversationHistory.length = 1;
        console.log("Chat history cleared");
    }
    // Check if a model is installed with Ollama
    async _checkModelInstalled(modelName) {
        if (!this._view) {
            console.error("Cannot check model - view is undefined");
            return;
        }
        try {
            try {
                // Try to get the model info - if it succeeds, the model is installed
                await ollama_1.default.show({ model: modelName });
                // If successful, the model is installed
                this._view.webview.postMessage({
                    command: "modelInstalledResult",
                    isInstalled: true
                });
                return true;
            }
            catch (error) {
                // If there's an error, the model is not installed
                console.log(`Model ${modelName} is not installed`);
                this._view.webview.postMessage({
                    command: "modelInstalledResult",
                    isInstalled: false
                });
                return false;
            }
        }
        catch (error) {
            console.error("Error checking model status:", error);
            this._view.webview.postMessage({
                command: "modelInstalledResult",
                isInstalled: false
            });
            return false;
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
            // Add user message to conversation history
            this._conversationHistory.push({ role: "user", content: userPrompt });
            // push a new assistance response to the conversation history, with a placeholder of "" since the resopsne has yet to come in
            this._conversationHistory.push({
                role: "assistant",
                content: "",
            });
            // For immediate feedback while Ollama loads
            this._view.webview.postMessage({
                command: "chatResponse",
                text: "Processing your request with DeepSeek R1...",
                messages: this._conversationHistory,
            });
            try {
                // Call Ollama with the full conversation history and selected model
                console.log(`Calling Ollama API with model ${this._currentModel}`);
                const streamResponse = await ollama_1.default.chat({
                    model: this._currentModel,
                    messages: this._conversationHistory,
                    stream: true,
                });
                // Reset the response text for the current assistant message
                responseText = "";
                const newMsgIndex = this._conversationHistory.length - 1;
                // Stream each chunk if the new resonse to the webview
                for await (const part of streamResponse) {
                    responseText += part.message.content;
                    // Add the current (incomplete) assistant message
                    this._conversationHistory[newMsgIndex].content = responseText;
                    if (this._view) {
                        this._view.webview.postMessage({
                            command: "chatResponse",
                            text: responseText,
                            messages: this._conversationHistory,
                        });
                    }
                }
                console.log("Finished streaming response from Ollama");
                // Set the status as completed
                this._view.webview.postMessage({
                    command: "chatCompletion",
                    messages: this._conversationHistory,
                });
            }
            catch (ollamaError) {
                // If we can't connect to Ollama, send an error response
                console.error("Error with Ollama:", ollamaError);
                if (this._view) {
                    const errorMessage = "Error connecting to Ollama: " +
                        (ollamaError instanceof Error
                            ? ollamaError.message
                            : String(ollamaError));
                    // Add error message to conversation history
                    this._conversationHistory.push({
                        role: "assistant",
                        content: errorMessage,
                    });
                    this._view.webview.postMessage({
                        command: "chatResponse",
                        text: errorMessage,
                        messages: this._conversationHistory,
                    });
                }
                // Re-throw for outer catch
                throw ollamaError;
            }
        }
        catch (error) {
            console.error("Error in handleUserPrompt:", error);
            if (this._view) {
                const errorMessage = "Error: " +
                    (error instanceof Error ? error.message : String(error));
                this._view.webview.postMessage({
                    command: "chatResponse",
                    text: errorMessage
                });
            }
            vscode.window.showErrorMessage("DeepSeek error: " +
                (error instanceof Error ? error.message : String(error)));
        }
    }
}
exports.default = DeepSeekViewProvider;
//# sourceMappingURL=DeepSeekProvider.js.map