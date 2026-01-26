#!/usr/bin/env node
/**
 * Guard script to prevent submodule reintroduction.
 * Fails the build if:
 * - .gitmodules file exists
 * - git ls-tree contains mode 160000 (gitlink entries)
 * 
 * This runs in prevercel-build to catch issues before deployment.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');

let errors = [];

// Check 1: .gitmodules file should not exist
const gitmodulesPath = join(repoRoot, '.gitmodules');
if (existsSync(gitmodulesPath)) {
  errors.push('ERROR: .gitmodules file exists at repository root');
}

// Check 2: No gitlink entries (mode 160000) in HEAD
try {
  const lsTreeOutput = execSync('git ls-tree -r HEAD', {
    cwd: repoRoot,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  const gitlinkLines = lsTreeOutput
    .split('\n')
    .filter(line => line.includes(' 160000 '));
  
  if (gitlinkLines.length > 0) {
    errors.push(`ERROR: Found ${gitlinkLines.length} gitlink entry/entries (mode 160000) in HEAD:`);
    gitlinkLines.forEach(line => {
      errors.push(`  ${line.trim()}`);
    });
  }
} catch (err) {
  // If git command fails, that's also an error
  errors.push(`ERROR: Failed to check git tree: ${err.message}`);
}

// Report results
if (errors.length > 0) {
  console.error('\n❌ SUBMODULE GUARD FAILED:\n');
  errors.forEach(err => console.error(err));
  console.error('\nThis build will fail to prevent submodule-related deployment issues.');
  console.error('To fix:');
  console.error('  1. Remove .gitmodules file if it exists');
  console.error('  2. Remove any gitlink entries: git rm --cached <path>');
  console.error('  3. Commit the removal');
  console.error('  4. Ensure vercel.json contains: "git": { "submodules": false }\n');
  process.exit(1);
} else {
  console.log('✅ Submodule guard passed: No .gitmodules or gitlink entries detected');
  process.exit(0);
}
