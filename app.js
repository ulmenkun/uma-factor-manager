(function(){
"use strict";
var cfg=window.AUTO_FACTOR_DATA;
// このツールのレース一覧はG1/Jpn1のみ。全レースで因子★を選択できるよう正規化する。
(cfg.races||[]).forEach(function(r){r.hasFactor=true;if(!r.factorEffect)r.factorEffect="レース因子（効果未登録）"});
var KEY="uma-auto-factor-v31";
var PREV="uma-auto-factor-v29";
var state=load();
var activeBranch=state.activeBranch||"mile";
var activeSlot=null;
var activeSheetTab="candidate";
var activeFactorTab="skill";
var whitePickerCategory="直線・コーナー";
var whiteSort="efficiency";
var topWhiteCategory="直線・コーナー";
function clone(x){return JSON.parse(JSON.stringify(x))}
function allG(){var o={};["芝","ダート","短距離","マイル","中距離","長距離","逃げ","先行","差し","追込"].forEach(function(k){o[k]="G"});return o}
function defaultSelectedSkills(){var out={};cfg.skillCatalog.forEach(function(s){if(s.default)out[s.name]=true});return out}
function defaultState(){
  var target=cfg.targets.jetblack;
  return{
    version:"4.4",activeBranch:"mile",target:"jetblack",customTarget:"",
    initial:clone(target.initial),desired:clone(target.desired),
    selectedSkills:defaultSelectedSkills(),onlyOwned:false,owned:{},compatDirtFocus:true,
    branches:{
      mile:{selection:{},stars:{},redTypes:{},skillFactors:{},hiddenSkills:{},raceFactors:{},raceListOverrides:{},races:{},compat:{}},
      chase:{selection:{},stars:{},redTypes:{},skillFactors:{},hiddenSkills:{},raceFactors:{},raceListOverrides:{},races:{},compat:{}}
    },
    scenarioMode:"character",lastSaved:null,lastImport:null
  };
}
function deepMerge(base,incoming){Object.keys(incoming||{}).forEach(function(k){if(incoming[k]&&typeof incoming[k]==="object"&&!Array.isArray(incoming[k])&&base[k]&&typeof base[k]==="object"&&!Array.isArray(base[k]))deepMerge(base[k],incoming[k]);else base[k]=incoming[k]});return base}
function migrate(old){
  var fresh=defaultState();
  ["activeBranch","target","customTarget","initial","desired","onlyOwned","owned","scenarioMode"].forEach(function(k){if(old[k]!==undefined)fresh[k]=old[k]});
  ["mile","chase"].forEach(function(b){
    if(old.branches&&old.branches[b]){
      fresh.branches[b].selection=old.branches[b].selection||{};
      fresh.branches[b].stars=old.branches[b].stars||{};
      fresh.branches[b].redTypes=old.branches[b].redTypes||{};
      fresh.branches[b].races=old.branches[b].races||{};
      fresh.branches[b].raceFactors=old.branches[b].raceFactors||{};
      fresh.branches[b].raceListOverrides=old.branches[b].raceListOverrides||{};
      fresh.branches[b].skillFactors=old.branches[b].skillFactors||fresh.branches[b].skillFactors;
      fresh.branches[b].hiddenSkills=old.branches[b].hiddenSkills||{};
      fresh.branches[b].compat=old.branches[b].compat||{};
      if(old.branches[b].white){Object.keys(old.branches[b].white).forEach(function(slot){fresh.branches[b].skillFactors[slot]=old.branches[b].white[slot]})}
    }
  });
  if(old.whiteOverrides)Object.keys(old.whiteOverrides).forEach(function(name){fresh.selectedSkills[name]=old.whiteOverrides[name]});
  if(old.selectedSkills)Object.keys(old.selectedSkills).forEach(function(name){fresh.selectedSkills[name]=old.selectedSkills[name]});
  return fresh;
}
function load(){try{var raw=localStorage.getItem(KEY);if(raw)return deepMerge(defaultState(),JSON.parse(raw));var prev=localStorage.getItem(PREV);if(prev)return migrate(JSON.parse(prev))}catch(e){}return defaultState()}
function applyNewCatalogDefaults(){cfg.skillCatalog.forEach(function(s){if(s.default&&state.selectedSkills[s.name]===undefined)state.selectedSkills[s.name]=true})}
function applyV26Corrections(){state.corrections=state.corrections||{};if(!state.corrections.v26){if(state.target==="jetblack"){if(state.initial["先行"]==="B")state.initial["先行"]="A";if(state.desired["先行"]==="B")state.desired["先行"]="A"}state.corrections.v26=true}}
function applyV27Corrections(){state.corrections=state.corrections||{};if(!state.corrections.v27){if(state.target==="jetblack"){state.initial["先行"]="A";state.desired["先行"]="A"}state.corrections.v27=true}}
function save(show){state.version="4.4";state.compatDirtFocus=true;state.activeBranch=activeBranch;state.lastSaved=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(state));renderStorageInfo();var e=document.getElementById("saveState");if(e){e.textContent="保存済み";clearTimeout(save.t);save.t=setTimeout(function(){e.textContent="自動保存"},900)}if(show)toast(show)}
function toast(msg){var e=document.getElementById("toast");e.textContent=msg;e.classList.remove("hidden");clearTimeout(toast.t);toast.t=setTimeout(function(){e.classList.add("hidden")},1800)}
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function gv(g){return cfg.ranks.indexOf(g)}
function up(stars){return stars>=10?4:stars>=7?3:stars>=4?2:stars>=1?1:0}
function resultRank(base,stars){return cfg.ranks[Math.min(gv(base)+up(stars),cfg.ranks.length-1)]}
function displayCategory(s){var n=s.name||"",c=s.category||"",tags=s.tags||[];if(c.indexOf("デバフ")>=0||tags.indexOf("デバフ")>=0||/(けん制|焦り|ためらい|駆け引き|束縛|ささやき|布石|イーター|目くらまし|かく乱|まなざし|抜け駆け禁止|後方釘付|トリック)/.test(n))return"デバフ";if(/(直線○|コーナー○)$/.test(n)&&/(短距離|マイル|中距離|長距離|ダート|逃げ|先行|差し|追込)/.test(n))return"直線・コーナー";if(c.indexOf("緑")>=0||tags.indexOf("緑")>=0||c==="レース場"||c==="回り"||c==="季節"||c==="バ場"||c==="距離条件"||c==="天候")return"緑○";return"その他高効率"}
function compatibilityDefault(b,slot){var n=selected(b,slot),prefs=cfg.slots[b].nodes[slot].prefs||[],i=prefs.indexOf(n);return i===0?32:i===1?28:i===2?24:i>=0?20:16}
function baseCompatibility(b,slot){state.branches[b].compat=state.branches[b].compat||{};var v=state.branches[b].compat[slot];return(v===undefined||v===null||v==="")?compatibilityDefault(b,slot):Number(v)}
function raceWinsFromFactors(b,slot){var rf=(state.branches[b].raceFactors&&state.branches[b].raceFactors[slot])||{},seen={};return Object.keys(rf).filter(function(id){return rf[id]&&(rf[id].won||Number(rf[id].stars)>0)}).map(function(id){var r=cfg.races.find(function(x){return x.id===id});return r?r.name:null}).filter(function(n){if(!n||seen[n])return false;seen[n]=1;return true})}
function childSlot(slot){if(slot==="a1"||slot==="a2")return"gp1";if(slot==="a3"||slot==="a4")return"gp2";if(slot==="gp1"||slot==="gp2")return"parent";return"target"}
function childRaceWins(b,slot){var c=childSlot(slot);return c==="target"?targetWonRaceNames(b):raceWinsFromFactors(b,c)}
function directG1Bonus(b,slot){return pairBonus(raceWinsFromFactors(b,slot),childRaceWins(b,slot))}
function stageG1Bonus(b,slot){if(slot==="parent")return pairBonus(raceWinsFromFactors(b,"gp1"),raceWinsFromFactors(b,"gp2"));if(slot==="gp1")return pairBonus(raceWinsFromFactors(b,"a1"),raceWinsFromFactors(b,"a2"));if(slot==="gp2")return pairBonus(raceWinsFromFactors(b,"a3"),raceWinsFromFactors(b,"a4"));return 0}
function compatibilityTotal(b,slot){return baseCompatibility(b,slot)+directG1Bonus(b,slot)}
function sourceSlots(slot){if(slot==="parent")return["gp1","gp2"];if(slot==="gp1")return["a1","a2"];if(slot==="gp2")return["a3","a4"];return[]}
function individualEstimate(b,slot,stars,type){if(!stars)return 0;var base=type==="race"?[0,1,2,3][stars]:[0,3,6,9][stars];var bonus=compatibilityTotal(b,slot);return Math.min(99,Math.round(base*(1+bonus/100)*10)/10)}
function combineAtLeastOne(p1,p2){return Math.round((1-(1-p1/100)*(1-p2/100))*1000)/10}
function combineBoth(p1,p2){return Math.round((p1/100)*(p2/100)*1000)/10}
function combinedForChild(b,child,factorKey,type){var src=sourceSlots(child);if(src.length!==2)return null;function starsFor(slot){if(type==="race"){var x=(state.branches[b].raceFactors[slot]||{})[factorKey];return x?Number(x.stars||0):0}var y=(state.branches[b].skillFactors[slot]||{})[factorKey];return y?Number(y.stars||0):0}var s1=starsFor(src[0]),s2=starsFor(src[1]),p1=individualEstimate(b,src[0],s1,type),p2=individualEstimate(b,src[1],s2,type);return{p1:p1,p2:p2,any:combineAtLeastOne(p1,p2),both:combineBoth(p1,p2),sources:src}}
function effClass(v){return v>=2?"":v>=1.5?"mid":"low"}
function targetName(){return state.target==="custom"?(state.customTarget||"自由入力ウマ娘"):(cfg.targets[state.target]?cfg.targets[state.target].name:"育成ウマ娘")}
function targetBaseName(){var n=targetName();return n.indexOf("シンボリクリスエス")>=0?"シンボリクリスエス":n.replace(/^\[[^\]]+\]\s*/,"")}
function skillMultiplier(s){var t=s.aptitudeType;if(!t)return 1;var r=state.desired[t]||"G";return(r==="A"||r==="S"?1.1:(r==="B"||r==="C"?0.9:(r==="G"?0.7:0.8)))}
function skillMetrics(s,hintLevel){var has=Number.isFinite(Number(s.evaluation))&&Number(s.sp)>0,m=skillMultiplier(s),h=Math.max(0,Math.min(5,Number(hintLevel||0))),discount=[1,.9,.8,.7,.65,.6][h];if(!has)return{evaluation:null,ratingEfficiency:null,examBonus:Number(s&&s.examBonus||0),examScore:null,efficiency:null,cost:null,multiplier:m,verified:false};var adjusted=Math.round(Number(s.evaluation)*m),cost=Math.max(1,Math.floor(Number(s.sp)*discount)),bonus=Number(s.examBonus!==undefined?s.examBonus:(s.grade==="gold"?1200:(s.grade==="evolved"?1500:400)));if(s.noAdditionalExamBonus||/◎$/.test(String(s.name||"")))bonus=0;var exam=adjusted+bonus,eff=Math.round(exam/cost*100)/100,rate=Math.round(adjusted/cost*100)/100;return{evaluation:adjusted,ratingEfficiency:rate,examBonus:bonus,examScore:exam,efficiency:eff,cost:cost,multiplier:m,verified:!!s.verifiedEvaluation}}
function efficiencyClass(v){return v>=2?"good":v>=1.5?"":"estimated"}
function timeKey(r){return r.phase+"|"+r.time}
function selectedRaceObjects(b){var ids=state.branches[b].races||{};return cfg.races.filter(function(r){return!!ids[r.id]})}
function goalFor(name,r){var g=cfg.goalTurns&&cfg.goalTurns[name];return g?g[timeKey(r)]:null}
function blockedReason(name,r){if(!name)return"候補未選択";if(state.scenarioMode==="none"||state.scenarioMode==="make_new_track")return"";if(state.scenarioMode==="beyond"&&r.phase==="シニア級"&&r.time==="11月前半")return"BEYOND DREAMSのBC固定レース";var goal=goalFor(name,r);if(goal&&goal!==r.name)return"育成目標「"+goal+"」と同ターン";return""}
function nodeWonRaceNames(b,slot){return raceWinsFromFactors(b,slot)}
function targetWonRaceNames(b){var n=targetBaseName(),seen={};return selectedRaceObjects(b).filter(function(r){return targetCanRace(r)&&!blockedReason(n,r)}).map(function(r){return r.name}).filter(function(x){if(seen[x])return false;seen[x]=true;return true})}
function intersectCount(a,b){var s={};a.forEach(function(x){s[x]=1});return b.filter(function(x){return s[x]}).length}
function pairBonus(a,b){return intersectCount(a,b)*3}
function stageBonus(b,slot){return stageG1Bonus(b,slot)}
function finalG1Bonus(){return pairBonus(raceWinsFromFactors("mile","parent"),raceWinsFromFactors("chase","parent"))}
function finalBaseCompatibility(){return baseCompatibility("mile","parent")+baseCompatibility("chase","parent")}
function finalCompatibilityTotal(){return finalBaseCompatibility()+finalG1Bonus()}
function bonusClass(v){return v>=90?"high":v>=45?"mid":""}
function selected(b,s){return state.branches[b].selection[s]||""}
function star(b,s){return Number(state.branches[b].stars[s]||0)}
function others(b,s){return Object.keys(state.branches[b].selection).filter(function(k){return k!==s}).map(function(k){return state.branches[b].selection[k]}).filter(Boolean)}
function aptitudeOf(name,type){var c=cfg.familyCharacters[name];if(!c)return"G";if(type==="芝"||type==="ダート")return(c.surface||{})[type]||"G";if(["短距離","マイル","中距離","長距離"].indexOf(type)>=0)return(c.distance||{})[type]||"G";return(c.style||{})[type]||"G"}
function starsNeeded(from,to){var gap=Math.max(0,gv(to)-gv(from));return gap===0?0:gap===1?1:gap===2?4:gap===3?7:gap===4?10:Infinity}
function ensureRedTypes(){["mile","chase"].forEach(function(b){var br=state.branches[b];br.redTypes=br.redTypes||{};["parent","gp1","gp2","a1","a2","a3","a4"].forEach(function(s){if(!br.redTypes[s])br.redTypes[s]=cfg.slots[b].target})})}
function redType(b,s){ensureRedTypes();return state.branches[b].redTypes[s]||cfg.slots[b].target}
function inheritedVisibleSlots(slot){if(slot==="parent")return["gp1","gp2","a1","a2","a3","a4"];if(slot==="gp1")return["a1","a2"];if(slot==="gp2")return["a3","a4"];return[]}
function inheritedVisibleStars(b,slot,type){return inheritedVisibleSlots(slot).reduce(function(t,s){return t+(redType(b,s)===type?star(b,s):0)},0)}
function projectedRank(b,slot,type){var n=selected(b,slot);return resultRank(aptitudeOf(n,type),inheritedVisibleStars(b,slot,type))}
function raceReadyRanks(groundRank,distanceRank,r){var groundMin=r.ground==="ダート"?"D":"B",distMin="B";return gv(groundRank)>=gv(groundMin)&&gv(distanceRank)>=gv(distMin)}
function canRace(name,r){var c=cfg.familyCharacters[name];if(!c)return false;var gr=(c.surface||{})[r.ground]||"G",dr=(c.distance||{})[r.distance]||"G";return raceReadyRanks(gr,dr,r)}
function canRaceSlot(b,slot,r){var n=selected(b,slot);if(!n)return false;return raceReadyRanks(projectedRank(b,slot,r.ground),projectedRank(b,slot,r.distance),r)}
function targetCanRace(r){var groundMin=r.ground==="ダート"?"D":"B";return gv(state.initial[r.ground]||"G")>=gv(groundMin)&&gv(state.initial[r.distance]||"G")>=gv("B")}
function coverage(name){var c=cfg.familyCharacters[name];if(!c)return 0;var s=0;["マイル","中距離","長距離"].forEach(function(k){var v=gv(c.distance[k]);s+=v>=gv("A")?8:v>=gv("B")?6:v>=gv("C")?3:0});var d=gv(c.surface["ダート"]||"G");if(d>=gv("B"))s+=10;else if(d>=gv("D"))s+=5;return s}
function redFeasibilityScore(name,type){var r=aptitudeOf(name,type),v=gv(r);if(v>=gv("A"))return 22;if(v===gv("B"))return 17;if(v===gv("C"))return 10;if(v===gv("D"))return 4;if(v===gv("E"))return -2;return -18}
function candidateScore(b,slot,name){var c=cfg.familyCharacters[name],def=cfg.slots[b].nodes[slot];if(!c)return-999;if(state.onlyOwned&&!state.owned[name])return-999;var i=def.prefs.indexOf(name),score=i>=0?100-i*9:45;if(slot==="parent"&&i===0)score+=70;score+=coverage(name);var rt=redType(b,slot),rr=aptitudeOf(name,rt),rv=gv(rr);score+=redFeasibilityScore(name,rt);/* 祖父母・曾祖父母は、その個体自身が指定された赤因子を作れることを優先。A未満なら必要な追加赤因子ぶん減点 */if(slot!=="parent"){var rn=starsNeeded(rr,"A");score-=rn===0?0:rn===1?15:rn===4?35:rn===7?60:rn===10?90:120}/* 曾祖父でダート赤を作る場合は、表示外のさらに上の親に頼らなくて済むよう自然ダートA/Bを強く優先 */if(rt==="ダート"){score+=rv>=gv("A")?38:rv>=gv("B")?28:rv>=gv("C")?14:rv>=gv("D")?5:rv===gv("E")?-12:-38}var d=gv((c.surface||{})["ダート"]||"G");score+=d>=gv("B")?14:d>=gv("D")?8:d===gv("E")?3:-6;if(b==="chase"&&gv((c.style||{})["追込"]||"G")>=gv("A"))score+=10;if(b==="mile"&&gv((c.distance||{})["マイル"]||"G")>=gv("A"))score+=8;if(state.owned[name])score+=8;if(others(b,slot).indexOf(name)>=0)score-=120;return score}
function candidateList(b,slot){return Object.keys(cfg.familyCharacters).map(function(n){return{name:n,score:candidateScore(b,slot,n)}}).filter(function(x){return x.score>-900}).sort(function(a,z){return z.score-a.score})}
function best(b,slot){var x=candidateList(b,slot);return x.length?x[0].name:""}
function setRed(b,slot,type,stars){ensureRedTypes();state.branches[b].redTypes[slot]=type;state.branches[b].stars[slot]=stars}
function coreTargetMinimum(type){if(state.target==="jetblack"){if(type==="マイル")return"A";if(type==="追込")return"B"}return null}
function finalTargetRedStars(type){
  return [["mile","parent"],["mile","gp1"],["mile","gp2"],["chase","parent"],["chase","gp1"],["chase","gp2"]].reduce(function(total,x){
    return total+(redType(x[0],x[1])===type?star(x[0],x[1]):0);
  },0);
}
function targetRedPlan(){ensureRedTypes();var t1=cfg.slots.mile.target,t2=cfg.slots.chase.target;var bestPlan=null,validPlan=null,min1=coreTargetMinimum(t1),min2=coreTargetMinimum(t2);for(var n1=0;n1<=6;n1++){var n2=6-n1,s1=n1*3,s2=n2*3,r1=resultRank(state.initial[t1]||"G",s1),r2=resultRank(state.initial[t2]||"G",s2),w1=["短距離","マイル","中距離","長距離"].indexOf(t1)>=0?3:2,w2=["短距離","マイル","中距離","長距離"].indexOf(t2)>=0?3:2,score=(gv(r1)-gv(state.initial[t1]||"G"))*w1+(gv(r2)-gv(state.initial[t2]||"G"))*w2+(r1==="A"?4:0)+(r2==="A"?4:0),ok=(!min1||gv(r1)>=gv(min1))&&(!min2||gv(r2)>=gv(min2)),plan={n1:n1,n2:n2,t1:t1,t2:t2,r1:r1,r2:r2,score:score,hardOk:ok};if(!bestPlan||score>bestPlan.score)bestPlan=plan;if(ok&&(!validPlan||score>validPlan.score))validPlan=plan}return validPlan||bestPlan}
function applyFinalRedPlan(){var p=targetRedPlan(),slots=["mile:parent","chase:parent","mile:gp1","mile:gp2","chase:gp1","chase:gp2"],assigned={};setRed("mile","parent",p.t1,3);assigned["mile:parent"]=p.t1;setRed("chase","parent",p.t2,3);assigned["chase:parent"]=p.t2;var rem1=Math.max(0,p.n1-1),rem2=Math.max(0,p.n2-1),gps=["mile:gp1","mile:gp2","chase:gp1","chase:gp2"];gps.forEach(function(key){var a=key.split(":"),type=rem1>0?p.t1:p.t2;if(rem1>0)rem1--;else rem2--;setRed(a[0],a[1],type,3);assigned[key]=type});return p}
function requiredParentForBranch(b){if(state.target!=="jetblack")return"";return b==="mile"?"ラインクラフト":"ステイゴールド"}
function chooseParentForPlan(b){var req=requiredParentForBranch(b);if(req&&cfg.familyCharacters[req]&&(!state.onlyOwned||state.owned[req]))return req;return best(b,"parent")}
function planAncestorRedsForParent(b){var parent=selected(b,"parent");if(!parent)return;var ownType=redType(b,"parent"),free=["a1","a2","a3","a4"],gpOwn=(redType(b,"gp1")===ownType?star(b,"gp1"):0)+(redType(b,"gp2")===ownType?star(b,"gp2"):0),gpDirt=(redType(b,"gp1")==="ダート"?star(b,"gp1"):0)+(redType(b,"gp2")==="ダート"?star(b,"gp2"):0),needDirt=ownType!=="ダート",chosen=null;
  if(ownType==="ダート"){free.forEach(function(s){setRed(b,s,"ダート",3)});return}
  for(var dirtCount=0;dirtCount<=free.length;dirtCount++){var ownCount=free.length-dirtCount,ownStars=gpOwn+ownCount*3,dirtStars=gpDirt+dirtCount*3,ownRank=resultRank(aptitudeOf(parent,ownType),ownStars),dirtRank=resultRank(aptitudeOf(parent,"ダート"),dirtStars),okOwn=gv(ownRank)>=gv("A"),okDirt=!needDirt||gv(dirtRank)>=gv("D");if(okOwn&&okDirt){chosen={dirtCount:dirtCount,ownCount:ownCount};break}}
  if(!chosen){var bestFallback=null;for(var d=0;d<=free.length;d++){var o=free.length-d,or=resultRank(aptitudeOf(parent,ownType),gpOwn+o*3),dr=resultRank(aptitudeOf(parent,"ダート"),gpDirt+d*3),score=gv(or)*10+(needDirt?gv(dr):0);if(!bestFallback||score>bestFallback.score)bestFallback={dirtCount:d,ownCount:o,score:score}}chosen=bestFallback}
  var idx=0;for(var i=0;i<chosen.ownCount;i++)setRed(b,free[idx++],ownType,3);while(idx<free.length)setRed(b,free[idx++],"ダート",3)
}
function parentPlanStatus(b){var parent=selected(b,"parent");if(!parent)return null;var ownType=redType(b,"parent"),ownRank=projectedRank(b,"parent",ownType),dirtRank=projectedRank(b,"parent","ダート"),req=requiredParentForBranch(b),nameOk=!req||parent===req,ownOk=gv(ownRank)>=gv("A"),dirtOk=gv(dirtRank)>=gv("D");return{parent:parent,required:req,nameOk:nameOk,ownType:ownType,ownRank:ownRank,dirtRank:dirtRank,ownOk:ownOk,dirtOk:dirtOk,ok:nameOk&&ownOk&&dirtOk}}
function corePlanStatus(){var t1=cfg.slots.mile.target,t2=cfg.slots.chase.target,r1=resultRank(state.initial[t1]||"G",finalTargetRedStars(t1)),r2=resultRank(state.initial[t2]||"G",finalTargetRedStars(t2)),min1=coreTargetMinimum(t1),min2=coreTargetMinimum(t2),targetOk=(!min1||gv(r1)>=gv(min1))&&(!min2||gv(r2)>=gv(min2)),m=parentPlanStatus("mile"),c=parentPlanStatus("chase");return{targetOk:targetOk,t1:t1,r1:r1,min1:min1,t2:t2,r2:r2,min2:min2,mile:m,chase:c,ok:targetOk&&(!m||m.ok)&&(!c||c.ok)}}
function rebuildBranchWithPlan(b){state.branches[b].selection.parent=chooseParentForPlan(b);planAncestorRedsForParent(b);["gp1","gp2","a1","a2","a3","a4"].forEach(function(s){state.branches[b].selection[s]=best(b,s)});planAncestorRedsForParent(b);["gp1","gp2","a1","a2","a3","a4"].forEach(function(s){state.branches[b].selection[s]=best(b,s)})}
function autoDesignAll(){ensureRedTypes();var plan=applyFinalRedPlan();rebuildBranchWithPlan("mile");rebuildBranchWithPlan("chase");/* 候補選択後にもう一度必須赤因子を確定し、その赤因子に合う曾祖父母を再選定 */["mile","chase"].forEach(function(b){planAncestorRedsForParent(b);["a1","a2","a3","a4"].forEach(function(s){state.branches[b].selection[s]=best(b,s)})});applyCommonParentRotation();var st=corePlanStatus();save(st.ok?"クリスエスのマイルA・追込B＋両親ダートDを満たす家系図に組み直しました":"必須条件を満たせない箇所があります。所持縛り・候補を確認してください");return plan}
function rebuild(b,start){ensureRedTypes();var order=["parent","gp1","gp2","a1","a2","a3","a4"],idx=Math.max(0,order.indexOf(start||"parent"));for(var i=idx;i<order.length;i++){var s=order[i];state.branches[b].selection[s]=best(b,s);if(state.branches[b].stars[s]===undefined)state.branches[b].stars[s]=3}save()}
function ensure(){ensureRedTypes();if(!state.branches.mile.selection.parent&&!state.branches.chase.selection.parent)autoDesignAll();else["mile","chase"].forEach(function(b){if(!state.branches[b].selection.parent)rebuild(b,"parent")})}
function skillByName(n){return cfg.skillCatalog.find(function(s){return s.name===n})}
function selectedSkillNames(){return Object.keys(state.selectedSkills).filter(function(n){var x=skillByName(n);return state.selectedSkills[n]&&x&&x.factorEligible!==false}).sort(function(a,b){return skillByName(b).priority-skillByName(a).priority})}
function renderTargets(){var e=document.getElementById("targetCharacter");e.innerHTML=Object.keys(cfg.targets).map(function(id){return'<option value="'+id+'" '+(state.target===id?"selected":"")+'>'+esc(cfg.targets[id].name)+'</option>'}).join("")+'<option value="custom" '+(state.target==="custom"?"selected":"")+'>自由入力</option>';document.getElementById("targetNameSuggestions").innerHTML=Object.keys(cfg.targets).map(function(id){return'<option value="'+esc(cfg.targets[id].name)+'">'}).join("");var c=document.getElementById("customTargetName");c.value=state.customTarget;c.classList.toggle("hidden",state.target!=="custom")}
function chooseTarget(id){state.target=id;if(id==="custom"){state.initial=allG();state.desired=allG()}else{state.initial=clone(cfg.targets[id].initial);state.desired=clone(cfg.targets[id].desired||cfg.targets[id].initial)}save();renderTargets();renderAptitudes();renderTree();renderSchedule()}
function renderAptitudes(){var keys=["芝","ダート","短距離","マイル","中距離","長距離","逃げ","先行","差し","追込"];function opts(v){return cfg.ranks.map(function(r){return'<option '+(r===v?"selected":"")+'>'+r+'</option>'}).join("")}document.getElementById("aptitudeGrid").innerHTML=keys.map(function(k){return'<div class="aptitude-row"><b>'+k+'</b><select data-ap="initial" data-key="'+k+'">'+opts(state.initial[k])+'</select><span>→</span><select data-ap="desired" data-key="'+k+'">'+opts(state.desired[k])+'</select></div>'}).join("");document.querySelectorAll("[data-ap]").forEach(function(e){e.addEventListener("change",function(){state[e.dataset.ap][e.dataset.key]=e.value;save();renderSelectedSkills();renderTree();renderSchedule()})})}
function whiteCategories(){return["直線・コーナー","デバフ","緑○","その他高効率"]}
function groupedSkills(){var groups={};whiteCategories().forEach(function(g){groups[g]=[]});selectedSkillNames().forEach(function(n){var s=skillByName(n),g=displayCategory(s);groups[g].push(s)});return groups}
function renderDataStatus(){var e=document.getElementById("dataStatus");if(!e)return;e.innerHTML='<strong>スキルデータ確認日：'+esc(cfg.dataVersion||"")+'</strong>登録スキル '+cfg.skillCatalog.length+'件。効率は（適性補正後の基礎評価点＋技能試験スキルボーナス）÷実消費SP。未確認値は『暫定』と表示。'}
function renderSelectedSkills(){var names=selectedSkillNames(),groups=groupedSkills(),cats=whiteCategories();document.getElementById("whiteSelectionSummary").innerHTML='<b>'+names.length+'個を選択中</b>　数値は技能試験効率（白スキル固定400点込み）。';document.getElementById("topWhiteCategoryTabs").innerHTML=cats.map(function(g){return'<button type="button" class="top-white-tab '+(topWhiteCategory===g?"active":"")+'" data-top-white-cat="'+esc(g)+'">'+esc(g)+'<small>'+groups[g].length+'個</small></button>'}).join("");document.querySelectorAll("[data-top-white-cat]").forEach(function(e){e.addEventListener("click",function(){topWhiteCategory=e.dataset.topWhiteCat;renderSelectedSkills()})});var list=groups[topWhiteCategory].slice().sort(function(a,b){return(skillMetrics(b).efficiency??-1)-(skillMetrics(a).efficiency??-1)});document.getElementById("whiteFactorGroups").innerHTML=list.length?list.map(function(s){var m=skillMetrics(s),eff=m.efficiency;return'<label class="top-skill-chip" title="'+esc(s.name)+'"><input type="checkbox" data-skill-chip="'+esc(s.name)+'" checked><span class="top-skill-name">'+esc(s.name)+'</span><span class="top-skill-eff '+effClass(eff)+'">'+(eff==null?'—':eff.toFixed(2))+'</span></label>'}).join(""):'<div class="top-white-empty">この区分で選択中の白因子はありません。</div>';document.querySelectorAll("[data-skill-chip]").forEach(function(e){e.addEventListener("change",function(){state.selectedSkills[e.dataset.skillChip]=false;save();renderSelectedSkills()})})}
function branchTotal(b){return["gp1","gp2","a1","a2","a3","a4"].reduce(function(t,s){return t+star(b,s)},0)}
function finalStars(b){return["parent","gp1","gp2"].reduce(function(t,s){return t+star(b,s)},0)}
function nodeAssignedCount(b,slot){var x=state.branches[b].skillFactors[slot]||{};return Object.keys(x).filter(function(k){return x[k].assigned}).length}
function nodeHtml(b,slot,kind){var n=selected(b,slot)||"未選択",count=nodeAssignedCount(b,slot),base=baseCompatibility(b,slot),g1=stageG1Bonus(b,slot),total=base+g1,rt=redType(b,slot),rs=star(b,slot),dirt=n?projectedRank(b,slot,"ダート"):"-",upBadge="";if(slot==="gp1"||slot==="gp2"){var upPlan=grandparentUpstreamDirtPlan(b,slot);if(upPlan)upBadge='<span class="node-upstream-dirt">自身ダートD：表示外 '+upPlan.missing+'★</span>'}return'<button type="button" class="tree-node '+kind+'" data-slot="'+slot+'"><span class="node-role">'+cfg.slots[b].nodes[slot].role+'</span><span class="node-name">'+esc(n)+'</span><span class="node-meta"><span class="node-star">赤 '+esc(rt)+' '+rs+'★</span><span class="node-score '+(count?"best":"")+'">因子'+count+'</span></span><span class="node-aptitude-mini">開始ダート '+dirt+'</span>'+upBadge+((slot!=="parent"&&redType(b,slot)==="ダート"&&star(b,slot)>0)?'<span class="node-dirt-source">親ダート用 +'+star(b,slot)+'★</span>':'')+'<span class="node-compat '+(total>=70?"high":total>=45?"mid":"")+'">相'+base+'＋G1 '+g1+'＝'+total+'</span></button>'}
function parentRotationSummary(b){var n=selected(b,"parent");if(!n)return null;var own=redType(b,"parent"),dirtStars=inheritedVisibleStars(b,"parent","ダート"),ownStars=inheritedVisibleStars(b,"parent",own),dirt=projectedRank(b,"parent","ダート"),ownRank=projectedRank(b,"parent",own);return{name:n,own:own,dirtStars:dirtStars,ownStars:ownStars,dirt:dirt,ownRank:ownRank}}
function parentDirtRequirement(b){
  var parent=selected(b,"parent");if(!parent)return null;
  var base=aptitudeOf(parent,"ダート"),required=starsNeeded(base,"D"),slots=inheritedVisibleSlots("parent");
  var entries=slots.map(function(slot){var type=redType(b,slot),stars=star(b,slot),dirt=type==="ダート"?stars:0;return{slot:slot,role:cfg.slots[b].nodes[slot].role,name:selected(b,slot)||"未選択",type:type,stars:stars,dirt:dirt}});
  var current=entries.reduce(function(t,x){return t+x.dirt},0),rank=resultRank(base,current),missing=isFinite(required)?Math.max(0,required-current):Infinity,surplus=isFinite(required)?Math.max(0,current-required):0;
  return{parent:parent,base:base,target:"D",required:required,current:current,missing:missing,surplus:surplus,rank:rank,entries:entries};
}
function parentDirtRequirementHtml(b){
  var x=parentDirtRequirement(b);if(!x)return"";
  var req=isFinite(x.required)?x.required+"★":"算出不可",status=x.missing===0?'<span class="dirt-need-ok">条件達成</span>':'<span class="dirt-need-ng">あと'+x.missing+'★必要</span>';
  var rows=x.entries.map(function(e){var isDirt=e.dirt>0,cls=isDirt?' dirt-source':'',factor=e.stars?esc(e.type)+' '+e.stars+'★':'赤因子なし';return'<div class="dirt-source-row'+cls+'"><span class="dirt-source-role">'+esc(e.role)+'</span><span class="dirt-source-name">'+esc(e.name)+'</span><span class="dirt-source-factor">'+factor+(isDirt?' <b>→ダート+'+e.dirt+'★</b>':'')+'</span></div>'}).join('');
  var note=x.missing===0?(x.surplus?'<small>最低'+req+'に対して現在'+x.current+'★（余裕'+x.surplus+'★）。この6因子のうちダート担当の合計で開始時ダート'+x.rank+'になります。</small>':'<small>最低必要数ちょうどです。この6因子のダート合計で開始時ダート'+x.rank+'になります。</small>'):'<small>この6因子のどれかをダートへ変更して、合計'+req+'以上にしてください。★3中心なら必要枠数の目安は'+Math.ceil(x.required/3)+'枠です。</small>';
  return'<div class="dirt-requirement-card"><div class="dirt-requirement-head"><b>'+esc(x.parent)+'をダートDで育成する内訳</b>'+status+'</div><div class="dirt-requirement-summary">自然ダート <strong>'+x.base+'</strong> → Dに最低 <strong>'+req+'</strong> ／ 現在 <strong>'+x.current+'★</strong> → <strong>'+x.rank+'</strong></div><div class="dirt-source-grid">'+rows+'</div>'+note+'</div>';
}
function commonProjectedRaces(){var seen={};return cfg.races.filter(function(r){if(seen[r.name])return false;var a=selected("mile","parent"),z=selected("chase","parent");if(!a||!z)return false;var ok=canRaceSlot("mile","parent",r)&&canRaceSlot("chase","parent",r)&&!blockedReason(a,r)&&!blockedReason(z,r);if(ok)seen[r.name]=1;return ok})}

function grandparentUpstreamDirtPlan(b,gpSlot){
  var gp=selected(b,gpSlot);if(!gp)return null;
  var parentSlots=gpSlot==="gp1"?["a1","a2"]:["a3","a4"],base=aptitudeOf(gp,"ダート"),required=starsNeeded(base,"D");
  if(!isFinite(required))required=12;
  var visible=parentSlots.map(function(slot){var type=redType(b,slot),stars=star(b,slot),dirt=type==="ダート"?stars:0;return{slot:slot,name:selected(b,slot)||"未選択",type:type,stars:stars,dirt:dirt}}),current=visible.reduce(function(t,x){return t+x.dirt},0),missing=Math.max(0,required-current);
  var hidden=[];visible.forEach(function(v){hidden.push({owner:v.name,label:v.name+"側の親①",stars:0});hidden.push({owner:v.name,label:v.name+"側の親②",stars:0})});
  var left=missing;for(var i=0;i<hidden.length&&left>0;i++){hidden[i].stars=Math.min(3,left);left-=hidden[i].stars}
  var simpleSlots=Math.ceil(missing/3),simpleStars=simpleSlots*3,total=current+missing,rank=resultRank(base,total);
  return{branch:b,slot:gpSlot,name:gp,base:base,required:required,current:current,missing:missing,rank:rank,visible:visible,hidden:hidden,simpleSlots:simpleSlots,simpleStars:simpleStars};
}
function grandparentUpstreamDirtHtml(b,gpSlot){
  var x=grandparentUpstreamDirtPlan(b,gpSlot);if(!x)return"";
  var status=x.missing===0?'<span class="dirt-need-ok">✓ 追加不要</span>':'<span class="dirt-need-ng">表示外であと '+x.missing+'★</span>';
  var parents=x.visible.map(function(v){return'<div class="upstream-visible-row"><span>'+esc(v.name)+'</span><span>赤 '+esc(v.type)+' '+v.stars+'★'+(v.dirt?' <b>（ダート+'+v.dirt+'★）</b>':'')+'</span></div>'}).join('');
  var hidden=x.hidden.map(function(h){return'<div class="upstream-hidden-row '+(h.stars?'needed':'')+'"><span>'+esc(h.label)+'</span><span>'+(h.stars?'ダート <b>'+h.stars+'★</b>':'自由枠')+'</span></div>'}).join('');
  var exact=x.missing===0?'この祖父母は、表示中の親2人の赤因子だけでダートD条件を満たします。':'最低あと'+x.missing+'★を、'+x.visible.map(function(v){return esc(v.name)}).join('・')+'の父母4枠に入れればダートDです。';
  var simple=x.missing===0?'':'★3中心で作るなら '+x.simpleSlots+'枠（合計'+x.simpleStars+'★）にダートを置けば確実です。';
  return'<div class="upstream-dirt-card"><div class="upstream-dirt-head"><b>'+esc(cfg.slots[b].nodes[gpSlot].role)+' '+esc(x.name)+'をダートローテするための「さらに上の世代」</b>'+status+'</div><div class="upstream-dirt-summary">自然ダート <strong>'+x.base+'</strong> → Dに必要 <strong>'+x.required+'★</strong> ／ 表示中の親2人から <strong>'+x.current+'★</strong> ／ 表示外4枠で <strong>あと'+x.missing+'★</strong></div><div class="upstream-parent-pair"><small>この祖父母を育成するときの親（現在の家系図）</small>'+parents+'</div><div class="upstream-hidden-grid"><small>その親2人の父母＝この祖父母から見た祖父母4枠（現在の家系図では表示外）</small>'+hidden+'</div><p class="upstream-note">'+exact+(simple?' '+simple:'')+'</p></div>';
}
function grandparentUpstreamSummaryHtml(){
  return'<details class="upstream-dirt-details" open><summary>祖父母をダートDにするための、表示外の赤因子まで見る</summary><p class="upstream-intro">ここはクリスエスの祖父母（例：ダイワスカーレット）を実際に因子周回するときの設計です。表示中の曾祖父母2人だけでなく、その2人の父母4人も含めた合計6因子でダートDを作ります。</p><div class="upstream-dirt-wrap">'+grandparentUpstreamDirtHtml("mile","gp1")+grandparentUpstreamDirtHtml("mile","gp2")+grandparentUpstreamDirtHtml("chase","gp1")+grandparentUpstreamDirtHtml("chase","gp2")+'</div></details>';
}
function applyCommonParentRotation(){var common=commonProjectedRaces(),chosen={},byTurn={};common.forEach(function(r){var k=timeKey(r),score=(r.ground==="ダート"?6:3)+raceCoverage("mile",r)+raceCoverage("chase",r),old=byTurn[k];if(!old||score>old.score)byTurn[k]={r:r,score:score}});Object.keys(byTurn).forEach(function(k){chosen[byTurn[k].r.id]=true});["mile","chase"].forEach(function(b){state.branches[b].races=clone(chosen)})}
function redAssignmentText(b){return["parent","gp1","gp2","a1","a2","a3","a4"].map(function(s){var n=selected(b,s);return(n?cfg.slots[b].nodes[s].role+" "+n:"未選択")+"＝"+redType(b,s)+star(b,s)+"★"}).join(" ／ ")}
function parentDirtDistanceNote(b){var n=selected(b,"parent");if(!n)return"";var c=cfg.familyCharacters[n]||{},ok=["短距離","マイル","中距離","長距離"].filter(function(k){return gv((c.distance||{})[k]||"G")>=gv("B")});return ok.length?"ダートで狙いやすい距離："+ok.join("・"):"ダートG1は距離適性の追加補強が必要"}
function renderRedPlanSummary(){var e=document.getElementById("redFactorPlanSummary");if(!e)return;var t1=cfg.slots.mile.target,t2=cfg.slots.chase.target,s1=finalTargetRedStars(t1),s2=finalTargetRedStars(t2),r1=resultRank(state.initial[t1]||"G",s1),r2=resultRank(state.initial[t2]||"G",s2),m=parentRotationSummary("mile"),c=parentRotationSummary("chase"),common=commonProjectedRaces(),dirtRaces=common.filter(function(r){return r.ground==="ダート"}),dirtCommon=dirtRaces.map(function(r){return r.name}).slice(0,10),st=corePlanStatus();var note="";if(r2!==state.desired[t2]&&gv(r2)<gv(state.desired[t2]||r2))note="。"+esc(t2)+"は育成中の継承で"+esc(state.desired[t2])+"を狙う設計";var checks='';if(state.target==="jetblack"){checks='<div class="red-plan-checks"><span class="'+(st.targetOk?'ok':'ng')+'">'+(st.targetOk?'✓':'!')+' クリスエス：マイル'+r1+'・追込'+r2+'</span>'+(st.mile?'<span class="'+(st.mile.dirtOk&&st.mile.nameOk?'ok':'ng')+'">'+(st.mile.dirtOk&&st.mile.nameOk?'✓':'!')+' '+esc(st.mile.parent)+'：ダート'+st.mile.dirtRank+'</span>':'')+(st.chase?'<span class="'+(st.chase.dirtOk&&st.chase.nameOk?'ok':'ng')+'">'+(st.chase.dirtOk&&st.chase.nameOk?'✓':'!')+' '+esc(st.chase.parent)+'：ダート'+st.chase.dirtRank+'</span>':'')+'</div>'}e.innerHTML='<div class="red-plan-title"><b>赤因子・相性ローテ設計</b><span>ダートG1込み</span></div>'+checks+'<div class="red-plan-target"><strong>本育成開始時</strong> '+esc(t1)+' '+s1+'★→'+r1+' ／ '+esc(t2)+' '+s2+'★→'+r2+note+'</div>'+(m?'<div class="red-plan-parent"><b>'+esc(m.name)+'</b>：継承ダート '+m.dirtStars+'★で '+aptitudeOf(m.name,"ダート")+'→'+m.dirt+' ／ 自身で狙う赤「'+esc(m.own)+'」は開始'+m.ownRank+'<br><small>'+esc(parentDirtDistanceNote("mile"))+'</small></div>':'')+(c?'<div class="red-plan-parent"><b>'+esc(c.name)+'</b>：継承ダート '+c.dirtStars+'★で '+aptitudeOf(c.name,"ダート")+'→'+c.dirt+' ／ 自身で狙う赤「'+esc(c.own)+'」は開始'+c.ownRank+'<br><small>'+esc(parentDirtDistanceNote("chase"))+'</small></div>':'')+'<div class="dirt-requirement-wrap">'+parentDirtRequirementHtml("mile")+parentDirtRequirementHtml("chase")+'</div>'+grandparentUpstreamSummaryHtml()+'<details class="red-plan-details"><summary>各ウマ娘に付ける赤因子を見る</summary><div><b>マイル側</b><br>'+esc(redAssignmentText("mile"))+'</div><div><b>追込側</b><br>'+esc(redAssignmentText("chase"))+'</div></details><div class="red-plan-races"><b>両親で共通勝利しやすいG1</b> '+(common.length?common.map(function(r){return esc(r.name)}).slice(0,14).join('・'):'該当なし')+'</div>'+(dirtCommon.length?'<div class="red-plan-dirt"><b>共通ダートG1（'+dirtRaces.length+'種）</b> '+dirtCommon.map(esc).join('・')+'</div>':'')+'<small>おすすめ自動設計では、クリスエスのマイルA・追込B、ラインクラフトとステイゴールドの開始時ダートD以上を必須条件として赤因子を割り当てます。所持のみ設定で対象親を選べない場合は警告表示します。</small>'}
function renderTree(){var b=activeBranch,finalBonus=finalG1Bonus(),finalBase=finalBaseCompatibility(),finalTotal=finalCompatibilityTotal();document.getElementById("familyTree").innerHTML='<div class="tree-target"><button type="button" class="tree-node target" data-target-node><span class="node-role">育成ウマ娘</span><span class="node-name">'+esc(targetName())+'</span><span class="node-meta"><span class="node-g1">両親共通G1 +'+finalBonus+'</span></span><span class="node-compat '+(finalTotal>=100?"high":finalTotal>=70?"mid":"")+'">相'+finalBase+'＋G1 '+finalBonus+'＝'+finalTotal+'</span></button></div><div class="tree-level parent">'+nodeHtml(b,"parent","parent")+'</div><div class="tree-level grandparents">'+nodeHtml(b,"gp1","grandparent")+nodeHtml(b,"gp2","grandparent")+'</div><div class="tree-level ancestors">'+nodeHtml(b,"a1","ancestor")+nodeHtml(b,"a2","ancestor")+nodeHtml(b,"a3","ancestor")+nodeHtml(b,"a4","ancestor")+'</div>';document.querySelectorAll(".tree-node[data-slot]").forEach(function(e){e.addEventListener("click",function(){openNode(e.dataset.slot)})});var t=branchTotal(b);document.getElementById("branchStarTotal").textContent=t+"★";document.getElementById("geneCondition").textContent=t>=12?"条件達成":"あと"+(12-t)+"★";var bt=cfg.slots[b].target,bs=finalTargetRedStars(bt);document.getElementById("finalAptitude").textContent=resultRank(state.initial[bt]||cfg.slots[b].base,bs);var fs=document.getElementById("finalG1Summary");if(fs)fs.innerHTML='<span>両親のトータル相性</span><strong>'+finalTotal+'</strong><small>基礎相性 '+finalBase+' ＋ 共通G1 '+finalBonus+'</small>';var gs=document.getElementById("g1StageSummary");if(gs)gs.innerHTML=["parent","gp1","gp2"].map(function(s){var base=baseCompatibility(b,s),g=stageG1Bonus(b,s),v=base+g;return'<div class="stage-card '+bonusClass(g)+'"><small>'+cfg.slots[b].nodes[s].role+' '+esc(selected(b,s))+'</small><strong>合計 '+v+'</strong><span class="stage-breakdown">基礎相性 '+base+' ＋ 父母共通G1 '+g+'</span></div>'}).join("");renderRedPlanSummary();renderFinalInheritanceSummary()}
function tags(name){var c=cfg.familyCharacters[name],a=(c.tags||[]).slice();var d=(c.surface||{})["ダート"]||"G";if(gv(d)>=gv("D"))a.push("ダート"+d);return a.filter(function(x,i,z){return z.indexOf(x)===i})}
function reason(b,name){var c=cfg.familyCharacters[name],a=[],rt=activeSlot?redType(b,activeSlot):cfg.slots[b].target,rr=aptitudeOf(name,rt),need=starsNeeded(rr,"A");a.push("推奨赤因子「"+rt+"」：初期"+rr+(need===0?"でそのままA":"／Aまで"+(isFinite(need)?need+"★":"育成中継承が必要")));var d=(c.surface||{})["ダート"]||"G",dn=starsNeeded(d,"D");a.push("ダート"+d+(dn===0?"でローテ可":"→Dに"+(isFinite(dn)?dn+"★":"追加継承が必要")));var cov=["マイル","中距離","長距離"].filter(function(k){return gv((c.distance||{})[k]||"G")>=gv("B")}).length;if(cov>=2)a.push("複数距離G1向き");return a.join("。")+"。"}
function renderRedStars(){var n=star(activeBranch,activeSlot);document.getElementById("sheetStarButtons").innerHTML=[0,1,2,3].map(function(i){return'<button data-red-star="'+i+'" class="'+(n===i?"active":"")+'">'+(i?("★".repeat(i)):"0")+'</button>'}).join("");document.querySelectorAll("[data-red-star]").forEach(function(e){e.addEventListener("click",function(){state.branches[activeBranch].stars[activeSlot]=Number(e.dataset.redStar);save();renderRedStars();renderTree()})})}
function renderCandidates(){
  var list=candidateList(activeBranch,activeSlot).slice(0,16),cur=selected(activeBranch,activeSlot);
  var currentLabel=cur||"未選択";
  var currentEl=document.getElementById("candidateCurrentName"),factorEl=document.getElementById("factorSubjectName");
  if(currentEl)currentEl.textContent=currentLabel;
  if(factorEl)factorEl.textContent=currentLabel+" の因子";
  document.getElementById("candidateList").innerHTML=list.map(function(x,i){return'<button class="candidate-card '+(cur===x.name?"selected":"")+'" data-candidate="'+esc(x.name)+'"><div class="candidate-top"><span class="candidate-name">'+(i===0?"最優先：":"")+esc(x.name)+'</span><span class="candidate-score">推奨 '+x.score+'</span></div><div class="candidate-tags">'+tags(x.name).map(function(t){return"<span>"+esc(t)+"</span>"}).join("")+'</div><div class="candidate-reason">'+esc(reason(activeBranch,x.name))+'</div></button>'}).join("");
  document.querySelectorAll("[data-candidate]").forEach(function(e){e.addEventListener("click",function(){
    state.branches[activeBranch].selection[activeSlot]=e.dataset.candidate;
    if(activeSlot==="parent")["gp1","gp2","a1","a2","a3","a4"].forEach(function(s){state.branches[activeBranch].selection[s]=best(activeBranch,s)});
    else if(activeSlot==="gp1")["a1","a2"].forEach(function(s){state.branches[activeBranch].selection[s]=best(activeBranch,s)});
    else if(activeSlot==="gp2")["a3","a4"].forEach(function(s){state.branches[activeBranch].selection[s]=best(activeBranch,s)});
    document.getElementById("sheetTitle").textContent=selected(activeBranch,activeSlot)||"個体編集";
    save();renderTree();renderSchedule();renderCandidates();renderCompatibilityPanel();renderSkillFactors();renderRaceFactors();
  })});
}
function factorState(b,slot,name){state.branches[b].skillFactors[slot]=state.branches[b].skillFactors[slot]||{};state.branches[b].skillFactors[slot][name]=state.branches[b].skillFactors[slot][name]||{assigned:false,learned:false,stars:0};return state.branches[b].skillFactors[slot][name]}
function raceFactorState(b,slot,id){state.branches[b].raceFactors[slot]=state.branches[b].raceFactors[slot]||{};state.branches[b].raceFactors[slot][id]=state.branches[b].raceFactors[slot][id]||{won:false,stars:0};return state.branches[b].raceFactors[slot][id]}
function hiddenSkillMap(b,slot){
  state.branches[b].hiddenSkills=state.branches[b].hiddenSkills||{};
  state.branches[b].hiddenSkills[slot]=state.branches[b].hiddenSkills[slot]||{};
  return state.branches[b].hiddenSkills[slot];
}
function revealSkillEverywhere(name){
  ["mile","chase"].forEach(function(b){
    var maps=state.branches[b].hiddenSkills||{};
    Object.keys(maps).forEach(function(slot){if(maps[slot])delete maps[slot][name]});
  });
}
function applyV38Corrections(){
  state.corrections=state.corrections||{};
  if(state.corrections.v38)return;
  // Ver.3.7以前に①で選んだ緑○が②で非表示になっていた場合だけ、一度復元する。
  selectedSkillNames().forEach(function(name){var sk=skillByName(name);if(sk&&displayCategory(sk)==="緑○")revealSkillEverywhere(name)});
  state.corrections.v38=true;
}
function raceListOverride(b,slot){
  state.branches[b].raceListOverrides=state.branches[b].raceListOverrides||{};
  state.branches[b].raceListOverrides[slot]=state.branches[b].raceListOverrides[slot]||{added:{},removed:{}};
  var o=state.branches[b].raceListOverrides[slot];o.added=o.added||{};o.removed=o.removed||{};return o;
}
function raceFactorHasData(b,slot,id){var x=((state.branches[b].raceFactors[slot]||{})[id]);return!!(x&&(x.won||Number(x.stars)>0))}
function visibleNodeRaceList(b,slot){
  var plan=state.branches[b].races||{},o=raceListOverride(b,slot);
  return cfg.races.filter(function(r){return!o.removed[r.id]&&(plan[r.id]||o.added[r.id]||raceFactorHasData(b,slot,r.id))});
}
function nodeSkillNames(q){
  var base=selectedSkillNames().slice(),existing=(state.branches[activeBranch].skillFactors[activeSlot]||{}),hidden=hiddenSkillMap(activeBranch,activeSlot);
  Object.keys(existing).forEach(function(n){var x=existing[n];if((x.assigned||x.learned||Number(x.stars)>0)&&base.indexOf(n)<0&&skillByName(n))base.push(n)});
  return base.filter(function(n){var x=existing[n]||{};if(hidden[n]&&!x.learned&&!Number(x.stars))return false;var sk=skillByName(n);return!q||n.toLowerCase().indexOf(q)>=0||displayCategory(sk).toLowerCase().indexOf(q)>=0});
}
function commonCount(b,slot){var parent=slot==="parent"?null:(slot==="gp1"||slot==="gp2"?"parent":(slot==="a1"||slot==="a2"?"gp1":"gp2")),name=selected(b,slot),pn=parent?selected(b,parent):null;return cfg.races.filter(function(r){return name&&canRaceSlot(b,slot,r)&&(parent?pn&&canRaceSlot(b,parent,r):targetCanRace(r))}).length}
function estimate(b,slot,stars,type){return individualEstimate(b,slot,stars,type||"skill")}
function pclass(p){return p>=14?"high":p>=8?"mid":"low"}
function renderCompatibilityPanel(){var base=baseCompatibility(activeBranch,activeSlot),stage=stageG1Bonus(activeBranch,activeSlot),total=base+stage,inherit=directG1Bonus(activeBranch,activeSlot);var e=document.getElementById("nodeCompatibilityPanel");if(!e)return;e.innerHTML='<label>基礎相性値（修正可）<input id="nodeBaseCompatibility" type="number" min="0" max="999" value="'+base+'"></label><div class="compatibility-total"><small>父母共通G1 '+stage+'／子への共通G1 '+inherit+'</small><strong>段階合計 '+total+'</strong></div>';document.getElementById("nodeBaseCompatibility").addEventListener("change",function(){state.branches[activeBranch].compat=state.branches[activeBranch].compat||{};state.branches[activeBranch].compat[activeSlot]=Number(this.value||0);save();renderCompatibilityPanel();renderTree();renderSkillFactors();renderRaceFactors()})}
function renderFinalInheritanceSummary(){var out=[],m="mile",c="chase";function add(type,key,label){function st(b){if(type==="race"){var x=(state.branches[b].raceFactors.parent||{})[key];return x?Number(x.stars||0):0}var y=(state.branches[b].skillFactors.parent||{})[key];return y?Number(y.stars||0):0}var s1=st(m),s2=st(c);if(!s1&&!s2)return;var p1=individualEstimate(m,"parent",s1,type),p2=individualEstimate(c,"parent",s2,type);out.push({label:label,p1:p1,p2:p2,any:combineAtLeastOne(p1,p2),both:combineBoth(p1,p2)})}var names={};[m,c].forEach(function(b){Object.keys(state.branches[b].skillFactors.parent||{}).forEach(function(k){names["skill|"+k]=k});Object.keys(state.branches[b].raceFactors.parent||{}).forEach(function(k){var r=cfg.races.find(function(x){return x.id===k});if(r)names["race|"+k]=r.name})});Object.keys(names).forEach(function(k){var p=k.split("|"),type=p.shift(),key=p.join("|");add(type,key,names[k])});out.sort(function(a,b){return b.any-a.any});var e=document.getElementById("finalInheritanceSummary");if(!e)return;e.innerHTML=out.length?out.slice(0,20).map(function(x){return'<div class="final-inherit-item"><div class="final-inherit-name">'+esc(x.label)+'</div><div class="final-inherit-value">'+x.any+'%</div><div class="final-inherit-detail">父 '+x.p1+'%／母 '+x.p2+'%・両方 '+x.both+'%</div></div>'}).join(""):'<p class="hint">両親の因子★を入力すると表示します。</p>'}
function skillMetricText(s){var m=skillMetrics(s);return(s.sp?'・SP '+s.sp:'')+(m.evaluation?'・査定 '+m.evaluation:'')+(m.efficiency?'・効率 '+m.efficiency:'')+(m.verified?'・確認':'・推定')}
function renderSkillFactors(){
  var q=(document.getElementById("nodeSkillSearch").value||"").trim().toLowerCase(),names=nodeSkillNames(q),hidden=hiddenSkillMap(activeBranch,activeSlot);
  names.sort(function(a,b){return(skillMetrics(skillByName(b)).efficiency||0)-(skillMetrics(skillByName(a)).efficiency||0)});
  var hiddenCount=Object.keys(hidden).filter(function(n){return hidden[n]}).length,hc=document.getElementById("hiddenSkillCount");if(hc)hc.textContent=hiddenCount?"("+hiddenCount+")":"";
  document.getElementById("nodeWhiteSkills").innerHTML=names.length?names.map(function(n){var sk=skillByName(n),m=skillMetrics(sk),x=factorState(activeBranch,activeSlot,n),p=x.stars?individualEstimate(activeBranch,activeSlot,x.stars,"skill"):0,comb=combinedForChild(activeBranch,activeSlot,n,"skill");return'<div class="node-white-row"><div class="node-white-top"><input type="checkbox" data-assign="'+esc(n)+'" '+(x.assigned?"checked":"")+'><span class="node-white-name">'+esc(n)+'</span><span class="efficiency-badge '+effClass(m.efficiency||0)+'"><small class="efficiency-caption">効率</small>'+(m.efficiency==null?'—':m.efficiency.toFixed(2))+'</span>'+(!x.learned?'<button class="node-row-delete" type="button" data-hide-skill="'+esc(n)+'" aria-label="'+esc(n)+'を一覧から削除">削除</button>':'<span class="node-row-selected learned">習得済み</span>')+'</div><div class="white-star-row"><label><input type="checkbox" data-learned="'+esc(n)+'" '+(x.learned?"checked":"")+'>習得</label><span>白★</span>'+[0,1,2,3].map(function(i){return'<button data-skill-star="'+esc(n)+'" data-value="'+i+'" class="'+(x.stars===i?"active":"")+'">'+(i?("★".repeat(i)):"0")+'</button>'}).join("")+'</div><div class="factor-prob-row">'+(x.assigned?'<span class="node-factor-selected">因子候補に選択中</span>':'')+(x.stars?'<span>単体 '+p+'%</span>':'')+(comb?'<span class="combined">父母合算 '+comb.any+'%</span><span class="both">両方 '+comb.both+'%</span>':'')+'</div></div>'}).join(""):'<p class="hint">表示できるスキルがありません。「削除したスキルを戻す」または①の白因子選択から追加できます。</p>';
  document.querySelectorAll("[data-assign]").forEach(function(e){e.addEventListener("change",function(){var x=factorState(activeBranch,activeSlot,e.dataset.assign);x.assigned=e.checked;if(e.checked)delete hidden[e.dataset.assign];save();renderSkillFactors();renderTree()})});
  document.querySelectorAll("[data-learned]").forEach(function(e){e.addEventListener("change",function(){var x=factorState(activeBranch,activeSlot,e.dataset.learned);x.learned=e.checked;if(e.checked)delete hidden[e.dataset.learned];save();renderSkillFactors();renderTree()})});
  document.querySelectorAll("[data-skill-star]").forEach(function(e){e.addEventListener("click",function(){var x=factorState(activeBranch,activeSlot,e.dataset.skillStar);x.stars=Number(e.dataset.value);if(x.stars){x.assigned=true;x.learned=true;delete hidden[e.dataset.skillStar]}save();renderSkillFactors();renderTree()})});
  document.querySelectorAll("[data-hide-skill]").forEach(function(e){e.addEventListener("click",function(){var n=e.dataset.hideSkill,x=factorState(activeBranch,activeSlot,n);if(x.learned)return;hidden[n]=true;x.assigned=false;x.stars=0;delete state.branches[activeBranch].skillFactors[activeSlot][n];save();renderSkillFactors();renderTree()})});
}
function renderRaceFactors(){
  var name=selected(activeBranch,activeSlot),list=visibleNodeRaceList(activeBranch,activeSlot),plan=state.branches[activeBranch].races||{},o=raceListOverride(activeBranch,activeSlot);
  var planned=Object.keys(plan).filter(function(id){return plan[id]}).length,eligible=list.filter(function(r){return name&&canRaceSlot(activeBranch,activeSlot,r)}).length;
  var summary=document.getElementById("nodeRaceScheduleSummary");if(summary)summary.innerHTML='<b>④の選択 '+planned+'レース</b>／この一覧 '+list.length+'レース／推奨ローテ可 '+eligible+'レース';
  var add=document.getElementById("nodeRaceAddSelect");if(add){var current=add.value,available=cfg.races.filter(function(r){return!list.some(function(x){return x.id===r.id})});add.innerHTML='<option value="">追加するレースを選択</option>'+available.map(function(r){var ok=name&&canRaceSlot(activeBranch,activeSlot,r);return'<option value="'+r.id+'">'+esc(r.phase+' '+r.time+'｜'+r.name+(r.hasFactor?'｜因子 '+r.factorEffect:'｜共通G1用')+(ok?'':'｜推奨適性未満'))+'</option>'}).join("");if(available.some(function(r){return r.id===current}))add.value=current}
  document.getElementById("nodeRaceFactors").innerHTML=list.length?list.map(function(r){var x=raceFactorState(activeBranch,activeSlot,r.id),p=x.stars?individualEstimate(activeBranch,activeSlot,x.stars,"race"):0,comb=r.hasFactor?combinedForChild(activeBranch,activeSlot,r.id,"race"):null,ok=name&&canRaceSlot(activeBranch,activeSlot,r),source=plan[r.id]?"④から":"個別追加";return'<div class="node-race-row '+(ok?'':'race-ineligible')+'"><div class="node-race-top"><input type="checkbox" data-race-win="'+r.id+'" '+(x.won?"checked":"")+'><span><span class="node-race-name">'+esc(r.name)+'</span><span class="node-race-source">'+source+'</span><span class="node-race-meta">'+esc(r.phase+' '+r.time+'／'+r.ground+'・'+r.distance+'・'+r.course)+(r.hasFactor?'／因子 '+esc(r.factorEffect):'／レース因子なし・共通G1用')+(ok?'':'／推奨適性未満')+'</span></span><span class="probability '+(x.stars?pclass(p):"")+'">'+(r.hasFactor?(x.stars?p+"%":"未因子"):"共通G1")+'</span><button class="node-row-delete" type="button" data-remove-race="'+r.id+'">削除</button></div>'+(r.hasFactor?'<div class="white-star-row"><span>レース★</span>'+[0,1,2,3].map(function(i){return'<button data-race-factor-star="'+r.id+'" data-value="'+i+'" class="'+(x.stars===i?"active":"")+'">'+(i?("★".repeat(i)):"0")+'</button>'}).join("")+'</div>':'<div class="no-race-factor-note">勝利記録のみ。固有のレース因子★はありません。</div>')+'<div class="factor-prob-row">'+(comb?'<span class="combined">父母合算 '+comb.any+'%</span><span class="both">両方 '+comb.both+'%</span>':'')+'</div></div>'}).join(""):'<p class="hint">④でレースを選ぶか、上の「レースを追加」からこのウマ娘用のレースを追加してください。</p>';
  document.querySelectorAll("[data-race-win]").forEach(function(e){e.addEventListener("change",function(){raceFactorState(activeBranch,activeSlot,e.dataset.raceWin).won=e.checked;save();renderRaceFactors();renderCompatibilityPanel();renderTree()})});
  document.querySelectorAll("[data-race-factor-star]").forEach(function(e){e.addEventListener("click",function(){var x=raceFactorState(activeBranch,activeSlot,e.dataset.raceFactorStar);x.stars=Number(e.dataset.value);if(x.stars)x.won=true;save();renderRaceFactors();renderCompatibilityPanel();renderTree()})});
  document.querySelectorAll("[data-remove-race]").forEach(function(e){e.addEventListener("click",function(){var id=e.dataset.removeRace;o.removed[id]=true;delete o.added[id];if(state.branches[activeBranch].raceFactors[activeSlot])delete state.branches[activeBranch].raceFactors[activeSlot][id];save();renderRaceFactors();renderCompatibilityPanel();renderTree()})});
}
function switchSheetTab(tab){activeSheetTab=tab;document.getElementById("candidatePane").classList.remove("hidden");document.getElementById("factorPane").classList.remove("hidden");renderCompatibilityPanel();renderSkillFactors();renderRaceFactors()}
function switchFactorTab(tab){activeFactorTab=tab;document.querySelectorAll(".factor-subtab").forEach(function(e){e.classList.toggle("active",e.dataset.factorTab===tab)});document.getElementById("skillFactorPane").classList.toggle("hidden",tab!=="skill");document.getElementById("raceFactorPane").classList.toggle("hidden",tab!=="race");if(tab==="race")renderRaceFactors();else renderSkillFactors()}
function openNode(slot){activeSlot=slot;activeSheetTab="both";activeFactorTab="skill";document.getElementById("sheetRole").textContent=(activeBranch==="mile"?"マイル側":"追込側")+"・"+cfg.slots[activeBranch].nodes[slot].role;document.getElementById("sheetTitle").textContent=selected(activeBranch,slot)||"個体編集";renderRedStars();renderCandidates();renderCompatibilityPanel();switchFactorTab("skill");renderRaceFactors();document.getElementById("nodeSheet").classList.remove("hidden")}
function closeNode(){document.getElementById("nodeSheet").classList.add("hidden")}
function raceCoverage(b,r){return["parent","gp1","gp2","a1","a2","a3","a4"].filter(function(s){return selected(b,s)&&canRaceSlot(b,s,r)}).length}
function renderSchedule(){var phases=["ジュニア級","クラシック級","シニア級"],b=activeBranch;document.getElementById("raceSchedule").innerHTML=phases.map(function(ph){return'<div class="race-phase"><div class="race-phase-title">'+ph+'</div><div class="race-list">'+cfg.races.filter(function(r){return r.phase===ph}).map(function(r){var c=raceCoverage(b,r),cl=c>=6?"high":c>=4?"mid":"",checked=state.branches[b].races[r.id],blocked=["parent","gp1","gp2","a1","a2","a3","a4"].filter(function(s){var n=selected(b,s);return n&&blockedReason(n,r)}),turnConflict=selectedRaceObjects(b).some(function(x){return x.id!==r.id&&timeKey(x)===timeKey(r)});return'<label class="race-row '+(blocked.length?"blocked ":"")+(turnConflict?"turn-conflict":"")+'"><input type="checkbox" data-race-plan="'+r.id+'" '+(checked?"checked":"")+'><span class="race-time">'+r.time+'</span><span><span class="race-name">'+esc(r.name)+'</span><span class="race-meta">'+r.ground+'・'+r.distance+'・'+r.course+'・'+r.turn+'</span><span class="race-effect '+(r.hasFactor?"has":"")+'">'+(r.hasFactor?("因子："+esc(r.factorEffect)):"レース因子なし（共通G1用）")+'</span>'+(blocked.length?'<span class="race-conflict">目標競合 '+blocked.length+'人</span>':'')+'</span><span class="race-cover '+cl+'">'+c+'/7</span></label>'}).join("")+'</div></div>'}).join("");document.querySelectorAll("[data-race-plan]").forEach(function(e){e.addEventListener("change",function(){var r=cfg.races.find(function(x){return x.id===e.dataset.racePlan});if(e.checked){cfg.races.forEach(function(x){if(x.id!==r.id&&timeKey(x)===timeKey(r))state.branches[b].races[x.id]=false});state.branches[b].raceListOverrides=state.branches[b].raceListOverrides||{};Object.keys(state.branches[b].raceListOverrides).forEach(function(slot){var o=state.branches[b].raceListOverrides[slot];if(o&&o.removed)delete o.removed[r.id]})}state.branches[b].races[e.dataset.racePlan]=e.checked;save();renderSchedule();renderTree();if(activeSlot)renderRaceFactors()})})}
function ownedRoster(){
  var list=(cfg.ownedCharacterRoster&&cfg.ownedCharacterRoster.length?cfg.ownedCharacterRoster:Object.keys(cfg.familyCharacters||{})).slice();
  return Array.from(new Set(list)).sort(function(a,b){return a.localeCompare(b,"ja")});
}
function visibleOwnedRoster(){
  var q=((document.getElementById("ownedSearch")||{}).value||"").trim().toLowerCase();
  return ownedRoster().filter(function(n){return !q||n.toLowerCase().indexOf(q)>=0});
}
function renderOwned(){
  var list=visibleOwnedRoster(),all=ownedRoster(),count=document.getElementById("ownedCount");
  if(count)count.textContent=list.length===all.length?(all.length+"人"):(list.length+" / "+all.length+"人");
  document.getElementById("ownedList").innerHTML=list.map(function(n){return'<label class="owned-item"><input type="checkbox" data-owned="'+esc(n)+'" '+(state.owned[n]?"checked":"")+'><span>'+esc(n)+'</span></label>'}).join("")||'<div class="loading-note">該当するウマ娘はいません</div>';
  document.querySelectorAll("[data-owned]").forEach(function(e){e.addEventListener("change",function(){state.owned[e.dataset.owned]=e.checked;save();if(state.onlyOwned){rebuild("mile","parent");rebuild("chase","parent");renderTree();renderSchedule()}})})
}
function setVisibleOwned(on){
  visibleOwnedRoster().forEach(function(n){state.owned[n]=!!on});
  save(on?"表示中を所持にしました":"表示中の所持を解除しました");renderOwned();
  if(state.onlyOwned){rebuild("mile","parent");rebuild("chase","parent");renderTree();renderSchedule()}
}
function categories(){return whiteCategories()}
function renderCategoryTabs(){document.getElementById("whiteCategoryTabs").innerHTML=categories().map(function(c){return'<button class="category-tab '+(c===whitePickerCategory?"active":"")+'" data-cat="'+esc(c)+'">'+esc(c)+'</button>'}).join("");document.querySelectorAll("[data-cat]").forEach(function(e){e.addEventListener("click",function(){whitePickerCategory=e.dataset.cat;renderWhitePicker()})})}
function renderWhitePicker(){var q=(document.getElementById("whiteSearch").value||"").trim().toLowerCase();var list=cfg.skillCatalog.slice().filter(function(s){return s.factorEligible!==false&&(whitePickerCategory==="全部"||displayCategory(s)===whitePickerCategory)&&(!q||s.name.toLowerCase().indexOf(q)>=0||displayCategory(s).toLowerCase().indexOf(q)>=0||(s.tags||[]).join(" ").toLowerCase().indexOf(q)>=0)});list.sort(function(a,b){if(whiteSort==="name")return a.name.localeCompare(b.name,"ja");return(skillMetrics(b).efficiency??-1)-(skillMetrics(a).efficiency??-1)});var count=document.getElementById("pickerCount");if(count)count.textContent=list.length+"件";document.getElementById("whitePickerList").innerHTML=list.map(function(s){var on=!!state.selectedSkills[s.name],m=skillMetrics(s),featured=(cfg.racecourseSkills||[]).indexOf(s.name)>=0;return'<button title="'+esc(s.name)+'" class="white-pick-row '+(on?"selected ":"")+(featured?"racecourse-featured":"")+'" data-pick="'+esc(s.name)+'"><span class="white-pick-name">'+esc(s.name)+'</span><span class="efficiency-badge '+effClass(m.efficiency||0)+'"><small class="efficiency-caption">技能試験効率</small>'+(m.efficiency==null?'—':m.efficiency.toFixed(2))+'</span></button>'}).join("");document.querySelectorAll("[data-pick]").forEach(function(e){e.addEventListener("click",function(){var name=e.dataset.pick,next=!state.selectedSkills[name];state.selectedSkills[name]=next;if(next){var sk=skillByName(name);topWhiteCategory=sk?displayCategory(sk):topWhiteCategory;revealSkillEverywhere(name)}save();renderWhitePicker();renderSelectedSkills()})});renderCategoryTabs()}
function openWhitePicker(){whitePickerCategory=topWhiteCategory;document.getElementById("whiteSearch").value="";renderWhitePicker();document.getElementById("whitePickerSheet").classList.remove("hidden")}
function closeWhite(){document.getElementById("whitePickerSheet").classList.add("hidden")}
function renderStorageInfo(){var raw=JSON.stringify(state),verify=localStorage.getItem(KEY),ok=verify===raw,when=state.lastSaved?new Date(state.lastSaved).toLocaleString("ja-JP"):"未保存";document.getElementById("storageInfo").innerHTML='<strong>Safari内の自動保存：'+(ok?"正常":"要確認")+'</strong>最終保存：'+when+'<br>データ量：約'+Math.ceil(new Blob([raw]).size/1024)+'KB'+(state.lastImport?'<br>最終読込：'+new Date(state.lastImport).toLocaleString("ja-JP"):"")}
function backupFile(){var payload=clone(state);payload.backupMeta={version:"4.4",createdAt:new Date().toISOString(),target:targetName(),skills:selectedSkillNames().length};return new File([JSON.stringify(payload,null,2)],"ウマ娘自動因子設計_v44_バックアップ.json",{type:"application/json"})}
async function shareBackup(){var f=backupFile();if(navigator.share&&navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:"因子設計バックアップ"});toast("共有画面を開きました");return}catch(e){if(e.name==="AbortError")return}}downloadBackup()}
function downloadBackup(){var f=backupFile(),u=URL.createObjectURL(f),a=document.createElement("a");a.href=u;a.download=f.name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},1000);toast("バックアップを作成しました")}
function renderScenario(){var e=document.getElementById("scenarioMode");if(!e)return;e.innerHTML=(cfg.scenarioModes||[]).map(function(x){return'<option value="'+x.id+'" '+(state.scenarioMode===x.id?'selected':'')+'>'+esc(x.name)+'</option>'}).join("")}
function selectRecommendedRaces(){applyCommonParentRotation();save("赤因子で補強した適性を含め、ダートG1込みの両親共通G1を選択しました");renderSchedule();renderTree()}
function on(id,event,handler){var e=document.getElementById(id);if(e)e.addEventListener(event,handler)}
document.addEventListener("click",function(ev){if(ev.target.closest("[data-close-white]")){ev.preventDefault();closeWhite()}if(ev.target.closest("[data-close-node]")){ev.preventDefault();closeNode()}});
function applyV44Corrections(){
  state.compatDirtFocus=true;
  state.corrections=state.corrections||{};
  if(state.corrections.v44)return;
  if(state.target==="jetblack"){
    state.initial["マイル"]="E";
    state.initial["追込"]="D";
    state.initial["先行"]="A";
    state.desired["マイル"]="A";
    state.desired["追込"]="A";
    state.desired["先行"]="A";
  }
  state.corrections.v44=true;
}
function bind(){
  renderTargets();renderScenario();
  document.getElementById("scenarioMode").addEventListener("change",function(){state.scenarioMode=this.value;save();renderSchedule();renderTree()});
  document.getElementById("selectRecommendedRacesBtn").addEventListener("click",selectRecommendedRaces);
  document.getElementById("clearRacesBtn").addEventListener("click",function(){state.branches[activeBranch].races={};save();renderSchedule();renderTree();if(activeSlot)renderRaceFactors()});
  document.getElementById("targetCharacter").addEventListener("change",function(){chooseTarget(this.value)});
  document.getElementById("customTargetName").addEventListener("input",function(){state.customTarget=this.value;var id=Object.keys(cfg.targets).find(function(k){return cfg.targets[k].name===state.customTarget});if(id){state.initial=clone(cfg.targets[id].initial);state.desired=clone(cfg.targets[id].desired||cfg.targets[id].initial);renderAptitudes()}save();renderTree()});
  document.getElementById("openWhitePickerBtn").addEventListener("click",openWhitePicker);
  document.getElementById("resetWhiteBtn").addEventListener("click",function(){state.selectedSkills=defaultSelectedSkills();save();renderSelectedSkills()});
  document.getElementById("whiteSearch").addEventListener("input",renderWhitePicker);
  document.getElementById("whiteSort").addEventListener("change",function(){whiteSort=this.value;renderWhitePicker()});
  document.querySelectorAll(".sheet-tab").forEach(function(e){e.addEventListener("click",function(){switchSheetTab(e.dataset.sheetTab)})});
  document.querySelectorAll(".factor-subtab").forEach(function(e){e.addEventListener("click",function(){switchFactorTab(e.dataset.factorTab)})});
  document.getElementById("assignAllTopBtn").addEventListener("click",function(){var hidden=hiddenSkillMap(activeBranch,activeSlot);selectedSkillNames().forEach(function(n){factorState(activeBranch,activeSlot,n).assigned=true;delete hidden[n]});save("全因子を追加しました");renderSkillFactors();renderTree()});
  document.getElementById("removeUncheckedSkillsBtn").addEventListener("click",function(){var q=(document.getElementById("nodeSkillSearch").value||"").trim().toLowerCase(),names=nodeSkillNames(q),hidden=hiddenSkillMap(activeBranch,activeSlot),remove=names.filter(function(n){return!factorState(activeBranch,activeSlot,n).learned});if(!remove.length){toast("表示中の未習得スキルはありません");return}if(!confirm("表示中で『習得』にチェックがないスキル "+remove.length+"件を、このウマ娘の一覧から削除しますか？"))return;remove.forEach(function(n){var x=factorState(activeBranch,activeSlot,n);hidden[n]=true;x.assigned=false;x.stars=0;delete state.branches[activeBranch].skillFactors[activeSlot][n]});save("未習得スキルを削除しました");renderSkillFactors();renderTree()});
  document.getElementById("restoreHiddenSkillsBtn").addEventListener("click",function(){state.branches[activeBranch].hiddenSkills=state.branches[activeBranch].hiddenSkills||{};state.branches[activeBranch].hiddenSkills[activeSlot]={};save("削除したスキルを戻しました");renderSkillFactors()});
  document.getElementById("nodeSkillSearch").addEventListener("input",renderSkillFactors);
  document.getElementById("addNodeRaceBtn").addEventListener("click",function(){var sel=document.getElementById("nodeRaceAddSelect"),id=sel.value;if(!id){toast("追加するレースを選んでください");return}var o=raceListOverride(activeBranch,activeSlot);o.added[id]=true;delete o.removed[id];save("レースを追加しました");renderRaceFactors()});
  document.getElementById("resetNodeRacesBtn").addEventListener("click",function(){if(!confirm("このウマ娘の個別追加・削除を解除して、④で選択したレースだけに戻しますか？"))return;var plan=state.branches[activeBranch].races||{},rf=state.branches[activeBranch].raceFactors[activeSlot]||{};Object.keys(rf).forEach(function(id){if(!plan[id])delete rf[id]});state.branches[activeBranch].raceListOverrides=state.branches[activeBranch].raceListOverrides||{};state.branches[activeBranch].raceListOverrides[activeSlot]={added:{},removed:{}};save("④のレース選択に戻しました");renderRaceFactors();renderCompatibilityPanel();renderTree()});
  document.querySelectorAll(".tab").forEach(function(e){e.classList.toggle("active",e.dataset.branch===activeBranch);e.addEventListener("click",function(){activeBranch=e.dataset.branch;document.querySelectorAll(".tab").forEach(function(t){t.classList.toggle("active",t===e)});save();renderTree();renderSchedule()})});
  document.getElementById("autoDesignBtn").addEventListener("click",function(){autoDesignAll();renderTree();renderSchedule();if(activeSlot){renderCandidates();renderRaceFactors()}});
  document.getElementById("onlyOwned").checked=state.onlyOwned;document.getElementById("onlyOwned").addEventListener("change",function(){state.onlyOwned=this.checked;save();autoDesignAll();renderTree();renderSchedule()});
  var ownedSearch=document.getElementById("ownedSearch");if(ownedSearch)ownedSearch.addEventListener("input",renderOwned);
  var ownedSelectVisibleBtn=document.getElementById("ownedSelectVisibleBtn");if(ownedSelectVisibleBtn)ownedSelectVisibleBtn.addEventListener("click",function(){setVisibleOwned(true)});
  var ownedClearVisibleBtn=document.getElementById("ownedClearVisibleBtn");if(ownedClearVisibleBtn)ownedClearVisibleBtn.addEventListener("click",function(){setVisibleOwned(false)});
  document.getElementById("shareBackupBtn").addEventListener("click",shareBackup);document.getElementById("downloadBtn").addEventListener("click",downloadBackup);
  document.getElementById("importFile").addEventListener("change",function(e){var f=e.target.files&&e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(){try{var obj=JSON.parse(r.result);state=deepMerge(defaultState(),obj);state.lastImport=new Date().toISOString();activeBranch=state.activeBranch||"mile";save();toast("読み込み完了");setTimeout(function(){location.reload()},700)}catch(err){alert("読み込みに失敗しました")}};r.readAsText(f)});
  document.getElementById("resetAllBtn").addEventListener("click",function(){if(confirm("全データを初期化しますか？")){localStorage.removeItem(KEY);location.reload()}})
}
window.UmaCore={cfg:cfg,getState:function(){return state},getActiveBranch:function(){return activeBranch},getActiveSlot:function(){return activeSlot},save:save,toast:toast,renderTree:renderTree,renderSchedule:renderSchedule,renderSkillFactors:renderSkillFactors,renderRaceFactors:renderRaceFactors,renderCompatibilityPanel:renderCompatibilityPanel,renderSelectedSkills:renderSelectedSkills,rebuild:rebuild,factorState:factorState,raceFactorState:raceFactorState,selectedSkillNames:selectedSkillNames,skillByName:skillByName,skillMetrics:skillMetrics,individualEstimate:individualEstimate,combineAtLeastOne:combineAtLeastOne,combineBoth:combineBoth,compatibilityTotal:compatibilityTotal,selected:selected,targetName:targetName,esc:esc};
try{applyNewCatalogDefaults();applyV26Corrections();applyV27Corrections();applyV38Corrections();applyV44Corrections();ensure();bind();renderAptitudes();renderDataStatus();renderSelectedSkills();renderTree();renderSchedule();renderOwned();save()}catch(err){window.__initError=String(err&&err.stack||err);console.error(err);["aptitudeGrid","topWhiteCategoryTabs","familyTree"].forEach(function(id){var e=document.getElementById(id);if(e)e.innerHTML='<div class="loading-note">読み込みエラー：ページを再読み込みしてください</div>'})}
})();
