# DeepSeek-Ext VS Code Extension

## Build & Development Commands
- `npm run compile`: Compiles TypeScript code
- `npm run watch`: Compiles and watches for changes
- `npm run lint`: Runs ESLint on src files
- `npm run test`: Runs all tests
- `npm run pretest`: Runs compile and lint before tests
- `npm run vscode:prepublish`: Prepares extension for publishing

## Code Style Guidelines
- **TypeScript**: Use strict typing, avoid `any` types when possible
- **Naming**: camelCase for variables/functions, PascalCase for classes/interfaces
- **Error Handling**: Use try/catch blocks with proper error messages
- **Imports**: Group imports by source (vscode, project files, third-party)
- **Formatting**: Use curly braces for all control structures
- **Equality**: Always use strict equality (`===` and `!==`)
- **Functions**: Keep functions focused on a single responsibility
- **Comments**: Document complex logic and public interfaces
- **Interface Definition**: Define interfaces for all message types
- **Error Patterns**: Log errors with console.error and show messages to users