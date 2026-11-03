/* Original implementation informed by D04's visible interaction patterns.
   Canonical words and artwork are moved, never replaced or split into text fragments. */
(()=>{
 const body=document.body;if(!body.dataset.case)return;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)'),mobile=matchMedia('(max-width:700px)');
 const editing=()=>new URLSearchParams(location.search).has('edit')||body.classList.contains('content-editing')||body.classList.contains('c06-editing');
 const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
 let initialized=false;
 const start=()=>{
  if(initialized||!body.classList.contains('c06-initialized'))return;
  const main=document.querySelector('main'),intro=main.querySelector('.case-intro'),cover=main.querySelector(':scope>.case-cover'),title=intro?.querySelector('h1'),showcase=main.querySelector('.c06-showcase'),rail=showcase?.querySelector('.c06-gallery-rail');
  if(!cover||!title||!rail)return;initialized=true;body.classList.add('d04-case');
  const hero=document.createElement('section'),stage=document.createElement('div'),frame=document.createElement('div'),cue=document.createElement('button');
  hero.className='d04-hero';hero.setAttribute('aria-label',title.textContent+' 项目封面');stage.className='d04-hero-stage';frame.className='d04-hero-frame';title.classList.add('d04-hero-title');
  cue.type='button';cue.className='d04-hero-scroll';cue.innerHTML='SCROLL TO EXPLORE <span aria-hidden="true">↓</span>';cue.setAttribute('aria-label','向下阅读项目介绍');cue.addEventListener('click',()=>intro.scrollIntoView({behavior:reduced.matches?'instant':'smooth'}));
  frame.append(cover);stage.append(frame,title,cue);hero.append(stage);main.prepend(hero);
  const showcaseStage=document.createElement('div');showcaseStage.className='d04-showcase-stage';showcase.classList.add('d04-showcase');showcaseStage.append(...showcase.children);showcase.append(showcaseStage);
  document.querySelector('.c06-summary').after(showcase);
  const slides=[...rail.children],toolbar=showcase.querySelector('.c06-gallery-toolbar'),dots=document.createElement('div');dots.className='d04-dots';dots.setAttribute('aria-label','项目图像分页');
  const stepButtons=[...toolbar.querySelectorAll('[data-c06-step]')];toolbar.insertBefore(dots,toolbar.querySelector('.c06-rail-controls'));
  let current=0,raf=0,previousY=scrollY,travel=0,dragging=false,dragX=0,dragLeft=0,didDrag=false;
  const setSlide=index=>{current=clamp(index,0,slides.length-1);[...dots.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===current)));stepButtons.forEach(b=>b.disabled=Number(b.dataset.c06Step)<0?current===0:current===slides.length-1)};
  const slideTo=index=>{index=clamp(index,0,slides.length-1);if(!mobile.matches&&!reduced.matches&&!editing()){
    const max=rail.scrollWidth-rail.clientWidth,target=slides[index].offsetLeft-slides[0].offsetLeft;
    window.scrollTo({top:showcase.getBoundingClientRect().top+scrollY+clamp(target/max)*travel,behavior:'smooth'});
   }else rail.scrollTo({left:slides[index].offsetLeft-slides[0].offsetLeft,behavior:reduced.matches?'instant':'smooth'});setSlide(index)};
  slides.forEach((slide,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','浏览第 '+(i+1)+' 幅项目图像');b.setAttribute('aria-pressed',String(i===0));b.addEventListener('click',()=>slideTo(i));dots.append(b)});
  stepButtons.forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();slideTo(current+Number(b.dataset.c06Step))},{capture:true}));
  rail.tabIndex=0;rail.setAttribute('aria-label','项目过程图像，左右方向键切换');
  rail.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)||e.target!==rail)return;e.preventDefault();slideTo(e.key==='Home'?0:e.key==='End'?slides.length-1:current+(e.key==='ArrowRight'?1:-1))});
  rail.addEventListener('scroll',()=>{if(!mobile.matches&&!reduced.matches&&!editing())return;let closest=0,dist=Infinity;slides.forEach((s,i)=>{const d=Math.abs(s.offsetLeft-slides[0].offsetLeft-rail.scrollLeft);if(d<dist){dist=d;closest=i}});setSlide(closest)},{passive:true});
  rail.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;dragging=true;didDrag=false;dragX=e.clientX;dragLeft=rail.scrollLeft});
  rail.addEventListener('pointermove',e=>{if(!dragging)return;const delta=dragX-e.clientX;if(Math.abs(delta)<5&&!didDrag)return;didDrag=true;const target=clamp(dragLeft+delta,0,rail.scrollWidth-rail.clientWidth);if(mobile.matches||reduced.matches)rail.scrollLeft=target;else window.scrollTo({top:showcase.getBoundingClientRect().top+scrollY+target/Math.max(1,rail.scrollWidth-rail.clientWidth)*travel,behavior:'instant'})});
  window.addEventListener('pointerup',()=>dragging=false);rail.addEventListener('click',e=>{if(didDrag){e.preventDefault();e.stopImmediatePropagation();didDrag=false}},{capture:true});
  // D04's layered phase sequence, using only the project's existing operation/state material.
  const phaseSelectors={urban:'#interaction-feedback .ed-states',plastic:'#instruction .ed-storyboard',azure:'#play-sessions .ed-grid',armor:'#interaction-intent .ed-storyboard'};
  const phases=document.querySelector(phaseSelectors[body.dataset.case]);
  if(phases&&phases.children.length>1&&[...phases.children].every(n=>n.matches('article,figure'))){
   if(body.dataset.case==='azure'){const figures=[...phases.children];for(let i=0;i<figures.length;i+=3){const group=document.createElement('article');group.className='d04-photo-phase';const grid=document.createElement('div');grid.className='d04-phase-photos';figures.slice(i,i+3).forEach(f=>grid.append(f));group.append(grid);phases.append(group)}}
   phases.classList.add('d04-phases');
  }
  // A second, freely browsable detail carousel corresponds to D04's key features.
  const featureSelectors={urban:'#design-community .ed-phones',plastic:'#final-details .ed-grid',azure:'#physical-component-usage .ed-grid',armor:'#final-object .ed-grid'};
  const feature=document.querySelector(featureSelectors[body.dataset.case]);
  if(feature&&feature.children.length>1&&[...feature.children].every(e=>e.matches('.ed-figure'))){
   feature.classList.add('d04-feature-rail');feature.tabIndex=0;feature.setAttribute('aria-label','设计细节图像轮播');
   const items=[...feature.children],nav=document.createElement('div'),pages=document.createElement('div'),arrows=document.createElement('div'),prev=document.createElement('button'),next=document.createElement('button');
   nav.className='d04-feature-nav';pages.className='d04-dots';arrows.className='d04-feature-arrows';prev.type=next.type='button';prev.textContent='←';next.textContent='→';prev.setAttribute('aria-label','上一幅设计细节');next.setAttribute('aria-label','下一幅设计细节');
   let active=0;const goto=i=>feature.scrollTo({left:items[clamp(i,0,items.length-1)].offsetLeft-items[0].offsetLeft,behavior:reduced.matches?'instant':'smooth'});
   items.forEach((el,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','设计细节 '+(i+1));b.setAttribute('aria-pressed',String(!i));b.addEventListener('click',()=>goto(i));pages.append(b)});
   const refresh=()=>{let d=Infinity;items.forEach((el,i)=>{const distance=Math.abs(el.offsetLeft-items[0].offsetLeft-feature.scrollLeft);if(distance<d){d=distance;active=i}});[...pages.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===active)));prev.disabled=active===0;next.disabled=active===items.length-1};
   prev.addEventListener('click',()=>goto(active-1));next.addEventListener('click',()=>goto(active+1));arrows.append(prev,next);nav.append(pages,arrows);feature.after(nav);feature.addEventListener('scroll',refresh,{passive:true});
   feature.addEventListener('keydown',e=>{if(e.target!==feature||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();goto(active+(e.key==='ArrowRight'?1:-1))});
   let startX=0,startLeft=0,drag=false,moved=false;feature.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button)return;drag=true;moved=false;startX=e.clientX;startLeft=feature.scrollLeft});feature.addEventListener('pointermove',e=>{if(!drag)return;const dx=startX-e.clientX;if(Math.abs(dx)>5)moved=true;if(moved)feature.scrollLeft=startLeft+dx});window.addEventListener('pointerup',()=>drag=false);feature.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopImmediatePropagation();moved=false}},{capture:true});refresh();
  }
  const parallax=[...document.querySelectorAll('.reading-evidence>.ed-artifacts>.ed-figure:first-child,.reading-evidence>.ed-grid>.role-lead:first-child')].filter(e=>!e.closest('.ed-source-collage,.d04-phases'));
  parallax.forEach(e=>e.classList.add('d04-parallax'));
  const reveals=[...document.querySelectorAll('.stage-heading h2,.ed-block-heading h3,.c06-story-prompt h2,.artist-statement h2,.next-project h2')];
  const media=[...document.querySelectorAll('.case-story .ed-figure')].filter(e=>!e.closest('.ed-source-collage,.d04-phases'));
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.remove('d04-pending');observer.unobserve(e.target)}}),{rootMargin:'0px 0px -25px 0px',threshold:0});
  // Read all geometry once before any reveal classes are written. Alternating these
  // reads/writes forces a complete layout per photograph on long case studies.
  const revealItems=[...reveals,...media],revealSet=new Set(reveals),deferReveals=!reduced.matches&&!editing();
  const startsBelow=deferReveals?revealItems.map(e=>e.getBoundingClientRect().top>innerHeight):[];
  revealItems.forEach((e,i)=>{e.classList.add(revealSet.has(e)?'d04-mask':'d04-media-in');if(startsBelow[i]){e.classList.add('d04-pending');if(!revealSet.has(e))e.style.setProperty('--reveal-delay',(i%3)*65+'ms');observer.observe(e)}});
  document.querySelectorAll('.c06-read-story,footer .footer-top>a:last-child,header nav a').forEach(el=>{if(el.querySelector('img')||el.querySelector('.d04-roll-label')||el.children.length)return;const label=document.createElement('span'),echo=document.createElement('span');label.className='d04-roll-label';echo.className='d04-roll-echo';echo.setAttribute('aria-hidden','true');while(el.firstChild)label.append(el.firstChild);echo.textContent=label.textContent;el.classList.add('d04-roll');el.append(label,echo)});
  const resize=()=>{travel=Math.max(innerHeight*1.8,Math.min(innerHeight*4.5,(rail.scrollWidth-rail.clientWidth)/1.65));showcase.style.setProperty('--showcase-height',travel+innerHeight+'px');schedule()};
  const update=()=>{raf=0;const edit=editing();body.classList.toggle('d04-editing',!!edit);const h=innerHeight,y=scrollY,hr=hero.getBoundingClientRect(),p=reduced.matches||edit?0:clamp(-hr.top/(hero.offsetHeight-h));
   const expansion=clamp(p/.72),smooth=expansion*expansion*(3-2*expansion),startW=mobile.matches?68:42,startH=mobile.matches?48:58;
   hero.style.setProperty('--hero-w',(startW+(100-startW)*smooth)+'vw');hero.style.setProperty('--hero-h',(startH+(100-startH)*smooth)+'svh');hero.style.setProperty('--hero-r',26*(1-smooth)+'px');
   hero.style.setProperty('--hero-title-y',(-clamp((p-.5)/.45)*100)+'px');hero.style.setProperty('--hero-title-opacity',1-clamp((p-.56)/.25));hero.style.setProperty('--hero-scroll-opacity',1-clamp(p/.2));cue.tabIndex=p>.1?-1:0;
   if(!mobile.matches&&!reduced.matches&&!edit){const r=showcase.getBoundingClientRect(),progress=clamp(-r.top/travel),max=rail.scrollWidth-rail.clientWidth;if(r.top<h&&r.bottom>0){rail.scrollLeft=progress*max;const target=rail.scrollLeft+slides[0].offsetLeft;let i=0,dist=Infinity;slides.forEach((s,n)=>{let d=Math.abs(s.offsetLeft-target);if(d<dist){dist=d;i=n}s.style.setProperty('--slide-y',Math.min(22,d/innerWidth*18)+'px')});setSlide(i)}}
   if(!reduced.matches&&!mobile.matches&&!edit)for(const el of parallax){const r=el.getBoundingClientRect();if(r.top<h+100&&r.bottom>-100)el.style.setProperty('--parallax-y',clamp((h*.5-r.top-r.height*.5)*.045,-28,28)+'px')}
   if(y>h*.3&&Math.abs(y-previousY)>3)body.classList.toggle('d04-reading-down',y>previousY&&!edit);if(y<h*.3||edit)body.classList.remove('d04-reading-down');previousY=y;
  };
  function schedule(){if(!raf)raf=requestAnimationFrame(update)}
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',resize);mobile.addEventListener('change',resize);reduced.addEventListener('change',()=>{if(reduced.matches)document.querySelectorAll('.d04-pending').forEach(e=>e.classList.remove('d04-pending'));resize()});
  document.querySelectorAll('.case-layout>aside a').forEach(a=>a.addEventListener('click',()=>body.classList.remove('d04-reading-down')));
  addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.source!=='chao-editor')return;if(e.data.command==='mode'){body.classList.toggle('d04-editing',e.data.enabled!==false);document.querySelectorAll('.d04-pending').forEach(n=>n.classList.remove('d04-pending'));schedule()}});
  resize();update();body.dataset.d04Ready='true';dispatchEvent(new Event('chao:case-ready'));
 };
 const observe=new MutationObserver(()=>{start();if(initialized)observe.disconnect()});observe.observe(body,{attributes:true,attributeFilter:['class']});
 if(window.ChaoContent?.ready)window.ChaoContent.ready.then(start).catch(start);start();
})();
