# LoCopilot - Open Source Locally-Running AI Copilot

![alt text](LoCopilot_gif.gif)

## ✨ Features
- ### 🤖 Local LLM Coding Assistant
* Latest open-source reasoning models from DeepSeek, Google, Meta, Qwen, Microsoft...
* Model switching without context loss
* Thought streaming
- ### Advanced Context Loading
* Opened files are automatically added to context
* LoCopilot can see user selected text
* "Crawl Codebase" feature to include your project files in AI context
* Context meter to visualize token usage

  
## 🚀 Getting Started
Install Ollama from the download link: <a href="https://ollama.com/download">https://ollama.com/download</a>

Alternatively, install Ollama using terminal commands:

**macOS:**
```bash
brew install ollama
```

**Linux:**

For most Linux distributions, you can use the official install script:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

If you encounter permission issues, try with sudo:
```bash
curl -fsSL https://ollama.com/install.sh | sudo sh
```

After installation, you may need to start the Ollama service:
```bash
sudo systemctl start ollama
```

For systems without curl, use wget:
```bash
wget -qO- https://ollama.com/install.sh | sh
```

**Windows:**

Windows installation requires downloading and running the installer:

1. Download the installer:
```powershell
Invoke-WebRequest -UseBasicParsing "https://ollama.com/download/ollama-installer.exe" -OutFile "$env:TEMP\ollama-installer.exe"
```

2. Navigate to your `%TEMP%` folder and run the `ollama-installer.exe` file
3. Follow the installation wizard
4. After installation, you may need to restart VS Code for the extension to detect Ollama

The LoCopilot extension can also help install Ollama for you with the appropriate method for your operating system.

## 💡 Next Steps
After installing Ollama, be sure to install at least 1 model before running the extension.

Select from one of the available models (⭐ indicates recommended models):
- CodeLlama instruct (3.8GB) ⭐
- Gemma 3 4b (3.3GB) ⭐ - *Default model*
- DeepSeek R1 8b (4.9GB) ⭐
- CodeLlama 13b (8.2GB)
- CodeLlama 34b (21GB)
- Gemma 3 27b (17GB)
- DeepSeek R1 70b (43GB)
- QwQ (20GB)

### 📝 Example (default model: Gemma 3 4b)
```
ollama pull gemma3:4b
```

## 📋 How to Use
1. Install and launch the extension
2. Click "Crawl Codebase" to help the AI understand your project structure
3. When asking questions, always specify file paths for more accurate responses
4. Use mouse selection to get help with specific code snippets

## ❤️ Support
For any issues with the extension, reach out to us directly at rainsongsoftware@gmail.com

