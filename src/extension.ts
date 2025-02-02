// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import ollama from 'ollama';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const disposable = vscode.commands.registerCommand('deepseek-ext.chat', () => {
		const panel = vscode.window.createWebviewPanel(
			"DeepSeekChat",
			"Deep Seek Chat",
			vscode.ViewColumn.One,
			{enableScripts: true}
		);

		panel.webview.html = getWebviewContent();

		panel.webview.onDidReceiveMessage(async(message: any) => {
			if(message.command === "userPrompt"){
				const userPrompt = message.text;
				let responseText = '';

				console.log("Received user prompt: " + userPrompt);

				try{
					const streamResponse = await ollama.chat({
						model: 'deepseek-r1:32b',
						messages: [{role: "user", content: userPrompt}],
						stream: true,
					});

					for await(const part of streamResponse){
						responseText += part.message.content;
						panel.webview.postMessage({command: "chatResponse", text: responseText});
					}
				}catch(error){
					console.log("Error streaming response from ollama: " + error);
				}
			}
		});
	});

	context.subscriptions.push(disposable);
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
