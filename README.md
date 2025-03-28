# DeepSeekVsCodeExtension | <a href="https://youtu.be/0bjnZnhsjqo">YouTube Demo</a>
- This is a Vs Code extension that runs all versions of Ollama's DeepSeek R1 model locally. The user may interact with the model via a chat interface.


  
## Getting Started
Install Ollama from the download link: <a href="https://ollama.com/download">https://ollama.com/download</a>

Alternitively, install it manually
```
curl -fsSL https://ollama.com/install.sh | sh
```

## Next Steps
After installing Ollama, be sure to install at least 1 model before running the extension.

Select from one of the available models (brackets indicate VRAM usage)
- 1.5b (1.1GB)
- 7b   (4.7GB)
- 8b   (4.9GB)
- 14b  (9.0GB)
- 32b  (20GB)
- 70b  (43GB)
- 671b (404GB)

### Example (default model: 8b)
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

## Support
For any issues with the extension, reach out to us directly at samueldeng78@gmail.com
