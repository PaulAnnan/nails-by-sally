#!/usr/bin/env node
// generate-icons.js
// Generates PWA icons from a source image
// Usage: node generate-icons.js source-image.png

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outputDir = './public/icons';

async function generateIcons(sourcePath) {
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Generating icons from: ${sourcePath}`);

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    
    await sharp(sourcePath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 241, g: 74, b: 166, alpha: 1 } // --pink2 color
      })
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Generated ${size}x${size} icon`);
  }

  console.log('All icons generated successfully!');
}

// Get source image from command line
const sourceImage = process.argv[2] || './public/sffsfs.png';

if (!fs.existsSync(sourceImage)) {
  console.error(`Error: Source image not found: ${sourceImage}`);
  console.log('Usage: node generate-icons.js <source-image.png>');
  process.exit(1);
}

generateIcons(sourceImage).catch(console.error);
