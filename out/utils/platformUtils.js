"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWSL = isWSL;
exports.detectWSLFromEnvironment = detectWSLFromEnvironment;
exports.getOllamaPath = getOllamaPath;
exports.checkOllamaInstalled = checkOllamaInstalled;
exports.checkOllamaService = checkOllamaService;
exports.addTerminalDebugInfo = addTerminalDebugInfo;
exports.installOllamaInWSL = installOllamaInWSL;
exports.installOllamaOnLinux = installOllamaOnLinux;
exports.installOllamaOnWindows = installOllamaOnWindows;
exports.installOllamaOnMacOS = installOllamaOnMacOS;
const child_process_1 = require("child_process");
const util_1 = require("util");
const exec = (0, util_1.promisify)(child_process_1.exec);
/**
 * Checks if the current environment is WSL (Windows Subsystem for Linux)
 * @returns {Promise<boolean>} True if running in WSL
 */
async function isWSL() {
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
        }
        catch (error) {
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
        }
        catch (error) {
            // Ignore errors
        }
        // 4. Check for Windows paths
        try {
            await exec('ls -la /mnt/c 2>/dev/null');
            console.log("WSL detected by presence of /mnt/c directory");
            return true;
        }
        catch (error) {
            // Ignore errors
        }
        console.log("Not running in WSL");
        return false;
    }
    catch (error) {
        console.error("Error in WSL detection:", error);
        return false;
    }
}
/**
 * Checks for WSL based on environment variables and shell
 * @returns {boolean} True if environment suggests WSL
 */
function detectWSLFromEnvironment() {
    const platform = process.platform;
    const shellEnv = process.env.SHELL || '';
    const forcedWSLDetection = (platform === 'linux' && process.env.WSLENV !== undefined) ||
        (shellEnv.includes('zsh') && process.env.HOME?.includes('/home/')) ||
        (process.env.TERM_PROGRAM === 'vscode' && platform === 'linux' && process.env.PATH?.includes('/mnt/c/'));
    if (forcedWSLDetection) {
        console.log("WSL environment detected through shell environment");
        console.log("Shell:", shellEnv, "Home:", process.env.HOME);
    }
    return forcedWSLDetection === undefined ? false : forcedWSLDetection;
}
/**
 * Gets the path to the Ollama executable
 * @returns {Promise<string>} The full path to Ollama or just "ollama" if not found
 */
async function getOllamaPath() {
    // First check if we're in WSL
    const wslEnvironment = await isWSL() || detectWSLFromEnvironment();
    if (wslEnvironment) {
        try {
            // In WSL, we should use the Linux binary if available, or wslpath to convert Windows path
            const { stdout: whichOutput, stderr: whichError } = await exec('which ollama 2>/dev/null || echo ""');
            if (whichOutput.trim()) {
                // Linux binary is available in WSL
                return whichOutput.trim();
            }
            else {
                // Try to find the Windows binary and convert its path
                const commonWindowsPaths = [
                    '%LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe',
                    '%ProgramFiles%\\Ollama\\ollama.exe'
                ];
                for (const windowsPath of commonWindowsPaths) {
                    try {
                        // Expand environment variables
                        const expandedPath = windowsPath.replace(/%([^%]+)%/g, (_, varName) => {
                            // WSL can't access Windows env vars directly, so we hardcode common ones
                            if (varName === 'LOCALAPPDATA') {
                                return '/mnt/c/Users/' + process.env.USER + '/AppData/Local';
                            }
                            else if (varName === 'ProgramFiles') {
                                return '/mnt/c/Program Files';
                            }
                            return '';
                        });
                        // Convert the Windows path to WSL path format
                        try {
                            const { stdout: wslPath } = await exec(`wslpath "${expandedPath}"`);
                            const pathToCheck = wslPath.trim();
                            // Check if this file exists
                            try {
                                await exec(`test -f "${pathToCheck}"`);
                                console.log(`Found Windows Ollama at: ${pathToCheck}`);
                                return pathToCheck;
                            }
                            catch (error) {
                                // File doesn't exist
                                console.log(`Path doesn't exist: ${pathToCheck}`);
                            }
                        }
                        catch (error) {
                            console.error("Error converting Windows path for WSL:", error);
                        }
                    }
                    catch (error) {
                        console.error("Error checking common path in WSL:", error);
                    }
                }
            }
        }
        catch (error) {
            console.error("Error detecting Ollama in WSL:", error);
        }
        // Fallback to just using 'ollama' command for WSL
        return 'ollama';
    }
    else if (process.platform === 'win32') {
        // On Windows, check common installation locations
        try {
            const { stdout: whereOutput } = await exec('where ollama');
            if (whereOutput.trim()) {
                return whereOutput.trim();
            }
        }
        catch (error) {
            // Not found in PATH, try common locations
            const commonPaths = [
                '%LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe',
                '%ProgramFiles%\\Ollama\\ollama.exe'
            ];
            return commonPaths[0]; // Use first common path as fallback
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
async function checkOllamaInstalled(view) {
    if (!view) {
        console.log("No webview provided for Ollama check results");
    }
    const sendResult = (isInstalled) => {
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
            }
            catch (error) {
                console.log("Ollama executable not functioning in WSL");
                // Try checking for the Ollama service instead
                return await checkOllamaService(view);
            }
        }
        else if (process.platform === 'win32') {
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
                    }
                    catch (error) {
                        console.log("Ollama executable found but couldn't be run:", error);
                        return sendResult(false);
                    }
                }
            }
            catch (error) {
                // Not found in PATH, check common Windows locations
                const commonPaths = [
                    '%LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe',
                    '%ProgramFiles%\\Ollama\\ollama.exe'
                ];
                for (const path of commonPaths) {
                    try {
                        // Expand environment variables for Windows
                        const expandedPath = path.replace(/%([^%]+)%/g, (_, varName) => process.env[varName] || '');
                        // Check if the file exists
                        const { existsSync } = require('fs');
                        if (existsSync(expandedPath)) {
                            console.log("Found Ollama at common path:", expandedPath);
                            try {
                                const { stdout } = await exec(`"${expandedPath}" -v`);
                                console.log("Ollama is installed:", stdout.trim());
                                return sendResult(true);
                            }
                            catch (error) {
                                // Found the exe but couldn't run it
                                console.log("Ollama executable found but couldn't be run:", error);
                            }
                        }
                    }
                    catch (error) {
                        console.error("Error checking common Windows path:", error);
                    }
                }
                // Not found in common Windows locations
                console.log("Ollama is not installed (not found in PATH or common locations)");
                return sendResult(false);
            }
        }
        else {
            // For macOS/Linux, simple approach
            try {
                const { stdout } = await exec('ollama -v');
                console.log("Ollama is installed:", stdout.trim());
                return sendResult(true);
            }
            catch (error) {
                console.log("Ollama is not installed");
                // On Linux, also check if it's installed as a service
                if (process.platform === 'linux') {
                    return await checkOllamaService(view);
                }
                return sendResult(false);
            }
        }
    }
    catch (error) {
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
async function checkOllamaService(view) {
    const sendResult = (isInstalled) => {
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
        }
        catch (error) {
            // Not found or not running with systemctl
        }
        // Try service command as a fallback
        try {
            const { stdout } = await exec('service ollama status');
            if (stdout.includes('running')) {
                console.log("Ollama service is running");
                return sendResult(true);
            }
        }
        catch (error) {
            // Not found with service either
        }
        console.log("Ollama service is not installed or not running");
        return sendResult(false);
    }
    catch (error) {
        console.error("Error checking Ollama service:", error);
        return sendResult(false);
    }
}
/**
 * Adds debug information to the terminal
 * @param terminal The VSCode terminal to use
 * @param isWSL Whether WSL has been detected
 */
function addTerminalDebugInfo(terminal, isWSL) {
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
function installOllamaInWSL(terminal) {
    terminal.sendText('echo "Installing Ollama in WSL (Windows Subsystem for Linux)..."');
    terminal.sendText('echo "You have two options for using Ollama with WSL:"');
    terminal.sendText('echo');
    terminal.sendText('echo "Option 1: Install Ollama natively in WSL (recommended)"');
    terminal.sendText('echo "  This will run the Linux installation script:"');
    terminal.sendText('echo "  curl -fsSL https://ollama.com/install.sh | sh"');
    terminal.sendText('echo');
    terminal.sendText('echo "Option 2: Access Windows Ollama from WSL"');
    terminal.sendText('echo "  1. Open Windows Explorer (you can type: explorer.exe .)"');
    terminal.sendText('echo "  2. Download Ollama from: https://ollama.com/download"');
    terminal.sendText('echo "  3. Install in Windows"');
    terminal.sendText('echo "  4. Access from WSL using: /mnt/c/Users/YOUR_USERNAME/AppData/Local/Programs/Ollama/ollama.exe"');
    terminal.sendText('echo');
    terminal.sendText('echo "Would you like to install Ollama in WSL now? (y/n)"');
    terminal.sendText('read REPLY');
    terminal.sendText('if [[ $REPLY =~ ^[Yy]$ ]]; then');
    terminal.sendText('  echo "Installing Ollama in WSL..."');
    terminal.sendText('  curl -fsSL https://ollama.com/install.sh | sh');
    terminal.sendText('  echo "Installation completed. You might need to restart VS Code."');
    terminal.sendText('else');
    terminal.sendText('  echo "Installation cancelled. Please install Ollama manually."');
    terminal.sendText('  echo "You can download it from: https://ollama.com/download"');
    terminal.sendText('  # Open Windows browser to download page');
    terminal.sendText('  explorer.exe "https://ollama.com/download" || echo "Could not open browser"');
    terminal.sendText('fi');
}
/**
 * Provides installation commands for Linux environments
 * @param terminal The VSCode terminal to use
 */
function installOllamaOnLinux(terminal) {
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
function installOllamaOnWindows(terminal) {
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
function installOllamaOnMacOS(terminal) {
    terminal.sendText('echo "Installing Ollama on macOS using Homebrew..."');
    terminal.sendText('brew install ollama');
    terminal.sendText('echo');
    terminal.sendText('echo "If Homebrew is not installed, you can install it with:"');
    terminal.sendText('echo "/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""');
    terminal.sendText('echo');
    terminal.sendText('echo "Alternatively, you can download Ollama directly from:"');
    terminal.sendText('echo "https://ollama.com/download"');
}
//# sourceMappingURL=platformUtils.js.map