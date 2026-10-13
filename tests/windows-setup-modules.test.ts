import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {describe,it,expect} from 'vitest';
describe('Windows setup launched from another PowerShell host',()=>{
 it('restores native module discovery before installer commands',()=>{
  for(const name of ['INSTALL-ZURA-PREMIERE-MCP.ps1','scripts/install-zura-premiere-mcp.ps1']){
   const script=readFileSync(name,'utf8');
   expect(script).toContain('$env:PSModulePath = "$PSHOME\\Modules;$env:PSModulePath"');
   expect(script.indexOf('$env:PSModulePath =')).toBeLessThan(script.indexOf(name.startsWith('scripts/')?'$setupStarted = Get-Date':'$installer = Join-Path'));
  }
 });
 it.runIf(process.platform==='win32')('loads SHA-256 hashing with an incompatible inherited module path',()=>{
  const script='$ErrorActionPreference="Stop"; $env:PSModulePath="$PSHOME\\Modules;$env:PSModulePath"; (Get-FileHash -LiteralPath "package.json" -Algorithm SHA256).Hash';
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:30000,env:{...process.env,PSModulePath:'C:\\Zura-nonexistent-inherited-modules'}});
  expect(result.status,result.stderr).toBe(0);
  expect(result.stdout.trim()).toMatch(/^[A-F0-9]{64}$/);
 });
});
