import * as fs from "fs";
import * as path from "path";
function createDefaultConfig() {
    return {
        geminiApiKey: "",
        messageSpec: "More tech detailing and comprehensive in one line message.",
        sizeOption: 3,
    };
}
function getConfigPath() {
    const homeDir = process.env.HOME || process.env.USERPROFILE; // Mendapatkan direktori home
    return path.join(homeDir, ".commitahconfig");
}
export function loadConfig() {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
        console.warn("Config file not found, creating default config.");
        saveConfig(createDefaultConfig());
        return createDefaultConfig();
    }
    try {
        const fileContent = fs.readFileSync(configPath, "utf8");
        const parsedConfig = JSON.parse(fileContent);
        return { ...createDefaultConfig(), ...parsedConfig };
    }
    catch (error) {
        console.error("Failed to load config file, using default config.", error);
        return createDefaultConfig();
    }
}
function saveConfig(config) {
    const configPath = getConfigPath();
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4), "utf8");
        console.log("Config file saved successfully at:", configPath);
    }
    catch (error) {
        console.error("Failed to save config file.", error);
    }
}
export function updateConfig(newConfig) {
    const currentConfig = loadConfig();
    const updatedConfig = { ...currentConfig, ...newConfig };
    saveConfig(updatedConfig);
    return updatedConfig;
}
