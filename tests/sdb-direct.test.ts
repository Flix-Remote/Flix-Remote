import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {installNativeBoundary} from './native-fixture.ts';
const channels=new Map<string,{buffer:Buffer;queue:string[];service:string;local:number;remote:number;sync:Buffer}>();
const code=(s:string)=>Buffer.from(s).readUInt32LE();
function frame(name:string,a:number,b:number,payload=Buffer.alloc(0)){const out=Buffer.alloc(24+payload.length);[code(name),a,b,payload.length,payload.reduce((a,b)=>a+b,0),(code(name)^0xffffffff)>>>0].forEach((n,i)=>out.writeUInt32LE(n,i*4));payload.copy(out,24);return out;}
let rejectUpload=false,rejectInstall=false,requireAuth=false;const pushed:Buffer[]=[],services:string[]=[];
(globalThis as any).fixtureNative=async(plugin:string,method:string,args:any={})=>{
 assert.equal(plugin,'DirectLan');
 if(method==='open'){assert.equal(args.host,'192.168.1.211');assert.equal(args.port,26101);channels.set(args.id,{buffer:Buffer.alloc(0),queue:[],service:'',local:0,remote:7,sync:Buffer.alloc(0)});return{};}
 const c=channels.get(args.id)!;
 if(method==='close'){channels.delete(args.id);return{};}
 if(method==='read'){assert.ok(c.queue.length,'unexpected SDB read');return{data:c.queue.shift(),closed:false};}
 const enqueue=(b:Buffer)=>{c.queue.push(b.subarray(0,13).toString('base64'),b.subarray(13).toString('base64'));};
 for(c.buffer=Buffer.concat([c.buffer,Buffer.from(args.data,'base64')]);c.buffer.length>=24;){const n=c.buffer.readUInt32LE(12);if(c.buffer.length<n+24)break;const h=c.buffer.subarray(0,24),data=c.buffer.subarray(24,24+n);c.buffer=c.buffer.subarray(24+n);assert.equal(h.readUInt32LE(16),data.reduce((a,b)=>a+b,0));const command=h.readUInt32LE();
  if(command===code('CNXN'))enqueue(frame(requireAuth?'AUTH':'CNXN',0x1000000,1024,Buffer.from('device::')));
  if(command===code('OPEN')){c.service=data.toString().replace(/\0$/,'');services.push(c.service);c.local=h.readUInt32LE(4);enqueue(frame('OKAY',c.remote,c.local));if(c.service!=='sync:'){const out=c.service==='capability:'?'platform_name:tizen\nsecure_protocol:enabled\n':c.service.includes('vd_appinstall')?(rejectInstall?'install failed[118] certificate rejected':'install completed\nappcmd_exitcode:0'):'';if(out)enqueue(frame('WRTE',c.remote,c.local,Buffer.from(out)));enqueue(frame('CLSE',c.remote,c.local));}}
  if(command===code('WRTE')){assert.ok(data.length<=1024);enqueue(frame('OKAY',c.remote,c.local));c.sync=Buffer.concat([c.sync,data]);while(c.sync.length>=8){const tag=c.sync.toString('ascii',0,4),value=c.sync.readUInt32LE(4),length=['DONE','QUIT'].includes(tag)?0:value;if(c.sync.length<8+length)break;const data=c.sync.subarray(8,8+length);c.sync=c.sync.subarray(8+length);if(tag==='SEND')assert.match(data.toString(),/^\/home\/owner\/share\/tmp\/sdk_tools\/flix-[a-f0-9-]+\.wgt,33188$/);if(tag==='DATA')pushed.push(data);if(tag==='DONE'){const response=Buffer.alloc(8);response.write(rejectUpload?'FAIL':'OKAY');enqueue(frame('WRTE',c.remote,c.local,response));}}}
 }
 return{};
};installNativeBoundary();
const {installTizen,probeSdb,confirmTizenInstall}=await import('../src/direct/sdb.ts');
const {validateWgt}=await import('../src/direct/package-format.ts');
const device:any={host:'192.168.1.211',platform:'tizen'},pkg:any={id:'33333333-3333-4333-8333-333333333333',appId:'TestPkg001.FLIX'};
test('phone SDB negotiates, transfers WGT in bounded frames and requires TV success',async()=>{
 assert.match(await probeSdb(device),/tizen/);const bytes=Buffer.alloc(150000,37);bytes.write('PK');assert.match(await installTizen(device,pkg,bytes),/confirmed/);assert.deepEqual(Buffer.concat(pushed),bytes);assert.ok(services.some(s=>s.startsWith('shell:0 vd_appinstall TestPkg001 ')));assert.match(services.at(-1)!,/^shell:0 rmfile /);
 rejectInstall=true;await assert.rejects(installTizen(device,pkg,bytes),/certificate rejected/);rejectInstall=false;
 rejectUpload=true;await assert.rejects(installTizen(device,pkg,bytes),/نقل/);assert.match(services.at(-1)!,/^shell:0 rmfile /);rejectUpload=false;
 requireAuth=true;await assert.rejects(probeSdb(device),/تفويض/);requireAuth=false;assert.equal(channels.size,0);
 for(const out of ['','file transferred','appcmd_exitcode:1','install failed[118]\nappcmd_exitcode:0'])assert.throws(()=>confirmTizenInstall(out));
});
test('WGT manifest must match app ID and contain bounded certificate files',()=>{
 const config=strToU8('<widget xmlns:tizen="http://tizen.org/ns/widgets"><tizen:application id="TestPkg001.FLIX" package="TestPkg001"/></widget>');const files={'config.xml':config,'author-signature.xml':strToU8('fixture'),'signature1.xml':strToU8('fixture')};
 assert.equal(validateWgt(zipSync(files),pkg.appId).packageId,'TestPkg001');assert.throws(()=>validateWgt(zipSync(files),'wrong.app'),/معرف/);assert.throws(()=>validateWgt(zipSync({'config.xml':config}),pkg.appId),/توقيع/);assert.throws(()=>validateWgt(zipSync({...files,'config.xml':new Uint8Array(70000)}),pkg.appId));
});
