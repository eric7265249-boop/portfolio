/* Spatial project index: work remains interactive, animation sleeps when unused. */
(()=>{
 const gallery=document.querySelector('.home-orbit'),ring=document.querySelector('.home-orbit-ring'),space=document.querySelector('.home-orbit-space');if(!gallery||!ring)return;
 const reduce=matchMedia('(prefers-reduced-motion:reduce)'),items=[...ring.querySelectorAll('a')],status=document.querySelector('.orbit-selection'),editQuery=new URLSearchParams(location.search).has('edit');
 const editing=()=>editQuery||document.body.classList.contains('chao-editing');
 let angle=-12,target=-12,velocity=0,last=0,drag=false,moved=false,visible=false,paused=reduce.matches,hovered=null,down=null,lastPoint=null,tx=0,ty=0,px=0,py=0,raf=0,lastTitle='';
 const preview=document.createElement('div');preview.className='orbit-hover-preview';preview.setAttribute('aria-hidden','true');preview.innerHTML='<img alt="" width="150" height="100"><span></span>';gallery.append(preview);
 const asleep=()=>!visible||document.hidden||document.body.classList.contains('chao-navigating');
 function wake(){if(!raf&&!asleep()){last=0;raf=requestAnimationFrame(frame)}}
 function sleep(){cancelAnimationFrame(raf);raf=0;last=0;gallery.dataset.motionState=visible?'idle':'offscreen'}
 const show=card=>{if(card===hovered)return;hovered=card;preview.classList.toggle('is-visible',!!card&&!drag);if(card){preview.querySelector('img').src=card.querySelector('img').currentSrc||card.querySelector('img').src;preview.querySelector('span').textContent=card.dataset.title;status.textContent=card.dataset.title}wake()};
 new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible)wake();else sleep()}).observe(gallery);
 document.addEventListener('visibilitychange',()=>document.hidden?sleep():wake());
 gallery.addEventListener('pointerdown',e=>{if(e.button!==0||editing())return;drag=true;moved=false;gallery.dataset.dragged='false';down={x:e.clientX,y:e.clientY,angle:target};lastPoint={x:e.clientX,time:performance.now()};velocity=0;gallery.classList.add('is-dragging');preview.classList.remove('is-visible');wake()});
 gallery.addEventListener('dragstart',e=>e.preventDefault());
 addEventListener('pointermove',e=>{
  if(drag&&down){const dx=e.clientX-down.x;if(Math.abs(dx)>5){moved=true;gallery.dataset.dragged='true'}target=down.angle+dx*.23;const now=performance.now(),dt=Math.max(now-lastPoint.time,8);velocity=Math.max(-150,Math.min(150,(e.clientX-lastPoint.x)*.23/dt*1000));lastPoint={x:e.clientX,time:now};wake();return}
  if(!visible||e.pointerType==='touch')return;
  if(gallery.contains(e.target)){const b=gallery.getBoundingClientRect();tx=(e.clientX-b.left)/b.width*2-1;ty=(e.clientY-b.top)/b.height*2-1;show(e.target.closest('.home-orbit-card'));wake()}
 },{passive:true});
 const release=()=>{if(!drag)return;drag=false;down=null;gallery.classList.remove('is-dragging');if(lastPoint&&performance.now()-lastPoint.time>100)velocity=0;wake()};
 addEventListener('pointerup',release);addEventListener('pointercancel',release);addEventListener('blur',release);
 gallery.addEventListener('pointerleave',()=>{tx=ty=0;show(null);wake()});
 gallery.addEventListener('focusin',e=>show(e.target.closest('.home-orbit-card')));gallery.addEventListener('focusout',()=>{show(null);wake()});
 gallery.addEventListener('wheel',e=>{if(e.ctrlKey||editing())return;const delta=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);if(!delta)return;e.preventDefault();show(null);target-=delta*.035;velocity=Math.max(-100,Math.min(100,velocity-delta*.22));wake()},{passive:false});
 gallery.addEventListener('keydown',e=>{if(e.key==='Enter'){gallery.dataset.dragged='false';moved=false;return}if(!['ArrowLeft','ArrowRight','Home'].includes(e.key)||editing())return;e.preventDefault();target=e.key==='Home'?-12:target+(e.key==='ArrowRight'?-15:15);velocity=0;wake()});
 document.querySelectorAll('[data-orbit-step]').forEach(b=>b.addEventListener('click',()=>{target+=Number(b.dataset.orbitStep)*15;velocity=0;show(null);wake()}));
 const pause=document.querySelector('[data-orbit-pause]');const pauseState=()=>{pause.setAttribute('aria-pressed',String(paused));pause.textContent=paused?'播放旋转 ▷':'暂停旋转 Ⅱ'};
 pause.addEventListener('click',()=>{paused=!paused;velocity=0;pauseState();wake()});pauseState();reduce.addEventListener('change',()=>{paused=reduce.matches;velocity=0;pauseState();wake()});
 // The shared page-transition module owns navigation; prevent clicks after a drag.
 gallery.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopImmediatePropagation();moved=false;gallery.dataset.dragged='false'}},{capture:true});
 function frame(stamp){raf=0;if(asleep()){sleep();return}gallery.dataset.motionState='running';const dt=Math.min((stamp-(last||stamp))/1000,.05);last=stamp;
  const auto=!paused&&!hovered&&!editing()&&!gallery.contains(document.activeElement);
  if(!drag){if(!reduce.matches){target+=velocity*dt;velocity*=Math.exp(-4.2*dt);if(Math.abs(velocity)<.04)velocity=0}if(auto)target-=dt*3.8}
  angle+=(target-angle)*(reduce.matches?1:1-Math.exp(-8*dt));px+=(tx-px)*(reduce.matches?1:1-Math.exp(-4*dt));py+=(ty-py)*(reduce.matches?1:1-Math.exp(-4*dt));ring.style.setProperty('--orbit-angle',angle+'deg');space.style.setProperty('--orbit-lean-x',reduce.matches?'0deg':(-py*2)+'deg');space.style.setProperty('--orbit-lean-z',reduce.matches?'0deg':(px*1.4)+'deg');
  if(!hovered){const i=((Math.round(-angle/15)%items.length)+items.length)%items.length,title=items[i].dataset.title;if(title!==lastTitle){status.textContent=title;lastTitle=title}}
  if(drag||auto||Math.abs(target-angle)>.01||Math.abs(velocity)>.04||Math.abs(tx-px)>.001||Math.abs(ty-py)>.001)raf=requestAnimationFrame(frame);else{last=0;gallery.dataset.motionState=paused?'paused':'idle'}
 }
 addEventListener('pageshow',wake);
 const cover=document.querySelector('.portfolio-cover');let coverHeight=cover.offsetHeight;
 const header=()=>document.body.classList.toggle('cover-passed',scrollY>coverHeight-100);
 addEventListener('scroll',header,{passive:true});addEventListener('resize',()=>{coverHeight=cover.offsetHeight;header();wake()});header();
})();
