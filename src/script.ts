import chalk from "chalk";
import figlet from "figlet";
import inquirer from "inquirer";
import open from "open";
import yargs from "yargs";
import fetch from 'node-fetch';
import ora from 'ora';
import { $ } from "zx/core";
import { loadConfig, updateConfig } from "./config.js";
import { select } from '@inquirer/prompts';
import { checkForUpdates } from './updater.js'

interface DiffCommit {
    diff: string | null;
    prevCommit: string | null;
    error: string | null;
}

const argv = await yargs(process.argv.slice(2)).options({
    config: {
        type: 'boolean',
        default: false
    },
    configUpdate: {
        name: 'config-update',
        type: 'boolean',
        default: false
    },
    show: {
        type: 'boolean',
        default: false
    }
}).parseAsync();

export async function main() {
    console.log(chalk.red(figlet.textSync('Commit Ah!')));

    await checkForUpdates(); 

    if (argv.config) {
        await showCurrentConfig();
    } else if (argv.configUpdate) {
        await promptAndUpdateConfig();
    } else {
        start(argv.show);
    }
}

async function start(show: boolean) {
    await checkGeminiApiKey();

    const diff = await getGitDiff();
    const colors = [chalk.red, chalk.yellow, chalk.green, chalk.blue, chalk.magenta, chalk.cyan];

    if (diff.diff) {
        const spinner = ora({
            text: 'Generating commit..',
            spinner: {
                interval: 80,
                frames: Array.from({ length: colors.length }, (_, i) => {
                    const color = colors[i];
                    return color(i % 2 === 0 ? '✦' : '✧');
                })
            }
        });

        const diffAsContext = JSON.stringify(diff.diff);
        const prevCommit = diff.prevCommit ? JSON.stringify(diff.prevCommit) : '';

        spinner.start();
        const textCommitMessage = await generateCommitMessages(diffAsContext, prevCommit);
        spinner.stop();

        try {
            const parsedList = JSON.parse(textCommitMessage).map((item: { message: string }) => item.message);

            const answer = await select({
                message: 'Select commit message: ',
                choices: parsedList
            });

            if (show) {
                console.log(chalk.green(`\n    '${answer}'\n`));
            } else {
                spinner.text = 'Git committing...';
                spinner.start();

                const commitMessage: string = answer as string;

                const gitCommit = await $`git commit -m ${commitMessage}`.nothrow().quiet();
                const commitOutput = gitCommit.stdout.trim();
                if (gitCommit.exitCode !== 0) {
                    spinner.fail(`Something error: ${commitOutput}`);
                } else {
                    spinner.succeed(commitOutput);
                }
            }

        } catch (error) {
            console.log(error);
            spinner.fail('Something error');
        }

    } else {
        console.error('Something went wrong. Make sure there are staged changes using "git add --all".');
        process.exit(0);
    }
}

async function showCurrentConfig() {
    const config = loadConfig();
    console.log(`Gemini API Key: ${config.geminiApiKey}`);
    console.log(`Message spec: ${config.messageSpec}`);
    console.log(`Options size: ${config.sizeOption}`);
}

async function promptAndUpdateConfig() {
    const answers = await inquirer.prompt([
        {
            type: "input",
            name: "geminiApiKey",
            message: "Enter the geminiApiKey:",
            default: loadConfig().geminiApiKey,
            validate: (input) => input.trim() !== "" || "geminiApiKey cannot be empty.",
        },
        {
            type: "input",
            name: "messageSpec",
            message: "Enter the messageSpec:",
            default: loadConfig().messageSpec,
        },
        {
            type: "number",
            name: "sizeOption",
            message: "Enter the sizeOption:",
            default: loadConfig().sizeOption,
        },
        {
            type: "input",
            name: "model",
            message: "Enter the model (https://ai.google.dev/gemini-api/docs/models/gemini#model-variations):",
            default: loadConfig().model,
        },
    ]);

    const updatedConfig = updateConfig(answers);
    console.log("Configuration updated successfully:", updatedConfig);
}

async function getGitDiff(): Promise<DiffCommit> {
    let diffCommit: DiffCommit = {
        diff: null,
        prevCommit: null,
        error: null
    };

    try {
        const isGitInstalled = await $`git --version`.nothrow().quiet();
        if (isGitInstalled.exitCode !== 0) {
            console.error("Error: Git is not installed or not found in PATH.");
            diffCommit.error = "Error: Git is not installed or not found in PATH.";
            return diffCommit;
        }

        const isInsideGitRepo = await $`git rev-parse --is-inside-work-tree`.nothrow().quiet();
        if (isInsideGitRepo.exitCode !== 0) {
            console.error("Error: Not a git repository. Please initialize git with 'git init'.");
            diffCommit.error = "Error: Not a git repository. Please initialize git with 'git init'.";
            return diffCommit;
        }

        const hasPreviousCommit = await $`git rev-list --max-count=1 HEAD`.nothrow().quiet();

        if (hasPreviousCommit.exitCode !== 0) {
            // Tidak ada commit sebelumnya, namun tetap ambil diff yang di-stage
            const diffResult = await $`git diff --staged --unified=5 --color=never`.nothrow().quiet();
            diffCommit.diff = diffResult.stdout.trim();
            diffCommit.prevCommit = 'Initial commit';
            return diffCommit;
        }

        // Jika ada commit sebelumnya
        const diffResult = await $`git diff --staged --unified=5 --color=never`.nothrow().quiet();
        const prevCommits = await $`git log --pretty=format:"%s"`.nothrow().quiet();
        diffCommit.error = null;
        diffCommit.diff = diffResult.stdout.trim();
        diffCommit.prevCommit = prevCommits.stdout.trim();
        return diffCommit;

    } catch (error) {
        console.error("An error occurred:", error);
        diffCommit.error = "An error occurred";
        return diffCommit;
    }
}

async function promptApiKey(): Promise<string> {
    const answer = await inquirer.prompt([
        {
            type: 'input',
            name: 'apiKey',
            message: 'Gemini Api Key: ',
            validate: (input: string) => input.length > 0 || 'Gemini Api Key invalid!'
        }
    ]);

    return answer.apiKey;
}

async function checkGeminiApiKey() {
    const config = loadConfig();

    if (!config.geminiApiKey) {
        const { generatedKey } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'generatedKey',
                message: 'Open browser to create a new Gemini Api Key?',
                default: true
            }
        ]);

        if (generatedKey) {
            const geminiDashboardUrl = 'https://aistudio.google.com/apikey';
            await open(geminiDashboardUrl);
        }

        const pastedApiKey = await promptApiKey();
        updateConfig({
            geminiApiKey: pastedApiKey
        });
    }
}

interface GeminiResponseContent {
    candidates: Array<{
        content: {
            parts: Array<{
                text: string;
            }>;
        };
    }>;
}

async function generateCommitMessages(diff: string, prevCommit: string): Promise<string> {
    const config = loadConfig();
    const model = config.model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`;
    const headers = {
        'Content-Type': 'application/json',
    };
    const data = {
        "systemInstruction": {
            "parts": [
                {
                    "text": `You are an expert at analyzing the git diff changes.`
                },
                {
                    "text": `Your message specification output: ${config.messageSpec}`
                }
            ]
        },
        "contents": [
            {
                "parts": [
                    {
                        "text": `Previous commits: ${prevCommit}`
                    },
                    {
                        "text": `Current diff: ${diff}`
                    },
                    {
                        "text": `Provide at least ${config.sizeOption} alternative commit message options according to the above message specification.`
                    }
                ]
            }
        ],
        "generationConfig": {
            "response_mime_type": "application/json",
            "response_schema": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "message": {
                            "type": "STRING"
                        }
                    }
                }
            }
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();
        const typedResult = result as GeminiResponseContent;
        const textResult = typedResult.candidates[0].content.parts[0].text;

        return textResult;
    } catch (error) {
        console.error("Error generating commit messages:", error);
        return '[]'; // Mengembalikan array kosong dalam format JSON
    }
}