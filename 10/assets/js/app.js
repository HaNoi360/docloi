import {Camera} from './camera.js';
import {Recorder} from './recorder.js';
import {Prompter} from './prompter.js';
import {Settings,Progress} from './settings.js';
import {Storage} from './storage.js';
import {parseSrt} from './srt.js';
const $=id=>document.getElementById(id);
const stage=$('stage'),video=$('cameraPreview'),placeholder=$('cameraPlaceholder'),startCamera=$('startCamera');
const message=s=>{$('appMessage').textContent=s};
const fmt=ms=>{const sec=Math.floor(ms/1000);return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`};
let countdownCancelled=false,drawerOpen=false,startingRecording=false;
// ---- Cấu hình đã lưu ----
const saved=Settings.load();
const setVal=(id,v)=>{const el=$(id);if(!el||v===undefined||v===null)return;const def=el.value;el.value=v;if(el.value!==String(v)&&el.tagName==='SELECT')el.value=def};
['speedRange','fontRange','shadeRange','textAlign','countdownSelect','audioMode','srtRate'].forEach(id=>setVal(id,saved[id]));
let userScript=typeof saved.script==='string'?saved.script:$('scriptInput').value;
$('scriptInput').value=userScript;
let audioDeviceId=typeof saved.audioDevice==='string'?saved.audioDevice:'';
let srtState=null;
const camera=new Camera(video,(state,settings,devices=[])=>{
  if(state==='connected'){
    cameraWanted=true;scheduleSave();
    $('cameraStatus').textContent='● Camera sẵn sàng';$('cameraStatus').style.color='#8df0bd';
    $('qualityLabel').textContent=`Camera: ${settings.width||'Auto'} × ${settings.height||'Auto'}`;
    placeholder.hidden=true;$('recordButton').disabled=false;$('recordHint').textContent='Sẵn sàng ghi hình';
    const micSelect=$('audioDevice');
    const selected=micSelect.value||audioDeviceId||camera.deviceId;
    micSelect.innerHTML='<option value="">Tự động (thiết bị mặc định)</option>';
    devices.forEach((device,index)=>{const option=document.createElement('option');option.value=device.deviceId;option.textContent=device.label||`Micro ${index+1}`;micSelect.appendChild(option)});
    if(selected&&[...micSelect.options].some(option=>option.value===selected))micSelect.value=selected;
    const audio=settings.audio||{};
    const yesNo=value=>value===undefined?'không báo cáo':(value?'Bật':'Tắt');
    $('audioStatus').textContent=settings.audioLabel||'Đã kết nối';
    $('audioDiagnostics').textContent=`Micro: ${settings.audioLabel||'Không rõ tên'} · ${audio.sampleRate||'Auto'} Hz · ${audio.channelCount||'?' } kênh. AGC: ${yesNo(audio.autoGainControl)} · Khử nhiễu: ${yesNo(audio.noiseSuppression)} · Khử vọng: ${yesNo(audio.echoCancellation)}.`;
    if(!devices.length)$('audioDiagnostics').textContent+=' Chrome không cung cấp danh sách thiết bị đầu vào.';
    message('Camera và micro đã sẵn sàng. Hãy thu thử âm thanh trước khi quay chính thức nếu cần.');
  }
  if(state==='stopped'){$('cameraStatus').textContent='● Chưa kết nối';placeholder.hidden=false;$('recordButton').disabled=true;$('recordHint').textContent='Camera chưa sẵn sàng'}
});
const prompter=new Prompter({input:$('scriptInput'),text:$('promptText'),speed:$('speedRange'),font:$('fontRange'),shade:$('shadeRange'),align:$('textAlign'),start:$('scrollStart'),pause:$('scrollPause'),reset:$('scrollReset')});
prompter.setOutputs({speedValue:$('speedValue'),fontValue:$('fontValue'),shadeValue:$('shadeValue')});
prompter.onScrub=saveProgress;
prompter.onEnd=()=>message('Đã chạy hết file SRT.');

// ---- SRT ----
function updateRateLabel(){$('srtRateValue').textContent=`${$('srtRate').value}%`;prompter.setRate($('srtRate').value/100)}
function applySrt(name,text){
  const cues=parseSrt(text);
  if(!cues.length){message('Không đọc được cue nào trong file SRT. Hãy kiểm tra định dạng thời gian 00:00:01,000 --> 00:00:03,000.');return false}
  if(!srtState)userScript=$('scriptInput').value;
  srtState={name,text};
  $('scriptInput').value=cues.map(c=>c.text).join('\n\n');
  $('scriptInput').readOnly=true;$('clearScript').disabled=true;
  prompter.setCues(cues);
  const total=cues[cues.length-1].end;
  $('srtInfo').textContent=`${name} · ${cues.length} cue · dài ${fmt(total*1000)}. Chữ cuộn theo thời gian trong file; thời gian 0 là lúc bấm Bắt đầu quay (hoặc Chạy chữ).`;
  $('srtClear').hidden=false;$('srtRateRow').hidden=false;$('speedRange').disabled=true;
  updateRateLabel();
  return true;
}
function clearSrt(){
  srtState=null;
  $('scriptInput').readOnly=false;$('clearScript').disabled=false;
  $('scriptInput').value=userScript;
  prompter.setCues(null);
  $('srtInfo').textContent='Chưa nạp file. Lời thoại đang cuộn theo tốc độ cố định bên dưới.';
  $('srtClear').hidden=true;$('srtRateRow').hidden=true;$('speedRange').disabled=false;
}
$('srtLoad').addEventListener('click',()=>$('srtFile').click());
$('srtFile').addEventListener('change',async()=>{
  const file=$('srtFile').files?.[0];if(!file)return;
  try{const text=await file.text();if(applySrt(file.name,text)){message(`Đã nạp ${file.name}.`);scheduleSave()}}
  catch(e){message(`Không đọc được file: ${e.message}`)}
  $('srtFile').value='';
});
$('srtClear').addEventListener('click',()=>{clearSrt();message('Đã gỡ SRT, quay lại cuộn theo tốc độ cố định.');scheduleSave()});
$('srtRate').addEventListener('input',updateRateLabel);
window.addEventListener('resize',()=>prompter.measure());
const recorder=new Recorder({onChunk:(i,blob)=>Storage.addChunk(i,blob),onTick:ms=>$('recordTimer').textContent=fmt(ms),onState:(state,err)=>{
  if(state==='recording'){$('recordButton').disabled=true;$('stopButton').disabled=false;$('recordingDot').hidden=false;$('recordHint').textContent='Đang ghi hình và tự cuộn chữ…'}
  if(state==='ready'){$('recordButton').disabled=false;$('stopButton').disabled=true;$('recordingDot').hidden=true;$('recordHint').textContent='Bản ghi đã hoàn tất.'}
  if(state==='error'){message(err.message);$('stopButton').disabled=true;$('recordButton').disabled=false}
},onDone:result=>{$('downloadLink').href=result.url;$('downloadLink').download=result.filename;$('resultInfo').textContent=`${result.filename} · ${(result.size/1024/1024).toFixed(1)} MB · ${result.type} · Âm thanh ${Math.round((result.audioBitsPerSecond||0)/1000)} kbps`; Storage.saveVideo(result);$('resultPanel').hidden=false;message('Video đã được tạo. Nhấn “Lưu video” để tải về điện thoại.')}});

function openDrawer(){drawerOpen=true;stage.classList.add('drawer-open');$('controlsSection').classList.add('open');$('controlsSection').setAttribute('aria-hidden','false');$('drawerBackdrop').hidden=false;scheduleSave()}
function closeDrawer(){drawerOpen=false;stage.classList.remove('drawer-open');$('controlsSection').classList.remove('open');$('controlsSection').setAttribute('aria-hidden','true');$('drawerBackdrop').hidden=true;scheduleSave()}
$('settingsToggle').addEventListener('click',()=>drawerOpen?closeDrawer():openDrawer());$('closeDrawer').addEventListener('click',closeDrawer);$('drawerBackdrop').addEventListener('click',closeDrawer);$('drawerHandle').addEventListener('click',openDrawer);

async function enterFullscreen(){try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen()}catch(e){console.info('Fullscreen API unavailable; immersive layout remains active.',e)}}
$('fullscreenToggle').addEventListener('click',async()=>{if(document.fullscreenElement){try{await document.exitFullscreen()}catch{}}else await enterFullscreen()});
startCamera.addEventListener('click',()=>startCameraFlow({fullscreen:true}));
async function startCameraFlow({fullscreen=true}={}){
  startCamera.disabled=true;message('Đang yêu cầu quyền camera và micro…');
  if(fullscreen)await enterFullscreen();
  try{
    const deviceId=$('audioDevice').value||audioDeviceId;
    try{await camera.start({audioMode:$('audioMode').value,deviceId})}
    catch(err){if(!deviceId||err.message.startsWith('NotAllowedError'))throw err;camera.stop();await camera.start({audioMode:$('audioMode').value,deviceId:''});message('Micro đã lưu không còn kết nối, đang dùng micro mặc định.')}
  }catch(e){console.error('Teleprompter camera error:',e);message(`Không mở được camera. ${e.name||'Error'}: ${e.message}. Hãy kiểm tra quyền Camera và Microphone của trang trong Chrome.`)}finally{startCamera.disabled=false}
}


let audioTestRecorder=null,audioTestTimer=null,audioTestUrl=null;
$('audioTestButton').addEventListener('click',()=>{
  if(audioTestRecorder&&audioTestRecorder.state!=='inactive')return;
  if(!camera.stream){message('Hãy bật camera và micro trước khi thu thử.');return;}
  if(recorder.recorder?.state==='recording'){message('Không thể thu thử micro khi video đang quay.');return;}
  const track=camera.stream.getAudioTracks()[0];
  if(!track){message('Không tìm thấy luồng âm thanh. Hãy kiểm tra quyền micro và đầu thu GoChek.');return;}
  const audioStream=new MediaStream([track]);
  const types=['audio/webm;codecs=opus','audio/mp4;codecs=mp4a.40.2','audio/webm','audio/mp4'];
  const mimeType=types.find(type=>MediaRecorder.isTypeSupported?.(type))||'';
  try{
    const chunks=[];
    audioTestRecorder=new MediaRecorder(audioStream,mimeType?{mimeType,audioBitsPerSecond:192000}:{audioBitsPerSecond:192000});
    audioTestRecorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data)};
    audioTestRecorder.onerror=event=>{clearInterval(audioTestTimer);audioTestTimer=null;$('audioTestButton').disabled=false;$('audioTestButton').textContent='Thu âm thử 10 giây';message(`Lỗi thu âm thử: ${event.error?.message||'Không xác định'}`)};
    audioTestRecorder.onstop=()=>{
      clearInterval(audioTestTimer);audioTestTimer=null;
      const blob=new Blob(chunks,{type:audioTestRecorder.mimeType||'audio/webm'});
      if(audioTestUrl)URL.revokeObjectURL(audioTestUrl);
      audioTestUrl=URL.createObjectURL(blob);
      const player=$('audioTestPlayback');player.src=audioTestUrl;player.hidden=false;
      $('audioTestButton').disabled=false;$('audioTestButton').textContent='Thu âm thử lại 10 giây';
      $('audioStatus').textContent='Đã thu thử – hãy nghe lại';
      message('Đã thu xong 10 giây. Nhấn nút phát để kiểm tra giọng GoChek trước khi quay.');
    };
    audioTestRecorder.start(200);
    let remaining=10;
    $('audioTestButton').disabled=true;$('audioTestButton').textContent=`Đang thu… ${remaining}s`;
    $('audioTestPlayback').hidden=true;
    audioTestTimer=setInterval(()=>{remaining--;if(remaining>0)$('audioTestButton').textContent=`Đang thu… ${remaining}s`;else{clearInterval(audioTestTimer);audioTestTimer=null;if(audioTestRecorder?.state==='recording')audioTestRecorder.stop()}},1000);
    message('Hãy nói tự nhiên trong 10 giây.');
  }catch(error){$('audioTestButton').disabled=false;$('audioTestButton').textContent='Thu âm thử 10 giây';message(`Không thể thu thử: ${error.name||'Error'}: ${error.message}`)}
});

$('applyAudio').addEventListener('click',async()=>{
  if(!camera.stream){message('Hãy bật camera trước khi cấu hình micro.');return;}
  if(audioTestRecorder&&audioTestRecorder.state!=='inactive'){message('Hãy đợi thu âm thử hoàn tất.');return;}
  if(recorder.recorder?.state==='recording'){message('Hãy kết thúc video trước khi thay đổi micro.');return;}
  const button=$('applyAudio');button.disabled=true;button.textContent='Đang áp dụng…';
  const mode=$('audioMode').value,deviceId=$('audioDevice').value;
  try{
    camera.stop();
    await camera.start({audioMode:mode,deviceId});
    message('Đã áp dụng cấu hình micro. Anh hãy nói thử và kiểm tra âm thanh.');
  }catch(error){
    console.error('Audio configuration failed:',error);
    message(`Không áp dụng được micro: ${error.name||'Error'}: ${error.message}`);
  }finally{button.disabled=false;button.textContent='Áp dụng cấu hình micro';}
});

async function runCountdown(seconds){
  countdownCancelled=false;
  if(!seconds)return true;
  $('countdownOverlay').hidden=false;
  $('countdownOverlay').querySelector('small').textContent='Chuẩn bị…';
  for(let n=seconds;n>=1;n--){if(countdownCancelled||!camera.stream){$('countdownOverlay').hidden=true;return false}$('countdownNumber').textContent=String(n);await new Promise(resolve=>setTimeout(resolve,1000))}
  $('countdownNumber').textContent='●';$('countdownOverlay').querySelector('small').textContent='Bắt đầu!';await new Promise(resolve=>setTimeout(resolve,250));$('countdownOverlay').hidden=true;return !countdownCancelled&&!!camera.stream;
}
$('recordButton').addEventListener('click',async()=>{
  if(!camera.stream||startingRecording||recorder.recorder?.state==='recording')return;
  startingRecording=true;
  const seconds=Number($('countdownSelect').value);
  $('recordButton').disabled=true;
  closeDrawer();
  if(prompter.hasCues)prompter.resetToTop();
  try {
    const countdownOK=await runCountdown(seconds);
    if(!countdownOK){$('recordButton').disabled=false;return;}
    $('resultPanel').hidden=true;
    $('recordTimer').textContent='00:00';
    const ratio=document.querySelector('.ratio-btn.active')?.dataset.ratio||'9:16';
    // Start the recorder first, then use its exact start timestamp as the prompt clock.
    const recordingStartTime=recorder.start(camera.stream,video,ratio);
    Storage.beginSession({mime:Recorder.supportedMime(),ratio,startedAt:Date.now()});
    prompter.stop();
    prompter.play(recordingStartTime);
    message('Đang quay: lời thoại đã tự động cuộn.');
  } catch(e) {
    console.error('Recording start failed:',e);
    message(`Không bắt đầu được ghi video: ${e.name||'Error'}: ${e.message}`);
    $('recordButton').disabled=false;
  } finally {
    startingRecording=false;
  }
});
$('stopButton').addEventListener('click',()=>{
  countdownCancelled=true;
  $('countdownOverlay').hidden=true;
  prompter.stop();
  recorder.stop();
});
$('clearScript').addEventListener('click',()=>{$('scriptInput').value='';userScript='';prompter.updateText();scheduleSave()});
function setRatio(ratio){document.querySelectorAll('.ratio-btn').forEach(b=>b.classList.toggle('active',b.dataset.ratio===ratio));stage.classList.toggle('ratio-9-16',ratio==='9:16');stage.classList.toggle('ratio-16-9',ratio==='16:9');prompter.measure()}
document.querySelectorAll('.ratio-btn').forEach(btn=>btn.addEventListener('click',()=>{setRatio(btn.dataset.ratio);scheduleSave()}));
// Swipe down anywhere near the top to reveal controls; swipe up to dismiss them.
let touchStartX=0,touchStartY=0,touchStartTarget=null;
stage.addEventListener('touchstart',e=>{if(!e.touches?.length)return;touchStartX=e.touches[0].clientX;touchStartY=e.touches[0].clientY;touchStartTarget=e.target},{passive:true});
stage.addEventListener('touchend',e=>{if(!e.changedTouches?.length)return;const dx=e.changedTouches[0].clientX-touchStartX,dy=e.changedTouches[0].clientY-touchStartY;if(Math.abs(dy)<55||Math.abs(dy)<Math.abs(dx)*1.25)return;if(e.target.closest('.drawer-scroll, textarea, input, select, button')||touchStartTarget?.closest?.('.prompt-overlay'))return;if(dy>0&&!drawerOpen)openDrawer();else if(dy<0&&drawerOpen)closeDrawer()},{passive:true});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&drawerOpen)closeDrawer()});
// ---- Lưu cấu hình ----
$('scriptInput').addEventListener('input',()=>{if(!srtState)userScript=$('scriptInput').value});
$('audioDevice').addEventListener('change',()=>{audioDeviceId=$('audioDevice').value});
function collectSettings(){
  return {
    script:userScript,speedRange:$('speedRange').value,fontRange:$('fontRange').value,shadeRange:$('shadeRange').value,
    textAlign:$('textAlign').value,countdownSelect:$('countdownSelect').value,audioMode:$('audioMode').value,
    audioDevice:audioDeviceId,srtRate:$('srtRate').value,
    ratio:document.querySelector('.ratio-btn.active')?.dataset.ratio||'9:16',
    srt:srtState?{name:srtState.name,text:srtState.text}:null,
    drawerOpen,cameraOn:cameraWanted
  };
}
let saveTimer=null,cameraWanted=!!saved.cameraOn;
function saveNow(){
  clearTimeout(saveTimer);saveTimer=null;
  const ok=Settings.save(collectSettings());
  $('saveState').textContent=ok?`Đã lưu ${new Date().toLocaleTimeString('vi-VN')}`:'Không lưu được (bộ nhớ trình duyệt bị chặn hoặc đầy)';
  $('saveState').style.color=ok?'':'#ff8a97';
}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,300)}
$('controlsSection').addEventListener('input',scheduleSave);
$('controlsSection').addEventListener('change',scheduleSave);
$('resetSettings').addEventListener('click',()=>{if(!confirm('Đặt lại toàn bộ cấu hình về mặc định?'))return;Settings.clear();Progress.clear();resetting=true;location.reload()});
let resetting=false;
window.addEventListener('pagehide',()=>{if(!resetting){saveNow();saveProgress()}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&!resetting){saveNow();saveProgress()}});

// ---- Khôi phục trạng thái đã lưu ----
setRatio(saved.ratio==='16:9'?'16:9':'9:16');
if(saved.srt?.text)applySrt(saved.srt.name||'file.srt',saved.srt.text);
else $('srtRateValue').textContent=`${$('srtRate').value}%`;
prompter.updateStyle();prompter.updateText();

// ---- Vị trí chữ đang cuộn ----
function saveProgress(){Progress.save({...prompter.getState(),savedAt:Date.now()})}
setInterval(()=>{if(prompter.running)saveProgress()},1500);
$('scrollPause').addEventListener('click',saveProgress);
prompter.setState(Progress.load());
if(saved.drawerOpen)openDrawer();

// ---- Video đã quay (khôi phục sau khi tắt app) ----
let restoredUrl=null;
function showSavedVideo(rec){
  if(restoredUrl)URL.revokeObjectURL(restoredUrl);
  restoredUrl=URL.createObjectURL(rec.blob);
  $('downloadLink').href=restoredUrl;$('downloadLink').download=rec.filename;
  $('resultInfo').textContent=`${rec.filename} · ${(rec.size/1024/1024).toFixed(1)} MB${rec.recovered?' · khôi phục từ lần quay bị ngắt giữa chừng (có thể thiếu vài giây cuối)':' · bản lưu của lần quay gần nhất'}`;
  $('resultPanel').hidden=false;
}
$('deleteVideo').addEventListener('click',async()=>{if(!confirm('Xóa bản video đã lưu trong ứng dụng? (File đã tải về máy không bị ảnh hưởng)'))return;await Storage.deleteVideo();$('resultPanel').hidden=true;message('Đã xóa bản video lưu trong ứng dụng.')});
(async()=>{
  Storage.persist();
  const rec=await Storage.loadLatest();
  if(rec){showSavedVideo(rec);if(rec.recovered){openDrawer();message('Lần quay trước bị ngắt giữa chừng. Đã khôi phục phần đã ghi, hãy bấm “Lưu video”.')}else message('Đã nạp lại video của lần quay gần nhất. Mở bảng điều khiển để lưu về máy.')}
  // Tự bật lại camera nếu lần trước đang bật và quyền đã được cấp (không cần chạm màn hình).
  if(cameraWanted&&navigator.permissions?.query){
    try{
      const [cam,mic]=await Promise.all(['camera','microphone'].map(name=>navigator.permissions.query({name})));
      if(cam.state==='granted'&&mic.state==='granted')startCameraFlow({fullscreen:false});
    }catch{/* trình duyệt không hỗ trợ query quyền: để người dùng bấm Bật camera */}
  }
})();

window.addEventListener('beforeunload',()=>{countdownCancelled=true;prompter.stop();camera.stop();if(audioTestTimer)clearInterval(audioTestTimer);if(audioTestUrl)URL.revokeObjectURL(audioTestUrl)});
if(location.protocol!=='https:'&&location.hostname!=='localhost'&&location.hostname!=='127.0.0.1')message('Camera cần HTTPS hoặc localhost. Hãy triển khai lên GitHub Pages/Cloudflare Pages.');
// ---- Cài đặt ứng dụng (PWA) ----
// Nút chỉ hiện ở bản chạy trong trình duyệt; bản đã cài (standalone/fullscreen) thì ẩn.
const isInstalled=()=>['standalone','fullscreen','minimal-ui'].some(m=>matchMedia(`(display-mode: ${m})`).matches)||navigator.standalone===true;
let deferredInstall=null;
function hideInstall(){$('installApp').hidden=true;$('installHint').hidden=true}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;if(!isInstalled())$('installApp').hidden=false});
window.addEventListener('appinstalled',()=>{deferredInstall=null;hideInstall();message('Đã cài đặt. Hãy mở app từ màn hình chính; app chạy được khi không có mạng.')});
$('installApp').addEventListener('click',async()=>{
  if(!deferredInstall)return;
  deferredInstall.prompt();
  try{await deferredInstall.userChoice}catch{}
  deferredInstall=null;hideInstall();
});
if(!isInstalled()&&/iphone|ipad|ipod/i.test(navigator.userAgent)){$('installHint').textContent='Trên iPhone/iPad: bấm Chia sẻ → Thêm vào MH chính.';$('installHint').hidden=false}
if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
