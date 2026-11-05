import { describe, it, expect } from 'vitest';
// @ts-expect-error standalone installer module has no declaration file
import { updateSource } from '../scripts/update-source.mjs';

describe('source update routing', () => {
  it('prefers the public Reels updater even when the retired channel is installed', () => {
    const calls: string[][] = [];
    updateSource({ run: (_command: string, args: string[]) => { calls.push(args); return args[0] === 'plugin' ? JSON.stringify({ installed: [
      { pluginId: 'zura-premiere-reels@oa-motion-software', enabled: true, source: { path: '/retired' } },
      { pluginId: 'zura-premiere-reels@zura-vfx-reels', enabled: true, source: { path: '/public' } },
    ] }) : ''; }, exists: () => true });
    expect(calls).toHaveLength(2);
    expect(calls[1][0].replaceAll('\\', '/')).toBe('/public/scripts/update-zura-premiere-reels.mjs');
  });
  it.each([true, false])('migrates a retired channel (enabled=%s) through public Reels source', (enabled) => {
    const calls: string[][] = []; const head = 'a'.repeat(40);
    updateSource({ run: (_command: string, args: string[]) => {
      calls.push(args);
      return args[0] === 'plugin' ? JSON.stringify({ installed: [{ pluginId: 'zura-premiere-reels@oa-motion-software', enabled, source: { path: '/retired' } }] }) : args.includes('ls-remote') || args.includes('rev-parse') ? head : '';
    }, exists: () => false, mkdir: () => undefined });
    expect(calls.some(args => args.includes('https://github.com/ZURAVFX/zura-premiere-reels.git'))).toBe(true);
    expect(calls.at(-2)?.[0].replaceAll('\\', '/')).toContain('/plugin/scripts/update-zura-premiere-reels.mjs');
    expect(calls.some(args => args.some(a => a.includes('/retired') || a.includes('OA_Motion_Software_Plugins')))).toBe(false);
    expect(calls.some(args => args[0]?.endsWith('INSTALL-ZURA-PREMIERE-MCP.mjs'))).toBe(false);
  });
  it('checks legacy migration without cloning or installing', () => {
    const calls: string[][] = [];
    updateSource({ check: true, run: (_command: string, args: string[]) => {
      calls.push(args);
      return args[0] === 'plugin' ? JSON.stringify({ installed: [{ pluginId: 'zura-premiere-reels@oa-motion-software' }] }) : 'a'.repeat(40);
    } });
    expect(calls).toHaveLength(2);
  });
  it('refuses disabled or incomplete public plugins without using the retired updater', () => {
    for (const plugin of [
      { pluginId: 'zura-premiere-reels@zura-vfx-reels', enabled: false },
      { pluginId: 'zura-premiere-reels@zura-vfx-reels', enabled: true },
      { pluginId: 'zura-premiere-reels@zura-vfx-reels', enabled: true, source: { path: '/missing' } },
    ]) {
      const calls: string[][] = [];
      expect(() => updateSource({ run: (_command: string, args: string[]) => {
        calls.push(args); return JSON.stringify({ installed: [plugin] });
      }, exists: () => false })).toThrow(/public/);
      expect(calls).toHaveLength(1);
    }
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
