/* Original kinetic sculpture, drawn locally without external 3D dependencies. */
(()=>{
 const c=document.querySelector('#abstract-form');if(!c)return;
 const g=c.getContext('2d');if(!g)return;
 const reduce=matchMedia('(prefers-reduced-motion:reduce)');
 let w=0,h=0,dpr=1,t=0,last=0,px=0,py=0,tx=0,ty=0,energy=0,paused=reduce.matches,visible=true,dirty=true;
 const resize=()=>{const b=c.getBoundingClientRect();w=b.width;h=b.height;dpr=Math.min(devicePixelRatio||1,1.7);c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);dirty=true};
 new ResizeObserver(resize).observe(c);resize();
 new IntersectionObserver(es=>{visible=es[0].isIntersecting;dirty=true}).observe(c);
 c.addEventListener('pointermove',e=>{const b=c.getBoundingClientRect();tx=(e.clientX-b.left)/w*2-1;ty=(e.clientY-b.top)/h*2-1;dirty=true});
 c.addEventListener('pointerleave',()=>{tx=ty=0;dirty=true});
 c.addEventListener('pointerdown',()=>{energy=1;dirty=true});
 c.addEventListener('keydown',e=>{if(['Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')tx-=.2;else if(e.key==='ArrowRight')tx+=.2;else if(e.key==='ArrowUp')ty-=.2;else if(e.key==='ArrowDown')ty+=.2;else energy=1;dirty=true}});
 const pause=document.querySelector('#pause-motion'),toggle=document.querySelector('#toggle-form'),panel=document.querySelector('#form-settings');
 const pauseState=()=>{pause.textContent=paused?'播放动画 ▷':'暂停动画 Ⅱ';pause.setAttribute('aria-pressed',String(paused))};
 pause.addEventListener('click',()=>{paused=!paused;dirty=true;pauseState()});pauseState();
 reduce.addEventListener('change',()=>{paused=reduce.matches;dirty=true;pauseState()});
 document.querySelector('#stir-pattern').addEventListener('click',()=>{energy=1;dirty=true});
 const close=()=>{panel.hidden=true;toggle.setAttribute('aria-expanded','false')};
 toggle.addEventListener('click',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden))});
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('.object-toolbar'))close()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){close();toggle.focus()}});
 const cover=document.querySelector('.portfolio-cover');const header=()=>document.body.classList.toggle('cover-passed',scrollY>cover.offsetHeight-100);addEventListener('scroll',header,{passive:true});header();
 document.querySelector('.portal-loader').hidden=true;
 function draw(){
  g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
  const mobile=w<600,cx=w*(mobile?.5:.73),cy=h*(mobile?.52:.47),size=Math.min(w*(mobile?.34:.255),h*.29);
  g.save();g.translate(cx,cy);
  const spin=t*.13+px*.18,rx=.95+py*.25,ry=.25+px*.35,rz=-.28+Math.sin(t*.17)*.12;
  const project=(u,v)=>{const radius=1+.21*Math.cos(v),a=u+spin;let x=radius*Math.cos(a),y=radius*Math.sin(a),z=.21*Math.sin(v)+Math.sin(u*3+t)*.045*(1+energy);let yy=y*Math.cos(rx)-z*Math.sin(rx);z=y*Math.sin(rx)+z*Math.cos(rx);y=yy;let xx=x*Math.cos(ry)+z*Math.sin(ry);z=-x*Math.sin(ry)+z*Math.cos(ry);x=xx;xx=x*Math.cos(rz)-y*Math.sin(rz);y=x*Math.sin(rz)+y*Math.cos(rz);x=xx;const p=3.8/(3.8+z);return{x:x*size*p,y:y*size*p,z}};
  const plates=[];
  for(let i=0;i<100;i++){
   const u=i/100*Math.PI*2,points=[];
   for(let j=0;j<=36;j++)points.push(project(u,j/36*Math.PI*2));
   for(let j=36;j>=0;j--)points.push(project(u+.034,j/36*Math.PI*2));
   const center=project(u,0);plates.push({points,z:center.z,u});
  }
  plates.sort((a,b)=>b.z-a.z);
  for(const plate of plates){
   const p=plate.points,shade=.5+.5*Math.sin(plate.u*2.1+t*.5+px*.6);
   const grad=g.createLinearGradient(p[0].x,p[0].y,p[18].x,p[18].y);
   grad.addColorStop(0,'#dddcd3');grad.addColorStop(.16,'#696a66');grad.addColorStop(.36,'#171918');grad.addColorStop(.49,`rgb(${Math.round(155+shade*85)},${Math.round(155+shade*85)},${Math.round(148+shade*82)})`);grad.addColorStop(.58,'#f5f4e9');grad.addColorStop(.7,'#4b4e4a');grad.addColorStop(1,'#94968e');
   g.beginPath();p.forEach((pt,j)=>j?g.lineTo(pt.x,pt.y):g.moveTo(pt.x,pt.y));g.closePath();g.fillStyle=grad;g.fill();g.strokeStyle='#e4e5d51a';g.lineWidth=.5;g.stroke();
  }
  g.restore();
 }
 function frame(stamp){requestAnimationFrame(frame);if(!visible||document.hidden)return;if(stamp-last<32)return;const delta=Math.min((stamp-(last||stamp))/1000,.06);last=stamp;if((paused||reduce.matches)&&!dirty)return;if(!paused&&!reduce.matches)t+=delta;px+=(tx-px)*.06;py+=(ty-py)*.06;energy*=.96;draw();dirty=(Math.abs(px-tx)+Math.abs(py-ty)>.002)||energy>.01}
 requestAnimationFrame(frame);
})();
