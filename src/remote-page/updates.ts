import {CapacitorHttp} from '@capacitor/core';
import {Preferences} from '@capacitor/preferences';

// UI updates never replace native plugins. Incompatible bridge changes require a new binary.
export const REMOTE_BRIDGE_VERSION=1;
const origin='https://flix-admin-tan.vercel.app',key='flix-remote-ui-v1';
export interface PageRelease {schema:number;bridge:number;sha256:string;bytes:number;path:string;version:string}
export const remoteUI={source:'bundled',sha256:'',version:'',message:''};
export function validPageRelease(r:PageRelease){return r?.schema===1&&r.bridge===REMOTE_BRIDGE_VERSION&&/^[a-f0-9]{64}$/.test(r.sha256)&&Number.isInteger(r.bytes)&&r.bytes>0&&r.bytes<=512*1024&&r.path==='/home-remote/ui/page-'+r.sha256+'.html'&&typeof r.version==='string'&&r.version.length<=40;}
export async function verifyPage(r:PageRelease,html:string){
 if(!validPageRelease(r)||typeof html!=='string')throw Error('Incompatible remote UI');
 const bytes=new TextEncoder().encode(html);if(bytes.length!==r.bytes)throw Error('Remote UI size mismatch');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==r.sha256)throw Error('Remote UI digest mismatch');return html;
}
/** The last downloaded page that still verifies, read from local storage only; never throws. */
export async function cachedRemotePage():Promise<{release:PageRelease;html:string}|undefined>{
 try{const stored=JSON.parse((await Preferences.get({key})).value||'null');if(stored){const html=await verifyPage(stored.release,stored.html);Object.assign(remoteUI,{source:'cached',sha256:stored.release.sha256,version:stored.release.version});return{release:stored.release,html};}}catch{/* Keep the bundled working page on corrupt storage. */}
 return undefined;
}
export async function latestRemotePage(fallback:string){
 const cached=await cachedRemotePage(),previous=cached?.release;let source=cached?.html??fallback;
 try{
  const manifest=await CapacitorHttp.request({url:origin+'/home-remote/ui/release.json',method:'GET',headers:{'Cache-Control':'no-cache'},responseType:'json',connectTimeout:4000,readTimeout:4000});
  const release=manifest.data as PageRelease;if(manifest.status!==200||!validPageRelease(release))throw Error('UI release unavailable or requires an app update');
  if(previous?.sha256!==release.sha256){const response=await CapacitorHttp.request({url:origin+release.path,method:'GET',responseType:'text',connectTimeout:4000,readTimeout:4000});if(response.status!==200)throw Error('UI download failed');source=await verifyPage(release,response.data);await Preferences.set({key,value:JSON.stringify({release,html:source})});}
  Object.assign(remoteUI,{source:'latest',sha256:release.sha256,version:release.version,message:''});
 }catch{remoteUI.message='تعذر جلب تحديث الواجهة؛ تستخدم آخر نسخة سليمة محفوظة.';}
 return source;
}
