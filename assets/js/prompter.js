export class Prompter {
  constructor({input, text, speed, font, shade, align, start, pause, reset}) {
    Object.assign(this,{input,text,speed,font,shade,align,start,pause,reset});
    this.offset=0; this.running=false; this.last=0; this.frame=0;
    // Chế độ SRT: cuộn theo thời gian của từng cue thay vì tốc độ cố định.
    this.cues=null; this.keys=[]; this.time=0; this.base=0; this.rate=1; this.activeIndex=-1;
    this.onEnd=null; this.dragging=false;
    this.bind(); this.bindDrag(); this.updateText(); this.updateStyle();
  }
  get hasCues(){return !!this.cues}
  bind(){
    this.input.addEventListener('input',()=>{this.offset=0;this.updateText()});
    this.speed.addEventListener('input',()=>this.speedValue.textContent=this.speed.value);
    this.font.addEventListener('input',()=>this.updateStyle());
    this.shade.addEventListener('input',()=>this.updateStyle());
    this.align.addEventListener('change',()=>this.updateStyle());
    this.start.addEventListener('click',()=>this.play());
    this.pause.addEventListener('click',()=>this.stop());
    this.reset.addEventListener('click',()=>this.resetToTop());
  }
  // Kéo (vuốt) lên/xuống để tua chữ; nhả tay thì tiếp tục trôi theo tốc độ đã đặt.
  bindDrag(){
    const el=this.text.parentElement;
    let startY=0,startOffset=0,pid=null;
    const maxOffset=()=>this.cues?(this.keys.length?this.keys[this.keys.length-1].y:0):this.text.scrollHeight;
    el.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;
      this.dragging=true;pid=e.pointerId;startY=e.clientY;startOffset=this.offset;
      if(this.cues)this.measure();
      try{el.setPointerCapture(pid)}catch{}
      el.classList.add('dragging');
    });
    el.addEventListener('pointermove',e=>{
      if(!this.dragging||e.pointerId!==pid)return;
      this.offset=Math.max(0,Math.min(maxOffset(),startOffset-(e.clientY-startY)));
      if(this.cues){this.time=this.timeAt(this.offset);this.markActive()}
      this.render();
    });
    const end=e=>{
      if(!this.dragging||(e&&e.pointerId!==pid))return;
      this.dragging=false;pid=null;el.classList.remove('dragging');
      if(this.running){
        const now=performance.now();
        if(this.cues)this.base=now-this.time*1000/this.rate;
        else this.last=0;
      }
      this.onScrub?.();
    };
    el.addEventListener('pointerup',end);
    el.addEventListener('pointercancel',end);
    el.addEventListener('lostpointercapture',end);
  }
  // Ngược lại với yAt: từ độ cuộn suy ra thời gian trong SRT.
  timeAt(y){
    const keys=this.keys;
    if(!keys.length)return 0;
    const j=keys.findIndex(k=>k.y>y);
    if(j<0)return keys[keys.length-1].t;
    if(j===0)return keys[0].t;
    const a=keys[j-1],b=keys[j];
    return a.t+(b.t-a.t)*((y-a.y)/(b.y-a.y));
  }
  setOutputs({speedValue,fontValue,shadeValue}){this.speedValue=speedValue;this.fontValue=fontValue;this.shadeValue=shadeValue;this.updateOutputs()}
  updateOutputs(){if(this.speedValue)this.speedValue.textContent=this.speed.value;if(this.fontValue)this.fontValue.textContent=`${this.font.value} px`;if(this.shadeValue)this.shadeValue.textContent=`${this.shade.value}%`}

  // ---- SRT ----
  setCues(cues){
    this.stop();
    this.cues=cues&&cues.length?cues:null;
    this.time=0; this.activeIndex=-1;
    this.updateText();
  }
  setRate(rate){
    const r=Math.max(.25,Number(rate)||1);
    if(this.running&&this.cues)this.base=performance.now()-this.time*1000/r;
    this.rate=r;
  }
  // Đo vị trí từng cue để tạo các mốc (thời gian → độ cuộn). Cue đầu nằm đúng vạch đọc ở offset 0.
  measure(){
    if(!this.cues)return;
    const items=[...this.text.children];
    if(items.length!==this.cues.length)return;
    const top0=items[0].getBoundingClientRect().top;
    const keys=[{t:0,y:0}];
    this.cues.forEach((cue,i)=>keys.push({t:cue.start,y:items[i].getBoundingClientRect().top-top0}));
    const lastRect=items[items.length-1].getBoundingClientRect();
    keys.push({t:this.cues[this.cues.length-1].end,y:lastRect.bottom-top0});
    this.keys=keys;
  }
  yAt(time){
    const keys=this.keys;
    if(!keys.length)return 0;
    const j=keys.findIndex(k=>k.t>time);
    if(j<0)return keys[keys.length-1].y;
    if(j===0)return keys[0].y;
    const a=keys[j-1],b=keys[j];
    return a.y+(b.y-a.y)*((time-a.t)/(b.t-a.t));
  }
  markActive(){
    if(!this.cues)return;
    let idx=-1;
    for(let i=0;i<this.cues.length;i++){if(this.cues[i].start<=this.time)idx=i;else break}
    if(idx===this.activeIndex)return;
    this.activeIndex=idx;
    [...this.text.children].forEach((el,i)=>el.classList.toggle('active',i===idx));
  }

  updateText(){
    if(this.cues){
      this.text.classList.add('srt');
      this.text.replaceChildren(...this.cues.map(cue=>{const p=document.createElement('p');p.className='cue';p.textContent=cue.text;return p}));
      this.activeIndex=-1;
    }else{
      this.text.classList.remove('srt');
      this.text.textContent=this.input.value||'Nhập lời thoại của anh ở khung bên dưới…';
    }
    this.offset=0;this.time=0;this.render();this.measure();this.markActive();
  }
  updateStyle(){this.text.style.fontSize=`${this.font.value}px`;this.text.style.textAlign=this.align.value;this.text.parentElement.style.background=`linear-gradient(180deg,rgba(0,0,0,${this.shade.value/100*.25}),rgba(0,0,0,${this.shade.value/100}))`;this.updateOutputs();this.measure()}

  // startTs (tuỳ chọn): mốc performance.now() của lúc bắt đầu quay — dùng làm giây 0 của SRT để khớp video.
  play(startTs){
    if(this.running)return;
    this.running=true;this.last=0;this.start.disabled=true;this.pause.disabled=false;
    if(this.cues){
      this.measure();
      if(startTs!==undefined){this.time=0;this.base=startTs}
      else this.base=performance.now()-this.time*1000/this.rate;
    }
    this.frame=requestAnimationFrame(t=>this.tick(t));
  }
  stop(){this.running=false;cancelAnimationFrame(this.frame);this.start.disabled=false;this.pause.disabled=true}
  tick(t){
    if(!this.running)return;
    if(this.dragging){ // đang kéo tay: giữ nguyên vị trí, không tự trôi
      if(this.cues)this.base=t-this.time*1000/this.rate;else this.last=t;
      this.frame=requestAnimationFrame(n=>this.tick(n));return;
    }
    if(this.cues){
      this.time=Math.max(0,(t-this.base)/1000*this.rate);
      this.offset=this.yAt(this.time);
      this.render();this.markActive();
      if(this.time>this.cues[this.cues.length-1].end+1.5){this.stop();if(this.onEnd)this.onEnd();return}
    }else{
      if(this.last){const dt=Math.min(t-this.last,50);this.offset+=(Number(this.speed.value)/60)*(dt/16.667)}
      this.last=t;this.render();
      if(!this.running)return;
    }
    this.frame=requestAnimationFrame(n=>this.tick(n));
  }
  render(){
    this.text.style.transform=`translateY(${-this.offset}px)`;
    if(this.cues)return;
    const parent=this.text.parentElement;
    if(this.offset>this.text.scrollHeight+parent.clientHeight){this.stop()}
  }
  getState(){return {offset:this.offset,time:this.time,srt:!!this.cues}}
  setState(s){
    if(!s)return;
    if(this.cues&&s.srt){this.measure();this.time=Math.max(0,Number(s.time)||0);this.offset=this.yAt(this.time);this.render();this.markActive()}
    else if(!this.cues&&!s.srt){this.offset=Math.max(0,Number(s.offset)||0);this.render()}
  }
  resetToTop(){this.stop();this.offset=0;this.time=0;this.activeIndex=-1;this.render();this.markActive()}
}
