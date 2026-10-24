import test from 'node:test';
import assert from 'node:assert/strict';
import {identifyTelevision} from '../src/direct/discovery.ts';
import {createPageBridge,type PageHost} from '../src/remote-page/bridge.ts';
import {navigateExpression,textExpression,historyExpression} from '../src/direct/flix-debug.ts';
import {parseUtterance} from '../src/remote-page/voice-commands-rules.js';
import {createVoiceExecutor} from '../src/remote-page/voice-executor-rules.js';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {describePicture,luminanceSettings} from '../src/remote-page/picture-rules.js';
test('unicast discovery identifies device descriptions and rejects off-device XML locations',async()=>{
 const read=async()=>'<root><device><friendlyName>LG fixture</friendlyName><manufacturer>LG Electronics</manufacturer><modelName>OLED fixture</modelName></device></root>';
 assert.equal((await identifyTelevision({host:'192.168.1.20',location:'http://192.168.1.20:1387/'},read))?.platform,'webos');
 assert.equal((await identifyTelevision({host:'192.168.1.21',location:'http://192.168.1.21:8001/api/v2/'},async()=>JSON.stringify({device:{name:'Samsung fixture',type:'Samsung SmartTV',modelName:'TV'}})))?.platform,'tizen');
 assert.equal(await identifyTelevision({host:'192.168.1.22',location:'http://192.168.1.22/'},async()=>'<html>Router</html>'),undefined);
 await assert.rejects(identifyTelevision({host:'192.168.1.20',location:'http://192.168.1.21/'},read));
 await assert.rejects(identifyTelevision({host:'192.168.1.20',location:'http://192.168.1.20/'},async()=>'<!DOCTYPE x><root/>'));
});
test('Cast adverts require device identity and never imply Android or ADB',async()=>{
 const cast={host:'192.168.1.20',name:'OLED cast',platform:'android',service:'_googlecast._tcp.'};
 let requested='';
 const lg=await identifyTelevision(cast,async url=>{requested=url;return '<root><device><manufacturer>LG Electronics</manufacturer><friendlyName>LG OLED</friendlyName></device></root>';});
 assert.equal(requested,'http://192.168.1.20:1387/');assert.equal(lg?.platform,'webos');
 assert.equal(await identifyTelevision(cast,async()=>{throw Error('No TV description');}),undefined);
 assert.equal(await identifyTelevision({...cast,name:'Chromecast speaker'},async()=>'<root><device><manufacturer>Google Inc.</manufacturer></device></root>'),undefined);
 assert.equal((await identifyTelevision({...cast,service:'_androidtvremote2._tcp.'},async()=>''))?.platform,'android');
});
test('original page never opens utility panels on background reads; explicit actions use selected device only',async()=>{
 const opened:string[]=[],calls:{path:string;data:any}[]=[];let selected='a',paired=false;
 const devices=()=>['a','b'].map((id,i)=>({id,host:'192.168.1.'+(20+i),platform:'webos',name:id,paired,capabilities:{commands:['ok']}}));
 const h:PageHost={selected:()=>selected,select:id=>{selected=id;},open:p=>opened.push(p),record:()=>{},api:async<T>(path:string,_method?:string,data?:unknown)=>{
  calls.push({path,data});if(path==='/api/devices')return {devices:devices()} as T;return {connected:true,inputs:[]} as T;
 }};
 const request=createPageBridge(h);
 for(const path of ['/api/state','/api/sound','/api/picture','/api/inputs'])await request(path);
 assert.deepEqual(opened,[]);
 await request('/api/button','POST',{host:'192.168.1.21',name:'ENTER'});assert.deepEqual(opened,['pair']);
 paired=true;await request('/api/button','POST',{host:'192.168.1.21',name:'ENTER'});
 assert.equal(calls.at(-1)?.path,'/api/devices/b/command');assert.equal(calls.at(-1)?.data.command,'ok');
 assert.equal((await request('/api/button','POST',{name:'UNKNOWN'})).ok,false);
 assert.equal((await request('/api/native-panel','POST',{panel:'arbitrary'})).ok,false);
});
test('shared picture rules keep black level separate and clamp panel luminance',()=>{
 const settings={backlight:'45',brightness:'50',contrast:'80',pictureMode:'hdrCinema'};
 assert.deepEqual(luminanceSettings(-5,settings),{backlight:'10'});
 assert.equal(describePicture(settings).family,'hdr');assert.equal(describePicture(settings).blackCrushed,false);
});
test('FLIX deep links reject external routes and quote keyboard content as data',()=>{
 assert.throws(()=>navigateExpression('//outside.invalid/'));
 assert.throws(()=>navigateExpression('/movie/1;alert(1)'));
 assert.match(navigateExpression('/tv/1/watch?s=2&e=4'),/s=2&e=4/);
 assert.match(textExpression('";alert(1)//',true),/\\";alert/);
});

test('TV history uses actual FLIX fields and exposes no account credentials',()=>{
 const data:Record<string,string>={
  'netflixfree-watch-history:flixs':JSON.stringify([{tmdbId:'17',mediaType:'tv',title:'A',posterPath:'/a.jpg',season:2,episode:3,progress:0.98,currentTime:980,duration:1000,watchedAt:100,completed:true},{tmdbId:'17',mediaType:'tv',title:'A',season:1,episode:1,progress:0.4,watchedAt:40}]),
  'netflixfree-watch-history-backup:flixs':'[]','account-session':'sensitive-fixture-token'};
 const localStorage={length:Object.keys(data).length,key:(i:number)=>Object.keys(data)[i],getItem:(k:string)=>data[k]};
 const rows=vm.runInNewContext(historyExpression('17'),{localStorage});
 assert.equal(rows.length,2);assert.equal(rows[0].id,'17');assert.equal(rows[0].completed,true);assert.equal(rows[0].poster,'/a.jpg');assert.equal(rows[0].at,100);
 assert.doesNotMatch(JSON.stringify(rows),/sensitive-fixture/);
});

test('original Arabic voice parser retains seek, episode and compound commands',()=>{
 assert.equal(parseUtterance('قدّم عشر دقائق')[0]?.seconds,600);
 assert.equal(parseUtterance('الحلقة التالية')[0]?.kind,'episode');
 assert.ok(parseUtterance('ارفع الصوت وبعدها رجوع').length>=2);
});

test('phone voice executor verifies volume against TV response and has no model endpoint',async()=>{
 let volume=20,muted=false;
 const voice=createVoiceExecutor({evaluate:async()=>({ok:false}),ssap:async(_host:string,uri:string,p?:any)=>{
  if(uri.endsWith('setVolume'))volume=p.volume;if(uri.endsWith('setMute'))muted=p.mute;
  return{volume,muted};
 }},{house:'https://flix-s-neon.vercel.app',houseJson:async()=>{throw Error('Unexpected catalogue request');}});
 const r=await voice.run('ارفع الصوت خمسة','192.168.1.20');assert.equal(r.ok,true);assert.equal(volume,25);assert.equal(r.orders[0].verified,true);
 const source=readFileSync(new URL('../src/remote-page/voice-executor-rules.js',import.meta.url),'utf8');assert.doesNotMatch(source,/process\.env|\/v1\/chat|127\.0\.0\.1:11434/);
});
