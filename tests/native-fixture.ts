// Native boundary substitute only. Runs the production phone engine and TV protocol adapters.
// No hub, physical TV, public API call, or real account is involved.
import type { Device } from '../src/model.ts';
export const fixtureTV: Device = {id:'11111111-1111-4111-8111-111111111111',host:'192.168.1.210',name:'شاشة اختبار الصالة',platform:'webos',paired:false,seenAt:Date.now()};
export const fixtureSecond: Device = {id:'22222222-2222-4222-8222-222222222222',host:'192.168.1.211',name:'شاشة اختبار الغرفة',platform:'tizen',paired:true,seenAt:Date.now()};
export function nativeFixture(cloudBase='', metadataApk?: Uint8Array) {
  const preferences=new Map([['direct-tv-library',JSON.stringify({devices:[fixtureTV,fixtureSecond],packages:[],receipts:[]})]]);
  const vault=new Map([['tv-secrets',JSON.stringify({[fixtureSecond.id]:'fixture-samsung-token'})]]);
  const files=new Map<string,string>(),channels=new Map<string,{host:string;queue:string[];closed:boolean;permissions?:string[]}>();
  const control:{id:string;command:string}[]=[],calls:{plugin:string;method:string;args:any}[]=[];
  async function invoke(plugin:string,method:string,args:any={}) {
    calls.push({plugin,method,args:plugin==='CapacitorHttp'?{url:args.url}:args});
    if(plugin==='Preferences'){if(method==='get')return{value:preferences.get(args.key)||null};if(method==='set')preferences.set(args.key,args.value);if(method==='remove')preferences.delete(args.key);return{};}
    if(plugin==='HomeDiscovery'){const key=args.key||'session';if(method==='readSession')return{value:vault.get(key)};if(method==='saveSession')vault.set(key,args.value);if(method==='clearSession')vault.delete(key);return{};}
    if(plugin==='Filesystem'){if(method==='getUri')return{uri:'fixture://'+args.path};if(method==='writeFile'){files.set(args.path,args.data);return{uri:'fixture://'+args.path};}if(method==='readFile')return{data:files.get(args.path)};if(method==='rmdir')files.clear();return{};}
    if(plugin==='App'||plugin==='Share')return{};
    if(plugin==='CapacitorHttp'){
      const url=new URL(args.url);if(url.origin!=='https://flix-test.example'||!cloudBase)throw new Error('Unexpected cloud request');
      const response=await fetch(cloudBase+url.pathname,{method:args.method,headers:args.headers,body:args.data===undefined?undefined:JSON.stringify(args.data)});
      return{status:response.status,data:await response.json(),headers:{'content-type':'application/json'},url:args.url};
    }
    if(plugin==='DirectAdb'){
      if(method==='pair')return{};if(method==='install')return{output:'Success'};
      const command=String(args.command||'');
      if(command.includes("'dumpsys' 'window'"))return{output:'mCurrentFocus=Window{aa u0 com.flix.metadatafixture/.MainActivity}'};
      if(command.includes("'dumpsys' 'media_session'"))return{output:'package=com.flix.metadatafixture\nstate=PlaybackState {state=3, position=120}\nmetadata: size=1, description=Fixture episode, null, null'};
      if(metadataApk){
        if(command.includes("'query-activities'"))return{output:'com.flix.metadatafixture/.MainActivity\n'};
        if(command.includes("'pm' 'path'"))return{output:'package:/data/app/~~fixture/key/base.apk\n'};
        if(command.includes("'stat' '-c'"))return{output:String(metadataApk.length)};
        const range=command.match(/bs=4096 skip=(\d+) count=(\d+)/);
        if(range){const bytes=metadataApk.subarray(Number(range[1])*4096,(Number(range[1])+Number(range[2]))*4096);return{output:Buffer.from(bytes).toString('base64')};}
      }
      return{output:command==='echo FLIX_CONNECTED'?'FLIX_CONNECTED\n':''};
    }
    if(plugin!=='DirectLan')throw new Error('Unexpected plugin '+plugin);
    if(method==='discover')return{devices:[{host:fixtureTV.host,name:fixtureTV.name,ssdp:'HTTP/1.1 200 OK\r\nSERVER: LG webOS\r\n'},{host:fixtureSecond.host,name:'Samsung Tizen'}]};
    if(method==='open'){
      const host=new URL(args.url).hostname;if(![fixtureTV.host,fixtureSecond.host].includes(host))throw new Error('Unexpected TV destination');
      channels.set(args.id,{host,closed:false,queue:host===fixtureSecond.host?[JSON.stringify({event:'ms.channel.connect',data:{token:'fixture-samsung-token'}})]:[]});return{};
    }
    if(method==='close'){const c=channels.get(args.id);if(c)c.closed=true;return{};}
    if(method==='http'&&args.url.endsWith('/webos_rsa'))return{type:'text/plain',data:btoa('-----BEGIN PRIVATE KEY-----\nfixture-only\n-----END PRIVATE KEY-----')};
    if(method==='http')return{type:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE1sAAAAASUVORK5CYII='};
    const c=channels.get(args.id);if(!c)throw new Error('Closed fixture channel');
    if(method==='read'){if(!c.queue.length&&!c.closed)await new Promise(r=>setTimeout(r,20));return{data:c.queue.shift(),closed:c.closed&&!c.queue.length};}
    if(method==='write'){
      const id=c.host===fixtureTV.host?fixtureTV.id:fixtureSecond.id;
      if(args.data.startsWith('type:button')){control.push({id,command:args.data.includes('ENTER')?'ok':args.data.includes('MENU')?'settings':'button'});return{};}
      const m=JSON.parse(args.data);let payload:any={returnValue:true};
      if(m.type==='register'){c.permissions=m.payload?.manifest?.permissions;c.queue.push(JSON.stringify({type:'registered',payload:{'client-key':'fixture-lg-key'}}));return{};}
      if(m.uri?.endsWith('getPointerInputSocket'))payload.socketPath=`ws://${c.host}:3000/pointer`;
      if(m.uri?.endsWith('listLaunchPoints'))payload.launchPoints=[{id:'com.test.player',title:'FLIX Test',icon:`http://${c.host}:3000/icon.png`},{id:'net.test.video',title:'Test Video'}];
      if(m.uri?.endsWith('getForegroundAppInfo')){
        if(!c.permissions?.includes('READ_RUNNING_APPS')){c.queue.push(JSON.stringify({id:m.id,type:'error',error:'401 insufficient permissions'}));return{};}
        payload={returnValue:true,appId:'com.test.player'};
      }
      if(m.uri?.endsWith('getVolume'))payload={returnValue:true,volume:25,muted:false};
      if(m.uri?.endsWith('getExternalInputList'))payload.devices=[{id:'HDMI_1',label:'HDMI 1'}];
      if(m.uri?.endsWith('system.launcher/launch'))control.push({id,command:'launch:'+m.payload.id});
      if(m.uri?.endsWith('setVolume'))control.push({id,command:'volume:'+m.payload.volume});
      if(m.method==='ms.remote.control')control.push({id,command:m.params.DataOfCmd});
      if(m.params?.event==='ed.installedApp.get')c.queue.push(JSON.stringify({event:'ed.installedApp.get',data:[{appId:'com.test.player',name:'FLIX Test'}]}));
      if(m.id)c.queue.push(JSON.stringify({id:m.id,type:'response',payload}));return{};
    }
    throw new Error('Unexpected native call');
  }
  return{invoke,control,calls,preferences,vault,files,channels};
}
export function installNativeBoundary(platform: 'android' | 'ios' = 'android') {
  const win=globalThis as any;
  if(platform==='ios')win.webkit={messageHandlers:{bridge:{postMessage(){throw new Error('Unintercepted iOS native call');}}}};
  else win.androidBridge={};
  const methods:Record<string,string[]>={DirectAdb:['pair','shell','install'],DirectLan:['discover','open','read','write','close','http'],HomeDiscovery:['saveSession','readSession','clearSession'],Preferences:['get','set','remove'],Filesystem:['writeFile','readFile','getUri','rmdir'],CapacitorHttp:['request','get'],App:['addListener','removeListener'],Share:['share']};
  win.Capacitor={PluginHeaders:Object.entries(methods).map(([name,entries])=>({name,methods:entries.map(name=>({name,rtype:name==='addListener'?'callback':'promise'}))})),nativePromise:(p:string,m:string,a:any)=>win.fixtureNative(p,m,a),nativeCallback:()=>String(Math.random())};
}
