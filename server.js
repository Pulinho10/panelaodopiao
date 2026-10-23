const express=require('express');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const app=express();
const PORT=process.env.PORT||10000;
const ADMIN_KEY=process.env.ADMIN_KEY||'';
const DATA_DIR=path.join(__dirname,'data');
const DATA_FILE=path.join(DATA_DIR,'state.json');
const TOURNAMENT='Panelão Brasileiro de Beyblade X 2026';

app.use(express.json({limit:'5mb'}));
app.use(express.static(__dirname,{extensions:['html']}));

function baseState(){return {version:2,tournament:TOURNAMENT,players:[],judges:[],matches:[],updatedAt:new Date().toISOString()}}
function ensure(){if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR,{recursive:true});if(!fs.existsSync(DATA_FILE))fs.writeFileSync(DATA_FILE,JSON.stringify(baseState(),null,2))}
function read(){ensure();try{return {...baseState(),...JSON.parse(fs.readFileSync(DATA_FILE,'utf8')),tournament:TOURNAMENT}}catch{return baseState()}}
let queue=Promise.resolve();
function mutate(fn){queue=queue.then(async()=>{const s=read();const next=await fn(s);next.tournament=TOURNAMENT;next.updatedAt=new Date().toISOString();fs.writeFileSync(DATA_FILE,JSON.stringify(next,null,2));return next});return queue}
function publicState(s){return {...s,players:(s.players||[]).map(p=>{const x={...p};delete x.pinHash;return x})}}
function ok(res,data){res.json({ok:true,data})}
function fail(res,msg,status=400){res.status(status).json({ok:false,error:msg})}
function admin(req,res){if(!ADMIN_KEY)return true;const v=req.get('X-Admin-Key')||'';if(v.length!==ADMIN_KEY.length)return fail(res,'Chave administrativa inválida.',401),false;try{if(!crypto.timingSafeEqual(Buffer.from(v),Buffer.from(ADMIN_KEY)))return fail(res,'Chave administrativa inválida.',401),false}catch{return fail(res,'Chave administrativa inválida.',401),false}return true}
function idx(a,id){return (a||[]).findIndex(x=>x.id===id)}
function validId(id){return /^[A-Za-z0-9_-]{4,80}$/.test(String(id||''))}
function clean(v,n=300){return String(v??'').trim().slice(0,n)}
function low(v){return clean(v).toLocaleLowerCase('pt-BR')}

app.get('/health',(req,res)=>res.json({ok:true,tournament:TOURNAMENT}));
app.get('/api.php',(req,res)=>{
  const action=req.query.action||'state';
  const s=read();
  if(action==='state')return ok(res,publicState(s));
  if(action==='backup'){if(!admin(req,res))return;return ok(res,s)}
  return fail(res,'Ação GET inválida.',404);
});
app.post('/api.php',async(req,res)=>{
  const action=req.query.action||'';
  const b=req.body||{};
  try{
    if(action==='addPlayer'){
      const p=b.player||{};const id=clean(p.id,80),name=clean(p.name,120),pinHash=clean(p.pinHash,128);
      if(!validId(id)||!name||!/^[a-f0-9]{64}$/.test(pinHash))return fail(res,'Dados do jogador incompletos.');
      const s=await mutate(s=>{if((s.players||[]).some(x=>low(x.name)===low(name)))throw Object.assign(new Error('Já existe um jogador com esse nome.'),{status:409});s.players.push({id,name,team:clean(p.team,120),pinHash,deck:Array.isArray(p.deck)?p.deck.slice(0,3):[],createdAt:p.createdAt||new Date().toISOString()});return s});return ok(res,publicState(s));
    }
    if(action==='addJudge'){
      const j=b.judge||{};const id=clean(j.id,80),name=clean(j.name,120);
      if(!validId(id)||!name)return fail(res,'Dados do juiz incompletos.');
      const s=await mutate(s=>{if((s.judges||[]).some(x=>low(x.name)===low(name)))throw Object.assign(new Error('Já existe um juiz com esse nome.'),{status:409});s.judges.push({id,name,team:clean(j.team,120),createdAt:j.createdAt||new Date().toISOString()});return s});return ok(res,publicState(s));
    }
    if(action==='updatePlayerDeck'){
      const id=clean(b.id,80),deck=b.deck;if(!validId(id)||!Array.isArray(deck))return fail(res,'Dados de combo inválidos.');
      const s=await mutate(s=>{const i=idx(s.players,id);if(i<0)throw Object.assign(new Error('Jogador não encontrado.'),{status:404});s.players[i].deck=deck.slice(0,3);s.players[i].updatedAt=new Date().toISOString();return s});return ok(res,publicState(s));
    }
    if(action==='addMatch'){
      const m=b.match||{},id=clean(m.id,80);if(!validId(id))return fail(res,'ID da partida inválido.');
      const s=await mutate(s=>{if(idx(s.matches,id)>=0)throw Object.assign(new Error('Esta partida já foi registrada.'),{status:409});const pa=clean(m.playerAId,80),pb=clean(m.playerBId,80),j=clean(m.judgeId,80);if(!pa||!pb||pa===pb||idx(s.players,pa)<0||idx(s.players,pb)<0)throw new Error('Jogadores inválidos.');if(idx(s.judges,j)<0)throw new Error('Juiz inválido.');const rs=Array.isArray(m.results)?m.results:[];if(!rs.length)throw new Error('A partida precisa ter ao menos uma batalha.');if(rs.some(r=>r.comboAIndex===undefined||r.comboBIndex===undefined||!r.finish||!r.winner))throw new Error('Todas as pontuações precisam estar vinculadas aos combos.');s.matches.unshift({...m,tournament:TOURNAMENT,validations:{A:null,B:null},createdAt:m.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});return s});return ok(res,publicState(s));
    }
    if(action==='validateMatch'){
      const id=clean(b.id,80),side=b.side,pinHash=clean(b.pinHash,128);if(!['A','B'].includes(side)||!/^[a-f0-9]{64}$/.test(pinHash))return fail(res,'Validação inválida.');
      const s=await mutate(s=>{const mi=idx(s.matches,id);if(mi<0)throw Object.assign(new Error('Partida não encontrada.'),{status:404});const m=s.matches[mi],pid=side==='A'?m.playerAId:m.playerBId,pi=idx(s.players,pid);if(pi<0)throw Object.assign(new Error('Jogador não encontrado.'),{status:404});if(s.players[pi].pinHash!==pinHash)throw Object.assign(new Error('PIN incorreto. A validação não foi registrada.'),{status:403});s.matches[mi].validations[side]={at:new Date().toISOString(),playerId:pid};s.matches[mi].updatedAt=new Date().toISOString();return s});return ok(res,publicState(s));
    }
    if(['deleteMatch','removePerson','replaceAll','clearAll'].includes(action)&&!admin(req,res))return;
    if(action==='deleteMatch'){const id=clean(b.id,80);const s=await mutate(s=>{const i=idx(s.matches,id);if(i<0)throw Object.assign(new Error('Partida não encontrada.'),{status:404});s.matches.splice(i,1);return s});return ok(res,publicState(s))}
    if(action==='removePerson'){const type=b.type,id=clean(b.id,80);if(!['player','judge'].includes(type))return fail(res,'Tipo inválido.');const s=await mutate(s=>{for(const m of s.matches||[]){const used=type==='player'?(m.playerAId===id||m.playerBId===id):m.judgeId===id;if(used)throw Object.assign(new Error('Não é possível excluir: há partidas vinculadas.'),{status:409})}const key=type==='player'?'players':'judges',i=idx(s[key],id);if(i<0)throw Object.assign(new Error('Cadastro não encontrado.'),{status:404});s[key].splice(i,1);return s});return ok(res,publicState(s))}
    if(action==='replaceAll'){const d=b.data;if(!d||!Array.isArray(d.players)||!Array.isArray(d.judges)||!Array.isArray(d.matches))return fail(res,'Backup inválido.');if(d.players.some(p=>!p.pinHash))return fail(res,'O backup não contém os hashes de PIN dos jogadores.');const s=await mutate(()=>({...baseState(),...d,tournament:TOURNAMENT}));return ok(res,publicState(s))}
    if(action==='clearAll'){const s=await mutate(()=>baseState());return ok(res,publicState(s))}
    return fail(res,'Ação inválida.',404);
  }catch(e){return fail(res,e.message||'Erro interno.',e.status||400)}
});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.listen(PORT,()=>console.log('Panelão Beyblade X ouvindo na porta '+PORT));
