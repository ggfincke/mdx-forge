// scripts/check-publish-version.mjs
// validate release tag, package version & npm publish availability

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const tagVersion = getTagVersion();

if (tagVersion !== packageJson.version) {
  fail(`Tag v${tagVersion} does not match package.json ${packageJson.version}`);
}

const publishHistory = getPublishHistory(packageJson.name);

if (publishHistory[packageJson.version]) {
  fail(
    `${packageJson.name}@${packageJson.version} has already been used on npm`
  );
}

console.log(`  ${packageJson.name}@${packageJson.version} can be published`);

function getTagVersion() {
  const releaseVersion = process.env.VERSION;

  if (releaseVersion) {
    return releaseVersion;
  }

  const refName = process.env.GITHUB_REF_NAME ?? '';

  if (refName.startsWith('v')) {
    return refName.slice(1);
  }

  fail('Missing release version. Set VERSION or run from a v* tag');
}

function getPublishHistory(packageName) {
  const output = execFileSync('npm', ['view', packageName, 'time', '--json'], {
    encoding: 'utf8',
  });

  return JSON.parse(output);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
