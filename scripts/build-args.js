#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.split('=');
  acc[k.replace(/^--/, '')] = v;
  return acc;
}, {});

const imageName = args.image;
const imageTag = args.tag;
const infoFile = path.join(__dirname, 'image-info.json'); // adjust if needed

if (!imageName || !imageTag) {
  console.error("Error: Missing --image or --tag");
  process.exit(1);
}

const infoJson = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
const match = infoJson.find(entry => 
  entry.baseImage?.name === imageName && 
  entry.baseImage?.tag === imageTag
);

if (!match) {
  console.error(`Error: No matching entry for image='${imageName}' and tag='${imageTag}' in image-info.json`);
  process.exit(1);
}

const { host, name, tag } = match.baseImage;
const finalImage = `${host}/${name}:${tag}`;

console.log(`IMAGE=${finalImage}`);
