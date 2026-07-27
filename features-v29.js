(function(){
"use strict";
var core=window.UmaCore;if(!core)return;
var cfg=core.cfg,state=core.getState();
var RED_TYPES=["芝","ダート","短距離","マイル","中距離","長距離","逃げ","先行","差し","追込"];
var HINT_DISCOUNT=[0,.10,.20,.30,.35,.40];
var STAT_POINTS=[[0,0],[100,66],[200,181],[300,352],[400,577],[500,847],[600,1143],[700,1463],[800,1808],[900,2209],[1000,2635],[1100,3171],[1200,3841],[1400,5100],[1600,6600],[1800,8300],[2000,10200],[2230,12600]];
var BASE_RANKS=[[0,"G"],[300,"G+"],[600,"F"],[900,"F+"],[1300,"E"],[1800,"E+"],[2300,"D"],[2900,"D+"],[3500,"C"],[4900,"C+"],[6500,"B"],[8200,"B+"],[10000,"A"],[12100,"A+"],[14500,"S"],[15900,"S+"],[17500,"SS"],[19200,"SS+"],[19600,"UG"],[23900,"UF"],[29400,"UE"],[35000,"UD"],[41000,"UC"],[47000,"UB"],[53000,"UA"],[59000,"US"],[65000,"LG"],[75000,"LF"],[85000,"LE"]];
function uid(){return "s"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function esc(x){return core.esc(String(x==null?"":x))}
function defaultSupportCards(){
  return [
    {id:uid(),name:"マイル因子サポカ（編集用）",type:"スピード",owned:true,skills:["マイル直線○","マイルコーナー○","直線巧者","尻尾上がり"]},
    {id:uid(),name:"中距離因子サポカ（編集用）",type:"スピード",owned:true,skills:["中距離直線○","中距離コーナー○","コーナー巧者○","垂れウマ回避"]},
    {id:uid(),name:"追込因子サポカ（編集用）",type:"賢さ",owned:true,skills:["追込直線○","追込コーナー○","直線一気","ウマ好み"]},
    {id:uid(),name:"緑因子サポカ（編集用）",type:"賢さ",owned:true,skills:["右回り○","左回り○","春ウマ娘○","秋ウマ娘○","自制心"]},
    {id:uid(),name:"汎用因子サポカ（編集用）",type:"根性",owned:true,skills:["地固め","尻尾上がり","コーナー巧者○","垂れウマ回避"]},
    {id:uid(),name:"回復因子サポカ（編集用）",type:"スタミナ",owned:true,skills:["コーナー回復○","直線回復","ペースキープ"]},
    {id:uid(),name:"デバフ因子サポカ（編集用）",type:"賢さ",owned:false,skills:["先行ためらい","差しためらい","追込ためらい","逃げためらい"]},
    {id:uid(),name:"フレンド候補（編集用）",type:"友人・グループ",owned:false,skills:["マイル直線○","中距離直線○","追込直線○","地固め","自制心"]}
  ];
}
function ensureV29(){
  state.version="2.9";
  ["mile","chase"].forEach(function(b){var br=state.branches[b];br.redTypes=br.redTypes||{};["parent","gp1","gp2","a1","a2","a3","a4"].forEach(function(s){if(!br.redTypes[s])br.redTypes[s]=cfg.slots[b].target})});
  state.support=state.support||{};
  if(!Array.isArray(state.support.cards)||!state.support.cards.length)state.support.cards=defaultSupportCards();
  state.support.deck=Array.isArray(state.support.deck)?state.support.deck:[null,null,null,null,null,null];
  state.targetBuild=state.targetBuild||{};
  state.targetBuild.stats=Object.assign({speed:1200,stamina:1200,power:1200,guts:1200,wisdom:1200},state.targetBuild.stats||{});
  state.targetBuild.skills=state.targetBuild.skills||{};
  state.targetBuild.skillPoints=Number(state.targetBuild.skillPoints||0);
  state.targetBuild.uniqueLevel=Number(state.targetBuild.uniqueLevel||6);
  state.targetBuild.trialBonus=Number(state.targetBuild.trialBonus||0);
  state.targetBuild.extraEvaluation=Number(state.targetBuild.extraEvaluation||0);
  state.targetBuild.starRarity=Number(state.targetBuild.starRarity||3);
  core.save();
}
function selectedNames(){return core.selectedSkillNames()}
function skillData(n){return core.skillByName(n)}
function cardScore(card,covered){var score=0;card.skills.forEach(function(n){if(covered[n])return;var s=skillData(n);if(!s)return;if(state.selectedSkills[n]){var m=core.skillMetrics(s);score+=100+(m.efficiency||0)*20+(s.priority||0)/5}});return score}
function autoDeck(){
  var cards=state.support.cards,covered={},chosen=[];
  for(var i=0;i<5;i++){var pool=cards.filter(function(c){return c.owned&&chosen.indexOf(c.id)<0});pool.sort(function(a,b){return cardScore(b,covered)-cardScore(a,covered)});if(!pool.length)break;var pick=pool[0];chosen.push(pick.id);pick.skills.forEach(function(s){covered[s]=true})}
  var friendPool=cards.filter(function(c){return !c.owned&&chosen.indexOf(c.id)<0});friendPool.sort(function(a,b){return cardScore(b,covered)-cardScore(a,covered)});if(!friendPool.length)friendPool=cards.filter(function(c){return chosen.indexOf(c.id)<0}).sort(function(a,b){return cardScore(b,covered)-cardScore(a,covered)});
  state.support.deck=chosen.concat(friendPool[0]?[friendPool[0].id]:[]);while(state.support.deck.length<6)state.support.deck.push(null);state.support.deck=state.support.deck.slice(0,6);core.save();renderSupport();core.toast("必要白因子を優先して編成しました");
}
function deckCard(id){return state.support.cards.find(function(c){return c.id===id})}
function renderSupport(){
  var req=selectedNames(),deck=state.support.deck||[],covered={};deck.forEach(function(id){var c=deckCard(id);if(c)c.skills.forEach(function(s){covered[s]=true})});var hit=req.filter(function(n){return covered[n]}),miss=req.filter(function(n){return !covered[n]});
  var sum=document.getElementById("supportCoverageSummary");if(sum)sum.innerHTML='<b>必要因子 '+req.length+'個中 '+hit.length+'個をカバー</b>'+(miss.length?'<br>未対応：'+miss.slice(0,12).map(esc).join('、')+(miss.length>12?' ほか':''):'<br>選択中の必要因子をすべてカバー');
  var deckEl=document.getElementById("supportDeck");if(deckEl)deckEl.innerHTML=[0,1,2,3,4,5].map(function(i){var id=deck[i]||"",card=deckCard(id),options=state.support.cards.map(function(c){return'<option value="'+c.id+'" '+(c.id===id?'selected':'')+'>'+esc(c.name)+(c.owned?'':'（未所持）')+'</option>'}).join('');return'<div class="support-slot '+(i===5?'friend':'')+'"><div class="support-slot-head"><b>'+(i===5?'フレンド':'所持 '+(i+1))+'</b><select data-deck-slot="'+i+'"><option value="">未設定</option>'+options+'</select></div>'+(card?'<span class="support-type">'+esc(card.type)+'</span><div class="support-skills">'+card.skills.map(function(s){return'<span class="'+(state.selectedSkills[s]?'needed':'')+'">'+esc(s)+'</span>'}).join('')+'</div>':'')+'</div>'}).join('');
  document.querySelectorAll('[data-deck-slot]').forEach(function(e){e.addEventListener('change',function(){state.support.deck[Number(e.dataset.deckSlot)]=e.value||null;core.save();renderSupport()})});
  var cat=document.getElementById("supportCatalog");if(cat)cat.innerHTML=state.support.cards.map(function(c){return'<div class="support-edit-card" data-card="'+c.id+'"><label class="switch-row compact"><input type="checkbox" data-support-owned="'+c.id+'" '+(c.owned?'checked':'')+'><span>所持</span></label><input data-support-name="'+c.id+'" value="'+esc(c.name)+'"><select data-support-type="'+c.id+'">'+["スピード","スタミナ","パワー","根性","賢さ","友人・グループ"].map(function(t){return'<option '+(t===c.type?'selected':'')+'>'+t+'</option>'}).join('')+'</select><textarea data-support-skills="'+c.id+'" rows="3" placeholder="取得可能スキルを改行または読点区切り">'+esc(c.skills.join('\n'))+'</textarea><button class="danger-mini" data-delete-support="'+c.id+'" type="button">削除</button></div>'}).join('');
  bindSupportEditor();
}
function bindSupportEditor(){
  document.querySelectorAll('[data-support-owned]').forEach(function(e){e.onchange=function(){var c=deckCard(e.dataset.supportOwned);if(c)c.owned=e.checked;core.save();renderSupport()}});
  document.querySelectorAll('[data-support-name]').forEach(function(e){e.onchange=function(){var c=deckCard(e.dataset.supportName);if(c)c.name=e.value.trim()||"名称未設定";core.save();renderSupport()}});
  document.querySelectorAll('[data-support-type]').forEach(function(e){e.onchange=function(){var c=deckCard(e.dataset.supportType);if(c)c.type=e.value;core.save();renderSupport()}});
  document.querySelectorAll('[data-support-skills]').forEach(function(e){e.onchange=function(){var c=deckCard(e.dataset.supportSkills);if(c)c.skills=e.value.split(/[\n、,]+/).map(function(x){return x.trim()}).filter(Boolean);core.save();renderSupport()}});
  document.querySelectorAll('[data-delete-support]').forEach(function(e){e.onclick=function(){var id=e.dataset.deleteSupport;state.support.cards=state.support.cards.filter(function(c){return c.id!==id});state.support.deck=state.support.deck.map(function(x){return x===id?null:x});core.save();renderSupport()}});
}
function addSupport(){state.support.cards.push({id:uid(),name:"新しいサポカ",type:"スピード",owned:true,skills:[]});core.save();renderSupport()}
function clearNodeFactors(){var b=core.getActiveBranch(),s=core.getActiveSlot();if(!s)return;if(!confirm("このウマ娘のスキル因子・レース因子をすべて削除しますか？"))return;state.branches[b].skillFactors[s]={};state.branches[b].raceFactors[s]={};core.save();core.renderSkillFactors();core.renderRaceFactors();core.renderTree();core.toast("このウマ娘の因子を削除しました")}
function assignSkill(b,slot,name,auto){var x=core.factorState(b,slot,name);if(x.learned||x.stars)return;x.assigned=true;x.autoPlanned=!!auto}
function clearOldAuto(){["mile","chase"].forEach(function(b){Object.keys(state.branches[b].skillFactors||{}).forEach(function(slot){var m=state.branches[b].skillFactors[slot]||{};Object.keys(m).forEach(function(n){if(m[n].autoPlanned&&!m[n].learned&&!m[n].stars){delete m[n]}})})})}
function distributeFactors(){
  clearOldAuto();var names=selectedNames(),loads={mile:0,chase:0};
  names.forEach(function(n,i){var dual=i<Math.min(6,Math.ceil(names.length/3));var branches=dual?["mile","chase"]:[loads.mile<=loads.chase?"mile":"chase"];branches.forEach(function(b){["parent","gp1","gp2","a1","a2","a3","a4"].forEach(function(s){assignSkill(b,s,n,true)});loads[b]++})});
  core.save();core.renderTree();core.toast("白因子を曾祖父母まで自動配置しました");
}
function installRedTypeEditor(){var b=core.getActiveBranch(),s=core.getActiveSlot();if(!s)return;var holder=document.querySelector('.sheet-stars');if(!holder)return;var old=document.getElementById('redFactorTypeWrap');if(old)old.remove();var wrap=document.createElement('label');wrap.id='redFactorTypeWrap';wrap.className='red-factor-type';wrap.innerHTML='赤因子<select id="redFactorTypeSelect">'+RED_TYPES.map(function(t){return'<option '+(state.branches[b].redTypes[s]===t?'selected':'')+'>'+t+'</option>'}).join('')+'</select>';holder.prepend(wrap);document.getElementById('redFactorTypeSelect').onchange=function(){state.branches[b].redTypes[s]=this.value;core.save();core.renderTree()};}
function discountedCost(s,h){return Math.max(1,Math.ceil(Number(s.sp||0)*(1-HINT_DISCOUNT[h||0])))}
function targetSkill(n){state.targetBuild.skills[n]=state.targetBuild.skills[n]||{selected:false,hint:0};return state.targetBuild.skills[n]}
function statScore(v){v=Math.max(0,Number(v||0));for(var i=1;i<STAT_POINTS.length;i++){if(v<=STAT_POINTS[i][0]){var a=STAT_POINTS[i-1],b=STAT_POINTS[i],r=(v-a[0])/(b[0]-a[0]);return Math.round(a[1]+(b[1]-a[1])*r)}}var z=STAT_POINTS[STAT_POINTS.length-1];return Math.round(z[1]+(v-z[0])*12)}
function uniqueScore(){var lv=state.targetBuild.uniqueLevel||1;return (state.targetBuild.starRarity>=3?170:120)*lv}
function totals(){var stat=Object.keys(state.targetBuild.stats).reduce(function(t,k){return t+statScore(state.targetBuild.stats[k])},0),skill=0,cost=0,count=0;Object.keys(state.targetBuild.skills).forEach(function(n){var x=state.targetBuild.skills[n],s=skillData(n);if(x&&x.selected&&s){skill+=(core.skillMetrics(s).evaluation||0);cost+=discountedCost(s,x.hint);count++}});var evalTotal=stat+skill+uniqueScore()+Number(state.targetBuild.extraEvaluation||0);return{stat:stat,skill:skill,cost:cost,count:count,total:evalTotal,trial:evalTotal+Number(state.targetBuild.trialBonus||0)}}
function rankName(v){var base="G";for(var i=0;i<BASE_RANKS.length;i++){if(v>=BASE_RANKS[i][0])base=BASE_RANKS[i][1];else break}var idx=BASE_RANKS.findIndex(function(x){return x[1]===base});if(idx>=18&&idx<BASE_RANKS.length-1){var start=BASE_RANKS[idx][0],end=BASE_RANKS[idx+1][0],step=(end-start)/10,n=Math.min(9,Math.floor((v-start)/step));if(n>0)base+=n}return base}
function renderTargetStats(){var el=document.getElementById('targetStats');if(!el)return;var labels={speed:'スピード',stamina:'スタミナ',power:'パワー',guts:'根性',wisdom:'賢さ'};el.innerHTML=Object.keys(labels).map(function(k){return'<label>'+labels[k]+'<input data-target-stat="'+k+'" type="number" min="0" max="2500" value="'+state.targetBuild.stats[k]+'"></label>'}).join('');document.querySelectorAll('[data-target-stat]').forEach(function(e){e.oninput=function(){state.targetBuild.stats[e.dataset.targetStat]=Number(e.value||0);core.save();renderTargetTotals()}})}
function renderTargetSkills(){var q=(document.getElementById('targetSkillSearch').value||'').trim().toLowerCase(),list=cfg.skillCatalog.filter(function(s){return !q||s.name.toLowerCase().indexOf(q)>=0||String(s.category||'').toLowerCase().indexOf(q)>=0});list.sort(function(a,b){var aa=targetSkill(a.name).selected?1:0,bb=targetSkill(b.name).selected?1:0;if(aa!==bb)return bb-aa;return (core.skillMetrics(b).efficiency||0)-(core.skillMetrics(a).efficiency||0)});document.getElementById('targetSkillList').innerHTML=list.map(function(s){var x=targetSkill(s.name),m=core.skillMetrics(s),cost=discountedCost(s,x.hint);return'<div class="target-skill-row '+(x.selected?'selected':'')+'"><label><input type="checkbox" data-target-skill="'+esc(s.name)+'" '+(x.selected?'checked':'')+'><span>'+esc(s.name)+'</span></label><button type="button" class="hint-level" data-hint-skill="'+esc(s.name)+'">ヒントLv'+x.hint+'</button><span class="target-skill-cost">SP '+cost+'</span><span class="target-skill-eff">効率 '+(m.efficiency==null?'—':(m.evaluation/cost).toFixed(2))+'</span></div>'}).join('');document.querySelectorAll('[data-target-skill]').forEach(function(e){e.onchange=function(){targetSkill(e.dataset.targetSkill).selected=e.checked;core.save();renderTargetSkills();renderTargetTotals()}});document.querySelectorAll('[data-hint-skill]').forEach(function(e){e.onclick=function(){var x=targetSkill(e.dataset.hintSkill);x.hint=(Number(x.hint||0)+1)%6;core.save();renderTargetSkills();renderTargetTotals()}})}
function autoAllocate(){var budget=Math.max(0,Number(state.targetBuild.skillPoints||0)),items=cfg.skillCatalog.map(function(s){var x=targetSkill(s.name);return{name:s.name,cost:discountedCost(s,x.hint),value:core.skillMetrics(s).evaluation||0}}).filter(function(x){return x.cost>0&&x.value>0&&x.cost<=budget});var dp=new Int32Array(budget+1),pick=Array(budget+1).fill(null);items.forEach(function(it,idx){for(var w=budget;w>=it.cost;w--){var cand=dp[w-it.cost]+it.value;if(cand>dp[w]){dp[w]=cand;pick[w]={prev:w-it.cost,idx:idx}}}});var best=0;for(var w=1;w<=budget;w++)if(dp[w]>dp[best])best=w;Object.keys(state.targetBuild.skills).forEach(function(n){state.targetBuild.skills[n].selected=false});var seen={};while(best>0&&pick[best]){var p=pick[best],it=items[p.idx];if(!seen[it.name]){targetSkill(it.name).selected=true;seen[it.name]=1}best=p.prev}core.save();renderTargetSkills();renderTargetTotals();core.toast("所持SP内で査定値が最大になる組合せを選びました")}
function redChance(b){var br=state.branches[b],stars=Number(br.stars.parent||0),type=br.redTypes.parent||cfg.slots[b].target,p=stars?core.individualEstimate(b,'parent',stars,'skill'):0;return{name:core.selected(b,'parent')||'未選択',type:type,stars:stars,p:p}}
function renderInheritance(){var m=redChance('mile'),c=redChance('chase'),same=m.type===c.type,any=same?core.combineAtLeastOne(m.p,c.p):null;var whites={};['mile','chase'].forEach(function(b){Object.keys(state.branches[b].skillFactors.parent||{}).forEach(function(n){var x=state.branches[b].skillFactors.parent[n];if(x&&x.stars)whites[n]=1})});var html='<div class="inherit-card"><b>赤因子</b><div>'+esc(m.name)+'：'+esc(m.type)+'★'+m.stars+' → '+m.p+'%</div><div>'+esc(c.name)+'：'+esc(c.type)+'★'+c.stars+' → '+c.p+'%</div>'+(same?'<strong>子が「'+esc(m.type)+'」を継承：'+any+'%</strong>':'<span>赤因子の種類が異なるため個別判定</span>')+'</div>';html+=Object.keys(whites).sort().slice(0,30).map(function(n){function p(b){var x=(state.branches[b].skillFactors.parent||{})[n];return x&&x.stars?core.individualEstimate(b,'parent',Number(x.stars),'skill'):0}var p1=p('mile'),p2=p('chase');return'<div class="inherit-card"><b>'+esc(n)+'</b><span>父 '+p1+'%／母 '+p2+'%</span><strong>少なくとも片方 '+core.combineAtLeastOne(p1,p2)+'%</strong></div>'}).join('');document.getElementById('targetInheritance').innerHTML=html}
function renderTargetTotals(){var t=totals();document.getElementById('estimatedEvaluation').textContent=t.total.toLocaleString('ja-JP');document.getElementById('estimatedRank').textContent=rankName(t.total);document.getElementById('estimatedTrialScore').textContent=t.trial.toLocaleString('ja-JP');document.getElementById('targetSkillTotals').innerHTML='<b>取得 '+t.count+'個／消費 '+t.cost+'SP</b>　スキル査定 '+t.skill.toLocaleString('ja-JP')+'・ステータス査定 約'+t.stat.toLocaleString('ja-JP')}
function openTarget(){document.getElementById('targetBuildTitle').textContent=core.targetName();renderTargetStats();document.getElementById('uniqueSkillLevel').innerHTML=[1,2,3,4,5,6].map(function(n){return'<option '+(n===state.targetBuild.uniqueLevel?'selected':'')+'>'+n+'</option>'}).join('');document.getElementById('trialBonus').value=state.targetBuild.trialBonus;document.getElementById('extraEvaluation').value=state.targetBuild.extraEvaluation;document.getElementById('availableSkillPoints').value=state.targetBuild.skillPoints;renderTargetSkills();renderTargetTotals();renderInheritance();document.getElementById('targetBuildSheet').classList.remove('hidden')}
function closeTarget(){document.getElementById('targetBuildSheet').classList.add('hidden')}
function bind(){
  var auto=document.getElementById('autoSupportDeckBtn');if(auto)auto.onclick=autoDeck;var add=document.getElementById('addSupportCardBtn');if(add)add.onclick=addSupport;var clear=document.getElementById('clearNodeFactorsBtn');if(clear)clear.onclick=clearNodeFactors;
  document.getElementById('autoDesignBtn').addEventListener('click',function(){setTimeout(distributeFactors,0)});
  document.addEventListener('click',function(e){if(e.target.closest('[data-target-node]'))openTarget();if(e.target.closest('[data-close-target]'))closeTarget();if(e.target.closest('.tree-node[data-slot]'))setTimeout(installRedTypeEditor,0)});
  document.getElementById('uniqueSkillLevel').onchange=function(){state.targetBuild.uniqueLevel=Number(this.value);core.save();renderTargetTotals()};document.getElementById('trialBonus').oninput=function(){state.targetBuild.trialBonus=Number(this.value||0);core.save();renderTargetTotals()};document.getElementById('extraEvaluation').oninput=function(){state.targetBuild.extraEvaluation=Number(this.value||0);core.save();renderTargetTotals()};document.getElementById('availableSkillPoints').oninput=function(){state.targetBuild.skillPoints=Number(this.value||0);core.save();renderTargetTotals()};document.getElementById('targetSkillSearch').oninput=renderTargetSkills;document.getElementById('autoAllocateSkillsBtn').onclick=autoAllocate;document.getElementById('clearTargetSkillsBtn').onclick=function(){Object.keys(state.targetBuild.skills).forEach(function(n){state.targetBuild.skills[n].selected=false});core.save();renderTargetSkills();renderTargetTotals()};
}
ensureV29();renderSupport();bind();
})();
