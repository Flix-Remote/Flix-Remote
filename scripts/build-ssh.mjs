import {execFileSync} from 'node:child_process';
import {mkdirSync,copyFileSync,readFileSync,writeFileSync,existsSync,chmodSync} from 'node:fs';
import {resolve} from 'node:path';
const go=process.env.FLIX_GO || (process.platform==='win32'?resolve('.toolchain/go/bin/go.exe'):'go');
mkdirSync('public/ssh',{recursive:true});
execFileSync(go,['build','-trimpath','-ldflags=-s -w','-o',resolve('public/ssh/sshcore.wasm'),'.'],{cwd:'sshcore',env:{...process.env,GOOS:'js',GOARCH:'wasm'},stdio:'inherit'});
const root=execFileSync(go,['env','GOROOT'],{encoding:'utf8'}).trim();
copyFileSync(resolve(root,'lib/wasm/wasm_exec.js'),'public/ssh/wasm_exec.js');

mkdirSync('public/licenses',{recursive:true});
// Homebrew may relocate license files out of libexec (GOROOT).
// Require the installed toolchain's license; never silently omit attribution.
const goLicense=[resolve(root,'LICENSE'),resolve(root,'../LICENSE'),resolve(root,'../share/doc/go/LICENSE')].find(existsSync);
if(!goLicense)throw new Error(`Go toolchain license not found beside ${root}`);
copyFileSync(goLicense,'public/licenses/Go.txt');
const modules=execFileSync(go,['env','GOMODCACHE'],{cwd:'sshcore',encoding:'utf8'}).trim();
const license='public/licenses/x-crypto.txt';
if(existsSync(license))chmodSync(license,0o666);
writeFileSync(license,readFileSync(resolve(modules,'golang.org/x/crypto@v0.43.0/LICENSE')));
