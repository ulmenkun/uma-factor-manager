(function(){
"use strict";
var cfg=window.AUTO_FACTOR_DATA;
var KEY="uma-auto-factor-v21";
var previousKey="uma-auto-factor-v2";
var state=load();
var activeBranch=state.activeBranch||"mile";
var activeSlot=null;

function clone(obj){return JSON.parse(JSON.stringify(obj))}
function allG(){var o={};["芝","ダート","短距離","マイル","中距離","長距離","逃げ","先行","差し","追込"].forEach(function(k){o[k]="G"});return o}
function defaultConditions(){
  var out={};cfg.conditionGroups.forEach(function(g){out[g.id]=[]});return out
}
function defaultState(){
  var target=cfg.targets.jetblack;
  return {
    activeBranch:"mile",
    target:"jetblack",
    customTarget:"",
    initial:clone(target.initial),
    desired:clone(target.desired),
    conditions:defaultConditions(),
    whiteOverrides:{},
    onlyOwned:false,
    owned:{},
    branches:{
      mile:{selection:{},stars:{},white:{},races:{}},
      chase:{selection:{},stars:{},white:{},races:{}}
    },
    lastSaved:null
  };
}
function mergeState(base,incoming){
  Object.keys(incoming||{}).forEach(function(k){
    if(incoming[k]&&typeof incoming[k]==="object"&&!Array.isArray(incoming[k])&&base[k]&&typeof base[k]==="object"&&!Array.isArray(base[k])){
      mergeState(base[k],incoming[k]);
    }else base[k]=incoming[k];
  });
  return base;
}
function load(){
  try{
    var raw=localStorage.getItem(KEY);
    if(raw)return mergeState(defaultState(),JSON.parse(raw));
    var old=localStorage.getItem(previousKey);
    if(old)return migrateV20(JSON.parse(old));
  }catch(e){}
  return defaultState();
}
function migrateV20(old){
  var fresh=defaultState();
  ["target","customTarget","initial","desired","onlyOwned","owned","activeBranch"].forEach(function(k){if(old[k]!==undefined)fresh[k]=old[k]});
  ["mile","chase"].forEach(function(b){
    if(old.branches&&old.branches[b]){
      fresh.branches[b].selection=old.branches[b].selection||{};
      fresh.branches[b].stars=old.branches[b].stars||{};
    }
  });
  ["course","turn","season","ground"].forEach(function(k){
    var map={course:"courses",turn:"turns",season:"seasons",ground:"grounds"};
    if(old[k])fresh.conditions[map[k]]=[old[k]];
  });
  return fresh;
}
function save(){
  state.activeBranch=activeBranch;
  state.lastSaved=new Date().toISOString();
  localStorage.setItem(KEY,JSON.stringify(state));
  renderStorageInfo();
  var el=document.getElementById("saveState");
  el.textContent="保存済み";
  clearTimeout(save.timer);
  save.timer=setTimeout(function(){el.textContent="自動保存"},900);
}
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function gradeValue(g){return cfg.ranks.indexOf(g)}
function aptitudeUp(stars){return stars>=10?4:stars>=7?3:stars>=4?2:stars>=1?1:0}
function resultingRank(base,stars){return cfg.ranks[Math.min(gradeValue(base)+aptitudeUp(stars),cfg.ranks.length-1)]}
function targetName(){
  if(state.target==="custom")return state.customTarget||"自由入力ウマ娘";
  return cfg.targets[state.target]?cfg.targets[state.target].name:"育成ウマ娘";
}
function targetAptitudeForRace(race){
  var surface=state.initial[race.ground]||"G";
  var distance=state.initial[race.distance]||"G";
  return gradeValue(surface)>=gradeValue("B")&&gradeValue(distance)>=gradeValue("B");
}
function selected(branch,slot){return state.branches[branch].selection[slot]||""}
function star(branch,slot){return Number(state.branches[branch].stars[slot]||0)}
function allSelected(branch,except){
  return Object.keys(state.branches[branch].selection).filter(function(k){return k!==except}).map(function(k){return state.branches[branch].selection[k]}).filter(Boolean);
}
function characterCanRace(name,race){
  var c=cfg.familyCharacters[name];
  if(!c)return false;
  return gradeValue(c.surface[race.ground]||"G")>=gradeValue("B")&&gradeValue(c.distance[race.distance]||"G")>=gradeValue("B");
}
function coverageScore(name){
  var c=cfg.familyCharacters[name];if(!c)return 0;
  var s=0;
  ["マイル","中距離","長距離"].forEach(function(k){
    var v=gradeValue(c.distance[k]);
    if(v>=gradeValue("A"))s+=8;else if(v>=gradeValue("B"))s+=6;else if(v>=gradeValue("C"))s+=3;
  });
  if(gradeValue(c.surface["ダート"])>=gradeValue("B"))s+=8;
  return s;
}
function scoreCandidate(branch,slot,name){
  var def=cfg.slots[branch].nodes[slot],c=cfg.familyCharacters[name];
  if(!c)return -999;
  if(state.onlyOwned&&!state.owned[name])return -999;
  var idx=def.prefs.indexOf(name);
  var score=idx>=0?100-idx*9:45;
  score+=coverageScore(name);
  if(branch==="chase"&&gradeValue(c.style["追込"])>=gradeValue("A"))score+=16;
  if(branch==="mile"&&gradeValue(c.distance["マイル"])>=gradeValue("A"))score+=12;
  if(state.owned[name])score+=8;
  if(allSelected(branch,slot).indexOf(name)>=0)score-=45;
  return score;
}
function candidates(branch,slot){
  return Object.keys(cfg.familyCharacters).map(function(name){return {name:name,score:scoreCandidate(branch,slot,name)}})
    .filter(function(x){return x.score>-900}).sort(function(a,b){return b.score-a.score});
}
function bestCandidate(branch,slot){var list=candidates(branch,slot);return list.length?list[0].name:""}
function rebuildBranch(branch,startSlot){
  var order=["parent","gp1","gp2","a1","a2","a3","a4"];
  var start=Math.max(0,order.indexOf(startSlot||"parent"));
  for(var i=start;i<order.length;i++){
    var slot=order[i];
    state.branches[branch].selection[slot]=bestCandidate(branch,slot);
    if(state.branches[branch].stars[slot]===undefined)state.branches[branch].stars[slot]=2;
  }
  save();
}
function ensureDesign(){
  ["mile","chase"].forEach(function(b){if(!state.branches[b].selection.parent)rebuildBranch(b,"parent")});
}
function renderTargetOptions(){
  var select=document.getElementById("targetCharacter");
  select.innerHTML=Object.keys(cfg.targets).map(function(id){
    return '<option value="'+id+'" '+(state.target===id?"selected":"")+'>'+esc(cfg.targets[id].name)+'</option>';
  }).join("")+'<option value="custom" '+(state.target==="custom"?"selected":"")+'>自由入力</option>';
  document.getElementById("targetNameSuggestions").innerHTML=Object.keys(cfg.targets).map(function(id){return '<option value="'+esc(cfg.targets[id].name)+'">'}).join("");
  var custom=document.getElementById("customTargetName");
  custom.value=state.customTarget;
  custom.classList.toggle("hidden",state.target!=="custom");
}
function setTarget(id){
  state.target=id;
  if(id==="custom"){
    state.initial=allG();state.desired=allG();
  }else{
    state.initial=clone(cfg.targets[id].initial);
    state.desired=clone(cfg.targets[id].desired||cfg.targets[id].initial);
  }
  state.whiteOverrides={};
  save();renderAptitudes();renderWhites();renderTree();renderSchedule();
}
function renderAptitudes(){
  var keys=["芝","ダート","短距離","マイル","中距離","長距離","逃げ","先行","差し","追込"];
  function opts(v){return cfg.ranks.map(function(r){return '<option '+(v===r?"selected":"")+'>'+r+'</option>'}).join("")}
  document.getElementById("aptitudeGrid").innerHTML=keys.map(function(k){
    return '<div class="aptitude-row"><b>'+k+'</b><select data-aptitude="initial" data-key="'+k+'">'+opts(state.initial[k])+'</select><span>→</span><select data-aptitude="desired" data-key="'+k+'">'+opts(state.desired[k])+'</select></div>';
  }).join("");
  document.querySelectorAll("[data-aptitude]").forEach(function(el){
    el.addEventListener("change",function(){state[el.dataset.aptitude][el.dataset.key]=el.value;state.whiteOverrides={};save();renderWhites();renderTree();renderSchedule()});
  });
}
function renderConditions(){
  document.getElementById("conditionGroups").innerHTML=cfg.conditionGroups.map(function(group){
    return '<div class="condition-group"><div class="condition-title">'+group.title+'</div><div class="condition-chips">'+group.values.map(function(v){
      var checked=(state.conditions[group.id]||[]).indexOf(v)>=0;
      return '<label class="condition-chip"><input type="checkbox" data-condition-group="'+group.id+'" data-condition-value="'+v+'" '+(checked?"checked":"")+'><span>'+v+'</span></label>';
    }).join("")+'</div></div>';
  }).join("");
  document.querySelectorAll("[data-condition-group]").forEach(function(el){
    el.addEventListener("change",function(){
      var arr=state.conditions[el.dataset.conditionGroup]||[];
      if(el.checked&&arr.indexOf(el.dataset.conditionValue)<0)arr.push(el.dataset.conditionValue);
      if(!el.checked)arr=arr.filter(function(x){return x!==el.dataset.conditionValue});
      state.conditions[el.dataset.conditionGroup]=arr;state.whiteOverrides={};save();renderWhites();
    });
  });
}
function autoWhiteNames(){
  var list=["直線巧者","コーナー巧者○","尻尾上がり","ウマ好み","垂れウマ回避"];
  if(state.desired["マイル"]==="A")list.push("マイル直線○","マイルコーナー○");
  if(state.desired["中距離"]==="A")list.push("中距離直線○","中距離コーナー○");
  if(state.desired["長距離"]==="A")list.push("長距離直線○","長距離コーナー○");
  if(state.desired["追込"]==="A")list.push("追込直線○","追込コーナー○","直線一気");
  if(state.desired["先行"]==="A")list.push("先行直線○","先行コーナー○");
  if(state.desired["差し"]==="A")list.push("差し直線○","差しコーナー○");
  (state.conditions.courses||[]).forEach(function(x){list.push(x+"レース場○")});
  (state.conditions.turns||[]).forEach(function(x){list.push(x+"回り○")});
  (state.conditions.seasons||[]).forEach(function(x){list.push(x+"ウマ娘○")});
  (state.conditions.grounds||[]).forEach(function(x){list.push(x==="良"?"良バ場○":"道悪○")});
  (state.conditions.distanceTypes||[]).forEach(function(x){list.push(x+"○")});
  (state.conditions.weather||[]).forEach(function(x){list.push(x+"○")});
  return list.filter(function(x,i,a){return a.indexOf(x)===i});
}
function allWhiteNames(){
  var defaults=autoWhiteNames();
  var extras=Object.keys(state.whiteOverrides).filter(function(k){return state.whiteOverrides[k]===true});
  return defaults.concat(extras).filter(function(x,i,a){return a.indexOf(x)===i}).filter(function(n){return state.whiteOverrides[n]!==false});
}
function renderWhites(){
  var list=allWhiteNames();
  document.getElementById("whiteFactorList").innerHTML=list.map(function(name){
    return '<label class="factor-chip"><input type="checkbox" data-white-chip="'+esc(name)+'" checked><span>'+esc(name)+'</span></label>';
  }).join("");
  document.querySelectorAll("[data-white-chip]").forEach(function(el){
    el.addEventListener("change",function(){state.whiteOverrides[el.dataset.whiteChip]=false;save();renderWhites()});
  });
}
function branchTotal(branch){return ["gp1","gp2","a1","a2","a3","a4"].reduce(function(t,s){return t+star(branch,s)},0)}
function finalStars(branch){return ["parent","gp1","gp2"].reduce(function(t,s){return t+star(branch,s)},0)}
function nodeHtml(branch,slot,kind){
  var name=selected(branch,slot)||"未選択",score=name?scoreCandidate(branch,slot,name):0,role=cfg.slots[branch].nodes[slot].role;
  var whiteCount=Object.keys((state.branches[branch].white[slot]||{})).filter(function(k){return state.branches[branch].white[slot][k].learned}).length;
  return '<button type="button" class="tree-node '+kind+'" data-slot="'+slot+'"><span class="node-role">'+role+'</span><span class="node-name">'+esc(name)+'</span><span class="node-meta"><span class="node-star">'+star(branch,slot)+'★</span><span class="node-score '+(score>=100?"best":"")+'">白'+whiteCount+'</span></span></button>';
}
function renderTree(){
  var b=activeBranch;
  document.getElementById("familyTree").innerHTML='<div class="tree-target"><div class="tree-node target"><span class="node-role">育成ウマ娘</span><span class="node-name">'+esc(targetName())+'</span></div></div>'+
    '<div class="tree-level parent">'+nodeHtml(b,"parent","parent")+'</div>'+
    '<div class="tree-level grandparents">'+nodeHtml(b,"gp1","grandparent")+nodeHtml(b,"gp2","grandparent")+'</div>'+
    '<div class="tree-level ancestors">'+nodeHtml(b,"a1","ancestor")+nodeHtml(b,"a2","ancestor")+nodeHtml(b,"a3","ancestor")+nodeHtml(b,"a4","ancestor")+'</div>';
  document.querySelectorAll(".tree-node[data-slot]").forEach(function(btn){btn.addEventListener("click",function(){openCandidateSheet(btn.dataset.slot)})});
  var total=branchTotal(b);
  document.getElementById("branchStarTotal").textContent=total+"★";
  document.getElementById("geneCondition").textContent=total>=12?"条件達成":"あと"+(12-total)+"★";
  document.getElementById("finalAptitude").textContent=resultingRank(cfg.slots[b].base,finalStars(b));
}
function renderOwned(){
  document.getElementById("ownedList").innerHTML=Object.keys(cfg.familyCharacters).sort().map(function(name){
    return '<label class="owned-item"><input type="checkbox" data-owned="'+esc(name)+'" '+(state.owned[name]?"checked":"")+'><span>'+esc(name)+'</span></label>';
  }).join("");
  document.querySelectorAll("[data-owned]").forEach(function(el){
    el.addEventListener("change",function(){state.owned[el.dataset.owned]=el.checked;save();if(state.onlyOwned){rebuildBranch("mile","parent");rebuildBranch("chase","parent");renderTree();renderSchedule()}});
  });
}
function tagsFor(name){
  var c=cfg.familyCharacters[name],tags=(c.tags||[]).slice();
  if(gradeValue(c.surface["ダート"])>=gradeValue("B"))tags.push("ダート"+c.surface["ダート"]);
  if(gradeValue(c.style["追込"])>=gradeValue("A"))tags.push("追込A");
  return tags.filter(function(x,i,a){return a.indexOf(x)===i});
}
function reasonFor(branch,name){
  var c=cfg.familyCharacters[name],parts=[];
  if(branch==="mile"&&gradeValue(c.distance["マイル"])>=gradeValue("A"))parts.push("マイル適性が高い");
  if(branch==="chase"&&gradeValue(c.style["追込"])>=gradeValue("A"))parts.push("追込適性A");
  var cov=["マイル","中距離","長距離"].filter(function(k){return gradeValue(c.distance[k])>=gradeValue("B")}).length;
  if(cov>=3)parts.push("マイル〜長距離G1を広く走れる");else if(cov>=2)parts.push("複数距離のG1を合わせやすい");
  if(gradeValue(c.surface["ダート"])>=gradeValue("B"))parts.push("ダートG1も追加可能");
  if(state.owned[name])parts.push("所持登録済み");
  return parts.join("。")+"。";
}
function renderSheetStars(){
  var n=star(activeBranch,activeSlot);
  document.getElementById("sheetStarButtons").innerHTML=[0,1,2,3].map(function(i){return '<button type="button" data-sheet-star="'+i+'" class="'+(n===i?"active":"")+'">'+(i===0?"0":"★".repeat(i))+'</button>'}).join("");
  document.querySelectorAll("[data-sheet-star]").forEach(function(btn){btn.addEventListener("click",function(){state.branches[activeBranch].stars[activeSlot]=Number(btn.dataset.sheetStar);save();renderSheetStars();renderTree();renderSchedule();renderNodeWhiteSkills()})});
}
function parentSlotOf(slot){
  if(slot==="parent")return "target";
  if(slot==="gp1"||slot==="gp2")return "parent";
  if(slot==="a1"||slot==="a2")return "gp1";
  return "gp2";
}
function commonG1Count(branch,slot){
  var child=parentSlotOf(slot),name=selected(branch,slot),childName=child==="target"?null:selected(branch,child);
  return cfg.races.filter(function(r){
    var a=name&&characterCanRace(name,r);
    var b=child==="target"?targetAptitudeForRace(r):(childName&&characterCanRace(childName,r));
    return a&&b;
  }).length;
}
function compatibilityEstimate(branch,slot,name){
  var idx=cfg.slots[branch].nodes[slot].prefs.indexOf(name);
  return idx===0?36:idx===1?30:idx===2?24:idx>=0?18:12;
}
function whiteProbability(branch,slot,stars){
  if(!stars)return 0;
  var base=[0,3,6,9][stars];
  var common=commonG1Count(branch,slot);
  var compat=compatibilityEstimate(branch,slot,selected(branch,slot));
  return Math.min(99,Math.round(base*(1+(common*3+compat)/100)*10)/10);
}
function recommendedSkillsForSlot(branch,slot){
  var all=allWhiteNames(),specific=branch==="mile"?["マイル直線○","マイルコーナー○"]:["追込直線○","追込コーナー○","直線一気"];
  var rest=all.filter(function(x){return specific.indexOf(x)<0});
  var index=["parent","gp1","gp2","a1","a2","a3","a4"].indexOf(slot);
  var rotated=rest.slice(index).concat(rest.slice(0,index));
  return specific.concat(rotated).filter(function(x,i,a){return a.indexOf(x)===i}).slice(0,slot==="parent"?9:7);
}
function whiteState(branch,slot,skill){
  if(!state.branches[branch].white[slot])state.branches[branch].white[slot]={};
  if(!state.branches[branch].white[slot][skill])state.branches[branch].white[slot][skill]={learned:false,stars:0};
  return state.branches[branch].white[slot][skill];
}
function probabilityClass(p){return p>=15?"high":p>=8?"mid":"low"}
function renderNodeWhiteSkills(){
  var list=recommendedSkillsForSlot(activeBranch,activeSlot);
  document.getElementById("nodeWhiteSkills").innerHTML=list.map(function(skill){
    var ws=whiteState(activeBranch,activeSlot,skill),p=ws.stars?whiteProbability(activeBranch,activeSlot,ws.stars):0;
    var label=!ws.learned?"未習得":!ws.stars?"因子化待ち":p+"%";
    return '<div class="node-white-row"><div class="node-white-top"><input type="checkbox" data-node-learned="'+esc(skill)+'" '+(ws.learned?"checked":"")+'><span class="node-white-name">'+esc(skill)+'</span><span class="probability '+(ws.stars?probabilityClass(p):"")+'">'+label+'</span></div>'+
      '<div class="white-star-row"><span>白因子★</span>'+[0,1,2,3].map(function(i){return '<button type="button" data-node-white-star="'+esc(skill)+'" data-white-star-value="'+i+'" class="'+(ws.stars===i?"active":"")+'">'+(i===0?"0":"★".repeat(i))+'</button>'}).join("")+'</div></div>';
  }).join("");
  document.querySelectorAll("[data-node-learned]").forEach(function(el){el.addEventListener("change",function(){whiteState(activeBranch,activeSlot,el.dataset.nodeLearned).learned=el.checked;save();renderNodeWhiteSkills();renderTree()})});
  document.querySelectorAll("[data-node-white-star]").forEach(function(btn){btn.addEventListener("click",function(){var ws=whiteState(activeBranch,activeSlot,btn.dataset.nodeWhiteStar);ws.stars=Number(btn.dataset.whiteStarValue);if(ws.stars)ws.learned=true;save();renderNodeWhiteSkills();renderTree()})});
}
function openCandidateSheet(slot){
  activeSlot=slot;
  var def=cfg.slots[activeBranch].nodes[slot];
  document.getElementById("sheetRole").textContent=(activeBranch==="mile"?"マイル側":"追込側")+"・"+def.role;
  renderSheetStars();
  var list=candidates(activeBranch,slot).slice(0,14);
  document.getElementById("candidateList").innerHTML=list.map(function(x,index){
    var current=selected(activeBranch,slot)===x.name;
    return '<button type="button" class="candidate-card '+(current?"selected":"")+'" data-candidate="'+esc(x.name)+'"><div class="candidate-top"><span class="candidate-name">'+(index===0?"最優先：":"")+esc(x.name)+'</span><span class="candidate-score">推奨 '+x.score+'</span></div><div class="candidate-tags">'+tagsFor(x.name).map(function(t){return "<span>"+esc(t)+"</span>"}).join("")+'</div><div class="candidate-reason">'+esc(reasonFor(activeBranch,x.name))+'</div></button>';
  }).join("");
  document.querySelectorAll("[data-candidate]").forEach(function(btn){btn.addEventListener("click",function(){
    state.branches[activeBranch].selection[activeSlot]=btn.dataset.candidate;
    if(activeSlot==="parent")["gp1","gp2","a1","a2","a3","a4"].forEach(function(s){state.branches[activeBranch].selection[s]=bestCandidate(activeBranch,s)});
    else if(activeSlot==="gp1")["a1","a2"].forEach(function(s){state.branches[activeBranch].selection[s]=bestCandidate(activeBranch,s)});
    else if(activeSlot==="gp2")["a3","a4"].forEach(function(s){state.branches[activeBranch].selection[s]=bestCandidate(activeBranch,s)});
    save();renderTree();renderSchedule();openCandidateSheet(activeSlot);
  })});
  renderNodeWhiteSkills();
  var sheet=document.getElementById("candidateSheet");sheet.classList.remove("hidden");sheet.setAttribute("aria-hidden","false");
}
function closeCandidate(){document.getElementById("candidateSheet").classList.add("hidden")}
function skillChosen(name){return allWhiteNames().indexOf(name)>=0}
function renderWhitePicker(){
  var q=(document.getElementById("whiteSearch").value||"").trim().toLowerCase();
  var list=cfg.skillCatalog.slice().sort(function(a,b){return b.priority-a.priority}).filter(function(s){return !q||s.name.toLowerCase().indexOf(q)>=0||s.category.toLowerCase().indexOf(q)>=0});
  document.getElementById("whitePickerList").innerHTML=list.map(function(s){
    var chosen=skillChosen(s.name);
    return '<button type="button" class="white-pick-row '+(chosen?"selected":"")+'" data-pick-white="'+esc(s.name)+'"><div><div class="white-pick-name">'+esc(s.name)+'</div><div class="white-pick-meta">'+esc(s.category)+'・'+esc(s.note)+'</div></div><span class="white-priority '+(s.priority>=90?"top":"")+'">'+(chosen?"選択中":"優先"+s.priority)+'</span></button>';
  }).join("");
  document.querySelectorAll("[data-pick-white]").forEach(function(btn){btn.addEventListener("click",function(){var name=btn.dataset.pickWhite;state.whiteOverrides[name]=!skillChosen(name);save();renderWhites();renderWhitePicker()})});
}
function openWhitePicker(){document.getElementById("whiteSearch").value="";renderWhitePicker();document.getElementById("whitePickerSheet").classList.remove("hidden")}
function closeWhitePicker(){document.getElementById("whitePickerSheet").classList.add("hidden")}
function familyNames(branch){return ["parent","gp1","gp2","a1","a2","a3","a4"].map(function(s){return selected(branch,s)}).filter(Boolean)}
function raceCoverage(branch,race){var names=familyNames(branch);return names.filter(function(n){return characterCanRace(n,race)}).length}
function renderSchedule(){
  var phases=["ジュニア級","クラシック級","シニア級"],b=activeBranch;
  document.getElementById("raceSchedule").innerHTML=phases.map(function(phase){
    var rows=cfg.races.filter(function(r){return r.phase===phase}).map(function(r){
      var cover=raceCoverage(b,r),cls=cover>=6?"high":cover>=4?"mid":"",checked=!!state.branches[b].races[r.id];
      return '<label class="race-row"><input type="checkbox" data-race="'+r.id+'" '+(checked?"checked":"")+'><span class="race-time">'+r.time+'</span><span><span class="race-name">'+esc(r.name)+'</span><span class="race-meta">'+r.ground+'・'+r.distance+'・'+r.course+'・'+r.turn+'</span></span><span class="race-cover '+cls+'">'+cover+'/7</span></label>';
    }).join("");
    return '<div class="race-phase"><div class="race-phase-title">'+phase+'</div><div class="race-list">'+rows+'</div></div>';
  }).join("");
  document.querySelectorAll("[data-race]").forEach(function(el){el.addEventListener("change",function(){state.branches[b].races[el.dataset.race]=el.checked;save();updateRaceCount()})});
  document.getElementById("raceTotalCount").textContent=cfg.races.length;updateRaceCount();
}
function updateRaceCount(){var r=state.branches[activeBranch].races;document.getElementById("raceCheckedCount").textContent=Object.keys(r).filter(function(k){return r[k]}).length}
function renderOwned(){
  document.getElementById("ownedList").innerHTML=Object.keys(cfg.familyCharacters).sort().map(function(name){return '<label class="owned-item"><input type="checkbox" data-owned="'+esc(name)+'" '+(state.owned[name]?"checked":"")+'><span>'+esc(name)+'</span></label>'}).join("");
  document.querySelectorAll("[data-owned]").forEach(function(el){el.addEventListener("change",function(){state.owned[el.dataset.owned]=el.checked;save();if(state.onlyOwned){rebuildBranch("mile","parent");rebuildBranch("chase","parent");renderTree();renderSchedule()}})});
}
function renderStorageInfo(){
  var when=state.lastSaved?new Date(state.lastSaved).toLocaleString("ja-JP"):"まだ保存されていません";
  var bytes=new Blob([JSON.stringify(state)]).size;
  document.getElementById("storageInfo").innerHTML='<strong>自動保存先：この端末のSafari内</strong>最終保存：'+when+'<br>保存データ：約'+Math.ceil(bytes/1024)+'KB。Safariのサイトデータを削除すると消えるため、節目でファイル保存してください。';
}
function backupFile(){return new File([JSON.stringify(state,null,2)],"ウマ娘自動因子設計_バックアップ.json",{type:"application/json"})}
async function shareBackup(){
  var file=backupFile();
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],title:"ウマ娘自動因子設計バックアップ"});return}catch(e){if(e.name==="AbortError")return}
  }
  downloadBackup();
}
function downloadBackup(){
  var file=backupFile(),url=URL.createObjectURL(file),a=document.createElement("a");
  a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000);
}
function bindStatic(){
  renderTargetOptions();
  document.getElementById("targetCharacter").addEventListener("change",function(){setTarget(this.value);renderTargetOptions()});
  document.getElementById("customTargetName").addEventListener("input",function(){
    state.customTarget=this.value;
    var match=Object.keys(cfg.targets).find(function(id){return cfg.targets[id].name===state.customTarget});
    if(match){state.initial=clone(cfg.targets[match].initial);state.desired=clone(cfg.targets[match].desired||cfg.targets[match].initial);renderAptitudes()}
    save();renderTree();
  });
  document.getElementById("openWhitePickerBtn").addEventListener("click",openWhitePicker);
  document.getElementById("resetWhiteBtn").addEventListener("click",function(){state.whiteOverrides={};save();renderWhites()});
  document.getElementById("whiteSearch").addEventListener("input",renderWhitePicker);
  document.querySelectorAll("[data-close-white]").forEach(function(x){x.addEventListener("click",closeWhitePicker)});
  document.querySelectorAll("[data-close-candidate]").forEach(function(x){x.addEventListener("click",closeCandidate)});
  document.querySelectorAll(".tab").forEach(function(tab){
    tab.classList.toggle("active",tab.dataset.branch===activeBranch);
    tab.addEventListener("click",function(){activeBranch=tab.dataset.branch;document.querySelectorAll(".tab").forEach(function(t){t.classList.toggle("active",t===tab)});save();renderTree();renderSchedule()});
  });
  document.getElementById("autoDesignBtn").addEventListener("click",function(){rebuildBranch(activeBranch,"parent");renderTree();renderSchedule()});
  document.getElementById("onlyOwned").checked=state.onlyOwned;
  document.getElementById("onlyOwned").addEventListener("change",function(){state.onlyOwned=this.checked;save();rebuildBranch("mile","parent");rebuildBranch("chase","parent");renderTree();renderSchedule()});
  document.getElementById("shareBackupBtn").addEventListener("click",shareBackup);
  document.getElementById("downloadBtn").addEventListener("click",downloadBackup);
  document.getElementById("importFile").addEventListener("change",function(e){
    var file=e.target.files&&e.target.files[0];if(!file)return;
    var r=new FileReader();r.onload=function(){try{state=mergeState(defaultState(),JSON.parse(r.result));activeBranch=state.activeBranch||"mile";save();location.reload()}catch(err){alert("バックアップを読み込めませんでした")}};r.readAsText(file);
  });
  document.getElementById("resetAllBtn").addEventListener("click",function(){if(confirm("全データを初期化しますか？")){localStorage.removeItem(KEY);location.reload()}});
}
ensureDesign();bindStatic();renderAptitudes();renderConditions();renderWhites();renderOwned();renderTree();renderSchedule();renderStorageInfo();
})();
