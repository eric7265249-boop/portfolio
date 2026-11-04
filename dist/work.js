/* Collection state is shareable; project facts stay in the authored cards. */
(()=>{
 const projects=[...document.querySelectorAll('.work-content .project')],links=[...document.querySelectorAll('[data-jump]')],filters=[...document.querySelectorAll('[data-filter]')],counter=document.querySelector('#work-count');
 if(!projects.length||!counter)return;counter.setAttribute('role','status');counter.setAttribute('aria-live','polite');counter.setAttribute('aria-atomic','true');
 function count(){const total=projects.filter(p=>!p.hidden).length;counter.textContent=`SHOWING ${String(total).padStart(2,'0')} PROJECTS`;const selected=filters.find(b=>b.classList.contains('active'))?.dataset.filter||'all',url=new URL(location.href);if(selected==='all')url.searchParams.delete('category');else url.searchParams.set('category',selected);history.replaceState(history.state,'',url)}
 filters.forEach(b=>b.addEventListener('click',count));
 links.forEach(a=>a.addEventListener('click',()=>{if(document.body.dataset.workView!=='index')return;document.querySelector('[data-filter="all"]').click();document.querySelector('#work-'+a.dataset.jump)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'})}));
 if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{if(document.body.dataset.workView!=='index')return;entries.forEach(e=>{if(e.isIntersecting)links.forEach(a=>{const selected=a.dataset.jump===e.target.dataset.project;a.classList.toggle('current',selected);if(selected)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')})})},{rootMargin:'-15% 0px -45% 0px',threshold:0});projects.forEach(p=>observer.observe(p))}
 const category=new URLSearchParams(location.search).get('category'),initial=filters.find(b=>b.dataset.filter===category);if(initial)initial.click();else count();
})();
