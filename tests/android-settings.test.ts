import test from 'node:test';
import assert from 'node:assert/strict';
import {Adapters} from '../src/direct/adapters.ts';
test('Android settings follow resolvable TV activities and reject unavailable OEM menus',async()=>{
 const calls:string[][]=[];const adapter=new Adapters({data:{devices:[],keys:{},packages:[],receipts:[]},save:async()=>{}},async(_tool,args)=>{calls.push(args);return args.includes('sh')?'FLIX_SETTING_network\ncom.android.tv.settings/.Wifi\nFLIX_SETTING_developer\nNo activity found\nFLIX_SETTING_sound\ncom.android.tv.settings/.Sound\n':'Starting: Intent';});
 const tv:any={host:'192.168.1.213',port:37455,platform:'android',paired:true};
 assert.deepEqual((await adapter.settings(tv)).map(s=>s.id),['open','network','sound']);await assert.rejects(adapter.setSetting(tv,'developer'),/لا يتيح/);await adapter.setSetting(tv,'network');assert.equal(calls.at(-1)?.at(-1),'android.settings.WIFI_SETTINGS');assert.equal(calls.at(-1)?.[1],'192.168.1.213:37455');
});
