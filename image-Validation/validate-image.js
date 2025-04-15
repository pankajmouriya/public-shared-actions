#!/usr/bin/env node

/**
 * validate-image.js
 *
 * Usage:
 *   ./validate-image.js \
 *     --registry-mode=dockerhub \
 *     --image=semgrep/semgrep \
 *     --tag=1.114.0 \
 *     --info-file=./image-index.json
 *
 * This script:
 * 1. Parses command-line arguments.
 * 2. Validates that the specified image + tag is in the JSON index file.
 * 3. Chooses the correct registry host based on registryMode (dockerhub vs. ecr).
 * 4. Prints out "IMAGE=<host>/<name>:<tag>" for consumption by GitHub Actions.
 */

const fs = require('fs');
const path = require('path');

// Helper function to log an error and exit with code 1
function exitWithError(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

// Parse arguments, e.g. --image=semgrep/semgrep => args.image = "semgrep/semgrep"
const rawArgs = process.argv.slice(2);
const args = rawArgs.reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace(/^--/, '')] = value;
  return acc;
}, {});

// Required arguments
const registryMode = args['registry-mode']; // e.g. "dockerhub", "ecr_iam"
const imageName = args.image;               // e.g. "semgrep/semgrep"
const imageTag = args.tag;                  // e.g. "1.114.0"
let infoFilePath = args['info-file'];

// Verify we have all required CLI params
if (!registryMode || !imageName || !imageTag) {
  exitWithError('Must pass --registry-mode=<mode>, --image=<imageName>, and --tag=<imageTag>.');
}

// Verify the user provided --info-file
if (!infoFilePath) {
  exitWithError('Missing --info-file argument. You must explicitly provide image-index.json.');
}

// Resolve the info-file path (either absolute or relative to this script)
if (!path.isAbsolute(infoFilePath)) {
  infoFilePath = path.join(__dirname, infoFilePath);
}

// Ensure the file exists
if (!fs.existsSync(infoFilePath)) {
  exitWithError(`The file "${infoFilePath}" does not exist. Check the --info-file path.`);
}

// Parse the image index JSON
const imageIndex = JSON.parse(fs.readFileSync(infoFilePath, 'utf8'));

// Locate the matching entry for this image + tag
const matchedEntry = imageIndex.find(
  (entry) => entry.baseImage?.name === imageName && entry.baseImage?.tag === imageTag
);

if (!matchedEntry) {
  exitWithError(`No matching entry for "${imageName}:${imageTag}" in "${infoFilePath}".`);
}

// Expect an array of "hosts"
const { name, tag, hosts } = matchedEntry.baseImage;
if (!hosts || !Array.isArray(hosts) || hosts.length === 0) {
  exitWithError(`The 'hosts' array is missing or empty for "${imageName}:${imageTag}".`);
}

// Pick the correct host based on registryMode
let chosenHost;
switch (registryMode) {
  case 'dockerhub':
  case 'dockerhub_pat':
    // We look for something containing "docker.io"
    chosenHost = hosts.find((h) => h.includes('docker.io'));
    break;

  case 'ecr':
  case 'ecr_iam':
    // We look for a placeholder that we'll swap out with ECR_REGISTRY
    chosenHost = hosts.find((h) => h.includes('ECR_REGISTRY_URI'));
    break;

  default:
    exitWithError(`Unknown or unsupported registry-mode="${registryMode}".`);
}

if (!chosenHost) {
  exitWithError(
    `The hosts array [${hosts.join(', ')}] has no valid entry for registryMode="${registryMode}".`
  );
}

if (chosenHost.includes('ECR_REGISTRY_URI')) {
  const ecrRegistry = process.env.ECR_REGISTRY; // e.g. "123456789012.dkr.ecr.us-east-1.amazonaws.com"
  if (!ecrRegistry) {
    exitWithError('ECR_REGISTRY_URI was chosen, but ECR_REGISTRY is not set in the environment.');
  }
  chosenHost = chosenHost.replace('ECR_REGISTRY_URI', ecrRegistry);
}

// Construct the final Docker reference
const finalImage = `${chosenHost}/${name}:${tag}`;

// Print the result for GitHub Actions (IMAGE=...)
console.log(`IMAGE=${finalImage}`);
