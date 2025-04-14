#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Parse command-line arguments in the form: --key=value
// e.g. ./build-args.js --image=semgrep/semgrep --tag=1.114.0 --info-file=/path/to/image-index.json
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.split('=');
  acc[k.replace(/^--/, '')] = v;
  return acc;
}, {});

const imageName = args.image;
const imageTag = args.tag;
let infoFile = args['info-file'];

// Validate required arguments
if (!imageName || !imageTag) {
  console.error("Error: Missing --image=<imageName> or --tag=<imageTag>");
  process.exit(1);
}

// If no --info-file provided, either throw an error or fallback to a default:
if (!infoFile) {
  // Option A: throw an error:
  // console.error("Error: Missing --info-file parameter");
  // process.exit(1);

  // Option B: fallback to a default file:
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
const match = infoJson.find(entry => 
  entry.baseImage?.name === imageName &&
  entry.baseImage?.tag === imageTag
);

if (!match) {
  console.error(
    `Error: No matching entry for image='${imageName}' and tag='${imageTag}' in file '${infoFile}'`
  );
  process.exit(1);
}

const { host, name, tag } = match.baseImage;
const finalImage = `${host}/${name}:${tag}`;

console.log(`IMAGE=${finalImage}`);
