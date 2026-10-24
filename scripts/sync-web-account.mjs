import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),page=path.join(root,'flix-s/tools/tv-remote.html'),script=path.join(root,'flix-s/tools/remote-account.js');
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
if(fs.existsSync(page)&&fs.existsSync(script)){
 let html=read(page).replace(/<!-- FLIX_WEB_ACCOUNT_BEGIN -->[\s\S]*?<!-- FLIX_WEB_ACCOUNT_END -->\s*/g,'').replace(/<!-- FLIX_SHARED_LIBRARY_BEGIN -->[\s\S]*?<!-- FLIX_SHARED_LIBRARY_END -->\s*/g,'');
 html=html.replace(/<!-- FLIX_SHARED_HOUSEHOLD_BEGIN -->[\s\S]*?<!-- FLIX_SHARED_HOUSEHOLD_END -->\s*/g,'');
 html=html.replace(/<meta name="flix-remote-revision" content="[a-f0-9]+">\s*/g,'');
 html=html.replace('<script>','<!-- FLIX_WEB_ACCOUNT_BEGIN -->\n<script>'+read(script).replace(/<\/script/gi,'<\\/script')+'</script>\n<!-- FLIX_WEB_ACCOUNT_END -->\n<script>');
 const library=path.join(root,'flix-s/tools/remote-library.js');
 if(fs.existsSync(library))html=html.replace('</body>','<!-- FLIX_SHARED_LIBRARY_BEGIN -->\n<script>'+read(library).replace(/<\/script/gi,'<\\/script')+'</script>\n<!-- FLIX_SHARED_LIBRARY_END -->\n</body>');
 const household=path.join(root,'flix-s/tools/remote-household.js');
 if(fs.existsSync(household))html=html.replace('</body>','<!-- FLIX_SHARED_HOUSEHOLD_BEGIN -->\n<script>'+read(household).replace(/<\/script/gi,'<\\/script')+'</script>\n<!-- FLIX_SHARED_HOUSEHOLD_END -->\n</body>');
 const revision=createHash('sha256').update(html).digest('hex');
 html=html.replace('<head>','<head>\n<meta name="flix-remote-revision" content="'+revision+'">');fs.writeFileSync(page,html);
}
