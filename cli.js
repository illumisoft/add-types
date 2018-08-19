#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const promisify = require('util').promisify;
const exec = promisify(require("child_process").exec);
const request = require("request-promise");
const chalk = require("chalk");
const figures = require("figures");

const cwd = process.cwd();
const packagePath = path.join(cwd, 'package.json');

if (!fs.existsSync(packagePath)) {
    console.error('No package.json file found!');
    process.exit();
}

// Package.json exists

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
let dependencies = [];

if (pkg.dependencies) {
    dependencies.push(...Object.keys(pkg.dependencies));
}
if (pkg.devDependencies) {
    dependencies.push(...Object.keys(pkg.devDependencies));
}

// Filter out already installed types

let alreadyInstalledTypes = dependencies.filter(d => /^@types\//.test(d));;
dependencies = dependencies.filter(d => !/^@types\//.test(d));


async function installAllDependencies(dependencies) {
    for (let dependency of dependencies) {
        const dependencyString = chalk.bold(dependency)

        // Check if types are already installed

        if (alreadyInstalledTypes.includes('@types/' + dependency)) {
            console.log(chalk.yellow(figures.play, `Types for ${dependencyString} already installed. Skipping...`));
            continue;
        }

        // Check for included types
        let pkgPath = path.join(cwd, 'node_modules', dependency, 'package.json');


        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (pkg.types || pkg.typings) {
                console.log(chalk.yellow(figures.warning, `Module ${dependencyString} includes own types. Skipping...`));
                continue;
            }
        }

        // Check if types are available    
        await installDependency(dependency);
    }
}

async function installDependency(dependency) {
    const dependencyString = chalk.bold(dependency);
    const res = await request({ uri: 'https://www.npmjs.com/package/@types/' + dependency, resolveWithFullResponse: true });

    let success = false;

    if (res.statusCode == 200) {

        if (res.body.indexOf("Installation") >= 0) {
            try {
                console.log(`Attempting to install @types/${dependencyString}...`);
                await exec(`yarn add --dev @types/${dependency}`);
                console.log(chalk.green(figures.tick, `@types/${dependencyString} installed successfully!`));
                success = true;
            } catch (err) {
                console.log(chalk.red(figures.cross, `@types/${dependencyString} failed: ${err}`));
            }
        } else {
            if (dependency !== dependency.toLowerCase()) {
                console.log(chalk.yellow(figures.warning, `Could not find types for casing @types/${dependencyString}. Trying lowercase.`));
                success = await installDependency(dependency.toLowerCase());
            }
        }

    }

    if (!success) {
        console.log(chalk.red(figures.cross, `No types found for ${dependencyString} in registry. Skipping...`));
    }

    return success;
}

installAllDependencies(dependencies);