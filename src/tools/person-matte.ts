import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { isAbsolute } from 'node:path';
const exec = promisify(execFile);
export function getPersonMatteTools() {
  return {
    render_person_matte: {
      description: 'Generate a local recurrent person cutout as straight-alpha PNG frames using the bundled Node runtime and automatically downloaded checksum-verified RVM model. No Adobe UI or ComfyUI. Does not alter Premiere. Import the returned first_frame with import_image_sequence at the returned fps. Review hair and motion before use. Existing output directories are refused.',
      parameters: { type: 'object' as const, additionalProperties: false, properties: {
        input_path: {type:'string',description:'Absolute local webcam video path.'},
        frame_rate: {type:'number',minimum:1,maximum:240,description:'Verified source frame rate used to interpret the output sequence.'},
        output_directory: {type:'string',description:'New absolute output directory; must not exist.'},
        frame_count: {type:'integer',minimum:1,maximum:36000,description:'Exact number of frames to process.'},
        start_frame: {type:'integer',minimum:0,description:'First source frame, default zero. Process continuous shots separately.'},
      }, required:['input_path','output_directory','frame_count','frame_rate'] },
      handler: async (a: {input_path:string;frame_rate:number;output_directory:string;frame_count:number;start_frame?:number}) => {
        if (![a.input_path,a.output_directory].every(p=>typeof p==='string'&&isAbsolute(p)) || !Number.isFinite(a.frame_rate) || a.frame_rate<1 || a.frame_rate>240 || !Number.isSafeInteger(a.frame_count) || a.frame_count<1 || a.frame_count>36000 || !Number.isSafeInteger(a.start_frame??0) || (a.start_frame??0)<0) return {success:false,error:'Invalid absolute paths or frame range.'};
        try {
          const script=fileURLToPath(new URL('../../scripts/matte-runtime.mjs',import.meta.url));
          const {stdout}=await exec(process.execPath,[script,JSON.stringify(a)],{timeout:1800000,maxBuffer:1024*1024,windowsHide:true});
          const receipt=JSON.parse(stdout.trim());
          if(receipt.frames!==a.frame_count)throw Error('Output frame count mismatch');
          return {success:true,data:{...receipt,fps:a.frame_rate}};
        } catch(e) {return {success:false,error:String(e),data:{partial_files_possible:true,retry_requires_new_directory:true}};}
      },
    },
  };
}
