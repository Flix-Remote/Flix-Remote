import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import bundledSource from './source.html?raw';
import {latestRemotePage} from './updates.ts';
import { createPageBridge, type PageHost, type Utility } from './bridge.ts';

declare global {interface Window {flixRemotePageRequest:(route:string,init?:{method?:string;body?:string})=>Promise<Response>;flixRemoteSpeech:()=>Promise<{text:string}>}}
const cloudHosts=new Set(['flix-s-neon.vercel.app','flix-iptv-snowy.vercel.app','flix-admin-tan.vercel.app']);
/** The bundled original page runs unchanged; only transport and account/install entry points change. */
export async function mountOriginalRemote(host:PageHost){
 // Render the reviewed bundled page before waiting for cloud update traffic.
 // The caller starts update() after initialization; its existing idle/dialog
 // guards still protect account forms and in-progress remote interactions.
 let source=bundledSource,idleAfter=0,updating=false;
 const frame=document.createElement('iframe');frame.id='original-remote';frame.title='صفحة ريموت FLIX الأصلية';
 frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-modals');
 const request=createPageBridge(host),browserFetch=window.fetch.bind(window);
 window.flixRemotePageRequest=async(route,init={})=>{
  const method=init.method||'GET';
  if(route.startsWith('/api/')){
   let body:Record<string,unknown>={};try{body=init.body?JSON.parse(init.body):{};}catch{return Response.json({ok:false,message:'طلب غير صالح'},{status:400});}
   return Response.json(await request(route,method,body));
  }
  const url=new URL(route,window.location.href);
  if(url.protocol!=='https:'||!cloudHosts.has(url.hostname))throw Error('عنوان خدمة غير مسموح');
  if(!Capacitor.isNativePlatform())return browserFetch(route,init);
  const result=await CapacitorHttp.request({url:url.href,method,headers:{'Content-Type':'application/json'},data:init.body?JSON.parse(init.body):undefined,connectTimeout:10000,readTimeout:20000});
  return Response.json(result.data,{status:result.status});
 };
 window.flixRemoteSpeech=()=>registerPlugin<{recognizeSpeech():Promise<{text:string}>}>('HomeDiscovery').recognizeSpeech();
 const speechShim=Capacitor.isNativePlatform()?`window.SpeechRecognition=class{start(){parent.flixRemoteSpeech().then(r=>{const row=[{transcript:r.text}];row.isFinal=true;this.onresult?.({resultIndex:0,results:[row]});}).catch(()=>this.onerror?.({error:'not-allowed'})).finally(()=>this.onend?.());}};`:'';
 const shim=`<script>window.flixNativePage=true;window.flixHouseholdProtocol=1;window.fetch=(route,init)=>parent.flixRemotePageRequest(String(route),init);${speechShim}</script>`;
 const additions=`<style>
 .remote-actions{display:flex;align-items:center;gap:6px}.remote-actions button{font:inherit;padding:6px 8px;min-height:34px;white-space:nowrap;flex:1}.remote-actions button:first-child{flex:1.7}.installer summary{padding:4px 6px}.phone-notice{position:fixed;inset:auto 8px 8px;background:#18382b;color:#fff;padding:12px;border-radius:12px;z-index:9999;font-size:13px;pointer-events:none}.phone-notice[hidden]{display:none}#nativePair{width:100%;margin-top:8px}
 </style><script>
 const phonePanel=(panel,host)=>fetch('/api/native-panel',{method:'POST',body:JSON.stringify({panel,host:host||window.flixRemote?.host()||''})});
 window.flixOpenAccountSupport=()=>phonePanel('support');
 const oldLink=document.querySelector('a[href="/home-remote"]');if(oldLink)oldLink.remove();
 const install=document.querySelector('.installer'),summary=install?.querySelector('summary');
 if(summary){summary.textContent='';summary.classList.add('remote-actions');for(const [panel,label] of [['library','تثبيت التطبيقات'],['support','حساب FLIX']]){const b=document.createElement('button');b.type='button';b.textContent=label;if(panel==='problem')b.title='مشاركة تشخيص هذا الجوال والشاشات فقط؛ يمكنك إيقاف المشاركة من حساب FLIX';b.onclick=e=>{e.preventDefault();e.stopPropagation();phonePanel(panel)};summary.append(b);}}
 install?.addEventListener('toggle',()=>{if(install.open){install.open=false;phonePanel('library');}});
 const pair=document.createElement('button');pair.id='nativePair';pair.textContent='اقتران بالتلفزيون';pair.onclick=()=>phonePanel('pair');document.getElementById('closeSheet')?.before(pair);
 document.getElementById('useIp').addEventListener('click',()=>phonePanel('manual',document.getElementById('ipInput').value.trim()));
 const notice=document.createElement('div');notice.id='phoneNotice';notice.className='phone-notice';notice.hidden=true;notice.setAttribute('role','status');document.body.append(notice);
 </script>`;
 const setSource=(html:string)=>{frame.srcdoc=html.replace('<head>','<head>'+shim).replace('</body>',additions+'</body>');};
 const canReload=()=>!document.hidden&&Date.now()>=idleAfter&&!document.body.classList.contains('native-sheet-open')&&!document.querySelector('dialog[open],input:focus,textarea:focus,select:focus')&&!frame.contentDocument?.body.classList.contains('editing')&&!frame.contentDocument?.querySelector('.sheet:not([hidden]),.psheet:not([hidden]),input:focus,textarea:focus,select:focus');
 frame.addEventListener('load',()=>{for(const event of ['pointerdown','pointerup','keydown','touchstart','touchend'])frame.contentDocument?.addEventListener(event,()=>{idleAfter=Date.now()+5000;},{passive:true});});
 setSource(source);
 document.body.prepend(frame);document.body.classList.add('remote-original');
 return{update:async()=>{if(updating||!canReload())return;updating=true;try{const next=await latestRemotePage(bundledSource);if(next!==source&&canReload()){source=next;setSource(next);}}finally{updating=false;}},notify:(message:string)=>{const notice=frame.contentDocument?.getElementById('phoneNotice');if(notice){notice.textContent=message;notice.hidden=false;setTimeout(()=>{notice.hidden=true;},7000);}},show:(tvHost?:string)=>{if(tvHost)(frame.contentWindow as any)?.flixRemote?.useHost(tvHost);document.body.classList.add('remote-original');},open:(action:Utility)=>host.open(action)};
}
