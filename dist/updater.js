import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
const PACKAGE_NAME = 'commitah';
async function getCurrentVersion() {
    try {
        const { stdout } = await execAsync(`${PACKAGE_NAME} --version`);
        return stdout.trim();
    }
    catch (error) {
        console.error('Error getting current version:', error);
        return '0.0.0';
    }
}
export async function checkForUpdates() {
    try {
        const currentVersion = await getCurrentVersion();
        const response = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        const latestVersion = data['dist-tags'].latest;
        if (isNewVersionAvailable(currentVersion, latestVersion)) {
            console.log(`New version available: ${latestVersion}. Updating...`);
            await updatePackage();
            console.log('Update completed. Please restart the script.');
            process.exit(0);
        }
    }
    catch (error) {
        console.error("Error checking for updates:", error);
    }
}
function isNewVersionAvailable(currentVersion, latestVersion) {
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
async function updatePackage() {
    try {
        await execAsync(`npm install -g ${PACKAGE_NAME}@latest`);
        console.log('Package updated successfully.');
    }
    catch (error) {
        console.error('Error updating package:', error);
    }
}
