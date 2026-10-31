import { describe, it, expect } from 'vitest';
import { getPersonMatteTools } from '../../src/tools/person-matte.js';
import { capabilitiesForToolInvocation } from '../../src/security/capabilities.js';
describe('person matte boundary', () => {
  it('requires filesystem authority', () => {
    expect(capabilitiesForToolInvocation('render_person_matte',{})).toContain('filesystem');
  });
  it('rejects relative paths and invalid counts before launching a process', async () => {
    const tool=getPersonMatteTools().render_person_matte;
    for(const frame_count of [0,36001,NaN,1.5]) expect(await tool.handler({input_path:'relative',frame_rate:60,output_directory:'relative',frame_count})).toMatchObject({success:false});
  });
});
