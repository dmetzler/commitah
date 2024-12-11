#!/usr/bin/env zx
import chalk from "chalk";
import figlet from "figlet";
import inquirer from "inquirer";
async function main() {
    console.log(chalk.red(figlet.textSync('Commit Ah!')));
    const answer = await inquirer.prompt([
        {
            type: 'input',
            name: 'nama',
            message: 'nama lu siape?',
            default: 'ojan'
        }
    ]);
    console.log(`iya mas ${answer.nama}?`);
}
(async () => { main(); })();
