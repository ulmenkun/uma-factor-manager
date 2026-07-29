(function(){
  "use strict";
  var boot=window.UMA_DATA_UPDATE_BOOTSTRAP,core=window.UmaCore;
  if(!boot||!core)return;
  var SETTINGS_KEY="uma-data-update-settings-v32";
  var MANIFEST_URL="https://gametora.com/data/manifests/umamusume.json";
  var pendingPack=null;
  var pendingInfo=null;
  var defaults={
    autoCheck:true,
    autoApply:false,
    sourceUrl:"data/latest-data-pack.json",
    lastChecked:null,
    lastApplied:null,
    lastError:null,
    gameToraHashes:{}
  };
  function clone(v){return JSON.parse(JSON.stringify(v))}
  function loadSettings(){try{return Object.assign({},defaults,JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}"))}catch(e){return clone(defaults)}}
  var settings=loadSettings();
  function saveSettings(){localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}
  function esc(v){return core.esc(String(v==null?"":v))}
  function dateText(v){if(!v)return"未実行";try{return new Date(v).toLocaleString("ja-JP")}catch(e){return String(v)}}
  function versionTime(pack){var t=Date.parse(pack&&pack.generatedAt||"");return Number.isFinite(t)?t:0}
  function currentMeta(){return window.UMA_ACTIVE_DATA_PACK_META||window.UMA_BUILTIN_DATA_PACK_META||{}}
  function currentCards(){return (window.UMA_SUPPORT_LIBRARY_V31&&window.UMA_SUPPORT_LIBRARY_V31.cards)||[]}
  function currentSkills(){return (window.AUTO_FACTOR_DATA&&window.AUTO_FACTOR_DATA.skillCatalog)||[]}
  function keyCard(c){return String(c.id||"")||String(c.name||"")+"|"+String(c.title||"")}
  function diffPack(pack){
    var cardMap={},skillMap={},addedCards=0,changedCards=0,addedSkills=0,changedSkills=0;
    currentCards().forEach(function(c){cardMap[keyCard(c)]=c});
    currentSkills().forEach(function(s){skillMap[String(s.name||"")]=s});
    (pack.supportCards||[]).forEach(function(c){var old=cardMap[keyCard(c)];if(!old)addedCards++;else if(JSON.stringify(old)!==JSON.stringify(Object.assign({},old,c)))changedCards++});
    (pack.skills||[]).forEach(function(s){var old=skillMap[String(s.name||"")];if(!old)addedSkills++;else if(JSON.stringify(old)!==JSON.stringify(Object.assign({},old,s)))changedSkills++});
    return{addedCards:addedCards,changedCards:changedCards,addedSkills:addedSkills,changedSkills:changedSkills,removedCards:(pack.removedSupportCardIds||[]).length,removedSkills:(pack.removedSkillNames||[]).length};
  }
  function isNewer(pack){
    var cur=currentMeta();
    if(String(pack.version)===String(cur.version))return false;
    var pt=versionTime(pack),ct=Date.parse(cur.generatedAt||"")||0;
    if(pt&&ct)return pt>ct;
    return true;
  }
  function setBusy(on,text){
    var b=document.getElementById("checkDataUpdateBtn");if(b){b.disabled=!!on;b.textContent=on?(text||"確認中…"):"最新データを確認"}
  }
  function statusClass(kind){return"update-status "+(kind||"")}
  function render(message,kind){
    var meta=currentMeta(),box=document.getElementById("dataUpdateStatus");if(!box)return;
    var d=pendingInfo&&pendingInfo.diff;
    var preview=pendingPack?'<div class="update-preview"><b>取得した更新：'+esc(pendingPack.version)+'</b><span>生成 '+esc(dateText(pendingPack.generatedAt))+'</span>'+
      '<div class="update-count-grid"><span>サポカ追加 <strong>'+d.addedCards+'</strong></span><span>サポカ更新 <strong>'+d.changedCards+'</strong></span><span>スキル追加 <strong>'+d.addedSkills+'</strong></span><span>スキル更新 <strong>'+d.changedSkills+'</strong></span></div>'+
      ((pendingPack.releaseNotes||[]).length?'<small>'+pendingPack.releaseNotes.slice(0,4).map(esc).join('／')+'</small>':'')+'</div>':'';
    box.innerHTML='<div class="'+statusClass(kind)+'"><b>'+(message||"更新状態を確認できます")+'</b><span>現在：'+esc(meta.version||"不明")+'（サポカ '+currentCards().length+'枚／スキル '+currentSkills().length+'件）</span><small>最終確認：'+esc(dateText(settings.lastChecked))+(settings.lastApplied?'／最終適用：'+esc(dateText(settings.lastApplied)):'')+'</small></div>'+preview;
    var apply=document.getElementById("applyDataUpdateBtn");if(apply){apply.disabled=!pendingPack;apply.classList.toggle("hidden",!pendingPack)}
    var badge=document.getElementById("dataUpdateBadge");if(badge){badge.textContent=pendingPack?"更新あり":"最新確認";badge.classList.toggle("has-update",!!pendingPack)}
  }
  async function fetchJson(url){
    var absolute=url;
    try{absolute=new URL(url,location.href).href}catch(e){}
    var sep=absolute.indexOf("?")>=0?"&":"?";
    var res=await fetch(absolute+sep+"t="+Date.now(),{cache:"no-store",headers:{Accept:"application/json"}});
    if(!res.ok)throw new Error("HTTP "+res.status);
    var text=await res.text();if(text.length>8*1024*1024)throw new Error("更新データが大きすぎます");
    return JSON.parse(text);
  }
  async function checkManifest(){
    try{
      var m=await fetchJson(MANIFEST_URL),next={supports:m["support-cards"]||"",skills:m.skills||""},old=settings.gameToraHashes||{};
      settings.gameToraHashes=next;saveSettings();
      return{changed:!!((old.supports&&old.supports!==next.supports)||(old.skills&&old.skills!==next.skills)),hashes:next};
    }catch(e){return{changed:false,error:String(e.message||e)}}
  }
  async function checkUpdate(silent){
    setBusy(true,"確認中…");pendingPack=null;pendingInfo=null;
    try{
      var result;
      if(location.protocol==="file:"&&settings.sourceUrl==="data/latest-data-pack.json"){
        result=window.UMA_BUNDLED_DATA_PACK;
        if(!result)throw new Error("ローカル版では更新元URLを設定するか、更新JSONを読み込んでください");
      }else result=await fetchJson(settings.sourceUrl);
      if(!boot.validPack(result))throw new Error("更新JSONの形式が正しくありません");
      var manifest=await checkManifest();
      settings.lastChecked=new Date().toISOString();settings.lastError=null;saveSettings();
      var newer=isNewer(result),diff=diffPack(result);
      if(newer){
        pendingPack=result;pendingInfo={diff:diff,manifest:manifest};
        render("新しいデータがあります","available");
        if(settings.autoApply)applyPending(true);
      }else{
        var extra=manifest.changed?"。GameTora側の更新を検知しました。自動生成パックの反映後に再確認されます":"";
        render("収録データは最新です"+extra,manifest.changed?"notice":"ok");
      }
    }catch(e){
      settings.lastChecked=new Date().toISOString();settings.lastError=String(e.message||e);saveSettings();
      render("更新確認に失敗："+settings.lastError,"error");
      if(!silent)console.error(e);
    }finally{setBusy(false)}
  }
  function applyPending(auto){
    if(!pendingPack)return;
    if(!auto&&!confirm("サポカ・スキルの更新を適用しますか？\n所持チェック、家系図、編成、手動追加カードは保持されます。"))return;
    try{
      localStorage.setItem(boot.PACK_KEY,JSON.stringify(pendingPack));
      settings.lastApplied=new Date().toISOString();settings.lastChecked=settings.lastApplied;saveSettings();
      core.toast("最新データを保存しました");setTimeout(function(){location.reload()},500);
    }catch(e){alert("更新データを保存できませんでした。Safariの保存容量をご確認ください。")}
  }
  function importFile(file){
    var r=new FileReader();r.onload=function(){try{var p=JSON.parse(r.result);if(!boot.validPack(p))throw new Error("形式不正");pendingPack=p;pendingInfo={diff:diffPack(p),manifest:null};render("更新ファイルを読み込みました","available")}catch(e){alert("更新JSONを読み込めませんでした")}};r.readAsText(file);
  }
  function resetPack(){
    if(!confirm("オンライン更新データを削除し、本体同梱データへ戻しますか？\n所持情報や家系図は消えません。"))return;
    localStorage.removeItem(boot.PACK_KEY);settings.lastApplied=null;saveSettings();location.reload();
  }
  function bind(){
    var source=document.getElementById("dataUpdateUrl");if(source){source.value=settings.sourceUrl;source.onchange=function(){settings.sourceUrl=this.value.trim()||defaults.sourceUrl;saveSettings();render("更新元URLを保存しました","notice")}}
    var ac=document.getElementById("autoCheckUpdates");if(ac){ac.checked=!!settings.autoCheck;ac.onchange=function(){settings.autoCheck=this.checked;saveSettings()}}
    var aa=document.getElementById("autoApplyUpdates");if(aa){aa.checked=!!settings.autoApply;aa.onchange=function(){settings.autoApply=this.checked;saveSettings()}}
    var check=document.getElementById("checkDataUpdateBtn");if(check)check.onclick=function(){checkUpdate(false)};
    var apply=document.getElementById("applyDataUpdateBtn");if(apply)apply.onclick=function(){applyPending(false)};
    var file=document.getElementById("dataUpdateFile");if(file)file.onchange=function(){var f=this.files&&this.files[0];if(f)importFile(f);this.value=""};
    var reset=document.getElementById("resetOnlineDataBtn");if(reset)reset.onclick=resetPack;
    render("更新状態を確認できます","");
    var due=!settings.lastChecked||(Date.now()-Date.parse(settings.lastChecked)>24*60*60*1000);
    if(settings.autoCheck&&due)setTimeout(function(){checkUpdate(true)},700);
  }
  bind();
})();
