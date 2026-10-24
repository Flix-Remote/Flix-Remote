import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeFixture,installNativeBoundary,fixtureTV,fixtureSecond } from './native-fixture.ts';
const fixture=nativeFixture();(globalThis as any).fixtureNative=fixture.invoke;installNativeBoundary();
const {directApi,forgetDirect,directStore}=await import('../src/direct/engine.ts');
const {packetParser,closeAndroid}=await import('../src/direct/adb.ts');
const {TvSocket}=await import('../src/direct/socket.ts');
test('direct engine pairs LG, persists credentials separately and targets only selected TV',async(t)=>{
  t.after(()=>forgetDirect());
  await directApi('/api/devices/'+fixtureTV.id+'/pair','POST',{});
  assert.equal(JSON.parse(fixture.vault.get('tv-secrets')!)[fixtureTV.id],'fixture-lg-key');
  assert.equal(fixture.preferences.get('direct-tv-library')!.includes('fixture-lg-key'),false);
  await directApi('/api/devices/'+fixtureTV.id+'/command','POST',{command:'ok'});
  assert.deepEqual(fixture.control.at(-1),{id:fixtureTV.id,command:'ok'});
  const {apps}=await directApi<any>('/api/devices/'+fixtureTV.id+'/apps');assert.equal(apps[0].label,'FLIX Test');
  const {activity}=await directApi<any>('/api/devices/'+fixtureTV.id+'/activity');assert.equal(activity.appId,'com.test.player');assert.equal(activity.available,true);
  // Re-pairing must ask the TV to approve permissions instead of silently reusing an old grant.
  await directApi('/api/devices/'+fixtureTV.id+'/pair','POST',{});
  const registrations=fixture.calls.filter(c=>c.plugin==='DirectLan'&&c.method==='write').map(c=>{try{return JSON.parse(c.args.data);}catch{return{};}}).filter(m=>m.type==='register');
  assert.equal(registrations.at(-1).payload['client-key'],undefined);
  assert.ok(registrations.at(-1).payload.manifest.permissions.includes('READ_RUNNING_APPS'));
  for(const c of fixture.channels.values())if(c.host===fixtureTV.host)c.permissions=[];
  const denied=await directApi<any>('/api/devices/'+fixtureTV.id+'/activity');assert.equal(denied.activity.available,false);assert.match(denied.activity.reason,/401.*أعد الاقتران/);
  for(const c of fixture.channels.values())if(c.host===fixtureTV.host)c.permissions=['READ_RUNNING_APPS'];
  const {settings}=await directApi<any>('/api/devices/'+fixtureTV.id+'/settings');assert.equal(settings.find((s:any)=>s.id==='volume').value,25);
  await directApi('/api/devices/'+fixtureTV.id+'/settings','POST',{id:'volume',value:34});assert.equal(fixture.control.at(-1)?.command,'volume:34');
  await assert.rejects(directApi('/api/devices/'+fixtureTV.id+'/settings','POST',{id:'volume',value:101}));
  const icon=await directApi<any>('/api/devices/'+fixtureTV.id+'/icon?appId=com.test.player');assert.match(icon.icon,/^data:image\/png;base64,/);
  const {package:p}=await directApi<any>('/api/packages','POST',{platform:'android',filename:'test.apk',appId:'com.test.app',data:btoa('PK-fixture')});
  assert.ok(fixture.files.has('packages/'+p.id));assert.match(p.sha256,/^[a-f0-9]{64}$/);
  await assert.rejects(directApi('/api/devices/'+fixtureTV.id+'/install','POST',{packageId:p.id,confirmed:true}),/يلزم|غير متاح|متوافق/);
  await assert.rejects(directApi('/api/packages','POST',{platform:'tizen',appId:'com.test.app',filename:'bad.wgt',data:btoa('invalid')}));
  await directApi('/api/devices/'+fixtureSecond.id+'/pair','POST',{});
  await directApi('/api/devices/'+fixtureSecond.id+'/command','POST',{command:'ok'});
  assert.deepEqual(fixture.control.at(-1),{id:fixtureSecond.id,command:'KEY_ENTER'});
  // Metadata and package deletion must not revoke or expose the unrelated FLIX account session.
  fixture.vault.set('session','synthetic-account-session');await forgetDirect();
  assert.equal(fixture.vault.get('session'),'synthetic-account-session');assert.equal(fixture.vault.has('tv-secrets'),false);assert.equal(directStore.data.devices.length,0);
  closeAndroid();
});
test('scan repairs an unpaired stale platform without revoking paired credentials',async(t)=>{
 t.after(()=>forgetDirect());
 directStore.data.devices=[{...fixtureTV,platform:'android',port:5555,paired:false},{...fixtureSecond,platform:'android',paired:true}];
 const result=await directApi<any>('/api/scan','POST',{});
 const repaired=result.devices.find((d:any)=>d.id===fixtureTV.id);
 assert.equal(repaired.platform,'webos');assert.equal(repaired.port,undefined);assert.equal(repaired.paired,false);
 const protectedDevice=result.devices.find((d:any)=>d.id===fixtureSecond.id);
 assert.equal(protectedDevice.platform,'android');assert.equal(protectedDevice.paired,true);
});
test('native TV socket handles an immediate rejection and propagates disconnect',async()=>{
  const socket=new TvSocket('wss://'+fixtureSecond.host+':8002');await socket.open();
  assert.equal((await socket.wait(m=>m.event==='ms.channel.connect')).data.token,'fixture-samsung-token');
  const waiting=socket.wait(m=>m.type==='never',1000);socket.close();await assert.rejects(waiting,/أُغلق/);
});
test('direct ADB framing accepts fragmented packets and rejects malformed size or magic',()=>{
  const payload=Buffer.from('device::\0'),code=Buffer.from('CNXN').readUInt32LE(),wire=Buffer.alloc(24+payload.length);wire.writeUInt32LE(code,0);wire.writeUInt32LE(0x1000000,4);wire.writeUInt32LE(4096,8);wire.writeUInt32LE(payload.length,12);wire.writeUInt32LE((code^0xffffffff)>>>0,20);payload.copy(wire,24);
  const parse=packetParser();assert.equal(parse(wire.subarray(0,7)).length,0);assert.equal(parse(wire.subarray(7,25)).length,0);assert.deepEqual(parse(wire.subarray(25))[0].payload,new Uint8Array(payload));
  const invalid=Buffer.from(wire);invalid.writeUInt32LE(2*1024*1024,12);assert.throws(()=>packetParser()(invalid),/Invalid ADB/);invalid.writeUInt32LE(0,12);invalid.writeUInt32LE(0,20);assert.throws(()=>packetParser()(invalid),/Invalid ADB/);
});
