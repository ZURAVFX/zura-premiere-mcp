import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as ort from 'onnxruntime-node';
import { PNG } from 'pngjs';
import ffmpeg from 'ffmpeg-static';

const hash='88d4531297118f595bf2fd60f6f566aec2e559393802d1f436c380f0cbbd2828';
const modelUrl='https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx';
export async function ensureModel() {
  const root=path.join(process.env.LOCALAPPDATA || path.join(os.homedir(),'.cache'),'ZuraPremiereMCP','models');
  await fs.mkdir(root,{recursive:true});
  const target=path.join(root,'rvm_mobilenetv3_fp32.onnx');
  try {const bytes=await fs.readFile(target);if(createHash('sha256').update(bytes).digest('hex')===hash)return target;}catch{}
  const response=await fetch(modelUrl,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error(`Model download failed: ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('Model checksum mismatch');
  const temp=target+'.'+process.pid+'.tmp';
  await fs.writeFile(temp,bytes,{flag:'wx'});
  await fs.rename(temp,target);
  return target;
}
export async function render(a) {
  if(!path.isAbsolute(a.input_path)||!path.isAbsolute(a.output_directory)||!Number.isSafeInteger(a.frame_count)||a.frame_count<1||a.frame_count>36000||!Number.isSafeInteger(a.start_frame??0)||(a.start_frame??0)<0)throw Error('Invalid frame range or paths');
  if(!(await fs.stat(a.input_path)).isFile())throw Error("Input is not a file");
  try {await fs.access(a.output_directory);throw Error("Output directory already exists");} catch(e) {if(e.code!=="ENOENT")throw e;}
  const model=await ensureModel();
  const session=await ort.InferenceSession.create(model,{executionProviders:['cpu'],intraOpNumThreads:4});
  await fs.mkdir(a.output_directory,{recursive:false});
  const child=spawn(ffmpeg,['-v','error','-i',a.input_path,'-vf',`select=gte(n\\,${a.start_frame??0})`,'-frames:v',String(a.frame_count),'-vsync','0','-f','image2pipe','-c:v','png','pipe:1'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let error='';child.stderr.on('data',b=>{error=(error+b).slice(-4000);});
  const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error(error)));});
  done.catch(()=>{});
  let buffer=Buffer.alloc(0),count=0,width=0,height=0;
  let states=Array.from({length:4},()=>new ort.Tensor('float32',new Float32Array(1),[1,1,1,1]));
  const start=Date.now();
  try {
    for await(const chunk of child.stdout){
      buffer=Buffer.concat([buffer,chunk]);
      while(buffer.length>=8){
        let end=8,complete=false;
        while(end+12<=buffer.length){const size=buffer.readUInt32BE(end);if(end+12+size>buffer.length)break;const type=buffer.toString('ascii',end+4,end+8);end+=size+12;if(type==='IEND'){complete=true;break;}}
        if(!complete)break;
        const image=PNG.sync.read(buffer.subarray(0,end));buffer=buffer.subarray(end);
        width=image.width;height=image.height;if(width*height>16777216)throw Error("Input exceeds 16 megapixels");const pixels=width*height;
        const src=new Float32Array(pixels*3);
        for(let p=0;p<pixels;p++)for(let c=0;c<3;c++)src[c*pixels+p]=image.data[p*4+c]/255;
        const feed={src:new ort.Tensor('float32',src,[1,3,height,width]),downsample_ratio:new ort.Tensor('float32',new Float32Array([Math.min(1,300/Math.max(width,height))]),[1])};
        states.forEach((s,i)=>feed[`r${i+1}i`]=s);
        const result=await session.run(feed);states=states.map((_,i)=>result[`r${i+1}o`]);
        const out=new PNG({width,height});
        for(let p=0;p<pixels;p++){for(let c=0;c<3;c++)out.data[p*4+c]=Math.round(Math.max(0,Math.min(1,result.fgr.data[c*pixels+p]))*255);out.data[p*4+3]=Math.round(Math.max(0,Math.min(1,result.pha.data[p]))*255);}
        count++;await fs.writeFile(path.join(a.output_directory,`frame_${String(count).padStart(6,'0')}.png`),PNG.sync.write(out));
      }
    }
    await done;if(count!==a.frame_count)throw Error('Source ended before requested frame count');
    const receipt={frames:count,width,height,start_frame:a.start_frame??0,alpha:'straight',elapsed_seconds:(Date.now()-start)/1000,model_sha256:hash,first_frame:path.join(a.output_directory,'frame_000001.png'),visual_review_required:true};
    await fs.writeFile(path.join(a.output_directory,'receipt.json'),JSON.stringify(receipt,null,2));return receipt;
  }finally{child.kill();await session.release();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--setup')console.log(JSON.stringify({model:await ensureModel()}));
  else console.log(JSON.stringify(await render(JSON.parse(process.argv[2]))));
}
