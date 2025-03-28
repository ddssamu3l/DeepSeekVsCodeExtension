# LoCopilot - AI Coding Assistant That Runs Locally On Your Computer 
- This is a AI coding agent Vs Code extension powered by Ollama's latest open-source models
- The coding agent has full context of the user's opened files and selected texts.

## <a href="https://youtu.be/0bjnZnhsjqo">YouTube Demo</a>


  
## Getting Started
Install Ollama from the download link: <a href="https://ollama.com/download">https://ollama.com/download</a>

Alternitively, install it manually
```
curl -fsSL https://ollama.com/install.sh | sh
```

## Next Steps
After installing Ollama, be sure to install at least 1 model before running the extension.

Select from one of the available models (brackets indicate VRAM usage)
- DeepSeek R1 8b   (4.9GB)
- DeepSeek R1 70b  (43GB)
- Gemma 3 4b (3.3GB)
- Gemma 3 27b (17GB)
- QwQ (20GB)

### Example (default model: DeepSeek R1 8b)
```
ollama pull deepseek-r1:8b
```


## Run the extension
The easiest way to run this extension is to run a debug window from VsCode. 

After opening the extension's project directory, start debugging with: 
- Windows/Linux: F5
- Mac: Fn + F5

After that, the extension should be **running** in the new debug window!

**NOTE:** After you open a debug window, you must open a file in order for the extension to appear in the activity sidebar.


## Install the extension to your VS Code
To install the extension, run this command from the project directory's terminal:
```
vsce package
```
This command creates a .vsix file in your extension's root folder. For example, my-extension-0.0.1.vsix.

For users, to install a .vsix file in VS Code:

From the Extensions view in VS Code:

1. Go to the Extensions view.
2. Select Views and More Actions...
3. Select Install from VSIX...
4. From the command line:

```
# if you use VS Code
code --install-extension my-extension-0.0.1.vsix

# if you use VS Code Insiders
code-insiders --install-extension my-extension-0.0.1.vsix
```

For more information, visit VsCode's official documentation on <a href="https://code.visualstudio.com/api/working-with-extensions/publishing-extension#packaging-extensions">testing and publishing</a> extensions.
