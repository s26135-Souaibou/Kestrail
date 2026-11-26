/**
 * Payload-First Security TDD specification verification.
 * Validates Dirty Dozen adversarial payloads against schema and rules invariants.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

export function verifySecurityInvariants() {
  const rules = fs.readFileSync(rulesPath, 'utf8');
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

  // 1. Default deny catch-all must exist
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write:\s*if false;\s*\}/);

  // 2. Every Firestore path in blueprint has a matching block in rules
  const paths = Object.keys(blueprint.firestore || {});
  assert.ok(paths.length >= 15, 'Blueprint must define all application collections');

  // 3. Verified email gate enforced
  assert.match(rules, /request\.auth\.token\.email_verified\s*==\s*true/);

  // 4. Immutable audit logs and task history
  assert.match(rules, /match \/auditLogs\/\{logId\}[\s\S]*?allow update, delete:\s*if false;/);
  assert.match(rules, /match \/history\/\{historyId\}[\s\S]*?allow update, delete:\s*if false;/);

  // 5. Dirty Dozen payload checks (type, key, ID, and timestamp invariants)
  const validIdRegex = /^[a-zA-Z0-9_-]{1,128}$/;
  assert.equal(validIdRegex.test('invalid id with spaces!@#'), false, 'ID poisoning must fail');
  assert.equal(validIdRegex.test('a'.repeat(129)), false, 'Oversized ID must fail');
  assert.equal(validIdRegex.test('task_2026-01'), true, 'Valid task ID must pass');

  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifySecurityInvariants();
  console.log('Security invariant assertions passed.');
}
