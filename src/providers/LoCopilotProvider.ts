import * as vscode from "vscode";
import ollama from "ollama";
import getFileContext from "../utils/editorUtils";
import removeThink from "../utils/removeThink";
import getWebviewContent from "../webviewContent";
import { buildWorkspaceMap, createCondensedMapForPrompt, buildPrioritizedWorkspaceMap, recordFileAccess } from '../utils/workspaceUtils';

/**
 * Interface representing a message in the conversation.
 * @interface Message
 */
interface Message {
  /** The role of the message sender */
  role: "user" | "assistant" | "system";
  /** The content of the message */
  content: string;
}

/**
 * Provider class for the LoCopilot VS Code extension.
 * Handles the webview, conversation history, and communication with Ollama.
 * @implements {vscode.WebviewViewProvider}
 */
export default class LoCopilotViewProvider implements vscode.WebviewViewProvider {
  /** The current webview instance */
  private _view?: vscode.WebviewView;
  /** History of messages in the current conversation */
  private _conversationHistory: Message[];
  /** The current Ollama model being used */
  private _currentModel: string;
  /** Reference to the active text editor */
  private _editor: vscode.TextEditor | undefined;
  /** File system watcher to monitor workspace changes */
  private _fileWatcher: vscode.FileSystemWatcher | undefined;
  /** Debounce timer for workspace map updates */
  private _workspaceUpdateTimer: NodeJS.Timeout | undefined;
  /** Tracks context window usage */
  private _contextInfo: { used: number; total: number } = { used: 0, total: 8192 };
  /** Flag to enable auto-refresh */
  private _autoRefreshEnabled: boolean = false;

  /**
   * Creates a new instance of LoCopilotViewProvider.
   * @param {vscode.Uri} _extensionUri - The URI of the extension directory
   */
  constructor(private readonly _extensionUri: vscode.Uri) {
    this._conversationHistory = [
      {
        role: "system",
        content: `You are LoCopilot, an AI coding assistant powered by Ollama that runs locally on the user's machine. Your purpose is to help developers understand, analyze, and work with their code.

CAPABILITIES:
- Analyze code and provide explanations of how it works
- Answer programming questions with accurate, concise responses
- Provide debugging assistance and identify potential issues
- Suggest improvements or optimizations to existing code
- Find and explain patterns within codebases

CONTEXT SOURCES:
1. SELECTED CODE: Users may select specific code that needs focused attention. If the selection is relevant, use it to provide targeted help.
2. CURRENT FILE: You may receive the text of the file the user is currently viewing. Use this for additional context about their work.
3. CODEBASE MAP: When the user clicks "Crawl Codebase," you receive a map of files and their contents to understand the broader project structure.

RESPONSE GUIDELINES:
- Be concise and focused - avoid unnecessary preambles or explanations
- When technical accuracy conflicts with brevity, prioritize accuracy
- Provide code examples when helpful, but be clear about where they would be used
- If a user selects code that's irrelevant to their question, you may ignore it
- If a user asks for help with a specific file, focus on that file first before considering others
- If you don't have enough context in the codebase map, let the user know they may need to use the "Crawl Codebase" button

IMPORTANT LIMITATIONS:
- You currently cannot write code directly to files - explain that this feature is under development
- You only have access to files provided in the context or codebase map

When the user asks a question, focus on providing direct, practical answers that address their specific needs.`,
      },
    ];
    // Set default model - this will be checked and potentially changed in the webview
    this._currentModel = "gemma3:4b";
    
    // Track the active editor
    this._editor = vscode.window.activeTextEditor;
    vscode.window.onDidChangeActiveTextEditor(editor => {
      this._editor = editor;
    });
    
    // Initialize context info with default values
    this._contextInfo = { used: 0, total: 8192 };
    
    // Disable auto-refresh by default (require explicit crawl)
    this._autoRefreshEnabled = false;
    
    // Set up file system watcher to track changes in the workspace
    this._setupFileWatcher();
    
    // We'll get context window size once the webview is initialized and
    // we confirm the model is actually installed
  }

  /**
   * Sets up file system watchers to monitor changes in the workspace
   * @private
   */
  private _setupFileWatcher() {
    // Create a file system watcher for all files in the workspace
    // Use specific patterns to avoid watching too many files
    this._fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{js,ts,jsx,tsx,json,html,css,py,java,c,cpp,h,hpp,md,txt}');
    
    // Handler for file change events with debouncing
    const debouncedUpdateMap = () => {
      // Clear any existing timer
      if (this._workspaceUpdateTimer) {
        clearTimeout(this._workspaceUpdateTimer);
      }
      
      // Set a new timer to wait before updating the map
      this._workspaceUpdateTimer = setTimeout(() => {
        console.log('Workspace files changed, updating workspace map...');
        // Only trigger auto-refresh if file watcher is enabled
        if (this._autoRefreshEnabled) {
          this.refreshWorkspaceMap();
        } else {
          console.log('Auto-refresh disabled. Use the Crawl Codebase button to update manually.');
        }
      }, 5000); // 5 second debounce period
    };
    
    // Watch for file creation
    this._fileWatcher.onDidCreate(() => {
      debouncedUpdateMap();
    });
    
    // Watch for file changes
    this._fileWatcher.onDidChange(() => {
      debouncedUpdateMap();
    });
    
    // Watch for file deletion
    this._fileWatcher.onDidDelete(() => {
      debouncedUpdateMap();
    });
  }

  /**
   * Disposes of resources when the extension is deactivated
   * @public
   */
  public dispose() {
    if (this._fileWatcher) {
      this._fileWatcher.dispose();
    }
    if (this._workspaceUpdateTimer) {
      clearTimeout(this._workspaceUpdateTimer);
    }
  }

  /**
   * Initializes the workspace map and adds it to the system prompt
   * @private
   */
  private async _initWorkspaceMap() {
    try {
      // Build prioritized workspace map with a reasonable file size limit
      const workspaceMap = await buildPrioritizedWorkspaceMap(100); // 100KB max per file
      
      if (workspaceMap.length > 0) {
        // Get the base system prompt without any existing map
        // Split on the first occurrence of PROJECT CODEBASE MAP to avoid duplicating the map
        let baseSystemPrompt = this._conversationHistory[0].content;
        const codebaseMapIndex = baseSystemPrompt.indexOf("PROJECT CODEBASE MAP");
        
        if (codebaseMapIndex !== -1) {
          // If a map already exists, only keep the content before it
          baseSystemPrompt = baseSystemPrompt.substring(0, codebaseMapIndex).trim();
        }
        
        // Create a condensed version suitable for the system prompt
        const mapString = createCondensedMapForPrompt(workspaceMap);
        
        // Replace the system prompt completely (instead of appending)
        this._conversationHistory[0].content = baseSystemPrompt + "\n\n" + mapString;
        
        console.log(`Workspace map built successfully. Included ${workspaceMap.length} files.`);
      } else {
        console.log("No files found in workspace or workspace not open.");
      }
    } catch (error) {
      console.error("Error building workspace map:", error);
    }
  }

  /**
   * Updates the workspace map and refreshes it in the system prompt
   * This can be called when files in the workspace change significantly
   * @public
   */
  public async refreshWorkspaceMap() {
    try {
      // Get the base system prompt without any existing map
      // Split on the first occurrence of PROJECT CODEBASE MAP to avoid duplicating the map
      let baseSystemPrompt = this._conversationHistory[0].content;
      const codebaseMapIndex = baseSystemPrompt.indexOf("PROJECT CODEBASE MAP");
      
      if (codebaseMapIndex !== -1) {
        // If a map already exists, only keep the content before it
        baseSystemPrompt = baseSystemPrompt.substring(0, codebaseMapIndex).trim();
      }
      
      // Build a new prioritized workspace map
      const workspaceMap = await buildPrioritizedWorkspaceMap(50);
      
      if (workspaceMap.length > 0) {
        // Create a condensed version suitable for the system prompt
        const mapString = createCondensedMapForPrompt(workspaceMap);
        
        // Replace the system prompt with updated map
        this._conversationHistory[0].content = baseSystemPrompt + "\n\n" + mapString;
        
        console.log(`Workspace map refreshed successfully. Included ${workspaceMap.length} files.`);
      } else {
        // If no files found, just use the base system prompt
        this._conversationHistory[0].content = baseSystemPrompt;
        console.log("No files found in workspace to include in map.");
      }
    } catch (error) {
      console.error("Error refreshing workspace map:", error);
    }
  }

  /**
   * Required method to implement the WebviewViewProvider interface.
   * Initializes the webview when it becomes visible in VS Code.
   * @param {vscode.WebviewView} webviewView - The webview view to configure
   * @param {vscode.WebviewViewResolveContext} _context - The context in which the view is being resolved
   * @param {vscode.CancellationToken} _token - A cancellation token
   */
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
        } else if (message.command === "checkOllamaInstalled") {
          await this._checkOllamaInstalled();
        } else if (message.command === "checkModelInstalled") {
          await this._checkModelInstalled(message.modelName);
        } else if (message.command === "setModel") {
          try {
            console.log("LoCopilot model set to: " + message.modelName);
            
            // If the model has changed, update it
            if (this._currentModel !== message.modelName) {
              this._currentModel = message.modelName;
              
              // Get and update context window size for the new model
              // This will verify if the model is installed first
              await this._getModelContextSize();
            } else {
              // Even if the model hasn't changed, send a context update
              this._sendContextUpdate();
            }
          } catch (error) {
            console.error("Error setting model:", error);
          }
        } else if (message.command === "requestContextInfo") {
          // Send current context info to the webview
          this._sendContextUpdate();
        } else if (message.command === "crawlCodebase") {
          // Handle codebase crawling request
          await this._handleCodebaseCrawl();
        } else if (message.command === "installOllama") {
          // Open a browser to the Ollama download page
          vscode.env.openExternal(vscode.Uri.parse("https://ollama.com/download"));
        } else if (message.command === "installModel") {
          // Show terminal to install a model
          const terminal = vscode.window.createTerminal("Ollama Model Installation");
          terminal.sendText(`ollama pull ${message.modelName}`);
          terminal.show();
        }
      });
    } catch (error) {
      console.error("Error initializing webview:", error);
      vscode.window.showErrorMessage(
        `LoCopilot webview initialization failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Updates the HTML content of the webview and initializes it with the conversation history.
   * @private
   */
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
        `LoCopilot failed to render content: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Clears the conversation history, keeping only the system prompt.
   * @private
   */
  private _clearConversation() {
    // Get the base system prompt without any codebase map
    let baseSystemPrompt = this._conversationHistory[0].content;
    const codebaseMapIndex = baseSystemPrompt.indexOf("PROJECT CODEBASE MAP");
    
    if (codebaseMapIndex !== -1) {
      // If a map exists, remove it by keeping only the content before it
      baseSystemPrompt = baseSystemPrompt.substring(0, codebaseMapIndex).trim();
      this._conversationHistory[0].content = baseSystemPrompt;
    }
    
    // Clear all messages except for the system prompt
    this._conversationHistory.length = 1;
    
    // Reset context usage
    this._contextInfo.used = 0;
    
    // Notify frontend about the reset
    if (this._view) {
      this._view.webview.postMessage({
        command: "contextUpdate",
        contextInfo: this._contextInfo
      });
    }
    
    console.log("Chat history and codebase map cleared");
  }
  
  /**
   * Checks if Ollama is installed on the system
   * @private
   */
  private async _checkOllamaInstalled() {
    if (!this._view) {
      console.error("Cannot check Ollama - view is undefined");
      return;
    }
    
    try {
      // Try to run 'ollama -v' command to check if Ollama is installed
      const { exec } = require('child_process');
      
      exec('ollama -v', (error: any, stdout: string, stderr: string) => {
        if (error) {
          console.log("Ollama is not installed");
          
          this._view?.webview.postMessage({
            command: "ollamaInstalledResult",
            isInstalled: false
          });
          
          return false;
        }
        
        console.log("Ollama is installed:", stdout.trim());
        
        this._view?.webview.postMessage({
          command: "ollamaInstalledResult",
          isInstalled: true
        });
        
        return true;
      });
    } catch (error) {
      console.error("Error checking Ollama installation:", error);
      
      this._view?.webview.postMessage({
        command: "ollamaInstalledResult",
        isInstalled: false
      });
      
      return false;
    }
  }

  /**
   * Checks if a specific Ollama model is installed.
   * @private
   * @param {string} modelName - The name of the model to check
   * @returns {Promise<boolean>} True if the model is installed, false otherwise
   */
  private async _checkModelInstalled(modelName: string) {
    if (!this._view) {
      console.error("Cannot check model - view is undefined");
      return;
    }
    
    try {
      try {
        // Try to get the model info - if it succeeds, the model is installed
        await ollama.show({ model: modelName });
        
        // If successful, the model is installed
        this._view.webview.postMessage({
          command: "modelInstalledResult",
          isInstalled: true
        });
        
        return true;
      } catch (error) {
        // If there's an error, the model is not installed
        console.log(`Model ${modelName} is not installed`);
        
        this._view.webview.postMessage({
          command: "modelInstalledResult",
          isInstalled: false
        });
        
        return false;
      }
    } catch (error) {
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
  private _buildNewChatResponse(fullPrompt: string){
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
  private _buildFullPrompt(userPrompt: string): string {
    const { selectedText } = getFileContext();

    let fullPrompt = `User prompt: ${userPrompt}`;
    if (selectedText.trim()) {
      fullPrompt += `\nSelected text:\n${selectedText}`;
    }

    return fullPrompt;
  }

  /**
   * Gets the context window size for the current model
   * @private
   */
  private async _getModelContextSize() {
    try {
      // First check if the model is installed
      try {
        await ollama.show({ model: this._currentModel });
      } catch (error) {
        // Model is not installed, log and use default context size
        console.log(`Model ${this._currentModel} is not installed, using default context window size`);
        // Still send context update with default size
        this._sendContextUpdate();
        return;
      }
      
      // Model is installed, get its context window size
      const modelInfo = await ollama.show({ model: this._currentModel });
      
      // The Ollama API response structure is not well-typed in the package
      // Use type assertion to access the parameters
      const params = (modelInfo as any).parameters;
      if (params && typeof params.context_length === 'number') {
        this._contextInfo.total = params.context_length;
        console.log(`Model ${this._currentModel} has context window size: ${this._contextInfo.total}`);
        
        // Send updated context info to the frontend immediately
        this._sendContextUpdate();
      }
    } catch (error) {
      console.warn(`Could not get context window size for model ${this._currentModel}:`, error);
      // Still send context update with default size
      this._sendContextUpdate();
    }
  }

  /**
   * Updates the context window tracking and notifies the frontend
   * @private
   * @param {number} promptTokens - Number of tokens in the prompt
   */
  private _updateContextUsage(promptTokens: number) {
    // Only update if we have a valid number
    if (typeof promptTokens === 'number' && promptTokens > 0) {
      console.log(`Updating context usage: ${promptTokens} tokens used out of ${this._contextInfo.total}`);
      this._contextInfo.used = promptTokens;
      this._sendContextUpdate();
    } else {
      console.warn(`Invalid token count received: ${promptTokens}`);
    }
  }
  
  /**
   * Sends the current context information to the frontend
   * @private
   */
  private _sendContextUpdate() {
    if (this._view) {
      this._view.webview.postMessage({
        command: "contextUpdate",
        contextInfo: this._contextInfo
      });
    }
  }

  /**
   * Streams the response from Ollama and updates the conversation history.
   * @private
   * @param {Message[]} messages - The current conversation history
   * @returns {Promise<Message[]>} The updated conversation history
   */
  private async _streamOllamaResponse(messages: Message[]): Promise<Message[]> {
    let responseText = "";
    let firstChunk = true;
    let tokenCount = 0;

    try {
      const streamResponse = await ollama.chat({
        model: this._currentModel,
        messages,
        stream: true,
      });
      
      for await (const part of streamResponse) {
        responseText += part.message.content;
        
        // Extract token counts from response
        if (firstChunk) {
          // Use type assertion to access prompt_eval_count which may not be in the type definition
          const promptEvalCount = (part as any).prompt_eval_count;
          if (typeof promptEvalCount === 'number') {
            tokenCount = promptEvalCount;
            this._updateContextUsage(promptEvalCount);
          }
          firstChunk = false;
        }
        
        // Update UI
        this._view?.webview.postMessage({
          command: "chatResponse",
          text: responseText,
          messages: this._conversationHistory,
          contextInfo: this._contextInfo
        });
      }
      
      // Ensure we send a final update with the token count
      if (tokenCount > 0) {
        this._updateContextUsage(tokenCount);
      }
      
      // remove the thinking text from the assistant's response
      responseText = removeThink(responseText);
      // after Ollama finishes streaming in its response, we append the completed response to the conversation history
      if(messages.length > 2 && messages[messages.length-1].role === "assistant"){
        messages[messages.length - 1].content = responseText;
      } else {
        console.error("Error: Error appending Ollama response to conversation history");
      }

      return messages;
    } catch (error) {
      console.error("Error in _streamOllamaResponse:", error);
      throw error;
    }
  }

  /**
   * Handles a new user prompt.
   * @private
   * @param {string} userPrompt - The user's prompt text
   */
  private async _handleUserPrompt(userPrompt: string) {
    if (!userPrompt.trim()) {
      console.log("Empty prompt received, ignoring");
      return;
    }
    
    try {
      // Track any files mentioned in the user's prompt for prioritization
      this._trackReferencedFiles(userPrompt);
      
      // Create the full prompt and build the response
      const fullPrompt = this._buildFullPrompt(userPrompt);
      this._buildNewChatResponse(fullPrompt);

      // Update UI to show user message
      if (this._view) {
        this._view.webview.postMessage({
          command: "chatResponse",
          text: "Thinking...",
          messages: this._conversationHistory,
        });
      }

      // Stream response from Ollama
      this._conversationHistory = await this._streamOllamaResponse(this._conversationHistory);
      // update the user prompt part of conversation history to not include all the context
      this._conversationHistory[this._conversationHistory.length-2].content = userPrompt;
      
      // Final update to UI
      if (this._view) {
        this._view.webview.postMessage({
          command: "chatCompletion",
          text: this._conversationHistory[this._conversationHistory.length-1].content,
          messages: this._conversationHistory,
        });
      }
    } catch (error) {
      console.error("Error handling user prompt:", error);
      
      const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;
      
      // Update UI with error message
      if(this._conversationHistory.length > 1){
        this._conversationHistory[this._conversationHistory.length - 1].content = errorMessage;
      }
      
      if (this._view) {
        this._view.webview.postMessage({
          command: "chatCompletion",
          text: this._conversationHistory[this._conversationHistory.length-1].content,
          messages: this._conversationHistory,
        });
      }
    }
  }
  
  /**
   * Analyzes the user prompt to track any file paths that might be referenced
   * @private
   * @param {string} userPrompt - The user's prompt text
   */
  private _trackReferencedFiles(userPrompt: string) {
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) return;
      
      // Look for potential file paths in the prompt
      const filePathRegex = /[\w-]+\.[a-zA-Z0-9]+/g;
      const potentialFiles = userPrompt.match(filePathRegex) || [];
      
      for (const fileName of potentialFiles) {
        // Try to find the file in the workspace
        vscode.workspace.findFiles(`**/${fileName}`).then(uris => {
          for (const uri of uris) {
            recordFileAccess(uri.fsPath);
          }
        });
      }
      
      // Also track the current file
      if (vscode.window.activeTextEditor?.document?.uri?.fsPath) {
        recordFileAccess(vscode.window.activeTextEditor.document.uri.fsPath);
      }
    } catch (error) {
      console.warn("Error tracking referenced files:", error);
    }
  }

  /**
   * Handles the codebase crawl request from the webview
   * @private
   */
  private async _handleCodebaseCrawl() {
    if (!this._view) return;
    
    try {
      // Notify the webview that crawling has started
      this._view.webview.postMessage({
        command: "crawlStatus",
        status: "started",
      });
      
      // Perform the scan
      console.log("Starting codebase scan...");
      
      // Temporarily enable auto-refresh to get fresh content
      this._autoRefreshEnabled = true;
      await this._initWorkspaceMap();
      // Disable auto-refresh again after scan is complete
      this._autoRefreshEnabled = false;
      
      // Update context usage info based on the new system prompt size
      const systemPromptLength = this._conversationHistory[0].content.length;
      const approximateTokens = Math.ceil(systemPromptLength / 4); // Rough estimate: 4 chars per token
      this._contextInfo.used = approximateTokens;
      
      // Send completion and context update to the webview
      this._view.webview.postMessage({
        command: "crawlStatus",
        status: "completed",
        tokenCount: approximateTokens
      });
      
      // Also send updated context info
      this._sendContextUpdate();
      
      console.log(`Codebase crawl completed. Approximate tokens: ${approximateTokens}`);
    } catch (error) {
      console.error("Error during codebase crawl:", error);
      
      // Notify the webview about the error
      if (this._view) {
        this._view.webview.postMessage({
          command: "crawlStatus",
          status: "error",
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Make sure auto-refresh is disabled even if there's an error
      this._autoRefreshEnabled = false;
    }
  }
}
