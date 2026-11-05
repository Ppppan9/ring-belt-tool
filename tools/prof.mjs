import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1400,height:1000}});
await p.goto('file:///workspace/ring-belt/jiehuan_chuansongdai_phase15.html?det&seed=3'); await p.waitForFunction(() => window.__ready);
const c = await p.context().newCDPSession(p); await c.send('Profiler.enable'); await c.send('Profiler.setSamplingInterval',{interval:500}); await c.send('Profiler.start');
const t=await p.evaluate(()=>{const a=performance.now();__setSettings({theme:'jade'});const m=performance.now();__step(3);return [m-a,performance.now()-m]});
const {profile}=await c.send('Profiler.stop');
const self={}, byId={}; for(const n of profile.nodes) byId[n.id]=n;
const dt=profile.timeDeltas; profile.samples.forEach((s,i)=>{const n=byId[s];const k=n.callFrame.functionName+':'+n.callFrame.lineNumber;self[k]=(self[k]||0)+dt[i]/1000;});
console.log(t, Object.entries(self).sort((a,b)=>b[1]-a[1]).slice(0,15));
// inclusive by function name
const parent={};for(const n of profile.nodes)for(const ch of n.children||[])parent[ch]=n.id;
const inc={};profile.samples.forEach((s,i)=>{const seen=new Set();let id=s;while(id){const n=byId[id];const k=n.callFrame.functionName+':'+n.callFrame.lineNumber;if(!seen.has(k)){seen.add(k);inc[k]=(inc[k]||0)+dt[i]/1000;}id=parent[id];}});
console.log(Object.entries(inc).sort((a,b)=>b[1]-a[1]).slice(0,30));
await b.close();
