import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,extname,sep} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||5173),host=process.env.HOST||'127.0.0.1';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.md':'text/plain; charset=utf-8'};
export async function handler(req,res){try{const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname),file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return;}if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}const info=await stat(file);if(!info.isFile()){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:await readFile(file));}catch(e){res.writeHead(e.code==='ENOENT'?404:400);res.end(e.code==='ENOENT'?'Not found':'Bad request');}}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const server=createServer(handler);server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is in use. Set PORT to another port.`:e.message);process.exitCode=1;});server.listen(port,host,()=>console.log(`HEAVY / PLAY → http://${host}:${port}\nPress Ctrl+C to stop.`));}
