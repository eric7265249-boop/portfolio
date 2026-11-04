/* Film & Form: native horizontal film browsing, spatial depth and page cuts. */
(()=>{
 const body=document.body,reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const editing=()=>new URLSearchParams(location.search).has('edit')||body.classList.contains('content-editing')||document.querySelector('[contenteditable=true]');
 try{if(sessionStorage.getItem('chao-film-cut')){sessionStorage.removeItem('chao-film-cut');body.classList.add('edition-arriving')}}catch{}
 const shutter=document.createElement('div');shutter.className='edition-shutter';shutter.setAttribute('aria-hidden','true');body.append(shutter);
 document.addEventListener('click',e=>{
  const a=e.target.closest('a[href]');if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target||a.hasAttribute('download')||editing()||reduced.matches)return;
  const url=new URL(a.href,location.href);if(url.origin!==location.origin||url.pathname===location.pathname||!url.pathname.endsWith('.html')||url.pathname.endsWith('/editor.html'))return;
  e.preventDefault();body.classList.add('edition-leaving');try{sessionStorage.setItem('chao-film-cut','1')}catch{}
  setTimeout(()=>location.assign(url.href),360);
 });
 addEventListener('pageshow',()=>body.classList.remove('edition-leaving'));
 const strip=document.querySelector('.work-content .projects');
 if(strip){
  const cards=[...strip.querySelectorAll('.project')],switches=[...document.querySelectorAll('[data-work-view-button]')];
  const current=document.querySelector('.film-current'),dots=document.querySelector('.film-dots');
  const prev=document.querySelector('[data-film-step="-1"]'),next=document.querySelector('[data-film-step="1"]');
  let active=null,raf=0;
  const visible=()=>cards.filter(c=>!c.hidden);
  const scrollToCard=(card,smooth=true)=>{if(!card)return;const sr=strip.getBoundingClientRect(),r=card.getBoundingClientRect();strip.scrollTo({left:strip.scrollLeft+r.left-sr.left-(strip.clientWidth-r.width)/2,behavior:smooth&&!reduced.matches?'smooth':'instant'})};
  cards.forEach((card,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','定位项目 '+String(i+1).padStart(2,'0')+' '+card.querySelector('h3').textContent);b.setAttribute('aria-pressed',String(i===0));b.addEventListener('click',()=>{if(card.hidden)document.querySelector('[data-filter=all]').click();scrollToCard(card)});dots.append(b)});
  const update=()=>{
   raf=0;const list=visible(),r=strip.getBoundingClientRect(),center=r.left+r.width/2;
   let candidate=null,nearest=Infinity;
   const positions=list.map(c=>{const b=c.getBoundingClientRect();return(b.left+b.width/2-center)/r.width});
   list.forEach((c,j)=>{const d=positions[j];if(Math.abs(d)<nearest){nearest=Math.abs(d);candidate=c}c.style.setProperty('--frame-turn',reduced.matches?'0deg':Math.max(-19,Math.min(19,-d*25))+'deg');c.style.setProperty('--frame-y',reduced.matches?'0px':Math.min(28,Math.abs(d)*35)+'px')});
   active=candidate||list[0];if(!active)return;
   const i=list.indexOf(active);current.replaceChildren();const n=document.createElement('b');n.textContent=String(cards.indexOf(active)+1).padStart(2,'0')+' / 04';current.append(n,document.createTextNode(active.querySelector('h3').textContent));
   prev.disabled=i===0;next.disabled=i===list.length-1;
   [...dots.children].forEach((b,j)=>{b.hidden=cards[j].hidden;b.setAttribute('aria-pressed',String(cards[j]===active))});
   document.querySelectorAll('[data-jump]').forEach(a=>{const selected=a.dataset.jump===active.dataset.project;a.classList.toggle('current',selected);if(selected)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});
  };
  const schedule=()=>{if(!raf)raf=requestAnimationFrame(update)};
  strip.addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);
  [prev,next].forEach(b=>b.addEventListener('click',()=>{const list=visible();scrollToCard(list[list.indexOf(active)+Number(b.dataset.filmStep)])}));
  strip.addEventListener('keydown',e=>{if(e.target!==strip||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const list=visible(),i=list.indexOf(active);scrollToCard(e.key==='Home'?list[0]:e.key==='End'?list.at(-1):list[Math.max(0,Math.min(list.length-1,i+(e.key==='ArrowRight'?1:-1)))])});
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{requestAnimationFrame(()=>{strip.scrollLeft=0;update()})}));
  document.querySelectorAll('[data-jump]').forEach(a=>a.addEventListener('click',e=>{if(body.dataset.workView==='index')return;e.preventDefault();scrollToCard(cards.find(c=>c.dataset.project===a.dataset.jump))}));
  const setView=view=>{body.dataset.workView=view;switches.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.workViewButton===view)));strip.tabIndex=0;strip.setAttribute('aria-label',view==='film'?'胶片式作品画廊，可横向滚动或使用左右方向键':'作品网格目录');document.querySelector('.collection-caption').textContent=view==='film'?'SCROLL SIDEWAYS · 横向浏览':'PROJECT INDEX · 作品目录';const url=new URL(location.href);if(view==='index')url.searchParams.set('view','index');else url.searchParams.delete('view');history.replaceState(history.state,'',url);requestAnimationFrame(()=>{scrollToCard(active,false);update()})};
  switches.forEach(b=>b.addEventListener('click',()=>{setView(b.dataset.workViewButton);try{sessionStorage.setItem('chao-work-view',b.dataset.workViewButton)}catch{}}));
  let initial='film';try{initial=new URLSearchParams(location.search).get('view')||sessionStorage.getItem('chao-work-view')||'film'}catch{}setView(initial==='index'?'index':'film');update();
 }
 if(body.dataset.case&&!reduced.matches&&'IntersectionObserver'in window&&!editing()){
  const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('edition-seen');e.target.classList.remove('edition-await');obs.unobserve(e.target)}}),{threshold:.025,rootMargin:'0px 0px 80px 0px'});
  document.querySelectorAll('.ed-block').forEach(el=>{if(el.getBoundingClientRect().top>innerHeight){el.classList.add('edition-await');obs.observe(el)}});
 }
})();
