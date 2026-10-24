import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Public JavaScript SDK is intentionally runtime-independent.
import {createDeviceLink} from '../sdk/flix-device-link.mjs';
test('own-app SDK requires consent and login, reports bounded fields, and exposes no command runner',async()=>{
 let consent=false,token='',calls:any[]=[];
 const link=createDeviceLink({serviceUrl:'https://fixture.example',appId:'com.test.app',platform:'webos',version:'1',installationId:crypto.randomUUID(),getSession:()=>token,hasConsent:()=>consent,fetch:async(url:string,args:any)=>{calls.push({url,args});return Response.json(url.endsWith('/catalog')?{releases:[{appId:'com.test.app',platform:'webos',version:'2'}]}:{ok:true});}});
 await assert.rejects(link.report({}),/disabled/);consent=true;await assert.rejects(link.report({}),/login/);assert.equal(calls.length,0);
 token='fixture';await link.report({code:'X',message:'a'.repeat(800)});const body=JSON.parse(calls[0].args.body);assert.equal(body.message.length,500);assert.equal(body.appId,'com.test.app');assert.equal(calls[0].args.headers.Authorization,'Bearer fixture');await assert.rejects(link.report({}),/15 seconds/);assert.equal((await link.latest()).version,'2');assert.deepEqual(Object.keys(link),['latest','report']);
});
