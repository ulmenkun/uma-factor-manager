(function(){
"use strict";
var cfg=window.AUTO_FACTOR_DATA;
var KEY="uma-auto-factor-v2";
var oldKey="kris-factor-manager-v1-1";
var state=load();
var activeBranch=state.activeBranch||"mile";
var activeSlot=null;

function defaultState(){
  return {
    activeBranch:"mile",
    target:"jetblack",
    customTarget:"",
    initial:Object.assign({},cfg.target.initial),
    desired:Object.assign({},cfg.target.desired),
    course:"",turn:"",season:"",ground:"",
    customWhites:[],
    whiteOverrides:{},
    onlyOwned:false,
    owned:{},
    branches:{mile:{selection:{},stars:{}},chase:{selection:{},stars:{}}}
  };
}
function load(){
  try{
    var raw=localStorage.getItem(KEY);
    if(raw)return Object.assign(defaultState(),JSON.parse(raw));
    var fresh=defaultState();
    var oldRaw=localStorage.getItem(oldKey);
    if(oldRaw){
      var old=JSON.parse(oldRaw);
      if(old&&old.values){
        var mapM={parent:"line",gp1:"daiwa",gp2:"gentil",a1:"daiwa1",a2:"daiwa2",a3:"gentil1",a4:"gentil2"};
        var mapC={parent:"stay",gp1:"eishin",gp2:"crown",a1:"eishin1",a2:"eishin2",a3:"crown1",a4:"crown2"};
        [["mile",mapM],["chase",mapC]].forEach(function(pair){
          Object.keys(pair[1]).forEach(function(slot){
            var oldId=pair[1][slot];
            var name=old.values[oldId+".name"];
            if(name&&name!=="__custom__")fresh.branches[pair[0]].selection[slot]=name;
            fresh.branches[pair[0]].stars[slot]=Number(old.values[oldId+".stars"]||0);
          });
        });
      }
    }
    return fresh;
  }catch(e){return defaultState()}
}
function save(){
  state.activeBranch=activeBranch;
  localStorage.setItem(KEY,JSON.stringify(state));
  var el=document.getElementById("saveState");
  el.textContent="保存済み";
  clearTimeout(save.timer);
  save.timer=setTimeout(function(){el.textContent="自動保存"},900);
}
function gradeValue(g){return cfg.ranks.indexOf(g)}
function aptitudeUp(stars){
  return stars>=10?4:stars>=7?3:stars>=4?2:stars>=1?1:0;
}
function resultingRank(base,stars){
  return cfg.ranks[Math.min(gradeValue(base)+aptitudeUp(stars),cfg.ranks.length-1)];
}
function targetName(){
  return state.target==="custom"?(state.customTarget||"自由入力ウマ娘"):cfg.target.name;
}
function selected(branch,slot){return state.branches[branch].selection[slot]||""}
function star(branch,slot){return Number(state.branches[branch].stars[slot]||0)}
function allSelected(branch,except){
  return Object.keys(state.branches[branch].selection).filter(function(k){return k!==except})
    .map(function(k){return state.branches[branch].selection[k]}).filter(Boolean);
}
function coverageScore(char){
  var c=cfg.characters[char];
  if(!c)return 0;
  var s=0;
  ["mile","middle","long"].forEach(function(k){
    var v=gradeValue(c[k]);
    if(v>=gradeValue("A"))s+=8;
    else if(v>=gradeValue("B"))s+=6;
    else if(v>=gradeValue("C"))s+=3;
  });
  if(gradeValue(c.dirt)>=gradeValue("B"))s+=8;
  return s;
}
function scoreCandidate(branch,slot,name){
  var def=cfg.slots[branch].nodes[slot];
  var c=cfg.characters[name];
  if(!c)return -999;
  if(state.onlyOwned&&!state.owned[name])return -999;
  var idx=def.prefs.indexOf(name);
  var score=idx>=0?100-idx*9:45;
  score+=coverageScore(name);
  if(branch==="chase"&&gradeValue(c.chase)>=gradeValue("A"))score+=16;
  if(branch==="mile"&&gradeValue(c.mile)>=gradeValue("A"))score+=12;
  if(state.owned[name])score+=8;
  if(allSelected(branch,slot).indexOf(name)>=0)score-=45;
  return score;
}
function candidates(branch,slot){
  return Object.keys(cfg.characters).map(function(name){
    return {name:name,score:scoreCandidate(branch,slot,name)};
  }).filter(function(x){return x.score>-900}).sort(function(a,b){return b.score-a.score});
}
function bestCandidate(branch,slot){
  var list=candidates(branch,slot);
  return list.length?list[0].name:"";
}
function rebuildBranch(branch,startSlot){
  var order=["parent","gp1","gp2","a1","a2","a3","a4"];
  var start=Math.max(0,order.indexOf(startSlot||"parent"));
  for(var i=start;i<order.length;i++){
    var slot=order[i];
    state.branches[branch].selection[slot]=bestCandidate(branch,slot);
    if(state.branches[branch].stars[slot]===undefined){
      state.branches[branch].stars[slot]=slot==="parent"?2:2;
    }
  }
  save();
}
function ensureDesign(){
  ["mile","chase"].forEach(function(branch){
    var sel=state.branches[branch].selection;
    if(!sel.parent)rebuildBranch(branch,"parent");
  });
}
function whiteDefaults(){
  var list=["コーナー巧者○","直線巧者","尻尾上がり","ウマ好み","垂れウマ回避"];
  if(state.desired["マイル"]==="A"){
    list.push("マイル直線○","マイルコーナー○");
  }
  if(state.desired["追込"]==="A"){
    list.push("追込直線○","追込コーナー○");
  }
  if(state.course)list.push(state.course+"レース場○");
  if(state.turn)list.push(state.turn+"回り○");
  if(state.season)list.push(state.season+"ウマ娘○");
  if(state.ground==="良")list.push("良バ場○");
  if(state.ground==="道悪")list.push("道悪○");
  return list.concat(state.customWhites).filter(function(x,i,a){return a.indexOf(x)===i});
}
function whiteEnabled(name){
  return state.whiteOverrides[name]===undefined?true:!!state.whiteOverrides[name];
}
function renderAptitudes(){
  var keys=["芝","ダート","短距離","マイル","中距離","長距離","逃げ","先行","差し","追込"];
  var html=keys.map(function(k){
    function options(value){
      return cfg.ranks.map(function(r){return '<option '+(value===r?"selected":"")+'>'+r+'</option>'}).join("");
    }
    return '<div class="aptitude-row"><b>'+k+'</b>'+
      '<select data-aptitude="initial" data-key="'+k+'">'+options(state.initial[k])+'</select>'+
      '<span>→</span>'+
      '<select data-aptitude="desired" data-key="'+k+'">'+options(state.desired[k])+'</select></div>';
  }).join("");
  document.getElementById("aptitudeGrid").innerHTML=html;
  document.querySelectorAll("[data-aptitude]").forEach(function(el){
    el.addEventListener("change",function(){
      state[el.dataset.aptitude][el.dataset.key]=el.value;
      save();renderWhites();renderTree();
    });
  });
}
function renderWhites(){
  var list=whiteDefaults();
  document.getElementById("whiteFactorList").innerHTML=list.map(function(name){
    return '<label class="factor-chip"><input type="checkbox" data-white="'+name+'" '+(whiteEnabled(name)?"checked":"")+'><span>'+name+'</span></label>';
  }).join("");
  document.querySelectorAll("[data-white]").forEach(function(el){
    el.addEventListener("change",function(){
      state.whiteOverrides[el.dataset.white]=el.checked;
      save();
    });
  });
}
function nodeHtml(branch,slot,kind){
  var name=selected(branch,slot)||"未選択";
  var score=name?scoreCandidate(branch,slot,name):0;
  var role=cfg.slots[branch].nodes[slot].role;
  var done=star(branch,slot)>0;
  return '<button type="button" class="tree-node '+kind+(done?" done":"")+'" data-slot="'+slot+'">'+
    '<span class="node-role">'+role+'</span>'+
    '<span class="node-name">'+name+'</span>'+
    '<span class="node-meta"><span class="node-star">'+star(branch,slot)+'★</span>'+
    '<span class="node-score '+(score>=100?"best":"")+'">推奨'+Math.max(0,score)+'</span></span></button>';
}
function branchTotal(branch){
  return ["gp1","gp2","a1","a2","a3","a4"].reduce(function(t,s){return t+star(branch,s)},0);
}
function finalStars(branch){
  return ["parent","gp1","gp2"].reduce(function(t,s){return t+star(branch,s)},0);
}
function renderTree(){
  var branch=activeBranch;
  var target='<div class="tree-target"><div class="tree-node target"><span class="node-role">育成ウマ娘</span><span class="node-name">'+targetName()+'</span></div></div>';
  var html=target+
    '<div class="tree-level parent">'+nodeHtml(branch,"parent","parent")+'</div>'+
    '<div class="tree-level grandparents">'+nodeHtml(branch,"gp1","grandparent")+nodeHtml(branch,"gp2","grandparent")+'</div>'+
    '<div class="tree-level ancestors">'+nodeHtml(branch,"a1","ancestor")+nodeHtml(branch,"a2","ancestor")+nodeHtml(branch,"a3","ancestor")+nodeHtml(branch,"a4","ancestor")+'</div>';
  document.getElementById("familyTree").innerHTML=html;
  document.querySelectorAll(".tree-node[data-slot]").forEach(function(btn){
    btn.addEventListener("click",function(){openSheet(btn.dataset.slot)});
  });
  var total=branchTotal(branch);
  document.getElementById("branchStarTotal").textContent=total+"★";
  document.getElementById("geneCondition").textContent=total>=12?"条件達成":"あと"+(12-total)+"★";
  document.getElementById("finalAptitude").textContent=resultingRank(cfg.slots[branch].base,finalStars(branch));
}
function renderOwned(){
  var names=Object.keys(cfg.characters).sort();
  document.getElementById("ownedList").innerHTML=names.map(function(name){
    return '<label class="owned-item"><input type="checkbox" data-owned="'+name+'" '+(state.owned[name]?"checked":"")+'><span>'+name+'</span></label>';
  }).join("");
  document.querySelectorAll("[data-owned]").forEach(function(el){
    el.addEventListener("change",function(){
      state.owned[el.dataset.owned]=el.checked;
      save();
      if(state.onlyOwned){rebuildBranch("mile","parent");rebuildBranch("chase","parent");renderTree();}
    });
  });
}
function tagsFor(name){
  var c=cfg.characters[name];
  var tags=(c.tags||[]).slice();
  if(gradeValue(c.dirt)>=gradeValue("B"))tags.push("ダート"+c.dirt);
  if(gradeValue(c.chase)>=gradeValue("A"))tags.push("追込A");
  return tags.filter(function(x,i,a){return a.indexOf(x)===i});
}
function reasonFor(branch,name){
  var c=cfg.characters[name];
  var parts=[];
  if(branch==="mile"&&gradeValue(c.mile)>=gradeValue("A"))parts.push("マイル適性が高い");
  if(branch==="chase"&&gradeValue(c.chase)>=gradeValue("A"))parts.push("追込適性A");
  var cov=["mile","middle","long"].filter(function(k){return gradeValue(c[k])>=gradeValue("B")}).length;
  if(cov>=3)parts.push("マイル〜長距離G1を広く走れる");
  else if(cov>=2)parts.push("複数距離のG1を合わせやすい");
  if(gradeValue(c.dirt)>=gradeValue("B"))parts.push("ダートG1も追加可能");
  if(state.owned[name])parts.push("所持登録済み");
  return parts.join("。")+"。";
}
function openSheet(slot){
  activeSlot=slot;
  var def=cfg.slots[activeBranch].nodes[slot];
  document.getElementById("sheetRole").textContent=(activeBranch==="mile"?"マイル側":"追込側")+"・"+def.role;
  document.getElementById("sheetTitle").textContent="候補と赤因子★";
  renderSheetStars();
  var list=candidates(activeBranch,slot).slice(0,12);
  document.getElementById("candidateList").innerHTML=list.map(function(x,index){
    var selectedNow=selected(activeBranch,slot)===x.name;
    return '<button type="button" class="candidate-card '+(selectedNow?"selected":"")+'" data-candidate="'+x.name+'">'+
      '<div class="candidate-top"><span class="candidate-name">'+(index===0?"最優先：":"")+x.name+'</span><span class="candidate-score">推奨 '+x.score+'</span></div>'+
      '<div class="candidate-tags">'+tagsFor(x.name).map(function(t){return "<span>"+t+"</span>"}).join("")+'</div>'+
      '<div class="candidate-reason">'+reasonFor(activeBranch,x.name)+'</div></button>';
  }).join("");
  document.querySelectorAll("[data-candidate]").forEach(function(btn){
    btn.addEventListener("click",function(){
      state.branches[activeBranch].selection[activeSlot]=btn.dataset.candidate;
      var order=["parent","gp1","gp2","a1","a2","a3","a4"];
      var next=order.indexOf(activeSlot)+1;
      if(activeSlot==="parent"){
        ["gp1","gp2","a1","a2","a3","a4"].forEach(function(s){state.branches[activeBranch].selection[s]=bestCandidate(activeBranch,s)});
      }else if(activeSlot==="gp1"){
        ["a1","a2"].forEach(function(s){state.branches[activeBranch].selection[s]=bestCandidate(activeBranch,s)});
      }else if(activeSlot==="gp2"){
        ["a3","a4"].forEach(function(s){state.branches[activeBranch].selection[s]=bestCandidate(activeBranch,s)});
      }
      save();renderTree();openSheet(activeSlot);
    });
  });
  var sheet=document.getElementById("candidateSheet");
  sheet.classList.remove("hidden");sheet.setAttribute("aria-hidden","false");
}
function renderSheetStars(){
  var n=star(activeBranch,activeSlot);
  document.getElementById("sheetStarButtons").innerHTML=[0,1,2,3].map(function(i){
    return '<button type="button" data-sheet-star="'+i+'" class="'+(n===i?"active":"")+'">'+(i===0?"0":"★".repeat(i))+'</button>';
  }).join("");
  document.querySelectorAll("[data-sheet-star]").forEach(function(btn){
    btn.addEventListener("click",function(){
      state.branches[activeBranch].stars[activeSlot]=Number(btn.dataset.sheetStar);
      save();renderSheetStars();renderTree();
    });
  });
}
function closeSheet(){
  document.getElementById("candidateSheet").classList.add("hidden");
  document.getElementById("candidateSheet").setAttribute("aria-hidden","true");
}
function bindStatic(){
  document.getElementById("targetCharacter").value=state.target;
  document.getElementById("customTargetName").value=state.customTarget;
  document.getElementById("customTargetName").classList.toggle("hidden",state.target!=="custom");
  document.getElementById("targetCharacter").addEventListener("change",function(){
    state.target=this.value;
    document.getElementById("customTargetName").classList.toggle("hidden",state.target!=="custom");
    save();renderTree();
  });
  document.getElementById("customTargetName").addEventListener("input",function(){state.customTarget=this.value;save();renderTree()});
  [["courseSetting","course"],["turnSetting","turn"],["seasonSetting","season"],["groundSetting","ground"]].forEach(function(x){
    var el=document.getElementById(x[0]);el.value=state[x[1]];
    el.addEventListener("change",function(){state[x[1]]=this.value;state.whiteOverrides={};save();renderWhites()});
  });
  document.getElementById("addWhiteBtn").addEventListener("click",function(){
    var input=document.getElementById("customWhiteInput");
    var value=input.value.trim();
    if(value&&state.customWhites.indexOf(value)<0){state.customWhites.push(value);state.whiteOverrides[value]=true;input.value="";save();renderWhites()}
  });
  document.getElementById("resetWhiteBtn").addEventListener("click",function(){state.whiteOverrides={};save();renderWhites()});
  document.querySelectorAll(".tab").forEach(function(tab){
    tab.classList.toggle("active",tab.dataset.branch===activeBranch);
    tab.addEventListener("click",function(){
      activeBranch=tab.dataset.branch;
      document.querySelectorAll(".tab").forEach(function(t){t.classList.toggle("active",t===tab)});
      save();renderTree();
    });
  });
  document.getElementById("autoDesignBtn").addEventListener("click",function(){rebuildBranch(activeBranch,"parent");renderTree()});
  document.getElementById("onlyOwned").checked=state.onlyOwned;
  document.getElementById("onlyOwned").addEventListener("change",function(){
    state.onlyOwned=this.checked;save();rebuildBranch("mile","parent");rebuildBranch("chase","parent");renderTree();
  });
  document.querySelectorAll("[data-close-sheet]").forEach(function(x){x.addEventListener("click",closeSheet)});
  document.getElementById("exportBtn").addEventListener("click",function(){
    var blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
    var url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="ウマ娘自動因子設計_バックアップ.json";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000);
  });
  document.getElementById("importFile").addEventListener("change",function(e){
    var file=e.target.files&&e.target.files[0];if(!file)return;
    var r=new FileReader();r.onload=function(){try{state=Object.assign(defaultState(),JSON.parse(r.result));activeBranch=state.activeBranch||"mile";save();location.reload()}catch(err){alert("読み込めませんでした")}};r.readAsText(file);
  });
  document.getElementById("resetAllBtn").addEventListener("click",function(){
    if(!confirm("全データを初期化しますか？"))return;
    localStorage.removeItem(KEY);location.reload();
  });
}
ensureDesign();
bindStatic();
renderAptitudes();
renderWhites();
renderOwned();
renderTree();
})();
