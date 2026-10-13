import { buildToolScript, escapeForExtendScript } from '../bridge/script-builder.js';
import { sendCommand, BridgeOptions } from '../bridge/file-bridge.js';
type PathClip={node_id:string;keys:Array<{time_seconds:number;x:number;y:number}>};
export function positionPathTool(bridgeOptions:BridgeOptions){
  return {
    description:'Apply measured native Motion Position paths to up to 20 static clips in the active sequence in one CEP command. Pixel coordinates, clip-relative seconds. Refuses existing Position animation and Auto Reframe; preflights all targets. Reads every key back. Linear interpolation is requested but cannot be read back: rendered motion verification remains required. Never use for transitions between speakers or camera shots.',
    parameters:{type:'object' as const,additionalProperties:false,properties:{sequence_id:{type:'string',minLength:1,maxLength:256,description:'Verified active sequence ID.'},clips:{type:'array',minItems:1,maxItems:20,description:'Independent continuous shots with one identified performer per path.',items:{type:'object',additionalProperties:false,properties:{node_id:{type:'string',minLength:1,maxLength:256,description:'Verified timeline video clip node ID.'},keys:{type:'array',minItems:2,maxItems:1000,description:'Strictly increasing clip-relative times and Motion coordinates in sequence pixels. Maximum 4000 keys in the entire request.',items:{type:'object',additionalProperties:false,properties:{time_seconds:{type:'number',minimum:0,description:'Seconds from the first visible frame of this clip.'},x:{type:'number',description:'Motion X in sequence pixels.'},y:{type:'number',description:'Motion Y in sequence pixels.'}},required:['time_seconds','x','y']}}},required:['node_id','keys']}}},required:['sequence_id','clips']},
    handler:async(args:{sequence_id:string;clips:PathClip[]})=>{
      if(!args||typeof args.sequence_id!=='string'||!args.sequence_id||args.sequence_id.length>256||!Array.isArray(args.clips)||args.clips.length<1||args.clips.length>20)return {success:false,error:'Provide sequence_id (up to 256 characters) and 1–20 continuous clip paths.'};
      const ids=new Set<string>();let count=0;
      for(const clip of args.clips){if(!clip||typeof clip.node_id!=='string'||!clip.node_id||clip.node_id.length>256||ids.has(clip.node_id)||!Array.isArray(clip.keys)||clip.keys.length<2||clip.keys.length>1000)return {success:false,error:'Unique clip IDs and 2–1000 keys per clip are required.'};ids.add(clip.node_id);let previous=-1;for(const key of clip.keys){if(!key||!Number.isFinite(key.time_seconds)||key.time_seconds<0||key.time_seconds<=previous||!Number.isFinite(key.x)||!Number.isFinite(key.y))return {success:false,error:'Times must be finite, non-negative and strictly increasing; coordinates must be finite.'};previous=key.time_seconds;}count+=clip.keys.length;}
      if(count>4000)return {success:false,error:'Limit is 4000 keys per request.'};
      const entries=args.clips.map(c=>`{node_id:"${escapeForExtendScript(c.node_id)}",keys:${JSON.stringify(c.keys)}}`).join(',');
      return sendCommand(buildToolScript(`
        var seq=app.project.activeSequence;
        if(!seq||String(seq.sequenceID)!=="${escapeForExtendScript(args.sequence_id)}")return __error("Active sequence changed; nothing was changed.");
        var entries=[${entries}],targets=[],verified=[];
        for(var i=0;i<entries.length;i++){
          var found=__findClip(entries[i].node_id);
          if(!found||found.trackType!=="video")return __error("Video clip missing; nothing was changed.");
          var motion=null;
          for(var c=0;c<found.clip.components.numItems;c++){
            var component=found.clip.components[c];
            var name=(String(component.matchName||"")+String(component.displayName||"")).toLowerCase().replace(/[^a-z]/g,"");
            if(name.indexOf("autoreframe")>=0)return __error("Auto Reframe remains; reconstruct this shot from original media. Nothing was changed.");
            if(component.matchName==="AE.ADBE Motion"||component.displayName==="Motion")motion=component;
          }
          if(!motion)return __error("Motion missing; nothing was changed.");
          var point=null,pointCount=0;
          for(var p=0;p<motion.properties.numItems;p++){
            var property=motion.properties[p];
            if(__videoIntrinsicPropertyMatches(property,"Position")){point=property;pointCount++;}
            if(__videoIntrinsicPropertyMatches(property,"Scale")||__videoIntrinsicPropertyMatches(property,"Scale Height")||__videoIntrinsicPropertyMatches(property,"Scale Width")){
              if(property.isTimeVarying())return __error("Scale must be static before applying a Position path; nothing was changed.");
            }
          }
          if(pointCount!==1||!point.areKeyframesSupported()||point.isTimeVarying())return __error("Position must be an unambiguous, static keyframe-capable property; nothing was changed.");
          var units=__motionPointScale(point,__sequenceFrameSize(seq));
          var base=__clipKeyframeBase(found.clip);
          if(!units||!base.ok)return __error("Motion units or clip timebase unreadable; nothing was changed.");
          for(var k=0;k<entries[i].keys.length;k++)if(entries[i].keys[k].time_seconds>=base.durationSeconds)return __error("Key is outside the visible clip; nothing was changed.");
          targets.push({point:point,units:units,base:base});
        }
        for(var j=0;j<entries.length;j++){
          var target=targets[j],entry=entries[j];
          var partial={verifiedClips:verified,failedNodeId:entry.node_id,mutationAttempted:true,outcome:"committed_unverified",verified:false,retrySafe:false};
          try{
            target.point.setTimeVarying(true);
            for(var w=0;w<entry.keys.length;w++){
              var key=entry.keys[w],time=__clipKeyTime(target.base,key.time_seconds);
              var value=[key.x*target.units.x,key.y*target.units.y];
              target.point.addKey(time);target.point.setValueAtKey(time,value,true);
              target.point.setInterpolationTypeAtKey(time,0,true);
              var read=target.point.getValueAtKey(time);
              var tolerance=target.units.normalized?0.00001:0.01;
              if(!read||read.length<2||Math.abs(read[0]-value[0])>tolerance||Math.abs(read[1]-value[1])>tolerance)return __error("Position key readback mismatch.",partial);
            }
            var observed=target.point.getKeys();
            if(!observed||observed.length!==entry.keys.length)return __error("Position key count mismatch.",partial);
            verified.push({node_id:entry.node_id,keyCount:observed.length,keyValuesVerified:true});
          }catch(error){return __error("Position path failed: "+error.toString(),partial);}
        }
        return __result({sequenceId:String(seq.sequenceID),verifiedClips:verified,keyValuesVerified:true,interpolationVerified:false,outcome:"committed_unverified",verified:false,verificationScope:"Stored Position keys only. Linear interpolation was requested, but Premiere has no interpolation getter. Inspect an actual video export to verify smoothness, identity and centering."});
      `),bridgeOptions);
    }
  };
}
