import * as vscode from "vscode";
import { exec as execCallback } from "child_process";
import { promisify } from "util";

const exec = promisify(execCallback);

/**
 * Checks if the current environment is WSL (Windows Subsystem for Linux)
 * @returns {Promise<boolean>} True if running in WSL
 */
export async function isWSL(): Promise<boolean> {
  console.log("Checking if running in WSL...");
  
  try {
    // Multiple checks for WSL
    // 1. Check /proc/version for Microsoft
    try {
      const { stdout: versionOutput } = await exec('grep -i microsoft /proc/version');
      if (versionOutput.trim()) {
        console.log("WSL detected by /proc/version containing 'Microsoft'");
        return true;
      }
    } catch (error) {
      // Ignore errors - this just means the command failed or the string wasn't found
    }
    
    // 2. Check for WSL-specific environment variable
    if (process.env.WSL_DISTRO_NAME) {
      console.log("WSL detected by WSL_DISTRO_NAME environment variable");
      return true;
    }
    
    // 3. Check for WSL or WSL2 in uname
    try {
      const { stdout: unameOutput } = await exec('uname -r');
      if (unameOutput.includes('WSL') || unameOutput.includes('Microsoft')) {
        console.log("WSL detected by uname -r output");
        return true;
      }
    } catch (error) {
      // Ignore errors
    }
    
    // 4. Check for Windows paths
    try {
      await exec('ls -la /mnt/c 2>/dev/null');
      console.log("WSL detected by presence of /mnt/c directory");
      return true;
    } catch (error) {
      // Ignore errors
    }
    
    console.log("Not running in WSL");
    return false;
  } catch (error) {
    console.error("Error in WSL detection:", error);
    return false;
  }
}

/**
 * Checks for WSL based on environment variables and shell
 * @returns {boolean} True if environment suggests WSL
 */
export function detectWSLFromEnvironment(): boolean {
  const platform = process.platform;
  const shellEnv = process.env.SHELL || '';
  const pathEnv = process.env.PATH || '';
  const homeEnv = process.env.HOME || '';
  
  // More comprehensive WSL detection
  const wslIndicators = [
    process.env.WSLENV !== undefined,                            // WSLENV is set in WSL
    process.env.WSL_DISTRO_NAME !== undefined,                   // WSL_DISTRO_NAME is set in WSL
    platform === 'linux' && pathEnv.includes('/mnt/c/'),         // PATH contains Windows mounted drives
    platform === 'linux' && homeEnv.includes('/home/'),          // HOME is in Linux format
    shellEnv.includes('zsh') && homeEnv.includes('/home/'),      // Using zsh in Linux home
    shellEnv.includes('bash') && homeEnv.includes('/home/'),     // Using bash in Linux home
    process.env.TERM_PROGRAM === 'vscode' && platform === 'linux' // VS Code in Linux
  ];
  
  // Check if we have a Windows username in environment but Linux paths
  const usernameEnv = process.env.USER || process.env.USERNAME || '';
  if (usernameEnv && platform === 'linux' && homeEnv.includes('/home/')) {
    // This is a strong indicator of WSL
    wslIndicators.push(true);
  }
  
  // If any Windows paths are present in the PATH env variable while we're on Linux
  if (platform === 'linux' && 
      (pathEnv.includes('\\Windows\\') || 
       pathEnv.includes('Program Files') || 
       pathEnv.includes('\\AppData\\'))) {
    wslIndicators.push(true);
  }

  // Count how many indicators are true
  const wslScore = wslIndicators.filter(Boolean).length;
  
  // For debugging
  if (wslScore > 0) {
    console.log(`WSL environment detected with score ${wslScore}/${wslIndicators.length}`);
    console.log("Platform:", platform);
    console.log("Shell:", shellEnv);
    console.log("Home:", homeEnv);
    console.log("User:", usernameEnv);
  }
  
  // If we have at least one indicator, consider it WSL
  return wslScore > 0;
}

/**
 * Gets the path to the Ollama executable
 * @returns {Promise<string>} The full path to Ollama or just "ollama" if not found
 */
export async function getOllamaPath(): Promise<string> {
  // First check if we're in WSL
  const wslEnvironment = await isWSL() || detectWSLFromEnvironment();
  
  if (wslEnvironment) {
    try {
      // In WSL, we should use the Linux binary if available, or wslpath to convert Windows path
      const { stdout: whichOutput, stderr: whichError } = await exec('which ollama 2>/dev/null || echo ""');
      if (whichOutput.trim()) {
        // Linux binary is available in WSL
        console.log("Found native Ollama binary in WSL:", whichOutput.trim());
        return whichOutput.trim();
      } else {
        console.log("Native Ollama not found in WSL, looking for Windows installation...");
        
        // Try to find the Windows binary and convert its path using wslpath
        try {
          // Get username from environment for more accurate path construction
          const username = process.env.USER || process.env.USERNAME || '';
          
          // Build paths that are more likely to be correct for this specific user
          const userSpecificPaths = [];
          
          if (username) {
            // Try with the actual Windows username from environment
            userSpecificPaths.push(`/mnt/c/Users/${username}/AppData/Local/Programs/Ollama/ollama.exe`);
          }
          
          // Add standard locations
          const commonWindowsPaths = [
            '/mnt/c/Program Files/Ollama/ollama.exe',
            '/mnt/c/Users/*/AppData/Local/Programs/Ollama/ollama.exe'
          ];
          
          // 1. First try directly accessing the WSL path equivalents
          for (const path of [...userSpecificPaths, ...commonWindowsPaths]) {
            try {
              // Simple check if the file exists using ls
              const { stdout } = await exec(`ls -la "${path}" 2>/dev/null || echo ""`);
              if (stdout && !stdout.includes("No such file")) {
                console.log(`Found Windows Ollama at WSL path: ${path}`);
                return path;
              }
            } catch (error) {
              // Ignore errors, just try next path
            }
          }
          
          // 2. If still not found, try using cmd.exe to find the Windows location
          try {
            // This command will execute in the Windows command prompt to find Ollama
            const { stdout: cmdOutput } = await exec('cmd.exe /c "where ollama.exe 2> nul"');
            if (cmdOutput.trim()) {
              const windowsPath = cmdOutput.trim();
              console.log("Found Windows Ollama path via cmd.exe:", windowsPath);
              
              // Convert Windows path to WSL path
              try {
                const { stdout: wslPath } = await exec(`wslpath "${windowsPath}"`);
                if (wslPath.trim()) {
                  console.log("Converted to WSL path:", wslPath.trim());
                  return wslPath.trim();
                }
              } catch (error) {
                console.error("Error converting Windows path with wslpath:", error);
              }
            }
          } catch (error) {
            console.log("Could not find Ollama via cmd.exe in WSL");
          }
        } catch (error) {
          console.error("Error detecting Windows Ollama from WSL:", error);
        }
      }
      
      console.log("Falling back to using 'ollama' command in WSL");
      return 'ollama';
    } catch (error) {
      console.error("Error detecting Ollama in WSL:", error);
      return 'ollama';
    }
  } else if (process.platform === 'win32') {
    // On Windows, check common installation locations
    try {
      const { stdout: whereOutput } = await exec('where ollama');
      if (whereOutput.trim()) {
        console.log("Found Ollama in Windows PATH:", whereOutput.trim());
        return whereOutput.trim();
      }
    } catch (error) {
      // Not found in PATH, try common locations
      console.log("Ollama not found in Windows PATH, checking common locations");
      const commonPaths = [
        '%LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe',
        '%ProgramFiles%\\Ollama\\ollama.exe'
      ];
      
      // Expand environment variables
      const expandedPath = commonPaths[0].replace(/%([^%]+)%/g, (_, varName) => 
        process.env[varName] || '');
      
      console.log("Using Windows path:", expandedPath);
      return expandedPath;
    }
  }
  
  // On macOS/Linux, just use the command name
  return 'ollama';
}

/**
 * Checks if Ollama is installed and available
 * @param view The webview to send results to
 * @returns {Promise<boolean>} True if Ollama is installed
 */
export async function checkOllamaInstalled(view?: vscode.WebviewView): Promise<boolean> {
  if (!view) {
    console.log("No webview provided for Ollama check results");
  }
  
  const sendResult = (isInstalled: boolean) => {
    if (view) {
      view.webview.postMessage({
        command: "ollamaInstalledResult",
        isInstalled
      });
    }
    return isInstalled;
  };
  
  try {
    // Determine approach based on platform
    if (await isWSL() || detectWSLFromEnvironment()) {
      console.log("Checking for Ollama in WSL environment...");
      // Get path to Ollama in WSL
      const ollamaPath = await getOllamaPath();
      
      try {
        // Try to run the found path with version flag
        const { stdout } = await exec(`"${ollamaPath}" -v`);
        console.log("Ollama is installed in WSL:", stdout.trim());
        return sendResult(true);
      } catch (error) {
        console.log("Ollama executable not functioning in WSL");
        
        // Try checking for the Ollama service instead
        return await checkOllamaService(view);
      }
    } else if (process.platform === 'win32') {
      // For Windows, use where command
      try {
        const { stdout: whereOutput } = await exec('where ollama');
        if (whereOutput.trim()) {
          const ollamaPath = whereOutput.trim();
          console.log("Found Ollama at:", ollamaPath);
          
          try {
            const { stdout } = await exec(`"${ollamaPath}" -v`);
            console.log("Ollama is installed:", stdout.trim());
            return sendResult(true);
          } catch (error) {
            console.log("Ollama executable found but couldn't be run:", error);
            return sendResult(false);
          }
        }
      } catch (error) {
        // Not found in PATH, check common Windows locations
        const commonPaths = [
          '%LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe',
          '%ProgramFiles%\\Ollama\\ollama.exe'
        ];
        
        for (const path of commonPaths) {
          try {
            // Expand environment variables for Windows
            const expandedPath = path.replace(/%([^%]+)%/g, (_, varName) => 
              process.env[varName] || '');
            
            // Check if the file exists
            const { existsSync } = require('fs');
            if (existsSync(expandedPath)) {
              console.log("Found Ollama at common path:", expandedPath);
              
              try {
                const { stdout } = await exec(`"${expandedPath}" -v`);
                console.log("Ollama is installed:", stdout.trim());
                return sendResult(true);
              } catch (error) {
                // Found the exe but couldn't run it
                console.log("Ollama executable found but couldn't be run:", error);
              }
            }
          } catch (error) {
            console.error("Error checking common Windows path:", error);
          }
        }
        
        // Not found in common Windows locations
        console.log("Ollama is not installed (not found in PATH or common locations)");
        return sendResult(false);
      }
    } else {
      // For macOS/Linux, simple approach
      try {
        const { stdout } = await exec('ollama -v');
        console.log("Ollama is installed:", stdout.trim());
        return sendResult(true);
      } catch (error) {
        console.log("Ollama is not installed");
        
        // On Linux, also check if it's installed as a service
        if (process.platform === 'linux') {
          return await checkOllamaService(view);
        }
        
        return sendResult(false);
      }
    }
  } catch (error) {
    console.error("Error checking Ollama installation:", error);
    return sendResult(false);
  }
  
  // Default return
  return sendResult(false);
}

/**
 * Checks if the Ollama service is running on Linux
 * @param view The webview to send results to
 * @returns {Promise<boolean>} True if the service is installed and running
 */
export async function checkOllamaService(view?: vscode.WebviewView): Promise<boolean> {
  const sendResult = (isInstalled: boolean) => {
    if (view) {
      view.webview.postMessage({
        command: "ollamaInstalledResult",
        isInstalled
      });
    }
    return isInstalled;
  };
  
  try {
    // Try systemctl first (for systemd-based distributions)
    try {
      const { stdout } = await exec('systemctl is-active ollama.service');
      if (stdout.trim() === 'active') {
        console.log("Ollama service is active");
        return sendResult(true);
      }
    } catch (error) {
      // Not found or not running with systemctl
    }
    
    // Try service command as a fallback
    try {
      const { stdout } = await exec('service ollama status');
      if (stdout.includes('running')) {
        console.log("Ollama service is running");
        return sendResult(true);
      }
    } catch (error) {
      // Not found with service either
    }
    
    console.log("Ollama service is not installed or not running");
    return sendResult(false);
  } catch (error) {
    console.error("Error checking Ollama service:", error);
    return sendResult(false);
  }
}

/**
 * Adds debug information to the terminal
 * @param terminal The VSCode terminal to use
 * @param isWSL Whether WSL has been detected
 */
export function addTerminalDebugInfo(terminal: vscode.Terminal, isWSL: boolean): void {
  terminal.sendText('echo "=== LoCopilot Installation Debug Info ==="');
  terminal.sendText('echo "Platform: ' + process.platform + '"');
  terminal.sendText('echo "WSL Detection: ' + isWSL + '"');
  terminal.sendText('echo "Shell: $SHELL"');
  terminal.sendText('echo "Current Directory: $(pwd)"');
  terminal.sendText('echo "========================================"');
  terminal.sendText('echo');
}

/**
 * Provides installation commands for WSL environments
 * @param terminal The VSCode terminal to use
 */
export function installOllamaInWSL(terminal: vscode.Terminal): void {
  terminal.sendText('echo "Installing Ollama in WSL (Windows Subsystem for Linux)..."');
  terminal.sendText('echo');
  terminal.sendText('echo "WSL detected! There are two ways to use Ollama with WSL:"');
  terminal.sendText('echo');
  terminal.sendText('echo "Option 1: Install Ollama natively in WSL (RECOMMENDED)"');
  terminal.sendText('echo "  This will install Ollama directly in your Linux environment:"');
  terminal.sendText('echo "  curl -fsSL https://ollama.com/install.sh | sh"');
  terminal.sendText('echo');
  terminal.sendText('echo "Option 2: Use existing Windows Ollama installation from WSL"');
  terminal.sendText('echo "  If Ollama is already installed in Windows, you can access it with:"');
  
  // Get username for more accurate path suggestion
  terminal.sendText('WIN_USERNAME=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d "\\r")');
  terminal.sendText('echo "  - Your Windows username appears to be: $WIN_USERNAME"');
  terminal.sendText('echo "  - The Ollama path should be something like:"');
  terminal.sendText('echo "    /mnt/c/Users/$WIN_USERNAME/AppData/Local/Programs/Ollama/ollama.exe"');
  terminal.sendText('echo');
  
  // Provide more useful information
  terminal.sendText('echo "Would you like to install Ollama natively in WSL now? (y/n)"');
  terminal.sendText('read REPLY');
  terminal.sendText('if [[ $REPLY =~ ^[Yy]$ ]]; then');
  terminal.sendText('  echo "Installing Ollama in WSL..."');
  terminal.sendText('  curl -fsSL https://ollama.com/install.sh | sh');
  terminal.sendText('  echo');
  terminal.sendText('  echo "Installation completed."');
  terminal.sendText('  echo "You might need to start the Ollama service manually with:"');
  terminal.sendText('  echo "  sudo systemctl start ollama.service"');
  terminal.sendText('  echo "Or restart your WSL session with: wsl --shutdown"');
  terminal.sendText('else');
  terminal.sendText('  echo "Installation cancelled."');
  terminal.sendText('  echo');
  terminal.sendText('  # Try to find existing Windows Ollama installation');
  terminal.sendText('  echo "Checking for existing Windows Ollama installation..."');
  terminal.sendText('  OLLAMA_PATH=$(ls -la /mnt/c/Users/*/AppData/Local/Programs/Ollama/ollama.exe 2>/dev/null | head -n 1 || echo "Not found")');
  terminal.sendText('  if [[ "$OLLAMA_PATH" != "Not found" ]]; then');
  terminal.sendText('    echo "Found Windows Ollama at:"');
  terminal.sendText('    echo "  $OLLAMA_PATH"');
  terminal.sendText('    echo');
  terminal.sendText('    echo "To use this from WSL, you need to set up an alias."');
  terminal.sendText('    echo "Run these commands to add an alias to your shell config:"');
  terminal.sendText('    echo');
  terminal.sendText('    echo "  echo \'alias ollama=\"$OLLAMA_PATH\"\' >> ~/.bashrc"');
  terminal.sendText('    echo "  source ~/.bashrc"');
  terminal.sendText('  else');
  terminal.sendText('    echo "No Windows Ollama installation found."');
  terminal.sendText('    echo "You can download it from: https://ollama.com/download"');
  terminal.sendText('    cmd.exe /c start https://ollama.com/download');
  terminal.sendText('  fi');
  terminal.sendText('fi');
  terminal.sendText('echo');
  terminal.sendText('echo "Press Enter to continue..."');
  terminal.sendText('read');
}

/**
 * Provides installation commands for Linux environments
 * @param terminal The VSCode terminal to use
 */
export function installOllamaOnLinux(terminal: vscode.Terminal): void {
  terminal.sendText('echo "Installing Ollama on Linux..."');
  terminal.sendText('echo "This will download and run the official Ollama installation script."');
  terminal.sendText('echo "You may be prompted for your password to complete the installation."');
  terminal.sendText('echo');
  
  // Main installation command
  terminal.sendText('curl -fsSL https://ollama.com/install.sh | sh');
  
  // Additional guidance in case of common issues
  terminal.sendText('echo');
  terminal.sendText('echo "If the installation failed, here are some common solutions:"');
  terminal.sendText('echo "1. If you got a permission error, try running with sudo:"');
  terminal.sendText('echo "   curl -fsSL https://ollama.com/install.sh | sudo sh"');
  terminal.sendText('echo');
  terminal.sendText('echo "2. For systems without curl, use wget:"');
  terminal.sendText('echo "   wget -qO- https://ollama.com/install.sh | sh"');
  terminal.sendText('echo');
  terminal.sendText('echo "3. If you\'re using a non-standard Linux distribution, visit:"');
  terminal.sendText('echo "   https://github.com/ollama/ollama/blob/main/README.md"');
  terminal.sendText('echo');
  terminal.sendText('echo "After installation completes, you may need to start the Ollama service:"');
  terminal.sendText('echo "  sudo systemctl start ollama"');
  terminal.sendText('echo');
}

/**
 * Provides installation commands for Windows environments
 * @param terminal The VSCode terminal to use
 */
export function installOllamaOnWindows(terminal: vscode.Terminal): void {
  terminal.sendText('echo Downloading Ollama installer for Windows...');
  terminal.sendText('echo This may take a moment. Please wait...');
  
  // Download the installer to the temp directory
  terminal.sendText('Invoke-WebRequest -UseBasicParsing "https://ollama.com/download/ollama-installer.exe" -OutFile "$env:TEMP\\ollama-installer.exe"');
  
  // Provide instructions for the user
  terminal.sendText('echo');
  terminal.sendText('echo Installer downloaded to: $env:TEMP\\ollama-installer.exe');
  terminal.sendText('echo');
  terminal.sendText('echo *** IMPORTANT: Please follow these steps: ***');
  terminal.sendText('echo 1. Open File Explorer and navigate to %TEMP%');
  terminal.sendText('echo 2. Run the "ollama-installer.exe" file');
  terminal.sendText('echo 3. Follow the installation wizard');
  terminal.sendText('echo 4. After installation completes, restart VS Code');
  terminal.sendText('echo');
  terminal.sendText('echo Press Enter to open the temp folder...');
  terminal.sendText('pause');
  terminal.sendText('start %TEMP%');
}

/**
 * Provides installation commands for macOS environments
 * @param terminal The VSCode terminal to use
 */
export function installOllamaOnMacOS(terminal: vscode.Terminal): void {
  terminal.sendText('echo "Installing Ollama on macOS using Homebrew..."');
  terminal.sendText('brew install ollama');
  terminal.sendText('echo');
  terminal.sendText('echo "If Homebrew is not installed, you can install it with:"');
  terminal.sendText('echo "/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""');
  terminal.sendText('echo');
  terminal.sendText('echo "Alternatively, you can download Ollama directly from:"');
  terminal.sendText('echo "https://ollama.com/download"');
} 