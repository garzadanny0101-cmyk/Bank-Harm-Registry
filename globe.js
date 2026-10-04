(()=>{"use strict";
const c=document.getElementById("bhrGlobe");if(!c)return;const x=c.getContext("2d",{alpha:true});
let w=0,h=0,r=0,rot=-.45,drag=false,lastX=0,dpr=Math.min(devicePixelRatio||1,2);
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const src=[["CFPB",38.9,-77],["OCC",38.9,-77.04],["FDIC",38.9,-77.03],["Federal Reserve",38.89,-77.05],["FTC",38.89,-77.02],["Courts",40.7,-74]];
const pairs=[[0,1],[0,2],[0,3],[0,4],[2,5]];
function size(){const b=c.getBoundingClientRect();w=Math.max(1,b.width);h=Math.max(1,b.height);dpr=Math.min(devicePixelRatio||1,2);c.width=w*dpr;c.height=h*dpr;x.setTransform(dpr,0,0,dpr,0,0);r=Math.min(w,h)*.36}
function p(lat,lon){let a=lat*Math.PI/180,t=lon*Math.PI/180+rot,X=Math.cos(a)*Math.sin(t),Y=Math.sin(a),Z=Math.cos(a)*Math.cos(t);return{x:w/2+X*r,y:h/2-Y*r,z:Z,a:Math.max(.08,(Z+1)/2)}}
function sphere(){let g=x.createRadialGradient(w/2-r*.28,h/2-r*.28,r*.08,w/2,h/2,r*1.1);g.addColorStop(0,"rgba(59,164,207,.16)");g.addColorStop(.5,"rgba(20,74,101,.10)");g.addColorStop(1,"rgba(7,12,17,.02)");x.fillStyle=g;x.beginPath();x.arc(w/2,h/2,r,0,Math.PI*2);x.fill();x.strokeStyle="rgba(137,222,249,.20)";x.stroke();
for(let lat=-60;lat<=60;lat+=30){x.beginPath();let s=false;for(let lon=-180;lon<=180;lon+=4){let q=p(lat,lon);if(q.z<=-.05){s=false;continue}s?(x.lineTo(q.x,q.y)):(x.moveTo(q.x,q.y),s=true)}x.strokeStyle="rgba(130,201,228,.10)";x.stroke()}
for(let lon=-150;lon<=180;lon+=30){x.beginPath();let s=false;for(let lat=-88;lat<=88;lat+=3){let q=p(lat,lon);if(q.z<=-.05){s=false;continue}s?(x.lineTo(q.x,q.y)):(x.moveTo(q.x,q.y),s=true)}x.strokeStyle="rgba(130,201,228,.075)";x.stroke()}}
function routes(t){pairs.forEach(([a,b],i)=>{let A=p(src[a][1],src[a][2]),B=p(src[b][1],src[b][2]);if(A.z<0||B.z<0)return;let mx=(A.x+B.x)/2,my=(A.y+B.y)/2-Math.min(52,Math.hypot(B.x-A.x,B.y-A.y)*.22);x.beginPath();x.moveTo(A.x,A.y);x.quadraticCurveTo(mx,my,B.x,B.y);x.strokeStyle="rgba(110,214,248,.20)";x.stroke();let u=((t*.00012)+i*.17)%1,px=(1-u)*(1-u)*A.x+2*(1-u)*u*mx+u*u*B.x,py=(1-u)*(1-u)*A.y+2*(1-u)*u*my+u*u*B.y;x.fillStyle="rgba(146,236,255,.85)";x.beginPath();x.arc(px,py,2.2,0,Math.PI*2);x.fill()})}
function nodes(t){src.forEach((s,i)=>{let q=p(s[1],s[2]+i*17);if(q.z<-.08)return;let pulse=reduce?0:(Math.sin(t*.002+i)+1)*1.5;x.fillStyle=`rgba(129,229,255,${.45+q.a*.45})`;x.beginPath();x.arc(q.x,q.y,3.2,0,Math.PI*2);x.fill();x.strokeStyle=`rgba(129,229,255,${.10+q.a*.14})`;x.beginPath();x.arc(q.x,q.y,7+pulse,0,Math.PI*2);x.stroke();if(q.z>.28&&w>520){x.font="600 11px Inter,system-ui,sans-serif";x.fillStyle=`rgba(190,222,235,${.35+q.a*.55})`;x.fillText(s[0],q.x+9,q.y-7)}})}
function draw(t=0){x.clearRect(0,0,w,h);if(!drag&&!reduce)rot+=.0017;sphere();routes(t);nodes(t);requestAnimationFrame(draw)}
c.addEventListener("pointerdown",e=>{drag=true;lastX=e.clientX;c.setPointerCapture(e.pointerId)});c.addEventListener("pointermove",e=>{if(!drag)return;rot+=(e.clientX-lastX)*.006;lastX=e.clientX});["pointerup","pointercancel"].forEach(ev=>c.addEventListener(ev,()=>drag=false));
new ResizeObserver(size).observe(c);size();draw();
const f=document.getElementById("institutionSearchForm"),i=document.getElementById("institutionSearch");if(f&&i)f.addEventListener("submit",e=>{e.preventDefault();let q=i.value.trim();if(!q){i.focus();return}location.href=`registry.html?q=${encodeURIComponent(q)}`});
})();