(function(){
  "use strict";
  var boot=window.UMA_DATA_UPDATE_BOOTSTRAP,core=window.UmaCore;
  if(!boot||!core)return;

  var SETTINGS_KEY="uma-data-update-settings-v33";
  var OLD_SETTINGS_KEY="uma-data-update-settings-v32";
  var TOKEN_KEY="uma-github-actions-token-v33";
  var MANIFEST_URL="https://gametora.com/data/manifests/umamusume.json";
  var pendingPack=null,pendingInfo=null,sessionToken="",collectionBusy=false;

  function detectGithubRepo(){
    var owner="ulmenkun",repo="uma-factor-manager";
    try{
      var host=String(location.hostname||"");
      if(/\.github\.io$/i.test(host)){
        owner=host.split(".")[0]||owner;
        var parts=String(location.pathname||"").split("/").filter(Boolean);
        if(parts.length)repo=parts[0];
      }
    }catch(e){}
    return{owner:owner,repo:repo};
  }
  var detected=detectGithubRepo();
  var defaults={
    autoCheck:false,
    autoApply:false,
    autoApplyCollected:true,
    sourceUrl:"data/latest-data-pack.json",
    lastChecked:null,
    lastApplied:null,
    lastError:null,
    gameToraHashes:{},
    githubOwner:detected.owner,
    githubRepo:detected.repo,
    githubBranch:"main",
    githubWorkflow:"update-uma-data.yml",
    rememberGithubToken:true,
    pendingRun:null
  };
  function clone(v){return JSON.parse(JSON.stringify(v))}
  function loadSettings(){
    try{
      var saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"null");
      if(!saved)saved=JSON.parse(localStorage.getItem(OLD_SETTINGS_KEY)||"{}");
      return Object.assign({},defaults,saved||{});
    }catch(e){return clone(defaults)}
  }
  var settings=loadSettings();
  function saveSettings(){localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}
  function esc(v){return core.esc(String(v==null?"":v))}
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
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
  function setCheckBusy(on,text){
    var b=document.getElementById("checkDataUpdateBtn");
    if(b){b.disabled=!!on;b.textContent=on?(text||"確認中…"):"作成済みデータだけ確認"}
  }
  function setCollectBusy(on,text){
    collectionBusy=!!on;
    var b=document.getElementById("collectLatestDataBtn");
    if(b){b.disabled=!!on;b.textContent=on?(text||"収集中…"):"Webから自動収集して更新"}
  }
  function statusClass(kind){return"update-status "+(kind||"")}
  function render(message,kind){
    var meta=currentMeta(),box=document.getElementById("dataUpdateStatus");if(!box)return;
    var d=pendingInfo&&pendingInfo.diff;
    var preview=pendingPack?'<div class="update-preview"><b>取得した更新：'+esc(pendingPack.version)+'</b><span>生成 '+esc(dateText(pendingPack.generatedAt))+'</span>'+ 
      '<div class="update-count-grid"><span>サポカ追加 <strong>'+d.addedCards+'</strong></span><span>サポカ更新 <strong>'+d.changedCards+'</strong></span><span>スキル追加 <strong>'+d.addedSkills+'</strong></span><span>スキル更新 <strong>'+d.changedSkills+'</strong></span></div>'+ 
      ((pendingPack.releaseNotes||[]).length?'<small>'+pendingPack.releaseNotes.slice(0,4).map(esc).join('／')+'</small>':'')+'</div>':'';
    box.innerHTML='<div class="'+statusClass(kind)+'"><b>'+(message||"作成済みデータを確認できます")+'</b><span>現在：'+esc(meta.version||"不明")+'（サポカ '+currentCards().length+'枚／スキル '+currentSkills().length+'件）</span><small>最終確認：'+esc(dateText(settings.lastChecked))+(settings.lastApplied?'／最終適用：'+esc(dateText(settings.lastApplied)):'')+'</small></div>'+preview;
    var apply=document.getElementById("applyDataUpdateBtn");if(apply){apply.disabled=!pendingPack;apply.classList.toggle("hidden",!pendingPack)}
    var badge=document.getElementById("dataUpdateBadge");if(badge){badge.textContent=pendingPack?"更新あり":"最新確認";badge.classList.toggle("has-update",!!pendingPack)}
  }
  function renderCollection(message,kind,run){
    var box=document.getElementById("collectionStatus");if(!box)return;
    if(!message){box.innerHTML="";return}
    var link=run&&run.html_url?'<a class="workflow-link" href="'+esc(run.html_url)+'" target="_blank" rel="noopener">GitHubの実行画面を開く</a>':'';
    box.innerHTML='<div class="collection-status '+esc(kind||"")+'"><b>'+esc(message)+'</b>'+link+'<small>収集には通常2〜10分ほどかかります。画面を閉じても、同じ端末で開き直せば続きから確認できます。</small></div>';
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
    setCheckBusy(true,"確認中…");pendingPack=null;pendingInfo=null;
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
        var extra=manifest.changed?"。公開元には変更があります。上の自動収集ボタンを押すと更新パックを作り直せます":"";
        render("作成済みデータは適用済みです"+extra,manifest.changed?"notice":"ok");
      }
    }catch(e){
      settings.lastChecked=new Date().toISOString();settings.lastError=String(e.message||e);saveSettings();
      render("更新確認に失敗："+settings.lastError,"error");
      if(!silent)console.error(e);
    }finally{setCheckBusy(false)}
  }
  function applyPending(auto){
    if(!pendingPack)return;
    if(!auto&&!confirm("サポカ・スキルの更新を適用しますか？\n所持チェック、家系図、編成、手動追加カードは保持されます。"))return;
    try{
      localStorage.setItem(boot.PACK_KEY,JSON.stringify(pendingPack));
      settings.lastApplied=new Date().toISOString();settings.lastChecked=settings.lastApplied;saveSettings();
      core.toast("最新データを保存しました");setTimeout(function(){location.reload()},500);
    }catch(e){alert("更新データを保存できませんでした。Safariの保存容量をご確認ください。");}
  }
  function importFile(file){
    var r=new FileReader();r.onload=function(){try{var p=JSON.parse(r.result);if(!boot.validPack(p))throw new Error("形式不正");pendingPack=p;pendingInfo={diff:diffPack(p),manifest:null};render("更新ファイルを読み込みました","available")}catch(e){alert("更新JSONを読み込めませんでした")}};r.readAsText(file);
  }
  function resetPack(){
    if(!confirm("オンライン更新データを削除し、本体同梱データへ戻しますか？\n所持情報や家系図は消えません。"))return;
    localStorage.removeItem(boot.PACK_KEY);settings.lastApplied=null;saveSettings();location.reload();
  }

  function getToken(){
    var field=document.getElementById("githubToken");
    var fromField=field&&field.value.trim();
    if(fromField)return fromField;
    if(sessionToken)return sessionToken;
    try{return localStorage.getItem(TOKEN_KEY)||""}catch(e){return""}
  }
  function saveGithubForm(showToast){
    var owner=document.getElementById("githubOwner"),repo=document.getElementById("githubRepo"),branch=document.getElementById("githubBranch"),workflow=document.getElementById("githubWorkflow"),remember=document.getElementById("rememberGithubToken"),token=document.getElementById("githubToken");
    settings.githubOwner=(owner&&owner.value.trim())||defaults.githubOwner;
    settings.githubRepo=(repo&&repo.value.trim())||defaults.githubRepo;
    settings.githubBranch=(branch&&branch.value.trim())||"main";
    settings.githubWorkflow=(workflow&&workflow.value.trim())||"update-uma-data.yml";
    settings.rememberGithubToken=!!(remember&&remember.checked);
    var value=token&&token.value.trim();
    if(value)sessionToken=value;
    try{
      if(settings.rememberGithubToken&&value)localStorage.setItem(TOKEN_KEY,value);
      else if(!settings.rememberGithubToken)localStorage.removeItem(TOKEN_KEY);
    }catch(e){}
    saveSettings();
    if(showToast)core.toast("GitHub連携設定を保存しました");
  }
  function githubConfig(){
    saveGithubForm(false);
    return{owner:settings.githubOwner,repo:settings.githubRepo,branch:settings.githubBranch,workflow:settings.githubWorkflow,token:getToken()};
  }
  function githubErrorMessage(status,data){
    var msg=data&&data.message?String(data.message):"GitHub APIエラー";
    if(status===401)return"GitHubトークンが無効です。トークンを作り直してください。";
    if(status===403)return"権限が足りません。トークンのActionsをRead and writeにし、リポジトリのWorkflow permissionsもRead and writeにしてください。";
    if(status===404)return"ワークフローが見つかりません。.github/workflows/update-uma-data.yml と tools フォルダがアップロード済みか確認してください。";
    return msg+"（HTTP "+status+"）";
  }
  async function githubApi(path,options){
    var cfg=githubConfig();
    if(!cfg.token)throw new Error("初回設定を開き、GitHubトークンを入力してください。");
    var opts=Object.assign({method:"GET"},options||{});
    opts.headers=Object.assign({
      Accept:"application/vnd.github+json",
      Authorization:"Bearer "+cfg.token,
      "X-GitHub-Api-Version":"2022-11-28"
    },opts.headers||{});
    if(opts.body&&typeof opts.body!=="string"){
      opts.headers["Content-Type"]="application/json";
      opts.body=JSON.stringify(opts.body);
    }
    var res=await fetch("https://api.github.com"+path,opts);
    if(!res.ok){
      var data=null;try{data=await res.json()}catch(e){}
      throw new Error(githubErrorMessage(res.status,data));
    }
    if(res.status===204)return null;
    return res.json();
  }
  function repoPath(cfg){return"/repos/"+encodeURIComponent(cfg.owner)+"/"+encodeURIComponent(cfg.repo)}
  async function listWorkflowRuns(cfg){
    return githubApi(repoPath(cfg)+"/actions/workflows/"+encodeURIComponent(cfg.workflow)+"/runs?event=workflow_dispatch&branch="+encodeURIComponent(cfg.branch)+"&per_page=10");
  }
  async function findNewRun(cfg,beforeId,startedAt){
    for(var i=0;i<30;i++){
      var data=await listWorkflowRuns(cfg),runs=(data&&data.workflow_runs)||[];
      var run=runs.find(function(x){return String(x.id)!==String(beforeId||"")&&Date.parse(x.created_at||0)>=startedAt-15000});
      if(run)return run;
      renderCollection("GitHubへ収集処理を依頼しました。実行開始を待っています…","running");
      await sleep(3000);
    }
    throw new Error("GitHub Actionsの開始を確認できませんでした。Actions画面をご確認ください。");
  }
  async function getRun(cfg,id){return githubApi(repoPath(cfg)+"/actions/runs/"+encodeURIComponent(id))}
  async function monitorRun(cfg,run){
    settings.pendingRun={id:run.id,owner:cfg.owner,repo:cfg.repo,branch:cfg.branch,workflow:cfg.workflow,html_url:run.html_url||null};saveSettings();
    for(var i=0;i<190;i++){
      var latest=await getRun(cfg,run.id);
      if(latest.status==="completed"){
        settings.pendingRun=null;saveSettings();
        if(latest.conclusion!=="success")throw new Error("自動収集が「"+(latest.conclusion||"失敗")+"」で終了しました。GitHubの実行画面を確認してください。");
        renderCollection("収集が完了しました。更新データを読み込んでいます…","success",latest);
        return latest;
      }
      var label=latest.status==="queued"?"実行待ち":"GameToraから最新サポカ・スキルを収集中";
      renderCollection(label+"…","running",latest);
      await sleep(8000);
    }
    throw new Error("収集処理が30分以内に終わりませんでした。GitHubの実行画面をご確認ください。");
  }
  function decodeGithubContent(value){
    var binary=atob(String(value||"").replace(/\s/g,"")),bytes=new Uint8Array(binary.length);
    for(var i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }
  async function fetchPackFromGithub(cfg){
    var data=await githubApi(repoPath(cfg)+"/contents/data/latest-data-pack.json?ref="+encodeURIComponent(cfg.branch));
    if(!data||!data.content)throw new Error("GitHubから更新データを読み込めませんでした。");
    var pack=JSON.parse(decodeGithubContent(data.content));
    if(!boot.validPack(pack))throw new Error("自動生成された更新データの形式が正しくありません。");
    return pack;
  }
  async function collectLatestData(resume){
    if(collectionBusy)return;
    var cfg=githubConfig();
    if(!cfg.token){
      var details=document.getElementById("githubUpdateSettings");if(details)details.open=true;
      renderCollection("初回だけGitHubトークンの設定が必要です。下の「初回設定・GitHub連携」を開いて入力してください。","error");
      return;
    }
    setCollectBusy(true,resume?"収集状況を確認中…":"収集を開始中…");
    try{
      var run;
      if(resume&&settings.pendingRun&&settings.pendingRun.id){
        run={id:settings.pendingRun.id,html_url:settings.pendingRun.html_url};
        renderCollection("前回開始した収集処理を確認しています…","running",run);
      }else{
        if(!confirm("公開情報から最新サポカ・スキルを収集し、GitHub上の更新パックを作り直します。\n\n未確認の新スキルは暫定値として追加されます。開始しますか？"))return;
        renderCollection("GitHubへ収集処理を依頼しています…","running");
        var before=await listWorkflowRuns(cfg),beforeRun=(before.workflow_runs||[])[0],startedAt=Date.now();
        await githubApi(repoPath(cfg)+"/actions/workflows/"+encodeURIComponent(cfg.workflow)+"/dispatches",{method:"POST",body:{ref:cfg.branch}});
        run=await findNewRun(cfg,beforeRun&&beforeRun.id,startedAt);
      }
      var completed=await monitorRun(cfg,run);
      var pack=await fetchPackFromGithub(cfg),diff=diffPack(pack);
      settings.lastChecked=new Date().toISOString();settings.lastError=null;saveSettings();
      if(isNewer(pack)){
        pendingPack=pack;pendingInfo={diff:diff,manifest:null};
        render("自動収集した新しいデータがあります","available");
        renderCollection("自動収集が正常に完了しました。","success",completed);
        if(settings.autoApplyCollected)applyPending(true);
      }else{
        pendingPack=null;pendingInfo=null;
        render("自動収集を実行しましたが、追加・変更はありませんでした","ok");
        renderCollection("最新状態でした。新しいサポカ・スキルはありません。","success",completed);
      }
    }catch(e){
      settings.lastError=String(e.message||e);saveSettings();
      renderCollection("自動収集に失敗："+settings.lastError,"error",settings.pendingRun||null);
      console.error(e);
    }finally{setCollectBusy(false)}
  }

  function bind(){
    var source=document.getElementById("dataUpdateUrl");if(source){source.value=settings.sourceUrl;source.onchange=function(){settings.sourceUrl=this.value.trim()||defaults.sourceUrl;saveSettings();render("更新元URLを保存しました","notice")}}
    var ac=document.getElementById("autoCheckUpdates");if(ac){ac.checked=!!settings.autoCheck;ac.onchange=function(){settings.autoCheck=this.checked;saveSettings()}}
    var aa=document.getElementById("autoApplyCollected");if(aa){aa.checked=settings.autoApplyCollected!==false;aa.onchange=function(){settings.autoApplyCollected=this.checked;saveSettings()}}
    var check=document.getElementById("checkDataUpdateBtn");if(check)check.onclick=function(){checkUpdate(false)};
    var collect=document.getElementById("collectLatestDataBtn");if(collect)collect.onclick=function(){collectLatestData(false)};
    var apply=document.getElementById("applyDataUpdateBtn");if(apply)apply.onclick=function(){applyPending(false)};
    var file=document.getElementById("dataUpdateFile");if(file)file.onchange=function(){var f=this.files&&this.files[0];if(f)importFile(f);this.value=""};
    var reset=document.getElementById("resetOnlineDataBtn");if(reset)reset.onclick=resetPack;

    var owner=document.getElementById("githubOwner"),repo=document.getElementById("githubRepo"),branch=document.getElementById("githubBranch"),workflow=document.getElementById("githubWorkflow"),remember=document.getElementById("rememberGithubToken"),token=document.getElementById("githubToken");
    if(owner)owner.value=settings.githubOwner||defaults.githubOwner;
    if(repo)repo.value=settings.githubRepo||defaults.githubRepo;
    if(branch)branch.value=settings.githubBranch||"main";
    if(workflow)workflow.value=settings.githubWorkflow||"update-uma-data.yml";
    if(remember)remember.checked=settings.rememberGithubToken!==false;
    try{if(token&&settings.rememberGithubToken!==false)token.value=localStorage.getItem(TOKEN_KEY)||""}catch(e){}
    var saveBtn=document.getElementById("saveGithubSettingsBtn");if(saveBtn)saveBtn.onclick=function(){saveGithubForm(true)};
    var toggle=document.getElementById("toggleGithubToken");if(toggle)toggle.onclick=function(){if(!token)return;var show=token.type==="password";token.type=show?"text":"password";this.textContent=show?"隠す":"表示"};

    render("作成済みデータを確認できます","");
    if(settings.pendingRun&&settings.pendingRun.id){
      renderCollection("前回開始した収集処理があります。状況を再確認します…","running",settings.pendingRun);
      if(getToken())setTimeout(function(){collectLatestData(true)},900);
    }
    var due=!settings.lastChecked||(Date.now()-Date.parse(settings.lastChecked)>24*60*60*1000);
    if(settings.autoCheck&&due)setTimeout(function(){checkUpdate(true)},700);
  }
  bind();
})();
