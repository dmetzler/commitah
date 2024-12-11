import * as fs from "fs"
import * as path from "path"

interface Config {
    readonly geminiApiKey: string
    readonly messageSpec: string
    readonly sizeOption: number
}

function createDefaultConfig(): Config {
    return {
        geminiApiKey: "",
        messageSpec: "simple for each message, with Commit Convensions standard",
        sizeOption: 3,
    }
}

function getConfigPath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE // Mendapatkan direktori home
    return path.join(homeDir!, ".commitahconfig")
}

export function loadConfig(): Config {
    const configPath = getConfigPath()

    if (!fs.existsSync(configPath)) {
        console.warn("Config file not found, creating default config.")
        saveConfig(createDefaultConfig())
        return createDefaultConfig()
    }

    try {
        const fileContent = fs.readFileSync(configPath, "utf8")
        const parsedConfig = JSON.parse(fileContent) as Partial<Config>

        return { ...createDefaultConfig(), ...parsedConfig }
    } catch (error) {
        console.error("Failed to load config file, using default config.", error)
        return createDefaultConfig()
    }
}

function saveConfig(config: Config): void {
    const configPath = getConfigPath()

    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4), "utf8")
        console.log("Config file saved successfully at:", configPath)
    } catch (error) {
        console.error("Failed to save config file.", error)
    }
}

export function updateConfig(newConfig: Partial<Config>): Config {
    const currentConfig = loadConfig()
    const updatedConfig = { ...currentConfig, ...newConfig }
    saveConfig(updatedConfig)
    return updatedConfig
}

// const config = loadConfig()
// console.log("Loaded Config:", config)

// const updatedConfig = updateConfig({ geminiApiKey: "new-api-key", sizeOption: 20 })
// console.log("Updated Config:", updatedConfig)
