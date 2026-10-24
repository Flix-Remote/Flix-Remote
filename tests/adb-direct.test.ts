// Exercise the production Tango ADB transport/sync against an in-memory ADB daemon wire fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import {installNativeBoundary} from './native-fixture.ts';
const channels=new Map<string,{queue:string[];closed:boolean;parse:(b:Uint8Array)=>any[]}>();
const services=new Map<number,{local:number;name:string;bytes:Buffer}>();let remoteId=0,failInstall=false;
const pushed:Buffer[]=[],commands:string[]=[];
const code=(s:string)=>Buffer.from(s).readUInt32LE();
function packet(name:string,arg0:number,arg1:number,payload=Buffer.alloc(0)) {
 const b=Buffer.alloc(24+payload.length);b.writeUInt32LE(code(name),0);b.writeUInt32LE(arg0,4);b.writeUInt32LE(arg1,8);b.writeUInt32LE(payload.length,12);b.writeUInt32LE(payload.reduce((a,b)=>a+b,0)>>>0,16);b.writeUInt32LE((code(name)^0xffffffff)>>>0,20);payload.copy(b,24);return b.toString('base64');
}
let parseFactory:()=>((b:Uint8Array)=>any[]);
(globalThis as any).fixtureNative=async(plugin:string,method:string,args:any={})=>{
 if(plugin==='HomeDiscovery')return{};
 assert.equal(plugin,'DirectLan');
 if(method==='open'){assert.equal(args.host,'192.168.1.212');assert.equal(args.kind,'tcp');channels.set(args.id,{queue:[],closed:false,parse:parseFactory()});return{};}
 const c=channels.get(args.id)!;
 if(method==='close'){c.closed=true;return{};}
 if(method==='read'){if(!c.queue.length&&!c.closed)await new Promise(r=>setTimeout(r,2));return{data:c.queue.shift(),closed:c.closed&&!c.queue.length};}
 if(method==='write'){
  for(const m of c.parse(Buffer.from(args.data,'base64'))){
   if(m.command===code('CNXN'))c.queue.push(packet('CNXN',0x1000000,4096,Buffer.from('device::ro.product.name=fixture;features=;\0')));
   if(m.command===code('OPEN')){
    const name=Buffer.from(m.payload).toString().replace(/\0$/,'');const rid=++remoteId;services.set(rid,{local:m.arg0,name,bytes:Buffer.alloc(0)});c.queue.push(packet('OKAY',rid,m.arg0));
    if(name.startsWith('shell:')){commands.push(name);const output=name.includes('pm install')?(failInstall?'Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]\n':'Success\n'):name.includes('echo')?'hello\n':'';if(output)c.queue.push(packet('WRTE',rid,m.arg0,Buffer.from(output)));c.queue.push(packet('CLSE',rid,m.arg0));}
   }
   if(m.command===code('WRTE')){
    c.queue.push(packet('OKAY',m.arg1,m.arg0));const s=services.get(m.arg1)!;if(s?.name!=='sync:')continue;s.bytes=Buffer.concat([s.bytes,Buffer.from(m.payload)]);
    while(s.bytes.length>=8){const tag=s.bytes.toString('ascii',0,4),n=s.bytes.readUInt32LE(4),length=tag==='DONE'?0:n;if(s.bytes.length<8+length)break;const data=s.bytes.subarray(8,8+length);s.bytes=s.bytes.subarray(8+length);
     if(tag==='DATA')pushed.push(data);if(tag==='DONE'){const ok=Buffer.alloc(8);ok.write('OKAY');c.queue.push(packet('WRTE',m.arg1,m.arg0,ok));}
    }
   }
   if(m.command===code('CLSE'))c.queue.push(packet('CLSE',m.arg1,m.arg0));
  }
  return{};
 }
 throw Error('Unexpected native method');
};
installNativeBoundary();
const {android,packetParser,executeAndroid,installApk,closeAndroid}=await import('../src/direct/adb.ts');parseFactory=packetParser;
test('phone directly authenticates ADB, sends shell commands, streams APK and propagates installer failure',{timeout:15000},async(t)=>{
 t.after(closeAndroid);
 await android('192.168.1.212',5555);assert.equal(await executeAndroid('adb',['-s','192.168.1.212:5555','shell','echo','hello']),'hello\n');
 const bytes=Buffer.alloc(150000,13);bytes.write('PK');const id='33333333-3333-4333-8333-333333333333';
 await installApk('192.168.1.212',5555,bytes,id);assert.deepEqual(Buffer.concat(pushed),bytes);assert.ok(commands.some(c=>c==='shell:pm install -r /data/local/tmp/flix-'+id+'.apk'));assert.ok(commands.some(c=>c.startsWith('shell:rm -f ')));
 failInstall=true;await assert.rejects(installApk('192.168.1.212',5555,Buffer.from('PKtest'),id),/INSUFFICIENT_STORAGE/);
 await assert.rejects(executeAndroid('adb',['pair','192.168.1.212:12345','123']),/6/);
 const nativeCalls:any[]=[];const transport=(globalThis as any).fixtureNative;let rejected=false;
 (globalThis as any).fixtureNative=async(plugin:string,method:string,args:any)=>{if(plugin==='HomeDiscovery')return{};if(plugin==='Filesystem'&&method==='getUri')return{uri:'file:///private/packages/'+id};assert.equal(plugin,'DirectAdb');nativeCalls.push({method,args});if(rejected)throw Error('TV refused pairing');if(method==='shell')return{output:'FLIX_CONNECTED\n'};if(method==='install')return{output:'Success'};return{};};
 try{await executeAndroid('adb',['pair','192.168.1.212:12345','123456']);assert.equal(nativeCalls[0].args.port,12345);assert.equal(nativeCalls[0].args.code,'123456');
 const {getSecrets}=await import('../src/direct/adb.ts');assert.ok(getSecrets().adb);assert.equal(JSON.stringify(getSecrets()).includes('123456'),false);
 assert.equal(await executeAndroid('adb',['connect','192.168.1.212:37455']),'connected');assert.equal(nativeCalls.at(-1).args.port,37455);
 await installApk('192.168.1.212',37455,bytes,id);assert.match(nativeCalls.at(-1).args.sha256,/^[a-f0-9]{64}$/);assert.equal(nativeCalls.at(-1).method,'install');rejected=true;await assert.rejects(executeAndroid('adb',['pair','192.168.1.212:12345','654321']),/refused/);
 }finally{(globalThis as any).fixtureNative=transport;}
});
