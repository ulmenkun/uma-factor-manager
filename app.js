(function(){
"use strict";
var cfg=window.AUTO_FACTOR_DATA;
var KEY="uma-auto-factor-v23";
var PREV="uma-auto-factor-v22";
var state=load();
var activeBranch=state.activeBranch||"mile";
var activeSlot=null;
var activeSheetTab="candidate";
var activeFactorTab="skill";
var whitePickerCategory="全部";

function clone(x){return JSON.parse(JSON.stringify(x))}
function allG(){var o={};["芝","ダート","短距離","マイル","中距離","長距離","逃げ","先行","差し","追込"].forEach(function(k){o[k]="G"});return o}
function defaultSelectedSkills(){
  var out={};
  cfg.skillCatalog.forEach(function(s){if(s.default)out[s.name]=true});
  return out;
}
function defaultState(){
  var target=cfg.targets.jetblack;
  return{
    version:"2.2",activeBranch:"mile",target:"jetblack",customTarget:"",
    initial:clone(target.initial),desired:clone(target.desired),
    selectedSkills:defaultSelectedSkills(),
    onlyOwned:false,owned:{},
    branches:{
      mile:{selection:{},stars:{},skillFactors:{},raceFactors:{},races:{}},
      chase:{selection:{},stars:{},skillFactors:{},raceFactors:{},races:{}}
    },
    lastSaved:null,lastImport:null
  };
}
function deepMerge(base,incoming){
  Object.keys(incoming||{}).forEach(function(k){
    if(incoming[k]&&typeof incoming[k]==="object"&&!Array.isArray(incoming[k])&&base[k]&&typeof base[k]==="object"&&!Array.isArray(base[k]))deepMerge(base[k],incoming[k]);
    else base[k]=incoming[k];
  });return base;
}
function migrate(old){
  var fresh=defaultState();
  ["activeBranch","target","customTarget","initial","desired","onlyOwned","owned"].forEach(function(k){if(old[k]!==undefined)fresh[k]=old[k]});
  ["mile","chase"].forEach(function(b){
    if(old.branches&&old.branches[b]){
      fresh.branches[b].selection=old.branches[b].selection||{};
      fresh.branches[b].stars=old.branches[b].stars||{};
      fresh.branches[b].races=old.branches[b].races||{};
      if(old.branches[b].white){
        Object.keys(old.branches[b].white).forEach(function(slot){
          fresh.branches[b].skillFactors[slot]=old.branches[b].white[slot];
        });
      }
    }
  });
  if(old.whiteOverrides){
    Object.keys(old.whiteOverrides).forEach(function(name){fresh.selectedSkills[name]=old.whiteOverrides[name]});
  }
  if(old.selectedSkills){
    Object.keys(old.selectedSkills).forEach(function(name){fresh.selectedSkills[name]=old.selectedSkills[name]});
  }
  return fresh;
}
function load(){
  try{
    var raw=localStorage.getItem(KEY);if(raw)return deepMerge(defaultState(),JSON.parse(raw));
    var prev=localStorage.getItem(PREV);if(prev)return migrate(JSON.parse(prev));
  }catch(e){}
  return defaultState();
}
function applyNewCatalogDefaults(){
  cfg.skillCatalog.forEach(function(s){if(s.default&&state.selectedSkills[s.name]===undefined)state.selectedSkills[s.name]=true});
}
function save(show){
  state.activeBranch=activeBranch;state.lastSaved=new Date().toISOString();
  localStorage.setItem(KEY,JSON.stringify(state));
  renderStorageInfo();
  var e=document.getElementById("saveState");if(e){e.textContent="保存済み";clearTimeout(save.t);save.t=setTimeout(function(){e.textContent="自動保存"},900)}
  if(show)toast(show);
}
function toast(msg){
  var e=document.getElementById("toast");e.textContent=msg;e.classList.remove("hidden");clearTimeout(toast.t);toast.t=setTimeout(function(){e.classList.add("hidden")},1800)
}
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function gv(g){return cfg.ranks.indexOf(g)}
function up(stars){return stars>=10?4:stars>=7?3:stars>=4?2:stars>=1?1:0}
function resultRank(base,stars){return cfg.ranks[Math.min(gv(base)+up(stars),cfg.ranks.length-1)]}
function targetName(){return state.target==="custom"?(state.customTarget||"自由入力ウマ娘"):(cfg.targets[state.target]?cfg.targets[state.target].name:"育成ウマ娘")}
function selected(b,s){return state.branches[b].selection[s]||""}
function star(b,s){return Number(state.branches[b].stars[s]||0)}
function others(b,s){return Object.keys(state.branches[b].selection).filter(function(k){return k!==s}).map(function(k){return state.branches[b].selection[k]}).filter(Boolean)}
function canRace(name,r){
  var c=cfg.familyCharacters[name];if(!c)return false;
  return gv(c.surface[r.ground]||"G")>=gv("B")&&gv(c.distance[r.distance]||"G")>=gv("B")
}
function targetCanRace(r){return gv(state.initial[r.ground]||"G")>=gv("B")&&gv(state.initial[r.distance]||"G")>=gv("B")}
function coverage(name){
  var c=cfg.familyCharacters[name];if(!c)return 0;var s=0;
  ["マイル","中距離","長距離"].forEach(function(k){var v=gv(c.distance[k]);s+=v>=gv("A")?8:v>=gv("B")?6:v>=gv("C")?3:0});
  if(gv(c.surface["ダート"])>=gv("B"))s+=8;return s
}
function candidateScore(b,slot,name){
  var c=cfg.familyCharacters[name],def=cfg.slots[b].nodes[slot];if(!c)return-999;if(state.onlyOwned&&!state.owned[name])return-999;
  var i=def.prefs.indexOf(name),score=i>=0?100-i*9:45;score+=coverage(name);
  if(b==="chase"&&gv(c.style["追込"])>=gv("A"))score+=16;if(b==="mile"&&gv(c.distance["マイル"])>=gv("A"))score+=12;
  if(state.owned[name])score+=8;if(others(b,slot).indexOf(name)>=0)score-=45;return score
}
function candidateList(b,slot){return Object.keys(cfg.familyCharacters).map(function(n){return{name:n,score:candidateScore(b,slot,n)}}).filter(function(x){return x.score>-900}).sort(function(a,z){return z.score-a.score})}
function best(b,slot){var x=candidateList(b,slot);return x.length?x[0].name:""}
function rebuild(b,start){
  var order=["parent","gp1","gp2","a1","a2","a3","a4"],idx=Math.max(0,order.indexOf(start||"parent"));
  for(var i=idx;i<order.length;i++){var s=order[i];state.branches[b].selection[s]=best(b,s);if(state.branches[b].stars[s]===undefined)state.branches[b].stars[s]=2}
  save()
}
function ensure(){["mile","chase"].forEach(function(b){if(!state.branches[b].selection.parent)rebuild(b,"parent")})}
function skillByName(n){return cfg.skillCatalog.find(function(s){return s.name===n})}
function selectedSkillNames(){return Object.keys(state.selectedSkills).filter(function(n){return state.selectedSkills[n]&&skillByName(n)}).sort(function(a,b){return skillByName(b).priority-skillByName(a).priority})}
function renderTargets(){
  var e=document.getElementById("targetCharacter");
  e.innerHTML=Object.keys(cfg.targets).map(function(id){return'<option value="'+id+'" '+(state.target===id?"selected":"")+'>'+esc(cfg.targets[id].name)+'</option>'}).join("")+'<option value="custom" '+(state.target==="custom"?"selected":"")+'>自由入力</option>';
  document.getElementById("targetNameSuggestions").innerHTML=Object.keys(cfg.targets).map(function(id){return'<option value="'+esc(cfg.targets[id].name)+'">'}).join("");
  var c=document.getElementById("customTargetName");c.value=state.customTarget;c.classList.toggle("hidden",state.target!=="custom")
}
function chooseTarget(id){
  state.target=id;if(id==="custom"){state.initial=allG();state.desired=allG()}else{state.initial=clone(cfg.targets[id].initial);state.desired=clone(cfg.targets[id].desired||cfg.targets[id].initial)}
  save();renderTargets();renderAptitudes();renderTree();renderSchedule()
}
function renderAptitudes(){
  var keys=["芝","ダート","短距離","マイル","中距離","長距離","逃げ","先行","差し","追込"];
  function opts(v){return cfg.ranks.map(function(r){return'<option '+(r===v?"selected":"")+'>'+r+'</option>'}).join("")}
  document.getElementById("aptitudeGrid").innerHTML=keys.map(function(k){return'<div class="aptitude-row"><b>'+k+'</b><select data-ap="initial" data-key="'+k+'">'+opts(state.initial[k])+'</select><span>→</span><select data-ap="desired" data-key="'+k+'">'+opts(state.desired[k])+'</select></div>'}).join("");
  document.querySelectorAll("[data-ap]").forEach(function(e){e.addEventListener("change",function(){state[e.dataset.ap][e.dataset.key]=e.value;save();renderTree();renderSchedule()})})
}
function groupedSkills(){
  var groups={};selectedSkillNames().forEach(function(n){var s=skillByName(n),g=s.category;groups[g]=groups[g]||[];groups[g].push(s)});return groups
}
function renderDataStatus(){
  var e=document.getElementById('dataStatus');if(!e)return;
  e.innerHTML='<strong>スキルデータ確認日：'+esc(cfg.dataVersion||'')+'</strong>登録スキル '+cfg.skillCatalog.length+'件／レース場○ 17種。<br>'+esc((cfg.dataSources||[]).join('・'));
}
function renderSelectedSkills(){
  var names=selectedSkillNames(),groups=groupedSkills();
  document.getElementById("whiteSelectionSummary").innerHTML='<b>'+names.length+'個を選択中</b>　緑○、距離・脚質、ダート、デバフなど。';
  document.getElementById("whiteFactorGroups").innerHTML=Object.keys(groups).sort().map(function(g){
    return'<div class="white-group"><div class="white-group-title"><span>'+esc(g)+'</span><span>'+groups[g].length+'個</span></div><div class="white-group-chips">'+groups[g].map(function(s){return'<label class="factor-chip"><input type="checkbox" data-skill-chip="'+esc(s.name)+'" checked><span>'+esc(s.name)+'</span></label>'}).join("")+'</div></div>'
  }).join("");
  document.querySelectorAll("[data-skill-chip]").forEach(function(e){e.addEventListener("change",function(){state.selectedSkills[e.dataset.skillChip]=false;save();renderSelectedSkills()})})
}
function branchTotal(b){return["gp1","gp2","a1","a2","a3","a4"].reduce(function(t,s){return t+star(b,s)},0)}
function finalStars(b){return["parent","gp1","gp2"].reduce(function(t,s){return t+star(b,s)},0)}
function nodeAssignedCount(b,slot){var x=state.branches[b].skillFactors[slot]||{};return Object.keys(x).filter(function(k){return x[k].assigned}).length}
function nodeHtml(b,slot,kind){
  var n=selected(b,slot)||"未選択",count=nodeAssignedCount(b,slot);
  return'<button type="button" class="tree-node '+kind+'" data-slot="'+slot+'"><span class="node-role">'+cfg.slots[b].nodes[slot].role+'</span><span class="node-name">'+esc(n)+'</span><span class="node-meta"><span class="node-star">'+star(b,slot)+'★</span><span class="node-score '+(count?"best":"")+'">因子'+count+'</span></span></button>'
}
function renderTree(){
  var b=activeBranch;
  document.getElementById("familyTree").innerHTML='<div class="tree-target"><div class="tree-node target"><span class="node-role">育成ウマ娘</span><span class="node-name">'+esc(targetName())+'</span></div></div><div class="tree-level parent">'+nodeHtml(b,"parent","parent")+'</div><div class="tree-level grandparents">'+nodeHtml(b,"gp1","grandparent")+nodeHtml(b,"gp2","grandparent")+'</div><div class="tree-level ancestors">'+nodeHtml(b,"a1","ancestor")+nodeHtml(b,"a2","ancestor")+nodeHtml(b,"a3","ancestor")+nodeHtml(b,"a4","ancestor")+'</div>';
  document.querySelectorAll(".tree-node[data-slot]").forEach(function(e){e.addEventListener("click",function(){openNode(e.dataset.slot)})});
  var t=branchTotal(b);document.getElementById("branchStarTotal").textContent=t+"★";document.getElementById("geneCondition").textContent=t>=12?"条件達成":"あと"+(12-t)+"★";document.getElementById("finalAptitude").textContent=resultRank(cfg.slots[b].base,finalStars(b))
}
function tags(name){var c=cfg.familyCharacters[name],a=(c.tags||[]).slice();if(gv(c.surface["ダート"])>=gv("B"))a.push("ダート"+c.surface["ダート"]);if(gv(c.style["追込"])>=gv("A"))a.push("追込A");return a.filter(function(x,i,z){return z.indexOf(x)===i})}
function reason(b,name){var c=cfg.familyCharacters[name],a=[];if(b==="mile"&&gv(c.distance["マイル"])>=gv("A"))a.push("マイル適性が高い");if(b==="chase"&&gv(c.style["追込"])>=gv("A"))a.push("追込A");var cov=["マイル","中距離","長距離"].filter(function(k){return gv(c.distance[k])>=gv("B")}).length;if(cov>=3)a.push("マイル〜長距離G1を広く走れる");else if(cov>=2)a.push("複数距離G1向き");if(gv(c.surface["ダート"])>=gv("B"))a.push("ダートG1対応");return a.join("。")+"。"}
function renderRedStars(){
  var n=star(activeBranch,activeSlot);document.getElementById("sheetStarButtons").innerHTML=[0,1,2,3].map(function(i){return'<button data-red-star="'+i+'" class="'+(n===i?"active":"")+'">'+(i?("★".repeat(i)):"0")+'</button>'}).join("");
  document.querySelectorAll("[data-red-star]").forEach(function(e){e.addEventListener("click",function(){state.branches[activeBranch].stars[activeSlot]=Number(e.dataset.redStar);save();renderRedStars();renderTree()})})
}
function renderCandidates(){
  var list=candidateList(activeBranch,activeSlot).slice(0,16),cur=selected(activeBranch,activeSlot);
  document.getElementById("candidateList").innerHTML=list.map(function(x,i){return'<button class="candidate-card '+(cur===x.name?"selected":"")+'" data-candidate="'+esc(x.name)+'"><div class="candidate-top"><span class="candidate-name">'+(i===0?"最優先：":"")+esc(x.name)+'</span><span class="candidate-score">推奨 '+x.score+'</span></div><div class="candidate-tags">'+tags(x.name).map(function(t){return"<span>"+esc(t)+"</span>"}).join("")+'</div><div class="candidate-reason">'+esc(reason(activeBranch,x.name))+'</div></button>'}).join("");
  document.querySelectorAll("[data-candidate]").forEach(function(e){e.addEventListener("click",function(){state.branches[activeBranch].selection[activeSlot]=e.dataset.candidate;if(activeSlot==="parent")["gp1","gp2","a1","a2","a3","a4"].forEach(function(s){state.branches[activeBranch].selection[s]=best(activeBranch,s)});else if(activeSlot==="gp1")["a1","a2"].forEach(function(s){state.branches[activeBranch].selection[s]=best(activeBranch,s)});else if(activeSlot==="gp2")["a3","a4"].forEach(function(s){state.branches[activeBranch].selection[s]=best(activeBranch,s)});save();renderTree();renderSchedule();renderCandidates()})})
}
function factorState(b,slot,name){
  state.branches[b].skillFactors[slot]=state.branches[b].skillFactors[slot]||{};
  state.branches[b].skillFactors[slot][name]=state.branches[b].skillFactors[slot][name]||{assigned:false,learned:false,stars:0};return state.branches[b].skillFactors[slot][name]
}
function raceFactorState(b,slot,id){
  state.branches[b].raceFactors[slot]=state.branches[b].raceFactors[slot]||{};
  state.branches[b].raceFactors[slot][id]=state.branches[b].raceFactors[slot][id]||{won:false,stars:0};return state.branches[b].raceFactors[slot][id]
}
function commonCount(b,slot){
  var parent=slot==="parent"?null:(slot==="gp1"||slot==="gp2"?"parent":(slot==="a1"||slot==="a2"?"gp1":"gp2")),name=selected(b,slot),pn=parent?selected(b,parent):null;
  return cfg.races.filter(function(r){return name&&canRace(name,r)&&(parent?pn&&canRace(pn,r):targetCanRace(r))}).length
}
function estimate(b,slot,stars){if(!stars)return 0;var base=[0,3,6,9][stars],c=commonCount(b,slot),score=candidateScore(b,slot,selected(b,slot));return Math.min(99,Math.round(base*(1+(c*2+Math.max(0,score-60)/3)/100)*10)/10)}
function pclass(p){return p>=14?"high":p>=8?"mid":"low"}
function renderSkillFactors(){
  var q=(document.getElementById("nodeSkillSearch").value||"").trim().toLowerCase(),names=selectedSkillNames();
  document.getElementById("nodeWhiteSkills").innerHTML=names.filter(function(n){var s=skillByName(n);return!q||n.toLowerCase().indexOf(q)>=0||s.category.toLowerCase().indexOf(q)>=0}).map(function(n){
    var s=skillByName(n),x=factorState(activeBranch,activeSlot,n),p=x.stars?estimate(activeBranch,activeSlot,x.stars):0;
    return'<div class="node-white-row"><div class="node-white-top"><input type="checkbox" data-assign="'+esc(n)+'" '+(x.assigned?"checked":"")+'><span><span class="node-white-name">'+esc(n)+'</span><span class="skill-meta">'+esc(s.category)+(s.sp?"・基礎SP目安 "+s.sp:"")+'</span></span><span class="probability '+(x.stars?pclass(p):"")+'">'+(x.stars?p+"%":"未因子")+'</span></div><div class="white-star-row"><label><input type="checkbox" data-learned="'+esc(n)+'" '+(x.learned?"checked":"")+'>習得</label><span>白★</span>'+[0,1,2,3].map(function(i){return'<button data-skill-star="'+esc(n)+'" data-value="'+i+'" class="'+(x.stars===i?"active":"")+'">'+(i?("★".repeat(i)):"0")+'</button>'}).join("")+'</div></div>'
  }).join("");
  document.querySelectorAll("[data-assign]").forEach(function(e){e.addEventListener("change",function(){factorState(activeBranch,activeSlot,e.dataset.assign).assigned=e.checked;save();renderTree()})});
  document.querySelectorAll("[data-learned]").forEach(function(e){e.addEventListener("change",function(){factorState(activeBranch,activeSlot,e.dataset.learned).learned=e.checked;save()})});
  document.querySelectorAll("[data-skill-star]").forEach(function(e){e.addEventListener("click",function(){var x=factorState(activeBranch,activeSlot,e.dataset.skillStar);x.stars=Number(e.dataset.value);if(x.stars){x.assigned=true;x.learned=true}save();renderSkillFactors();renderTree()})})
}
function renderRaceFactors(){
  var name=selected(activeBranch,activeSlot),list=cfg.races.filter(function(r){return r.hasFactor&&name&&canRace(name,r)});
  document.getElementById("nodeRaceFactors").innerHTML=list.map(function(r){
    var x=raceFactorState(activeBranch,activeSlot,r.id),p=x.stars?estimate(activeBranch,activeSlot,x.stars):0;
    return'<div class="node-race-row"><div class="node-race-top"><input type="checkbox" data-race-win="'+r.id+'" '+(x.won?"checked":"")+'><span><span class="node-race-name">'+esc(r.name)+'</span><span class="node-race-meta">'+r.time+'・'+r.course+'／効果：'+esc(r.factorEffect)+'</span></span><span class="probability '+(x.stars?pclass(p):"")+'">'+(x.stars?p+"%":"未因子")+'</span></div><div class="white-star-row"><span>レース因子★</span>'+[0,1,2,3].map(function(i){return'<button data-race-factor-star="'+r.id+'" data-value="'+i+'" class="'+(x.stars===i?"active":"")+'">'+(i?("★".repeat(i)):"0")+'</button>'}).join("")+'</div></div>'
  }).join("")||'<p class="hint">この候補が適性B以上で走りやすい登録済みG1因子はありません。</p>';
  document.querySelectorAll("[data-race-win]").forEach(function(e){e.addEventListener("change",function(){raceFactorState(activeBranch,activeSlot,e.dataset.raceWin).won=e.checked;save()})});
  document.querySelectorAll("[data-race-factor-star]").forEach(function(e){e.addEventListener("click",function(){var x=raceFactorState(activeBranch,activeSlot,e.dataset.raceFactorStar);x.stars=Number(e.dataset.value);if(x.stars)x.won=true;save();renderRaceFactors()})})
}
function switchSheetTab(tab){
  activeSheetTab=tab;document.querySelectorAll(".sheet-tab").forEach(function(e){e.classList.toggle("active",e.dataset.sheetTab===tab)});document.getElementById("candidatePane").classList.toggle("hidden",tab!=="candidate");document.getElementById("factorPane").classList.toggle("hidden",tab!=="factor");if(tab==="factor"){renderSkillFactors();renderRaceFactors()}
}
function switchFactorTab(tab){
  activeFactorTab=tab;document.querySelectorAll(".factor-subtab").forEach(function(e){e.classList.toggle("active",e.dataset.factorTab===tab)});document.getElementById("skillFactorPane").classList.toggle("hidden",tab!=="skill");document.getElementById("raceFactorPane").classList.toggle("hidden",tab!=="race");if(tab==="race")renderRaceFactors()
}
function openNode(slot){
  activeSlot=slot;activeSheetTab="candidate";activeFactorTab="skill";document.getElementById("sheetRole").textContent=(activeBranch==="mile"?"マイル側":"追込側")+"・"+cfg.slots[activeBranch].nodes[slot].role;document.getElementById("sheetTitle").textContent=selected(activeBranch,slot)||"個体編集";renderRedStars();renderCandidates();switchSheetTab("candidate");switchFactorTab("skill");document.getElementById("nodeSheet").classList.remove("hidden")
}
function closeNode(){document.getElementById("nodeSheet").classList.add("hidden")}
function raceCoverage(b,r){return["parent","gp1","gp2","a1","a2","a3","a4"].filter(function(s){return selected(b,s)&&canRace(selected(b,s),r)}).length}
function renderSchedule(){
  var phases=["ジュニア級","クラシック級","シニア級"],b=activeBranch;
  document.getElementById("raceSchedule").innerHTML=phases.map(function(ph){return'<div class="race-phase"><div class="race-phase-title">'+ph+'</div><div class="race-list">'+cfg.races.filter(function(r){return r.phase===ph}).map(function(r){var c=raceCoverage(b,r),cl=c>=6?"high":c>=4?"mid":"",checked=state.branches[b].races[r.id];return'<label class="race-row"><input type="checkbox" data-race-plan="'+r.id+'" '+(checked?"checked":"")+'><span class="race-time">'+r.time+'</span><span><span class="race-name">'+esc(r.name)+'</span><span class="race-meta">'+r.ground+'・'+r.distance+'・'+r.course+'・'+r.turn+'</span><span class="race-effect '+(r.hasFactor?"has":"")+'">'+(r.hasFactor?("因子："+esc(r.factorEffect)):"レース因子なし（共通G1ボーナス用）")+'</span></span><span class="race-cover '+cl+'">'+c+'/7</span></label>'}).join("")+'</div></div>'}).join("");
  document.querySelectorAll("[data-race-plan]").forEach(function(e){e.addEventListener("change",function(){state.branches[b].races[e.dataset.racePlan]=e.checked;save()})})
}
function renderOwned(){
  document.getElementById("ownedList").innerHTML=Object.keys(cfg.familyCharacters).sort().map(function(n){return'<label class="owned-item"><input type="checkbox" data-owned="'+esc(n)+'" '+(state.owned[n]?"checked":"")+'><span>'+esc(n)+'</span></label>'}).join("");
  document.querySelectorAll("[data-owned]").forEach(function(e){e.addEventListener("change",function(){state.owned[e.dataset.owned]=e.checked;save();if(state.onlyOwned){rebuild("mile","parent");rebuild("chase","parent");renderTree();renderSchedule()}})})
}
function categories(){return["全部"].concat(Array.from(new Set(cfg.skillCatalog.map(function(s){return s.category}))).sort())}
function renderCategoryTabs(){
  document.getElementById("whiteCategoryTabs").innerHTML=categories().map(function(c){return'<button class="category-tab '+(c===whitePickerCategory?"active":"")+'" data-cat="'+esc(c)+'">'+esc(c)+'</button>'}).join("");
  document.querySelectorAll("[data-cat]").forEach(function(e){e.addEventListener("click",function(){whitePickerCategory=e.dataset.cat;renderWhitePicker()})})
}
function renderWhitePicker(){
  var q=(document.getElementById("whiteSearch").value||"").trim().toLowerCase();
  var list=cfg.skillCatalog.slice().sort(function(a,b){return b.priority-a.priority}).filter(function(s){return(whitePickerCategory==="全部"||s.category===whitePickerCategory)&&(!q||s.name.toLowerCase().indexOf(q)>=0||s.category.toLowerCase().indexOf(q)>=0||(s.tags||[]).join(" ").toLowerCase().indexOf(q)>=0)});
  document.getElementById("whitePickerList").innerHTML=list.map(function(s){var on=!!state.selectedSkills[s.name];return'<button class="white-pick-row '+(on?"selected":"")+'" data-pick="'+esc(s.name)+'"><div><div class="white-pick-name">'+esc(s.name)+'</div><div class="white-pick-meta">'+esc(s.category)+(s.sp?"・基礎SP目安 "+s.sp:"")+'・'+esc(s.note)+'</div></div><span class="white-priority '+(s.priority>=90?"top":"")+'">'+(on?"選択中":"優先"+s.priority)+'</span></button>'}).join("");
  document.querySelectorAll("[data-pick]").forEach(function(e){e.addEventListener("click",function(){state.selectedSkills[e.dataset.pick]=!state.selectedSkills[e.dataset.pick];save();renderWhitePicker();renderSelectedSkills()})});renderCategoryTabs()
}
function openWhitePicker(){whitePickerCategory="全部";document.getElementById("whiteSearch").value="";renderWhitePicker();document.getElementById("whitePickerSheet").classList.remove("hidden")}
function closeWhite(){document.getElementById("whitePickerSheet").classList.add("hidden")}
function renderStorageInfo(){
  var raw=JSON.stringify(state),verify=localStorage.getItem(KEY),ok=verify===raw,when=state.lastSaved?new Date(state.lastSaved).toLocaleString("ja-JP"):"未保存";
  document.getElementById("storageInfo").innerHTML='<strong>Safari内の自動保存：'+(ok?"正常":"要確認")+'</strong>最終保存：'+when+'<br>データ量：約'+Math.ceil(new Blob([raw]).size/1024)+'KB'+(state.lastImport?'<br>最終読込：'+new Date(state.lastImport).toLocaleString("ja-JP"):"")
}
function backupFile(){var payload=clone(state);payload.backupMeta={version:"2.2",createdAt:new Date().toISOString(),target:targetName(),skills:selectedSkillNames().length};return new File([JSON.stringify(payload,null,2)],"ウマ娘自動因子設計_v22_バックアップ.json",{type:"application/json"})}
async function shareBackup(){var f=backupFile();if(navigator.share&&navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:"因子設計バックアップ"});toast("共有画面を開きました");return}catch(e){if(e.name==="AbortError")return}}downloadBackup()}
function downloadBackup(){var f=backupFile(),u=URL.createObjectURL(f),a=document.createElement("a");a.href=u;a.download=f.name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},1000);toast("バックアップを作成しました")}
function bind(){
  renderTargets();document.getElementById("targetCharacter").addEventListener("change",function(){chooseTarget(this.value)});
  document.getElementById("customTargetName").addEventListener("input",function(){state.customTarget=this.value;var id=Object.keys(cfg.targets).find(function(k){return cfg.targets[k].name===state.customTarget});if(id){state.initial=clone(cfg.targets[id].initial);state.desired=clone(cfg.targets[id].desired||cfg.targets[id].initial);renderAptitudes()}save();renderTree()});
  document.getElementById("openWhitePickerBtn").addEventListener("click",openWhitePicker);document.getElementById("resetWhiteBtn").addEventListener("click",function(){state.selectedSkills=defaultSelectedSkills();save();renderSelectedSkills()});document.getElementById("whiteSearch").addEventListener("input",renderWhitePicker);
  document.querySelectorAll("[data-close-white]").forEach(function(e){e.addEventListener("click",closeWhite)});document.querySelectorAll("[data-close-node]").forEach(function(e){e.addEventListener("click",closeNode)});
  document.querySelectorAll(".sheet-tab").forEach(function(e){e.addEventListener("click",function(){switchSheetTab(e.dataset.sheetTab)})});document.querySelectorAll(".factor-subtab").forEach(function(e){e.addEventListener("click",function(){switchFactorTab(e.dataset.factorTab)})});
  document.getElementById("assignAllTopBtn").addEventListener("click",function(){selectedSkillNames().forEach(function(n){factorState(activeBranch,activeSlot,n).assigned=true});save("全因子を追加しました");renderSkillFactors();renderTree()});document.getElementById("nodeSkillSearch").addEventListener("input",renderSkillFactors);
  document.querySelectorAll(".tab").forEach(function(e){e.classList.toggle("active",e.dataset.branch===activeBranch);e.addEventListener("click",function(){activeBranch=e.dataset.branch;document.querySelectorAll(".tab").forEach(function(t){t.classList.toggle("active",t===e)});save();renderTree();renderSchedule()})});
  document.getElementById("autoDesignBtn").addEventListener("click",function(){rebuild(activeBranch,"parent");renderTree();renderSchedule()});
  document.getElementById("onlyOwned").checked=state.onlyOwned;document.getElementById("onlyOwned").addEventListener("change",function(){state.onlyOwned=this.checked;save();rebuild("mile","parent");rebuild("chase","parent");renderTree();renderSchedule()});
  document.getElementById("shareBackupBtn").addEventListener("click",shareBackup);document.getElementById("downloadBtn").addEventListener("click",downloadBackup);
  document.getElementById("importFile").addEventListener("change",function(e){var f=e.target.files&&e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(){try{var obj=JSON.parse(r.result);state=deepMerge(defaultState(),obj);state.lastImport=new Date().toISOString();activeBranch=state.activeBranch||"mile";save();toast("読み込み完了");setTimeout(function(){location.reload()},700)}catch(err){alert("読み込みに失敗しました")}};r.readAsText(f)});
  document.getElementById("resetAllBtn").addEventListener("click",function(){if(confirm("全データを初期化しますか？")){localStorage.removeItem(KEY);location.reload()}})
}
applyNewCatalogDefaults();ensure();bind();renderAptitudes();renderDataStatus();renderSelectedSkills();renderTree();renderSchedule();renderOwned();save();
})();
