#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

function execute(command, args, capture = false) {
  if (command === 'codex' && process.platform === 'win32') {
    const script = `& (Get-Command codex.cmd -ErrorAction Stop).Source @(${args.map(a => `'${a.replace(/'/g, "''")}'`).join(',')}); exit $LASTEXITCODE`;
    command = 'powershell.exe';
    args = ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
  }
  const r = spawnSync(command, args, { windowsHide: true, ...(capture ? { encoding: 'utf8', timeout: 60000 } : { stdio: 'inherit' }) });
  if (r.error || r.status !== 0) throw Error(`${command} failed: ${r.error?.message || r.status}. No automatic retry performed.`);
  return r.stdout?.trim() || '';
}

export function updateSource({ check = false, run = execute, home = homedir(), mkdir = mkdirSync, exists = existsSync } = {}) {
  const plugins = JSON.parse(run('codex', ['plugin', 'list', '--json'], true));
  const reels = plugins.installed?.find(p => p.pluginId === 'zura-premiere-reels@zura-vfx-reels');
  if (reels) {
    if (!reels.enabled) throw Error('Enable the public Zura Premiere Reels plugin before updating its managed MCP.');
    const updater = join(reels.source?.path || '', 'scripts', 'update-zura-premiere-reels.mjs');
    if (!reels.source?.path || !exists(updater)) throw Error('The public Reels updater is missing. Follow setup at https://github.com/ZURAVFX/zura-premiere-reels to repair the plugin.');
    if (check) { console.log('Reels-managed installation: use the public Zura Premiere Reels update skill to verify the complete plugin and pinned MCP.'); return; }
    run(process.execPath, [updater]); return;
  }
  // Recognise the retired channel only to migrate it. Never execute its updater.
  const migrateReels = plugins.installed?.some(p => p.pluginId === 'zura-premiere-reels@oa-motion-software');
  const repository = migrateReels
    ? 'https://github.com/ZURAVFX/zura-premiere-reels.git'
    : 'https://github.com/ZURAVFX/zura-premiere-mcp.git';
  const head = run('git', ['ls-remote', repository, 'refs/heads/main'], true).split(/\s/)[0];
  if (!/^[a-f0-9]{40}$/.test(head)) throw Error('Could not verify latest Zura source commit.');
  if (check) { console.log(`Latest public Zura ${migrateReels ? 'Reels migration' : 'MCP'} source: ${head}`); return; }
  const parent = join(home, '.zura', migrateReels ? 'premiere-reels-sources' : 'premiere-mcp-sources');
  const source = join(parent, head);
  mkdir(parent, { recursive: true });
  if (!exists(source)) run('git', ['clone', '--depth', '1', '--branch', 'main', repository, source]);
  if (run('git', ['-C', source, 'rev-parse', 'HEAD'], true) !== head) throw Error('Main changed during download. No installation was performed; rerun once.');
  if (run('git', ['-C', source, 'status', '--porcelain'], true)) throw Error('The versioned source folder has local changes. Preserve them before updating.');
  run(process.execPath, [migrateReels ? join(source, 'plugin', 'scripts', 'update-zura-premiere-reels.mjs') : join(source, 'INSTALL-ZURA-PREMIERE-MCP.mjs')]);
  if (run('git', ['ls-remote', repository, 'refs/heads/main'], true).split(/\s/)[0] !== head) throw Error('Installed the verified source, but main changed during setup. Rerun to receive the newer release.');
  console.log(`Installed Zura public source ${head}. No apps restarted. Follow the installer restart instructions.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { updateSource({ check: process.argv.includes('--check') }); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
