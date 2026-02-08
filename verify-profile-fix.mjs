#!/usr/bin/env node
/**
 * Quick verification script to check if profile persistence fixes are working
 * 
 * This script helps verify:
 * 1. Enhanced logging is in place
 * 2. Debug panel includes snapshot section
 * 3. Safety guards are active
 * 
 * Usage: node verify-profile-fix.mjs
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Verifying Profile Persistence Fixes...\n');

let allPassed = true;

// Test 1: Check enhanced logging in useAutosaveProfile.ts
console.log('✓ Test 1: Enhanced logging in useAutosaveProfile.ts');
try {
  const hookFile = readFileSync(join(__dirname, 'src/hooks/useAutosaveProfile.ts'), 'utf-8');
  
  const checks = [
    { pattern: /critical_fields:/i, name: 'Critical fields logging' },
    { pattern: /__lastProfileSavePayload/i, name: 'Window storage for debug panel' },
    { pattern: /criticalFields/i, name: 'Critical fields object' },
    { pattern: /Object\.keys\(body\)\.length === 0/i, name: 'Empty save guard' },
    { pattern: /missingCritical/i, name: 'Missing fields validation' }
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(hookFile)) {
      console.log(`  ✓ ${check.name}`);
    } else {
      console.log(`  ✗ ${check.name} - NOT FOUND`);
      allPassed = false;
    }
  });
} catch (err) {
  console.log(`  ✗ Error reading file: ${err.message}`);
  allPassed = false;
}

console.log('');

// Test 2: Check debug panel snapshot section
console.log('✓ Test 2: Debug panel snapshot section');
try {
  const debugPanelFile = readFileSync(join(__dirname, 'src/components/AthleteProfileDebugPanel.tsx'), 'utf-8');
  
  const checks = [
    { pattern: /ProfileSnapshotSection/i, name: 'ProfileSnapshotSection component' },
    { pattern: /__lastProfileSavePayload/i, name: 'Window payload access' },
    { pattern: /Profile Snapshot/i, name: 'Snapshot section UI' },
    { pattern: /criticalFields/i, name: 'Critical fields display' }
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(debugPanelFile)) {
      console.log(`  ✓ ${check.name}`);
    } else {
      console.log(`  ✗ ${check.name} - NOT FOUND`);
      allPassed = false;
    }
  });
} catch (err) {
  console.log(`  ✗ Error reading file: ${err.message}`);
  allPassed = false;
}

console.log('');

// Test 3: Check test file exists
console.log('✓ Test 3: Verification test page');
try {
  const testFile = readFileSync(join(__dirname, 'verify-profile-fields-test.html'), 'utf-8');
  
  const checks = [
    { pattern: /Profile Persistence Test/i, name: 'Test page title' },
    { pattern: /verifyInitialSave/i, name: 'Initial save verification' },
    { pattern: /testPersistence/i, name: 'Persistence test function' },
    { pattern: /TEST_FIELDS/i, name: 'Test data defined' }
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(testFile)) {
      console.log(`  ✓ ${check.name}`);
    } else {
      console.log(`  ✗ ${check.name} - NOT FOUND`);
      allPassed = false;
    }
  });
} catch (err) {
  console.log(`  ✗ Error reading file: ${err.message}`);
  allPassed = false;
}

console.log('');
console.log('─'.repeat(60));

if (allPassed) {
  console.log('✅ All fixes verified! Ready to test.\n');
  console.log('Next steps:');
  console.log('1. Start dev server: npm run dev');
  console.log('2. Open app with ?debug=1: http://localhost:5173?debug=1');
  console.log('3. Navigate to Athlete Profile');
  console.log('4. Fill in multiple fields and save');
  console.log('5. Check browser console for [Profile Save] logs');
  console.log('6. Check debug panel for Profile Snapshot section');
  console.log('7. Refresh page and verify all fields persist');
  console.log('\nFor comprehensive test:');
  console.log('- Open verify-profile-fields-test.html and follow instructions');
} else {
  console.log('❌ Some fixes missing or incomplete.\n');
  console.log('Please ensure all code changes were applied correctly.');
  process.exit(1);
}
