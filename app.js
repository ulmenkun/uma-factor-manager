(function(){
"use strict";
var KEY="kris-factor-manager-v1-1";
var cfg=window.FACTOR_DATA;
var state=load();

function load(){
  try{
    var raw=localStorage.getItem(KEY);
    if(raw){
      var obj=JSON.parse(raw);
      return obj&&obj.values?obj:{values:{}};
    }

    /* Ver.1の選択内容があれば、曾祖父母名とメモだけ自動移行 */
    var oldRaw=localStorage.getItem("kris-factor-manager-v1");
    if(oldRaw){
      var oldData=JSON.parse(oldRaw);
      var migrated={values:{}};
      if(oldData&&oldData.selections){
        Object.keys(oldData.selections).forEach(function(id){
          migrated.values[id+".name"]=oldData.selections[id]||"";
        });
      }
      if(oldData&&oldData.memo){
        migrated.values["final.note"]=oldData.memo;
      }
      localStorage.setItem(KEY,JSON.stringify(migrated));
      return migrated;
    }
    return {values:{}};
  }catch(e){return {values:{}}}
}
function get(k,d){return state.values[k]===undefined?d:state.values[k]}
function set(k,v){
  state.values[k]=v;
  localStorage.setItem(KEY,JSON.stringify(state));
  flash();
  updateDashboard();
}
function flash(){
  var e=document.getElementById("saveState");
  e.textContent="保存済み";
  clearTimeout(flash.t);
  flash.t=setTimeout(function(){e.textContent="自動保存"},900);
}
function esc(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function stars(key){
  var n=Number(get(key,0));
  var labels=["0","★","★★","★★★"];
  return '<div class="star-row">'+labels.map(function(label,i){
    return '<button type="button" class="star-btn '+(n===i?"active":"")+
      '" data-star-key="'+esc(key)+'" data-star-value="'+i+'">'+label+'</button>';
  }).join("")+"</div>";
}
function person(person,cls,factor,extra){
  return '<article class="person '+cls+'">'+
    '<div class="person-head"><div><h3>'+esc(person.name)+'</h3><small>'+esc(factor)+'赤因子</small></div>'+
    '<label class="check"><input type="checkbox" data-key="'+person.id+'.done"><span>完成</span></label></div>'+
    stars(person.id+".stars")+(extra||"")+
    '<label>メモ</label><input type="text" data-key="'+person.id+'.note" placeholder="白因子・妥協点など">'+
    '</article>';
}
function candidateOption(name,selected,prefix){
  return '<option value="'+esc(name)+'" '+(selected===name?"selected":"")+'>'+
    (prefix||"")+esc(name)+'</option>';
}
function uniqueNames(list){
  var seen={};
  return list.filter(function(name){
    if(seen[name])return false;
    seen[name]=true;
    return true;
  });
}
function candidateTags(info){
  if(!info||!info.tags)return "";
  return info.tags.map(function(tag){
    var cls=tag.indexOf("ダート")>=0?" dirt":
      tag.indexOf("追込")>=0?" chase":
      tag.indexOf("相性")>=0?" compat":" wide";
    return '<span class="candidate-tag'+cls+'">'+esc(tag)+'</span>';
  }).join("");
}
function candidateInfoHtml(a){
  var selected=get(a.id+".name","");
  if(!selected){
    return '<div id="'+a.id+'Info" class="candidate-info empty">候補を選ぶと、G1範囲と採用理由を表示します。</div>';
  }
  if(selected==="__custom__"){
    return '<div id="'+a.id+'Info" class="candidate-info"><div class="candidate-name">'+
      esc(get(a.id+".custom","")||"自由入力")+'</div><div class="candidate-reason">自由入力候補です。実際の適性と相性を確認してください。</div></div>';
  }
  var info=cfg.candidateCatalog[selected]||{};
  var rank=a.preferred.indexOf(selected);
  var rankText=rank===0?"この枠の最優先":rank===1?"この枠のおすすめ2位":rank===2?"この枠のおすすめ3位":rank>=0?"相性候補":"G1拡張候補";
  return '<div id="'+a.id+'Info" class="candidate-info">'+
    '<div class="candidate-name">'+esc(selected)+' <span class="candidate-tag compat">'+esc(rankText)+'</span></div>'+
    '<div class="candidate-tags">'+candidateTags(info)+'</div>'+
    '<div class="candidate-aptitude">'+esc(info.aptitude||"適性情報は要確認")+'</div>'+
    '<div class="candidate-reason">'+esc(info.reason||"候補として追加済みです。")+'</div></div>';
}
function ancestor(a,factor,branchId){
  var sel=get(a.id+".name","");
  var custom=get(a.id+".custom","");
  var broad=cfg.broad[branchId]||[];
  var dirt=cfg.broad.dirt||[];
  var preferred=uniqueNames(a.preferred);
  var wide=uniqueNames(broad.filter(function(name){return preferred.indexOf(name)<0}));
  var dirtOnly=uniqueNames(dirt.filter(function(name){
    return preferred.indexOf(name)<0&&wide.indexOf(name)<0;
  }));

  var options='<option value="">未選択</option>'+
    '<optgroup label="🤝 相性優先">'+
    preferred.map(function(name,i){
      var p=i===0?"最優先：":i===1?"おすすめ2：":i===2?"おすすめ3：":"";
      return candidateOption(name,sel,p);
    }).join("")+'</optgroup>'+
    '<optgroup label="🏆 マイル・中距離・長距離G1を広く">'+
    wide.map(function(name){return candidateOption(name,sel,"G1広域：")}).join("")+'</optgroup>'+
    '<optgroup label="🟫 ダートG1も狙う">'+
    dirtOnly.map(function(name){return candidateOption(name,sel,"ダート：")}).join("")+'</optgroup>'+
    '<option value="__custom__" '+(sel==="__custom__"?"selected":"")+'>候補にないキャラを入力</option>';

  return '<article class="ancestor">'+
    '<div class="ancestor-title">'+esc(a.label)+'</div>'+
    '<select data-key="'+a.id+'.name" data-custom="'+a.id+'Custom" data-candidate-id="'+a.id+'">'+options+'</select>'+
    '<input id="'+a.id+'Custom" class="custom-input '+(sel==="__custom__"?"show":"")+
      '" type="text" data-key="'+a.id+'.custom" value="'+esc(custom)+'" placeholder="キャラ名を入力">'+
    candidateInfoHtml(a)+
    '<label>'+esc(factor)+'赤因子</label>'+stars(a.id+".stars")+
    '<label class="check"><input type="checkbox" data-key="'+a.id+'.done"><span>土台完成</span></label>'+
    '</article>';
}
function branch(b){
  var gps=b.grandparents.map(function(gp){
    var an=gp.ancestors.map(function(a){return ancestor(a,b.factor,b.id)}).join("");
    return person(gp,"grandparent",b.factor,
      '<div class="ancestors">'+an+'</div><div id="'+gp.id+'Subtotal" class="subtotal"></div>');
  }).join("");
  var extra='<label class="check"><input type="checkbox" data-key="'+b.parent.id+'.gene"><span>「'+esc(b.factor)+'の遺伝子」取得済み</span></label>';
  return '<section id="branch-'+b.id+'" class="card branch-section">'+
    '<div class="tree-label">🌳 家系図</div>'+
    '<div class="branch-head"><div><h2>'+esc(b.title)+'</h2>'+
    '<small>'+esc(b.parent.name)+'に'+esc(b.factor)+'の遺伝子を付ける</small></div>'+
    '<span id="'+b.id+'Badge" class="badge">0 / '+cfg.threshold+'★</span></div>'+
    person(b.parent,"parent",b.factor,extra)+gps+'</section>';
}
function render(){
  document.getElementById("branches").innerHTML=cfg.branches.map(branch).join("");
  bind();
  document.getElementById("finalDone").checked=!!get("final.done",false);
  document.getElementById("finalNote").value=get("final.note","");
  toggleCustom();
  updateDashboard();
}
function bind(){
  document.querySelectorAll("[data-key]").forEach(function(el){
    var key=el.getAttribute("data-key");
    if(el.type==="checkbox"){
      el.checked=!!get(key,false);
      el.addEventListener("change",function(){set(key,el.checked)});
    }else{
      if(el.tagName!=="SELECT")el.value=get(key,"");
      el.addEventListener("change",function(){
        set(key,el.value);
        toggleCustom();
        if(el.hasAttribute("data-candidate-id"))refreshCandidateInfo(el.getAttribute("data-candidate-id"));
      });
      if(el.type==="text")el.addEventListener("input",function(){
        set(key,el.value);
        if(key.indexOf(".custom")>0)refreshCandidateInfo(key.split(".")[0]);
      });
    }
  });
  document.querySelectorAll("[data-star-key]").forEach(function(btn){
    btn.addEventListener("click",function(){
      var key=btn.getAttribute("data-star-key");
      var value=Number(btn.getAttribute("data-star-value"));
      set(key,value);
      document.querySelectorAll('[data-star-key="'+key+'"]').forEach(function(x){
        x.classList.toggle("active",Number(x.getAttribute("data-star-value"))===value);
      });
    });
  });
}
function findAncestor(id){
  var found=null;
  cfg.branches.forEach(function(b){
    b.grandparents.forEach(function(gp){
      gp.ancestors.forEach(function(a){if(a.id===id)found=a});
    });
  });
  return found;
}
function refreshCandidateInfo(id){
  var a=findAncestor(id);
  var old=document.getElementById(id+"Info");
  if(!a||!old)return;
  var holder=document.createElement("div");
  holder.innerHTML=candidateInfoHtml(a);
  old.replaceWith(holder.firstChild);
}
function toggleCustom(){
  document.querySelectorAll("select[data-custom]").forEach(function(s){
    var target=document.getElementById(s.getAttribute("data-custom"));
    if(target)target.classList.toggle("show",s.value==="__custom__");
  });
}
function geneTotal(b){
  var t=0;
  b.grandparents.forEach(function(gp){
    t+=Number(get(gp.id+".stars",0));
    gp.ancestors.forEach(function(a){t+=Number(get(a.id+".stars",0))});
  });
  return t;
}
function finalTotal(b){
  var t=Number(get(b.parent.id+".stars",0));
  b.grandparents.forEach(function(gp){t+=Number(get(gp.id+".stars",0))});
  return t;
}
function rank(base,stars){
  var up=stars>=10?4:stars>=7?3:stars>=4?2:stars>=1?1:0;
  var ranks=["G","F","E","D","C","B","A","S"];
  return ranks[Math.min(ranks.indexOf(base)+up,ranks.length-1)];
}
function setStatus(id,total){
  var e=document.getElementById(id);
  if(total>=cfg.threshold){
    e.textContent="確定条件達成";e.classList.add("ok");
  }else{
    e.textContent="あと"+(cfg.threshold-total)+"★";e.classList.remove("ok");
  }
}
function selectedName(a){
  var v=get(a.id+".name","");
  return v==="__custom__"?get(a.id+".custom","").trim():v;
}
function allAncestors(){
  var arr=[];
  cfg.branches.forEach(function(b){
    b.grandparents.forEach(function(gp){
      gp.ancestors.forEach(function(a){arr.push({b:b,gp:gp,a:a})});
    });
  });
  return arr;
}
function nextTask(){
  var all=allAncestors();
  var x=all.find(function(v){return !selectedName(v.a)});
  if(x)return x.a.label+"の候補を選ぶ";
  x=all.find(function(v){return Number(get(v.a.id+".stars",0))<2});
  if(x)return selectedName(x.a)+"で"+x.b.factor+"赤★2以上を作る";
  x=all.find(function(v){return !get(v.a.id+".done",false)});
  if(x)return selectedName(x.a)+"の土台完成にチェックする";
  for(var i=0;i<cfg.branches.length;i++){
    var b=cfg.branches[i];
    for(var j=0;j<b.grandparents.length;j++){
      var gp=b.grandparents[j];
      if(!get(gp.id+".done",false))return gp.name+"を育成する";
    }
    var total=geneTotal(b);
    if(total<cfg.threshold)return b.factor+"赤をあと"+(cfg.threshold-total)+"★増やす";
    if(!get(b.parent.id+".done",false))return b.parent.name+"を育成する";
    if(!get(b.parent.id+".gene",false))return b.parent.name+"の「"+b.factor+"の遺伝子」を確認する";
  }
  if(!get("final.done",false))return "新衣装シンボリクリスエスの本育成を始める";
  return "完成。バックアップを書き出して保存する";
}
function updateDashboard(){
  var mile=cfg.branches[0],chase=cfg.branches[1];
  var mg=geneTotal(mile),cg=geneTotal(chase),mf=finalTotal(mile),cf=finalTotal(chase);
  document.getElementById("mileGeneTotal").textContent=mg+"★";
  document.getElementById("chaseGeneTotal").textContent=cg+"★";
  setStatus("mileGeneStatus",mg);setStatus("chaseGeneStatus",cg);
  document.getElementById("finalMileTotal").textContent=mf+"★";
  document.getElementById("finalChaseTotal").textContent=cf+"★";
  document.getElementById("finalMileRank").textContent=rank("E",mf);
  document.getElementById("finalChaseRank").textContent=rank("D",cf);
  document.getElementById("nextTask").textContent=nextTask();
  cfg.branches.forEach(function(b){
    var total=geneTotal(b),badge=document.getElementById(b.id+"Badge");
    badge.textContent=total+" / "+cfg.threshold+"★";
    badge.classList.toggle("ok",total>=cfg.threshold);
    b.grandparents.forEach(function(gp){
      var sub=Number(get(gp.id+".stars",0));
      gp.ancestors.forEach(function(a){sub+=Number(get(a.id+".stars",0))});
      var el=document.getElementById(gp.id+"Subtotal");
      if(el)el.innerHTML=gp.name+"＋親2人の小計：<strong>"+sub+"★</strong>";
    });
  });
}
document.getElementById("finalDone").addEventListener("change",function(){set("final.done",this.checked)});
document.getElementById("finalNote").addEventListener("input",function(){set("final.note",this.value)});
document.getElementById("exportBtn").addEventListener("click",function(){
  var blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
  var url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="クリスエス因子マネージャー_バックアップ.json";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url)},1000);
});
document.getElementById("importFile").addEventListener("change",function(e){
  var file=e.target.files&&e.target.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(){
    try{
      var obj=JSON.parse(reader.result);
      if(!obj||!obj.values)throw new Error();
      state=obj;localStorage.setItem(KEY,JSON.stringify(state));render();alert("読み込みました。");
    }catch(err){alert("読み込めませんでした。")}
  };
  reader.readAsText(file);
});
document.getElementById("resetBtn").addEventListener("click",function(){
  if(!confirm("保存データをすべて消しますか？"))return;
  localStorage.removeItem(KEY);state={values:{}};render();
});
render();
})();
