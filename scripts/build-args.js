#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Parse command-line arguments in the form: --key=value
// e.g. ./build-args.js --registry-mode=dockerhub --image=semgrep/semgrep --tag=1.114.0 --info-file=./image-info.json
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.split('=');
  acc[k.replace(/^--/, '')] = v;
  return acc;
}, {});

const registryMode = args['registry-mode'];
const imageName = args.image;              
const imageTag = args.tag;                 
let infoFile = args['info-file'];

// Validate required arguments
if (!registryMode || !imageName || !imageTag) {
  console.error(
    "Error: Must pass --registry-mode=<mode>, --image=<imageName>, and --tag=<imageTag>."
  );
  process.exit(1);
}

// If no --info-file provided, either throw an error or fallback to a default:
if (!infoFile) {
  // Optionally fallback to local image-info.json
  infoFile = path.join(__dirname, 'image-info.json');
}

// Resolve the infoFile path. If it's not absolute, join it relative to this script's directory.
if (!path.isAbsolute(infoFile)) {
  infoFile = path.join(__dirname, infoFile);
}

if (!fs.existsSync(infoFile)) {
  console.error(`Error: The file '${infoFile}' does not exist.`);
  process.exit(1);
}

// Read and parse the JSON
const infoJson = JSON.parse(fs.readFileSync(infoFile, 'utf8'));

// Find the matching entry by name + tag
const match = infoJson.find(
  entry => entry.baseImage?.name === imageName && entry.baseImage?.tag === imageTag
);

if (!match) {
  console.error(
    `Error: No matching entry for image='${imageName}' and tag='${imageTag}' in '${infoFile}'`
  );
  process.exit(1);
}

// Expect "hosts" array inside baseImage
const { name, tag, hosts } = match.baseImage;
if (!hosts || !Array.isArray(hosts) || hosts.length === 0) {
  console.error(
    `Error: The 'hosts' array is missing or empty for '${imageName}:${imageTag}' in '${infoFile}'`
  );
  process.exit(1);
}

// Pick the correct host from the array based on registryMode
let chosenHost = null;
switch (registryMode) {
  case 'dockerhub':
  case 'dockerhub_pat':
    // Look for DockerHub reference, e.g. "index.docker.io" or "docker.io"
    chosenHost = hosts.find(h => h.includes('docker.io'));
    break;

  case 'ecr':
  case 'ecr_iam':
    // Look for something containing "amazonaws.com"
    chosenHost = hosts.find(h => h.includes('login-ecr'));
    break;

  default:
    console.error(`Error: Unknown or unsupported registry-mode='${registryMode}'`);
    process.exit(1);
}

if (!chosenHost) {
  console.error(
    `Error: The hosts array [${hosts.join(', ')}] has no match for registryMode='${registryMode}'.`
  );
  process.exit(1);
}

// Construct the final Docker reference
const finalImage = `${chosenHost}/${name}:${tag}`;

// Output for GitHub Actions (IMAGE=...)
console.log(`IMAGE=${finalImage}`);
