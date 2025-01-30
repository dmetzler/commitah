import fetch from 'node-fetch';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

interface NpmRegistryResponse {
    'dist-tags': {
        latest: string;
    };
}

const execAsync = promisify(exec);
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const CURRENT_VERSION = packageJson.version;
const PACKAGE_NAME = packageJson.name;

export async function checkForUpdates(): Promise<void> {
    try {
        const response = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json() as NpmRegistryResponse;
        const latestVersion = data['dist-tags'].latest;

        console.log(`current: ${CURRENT_VERSION} | ${latestVersion}`)
        if (isNewVersionAvailable(CURRENT_VERSION, latestVersion)) {
            console.log(`New version available: ${latestVersion}. Updating...`);
            await updatePackage();
            console.log('Update completed. Please restart the script.');
            process.exit(0);
        } else {
            console.log('You already have the latest version.');
        }
    } catch (error) {
        console.error("Error checking for updates:", error);
    }
}

function isNewVersionAvailable(currentVersion: string, latestVersion: string): boolean {
    const currentParts = currentVersion.split('.').map(Number);
    const latestParts = latestVersion.split('.').map(Number);

    for (let i = 0; i < latestParts.length; i++) {
        if (latestParts[i] > (currentParts[i] || 0)) {
            return true;
        }
        if (latestParts[i] < (currentParts[i] || 0)) {
            return false;
        }
    }
    return false;
}

async function updatePackage(): Promise<void> {
    try {
        await execAsync(`npm install -g ${PACKAGE_NAME}@latest`);
        console.log('Package updated successfully.');
    } catch (error) {
        console.error('Error updating package:', error);
    }
}
