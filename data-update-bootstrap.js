(function(){
  "use strict";
  var PACK_KEY="uma-online-data-pack-v32";
  var packRoot=window.UMA_SUPPORT_LIBRARY_V31;
  var cfg=window.AUTO_FACTOR_DATA;
  if(!packRoot||!cfg)return;

  function clone(v){return JSON.parse(JSON.stringify(v))}
  function normalizeSkillName(v){return String(v||"").replace(/◯|〇/g,"○").trim()}
  function validPack(p){
    return !!(p&&Number(p.schemaVersion)===1&&Array.isArray(p.supportCards)&&Array.isArray(p.skills)&&p.version);
  }
  function supportKey(c){return String(c&&c.name||"")+"|"+String(c&&c.title||"")}
  function mergeBy(base,updates,keyFn,removed){
    var out=[],by={},remove={};
    (removed||[]).forEach(function(x){remove[String(x)]=true});
    (base||[]).forEach(function(x){var k=keyFn(x);if(k&&!remove[k]){by[k]=clone(x);out.push(by[k])}});
    (updates||[]).forEach(function(x){if(!x)return;var k=keyFn(x);if(!k||remove[k])return;if(by[k]){Object.keys(x).forEach(function(f){by[k][f]=clone(x[f])})}else{by[k]=clone(x);out.push(by[k])}});
    return out;
  }
  function applyPack(pack){
    if(!validPack(pack))return false;
    var removedSupport=(pack.removedSupportCardIds||[]).map(String);
    var supportBase=(packRoot.cards||[]).filter(function(c){return removedSupport.indexOf(String(c.id||""))<0});
    var supportById={};supportBase.forEach(function(c){if(c.id)supportById[String(c.id)]=c});
    (pack.supportCards||[]).forEach(function(incoming){
      if(!incoming||removedSupport.indexOf(String(incoming.id||""))>=0)return;
      var old=(incoming.id&&supportById[String(incoming.id)])||supportBase.find(function(c){return supportKey(c)===supportKey(incoming)});
      if(old){Object.keys(incoming).forEach(function(k){old[k]=clone(incoming[k])})}
      else{var x=clone(incoming);supportBase.push(x);if(x.id)supportById[String(x.id)]=x}
    });
    packRoot.cards.splice.apply(packRoot.cards,[0,packRoot.cards.length].concat(supportBase));
    packRoot.version=pack.version;

    var removedSkills={};(pack.removedSkillNames||[]).forEach(function(n){removedSkills[normalizeSkillName(n)]=true});
    var skillBase=(cfg.skillCatalog||[]).filter(function(s){return !removedSkills[normalizeSkillName(s.name)]});
    var skillBy={};skillBase.forEach(function(s){skillBy[normalizeSkillName(s.name)]=s});
    (pack.skills||[]).forEach(function(incoming){
      if(!incoming)return;var name=normalizeSkillName(incoming.name);if(!name||removedSkills[name])return;
      incoming=clone(incoming);incoming.name=name;
      if(skillBy[name])Object.keys(incoming).forEach(function(k){skillBy[name][k]=clone(incoming[k])});
      else{skillBy[name]=incoming;skillBase.push(incoming)}
    });
    cfg.skillCatalog.splice.apply(cfg.skillCatalog,[0,cfg.skillCatalog.length].concat(skillBase));
    cfg.dataVersion=(pack.sourceLabel?pack.sourceLabel+"／":"")+pack.version;
    window.UMA_ACTIVE_DATA_PACK_META={
      version:pack.version,generatedAt:pack.generatedAt||null,sourceLabel:pack.sourceLabel||"オンライン更新パック",
      supportCount:packRoot.cards.length,skillCount:cfg.skillCatalog.length,externalHashes:pack.externalHashes||{},releaseNotes:pack.releaseNotes||[],stored:true
    };
    return true;
  }

  var bundled=window.UMA_BUNDLED_DATA_PACK;
  window.UMA_BUILTIN_DATA_PACK_META={
    version:(bundled&&bundled.version)||packRoot.version||"bundled",
    generatedAt:(bundled&&bundled.generatedAt)||null,
    supportCount:(packRoot.cards||[]).length,
    skillCount:(cfg.skillCatalog||[]).length
  };
  var stored=null;
  try{stored=JSON.parse(localStorage.getItem(PACK_KEY)||"null")}catch(e){localStorage.removeItem(PACK_KEY)}
  // A previously applied online pack must not hide a newer bundled release.
  // This is especially important when the app itself contains corrected card data.
  if(stored&&bundled){
    var storedTime=Date.parse(stored.generatedAt||"")||0;
    var bundledTime=Date.parse(bundled.generatedAt||"")||0;
    if(bundledTime>storedTime){stored=null;try{localStorage.removeItem(PACK_KEY)}catch(e){}}
  }
  if(!applyPack(stored)){
    window.UMA_ACTIVE_DATA_PACK_META={
      version:window.UMA_BUILTIN_DATA_PACK_META.version,
      generatedAt:window.UMA_BUILTIN_DATA_PACK_META.generatedAt,
      sourceLabel:"本体同梱データ",
      supportCount:(packRoot.cards||[]).length,
      skillCount:(cfg.skillCatalog||[]).length,
      externalHashes:(bundled&&bundled.externalHashes)||{},releaseNotes:(bundled&&bundled.releaseNotes)||[],stored:false
    };
  }
  window.UMA_DATA_UPDATE_BOOTSTRAP={PACK_KEY:PACK_KEY,validPack:validPack,applyPack:applyPack,clone:clone};
})();
