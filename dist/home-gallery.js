/* D-inspired radial gallery: inertia, wheel control, live preview and image-to-case opening. */
(()=>{
 const gallery=document.querySelector('.home-orbit'),ring=document.querySelector('.home-orbit-ring'),space=document.querySelector('.home-orbit-space');if(!gallery||!ring)return;
 const reduce=matchMedia('(prefers-reduced-motion:reduce)'),items=[...ring.querySelectorAll('a')],status=document.querySelector('.orbit-selection');
 const editing=()=>new URLSearchParams(location.search).has('edit')||document.body.classList.contains('chao-editing');
 let angle=-12,target=-12,velocity=0,last=0,drag=false,moved=false,visible=true,paused=reduce.matches,hovered=null,down=null,lastPoint=null,tx=0,ty=0,px=0,py=0,navigating=false;
 const preview=document.createElement('div');preview.className='orbit-hover-preview';preview.setAttribute('aria-hidden','true');preview.innerHTML='<img alt=""><span></span>';gallery.append(preview);
 const show=card=>{if(card===hovered)return;hovered=card;preview.classList.toggle('is-visible',!!card&&!drag);if(card){preview.querySelector('img').src=card.querySelector('img').currentSrc||card.querySelector('img').src;preview.querySelector('span').textContent=card.dataset.title;status.textContent=card.dataset.title}};
 new IntersectionObserver(es=>visible=es[0].isIntersecting).observe(gallery);
 gallery.addEventListener('pointerdown',e=>{if(e.button!==0||editing())return;drag=true;moved=false;down={x:e.clientX,y:e.clientY,angle:target};lastPoint={x:e.clientX,time:performance.now()};velocity=0;gallery.classList.add('is-dragging');preview.classList.remove('is-visible')});
 gallery.addEventListener('dragstart',e=>e.preventDefault());
 addEventListener('pointermove',e=>{
  if(drag&&down){const dx=e.clientX-down.x;if(Math.abs(dx)>5)moved=true;target=down.angle+dx*.23;const now=performance.now(),dt=Math.max(now-lastPoint.time,8);velocity=Math.max(-150,Math.min(150,(e.clientX-lastPoint.x)*.23/dt*1000));lastPoint={x:e.clientX,time:now};return}
  const b=gallery.getBoundingClientRect();if(e.clientX>=b.left&&e.clientX<=b.right&&e.clientY>=b.top&&e.clientY<=b.bottom){tx=(e.clientX-b.left)/b.width*2-1;ty=(e.clientY-b.top)/b.height*2-1;show(e.target.closest('.home-orbit-card'))}
 });
 const release=()=>{if(!drag)return;drag=false;down=null;gallery.classList.remove('is-dragging');if(lastPoint&&performance.now()-lastPoint.time>100)velocity=0};
 addEventListener('pointerup',release);addEventListener('pointercancel',release);addEventListener('blur',release);
 gallery.addEventListener('pointerleave',()=>{tx=ty=0;show(null)});
 gallery.addEventListener('focusin',e=>show(e.target.closest('.home-orbit-card')));gallery.addEventListener('focusout',()=>show(null));
 gallery.addEventListener('wheel',e=>{if(e.ctrlKey||editing())return;const delta=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);if(!delta)return;e.preventDefault();show(null);target-=delta*.035;velocity=Math.max(-100,Math.min(100,velocity-delta*.22))},{passive:false});
 gallery.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home'].includes(e.key)||editing())return;e.preventDefault();target=e.key==='Home'?-12:target+(e.key==='ArrowRight'?-15:15);velocity=0});
 document.querySelectorAll('[data-orbit-step]').forEach(b=>b.addEventListener('click',()=>{target+=Number(b.dataset.orbitStep)*15;velocity=0;show(null)}));
 const pause=document.querySelector('[data-orbit-pause]');const pauseState=()=>{pause.setAttribute('aria-pressed',String(paused));pause.textContent=paused?'播放旋转 ▷':'暂停旋转 Ⅱ'};
 pause.addEventListener('click',()=>{paused=!paused;velocity=0;pauseState()});pauseState();reduce.addEventListener('change',()=>{paused=reduce.matches;velocity=0;pauseState()});
 gallery.addEventListener('click',e=>{
  if(moved){e.preventDefault();e.stopImmediatePropagation();moved=false;return}
  const a=e.target.closest('.home-orbit-card');if(!a||editing()||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||reduce.matches)return;
  e.preventDefault();e.stopPropagation();if(navigating)return;navigating=true;paused=true;velocity=0;show(null);
  const img=a.querySelector('img'),r=img.getBoundingClientRect(),overlay=document.createElement('div'),hero=img.cloneNode();overlay.className='orbit-case-opening';hero.removeAttribute('data-edit-key');hero.removeAttribute('data-edit-kind');hero.style.cssText=`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  const label=document.createElement('span');label.textContent=a.dataset.title;overlay.append(hero,label);document.body.append(overlay);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{overlay.classList.add('is-open');hero.style.cssText='left:6vw;top:12vh;width:88vw;height:76vh'}));setTimeout(()=>location.assign(a.href),650);
 },true);
 function frame(stamp){requestAnimationFrame(frame);if(!visible||document.hidden||document.body.classList.contains('chao-navigating')){last=stamp;return}const dt=Math.min((stamp-(last||stamp))/1000,.05);last=stamp;
  if(!drag){if(!reduce.matches){target+=velocity*dt;velocity*=Math.exp(-4.2*dt);if(Math.abs(velocity)<.04)velocity=0}if(!paused&&!hovered&&!editing()&&!gallery.contains(document.activeElement))target-=dt*3.8}
  angle+=(target-angle)*(reduce.matches?1:1-Math.exp(-8*dt));px+=(tx-px)*(1-Math.exp(-4*dt));py+=(ty-py)*(1-Math.exp(-4*dt));ring.style.setProperty('--orbit-angle',angle+'deg');space.style.setProperty('--orbit-lean-x',reduce.matches?'0deg':(-py*2)+'deg');space.style.setProperty('--orbit-lean-z',reduce.matches?'0deg':(px*1.4)+'deg');
  if(!hovered){const i=((Math.round(-angle/15)%items.length)+items.length)%items.length;status.textContent=items[i].dataset.title}
 }
 requestAnimationFrame(frame);addEventListener('pageshow',()=>{navigating=false;document.querySelectorAll('.orbit-case-opening').forEach(el=>el.remove())});
 const cover=document.querySelector('.portfolio-cover');const header=()=>document.body.classList.toggle('cover-passed',scrollY>cover.offsetHeight-100);addEventListener('scroll',header,{passive:true});header();
})();
