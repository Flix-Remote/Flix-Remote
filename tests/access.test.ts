import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AccessGate} from '../src/access.ts';
test('access lease fails closed, honors an explicit block, and expires offline',async()=>{
 let time=1000,enabled=true,offline=false,calls=0;
 const gate=new AccessGate(async()=>{calls++;if(offline)throw Error('offline');return{enabled,reason:'blocked',checkedAt:0};},()=>time);
 offline=true;await assert.rejects(gate.assertAllowed(),/offline/);offline=false;await gate.assertAllowed();assert.equal(calls,2);
 time+=30001;offline=true;await gate.assertAllowed();time+=270000;await assert.rejects(gate.assertAllowed(),/offline/);
 offline=false;enabled=false;await gate.refresh();await assert.rejects(gate.assertAllowed(),/blocked/);offline=true;time+=30001;await assert.rejects(gate.assertAllowed(),/offline/);
 gate.reset();assert.equal(gate.current(),undefined);await assert.rejects(gate.assertAllowed());
});
test('concurrent permission checks share one request and an old account cannot restore permission',async()=>{
 let finish!:(v:any)=>void,calls=0;const gate=new AccessGate(()=>{calls++;return new Promise(r=>finish=r);});
 const a=gate.assertAllowed(),b=gate.assertAllowed();assert.equal(calls,1);gate.reset();finish({enabled:true,reason:'',checkedAt:0});
 await assert.rejects(a,/تغير/);await assert.rejects(b,/تغير/);assert.equal(gate.current(),undefined);
});

test('household policy has no offline extension after the 30-second access lease',async()=>{
 let time=1000,offline=false;
 const gate=new AccessGate(async()=>{if(offline)throw Error('offline');return{enabled:true,reason:'',checkedAt:time,offlineGraceMs:0};},()=>time);
 await gate.assertAllowed();offline=true;time+=29999;await gate.assertAllowed();
 time++;await assert.rejects(gate.assertAllowed(),/offline/);
});
