# Commitah CLI

Commitah is a Command Line Interface (CLI) tool that automates the process of generating Git commit messages using Generative AI powered by Gemini. This tool streamlines commit creation by analyzing `git diff` and providing multiple commit message suggestions based on user-defined specifications.

## Features

- **AI-Powered Commit Messages**: Generates contextual commit messages based on staged changes.
- **Customizable Configurations**: Modify message specifications and Gemini API Key.
- **Interactive UI**: CLI prompts to choose from suggested messages.
- **Error Handling**: Ensures Git and required configurations are properly set up.

## Installation

### Prerequisites
- [Node.js](https://nodejs.org) v16 or later
- [Git](https://git-scm.com) installed and available in PATH

### Install CLI App
```bash
npm install --global commitah
```

## Usage

### Basic Command
Run the tool in a Git repository with staged changes:
```bash
commitah
```

https://github.com/user-attachments/assets/b7a346e5-702b-403d-a1ed-81981a8d2f30

### Options
- `--config`: Show the current configuration.
- `--config-update`: Update the Gemini API Key or message specification.
- `--show`: Preview the selected commit message without committing.

### Example
```bash
commitah --show
```

## Configuration

Configuration is stored in `~/.commitahconfig`. When first run, the tool generates a default configuration. If the Gemini API Key is empty, the tool will open a browser for the user to generate the API Key and provide a prompt to paste it back into the CLI.

https://github.com/user-attachments/assets/f83d1393-422a-4af3-9439-73fc2c9d5281


### Generated Default Configuration

```json
{
  "geminiApiKey": "",
  "messageSpec": "simple for each message, with Commit Conventions standard",
  "sizeOption": 3
}
```

### Updating Configuration
Use the following command to update configuration:
```bash
commitah --config-update
```

## Dependencies

Commitah uses the following libraries:
- [inquirer](https://www.npmjs.com/package/inquirer)
- [figlet](https://www.npmjs.com/package/figlet)
- [chalk](https://www.npmjs.com/package/chalk)
- [yargs](https://www.npmjs.com/package/yargs)
- [ora](https://www.npmjs.com/package/ora)
- [node-fetch](https://www.npmjs.com/package/node-fetch)

## Development

### Directory Structure
- **src/**: Contains the source code.
- **dist/**: Compiled JavaScript files.
- **config.js**: Handles reading and writing configuration files.
- **main.js**: Entry point for the CLI.

### Build
To compile the TypeScript source files:
```bash
npm run build
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the ISC License.

## Author

Muhammad Utsman
