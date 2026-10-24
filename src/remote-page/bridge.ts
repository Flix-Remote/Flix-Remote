import type { Command, Device, Capabilities, TvApp, PackageEntry } from '../model.ts';
import { VERSION, BUILD_ID } from '../build-info.ts';
type Tv=Device & {capabilities:Capabilities};
export type Utility='support'|'problem'|'library'|'pair'|'manual'|'settings'|'devices';
export interface PageHost {
 household?(operation:string,data:Record<string,unknown>):Promise<unknown>;
 api<T>(path:string,method?:string,data?:unknown):Promise<T>;
 selected():string;
 select(id:string):void;
 open(action:Utility,host?:string):void;
 record(path:string,ok:boolean,message:string,deviceId:string):void;
}
export const pageKeys:Record<string,Command>={UP:'up',DOWN:'down',LEFT:'left',RIGHT:'right',ENTER:'ok',BACK:'back',HOME:'home',MENU:'settings',VOLUMEUP:'volumeUp',VOLUMEDOWN:'volumeDown',MUTE:'mute',PLAY:'playPause',PAUSE:'pause',REWIND:'rewind',FASTFORWARD:'fastForward',INFO:'info',EXIT:'exit',CHANNELUP:'channelUp',CHANNELDOWN:'channelDown'};
export {resolveShortcut} from './shortcuts.ts';
import {resolveShortcut} from './shortcuts.ts';
export function createPageBridge(h:PageHost){
 let scanning:Promise<any>|undefined;
 const events:{at:string;action:string;ok:boolean;ms:number;why:string}[]=[];
 const list=async()=>(await h.api<{devices:Tv[]}>('/api/devices')).devices;
 const path=(d:Device)=>'/api/devices/'+encodeURIComponent(d.id);
 const target=async(host?:string)=>{const all=await list();const d=host?all.find(d=>d.host===host):all.find(d=>d.id===h.selected())||all[0];if(!d){throw Error('اختر تلفزيونًا من البحث، أو أضف عنوانه ونظامه أولًا.');}return d;};
 return async function request(route:string,method='GET',body:Record<string,any>={}){
  const url=new URL(route,'https://phone.invalid'),action=url.pathname,started=Date.now();let deviceId='';let chosen:Tv|undefined;
  try{
   if(action==='/api/household'){
    if(!h.household)throw Error('حدّث نسخة التطبيق لاستخدام الملفات والإدارة.');
    return await h.household(String(body.operation||'status'),body.data||{});
   }
   if(action==='/api/native-panel'){if(!['support','problem','library','pair','manual','settings','devices'].includes(body.panel))throw Error('نافذة غير صالحة');h.open(body.panel,body.host);return{ok:true};}
   if(action==='/api/voice/warm')return{ok:true};
   if(action==='/api/discover'){
    scanning ||= h.api<any>('/api/scan','POST',{}).finally(()=>{scanning=undefined;});
    const r=await scanning;return{ok:true,found:r.devices.map((d:Tv)=>({...d,kind:d.platform,lg:d.platform==='webos'})),diagnostics:r.diagnostics};
   }
   if(action==='/api/televisions'){return{ok:true,televisions:(await list()).map(d=>({...d,kind:d.platform,canWake:false}))};}
   if(action==='/api/versions'){return{ok:true,builds:[{label:'ريموت FLIX',platform:'iPhone · Android',version:VERSION,updated:BUILD_ID}]};}
   if(action==='/api/monitor'){const failed=events.filter(e=>!e.ok),times=events.map(e=>e.ms).sort((a,b)=>a-b);return{ok:true,commands:events.length,failed:failed.length,median:times.length?times[Math.floor(times.length/2)]:0,slowest:times.at(-1)||0,causes:failed.slice(-5).map(e=>({count:1,why:e.why,did:'افتح حساب FLIX والدعم لمشاركة التشخيص'})),recent:events.slice(-30).reverse()};}
   const d=await target(body.host||url.searchParams.get('host')||undefined);deviceId=d.id;chosen=d;
   if(method!=='GET')h.select(d.id);
   const call=<T>(operation:string,data?:unknown,verb='POST')=>h.api<T>(path(d)+'/'+operation,verb,data);
   if(action==='/api/state'){let connected=false;if(d.paired){try{connected=!!(await call<any>('page-operation',{operation:'connection'})).connected;}catch{}}return{ok:true,connected,paired:(await list()).filter(x=>x.paired).map(x=>x.host),defaultHost:d.host};}
   if(action==='/api/tv-targets')return{ok:true,targets:(await list()).map(x=>({id:'__direct__@'+x.host,name:x.name,label:x.name,direct:true}))};
   if(action==='/api/app-icon')return call<{icon:string}>('icon?appId='+encodeURIComponent(url.searchParams.get('appId')||''),undefined,'GET');
   if(action==='/api/apps-on-tv'){if(!d.paired)return{ok:false,apps:[],message:'اقرن التلفزيون أولًا'};const r=await call<{apps:TvApp[]}>('apps',undefined,'GET');return{ok:true,apps:r.apps.map(a=>({...a,title:a.label}))};}
   if(action==='/api/tv-apps'){const r=await h.api<{packages:PackageEntry[]}>('/api/packages');return{ok:true,platform:d.platform,device:true,apps:r.packages.filter(p=>p.platform===d.platform).map(p=>({id:p.id,key:p.id,app:p.id,label:p.name,version:p.version,file:p.filename})),note:'أضف حزمة متوافقة من تطبيقاتي'};}
   if(action==='/api/tv-install'){h.open('library',d.host);throw Error('راجع الحزمة والتلفزيون في نافذة تطبيقاتي ثم وافق على التثبيت.');}
   if(action==='/api/picture-pair'){h.open('pair',d.host);return{ok:true,paired:false,pairing:true,message:'أكمل موافقة التلفزيون في نافذة الاقتران ثم ارجع للريموت.'};}
   if(!d.paired){if(method!=='GET')h.open('pair',d.host);throw Error('يحتاج التلفزيون موافقتك على الاقتران أولًا.');}
   const operation=(name:string,data:Record<string,any>=body)=>call<any>('page-operation',{...data,operation:name});
   if(action==='/api/button'){const command=pageKeys[String(body.name)];if(!command||!d.capabilities.commands.includes(command))throw Error('هذا الزر لا يدعمه بروتوكول التلفزيون.');await call('command',{command});}
   else if(action==='/api/power-off')await call('command',{command:'powerOff'});
   else if(action==='/api/power-on')throw Error('تشغيل الشاشة من الاستعداد يحتاج دعم Wake-on-LAN وعنوانها المادي وإذن الشبكة؛ شغّلها بريموتها حاليًا.');
   else if(action==='/api/launch'){const apps=await call<{apps:TvApp[]}>('apps',undefined,'GET');await call('launch',{appId:resolveShortcut(String(body.id),apps.apps)});}
   else if(action==='/api/settings')await operation('open-settings',{page:body.page});
   else if(['/api/move','/api/scroll','/api/click','/api/type','/api/input','/api/open-in-app'].includes(action)){const result=await operation(action.slice(5));h.record(action,result?.ok!==false,String(result?.message||method),deviceId);return{ok:true,...result};}
   else if(action==='/api/inputs')return{ok:true,...await operation('inputs')};
   else if(action==='/api/sound')return{ok:true,...await operation('sound',method==='GET'?{}:body)};
   else if(action==='/api/picture')return{ok:true,...await operation('picture',method==='GET'?{}:body)};
   else if(action==='/api/bluetooth')return{ok:true,...await operation('bluetooth',method==='GET'?{}:body)};
   else if(action==='/api/sound-output-set')return{ok:true,...await operation('sound',{output:body.output})};
   else if(action==='/api/keep-awake')return{ok:true,...await operation('keep-awake')};
   else if(action==='/api/voice')return operation('voice');
   else if(action==='/api/title-progress'||action==='/api/continue'){
    const id=action==='/api/title-progress'?url.searchParams.get('id')||'':'';
    const r=await operation('history',{id,app:url.searchParams.get('app')||'s'});
    if(id)return{ok:true,connected:true,entries:r.entries};
    return{ok:true,app:url.searchParams.get('app')||'s',cards:r.entries.filter((e:any)=>e.id&&e.title).map((e:any)=>({...e,series:e.type==='tv',app:url.searchParams.get('app')||'s',done:e.completed,label:e.type==='tv'?'م '+e.season+' · ح '+e.episode:'فيلم',poster:e.poster?.startsWith('/')?'https://image.tmdb.org/t/p/w342'+e.poster:e.poster,path:e.type==='tv'?'/tv/'+e.id+'/watch?s='+(e.season||1)+'&e='+(e.episode||1):'/movie/'+e.id+'/watch'}))};
   }
   else if(action==='/api/stats'){
    const r=await operation('history',{}),rows=Array.isArray(r.entries)?r.entries:[],now=Date.now();
    return{ok:true,scopeText:'من سجل الشاشة المحددة: '+d.name+'؛ يعرض التقدم المحفوظ ولا يقيس وقت المشاهدة الفعلي أو إحصاءات بقية الحسابات.',devices:1,televisions:1,activeToday:rows.some((e:any)=>now-e.at<86400000)?1:0,activeWeek:rows.some((e:any)=>now-e.at<604800000)?1:0,movies:rows.filter((e:any)=>e.type==='movie').length,series:rows.filter((e:any)=>e.type==='tv').length,seconds:rows.reduce((n:number,e:any)=>n+Math.max(0,e.currentTime||0),0),recording:true,watched:rows.slice(0,30).map((e:any)=>({...e,device:d.name,seconds:e.currentTime,at:e.at?new Date(e.at).toISOString():''}))};
   }
   else throw Error('الوظيفة غير متاحة عبر بروتوكول هذه الشاشة. أرسل التشخيص من حساب FLIX والدعم.');
   h.record(action,true,method,deviceId);events.push({at:new Date().toISOString(),action,ok:true,ms:Date.now()-started,why:''});if(events.length>80)events.shift();return{ok:true};
  }catch(error){const message=error instanceof Error?error.message:'تعذر الاتصال';h.record(action,false,message,deviceId);events.push({at:new Date().toISOString(),action,ok:false,ms:Date.now()-started,why:message});if(events.length>80)events.shift();return{ok:false,error:'phone_direct',message,...(action==='/api/picture'?{lg:chosen?.platform==='webos',paired:false,pairingError:message}:{})};}
 };
}
