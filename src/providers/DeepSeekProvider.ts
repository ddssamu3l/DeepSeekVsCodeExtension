import * as vscode from "vscode";
import ollama from "ollama";

import getWebviewContent from "../webviewContent";

// Define message types for conversation
interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

// A class that provides the webview for the sidebar
export default class DeepSeekViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _conversationHistory: Message[] = [];

  constructor(private readonly _extensionUri: vscode.Uri) {}

  // Called by VS Code when the view should be displayed
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
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
      this._view.webview.onDidReceiveMessage(async (message: any) => {
        if (message.command === "userPrompt") {
          await this._handleUserPrompt(message.text);
        } else if (message.command === "clearConversation") {
          this._clearConversation();
        } else if (message.command === "debug") {
          // Allow webview to send debug messages
          console.log("DEBUG from webview:", message.text);
        }
      });
    } catch (error) {
      console.error("Error initializing webview:", error);
      vscode.window.showErrorMessage(
        `DeepSeek webview initialization failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Update the webview content
  private _updateWebview() {
    if (!this._view) {
      console.error("Cannot update webview - view is undefined");
      return;
    }

    try {
      const htmlContent = getWebviewContent();
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
    } catch (error) {
      console.error("Error setting webview HTML:", error);
      vscode.window.showErrorMessage(
        `DeepSeek failed to render content: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Clear the conversation history
  private _clearConversation() {
    this._conversationHistory = [];
    
    if (this._view) {
      this._view.webview.postMessage({
        command: "clearConversation"
      });
    }
  }

  // Handle user prompts sent from the webview
  private async _handleUserPrompt(userPrompt: string) {
    if (!this._view) {
      console.error("Cannot handle prompt - view is undefined");
      return;
    }

    let responseText = "";
    console.log("Received user prompt: " + userPrompt);

    try {
      // Add user message to conversation history
      this._conversationHistory.push({ role: "user", content: userPrompt });
      
      // For immediate feedback while Ollama loads
      this._view.webview.postMessage({
        command: "chatResponse",
        text: "Processing your request with DeepSeek R1...",
        messages: this._conversationHistory
      });

      try {
        // Call Ollama with the full conversation history
        console.log("Calling Ollama API with conversation history");
        const streamResponse = await ollama.chat({
          model: "deepseek-r1:32b",
          messages: this._conversationHistory,
          stream: true,
        });

        // Reset the response text for the current assistant message
        responseText = "";
        
        // Stream each chunk to the webview
        for await (const part of streamResponse) {
          responseText += part.message.content;
          if (this._view) {
            // Create temporary conversation history with current response
            const currentHistory = [...this._conversationHistory];
            
            // Add the current (incomplete) assistant message
            currentHistory.push({ role: "assistant", content: responseText });
            
            this._view.webview.postMessage({
              command: "chatResponse",
              text: responseText,
              messages: currentHistory
            });
          }
        }

        // Add the final assistant response to conversation history
        this._conversationHistory.push({ role: "assistant", content: responseText });
        
        console.log("Finished streaming response from Ollama");
        
        // Set the status as completed
        this._view.webview.postMessage({
          command: "chatCompletion",
          messages: this._conversationHistory
        });
      } catch (ollamaError) {
        // If we can't connect to Ollama, send an error response
        console.error("Error with Ollama:", ollamaError);

        if (this._view) {
          const errorMessage =
            "Error connecting to Ollama: " +
            (ollamaError instanceof Error
              ? ollamaError.message
              : String(ollamaError));

          // Add error message to conversation history
          this._conversationHistory.push({ role: "assistant", content: errorMessage });
          
          this._view.webview.postMessage({
            command: "chatResponse",
            text: errorMessage,
            messages: this._conversationHistory
          });
        }

        // Re-throw for outer catch
        throw ollamaError;
      }
    } catch (error) {
      console.error("Error in handleUserPrompt:", error);

      if (this._view) {
        const errorMessage =
          "Error: " +
          (error instanceof Error ? error.message : String(error));
        
        this._view.webview.postMessage({
          command: "chatResponse",
          text: errorMessage
        });
      }

      vscode.window.showErrorMessage(
        "DeepSeek error: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  }
}
