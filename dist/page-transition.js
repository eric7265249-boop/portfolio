/* Actual multipage navigation with a short-lived, same-tab visual handoff. */
(()=>{
 const key='chao-home-handoff-v1',reduce=matchMedia('(prefers-reduced-motion:reduce)'),root=document.documentElement;
 let payload=null,busy=false,overlay=null;
 try{const saved=JSON.parse(sessionStorage.getItem(key)||'null');sessionStorage.removeItem(key);if(saved&&saved.to===location.pathname&&Date.now()-saved.at<10000&&!reduce.matches){payload=saved;root.classList.add('chao-arrival','chao-handoff-active')}}catch{}
 const editing=()=>new URLSearchParams(location.search).has('edit')||document.body?.matches('.content-editing,.chao-editing')||document.querySelector('[contenteditable=true]');
 const center=()=>({left:innerWidth*(innerWidth<=700?.16:.29),top:innerHeight*(innerWidth<=700?.26:.21),width:innerWidth*(innerWidth<=700?.68:.42),height:innerHeight*(innerWidth<=700?.48:.58),radius:26});
 const rectStyle=r=>({left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',borderRadius:(r.radius??3)+'px'});
 const build=(data,incoming=false)=>{const el=document.createElement('div');el.className='chao-transition'+(incoming?' is-arrival':'');el.dataset.kind=data.kind;el.setAttribute('aria-hidden','true');
  const paper=document.createElement('div');paper.className='chao-transition-paper';el.append(paper);
  let media=null;if(data.src){media=document.createElement('figure');media.className='chao-transition-media';const img=document.createElement('img');img.src=data.src;img.alt='';media.append(img);el.append(media)}
  const title=document.createElement('div');title.className='chao-transition-title';title.textContent=data.title;
  const line=document.createElement('div');line.className='chao-transition-line';const brand=document.createElement('span'),label=document.createElement('span');brand.textContent='CHAO / PORTFOLIO';label.textContent=data.kind==='work'?'SELECTED WORK':'OPENING PROJECT';line.append(brand,label);el.append(title,line);document.body.append(el);overlay=el;return{el,paper,media,title,line};
 };
 const animate=(el,frames,options)=>el.animate(frames,{fill:'both',easing:'cubic-bezier(.22,1,.36,1)',...options});
 const clean=()=>{document.querySelectorAll('.chao-transition').forEach(e=>e.remove());root.classList.remove('chao-arrival','chao-handoff-active');document.body?.classList.remove('chao-navigating');busy=false;overlay=null};
 const warmed=new Set(),resources=new Set();
 const prefetch=(href,as)=>{if(resources.has(href))return;resources.add(href);const link=document.createElement('link');link.rel=as==='image'?'preload':'prefetch';if(as)link.as=as;link.href=href;if(as==='image')link.fetchPriority='low';document.head.append(link)};
 const warm=e=>{if(editing())return;const a=e.target.closest('a[href]');if(!a)return;const u=new URL(a.href,location.href);u.searchParams.set('build','20261103-entry4');if(u.origin!==location.origin||u.pathname===location.pathname||!/(?:\/work|\/project-(?:urban|plastic|azure|armor))\.html$/.test(u.pathname)||warmed.has(u.href))return;warmed.add(u.href);
  fetch(u.href,{credentials:'same-origin',cache:'force-cache'}).then(r=>r.ok?r.text():'').then(text=>{if(!text)return;const doc=new DOMParser().parseFromString(text,'text/html'),cover=doc.querySelector('.case-cover img');if(cover)prefetch(new URL(cover.getAttribute('src'),u).href,'image');doc.querySelectorAll('link[rel=stylesheet][href],script[src]').forEach(el=>prefetch(new URL(el.getAttribute('href')||el.getAttribute('src'),u).href))}).catch(()=>{});
 };
 document.addEventListener('pointerover',warm,{passive:true});document.addEventListener('focusin',warm);document.addEventListener('pointerdown',warm,{passive:true});
 document.addEventListener('click',e=>{
  if(!document.body||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||reduce.matches||editing())return;
  const a=e.target.closest('a[href]');if(!a||a.target||a.hasAttribute('download'))return;
  const url=new URL(a.href,location.href);url.searchParams.set('build','20261103-entry4');if(url.origin!==location.origin||url.pathname===location.pathname||!/(?:\/work|\/project-(?:urban|plastic|azure|armor))\.html$/.test(url.pathname))return;
  e.preventDefault();e.stopImmediatePropagation();if(busy)return;busy=true;
  const kind=/\/work\.html$/.test(url.pathname)?'work':'project',card=a.matches('.home-orbit-card,.next-project')?a:a.closest('.project')||document.querySelector('.home-orbit-card[href="'+CSS.escape(a.getAttribute('href'))+'"]'),img=card?.querySelector('img');
  const data={kind,to:url.pathname,at:Date.now(),title:kind==='work'?'Selected work.':card?.dataset.title||(card?.querySelector('h2,h3')?.textContent||a.textContent).replace(/↗/g,'').trim(),src:kind==='project'&&img?img.currentSrc||img.src:null};
  try{sessionStorage.removeItem('chao-film-cut');sessionStorage.setItem(key,JSON.stringify(data))}catch{}
  document.body.classList.add('chao-navigating');const ui=build(data),duration=360;
  animate(ui.paper,[{opacity:0},{opacity:1}],{duration:300});
  if(ui.media){const r=img.getBoundingClientRect(),start=r.width>12&&r.height>12&&r.bottom>0&&r.top<innerHeight?{left:r.left,top:r.top,width:r.width,height:r.height,radius:3}:{...center(),width:center().width*.82,height:center().height*.82,left:center().left+center().width*.09,top:center().top+center().height*.09};const end=center();Object.assign(ui.media.style,rectStyle(end));ui.media.style.transformOrigin='0 0';const transform=`translate(${start.left-end.left}px,${start.top-end.top}px) scale(${start.width/end.width},${start.height/end.height})`;animate(ui.media,[{transform,borderRadius:'3px'},{transform:'translate(0px,0px) scale(1,1)',borderRadius:'26px'}],{duration});}
  animate(ui.title,[{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,delay:40});
  animate(ui.line,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,delay:100});
  const exit=()=>location.assign(url.href);setTimeout(exit,duration+20);
 },true);
 const arrive=()=>{
  if(!payload||reduce.matches||editing()){root.classList.remove('chao-arrival','chao-handoff-active');return}
  const data=payload;payload=null;const ui=build(data,true);if(ui.media)Object.assign(ui.media.style,rectStyle(center()));let completed=false,waiting=false,observer,timer;
  const finish=()=>{if(completed)return;completed=true;observer?.disconnect();clearTimeout(timer);removeEventListener('chao:case-ready',reveal);root.classList.remove('chao-arrival');
   const target=document.querySelector('.d04-hero-frame');if(ui.media&&target){const r=target.getBoundingClientRect(),c=center();ui.media.style.transformOrigin='0 0';animate(ui.media,[{transform:'translate(0px,0px) scale(1,1)'},{transform:`translate(${r.left-c.left}px,${r.top-c.top}px) scale(${r.width/c.width},${r.height/c.height})`}],{duration:250})}
   if(data.kind==='work'){animate(ui.el,[{transform:'translateY(0)'},{transform:'translateY(-100%)'}],{duration:360});document.querySelector('main')?.animate([{opacity:.2,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,easing:'cubic-bezier(.22,1,.36,1)'})}
   else animate(ui.el,[{opacity:1},{opacity:0}],{duration:360});setTimeout(clean,450);
  };
  const reveal=()=>{if(completed||waiting)return;if(data.kind==='project'&&document.body.dataset.d04Ready!=='true')return;waiting=true;
   const image=document.querySelector('.d04-hero-frame img');const decoded=image&&typeof image.decode==='function'?image.decode().catch(()=>{}):Promise.resolve();
   Promise.race([decoded,new Promise(resolve=>setTimeout(resolve,1000))]).then(()=>requestAnimationFrame(()=>requestAnimationFrame(finish)));
  };
  observer=new MutationObserver(reveal);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-d04-ready']});addEventListener('chao:case-ready',reveal);timer=setTimeout(finish,1800);requestAnimationFrame(reveal);
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrive,{once:true});else arrive();
 addEventListener('pageshow',e=>{if(e.persisted)clean()});
})();
