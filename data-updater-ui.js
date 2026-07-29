(function(){
  "use strict";
  var boot=window.UMA_DATA_UPDATE_BOOTSTRAP,core=window.UmaCore;
  if(!boot||!core)return;

  var SETTINGS_KEY="uma-data-update-settings-v34";
  var LEGACY_SETTING_KEYS=["uma-data-update-settings-v33","uma-data-update-settings-v32"];
  var LEGACY_TOKEN_KEYS=["uma-github-actions-token-v33","uma-github-actions-token-v32"];
  var SOURCE_URL="data/latest-data-pack.json";
  var pendingPack=null,pendingInfo=null;

  function clone(v){return JSON.parse(JSON.stringify(v))}
  function readLegacy(){
    var out={};
    try{
      for(var i=0;i<LEGACY_SETTING_KEYS.length;i++){
        var value=JSON.parse(localStorage.getItem(LEGACY_SETTING_KEYS[i])||"null");
        if(value){
          if(value.autoCheck!==undefined)out.autoCheck=!!value.autoCheck;
          if(value.lastChecked)out.lastChecked=value.lastChecked;
          if(value.lastApplied)out.lastApplied=value.lastApplied;
          break;
        }
      }
    }catch(e){}
    return out;
  }
  var defaults={autoCheck:false,lastChecked:null,lastApplied:null,lastError:null};
  function loadSettings(){
    var saved=null;
    try{saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"null")}catch(e){}
    return Object.assign({},defaults,readLegacy(),saved||{});
  }
  var settings=loadSettings();
  function removeLegacySecrets(){
    try{
      LEGACY_TOKEN_KEYS.forEach(function(k){localStorage.removeItem(k)});
      LEGACY_SETTING_KEYS.forEach(function(k){localStorage.removeItem(k)});
    }catch(e){}
  }
  removeLegacySecrets();
  function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}catch(e){}}
  saveSettings();

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
  function setBusy(on){
    var b=document.getElementById("checkDataUpdateBtn");
    if(b){b.disabled=!!on;b.textContent=on?"確認中…":"最新データを確認"}
  }
  function statusClass(kind){return"update-status "+(kind||"")}
  function render(message,kind){
    var meta=currentMeta(),box=document.getElementById("dataUpdateStatus");if(!box)return;
    var d=pendingInfo&&pendingInfo.diff;
    var preview=pendingPack?'<div class="update-preview"><b>見つかった更新：'+esc(pendingPack.version)+'</b><span>生成 '+esc(dateText(pendingPack.generatedAt))+'</span>'+ 
      '<div class="update-count-grid"><span>サポカ追加 <strong>'+d.addedCards+'</strong></span><span>サポカ更新 <strong>'+d.changedCards+'</strong></span><span>スキル追加 <strong>'+d.addedSkills+'</strong></span><span>スキル更新 <strong>'+d.changedSkills+'</strong></span></div>'+ 
      ((pendingPack.releaseNotes||[]).length?'<small>'+pendingPack.releaseNotes.slice(0,4).map(esc).join('／')+'</small>':'')+'</div>':'';
    box.innerHTML='<div class="'+statusClass(kind)+'"><b>'+(message||"最新データを確認できます")+'</b><span>現在：'+esc(meta.version||"不明")+'（サポカ '+currentCards().length+'枚／スキル '+currentSkills().length+'件）</span><small>最終確認：'+esc(dateText(settings.lastChecked))+(settings.lastApplied?'／最終適用：'+esc(dateText(settings.lastApplied)):'')+'</small></div>'+preview;
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
  async function checkUpdate(silent){
    setBusy(true);pendingPack=null;pendingInfo=null;
    try{
      var result;
      if(location.protocol==="file:"){
        result=window.UMA_BUNDLED_DATA_PACK;
        if(!result)throw new Error("更新データを読み込めませんでした");
      }else result=await fetchJson(SOURCE_URL);
      if(!boot.validPack(result))throw new Error("更新データの形式が正しくありません");
      settings.lastChecked=new Date().toISOString();settings.lastError=null;saveSettings();
      var diff=diffPack(result);
      if(isNewer(result)){
        pendingPack=result;pendingInfo={diff:diff};
        render("新しいデータがあります","available");
      }else render("最新データを使用しています","ok");
    }catch(e){
      settings.lastChecked=new Date().toISOString();settings.lastError=String(e.message||e);saveSettings();
      render("更新確認に失敗しました。少し待ってから再度お試しください。","error");
      if(!silent)console.error(e);
    }finally{setBusy(false)}
  }
  function applyPending(){
    if(!pendingPack)return;
    if(!confirm("サポカ・スキルの更新を適用しますか？\n所持チェック、家系図、編成、手動追加カードは保持されます。"))return;
    try{
      localStorage.setItem(boot.PACK_KEY,JSON.stringify(pendingPack));
      settings.lastApplied=new Date().toISOString();settings.lastChecked=settings.lastApplied;saveSettings();
      core.toast("最新データを保存しました");setTimeout(function(){location.reload()},500);
    }catch(e){alert("更新データを保存できませんでした。Safariの保存容量をご確認ください。")}
  }
  function importFile(file){
    var r=new FileReader();
    r.onload=function(){try{var p=JSON.parse(r.result);if(!boot.validPack(p))throw new Error("形式不正");pendingPack=p;pendingInfo={diff:diffPack(p)};render("更新ファイルを読み込みました","available")}catch(e){alert("更新JSONを読み込めませんでした")}};
    r.readAsText(file);
  }
  function resetPack(){
    if(!confirm("オンライン更新データを削除し、本体同梱データへ戻しますか？\n所持情報や家系図は消えません。"))return;
    localStorage.removeItem(boot.PACK_KEY);settings.lastApplied=null;saveSettings();location.reload();
  }
  function bind(){
    var ac=document.getElementById("autoCheckUpdates");if(ac){ac.checked=!!settings.autoCheck;ac.onchange=function(){settings.autoCheck=this.checked;saveSettings()}}
    var check=document.getElementById("checkDataUpdateBtn");if(check)check.onclick=function(){checkUpdate(false)};
    var apply=document.getElementById("applyDataUpdateBtn");if(apply)apply.onclick=applyPending;
    var file=document.getElementById("dataUpdateFile");if(file)file.onchange=function(){var f=this.files&&this.files[0];if(f)importFile(f);this.value=""};
    var reset=document.getElementById("resetOnlineDataBtn");if(reset)reset.onclick=resetPack;
    render("最新データを確認できます","");
    var due=!settings.lastChecked||(Date.now()-Date.parse(settings.lastChecked)>24*60*60*1000);
    if(settings.autoCheck&&due)setTimeout(function(){checkUpdate(true)},700);
  }
  bind();
})();
