import {beforeEach,describe,expect,it,vi} from 'vitest';
import {runInNewContext} from 'node:vm';
import {parse} from 'acorn';
import {getHelpersSource} from '../../src/bridge/script-builder.js';
vi.mock('../../src/bridge/file-bridge.js',()=>({sendCommand:vi.fn()}));
import {sendCommand} from '../../src/bridge/file-bridge.js';
import {positionPathTool} from '../../src/tools/position-path.js';
const send=vi.mocked(sendCommand),tool=positionPathTool({tempDir:'/tmp/test'}),T=254016000000;
const args={sequence_id:'s',clips:[{node_id:'c',keys:[{time_seconds:0,x:540,y:960},{time_seconds:1,x:600,y:960}]}]};
beforeEach(()=>vi.clearAllMocks());
function host(options:{animated?:boolean;scaleAnimated?:boolean;auto?:boolean;speed?:number;badRead?:boolean}={}){
 const keys=new Map<number,number[]>();let animated=options.animated||false;
 const point={displayName:'Position',getValue:()=>[.5,.5],areKeyframesSupported:()=>true,isTimeVarying:()=>animated,setTimeVarying:(v:boolean)=>{animated=v},addKey:(t:{ticks:string})=>keys.set(Number(t.ticks),[.5,.5]),setValueAtKey:(t:{ticks:string},v:number[])=>keys.set(Number(t.ticks),v),getValueAtKey:(t:{ticks:string})=>options.badRead?[0,0]:keys.get(Number(t.ticks)),setInterpolationTypeAtKey:vi.fn(),getKeys:()=>[...keys.keys()].map(ticks=>({ticks:String(ticks)}))};
 const scale={displayName:'Scale',isTimeVarying:()=>!!options.scaleAnimated};
 const motion={matchName:'AE.ADBE Motion',displayName:'Motion',properties:{numItems:2,0:point,1:scale}};
 const clip={nodeId:'c',start:{ticks:String(25*T)},end:{ticks:String(35*T)},inPoint:{ticks:String(30*T)},getSpeed:()=>options.speed||1,isSpeedReversed:()=>false,components:{numItems:options.auto?2:1,0:motion,1:{displayName:'Auto Reframe'}}};
 const seq={sequenceID:'s',frameSizeHorizontal:1080,frameSizeVertical:1920,videoTracks:{numTracks:1,0:{clips:{numItems:1,0:clip}}},audioTracks:{numTracks:0}};
 function Time(this:{ticks:string}){this.ticks='0';}
 send.mockImplementation(async script=>JSON.parse(String(runInNewContext(getHelpersSource()+'\n'+script,{app:{project:{activeSequence:seq}},Time}))));
 return {keys,point};
}
describe('batch native Position paths',()=>{
 it('uses media-relative times and pixel conversion, with honest interpolation scope',async()=>{
  const h=host();const result=await tool.handler(args);
  expect(result).toMatchObject({success:true,data:{keyValuesVerified:true,interpolationVerified:false,verified:false,outcome:'committed_unverified'}});
  expect(h.keys.get(30*T)).toEqual([.5,.5]);expect(h.keys.get(31*T)).toEqual([600/1080,.5]);
  parse(String(send.mock.calls[0][0]),{ecmaVersion:3,allowReserved:'never'});
 });
 it.each([{animated:true},{scaleAnimated:true},{auto:true},{speed:2}])('refuses unsafe existing state before writing: %j',async opts=>{
  const h=host(opts);expect(await tool.handler(args)).toMatchObject({success:false});expect(h.keys.size).toBe(0);
 });
 it('refuses stale sequence and out-of-clip times before writing',async()=>{
  const h=host();expect(await tool.handler({...args,sequence_id:'wrong'})).toMatchObject({success:false});
  expect(await tool.handler({...args,clips:[{...args.clips[0],keys:[args.clips[0].keys[0],{time_seconds:10,x:0,y:0}]}]})).toMatchObject({success:false});expect(h.keys.size).toBe(0);
 });
 it('reports a partial failed write without allowing blind retry',async()=>{
  host({badRead:true});expect(await tool.handler(args)).toMatchObject({success:false,data:{failedNodeId:'c',verified:false,retrySafe:false}});
 });
 it('rejects malformed timing and identifiers without dispatch',async()=>{
  for(const time of [-.5,0,NaN,Infinity])expect(await tool.handler({...args,clips:[{...args.clips[0],keys:[args.clips[0].keys[0],{time_seconds:time,x:0,y:0}]}]})).toMatchObject({success:false});
  expect(await tool.handler({...args,sequence_id:'x'.repeat(257)})).toMatchObject({success:false});expect(send).not.toHaveBeenCalled();
 });
});
