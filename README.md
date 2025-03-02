# DeepSeekVsCodeExtension
- This is a Vs Code extension that runs all versions of Ollama's DeepSeek R1 model locally. The user may interact with the model via a chat interface.

  
## Getting Started
Install Ollama from the download link: <a href="https://ollama.com/download">https://ollama.com/download</a>

Alternitively, install it manually
```
curl -fsSL https://ollama.com/install.sh | sh
```

## Next Steps
After installing Ollama, be sure to install at least 1 model before running the extension.

Select from one of the available models
- 1.5b (1.1GB)
- 7b   (4.7GB)
- 8b   (4.9GB)
- 14b  (9.0GB)
- 32b  (20GB)
- 70b  (43GB)
- 671b (404GB)

### Example (14b version
```
ollama pull deepseek-r1:14b
```
