(function(){
"use strict";
var core=window.UmaCore;
var pack=window.UMA_SUPPORT_LIBRARY_V31;
if(!core||!pack)return;
var cfg=core.cfg,state=core.getState();
var LIBRARY=pack.cards||[];
var DATA_VERSION=pack.version||"2026-07-29-v31";
var SLOTS=["parent","gp1","gp2","a1","a2","a3","a4"];
var RED_TYPES=["芝","ダート","短距離","マイル","中距離","長距離","逃げ","先行","差し","追込"];
var TYPE_ORDER=["スピード","スタミナ","パワー","根性","賢さ","友人","グループ","不明"];
var STAT_POINTS=[[0,0],[100,66],[200,181],[300,352],[400,577],[500,847],[600,1143],[700,1463],[800,1808],[900,2209],[1000,2635],[1100,3171],[1200,3841],[1400,5100],[1600,6600],[1800,8300],[2000,10200],[2230,12600]];
var BASE_RANKS=[[0,"G"],[300,"G+"],[600,"F"],[900,"F+"],[1300,"E"],[1800,"E+"],[2300,"D"],[2900,"D+"],[3500,"C"],[4900,"C+"],[6500,"B"],[8200,"B+"],[10000,"A"],[12100,"A+"],[14500,"S"],[15900,"S+"],[17500,"SS"],[19200,"SS+"],[19600,"UG"],[23900,"UF"],[29400,"UE"],[35000,"UD"],[41000,"UC"],[47000,"UB"],[53000,"UA"],[59000,"US"],[65000,"LG"],[75000,"LF"],[85000,"LE"]];
var supportSearch="",supportRarity="ALL",supportType="ALL",supportNeededOnly=false;
var activePlanKey="target";

function esc(v){return core.esc(String(v==null?"":v))}
function clone(v){return JSON.parse(JSON.stringify(v))}
function uid(){return "support-"+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function normSkill(v){return String(v||"").replace(/◯/g,"○").trim()}
function unique(list){var seen={},out=[];(list||[]).forEach(function(v){v=normSkill(v);if(v&&!seen[v]){seen[v]=1;out.push(v)}});return out}
function normalizedType(v){v=String(v||"不明");if(v.indexOf("友人")>=0)return"友人";if(v.indexOf("グループ")>=0)return"グループ";return TYPE_ORDER.indexOf(v)>=0?v:"不明"}
function typeClass(v){var m={"スピード":"speed","スタミナ":"stamina","パワー":"power","根性":"guts","賢さ":"wisdom","友人":"friend","グループ":"group","不明":"unknown"};return"type-"+(m[normalizedType(v)]||"unknown")}
function skillData(name){return core.skillByName(normSkill(name))}
function cardById(id){return state.support.cards.find(function(c){return c.id===id})||null}
function cardLabel(c){return"["+normalizedType(c.type)+"] "+(c.rarity||"SSR")+" "+c.name+(c.title?" — "+c.title:"")}
function isLegacy(c){return /編集用|フレンド候補|新しいサポカ/.test(String(c&&c.name||""))}
function mergeLibrary(existing,force){
  existing=Array.isArray(existing)?existing:[];
  var byId={},byKey={};
  existing.forEach(function(c){if(!c)return;if(c.id)byId[c.id]=c;byKey[String(c.name||"")+"|"+String(c.title||"")]=c});
  var merged=LIBRARY.map(function(base){
    var old=byId[base.id]||byKey[base.name+"|"+base.title],x=clone(base);
    if(old){
      x.owned=!!old.owned;
      if(!force&&Array.isArray(old.customSkills))x.customSkills=unique(old.customSkills);
    }
    return x;
  });
  existing.forEach(function(c){
    if(!c||isLegacy(c)||LIBRARY.some(function(x){return x.id===c.id||(x.name===c.name&&x.title===c.title)}))return;
    var x=clone(c);x.builtin=false;x.rarity=x.rarity==="SR"?"SR":"SSR";x.type=normalizedType(x.type);x.skills=unique(x.skills||x.customSkills||[]);merged.push(x);
  });
  return merged;
}
function ensureScenario(){if(!(cfg.scenarioModes||[]).some(function(x){return x.id==="ramen"}))cfg.scenarioModes.splice(1,0,{id:"ramen",name:"ラーメンシナリオ（新たづなリンク）"})}
function allPlanKeys(){var out=["target"];["mile","chase"].forEach(function(b){SLOTS.forEach(function(s){out.push(b+":"+s)})});return out}
function ensurePlan(key){
  state.support.plans=state.support.plans||{};
  var p=state.support.plans[key]||{};
  p.deck=Array.isArray(p.deck)?p.deck.slice(0,6):[null,null,null,null,null,null];while(p.deck.length<6)p.deck.push(null);
  p.deck=p.deck.map(function(id){return cardById(id)?id:null});
  p.scenario=p.scenario||state.scenarioMode||"character";
  state.support.plans[key]=p;return p;
}
function ensureV31(){
  ensureScenario();state.version="3.7";
  ["mile","chase"].forEach(function(b){var br=state.branches[b];br.redTypes=br.redTypes||{};SLOTS.forEach(function(s){if(!br.redTypes[s])br.redTypes[s]=cfg.slots[b].target})});
  state.support=state.support||{};
  var oldDeck=Array.isArray(state.support.deck)?state.support.deck.slice(0,6):null;
  state.support.cards=mergeLibrary(state.support.cards,false);state.support.dataVersion=DATA_VERSION;
  state.support.plans=state.support.plans||{};
  if(oldDeck&&!state.support.plans.target)state.support.plans.target={deck:oldDeck,scenario:state.scenarioMode||"character"};
  allPlanKeys().forEach(ensurePlan);
  state.targetBuild=state.targetBuild||{};
  state.targetBuild.stats=Object.assign({speed:1200,stamina:1200,power:1200,guts:1200,wisdom:1200},state.targetBuild.stats||{});
  state.targetBuild.skills=state.targetBuild.skills||{};
  state.targetBuild.skillPoints=Number(state.targetBuild.skillPoints||0);
  state.targetBuild.uniqueLevel=Number(state.targetBuild.uniqueLevel||6);
  state.targetBuild.trialBonus=Number(state.targetBuild.trialBonus||0);
  state.targetBuild.extraEvaluation=Number(state.targetBuild.extraEvaluation||0);
  state.targetBuild.starRarity=Number(state.targetBuild.starRarity||3);
  state.targetBuild.raceCounts=Object.assign({g1:0,g2:0,g3:0,op:0},state.targetBuild.raceCounts||{});
  core.save();
}
function currentPlan(){return ensurePlan(activePlanKey)}
function selectedUmaForPlan(key){
  if(key==="target")return core.targetName();
  var a=key.split(":"),b=a[0],s=a[1];return core.selected(b,s)||"未選択";
}
function plainUmaName(name){return String(name||"").replace(/^\[[^\]]+\]\s*/,"").trim()}
function roleForPlan(key){if(key==="target")return"本番育成";var a=key.split(":"),b=a[0],s=a[1];return(b==="mile"?"マイル側":"追込側")+"・"+cfg.slots[b].nodes[s].role}
function planLabel(key){return roleForPlan(key)+"｜"+selectedUmaForPlan(key)}
function targetSelectedSkills(){var out=core.selectedSkillNames().slice();Object.keys(state.targetBuild.skills||{}).forEach(function(n){if(state.targetBuild.skills[n]&&state.targetBuild.skills[n].selected)out.push(n)});return unique(out)}
function planNeededNames(key){
  if(key==="target")return targetSelectedSkills();
  var a=key.split(":"),m=(state.branches[a[0]].skillFactors[a[1]]||{}),out=[];
  Object.keys(m).forEach(function(n){var x=m[n];if(x&&(x.assigned||x.learned||Number(x.stars)>0))out.push(n)});return unique(out);
}
function factorSkills(card){
  var src=Array.isArray(card.customSkills)?card.customSkills:(card.skills||[]);
  return unique(src).filter(function(n){var s=skillData(n);return!s||s.factorEligible!==false});
}
function allCardSkills(card){return unique([].concat(card.hintSkills||[],card.eventSkills||[],card.skills||[],card.goldSkills||[],card.customSkills||[]))}
function skillSourceWeight(card,name){if((card.hintSkills||[]).indexOf(name)>=0)return 14;if((card.eventSkills||[]).indexOf(name)>=0)return 10;if((card.goldSkills||[]).indexOf(name)>=0)return 11;if((card.skills||[]).indexOf(name)>=0)return 8;return 0}
function isNewTazuna(card){return card&&card.name==="駿川たづな"&&card.title==="一杯のノスタルジア"}
function cardAllowed(card,key,chosen){
  if(!card)return false;
  var uma=plainUmaName(selectedUmaForPlan(key));if(uma&&uma!=="未選択"&&(uma===card.name||uma.indexOf(card.name)>=0))return false;
  if((chosen||[]).some(function(id){var c=cardById(id);return c&&(c.id===card.id||c.name===card.name)}))return false;
  return true;
}
function cardScore(card,covered,key,chosen,typeCounts){
  var needed=planNeededNames(key),score=Number(card.priority||0),newHits=0,total=0;
  needed.forEach(function(n){var w=skillSourceWeight(card,n);if(w){total++;var s=skillData(n),m=s?core.skillMetrics(s):null;if(!covered[n]){newHits++;score+=300+w*8+(m&&m.efficiency?m.efficiency*25:0)}else score+=8}});
  score+=newHits*newHits*55+total*10;
  var t=normalizedType(card.type),count=(typeCounts&&typeCounts[t])||0;if(count===0)score+=35;else if(count>=2)score-=80*count;
  var scenario=ensurePlan(key).scenario;if(scenario==="ramen"&&isNewTazuna(card))score+=100000;
  if((card.tags||[]).some(function(x){return /因子周回|最新強|高効率/.test(x)}))score+=20;
  if(card.dataQuality==="metadata-only")score-=45;
  return score;
}
function addCovered(card,covered){allCardSkills(card).forEach(function(n){covered[n]=true})}
function autoDeck(){
  var p=currentPlan(),chosen=[],covered={},typeCounts={};
  var mandatory=state.support.cards.find(isNewTazuna);
  function choose(card){
    if(!card||chosen.length>=5)return false;
    if(!cardAllowed(card,activePlanKey,chosen))return false;
    chosen.push(card.id);addCovered(card,covered);
    var t=normalizedType(card.type);typeCounts[t]=(typeCounts[t]||0)+1;return true;
  }
  function adjustedScore(card){
    var score=cardScore(card,covered,activePlanKey,chosen,typeCounts),t=normalizedType(card.type),count=typeCounts[t]||0;
    if(p.scenario==="ramen"){
      /* ラーメンは新たづな＋スピード2＋賢さ1を基本形にし、残りは必要スキルとタイプ分散で決める。 */
      if(count===0)score+=220;
      if(t==="スピード"&&count>=2)score-=1200;
      if(t==="賢さ"&&count>=1)score-=260;
      if((t==="友人"||t==="グループ")&&count>=1)score-=700;
    }
    return score;
  }
  function bestOwnedOfType(type){
    var pool=state.support.cards.filter(function(c){return c.owned&&normalizedType(c.type)===type&&cardAllowed(c,activePlanKey,chosen)});
    pool.sort(function(a,b){return adjustedScore(b)-adjustedScore(a)});return pool[0]||null;
  }
  if(p.scenario==="ramen"&&mandatory&&mandatory.owned)choose(mandatory);
  if(p.scenario==="ramen"){
    ["スピード","スピード","賢さ"].forEach(function(t){choose(bestOwnedOfType(t))});
  }
  while(chosen.length<5){
    var pool=state.support.cards.filter(function(c){return c.owned&&cardAllowed(c,activePlanKey,chosen)});
    if(!pool.length)break;
    pool.sort(function(a,b){return adjustedScore(b)-adjustedScore(a)});choose(pool[0]);
  }
  var friend=null;
  if(p.scenario==="ramen"&&mandatory&&!mandatory.owned&&cardAllowed(mandatory,activePlanKey,chosen))friend=mandatory;
  if(!friend){
    var fp=state.support.cards.filter(function(c){return!c.owned&&cardAllowed(c,activePlanKey,chosen)});
    fp.sort(function(a,b){return adjustedScore(b)-adjustedScore(a)});friend=fp[0]||null;
  }
  p.deck=chosen.concat([friend?friend.id:null]);while(p.deck.length<6)p.deck.push(null);p.deck=p.deck.slice(0,6);
  core.save();renderSupport();core.toast("このウマ娘の必要スキルとシナリオに合わせて編成しました");
}
function setDeckSlot(index,id){
  var p=currentPlan(),card=cardById(id);if(card){p.deck=p.deck.map(function(x,i){var c=cardById(x);return i!==index&&c&&c.name===card.name?null:x})}p.deck[index]=id||null;core.save();renderSupport();
}
function renderPlanTarget(){var e=document.getElementById("supportPlanTarget");if(!e)return;e.innerHTML=allPlanKeys().map(function(k){return'<option value="'+k+'" '+(k===activePlanKey?'selected':'')+'>'+esc(planLabel(k))+'</option>'}).join("")}
function renderScenario(){var e=document.getElementById("scenarioMode");if(!e)return;var p=currentPlan();e.innerHTML=(cfg.scenarioModes||[]).map(function(x){return'<option value="'+x.id+'" '+(p.scenario===x.id?'selected':'')+'>'+esc(x.name)+'</option>'}).join("")}
function skillChips(list,needed,cls){var want={};needed.forEach(function(n){want[n]=1});return unique(list).map(function(n){var s=skillData(n),g=s&&s.grade==="gold";return'<span class="'+(cls||'')+' '+(want[n]?'needed ':'')+(g?'gold-chip':'')+'">'+esc(n)+'</span>'}).join("")}
function deckCoverage(){var needed=planNeededNames(activePlanKey),covered={};currentPlan().deck.forEach(function(id){var c=cardById(id);if(c)addCovered(c,covered)});return{needed:needed,hit:needed.filter(function(n){return covered[n]}),miss:needed.filter(function(n){return!covered[n]})}}
function optionHtml(card,id,index){var unavailable=index<5&&!card.owned;return'<option value="'+card.id+'" '+(card.id===id?'selected':'')+'>'+esc(cardLabel(card))+(unavailable?'（未所持）':'')+'</option>'}
function renderDeck(){
  var deck=currentPlan().deck,el=document.getElementById("supportDeck");if(!el)return;
  el.innerHTML=[0,1,2,3,4,5].map(function(i){
    var id=deck[i]||"",card=cardById(id),options=state.support.cards.slice().sort(function(a,b){var ta=TYPE_ORDER.indexOf(normalizedType(a.type)),tb=TYPE_ORDER.indexOf(normalizedType(b.type));return ta-tb||cardLabel(a).localeCompare(cardLabel(b),'ja')}).filter(function(c){return cardAllowed(c,activePlanKey,deck.filter(function(_,j){return j!==i}))||c.id===id}).map(function(c){return optionHtml(c,id,i)}).join("");
    return'<div class="support-slot '+(i===5?'friend ':'')+(card?typeClass(card.type):'')+'"><div class="support-slot-head"><b>'+(i===5?'フレンド':'所持 '+(i+1))+'</b><select data-deck-slot="'+i+'"><option value="">未設定</option>'+options+'</select></div>'+(card?'<div class="support-card-meta"><span class="rarity-badge '+String(card.rarity||'').toLowerCase()+'">'+esc(card.rarity||'SSR')+'</span><span class="support-type">'+esc(normalizedType(card.type))+'</span><b>'+esc(card.name)+'</b><small>'+esc(card.title||'')+'</small></div><div class="support-skills">'+skillChips(allCardSkills(card),planNeededNames(activePlanKey))+'</div>':'')+'</div>';
  }).join("");
  document.querySelectorAll("[data-deck-slot]").forEach(function(e){e.onchange=function(){setDeckSlot(Number(e.dataset.deckSlot),e.value)}});
}
function filteredCards(){
  var q=supportSearch.trim().toLowerCase(),needed=planNeededNames(activePlanKey),want={};needed.forEach(function(n){want[n]=1});
  return state.support.cards.filter(function(c){
    if(supportRarity!=="ALL"&&c.rarity!==supportRarity)return false;
    if(supportType!=="ALL"&&normalizedType(c.type)!==supportType)return false;
    var skills=allCardSkills(c);if(supportNeededOnly&&!skills.some(function(n){return want[n]}))return false;
    if(q){var hay=[c.name,c.title,c.type,c.rarity,c.releaseDate,(c.tags||[]).join(" "),skills.join(" ")].join(" ").toLowerCase();if(hay.indexOf(q)<0)return false}
    return true;
  }).sort(function(a,b){return cardScore(b,{},activePlanKey,[],{})-cardScore(a,{},activePlanKey,[],{})||cardLabel(a).localeCompare(cardLabel(b),'ja')});
}
function renderCatalog(){
  var cards=filteredCards(),needed=planNeededNames(activePlanKey),count=document.getElementById("supportFilterCount");if(count)count.textContent=cards.length+"枚表示／全"+state.support.cards.length+"枚";
  var el=document.getElementById("supportCatalog");if(!el)return;
  el.innerHTML=cards.map(function(c){var factor=factorSkills(c),hint=c.hintSkills||[],ev=c.eventSkills||[],gold=c.goldSkills||[],quality=c.dataQuality==="metadata-only"?"スキル詳細未収録":(c.dataQuality==="character-fallback"?"同キャラ候補を補完":"スキル収録済み");return'<div class="support-edit-card '+typeClass(c.type)+'" data-card="'+c.id+'"><div class="support-card-top"><label class="switch-row compact"><input type="checkbox" data-support-owned="'+c.id+'" '+(c.owned?'checked':'')+'><span>所持</span></label><span class="rarity-badge '+String(c.rarity||'').toLowerCase()+'">'+esc(c.rarity||'SSR')+'</span><span class="support-type">'+esc(normalizedType(c.type))+'</span><b>'+esc(c.name)+'</b><small>'+esc(c.title||'')+'</small></div><div class="support-card-sub"><span>'+(c.releaseDate?esc(c.releaseDate):'実装日未登録')+'</span><span>'+esc(quality)+'</span></div><p class="support-why">'+esc(c.why||'')+'</p><div class="support-tags">'+(c.tags||[]).map(function(t){return'<span>'+esc(t)+'</span>'}).join('')+'</div><div class="support-skills factor-skills"><strong>白因子候補 '+factor.length+'</strong>'+skillChips(factor,needed)+'</div>'+(gold.length?'<div class="support-skills gold-skills"><strong>金スキル '+gold.length+'</strong>'+skillChips(gold,needed,'gold-source')+'</div>':'')+'<details class="support-card-details"><summary>取得経路・編集</summary><div class="skill-source"><b>ヒント</b><div class="support-skills">'+skillChips(hint,needed,'hint-source')+'</div></div><div class="skill-source"><b>イベント</b><div class="support-skills">'+skillChips(ev,needed,'event-source')+'</div></div><div class="support-edit-fields"><select data-support-rarity="'+c.id+'"><option '+(c.rarity==='SSR'?'selected':'')+'>SSR</option><option '+(c.rarity==='SR'?'selected':'')+'>SR</option></select><input data-support-name="'+c.id+'" value="'+esc(c.name)+'"><input data-support-title="'+c.id+'" value="'+esc(c.title||'')+'" placeholder="カード名（二つ名）"><select data-support-type="'+c.id+'">'+TYPE_ORDER.map(function(t){return'<option '+(t===normalizedType(c.type)?'selected':'')+'>'+t+'</option>'}).join('')+'</select><textarea data-support-skills="'+c.id+'" rows="4" placeholder="白因子候補を改行または読点区切り">'+esc(factor.join('\n'))+'</textarea><div class="support-card-actions">'+(c.builtin?'<button class="mini-button ghost" data-reset-support="'+c.id+'" type="button">実データに戻す</button>':'<button class="danger-mini" data-delete-support="'+c.id+'" type="button">削除</button>')+'</div></div></details></div>'}).join('')||'<div class="loading-note">条件に一致するサポカがありません。</div>';
  bindCatalog();
}
function bindCatalog(){
  document.querySelectorAll("[data-support-owned]").forEach(function(e){e.onchange=function(){var c=cardById(e.dataset.supportOwned);if(c)c.owned=e.checked;core.save();renderSupport()}});
  [["name","supportName"],["title","supportTitle"],["rarity","supportRarity"],["type","supportType"]].forEach(function(pair){document.querySelectorAll("[data-support-"+pair[0]+"]").forEach(function(e){e.onchange=function(){var c=cardById(e.dataset[pair[1]]);if(c)c[pair[0]]=e.value.trim()||c[pair[0]];core.save();renderSupport()}})});
  document.querySelectorAll("[data-support-skills]").forEach(function(e){e.onchange=function(){var c=cardById(e.dataset.supportSkills);if(c)c.customSkills=unique(e.value.split(/[\n、,]+/));core.save();renderSupport()}});
  document.querySelectorAll("[data-reset-support]").forEach(function(e){e.onclick=function(){var c=cardById(e.dataset.resetSupport),base=LIBRARY.find(function(x){return x.id===e.dataset.resetSupport});if(c&&base){var owned=c.owned,x=clone(base);x.owned=owned;state.support.cards=state.support.cards.map(function(y){return y.id===x.id?x:y});core.save();renderSupport();core.toast("実データに戻しました")}}});
  document.querySelectorAll("[data-delete-support]").forEach(function(e){e.onclick=function(){var id=e.dataset.deleteSupport;state.support.cards=state.support.cards.filter(function(c){return c.id!==id});Object.keys(state.support.plans).forEach(function(k){state.support.plans[k].deck=state.support.plans[k].deck.map(function(x){return x===id?null:x})});core.save();renderSupport()}});
}
function renderSupport(){
  renderPlanTarget();renderScenario();var cv=deckCoverage(),info=document.getElementById("supportPlanInfo");if(info)info.innerHTML='<b>'+esc(planLabel(activePlanKey))+'</b><span>必要スキル '+cv.needed.length+'個・シナリオ別に編成を保存</span>';
  var sum=document.getElementById("supportCoverageSummary");if(sum)sum.innerHTML='<b>必要スキル '+cv.needed.length+'個中 '+cv.hit.length+'個をカバー</b><span class="support-data-stamp">SSR '+state.support.cards.filter(function(c){return c.rarity==='SSR'}).length+'／SR '+state.support.cards.filter(function(c){return c.rarity==='SR'}).length+'・'+esc(DATA_VERSION)+'</span>'+(cv.miss.length?'<br>未対応：'+cv.miss.slice(0,14).map(esc).join('、')+(cv.miss.length>14?' ほか':''):'<br>選択中の必要スキルをすべてカバー');
  renderDeck();renderCatalog();
}
function addSupport(){state.support.cards.push({id:uid(),builtin:false,rarity:"SSR",name:"手動追加サポカ",title:"",type:"スピード",owned:true,skills:[],customSkills:[],hintSkills:[],eventSkills:[],goldSkills:[],tags:["手動追加"],priority:40,why:"手動で追加したカード",dataQuality:"manual"});core.save();renderSupport()}
function restoreLibrary(){if(!confirm("所持チェックは残して、収録サポカのカード名・タイプ・スキルを最新版に戻しますか？"))return;state.support.cards=mergeLibrary(state.support.cards,true);state.support.dataVersion=DATA_VERSION;core.save();renderSupport();core.toast("サポカ実データを再読込しました")}
function clearOldAuto(){["mile","chase"].forEach(function(b){Object.keys(state.branches[b].skillFactors||{}).forEach(function(slot){var m=state.branches[b].skillFactors[slot]||{};Object.keys(m).forEach(function(n){if(m[n].autoPlanned&&!m[n].learned&&!m[n].stars)delete m[n]})})})}
function assignSkill(b,slot,name){var x=core.factorState(b,slot,name);if(x.learned||x.stars)return;x.assigned=true;x.autoPlanned=true}
function distributeFactors(){
  clearOldAuto();var names=core.selectedSkillNames().slice().sort(function(a,b){return(core.skillMetrics(skillData(b)).efficiency||0)-(core.skillMetrics(skillData(a)).efficiency||0)}),loads={mile:0,chase:0};
  names.forEach(function(n,i){var both=i<Math.min(8,Math.ceil(names.length*.35)),branches=both?["mile","chase"]:[loads.mile<=loads.chase?"mile":"chase"];branches.forEach(function(b){SLOTS.forEach(function(s){assignSkill(b,s,n)});loads[b]++})});
  core.save();core.renderTree();renderSupport();core.toast("技能試験効率の高い白因子を両家系へ優先配置しました");
}
function clearNodeFactors(){var b=core.getActiveBranch(),s=core.getActiveSlot();if(!s)return;if(!confirm("このウマ娘のスキル因子・レース因子をすべて削除しますか？"))return;state.branches[b].skillFactors[s]={};state.branches[b].raceFactors[s]={};state.branches[b].hiddenSkills=state.branches[b].hiddenSkills||{};state.branches[b].hiddenSkills[s]={};state.branches[b].raceListOverrides=state.branches[b].raceListOverrides||{};state.branches[b].raceListOverrides[s]={added:{},removed:{}};core.save();core.renderSkillFactors();core.renderRaceFactors();core.renderTree();renderSupport();core.toast("このウマ娘の因子を削除しました")}
function installRedTypeEditor(){var b=core.getActiveBranch(),s=core.getActiveSlot();if(!s)return;var holder=document.querySelector(".sheet-stars");if(!holder)return;var old=document.getElementById("redFactorTypeWrap");if(old)old.remove();var wrap=document.createElement("label");wrap.id="redFactorTypeWrap";wrap.className="red-factor-type";wrap.innerHTML='赤因子<select id="redFactorTypeSelect">'+RED_TYPES.map(function(t){return'<option '+(state.branches[b].redTypes[s]===t?'selected':'')+'>'+t+'</option>'}).join('')+'</select>';holder.prepend(wrap);document.getElementById("redFactorTypeSelect").onchange=function(){state.branches[b].redTypes[s]=this.value;core.save();core.renderTree()}}

function targetSkill(name){state.targetBuild.skills[name]=state.targetBuild.skills[name]||{selected:false,hint:0};return state.targetBuild.skills[name]}
function statScore(v){v=Math.max(0,Number(v||0));for(var i=1;i<STAT_POINTS.length;i++){if(v<=STAT_POINTS[i][0]){var a=STAT_POINTS[i-1],b=STAT_POINTS[i],r=(v-a[0])/(b[0]-a[0]);return Math.round(a[1]+(b[1]-a[1])*r)}}var z=STAT_POINTS[STAT_POINTS.length-1];return Math.round(z[1]+(v-z[0])*12)}
function statusExamBonus(v){v=Number(v||0);return(v>=1000?3000:0)+(v>=1201?2000:0)+(v>=2001?1000:0)}
function uniqueScore(){var lv=state.targetBuild.uniqueLevel||1;return(state.targetBuild.starRarity>=3?170:120)*lv}
function totals(){
  var stat=0,statusBonus=0;Object.keys(state.targetBuild.stats).forEach(function(k){stat+=statScore(state.targetBuild.stats[k]);statusBonus+=statusExamBonus(state.targetBuild.stats[k])});
  var skill=0,skillBonus=0,cost=0,count=0,white=0,gold=0;
  Object.keys(state.targetBuild.skills).forEach(function(n){var x=state.targetBuild.skills[n],s=skillData(n);if(x&&x.selected&&s){var m=core.skillMetrics(s,x.hint);if(m.evaluation!=null){skill+=m.evaluation;skillBonus+=m.examBonus||0;cost+=m.cost||0;count++;if(s.grade==="gold"||s.grade==="evolved")gold++;else white++}}});
  var rc=state.targetBuild.raceCounts,raceBonus=Number(rc.g1||0)*100+Number(rc.g2||0)*70+Number(rc.g3||0)*50+Number(rc.op||0)*20;
  var evaluation=stat+skill+uniqueScore()+Number(state.targetBuild.extraEvaluation||0);
  var trial=evaluation+skillBonus+statusBonus+raceBonus+Number(state.targetBuild.trialBonus||0);
  return{stat:stat,statusBonus:statusBonus,skill:skill,skillBonus:skillBonus,cost:cost,count:count,white:white,gold:gold,raceBonus:raceBonus,total:evaluation,trial:trial};
}
function rankName(v){var base="G";for(var i=0;i<BASE_RANKS.length;i++){if(v>=BASE_RANKS[i][0])base=BASE_RANKS[i][1];else break}var idx=BASE_RANKS.findIndex(function(x){return x[1]===base});if(idx>=18&&idx<BASE_RANKS.length-1){var start=BASE_RANKS[idx][0],end=BASE_RANKS[idx+1][0],step=(end-start)/10,n=Math.min(9,Math.floor((v-start)/step));if(n>0)base+=n}return base}
function renderTargetStats(){var el=document.getElementById("targetStats");if(!el)return;var labels={speed:"スピード",stamina:"スタミナ",power:"パワー",guts:"根性",wisdom:"賢さ"};el.innerHTML=Object.keys(labels).map(function(k){return'<label>'+labels[k]+'<input data-target-stat="'+k+'" type="number" min="0" max="2500" value="'+state.targetBuild.stats[k]+'"><small>技能試験ステータス加点 '+statusExamBonus(state.targetBuild.stats[k]).toLocaleString("ja-JP")+'</small></label>'}).join('');document.querySelectorAll("[data-target-stat]").forEach(function(e){e.oninput=function(){state.targetBuild.stats[e.dataset.targetStat]=Number(e.value||0);core.save();renderTargetStats();renderTargetTotals()}})}
function renderTargetSkills(){
  var q=(document.getElementById("targetSkillSearch").value||"").trim().toLowerCase(),list=cfg.skillCatalog.filter(function(s){return!q||s.name.toLowerCase().indexOf(q)>=0||String(s.category||"").toLowerCase().indexOf(q)>=0});
  list.sort(function(a,b){var ax=targetSkill(a.name),bx=targetSkill(b.name);if(!!ax.selected!==!!bx.selected)return bx.selected?1:-1;return(core.skillMetrics(b,bx.hint).efficiency||0)-(core.skillMetrics(a,ax.hint).efficiency||0)});
  document.getElementById("targetSkillList").innerHTML=list.map(function(s){var x=targetSkill(s.name),m=core.skillMetrics(s,x.hint),grade=s.grade==="gold"?"金":(s.grade==="evolved"?"進化":"白"),estimated=s.estimatedEvaluation||!s.verifiedEvaluation;return'<div class="target-skill-row '+(x.selected?'selected ':'')+(s.grade==='gold'?'gold-row':'')+'"><label><input type="checkbox" data-target-skill="'+esc(s.name)+'" '+(x.selected?'checked':'')+'><span class="skill-grade '+String(s.grade||'white')+'">'+grade+'</span><span>'+esc(s.name)+'</span></label><button type="button" class="hint-level" data-hint-skill="'+esc(s.name)+'">ヒントLv'+x.hint+'</button><span class="target-skill-cost">SP '+(m.cost==null?'—':m.cost)+'</span><span class="target-skill-eff">技能 '+(m.efficiency==null?'—':m.efficiency.toFixed(2))+'</span><small>評価 '+(m.evaluation==null?'—':m.evaluation)+'＋固定 '+(m.examBonus||0)+(estimated?'・暫定値':'')+'</small></div>'}).join('');
  document.querySelectorAll("[data-target-skill]").forEach(function(e){e.onchange=function(){targetSkill(e.dataset.targetSkill).selected=e.checked;core.save();renderTargetSkills();renderTargetTotals();renderSupport()}});
  document.querySelectorAll("[data-hint-skill]").forEach(function(e){e.onclick=function(){var x=targetSkill(e.dataset.hintSkill);x.hint=(Number(x.hint||0)+1)%6;core.save();renderTargetSkills();renderTargetTotals()}});
}
function autoAllocate(){
  var budget=Math.max(0,Number(state.targetBuild.skillPoints||0)),items=cfg.skillCatalog.map(function(s){var x=targetSkill(s.name),m=core.skillMetrics(s,x.hint);return{name:s.name,cost:m.cost,value:m.examScore||0}}).filter(function(x){return x.cost>0&&x.value>0&&x.cost<=budget});
  var dp=new Int32Array(budget+1),pick=Array(budget+1).fill(null);items.forEach(function(it,idx){for(var w=budget;w>=it.cost;w--){var cand=dp[w-it.cost]+it.value;if(cand>dp[w]){dp[w]=cand;pick[w]={prev:w-it.cost,idx:idx}}}});
  var best=0;for(var w=1;w<=budget;w++)if(dp[w]>dp[best])best=w;Object.keys(state.targetBuild.skills).forEach(function(n){state.targetBuild.skills[n].selected=false});var seen={};while(best>0&&pick[best]){var p=pick[best],it=items[p.idx];if(!seen[it.name]){targetSkill(it.name).selected=true;seen[it.name]=1}best=p.prev}
  core.save();renderTargetSkills();renderTargetTotals();renderSupport();core.toast("所持SP内で技能試験ポイントが最大になる組合せを選びました");
}
function redChance(b){var br=state.branches[b],stars=Number(br.stars.parent||0),type=br.redTypes.parent||cfg.slots[b].target,p=stars?core.individualEstimate(b,"parent",stars,"skill"):0;return{name:core.selected(b,"parent")||"未選択",type:type,stars:stars,p:p}}
function renderInheritance(){var m=redChance("mile"),c=redChance("chase"),same=m.type===c.type,any=same?core.combineAtLeastOne(m.p,c.p):null,whites={};["mile","chase"].forEach(function(b){Object.keys(state.branches[b].skillFactors.parent||{}).forEach(function(n){var x=state.branches[b].skillFactors.parent[n];if(x&&x.stars)whites[n]=1})});var html='<div class="inherit-card"><b>赤因子</b><div>'+esc(m.name)+'：'+esc(m.type)+'★'+m.stars+' → '+m.p+'%</div><div>'+esc(c.name)+'：'+esc(c.type)+'★'+c.stars+' → '+c.p+'%</div>'+(same?'<strong>子が「'+esc(m.type)+'」を継承：'+any+'%</strong>':'<span>赤因子の種類が異なるため個別判定</span>')+'</div>';html+=Object.keys(whites).sort().slice(0,40).map(function(n){function p(b){var x=(state.branches[b].skillFactors.parent||{})[n];return x&&x.stars?core.individualEstimate(b,"parent",Number(x.stars),"skill"):0}var p1=p("mile"),p2=p("chase");return'<div class="inherit-card"><b>'+esc(n)+'</b><span>父 '+p1+'%／母 '+p2+'%</span><strong>少なくとも片方 '+core.combineAtLeastOne(p1,p2)+'%</strong></div>'}).join('');document.getElementById("targetInheritance").innerHTML=html}
function renderTargetTotals(){var t=totals();document.getElementById("estimatedEvaluation").textContent=t.total.toLocaleString("ja-JP");document.getElementById("estimatedRank").textContent=rankName(t.total);document.getElementById("estimatedTrialScore").textContent=t.trial.toLocaleString("ja-JP");document.getElementById("targetSkillTotals").innerHTML='<b>取得 '+t.count+'個（白'+t.white+'・金/進化'+t.gold+'）／消費 '+t.cost+'SP</b><br>通常評価：ステータス '+t.stat.toLocaleString("ja-JP")+'＋スキル '+t.skill.toLocaleString("ja-JP")+'<br>技能試験追加：スキル固定 '+t.skillBonus.toLocaleString("ja-JP")+'＋ステータス '+t.statusBonus.toLocaleString("ja-JP")+'＋レース '+t.raceBonus.toLocaleString("ja-JP")+'＋その他 '+Number(state.targetBuild.trialBonus||0).toLocaleString("ja-JP")}
function openTarget(){document.getElementById("targetBuildTitle").textContent=core.targetName();renderTargetStats();document.getElementById("uniqueSkillLevel").innerHTML=[1,2,3,4,5,6].map(function(n){return'<option '+(n===state.targetBuild.uniqueLevel?'selected':'')+'>'+n+'</option>'}).join('');document.getElementById("trialBonus").value=state.targetBuild.trialBonus;document.getElementById("extraEvaluation").value=state.targetBuild.extraEvaluation;document.getElementById("availableSkillPoints").value=state.targetBuild.skillPoints;document.getElementById("trialRaceG1").value=state.targetBuild.raceCounts.g1;document.getElementById("trialRaceG2").value=state.targetBuild.raceCounts.g2;document.getElementById("trialRaceG3").value=state.targetBuild.raceCounts.g3;document.getElementById("trialRaceOP").value=state.targetBuild.raceCounts.op;renderTargetSkills();renderTargetTotals();renderInheritance();document.getElementById("targetBuildSheet").classList.remove("hidden")}
function closeTarget(){document.getElementById("targetBuildSheet").classList.add("hidden")}
function bind(){
  var plan=document.getElementById("supportPlanTarget");if(plan)plan.onchange=function(){activePlanKey=this.value;var p=currentPlan();state.scenarioMode=p.scenario;core.save();renderSupport();core.renderSchedule();core.renderTree()};
  var scenario=document.getElementById("scenarioMode");if(scenario)scenario.onchange=function(){var p=currentPlan();p.scenario=this.value;state.scenarioMode=this.value;core.save();renderSupport();core.renderSchedule();core.renderTree()};
  var auto=document.getElementById("autoSupportDeckBtn");if(auto)auto.onclick=autoDeck;
  var add=document.getElementById("addSupportCardBtn");if(add)add.onclick=addSupport;
  var restore=document.getElementById("restoreSupportDataBtn");if(restore)restore.onclick=restoreLibrary;
  var clear=document.getElementById("clearNodeFactorsBtn");if(clear)clear.onclick=clearNodeFactors;
  var ss=document.getElementById("supportSearch");if(ss)ss.oninput=function(){supportSearch=this.value;renderCatalog()};
  var rf=document.getElementById("supportRarityFilter");if(rf)rf.onchange=function(){supportRarity=this.value;renderCatalog()};
  var tf=document.getElementById("supportTypeFilter");if(tf)tf.onchange=function(){supportType=this.value;renderCatalog()};
  var nf=document.getElementById("supportNeededOnly");if(nf)nf.onchange=function(){supportNeededOnly=this.checked;renderCatalog()};
  document.getElementById("autoDesignBtn").addEventListener("click",function(){setTimeout(distributeFactors,0)});
  document.addEventListener("click",function(e){if(e.target.closest("[data-target-node]"))openTarget();if(e.target.closest("[data-close-target]"))closeTarget();if(e.target.closest(".tree-node[data-slot]"))setTimeout(installRedTypeEditor,0)});
  document.getElementById("uniqueSkillLevel").onchange=function(){state.targetBuild.uniqueLevel=Number(this.value);core.save();renderTargetTotals()};
  document.getElementById("trialBonus").oninput=function(){state.targetBuild.trialBonus=Number(this.value||0);core.save();renderTargetTotals()};
  document.getElementById("extraEvaluation").oninput=function(){state.targetBuild.extraEvaluation=Number(this.value||0);core.save();renderTargetTotals()};
  document.getElementById("availableSkillPoints").oninput=function(){state.targetBuild.skillPoints=Number(this.value||0);core.save();renderTargetTotals()};
  [["trialRaceG1","g1"],["trialRaceG2","g2"],["trialRaceG3","g3"],["trialRaceOP","op"]].forEach(function(pair){document.getElementById(pair[0]).oninput=function(){state.targetBuild.raceCounts[pair[1]]=Number(this.value||0);core.save();renderTargetTotals()}});
  document.getElementById("targetSkillSearch").oninput=renderTargetSkills;document.getElementById("autoAllocateSkillsBtn").onclick=autoAllocate;document.getElementById("clearTargetSkillsBtn").onclick=function(){Object.keys(state.targetBuild.skills).forEach(function(n){state.targetBuild.skills[n].selected=false});core.save();renderTargetSkills();renderTargetTotals();renderSupport()};
}

ensureV31();renderSupport();bind();
})();
