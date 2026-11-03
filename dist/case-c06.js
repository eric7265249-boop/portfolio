/* All visuals and text are taken from the current authored case, including saved edits. */
(()=>{
 if(!document.body.dataset.case)return;
 const start=()=>{
 const body=document.body,edit=new URLSearchParams(location.search).has('edit'),cover=document.querySelector('.case-cover'),layout=document.querySelector('main>.case-layout'),roadmap=document.querySelector('main>.process-roadmap'),title=document.querySelector('.case-intro h1');if(!cover||!layout||!title)return;
 if(body.classList.contains('c06-initialized'))return;if(edit)body.classList.add('c06-editing');
 const clean=el=>{const clone=el.cloneNode(true);[clone,...clone.querySelectorAll('*')].forEach(n=>{for(const a of [...n.attributes])if(a.name==='id'||a.name.startsWith('data-edit')||a.name==='data-original-node'||a.name==='data-placement-key'||a.name==='contenteditable'||a.name==='data-chao-selected')n.removeAttribute(a.name)});clone.querySelectorAll('img').forEach(im=>{im.loading='lazy';im.decoding='async'});return clone};
 const figures=[...layout.querySelectorAll('.ed-figure')].filter(f=>f.querySelector('.image-enlarge .ed-visual'));
 const label=f=>f.querySelector('figcaption')?.textContent.replace(/\s+/g,' ').trim()||f.querySelector('img')?.alt||title.textContent;
 const visual=f=>f.querySelector('.ed-visual');
 const presentation=f=>{const wrap=document.createElement('div');wrap.className='c06-composition '+[...f.classList].filter(c=>c.startsWith('collage-')||c==='ed-source-collage'||c==='ed-composite').join(' ');const source=visual(f);if(source){wrap.append(clean(source))}else{const image=f.querySelector('img');if(!image)return wrap;const stage=document.createElement('span'),im=clean(image);stage.className='ed-visual c06-plain-visual';const ratio=()=>{const r=im.naturalWidth&&im.naturalHeight?im.naturalWidth/im.naturalHeight:1.5;stage.style.setProperty('--visual-ratio',r);stage.style.aspectRatio=String(r)};im.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain';im.addEventListener('load',ratio);ratio();stage.append(im);wrap.append(stage)}return wrap};
 const scenes=[...layout.querySelectorAll('.cinema-scene')];
 const picks=[cover];
 for(const scene of scenes){
  const f=['.role-lead','.role-prototype','.role-scenario-photo','.role-model','.ed-source-collage','.ed-figure'].map(s=>scene.querySelector(s)).find(Boolean);if(f&&visual(f)&&!picks.includes(f))picks.push(f);
 }
 const showcase=document.querySelector('.c06-showcase'),rail=showcase.querySelector('.c06-gallery-rail');
 picks.forEach((f,i)=>{const original=f.querySelector('.image-enlarge'),button=document.createElement(original?'button':'figure');if(original)button.type='button';button.className='c06-slide';button.setAttribute('aria-label',original?'放大：'+label(f):label(f));button.append(presentation(f));const footer=document.createElement('span');footer.className='c06-slide-label';const text=document.createElement('span'),arrow=document.createElement('span');text.textContent=String(i+1).padStart(2,'0')+' / '+label(f);arrow.textContent=original?'↗':'';footer.append(text,arrow);button.append(footer);if(original)button.addEventListener('click',()=>original.click());rail.append(button)});
 showcase.querySelector('[data-c06-count]').textContent=String(picks.length).padStart(2,'0')+' SELECTED IMAGES / 精选图像';
 showcase.querySelectorAll('[data-c06-step]').forEach(b=>b.addEventListener('click',()=>rail.scrollBy({left:Number(b.dataset.c06Step)*(rail.querySelector('.c06-slide').getBoundingClientRect().width+18),behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'})));
 const summary=document.querySelector('.c06-summary'),facts=document.querySelector('.case-intro .case-facts');summary.prepend(facts);
 // The project is a continuous story. Keep its authored chapters in the page.
 window.ChaoReading?.(layout);
 const openStory=hash=>{const target=hash?document.getElementById(hash.replace(/^#/,'')):roadmap;(target||layout).scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'})};
 summary.querySelector('[data-c06-story]').addEventListener('click',()=>openStory());
 summary.querySelector('[data-c06-story] span').textContent='↓';
 summary.querySelector('.c06-story-chapters').textContent=scenes.map(s=>s.querySelector('.stage-heading h2')?.textContent||s.dataset.sceneTitle).filter(Boolean).join(' · ');
 body.classList.add('c06-ready','c06-initialized','content-reading');
 const route=()=>{if(location.hash&&layout.querySelector('[id="'+CSS.escape(location.hash.slice(1))+'"]'))openStory(location.hash)};addEventListener('hashchange',route);route();
 const refresh=()=>{[...rail.querySelectorAll('.c06-slide')].forEach((b,i)=>{b.querySelector('.c06-composition')?.replaceWith(presentation(picks[i]))})};
 addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.source!=='chao-editor')return;if(e.data.command==='mode'){body.classList.toggle('c06-editing',e.data.enabled!==false);refresh()}if(e.data.command==='apply')setTimeout(refresh,0)});
 };
 if(window.ChaoContent?.ready)window.ChaoContent.ready.then(start).catch(start);else start();
})();
