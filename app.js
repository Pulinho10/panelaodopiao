const APP_KEY='panelaoBeybladeX2026_v1';
const TOURNAMENT='Panelão Brasileiro de Beyblade X 2026';
const emptyData=()=>({version:1,tournament:TOURNAMENT,players:[],judges:[],matches:[],updatedAt:new Date().toISOString()});
let db=load();
let currentBattleResults=[];
const FINISH_POINTS={spin:1,over:2,burst:2,extreme:3};
const FINISH_LABELS={spin:'Spin Finish',over:'Over Finish',burst:'Burst Finish',extreme:'Extreme Finish'};

const catalog={
  lock:['Dran','Wizard','Perseus','Valkyrie'],
  blade:['Dran Sword','Dran Dagger','Dran Buster','Wizard Arrow','Wizard Rod','Hells Scythe','Hells Chain','Hells Hammer','Phoenix Wing','Cobalt Dragoon','Aero Pegasus','Silver Wolf','Whale Wave','Samurai Saber','Impact Drake','Tyranno Beat','Shark Edge','Unicorn Sting','Leon Crest','Knight Mail','Scythe Incendio','Soar Phoenix'],
  over:['Main Blade','Free Blade'],metal:['Metal Wheel'],assist:['Slash','Round','Bumper','Turn','Wheel','Charge'],
  ratchet:['Sem Ratchet','1-60','1-70','2-60','2-70','3-60','3-70','3-80','4-60','4-70','4-80','5-60','5-70','5-80','7-60','7-70','9-60','9-70','9-80'],
  bit:['Accel','Ball','Bound Spike','Cyclone','Disc Ball','Dot','Elevate','Flat','Gear Ball','Gear Flat','Gear Needle','Glide','Hexa','High Needle','High Taper','Kick','Level','Low Flat','Low Rush','Needle','Orb','Point','Quake','Rush','Spike','Taper','Trans Point','Unite']
};
function $(s){return document.querySelector(s)}
function $$(s){return [...document.querySelectorAll(s)]}
function uid(prefix='id'){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`}
function load(){try{const raw=localStorage.getItem(APP_KEY);return raw?{...emptyData(),...JSON.parse(raw)}:emptyData()}catch{return emptyData()}}
function save(){db.updatedAt=new Date().toISOString();localStorage.setItem(APP_KEY,JSON.stringify(db));renderAll()}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmtDate(v){return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v))}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
async function hashPin(pin){const bytes=new TextEncoder().encode(`PAN2026|${pin}`);const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')}

function init(){
  populateCatalog(); buildDeck('#deckA','A'); buildDeck('#deckB','B'); bindNav(); bindForms(); refreshBattleComboSelectors(); renderBattleResults(); renderAll();
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
}
function populateCatalog(){Object.entries(catalog).forEach(([k,arr])=>{const el=$(`#${k}List`);if(el)el.innerHTML=arr.map(x=>`<option value="${esc(x)}"></option>`).join('')})}
function buildDeck(target,side){const host=$(target);for(let i=1;i<=3;i++){const node=$('#comboTemplate').content.cloneNode(true);node.querySelector('.combo-num').textContent=i;node.querySelector('.combo-box').dataset.combo=i;node.querySelector('.clear-combo').addEventListener('click',e=>{e.target.closest('.combo-box').querySelectorAll('input').forEach(x=>x.value='')});host.appendChild(node)}}
function fillDeck(selector,deck=[]){const boxes=$$(selector+' .combo-box');boxes.forEach((box,i)=>{const c=deck[i]||{};['lock','blade','over','metal','assist','ratchet','bit'].forEach(k=>{const input=box.querySelector('.'+k);if(input)input.value=c[k]||''})});refreshBattleComboSelectors()}
function getPlayerDeck(id){const p=getPlayer(id);return Array.isArray(p?.deck)?p.deck:[]}
function syncMatchDeckFromPlayer(side){const playerId=$('#player'+side).value;fillDeck(side==='A'?'#deckA':'#deckB',getPlayerDeck(playerId));clearSelectedBattleCombo(side);if(currentBattleResults.length){currentBattleResults=[];renderBattleResults();toast('A troca de jogador limpou as batalhas já lançadas para evitar inconsistências.')}}
function bindNav(){
  $$('.tab').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
  $$('[data-goto]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.goto)));
}
function showTab(id){$$('.panel').forEach(x=>x.classList.toggle('active',x.id===id));$$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));window.scrollTo({top:0,behavior:'smooth'})}
function bindForms(){
  $('#playerForm').addEventListener('submit',async e=>{e.preventDefault();const name=$('#playerName').value.trim();const pin=$('#playerPin').value.trim();if(db.players.some(p=>p.name.toLowerCase()===name.toLowerCase())) return toast('Já existe um jogador com esse nome.');db.players.push({id:uid('p'),name,team:$('#playerTeam').value.trim(),pinHash:await hashPin(pin),deck:[],createdAt:new Date().toISOString()});e.target.reset();save();toast('Jogador cadastrado.')});
  $('#judgeForm').addEventListener('submit',e=>{e.preventDefault();const name=$('#judgeName').value.trim();if(db.judges.some(j=>j.name.toLowerCase()===name.toLowerCase())) return toast('Já existe um juiz com esse nome.');db.judges.push({id:uid('j'),name,team:$('#judgeTeam').value.trim(),createdAt:new Date().toISOString()});e.target.reset();save();toast('Juiz cadastrado.')});
  $('#matchForm').addEventListener('submit',handleMatchSubmit);
  $$('.finish-btn').forEach(btn=>btn.addEventListener('click',()=>addBattleResult(btn.dataset.finish,btn)));
  ['#deckA','#deckB'].forEach(sel=>$(sel).addEventListener('input',refreshBattleComboSelectors));
  ['#deckA','#deckB'].forEach(sel=>$(sel).addEventListener('change',refreshBattleComboSelectors));
  $('#playerA').addEventListener('change',()=>syncMatchDeckFromPlayer('A'));
  $('#playerB').addEventListener('change',()=>syncMatchDeckFromPlayer('B'));
  $('#battleComboAButton').addEventListener('click',()=>openComboSelection('A'));
  $('#battleComboBButton').addEventListener('click',()=>openComboSelection('B'));
  $('#playerCombosForm').addEventListener('submit',savePlayerCombosFromDialog);
  $('#matchForm').addEventListener('reset',()=>setTimeout(()=>{currentBattleResults=[];$('#battleComboA').value='';$('#battleComboB').value='';fillDeck('#deckA',[]);fillDeck('#deckB',[]);refreshBattleComboSelectors();renderBattleResults();},0));
  $('#historySearch').addEventListener('input',renderHistory);$('#statusFilter').addEventListener('change',renderHistory);
  $('#validationForm').addEventListener('submit',handleValidation);
  $('#exportJson').addEventListener('click',exportJson);$('#importJson').addEventListener('change',importJson);$('#exportCsv').addEventListener('click',exportCsv);
  $('#clearAll').addEventListener('click',()=>{if(confirm('Apagar TODOS os jogadores, juízes e partidas deste aparelho?')){db=emptyData();localStorage.removeItem(APP_KEY);renderAll();toast('Dados apagados.')}});
}
function collectDeck(selector){return $$(selector+' .combo-box').map(box=>{const get=c=>box.querySelector('.'+c).value.trim();return {lock:get('lock'),blade:get('blade'),over:get('over'),metal:get('metal'),assist:get('assist'),ratchet:get('ratchet'),bit:get('bit')}}).filter(c=>Object.values(c).some(Boolean))}
function comboText(c){const main=[c.lock,c.blade,c.over,c.metal,c.assist].filter(Boolean).join(' / ');return [main,c.ratchet,c.bit].filter(Boolean).join(' • ')||'—'}
function indexedDeck(selector){return $$(selector+' .combo-box').map((box,index)=>{const get=c=>box.querySelector('.'+c).value.trim();const combo={lock:get('lock'),blade:get('blade'),over:get('over'),metal:get('metal'),assist:get('assist'),ratchet:get('ratchet'),bit:get('bit')};return {index,indexLabel:index+1,combo}}).filter(x=>Object.values(x.combo).some(Boolean))}
function refreshBattleComboSelectors(){
  ['A','B'].forEach(side=>{
    const hidden=$(`#battleCombo${side}`),btn=$(`#battleCombo${side}Button`);
    if(!hidden||!btn)return;
    const items=indexedDeck(side==='A'?'#deckA':'#deckB');
    const selected=items.find(x=>String(x.index)===hidden.value);
    if(selected){btn.textContent=`Combo ${selected.indexLabel} — ${comboText(selected.combo)}`;btn.classList.add('selected')}
    else{hidden.value='';btn.textContent=items.length?`Selecionar combo do Jogador ${side}`:`Sem combos pré-registrados`;btn.classList.remove('selected')}
    btn.disabled=!items.length;
  });
  updateFinishButtonsState();
}
function clearSelectedBattleCombo(side){const h=$(`#battleCombo${side}`);if(h)h.value='';refreshBattleComboSelectors()}
function updateFinishButtonsState(){const ready=!!($('#battleComboA')?.value&&$('#battleComboB')?.value);$$('.finish-btn').forEach(btn=>{btn.classList.toggle('needs-combos',!ready);btn.setAttribute('aria-disabled',ready?'false':'true')})}
function getSelectedBattleCombo(side){const hidden=$(`#battleCombo${side}`);const deckSel=side==='A'?'#deckA':'#deckB';if(!hidden||hidden.value==='')return null;const item=indexedDeck(deckSel).find(x=>String(x.index)===hidden.value);return item?{index:item.index,label:`Combo ${item.indexLabel}`,text:comboText(item.combo),combo:{...item.combo}}:null}
function openComboSelection(side){
  const playerId=$('#player'+side).value;
  if(!playerId)return toast(`Selecione primeiro o Jogador ${side}.`);
  const player=getPlayer(playerId),items=indexedDeck(side==='A'?'#deckA':'#deckB');
  $('#comboSelectionTitle').textContent=`Combo de ${player?.name||'Jogador '+side}`;
  $('#comboSelectionHelp').textContent='Selecione o combo utilizado nesta batalha. A lista usa o cadastro prévio do jogador.';
  $('#comboSelectionOptions').innerHTML=items.length?items.map(x=>`<button type="button" class="combo-option-btn" onclick="chooseBattleCombo('${side}',${x.index})"><strong>Combo ${x.indexLabel}</strong><span>${esc(comboText(x.combo))}</span></button>`).join(''):'<div class="combo-option-empty">Este jogador não possui combos pré-registrados. Cadastre-os em “Jogadores e juízes”.</div>';
  $('#comboSelectionDialog').showModal();
}
window.chooseBattleCombo=function(side,index){$(`#battleCombo${side}`).value=String(index);$('#comboSelectionDialog').close();refreshBattleComboSelectors();}
function openPlayerCombos(id){
  const p=getPlayer(id);if(!p)return;
  $('#playerCombosPlayerId').value=id;$('#playerCombosTitle').textContent=`Combos de ${p.name}`;
  const host=$('#playerCombosEditor');host.innerHTML='';buildDeck('#playerCombosEditor','P');fillDeck('#playerCombosEditor',getPlayerDeck(id));
  $('#playerCombosDialog').showModal();
}
window.openPlayerCombos=openPlayerCombos;
function savePlayerCombosFromDialog(e){e.preventDefault();const id=$('#playerCombosPlayerId').value,p=getPlayer(id);if(!p)return;p.deck=collectDeck('#playerCombosEditor');p.updatedAt=new Date().toISOString();$('#playerCombosDialog').close();save();if($('#playerA').value===id)syncMatchDeckFromPlayer('A');if($('#playerB').value===id)syncMatchDeckFromPlayer('B');toast('Combos do jogador atualizados.');}
function addBattleResult(finish,button=null){
  const winner=$('#battleWinner').value;
  const comboA=getSelectedBattleCombo('A'),comboB=getSelectedBattleCombo('B');
  if(!comboA||!comboB){updateFinishButtonsState();return toast('Selecione quais combos dos dois jogadores batalharam antes de registrar a pontuação.');}
  if(!finish||!FINISH_POINTS[finish]) return toast('Selecione um tipo de pontuação válido.');
  currentBattleResults.push({id:uid('r'),sequence:currentBattleResults.length+1,winner,finish,points:FINISH_POINTS[finish],comboAIndex:comboA.index,comboBIndex:comboB.index,comboAText:comboA.text,comboBText:comboB.text,comboA:comboA.combo,comboB:comboB.combo});
  renderBattleResults();
  if(button){button.classList.remove('scored');void button.offsetWidth;button.classList.add('scored');setTimeout(()=>button.classList.remove('scored'),260)}
}
function removeBattleResult(id){currentBattleResults=currentBattleResults.filter(r=>r.id!==id).map((r,i)=>({...r,sequence:i+1}));renderBattleResults()}
window.removeBattleResult=removeBattleResult;
function scoreFromResults(results=currentBattleResults){return results.reduce((acc,r)=>{acc[r.winner]+=Number(r.points)||FINISH_POINTS[r.finish]||0;return acc},{A:0,B:0})}
function resultText(r,m=null){const player=m?getPlayer(r.winner==='A'?m.playerAId:m.playerBId)?.name:null;const matchup=(r.comboAText&&r.comboBText)?` | ${r.comboAText} × ${r.comboBText}`:'';return `${r.sequence}ª batalha — ${player||`Jogador ${r.winner}`}: ${FINISH_LABELS[r.finish]||r.finish} (+${r.points||FINISH_POINTS[r.finish]||0})${matchup}`}
function renderBattleResults(){
  const score=scoreFromResults(); $('#scoreA').value=score.A; $('#scoreB').value=score.B;
  const host=$('#battleResults'); if(!host)return;
  host.className='battle-results'+(currentBattleResults.length?'':' list-empty');
  host.innerHTML=currentBattleResults.length?currentBattleResults.map(r=>`<div class="battle-result-row"><div><strong>${r.sequence}ª batalha — ${esc(r.comboAText||'Combo A não informado')} × ${esc(r.comboBText||'Combo B não informado')}</strong><span>Jogador ${r.winner} • ${esc(FINISH_LABELS[r.finish])} • +${r.points} ponto${r.points>1?'s':''}</span></div><button type="button" class="ghost" onclick="removeBattleResult('${r.id}')">Remover</button></div>`).join(''):'Nenhuma batalha registrada.';
}
function matchResults(m){return Array.isArray(m.results)?m.results:[]}
function resultsSummaryHtml(m){const rs=matchResults(m);if(!rs.length)return '<div class="muted legacy-result">Detalhamento por batalha não disponível para este registro anterior.</div>';return `<div class="round-breakdown"><strong>Pontuação por batalha</strong>${rs.map(r=>`<div>${esc(resultText(r,m))}</div>`).join('')}</div>`}
function getPlayer(id){return db.players.find(p=>p.id===id)} function getJudge(id){return db.judges.find(j=>j.id===id)}
function handleMatchSubmit(e){
  e.preventDefault();const playerA=$('#playerA').value,playerB=$('#playerB').value,judge=$('#judge').value;
  if(!playerA||!playerB||!judge) return toast('Cadastre e selecione jogadores e juiz.');
  if(playerA===playerB) return toast('Os jogadores A e B precisam ser diferentes.');
  if(!currentBattleResults.length)return toast('Registre ao menos uma batalha, informando os combos e o tipo de pontuação.');
  if(currentBattleResults.some(r=>r.comboAIndex===undefined||r.comboBIndex===undefined))return toast('Todas as pontuações desta nova partida devem estar vinculadas aos combos que batalharam.');
  const score=scoreFromResults(),scoreA=score.A,scoreB=score.B;if(scoreA===scoreB)return toast('O placar não pode terminar empatado. Registre a batalha de desempate.');
  const deckA=collectDeck('#deckA'),deckB=collectDeck('#deckB');if(!deckA.length||!deckB.length)return toast('Os dois jogadores precisam ter ao menos um combo pré-registrado.');
  const results=currentBattleResults.map(r=>({...r}));
  const match={id:uid('m'),tournament:TOURNAMENT,stage:$('#stage').value,round:$('#round').value.trim(),tableNo:$('#tableNo').value.trim(),judgeId:judge,playerAId:playerA,playerBId:playerB,scoreA,scoreB,results,deckA,deckB,notes:$('#notes').value.trim(),validations:{A:null,B:null},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  db.matches.unshift(match);currentBattleResults=[];save();e.target.reset();$$('#deckA input,#deckB input').forEach(x=>x.value='');refreshBattleComboSelectors();renderBattleResults();showTab('history');toast('Partida salva com o detalhamento das pontuações. Agora os dois jogadores devem validar.');
}
function renderAll(){renderSelects();renderPeople();renderDashboard();renderHistory();renderRanking()}
function renderSelects(){
  const pOpts='<option value="">Selecione...</option>'+db.players.map(p=>`<option value="${p.id}">${esc(p.name)}${p.team?` — ${esc(p.team)}`:''}</option>`).join('');
  const jOpts='<option value="">Selecione...</option>'+db.judges.map(j=>`<option value="${j.id}">${esc(j.name)}</option>`).join('');
  ['#playerA','#playerB'].forEach(s=>{const old=$(s).value;$(s).innerHTML=pOpts;if([...$(s).options].some(o=>o.value===old))$(s).value=old});
  const oldJ=$('#judge').value;$('#judge').innerHTML=jOpts;if([...$('#judge').options].some(o=>o.value===oldJ))$('#judge').value=oldJ;
}
function renderPeople(){
  $('#playerCount').textContent=db.players.length;$('#judgeCount').textContent=db.judges.length;
  $('#playerList').innerHTML=db.players.length?db.players.map(p=>`<div class="list-row"><div><strong>${esc(p.name)}</strong>${getPlayerDeck(p.id).length?`<span class="player-combos-badge">${getPlayerDeck(p.id).length} combo(s)</span>`:''}<div class="muted">${esc(p.team||'Sem equipe/cidade')}</div></div><div><button class="secondary" onclick="openPlayerCombos('${p.id}')">Gerenciar combos</button> <button class="ghost" onclick="removePerson('player','${p.id}')">Excluir</button></div></div>`).join(''):'<div class="list-empty">Nenhum jogador cadastrado.</div>';
  $('#judgeList').innerHTML=db.judges.length?db.judges.map(j=>`<div class="list-row"><div><strong>${esc(j.name)}</strong><div class="muted">${esc(j.team||'Sem identificação adicional')}</div></div><button class="ghost" onclick="removePerson('judge','${j.id}')">Excluir</button></div>`).join(''):'<div class="list-empty">Nenhum juiz cadastrado.</div>';
}
window.removePerson=function(type,id){const used=type==='player'?db.matches.some(m=>m.playerAId===id||m.playerBId===id):db.matches.some(m=>m.judgeId===id);if(used)return toast('Não é possível excluir: há partidas vinculadas.');if(!confirm('Excluir este cadastro?'))return;if(type==='player')db.players=db.players.filter(x=>x.id!==id);else db.judges=db.judges.filter(x=>x.id!==id);save()}
function isApproved(m){return !!(m.validations?.A&&m.validations?.B)}
function renderDashboard(){
  $('#mTotal').textContent=db.matches.length;$('#mApproved').textContent=db.matches.filter(isApproved).length;$('#mPending').textContent=db.matches.filter(m=>!isApproved(m)).length;$('#mPlayers').textContent=db.players.length;
  $('#recentMatches').innerHTML=db.matches.length?db.matches.slice(0,5).map(m=>miniRow(m)).join(''):'<div class="list-empty">Nenhuma partida registrada.</div>';
  const pending=db.matches.filter(m=>!isApproved(m)).slice(0,6);$('#pendingMatches').innerHTML=pending.length?pending.map(m=>miniRow(m,true)).join(''):'<div class="list-empty">Nenhuma validação pendente.</div>';
}
function miniRow(m,pending=false){const a=getPlayer(m.playerAId)?.name||'Jogador removido',b=getPlayer(m.playerBId)?.name||'Jogador removido';return `<div class="list-row"><div><strong>${esc(a)} ${m.scoreA} × ${m.scoreB} ${esc(b)}</strong><div class="muted">${esc(m.stage)} • Rodada ${esc(m.round)}</div></div><span class="${isApproved(m)?'status-approved':'status-pending'}">${isApproved(m)?'Homologada':pending?'Pendente':'Aguardando'}</span></div>`}
function renderHistory(){
  const q=$('#historySearch').value.toLowerCase().trim(),status=$('#statusFilter').value;
  const filtered=db.matches.filter(m=>{const blob=[getPlayer(m.playerAId)?.name,getPlayer(m.playerBId)?.name,getJudge(m.judgeId)?.name,m.stage,m.round,m.tableNo,m.notes,...matchResults(m).map(r=>FINISH_LABELS[r.finish]||r.finish),...m.deckA.map(comboText),...m.deckB.map(comboText)].join(' ').toLowerCase();return(!q||blob.includes(q))&&(status==='all'||(status==='approved'?isApproved(m):!isApproved(m)))});
  $('#matchList').innerHTML=filtered.length?filtered.map(matchCard).join(''):'<div class="card list-empty">Nenhuma partida encontrada.</div>';
}
function matchCard(m){
 const a=getPlayer(m.playerAId),b=getPlayer(m.playerBId),j=getJudge(m.judgeId); const approved=isApproved(m);
 return `<article class="card match-card">
 <div class="top"><div class="player-score"><div><strong>${esc(a?.name||'Jogador')}</strong><div class="muted">${esc(a?.team||'')}</div></div><div class="score-pill">${m.scoreA}</div></div><div class="${approved?'status-approved':'status-pending'}">${approved?'✓ HOMOLOGADA':'● PENDENTE'}</div><div class="player-score right"><div><strong>${esc(b?.name||'Jogador')}</strong><div class="muted">${esc(b?.team||'')}</div></div><div class="score-pill">${m.scoreB}</div></div></div>
 <div class="match-meta"><span>${esc(m.stage)}</span><span>Rodada ${esc(m.round)}</span>${m.tableNo?`<span>${esc(m.tableNo)}</span>`:''}<span>Juiz: ${esc(j?.name||'—')}</span><span>${fmtDate(m.createdAt)}</span></div>
 ${resultsSummaryHtml(m)}
 <div class="deck-summary"><div><strong>Deck de ${esc(a?.name||'A')}</strong><ol>${m.deckA.map(c=>`<li>${esc(comboText(c))}</li>`).join('')}</ol></div><div><strong>Deck de ${esc(b?.name||'B')}</strong><ol>${m.deckB.map(c=>`<li>${esc(comboText(c))}</li>`).join('')}</ol></div></div>
 ${m.notes?`<div class="muted">Observações: ${esc(m.notes)}</div>`:''}
 <div class="validation-buttons">${m.validations.A?`<span class="badge status-approved">✓ ${esc(a?.name||'A')} validou ${fmtDate(m.validations.A.at)}</span>`:`<button class="secondary" onclick="openValidation('${m.id}','A')">Validar como ${esc(a?.name||'Jogador A')}</button>`}${m.validations.B?`<span class="badge status-approved">✓ ${esc(b?.name||'B')} validou ${fmtDate(m.validations.B.at)}</span>`:`<button class="secondary" onclick="openValidation('${m.id}','B')">Validar como ${esc(b?.name||'Jogador B')}</button>`}<button class="ghost" onclick="deleteMatch('${m.id}')">Excluir registro</button></div>
 </article>`
}
window.openValidation=function(id,side){const m=db.matches.find(x=>x.id===id);if(!m)return;const player=getPlayer(side==='A'?m.playerAId:m.playerBId);$('#validationMatchId').value=id;$('#validationSide').value=side;$('#validationPin').value='';$('#validationError').textContent='';$('#validationTitle').textContent=`Validação de ${player?.name||'jogador'}`;$('#validationSummary').textContent=`Confirme o resultado ${getPlayer(m.playerAId)?.name} ${m.scoreA} × ${m.scoreB} ${getPlayer(m.playerBId)?.name}. ${matchResults(m).map(r=>resultText(r,m)).join(' | ')}`;$('#validationDialog').showModal()}
async function handleValidation(e){e.preventDefault();const id=$('#validationMatchId').value,side=$('#validationSide').value,m=db.matches.find(x=>x.id===id);if(!m)return;const player=getPlayer(side==='A'?m.playerAId:m.playerBId),hash=await hashPin($('#validationPin').value);if(!player||hash!==player.pinHash){$('#validationError').textContent='PIN incorreto. A validação não foi registrada.';return}m.validations[side]={at:new Date().toISOString(),playerId:player.id};m.updatedAt=new Date().toISOString();$('#validationDialog').close();save();toast(isApproved(m)?'Partida homologada pelos dois jogadores.':'Validação registrada. Falta o outro jogador.')}
window.deleteMatch=function(id){const m=db.matches.find(x=>x.id===id);if(isApproved(m)&&!confirm('Esta partida já foi homologada. Tem certeza de que deseja excluir?'))return;if(!isApproved(m)&&!confirm('Excluir esta partida?'))return;db.matches=db.matches.filter(x=>x.id!==id);save();toast('Partida excluída.')}
function renderRanking(){
  const stats=new Map(db.players.map(p=>[p.id,{p,j:0,v:0,d:0,pf:0,ps:0}]));
  db.matches.filter(isApproved).forEach(m=>{const a=stats.get(m.playerAId),b=stats.get(m.playerBId);if(!a||!b)return;a.j++;b.j++;a.pf+=m.scoreA;a.ps+=m.scoreB;b.pf+=m.scoreB;b.ps+=m.scoreA;if(m.scoreA>m.scoreB){a.v++;b.d++}else{b.v++;a.d++}});
  const rows=[...stats.values()].filter(s=>s.j>0).sort((x,y)=>y.v-x.v||((y.pf-y.ps)-(x.pf-x.ps))||y.pf-x.pf||x.p.name.localeCompare(y.p.name));
  $('#rankingBody').innerHTML=rows.length?rows.map((s,i)=>`<tr><td>${i+1}</td><td><strong>${esc(s.p.name)}</strong></td><td>${s.j}</td><td>${s.v}</td><td>${s.d}</td><td>${s.pf}</td><td>${s.ps}</td><td>${s.pf-s.ps}</td><td>${Math.round(s.v/s.j*100)}%</td></tr>`).join(''):'<tr><td colspan="9" class="muted">A classificação aparecerá após a primeira partida homologada.</td></tr>';
}
function download(name,type,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportJson(){download(`panelao-beyblade-x-2026-backup-${new Date().toISOString().slice(0,10)}.json`,'application/json',JSON.stringify(db,null,2));toast('Backup JSON gerado.')}
function importJson(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const next=JSON.parse(r.result);if(!Array.isArray(next.players)||!Array.isArray(next.judges)||!Array.isArray(next.matches))throw new Error();if(confirm('Importar este backup e substituir os dados atuais?')){db={...emptyData(),...next,tournament:TOURNAMENT};save();toast('Backup importado.')}}catch{toast('Arquivo de backup inválido.')}e.target.value=''};r.readAsText(f)}
function csvCell(v){return `"${String(v??'').replace(/"/g,'""')}"`}
function exportCsv(){const head=['ID','Torneio','Fase','Rodada','Mesa','Jogador A','Placar A','Jogador B','Placar B','Pontuação por batalha','Juiz','Status','Validação A','Validação B','Deck A','Deck B','Observações','Registrada em'];const rows=db.matches.map(m=>[m.id,TOURNAMENT,m.stage,m.round,m.tableNo,getPlayer(m.playerAId)?.name,m.scoreA,getPlayer(m.playerBId)?.name,m.scoreB,matchResults(m).map(r=>resultText(r,m)).join(' | '),getJudge(m.judgeId)?.name,isApproved(m)?'Homologada':'Pendente',m.validations.A?.at||'',m.validations.B?.at||'',m.deckA.map(comboText).join(' | '),m.deckB.map(comboText).join(' | '),m.notes,m.createdAt]);download('panelao-beyblade-x-2026-partidas.csv','text/csv;charset=utf-8','\ufeff'+[head,...rows].map(r=>r.map(csvCell).join(';')).join('\n'));toast('CSV gerado.')}

document.addEventListener('DOMContentLoaded',init);
