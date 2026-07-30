(function(){
  "use strict";
  var NS="uma-factor-v35-4c8d2a";
  var COUNTER="external-first-device";
  var BASE="https://api.counterapi.dev/v1/"+encodeURIComponent(NS)+"/"+encodeURIComponent(COUNTER);
  var OWNER_KEY="uma-visitor-owner-device-v35";
  var COUNTED_KEY="uma-visitor-counted-device-v35";
  var box,summary,countEl,statusEl,toggleBtn,refreshBtn;

  function isOwner(){try{return localStorage.getItem(OWNER_KEY)==="1"}catch(e){return false}}
  function wasCounted(){try{return localStorage.getItem(COUNTED_KEY)==="1"}catch(e){return false}}
  function setLocal(k,v){try{if(v)localStorage.setItem(k,"1");else localStorage.removeItem(k)}catch(e){}}
  function countFrom(data){
    if(!data)return null;
    var candidates=[data.count,data.value,data.data&&data.data.count,data.data&&data.data.value];
    for(var i=0;i<candidates.length;i++){var n=Number(candidates[i]);if(Number.isFinite(n))return Math.max(0,Math.round(n))}
    return null;
  }
  async function api(action){
    var url=BASE+(action?"/"+action:"")+"?t="+Date.now();
    var res=await fetch(url,{method:"GET",mode:"cors",cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer"});
    if(!res.ok)throw new Error("HTTP "+res.status);
    return countFrom(await res.json());
  }
  function render(count,message){
    var owner=isOwner();
    box.classList.toggle("owner-device",owner);
    toggleBtn.textContent=owner?"管理者端末設定を解除":"この端末を管理者端末にする";
    refreshBtn.classList.toggle("hidden",!owner);
    if(owner){
      countEl.textContent=Number.isFinite(count)?String(count):"—";
      summary.textContent=Number.isFinite(count)?(count>0?"外部アクセスあり":"外部アクセスはまだありません"):"外部アクセスを確認";
      statusEl.textContent=message||"この数字は、このブラウザ以外から初めて開かれた端末・ブラウザ数の目安です。";
    }else{
      countEl.textContent="非表示";
      summary.textContent="管理者向けアクセス確認";
      statusEl.textContent=message||"管理者端末に設定すると、自分のアクセスを除いた概算件数を表示します。";
    }
  }
  async function initialize(){
    render(null,"確認中…");
    try{
      if(isOwner()){
        render(await api(""));
      }else if(!wasCounted()){
        var c=await api("up"); setLocal(COUNTED_KEY,true);
        render(c,"このブラウザは一般アクセスとして初回1回だけ計測されました。管理者本人の端末なら下のボタンで除外できます。");
      }else{
        render(null,"このブラウザはすでに初回アクセスとして計測済みです。管理者本人の端末なら下のボタンで除外できます。");
      }
    }catch(e){render(null,"アクセス確認サービスへ接続できませんでした。広告ブロックや通信状況により計測されない場合があります。");}
  }
  async function toggleOwner(){
    toggleBtn.disabled=true;
    try{
      if(isOwner()){
        setLocal(OWNER_KEY,false); setLocal(COUNTED_KEY,false);
        render(null,"管理者端末設定を解除しました。次回表示時から一般アクセスとして1回計測されます。");
      }else{
        if(wasCounted()){
          try{await api("down")}catch(e){}
        }
        setLocal(COUNTED_KEY,false); setLocal(OWNER_KEY,true);
        var c=null; try{c=await api("")}catch(e){}
        render(c,"この端末を管理者端末に設定し、すでに計測されていた1件を可能な範囲で差し引きました。");
      }
    }finally{toggleBtn.disabled=false}
  }
  document.addEventListener("DOMContentLoaded",function(){
    box=document.getElementById("visitorStatsPanel"); summary=document.getElementById("visitorStatsSummary");
    countEl=document.getElementById("externalVisitorCount"); statusEl=document.getElementById("visitorStatsStatus");
    toggleBtn=document.getElementById("visitorOwnerToggle"); refreshBtn=document.getElementById("visitorStatsRefresh");
    if(!box||!summary||!countEl||!statusEl||!toggleBtn||!refreshBtn)return;
    toggleBtn.addEventListener("click",toggleOwner);
    refreshBtn.addEventListener("click",async function(){refreshBtn.disabled=true;try{render(await api(""),"最新の概算件数を読み込みました。")}catch(e){render(null,"件数を取得できませんでした。しばらくしてから再確認してください。")}finally{refreshBtn.disabled=false}});
    initialize();
  });
})();
