import { describe, it, expect } from 'vitest';
// @ts-expect-error standalone installer module has no declaration file
import { updateSource } from '../scripts/update-source.mjs';

describe('source update routing', () => {
  it('routes OA members through the private updater without cloning public source', () => {
    const calls: string[][] = [];
    updateSource({ run: (_command: string, args: string[]) => { calls.push(args); return args[0] === 'plugin' ? JSON.stringify({ installed: [{ pluginId: 'zura-premiere-reels@oa-motion-software', enabled: true, source: { path: '/oa' } }] }) : ''; }, exists: () => true });
    expect(calls).toHaveLength(2);
    expect(calls[1][0]).toContain('update-zura-premiere-reels.mjs');
  });
  it('refuses to overwrite a modified standalone source', () => {
    const head = 'a'.repeat(40);
    const run = (_command: string, args: string[]) => args[0] === 'plugin' ? '{"installed":[]}' : args.includes('ls-remote') || args.includes('rev-parse') ? head : args.includes('status') ? ' M package.json' : '';
    expect(() => updateSource({ run, exists: () => true, mkdir: () => undefined })).toThrow(/local changes/);
  });
  it('installs only a fresh checkout matching the resolved remote head', () => {
    const calls: string[][] = []; const head = 'a'.repeat(40);
    updateSource({ run: (_command: string, args: string[]) => { calls.push(args); return args[0] === 'plugin' ? '{"installed":[]}' : args.includes('ls-remote') || args.includes('rev-parse') ? head : ''; }, exists: () => false, mkdir: () => undefined });
    expect(calls.some(args => args[0] === 'clone')).toBe(true);
    expect(calls.some(args => args[0].endsWith('INSTALL-ZURA-PREMIERE-MCP.mjs'))).toBe(true);
  });
});
