#!/usr/bin/env node
/**
 * check-github-update.mjs
 * Check and pull latest updates from GitHub using GITHUB_TOKEN in .env
 * Usage:  node scripts/check-github-update.mjs [--pull]
 */

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Read .env manually (avoids needing dotenv as a runtime dep) ──────────────
function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  if (!existsSync(envPath)) return {};
  const env = {};
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = value;
  }
  return env;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  const result = spawnSync(cmd, { shell: true, cwd: ROOT, encoding: 'utf-8', ...opts });
  return (result.stdout || '').trim();
}

function runOrThrow(cmd) {
  const result = spawnSync(cmd, { shell: true, cwd: ROOT, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Command failed: ${cmd}`);
  }
  return (result.stdout || '').trim();
}

// ── Main ─────────────────────────────────────────────────────────────────────
const env = loadEnv();
const token = env.GITHUB_TOKEN;

if (!token) {
  console.error('❌  GITHUB_TOKEN not found in .env');
  process.exit(1);
}

const doPull = process.argv.includes('--pull');

// Get current remote URL and inject token
const rawUrl = run('git remote get-url origin');
const urlWithToken = rawUrl.replace(
  /https?:\/\/(.*@)?/,
  `https://oauth2:${token}@`
);

// Temporarily set authenticated remote, fetch, then restore
try {
  runOrThrow(`git remote set-url origin "${urlWithToken}"`);
  console.log('🔄  Fetching from origin...');
  runOrThrow('git fetch origin');
} finally {
  // Always restore the clean URL (no token in remote config)
  run(`git remote set-url origin "${rawUrl}"`);
}

// ── Compare local vs remote ──────────────────────────────────────────────────
const branch = run('git rev-parse --abbrev-ref HEAD');
const local  = run('git rev-parse HEAD');
const remote = run(`git rev-parse origin/${branch}`);

if (local === remote) {
  console.log(`✅  Already up to date (${branch})`);
  process.exit(0);
}

const behind = run(`git rev-list --count HEAD..origin/${branch}`);
const ahead  = run(`git rev-list --count origin/${branch}..HEAD`);

console.log(`\n📦  Branch: ${branch}`);
console.log(`    Local  : ${local.slice(0, 8)}`);
console.log(`    Remote : ${remote.slice(0, 8)}`);
console.log(`    Behind : ${behind} commit(s)   Ahead: ${ahead} commit(s)\n`);

if (Number(behind) > 0) {
  const log = run(`git log HEAD..origin/${branch} --oneline --no-decorate`);
  console.log('📋  New commits on remote:');
  console.log(log.split('\n').map(l => `    ${l}`).join('\n'));

  if (doPull) {
    console.log('\n⬇️   Pulling latest changes...');
    try {
      runOrThrow(`git remote set-url origin "${urlWithToken}"`);
      runOrThrow('git pull origin ' + branch);
    } finally {
      run(`git remote set-url origin "${rawUrl}"`);
    }
    console.log('✅  Pull complete.');
  } else {
    console.log('\n💡  Run with --pull to apply updates:');
    console.log('    node scripts/check-github-update.mjs --pull');
  }
}
