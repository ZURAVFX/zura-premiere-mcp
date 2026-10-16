// Deterministic helpers shared by every MCP installation. No host writes or pixel detection.
const number = {type:'number'};
const requiredNumber = (minimum:number, maximum:number) => ({type:'number',minimum,maximum});
function finite(value:unknown,name:string,min:number,max:number):number {
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(`${name} must be finite in [${min}, ${max}].`);
 return value;
}
function wrap(fn:(args:any)=>unknown){return async(args:any)=>{try{return {success:true,data:fn(args)};}catch(e){return {success:false,error:e instanceof Error?e.message:String(e)};}};}
export function planSlowHorizontalCorrection(a:any){
 const fps=finite(a.frame_rate,'frame_rate',1,120), duration=finite(a.duration_seconds,'duration_seconds',1/fps,600);
 const x=finite(a.initial_x,'initial_x',-100000,100000),y=finite(a.y,'y',-100000,100000);
 const speed=finite(a.max_speed_pixels_per_second??40,'max_speed_pixels_per_second',0.1,1000);
 if(typeof a.shot_id!=='string'||!a.shot_id.trim()||typeof a.subject_id!=='string'||!a.subject_id.trim())throw Error('One continuous shot_id and subject_id are required. Split camera cuts and speakers first.');
 if(!Array.isArray(a.corrections)||a.corrections.length>20)throw Error('Provide at most 20 measured corrections.');
 const intervals:any[]=[];let previousEnd=0,from=x;
 for(const c of a.corrections){
  const start=finite(c.start_seconds,'start_seconds',0,duration),end=finite(c.end_seconds,'end_seconds',0,duration);
  const target=finite(c.target_x,'target_x',-100000,100000);
  if(end<=start||start<previousEnd||typeof c.reason!=='string'||!c.reason.trim())throw Error('Corrections must be ordered, non-overlapping and have a measured movement reason.');
  const peak=1.875*Math.abs(target-from)/(end-start);
  if(peak>speed)throw Error(`Correction exceeds speed limit: ${peak.toFixed(2)} px/s. Extend its duration or reduce its distance.`);
  intervals.push({...c,from_x:from,peak_speed_pixels_per_second:peak});from=target;previousEnd=end;
 }
 const count=Math.ceil(duration*fps);if(count>1000)throw Error('Path exceeds 1000 keys. Split at a real shot boundary or use a lower planning frame rate with explicit review.');
 const keys=Array.from({length:count},(_,i)=>{const t=i/fps;let px=x;for(const c of intervals){if(t<c.start_seconds)break;if(t>=c.end_seconds){px=c.target_x;continue;}const u=(t-c.start_seconds)/(c.end_seconds-c.start_seconds);px=c.from_x+(c.target_x-c.from_x)*(6*u**5-15*u**4+10*u**3);break;}return {time_seconds:t,x:px,y};});
 return {applied:false,shot_id:a.shot_id,subject_id:a.subject_id,keys,corrections:intervals,horizontal_only:true,apply_tool:'set_clip_position_path_batch',verification_required:'Review actual export for centring, black edges, identity and smoothness. This tool plans supplied corrections; it does not detect or track a subject. Y and Scale must remain fixed. Never use across camera cuts or speaker changes.'};
}
export function verifyHeadCentering(a:any){
 const width=finite(a.width,'width',16,32768),height=finite(a.height,'height',16,32768),tol=finite(a.tolerance_percent??1,'tolerance_percent',0.001,10);
 if(!Array.isArray(a.samples)||a.samples.length<3||a.samples.length>300)throw Error('Provide 3–300 exported-frame measurements per continuous shot.');
 const seen=new Set<number>();
 const samples=a.samples.map((s:any)=>{
  const time=finite(s.time_seconds,'time_seconds',0,86400);if(seen.has(time))throw Error('Sample times must be unique.');seen.add(time);
  if(!Array.isArray(s.head_box)||s.head_box.length!==4)throw Error('head_box must be [left, top, right, bottom] in exported pixels.');
  const [l,t,r,b]=s.head_box.map((v:unknown)=>finite(v,'head_box',0,32768));
  if(r<=l||b<=t||r>width||b>height)throw Error('Head bounds are invalid or outside the output frame.');
  if(!['settled','temporary-drift'].includes(s.phase))throw Error('Declare settled or temporary-drift phase.');
  if(s.phase==='temporary-drift'&&(a.mode!=='slow-rare'||typeof s.reason!=='string'||!s.reason.trim()))throw Error('Temporary drift needs slow-rare mode and a movement reason.');
  const error=(l+r)/2-width/2;
  return {...s,signed_error_pixels:error,error_percent:Math.abs(error)/width*100,within_tolerance:Math.abs(error)<=width*tol/100,evidence_verified:s.full_head_verified===true&&typeof s.evidence==='string'&&!!s.evidence.trim()};
 }).sort((a:any,b:any)=>a.time_seconds-b.time_seconds);
 const settled=samples.filter((s:any)=>s.phase==='settled');if(!settled.length)throw Error('At least one settled sample is required; every sample cannot be exempted.');
 return {applied:false,samples,tolerance_percent:tol,sampled_settled_centres_pass:settled.every((s:any)=>s.within_tolerance),evidence_verified:samples.every((s:any)=>s.evidence_verified),whole_shot_approved:false,scope:'Arithmetic on supplied exported-frame full-head measurements only. No pixel detection or automatic approval. Review opening/middle/end, movement extremes, both sides of cuts and playback. Temporary drift is explicit and does not excuse an off-centre settled target.'};
}
export function getFramingReviewTools(){return {
 plan_slow_horizontal_correction:{description:'Plan bounded, quintic eased horizontal-only Motion corrections for one measured continuous shot/subject. Holds between corrections; rejects excessive speed. Pure local computation, no detection or host changes.',parameters:{type:'object' as const,additionalProperties:false,properties:{shot_id:{type:'string'},subject_id:{type:'string'},frame_rate:requiredNumber(1,120),duration_seconds:requiredNumber(0.001,600),initial_x:number,y:number,max_speed_pixels_per_second:requiredNumber(0.1,1000),corrections:{type:'array',maxItems:20,items:{type:'object',additionalProperties:false,properties:{start_seconds:number,end_seconds:number,target_x:number,reason:{type:'string'}},required:['start_seconds','end_seconds','target_x','reason']}}},required:['shot_id','subject_id','frame_rate','duration_seconds','initial_x','y','corrections']},handler:wrap(planSlowHorizontalCorrection)},
 verify_head_centering:{description:'Measure horizontal head-centre error from supplied full-head boxes in exported pixels. Separates settled targets and declared slow-rare temporary drift. Never claims to detect heads or approve unseen footage.',parameters:{type:'object' as const,additionalProperties:false,properties:{width:requiredNumber(16,32768),height:requiredNumber(16,32768),tolerance_percent:requiredNumber(0.001,10),mode:{type:'string',enum:['static','slow-rare']},samples:{type:'array',minItems:3,maxItems:300,items:{type:'object',additionalProperties:false,properties:{time_seconds:number,head_box:{type:'array',minItems:4,maxItems:4,items:number},phase:{type:'string',enum:['settled','temporary-drift']},reason:{type:'string'},full_head_verified:{type:'boolean'},evidence:{type:'string'}},required:['time_seconds','head_box','phase','full_head_verified','evidence']}}},required:['width','height','mode','samples']},handler:wrap(verifyHeadCentering)}
};}
