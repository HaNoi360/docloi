const MIME_TYPES=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
export class Recorder {
  constructor({onTick=()=>{},onDone=()=>{},onState=()=>{},onChunk=()=>{}}={}){this.onChunk=onChunk;this.onTick=onTick;this.onDone=onDone;this.onState=onState;this.recorder=null;this.chunks=[];this.startedAt=0;this.timer=null;this.drawFrame=0;this.canvas=null;this.canvasStream=null}
  static supportedMime(){return MIME_TYPES.find(type=>window.MediaRecorder?.isTypeSupported?.(type))||''}
  start(cameraStream,video,ratio='9:16'){
    if(!window.MediaRecorder)throw new Error('Trình duyệt này chưa hỗ trợ ghi video.');
    // Ghi hình ảnh camera qua canvas để xuất đúng tỷ lệ; tuyệt đối không vẽ chữ/giao diện lên canvas.
    const portrait=ratio==='9:16';
    const source=video.videoWidth&&video.videoHeight?{width:video.videoWidth,height:video.videoHeight}:{width:1920,height:1080};
    const maxSide=1920;
    let width=portrait?1080:1920, height=portrait?1920:1080;
    if(source.width<width||source.height<height){const scale=Math.min(1,source.width/width,source.height/height);width=Math.max(2,Math.floor(width*scale/2)*2);height=Math.max(2,Math.floor(height*scale/2)*2)}
    this.canvas=document.createElement('canvas');this.canvas.width=width;this.canvas.height=height;
    const ctx=this.canvas.getContext('2d',{alpha:false});
    const draw=()=>{
      if(!this.canvas||!video.videoWidth){this.drawFrame=requestAnimationFrame(draw);return}
      const sw=video.videoWidth,sh=video.videoHeight,target=width/height,sourceRatio=sw/sh;
      let sx=0,sy=0,cw=sw,ch=sh;
      if(sourceRatio>target){cw=sh*target;sx=(sw-cw)/2}else{ch=sw/target;sy=(sh-ch)/2}
      ctx.drawImage(video,sx,sy,cw,ch,0,0,width,height);
      this.drawFrame=requestAnimationFrame(draw);
    };
    this.drawFrame=requestAnimationFrame(draw);
    this.canvasStream=this.canvas.captureStream(30);
    cameraStream.getAudioTracks().forEach(track=>this.canvasStream.addTrack(track));
    const mimeType=Recorder.supportedMime();const options={...(mimeType?{mimeType}:{}),videoBitsPerSecond:8000000,audioBitsPerSecond:192000};
    this.chunks=[];this.recorder=new MediaRecorder(this.canvasStream,options);
    this.recorder.ondataavailable=e=>{if(e.data&&e.data.size){this.chunks.push(e.data);this.onChunk(this.chunks.length-1,e.data)}};
    this.recorder.onerror=e=>this.onState('error',e.error||new Error('Lỗi khi ghi video.'));
    this.recorder.onstop=()=>this.finish();
    this.recorder.start(500);
    this.startedAt=performance.now();
    this.onState('recording');
    this.timer=setInterval(()=>this.onTick(performance.now()-this.startedAt),200);
    return this.startedAt;
  }
  stop(){if(this.recorder&&this.recorder.state!=='inactive'){this.recorder.stop();clearInterval(this.timer);this.timer=null;cancelAnimationFrame(this.drawFrame);this.canvasStream?.getVideoTracks().forEach(track=>track.stop())}}
  finish(){const type=this.recorder?.mimeType||this.chunks[0]?.type||'video/webm';const blob=new Blob(this.chunks,{type});const ext=type.includes('mp4')?'mp4':'webm';const url=URL.createObjectURL(blob);this.onDone({blob,url,filename:`teleprompter-${new Date().toISOString().replace(/[:.]/g,'-')}.${ext}`,type,size:blob.size,width:this.canvas?.width,height:this.canvas?.height,audioBitsPerSecond:this.recorder?.audioBitsPerSecond||0,videoBitsPerSecond:this.recorder?.videoBitsPerSecond||0});this.onState('ready');this.canvas=null;this.canvasStream=null}
}
