import * as vscode from "vscode";
import ollama from "ollama";

// This is the main entry point for your extension
export function activate(context: vscode.ExtensionContext) {
  // Create and register your WebviewViewProvider
  const provider = new DeepSeekViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "deepseek-ext.view", // Matches the "id" from package.json
      provider
    )
  );
  console.log("extension activated");
}

// A class that provides the webview for the sidebar
class DeepSeekViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _extensionUri: vscode.Uri) {
    console.log("provider called");
  }

  // Called by VS Code when your view should be displayed
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    // Allow scripts in the webview
    webviewView.webview.options = {
      enableScripts: true,
    };

    // Set the initial HTML
    webviewView.webview.html = getWebviewContent();
    console.log("HTML initialized");

    // Listen for messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message: any) => {
      if (message.command === "userPrompt") {
        const userPrompt = message.text;
        let responseText = "";

        console.log("Received user prompt: " + userPrompt);

        try {
          const streamResponse = await ollama.chat({
            model: "deepseek-r1:32b",
            messages: [{ role: "user", content: userPrompt }],
            stream: true,
          });

          // Stream each chunk to the webview
          for await (const part of streamResponse) {
            responseText += part.message.content;
            webviewView.webview.postMessage({
              command: "chatResponse",
              text: responseText,
            });
          }
        } catch (error) {
          console.log("Error streaming response from ollama: " + error);
        }
      }
    });

    console.log("view provider initialized");
  }
}

function getWebviewContent(): string {
  return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Deep Seek Chat</title>
      <style>
        body {
          font-family: sans-serif;
          margin: 1rem;
        }
        #userPrompt {
          width: 100%;
          box-sizing: border-box;
        }
        #response {
          border: 1px solid #ccc;
          margin-top: 1rem;
          padding: 0.5rem;
          min-height: 400px;
        }
      </style>
    </head>
    <body>
      <h2>Deep Seek VS Code Extension!</h2>
      <textarea id="userPrompt" rows="3" placeholder="Ask anything..."></textarea><br />
      <button id="askButton">Ask</button>
      <div id="response"></div>

      <script>
        const vscode = acquireVsCodeApi();
        document.getElementById("askButton").addEventListener("click", () => {
          const userPrompt = document.getElementById("userPrompt").value;
          vscode.postMessage({ command: 'userPrompt', text: userPrompt });
        });

        window.addEventListener("message", event => {
          const { command, text } = event.data;
          if (command === "chatResponse") {
            document.getElementById("response").innerText = text;
          }
        });
      </script>
    </body>
    </html>
  `;
}

// This method is called when your extension is deactivated
export function deactivate() {}
