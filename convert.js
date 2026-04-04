const fs = require('fs');
const { execSync } = require('child_process');

try {
  // If sharp isn't installed natively, this will attempt to pull it down or run natively via package runner if possible
  const sharp = require('sharp');
  sharp('./electron/icon.svg')
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile('./electron/icon.png')
    .then(() => console.log('Successfully generated icon.png'))
    .catch(err => console.error('Sharp error:', err));
} catch (e) {
  console.log("Sharp not installed locally, falling back to pure buffer generation or asking user." + e.message);
}
