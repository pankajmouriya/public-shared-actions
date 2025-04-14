#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.split('=');
  acc[k.replace(/^--/, '')] = v;
  return acc;
}, {});

const infoFilePath = args['info-file'];
const imageName = args.image;
const imageTag = args.tag;

if (!infoFilePath) {
  console.error("Error: Missing --info-file=<pathToInfo.json>");
  process.exit(1);
}
if (!imageName || !imageTag) {
  console.error("Error: Must provide --image and --tag");
  process.exit(1);
}

// read info.json
const rawData = fs.readFileSync(infoFilePath, 'utf-8');
const info = JSON.parse(rawData);

// find the matching entry
const matchingEntry = info.find(entry =>
  entry.baseImage?.name === imageName &&
  entry.baseImage?.tag === imageTag
);

if (!matchingEntry) {
  console.error(`Error: No matching entry for image='${imageName}' tag='${imageTag}'`);
  process.exit(1);
}

const {host, name, tag} = matchingEntry.baseImage;
const finalImage = `${host}/${name}:${tag}`;
console.log(`IMAGE=${finalImage}`);
