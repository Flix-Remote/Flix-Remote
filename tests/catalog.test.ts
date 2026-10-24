import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyPackage,catalogState,type CatalogRelease} from '../src/catalog.ts';
test('catalog refuses corrupted, truncated, oversized packages and identifies a cached exact release',async()=>{
 const bytes=new TextEncoder().encode('!<arch>\nfixture');const hash=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
 const release:CatalogRelease={id:'fixture',appId:'com.test.app',name:'Test',platform:'webos',version:'1',filename:'test.ipk',url:'https://example.test/test.ipk',sha256:hash,bytes:bytes.length,notes:'',updatedAt:0};const data=Buffer.from(bytes).toString('base64');
 assert.equal(await verifyPackage(release,data),data);await assert.rejects(verifyPackage({...release,bytes:bytes.length+1},data),/حجم/);await assert.rejects(verifyPackage({...release,sha256:'0'.repeat(64)},data),/بصمة/);await assert.rejects(verifyPackage({...release,bytes:67108865},data),/أكبر/);
 const saved={...release,addedAt:0};assert.equal(catalogState(release,[saved]).package,saved);assert.equal(catalogState({...release,sha256:'1'.repeat(64)},[saved]).package,undefined);
});
