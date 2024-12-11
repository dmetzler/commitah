import chalk from "chalk"
import figlet from "figlet"
import inquirer from "inquirer"
import open from "open"
import yargs from "yargs"
import fetch from 'node-fetch'
import ora from 'ora';
import { $ } from "zx/core"
import { loadConfig, updateConfig } from "./config.js"
import { select } from '@inquirer/prompts';

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
}).parseAsync()


export async function main() {
    console.log(chalk.red(figlet.textSync('Commit Ah!')))
    if (argv.config) {
        await showCurrentConfig()
    } else if (argv.configUpdate) {
        await promptAndUpdateConfig()
    } else {
        start(argv.show)
    }
}

async function start(show: boolean) {
    await checkGeminiApiKey()

    const diff = await getGitDiff()
    const colors = [chalk.red, chalk.yellow, chalk.green, chalk.blue, chalk.magenta, chalk.cyan]

    if (diff) {
        const spinner = ora({
            text: 'Generating commit..',
            spinner: {
                interval: 80,
                frames: Array.from({ length: colors.length }, (_, i) => {
                    const color = colors[i];
                    return color(i % 2 === 0 ? '✦' : '✧')
                })
            }
        })

        const diffAsContext = JSON.stringify(diff)

        spinner.start()
        const textCommitMessage = await generateCommitMessages(diff)

        spinner.stop()

        try {
            const parsedList = JSON.parse(textCommitMessage).map((item: { message: string }) => item.message);

            const answer = await select({
                message: 'Select commit message: ',
                choices: parsedList
            })

            if (show) {
                console.log(chalk.green(`\n    '${answer}'\n`))
            } else {
                spinner.text = 'Git commiting...'
                spinner.start()

                const commitMessage: string = answer as string

                const gitCommit = await $`git commit -m ${commitMessage}`.nothrow().quiet()
                const commitOutput = gitCommit.stdout.trim()
                if (gitCommit.exitCode !== 0) {
                    spinner.fail(`Something error: ${commitOutput}`)
                } else {
                    spinner.succeed(commitOutput)
                }
            }

        } catch (error) {
            console.log(error)
            spinner.fail('Something error')
        }

    } else {
        console.error('Something went wrong. Make sure there are staged changes using "git add --all".')
        process.exit(0)
    }
}

async function showCurrentConfig() {
    console.log(`Gemini API Key: ${loadConfig().geminiApiKey}`)
    console.log(`Message spec: ${loadConfig().messageSpec}`)
    console.log(`Options size: ${loadConfig().sizeOption}`)
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
    ])

    const updatedConfig = updateConfig(answers)
    console.log("Configuration updated successfully:", updatedConfig)
}

async function getGitDiff(): Promise<string | null> {
    try {
        const isGitInstalled = await $`git --version`.nothrow().quiet()
        if (isGitInstalled.exitCode !== 0) {
            console.error("Error: Git is not installed or not found in PATH.")
            return null
        }

        const isInsideGitRepo = await $`git rev-parse --is-inside-work-tree`.nothrow().quiet()
        if (isInsideGitRepo.exitCode !== 0) {
            console.error("Error: Not a git repository. Please initialize git with 'git init'.")
            return null
        }

        const hasPreviousCommit = await $`git rev-list --max-count=1 HEAD`.nothrow().quiet()
        if (hasPreviousCommit.exitCode !== 0) {
            let directoryStructure
            if (process.platform === "win32") {
                directoryStructure = await $`dir`.nothrow().quiet()
            } else {
                directoryStructure = await $`find . -maxdepth 3 ! -path "*/.*" ! -path "*/node_modules*" ! -path "*/.git*"`.nothrow().quiet()
            }
            return `No commits found in the repository. Returning directory structure: \n` + directoryStructure.stdout.trim()
        }

        const diffResult = await $`git diff --staged --unified=5 --color=never`.nothrow().quiet()
        return diffResult.stdout.trim()
    } catch (error) {
        console.error("An error occurred:", error)
        return null
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
    ])

    return answer.apiKey
}

async function checkGeminiApiKey() {
    const config = loadConfig()
    if (config.geminiApiKey === '') {
        const { generatedKey } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'generatedKey',
                message: 'Open browser for create new Gemini Api Key?',
                default: true
            }
        ])

        if (generatedKey) {
            const geminiDashboardUrl = 'https://aistudio.google.com/apikey'
            await open(geminiDashboardUrl)
        }

        const pastedApiKey = await promptApiKey()
        updateConfig({
            geminiApiKey: pastedApiKey
        })
    }
}

async function generateCommitMessages(diff: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${loadConfig().geminiApiKey}`
    const headers = {
        'Content-Type': 'application/json',
    }
    const data = {
        "systemInstruction": {
            "parts": [
                {
                    "text": `You are an expert at analyzing the git diff changes.`
                }
            ]
        },
        "contents": [
            {
                "parts": [
                    {
                        "text": `Message specification: ${loadConfig().messageSpec}`
                    },
                    {
                        "text": `Git diff: \n${diff}. \nProvide at least ${loadConfig().sizeOption} alternative commit message options according to the above message specification.`
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
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data),
        })

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`)
        }

        const result = await response.json()

        const typedResult = result as GeminiResponseContent
        const textResult = typedResult.candidates[0].content.parts[0].text

        return textResult
    } catch (error) {
        return 'Something wrong!'
    }
}