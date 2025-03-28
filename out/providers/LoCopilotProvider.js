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
const editorUtils_1 = __importDefault(require("../utils/editorUtils"));
const removeThink_1 = __importDefault(require("../utils/removeThink"));
const webviewContent_1 = __importDefault(require("../webviewContent"));
/**
 * Provider class for the LoCopilot VS Code extension.
 * Handles the webview, conversation history, and communication with Ollama.
 * @implements {vscode.WebviewViewProvider}
 */
class LoCopilotViewProvider {
    _extensionUri;
    /** The current webview instance */
    _view;
    /** History of messages in the current conversation */
    _conversationHistory;
    /** The current Ollama model being used */
    _currentModel;
    /** Reference to the active text editor */
    _editor;
    /**
     * Creates a new instance of LoCopilotViewProvider.
     * @param {vscode.Uri} _extensionUri - The URI of the extension directory
     */
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        this._conversationHistory = [
            {
                role: "system",
                content: "You are an AI Coding agent. You will help your user with code related tasks. The user's prompts may include some text that is currently selected by the user's mouse. If meaningful information can be extracted from the user's selected text and helps answer the user's prompt, then use it to help you answer the user's prompt. If no meaningful information can be extracted from the user selected text (typo or just random text) or the selected text is not related to the user's prompt, you may safely ignore the user's selected text and focus on answering the user's prompt. You might also be provided with the text contents of the file that the user is currently looking at, which you may use to give yourself more context and help you answer the user's prompt. If the file's text content and/or the selected code is unrelated to the user's prompt, you can just answer the user's prompt without considering additional context.",
            },
        ];
        this._currentModel = "deepseek-r1:8b";
        this._editor = vscode.window.activeTextEditor;
        vscode.window.onDidChangeActiveTextEditor(editor => {
            this._editor = editor;
        });
    }
    /**
     * Required method to implement the WebviewViewProvider interface.
     * Initializes the webview when it becomes visible in VS Code.
     * @param {vscode.WebviewView} webviewView - The webview view to configure
     * @param {vscode.WebviewViewResolveContext} _context - The context in which the view is being resolved
     * @param {vscode.CancellationToken} _token - A cancellation token
     */
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
                    console.log("LoCopilot model set to: " + message.modelName);
                    this._currentModel = message.modelName;
                }
            });
        }
        catch (error) {
            console.error("Error initializing webview:", error);
            vscode.window.showErrorMessage(`LoCopilot webview initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Updates the HTML content of the webview and initializes it with the conversation history.
     * @private
     */
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
            vscode.window.showErrorMessage(`LoCopilot failed to render content: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Clears the conversation history, keeping only the system prompt.
     * @private
     */
    _clearConversation() {
        // clear all messages except for the system prompt
        this._conversationHistory.length = 1;
        console.log("Chat history cleared");
    }
    /**
     * Checks if a specific Ollama model is installed.
     * @private
     * @param {string} modelName - The name of the model to check
     * @returns {Promise<boolean>} True if the model is installed, false otherwise
     */
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
    /**
     * Adds a new user message and a placeholder assistant message to the conversation history.
     * @private
     * @param {string} fullPrompt - The complete user prompt including any context
     */
    _buildNewChatResponse(fullPrompt) {
        // Add user message to conversation history
        this._conversationHistory.push({ role: "user", content: fullPrompt });
        // push a new assistance response to the conversation history, with a placeholder of "" since the response has yet to come in
        this._conversationHistory.push({
            role: "assistant",
            content: "",
        });
    }
    /**
     * Builds the complete prompt that will be sent to Ollama with all relevant context.
     * @private
     * @param {string} userPrompt - The text prompt that the user entered
     * @returns {string} The complete prompt with user input, selected text, and file content
     */
    _buildFullPrompt(userPrompt) {
        const { fileContent, selectedText } = (0, editorUtils_1.default)();
        let fullPrompt = `User prompt: ${userPrompt}`;
        if (fileContent.trim()) {
            fullPrompt += `\nText content of current file:\n${fileContent}`;
        }
        if (selectedText.trim()) {
            fullPrompt += `\nSelected text:\n${selectedText}`;
        }
        return fullPrompt;
    }
    /**
     * Streams the response from Ollama and updates the conversation history.
     * @private
     * @param {Message[]} messages - The current conversation history
     * @returns {Promise<Message[]>} The updated conversation history
     */
    async _streamOllamaResponse(messages) {
        let responseText = "";
        const streamResponse = await ollama_1.default.chat({
            model: this._currentModel,
            messages,
            stream: true,
        });
        for await (const part of streamResponse) {
            responseText += part.message.content;
            // Update UI
            this._view?.webview.postMessage({
                command: "chatResponse",
                text: responseText,
                messages: this._conversationHistory,
            });
        }
        // remove the thinking text from the assistant's response
        responseText = (0, removeThink_1.default)(responseText);
        // after Ollama finishes streaming in its response, we append the completed response to the conversation history
        if (messages.length > 2 && messages[messages.length - 1].role === "assistant") {
            messages[messages.length - 1].content = responseText;
        }
        else {
            console.error("Error: Error appending Ollama response to conversation history");
        }
        return messages;
    }
    /**
     * Handles user prompts sent from the webview, processes them, and sends them to Ollama.
     * @private
     * @param {string} userPrompt - The text prompt submitted by the user
     */
    async _handleUserPrompt(userPrompt) {
        if (!this._view) {
            console.error("Cannot handle prompt - view is undefined");
            return;
        }
        console.log("Received user prompt: " + userPrompt);
        const fullPrompt = this._buildFullPrompt(userPrompt);
        try {
            // initialize the start of a new round of conversation between the user and Ollama
            this._buildNewChatResponse(fullPrompt);
            try {
                // call Ollama with the user prompt and stream in the response
                this._conversationHistory = await this._streamOllamaResponse(this._conversationHistory);
                // turn the full prompt back to the original user prompt to reduce conversation size.
                this._conversationHistory[this._conversationHistory.length - 2].content = userPrompt;
                console.log("Finished streaming response from: " + this._currentModel);
                // Set the status as completed
                this._view.webview.postMessage({
                    command: "chatCompletion",
                    text: this._conversationHistory[this._conversationHistory.length - 1].content,
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
                    // append the error message in place of Ollama's response
                    if (this._conversationHistory.length > 1) {
                        this._conversationHistory[this._conversationHistory.length - 1].content = errorMessage;
                    }
                    this._view.webview.postMessage({
                        command: "chatCompletion",
                        text: this._conversationHistory[this._conversationHistory.length - 1].content,
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
            vscode.window.showErrorMessage("LoCopilot error: " +
                (error instanceof Error ? error.message : String(error)));
        }
    }
}
exports.default = LoCopilotViewProvider;
//# sourceMappingURL=LoCopilotProvider.js.map