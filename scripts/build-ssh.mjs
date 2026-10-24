import {execFileSync} from 'node:child_process';
import {mkdirSync,copyFileSync,readFileSync,existsSync} from 'node:fs';
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
// Keep tracked attribution byte-stable across Windows/macOS checkouts and Go installs.
// A different license requires review, not a silent source change during a build.
const normalizedLicense=path=>readFileSync(path,'utf8').replaceAll('\r\n','\n').trim();
function retainLicense(source,target){
  if(existsSync(target)){
    if(normalizedLicense(source)!==normalizedLicense(target))throw new Error(`License changed; review ${target} against ${source}`);
  }else copyFileSync(source,target);
}
retainLicense(goLicense,'public/licenses/Go.txt');
const modules=execFileSync(go,['env','GOMODCACHE'],{cwd:'sshcore',encoding:'utf8'}).trim();
// The js/wasm build does not import every platform-specific indirect module.
// Fetch the locked modules explicitly before inspecting their license files.
execFileSync(go,['mod','download','golang.org/x/crypto','golang.org/x/sys'],{cwd:'sshcore',stdio:'inherit'});
const license='public/licenses/x-crypto.txt';
retainLicense(resolve(modules,'golang.org/x/crypto@v0.43.0/LICENSE'),license);
retainLicense(resolve(modules,'golang.org/x/sys@v0.37.0/LICENSE'),'public/licenses/x-sys.txt');
