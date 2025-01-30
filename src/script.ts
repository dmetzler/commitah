import chalk from "chalk";
import figlet from "figlet";
import inquirer from "inquirer";
import open from "open";
import yargs from "yargs";
import fetch from 'node-fetch';
import ora from 'ora';
import OpenAI from 'openai';
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
    await checkOpenAIApiKey();

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
    console.log(`OpenAI API Key: ${config.openaiApiKey}`);
    console.log(`Message spec: ${config.messageSpec}`);
    console.log(`Options size: ${config.sizeOption}`);
}

async function promptAndUpdateConfig() {
    const answers = await inquirer.prompt([
        {
            type: "input",
            name: "openaiApiKey",
            message: "Enter the OpenAI API Key:",
            default: loadConfig().openaiApiKey,
            validate: (input) => input.trim() !== "" || "OpenAI API Key cannot be empty.",
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
            message: "Enter the model (e.g., gpt-4, gpt-3.5-turbo):",
            default: loadConfig().model || "gpt-4",
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
            const diffResult = await $`git diff --staged --unified=5 --color=never`.nothrow().quiet();
            diffCommit.diff = diffResult.stdout.trim();
            diffCommit.prevCommit = 'Initial commit';
            return diffCommit;
        }

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
            message: 'OpenAI API Key: ',
            validate: (input: string) => input.length > 0 || 'OpenAI API Key invalid!'
        }
    ]);

    return answer.apiKey;
}

async function checkOpenAIApiKey() {
    const config = loadConfig();

    if (!config.openaiApiKey) {
        const { generatedKey } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'generatedKey',
                message: 'Open browser to create a new OpenAI API Key?',
                default: true
            }
        ]);

        if (generatedKey) {
            const openaiDashboardUrl = 'https://platform.openai.com/api-keys';
            await open(openaiDashboardUrl);
        }

        const pastedApiKey = await promptApiKey();
        updateConfig({
            openaiApiKey: pastedApiKey
        });
    }
}

async function generateCommitMessages(diff: string, prevCommit: string): Promise<string> {
    const config = loadConfig();
    const openai = new OpenAI({
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        apiKey: config.openaiApiKey
    });

    const systemMessage = `You are an expert at analyzing git diff changes.
Your message specification output: ${config.messageSpec}`;

    try {
        const response = await openai.chat.completions.create({
            model: config.model || "gpt-4",
            messages: [
                { role: "system", content: systemMessage },
                { 
                    role: "user", 
                    content: `Previous commits: ${prevCommit}\nCurrent diff: ${diff}\nProvide at least ${config.sizeOption} alternative commit message options according to the above message specification.` 
                }
            ],
            response_format: { type: "json_object" },
            functions: [
                {
                    name: "format_commit_messages",
                    description: "Format the commit messages as a JSON array",
                    parameters: {
                        type: "object",
                        properties: {
                            messages: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string" }
                                    },
                                    required: ["message"]
                                }
                            }
                        },
                        required: ["messages"]
                    }
                }
            ],
            function_call: { name: "format_commit_messages" }
        });

        const result = response.choices[0]?.message?.function_call?.arguments;
        return result || '[]';
    } catch (error) {
        console.error("Error generating commit messages:", error);
        return '[]';
    }
}