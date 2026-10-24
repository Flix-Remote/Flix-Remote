import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyPage,validPageRelease} from '../src/remote-page/updates.ts';
test('shared UI update validates bridge, origin-bound path, byte length and exact digest',async()=>{
 const html='<html>shared fixture</html>',sha256=createHash('sha256').update(html).digest('hex'),release={schema:1,bridge:1,version:'1',sha256,bytes:Buffer.byteLength(html),path:'/home-remote/ui/page-'+sha256+'.html'};
 assert.equal(await verifyPage(release,html),html);assert.equal(validPageRelease({...release,bridge:2}),false);assert.equal(validPageRelease({...release,path:'https://outside.test/a'}),false);await assert.rejects(verifyPage(release,html+'x'));await assert.rejects(verifyPage({...release,sha256:'0'.repeat(64),path:'/home-remote/ui/page-'+('0'.repeat(64))+'.html'},html));
});
