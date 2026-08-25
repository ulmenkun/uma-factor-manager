#!/usr/bin/env python3
"""Build the Uma Musume support/skill update pack.

GameTora is used to detect new cards and metadata. U-tools is used to collect
separately-labelled training/event skills. A curated multi-source table keeps
recent cards complete when upstream page layouts change. Existing verified
numerical skill values are never replaced by guessed values.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

from curated_patch_v35 import CURATED, ALIASES

ROOT = Path(__file__).resolve().parents[1]
PACK_JSON = ROOT / "data" / "latest-data-pack.json"
PACK_JS = ROOT / "data" / "latest-data-pack.js"
MANIFEST_URL = "https://gametora.com/data/manifests/umamusume.json"
SUPPORT_LIST_URL = "https://gametora.com/ja/umamusume/supports"
TRAINEE_LIST_URL = "https://gamewith.jp/uma-musume/article/show/258299"
BASE_URL = "https://gametora.com"
UTOOLS_LIST_URL = "https://xn--gck1f423k.xn--1bvt37a.tools/supports"
UTOOLS_BASE_URL = "https://xn--gck1f423k.xn--1bvt37a.tools"
MAX_REFRESH_EXISTING = int(os.environ.get("UMA_REFRESH_EXISTING", "20"))
MAX_DETAIL_PAGES = int(os.environ.get("UMA_MAX_DETAIL_PAGES", "90"))

TYPE_WORDS = ("スピード", "スタミナ", "パワー", "根性", "賢さ", "友人", "グループ")
GOLD_HINTS = (
    "一陣の風", "円弧のマエストロ", "弧線のプロフェッサー", "ハヤテ一文字",
    "全身全霊", "好転一息", "コンセントレーション", "盤石の構え",
    "乗り換え上手", "迫る影", "電光石火", "王手", "鍔迫り合い",
    "豪脚", "ノンストップガール", "強攻策", "アンストッパブル",
)


def read_pack() -> dict[str, Any]:
    with PACK_JSON.open(encoding="utf-8") as f:
        pack = json.load(f)
    if pack.get("schemaVersion") != 1:
        raise RuntimeError("Unsupported data pack schema")
    return pack


def write_pack(pack: dict[str, Any]) -> None:
    text = json.dumps(pack, ensure_ascii=False, indent=2) + "\n"
    PACK_JSON.write_text(text, encoding="utf-8")
    compact = json.dumps(pack, ensure_ascii=False, separators=(",", ":"))
    PACK_JS.write_text(
        "window.UMA_BUNDLED_DATA_PACK=" + compact + ";\n", encoding="utf-8"
    )


def normalize(value: Any) -> str:
    text = str(value or "").replace("◯", "○").replace("〇", "○").strip()
    text = ALIASES.get(text, text)
    return re.sub(r"\s+", "", text)


def support_key(card: dict[str, Any]) -> str:
    return normalize(card.get("name")) + "|" + normalize(card.get("title"))


def parse_card_label(text: str) -> tuple[str, str]:
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    cleaned = re.sub(r"^(SSR|SR|R)\s*", "", cleaned, flags=re.I)
    m = re.search(r"[\[［【](.*?)[\]］】]\s*(.+)", cleaned)
    if m:
        return m.group(2).strip(), m.group(1).strip()
    # Detail pages occasionally render name and title on separate lines.
    parts = [x.strip() for x in re.split(r"[\n｜|]", cleaned) if x.strip()]
    return (parts[-1], "") if parts else (cleaned, "")


def infer_type(text: str) -> str:
    normalized = str(text or "")
    for word in TYPE_WORDS:
        if re.search(rf"(?:タイプ|Type)?\s*[:：]?\s*{re.escape(word)}", normalized, re.I):
            return word
    lower = normalized.lower()
    aliases = (
        ("スピード", ("speed", "training_speed")),
        ("スタミナ", ("stamina", "training_stamina")),
        ("パワー", ("power", "training_power")),
        ("根性", ("guts", "training_guts")),
        ("賢さ", ("wisdom", "wit", "intelligence", "training_wisdom")),
        ("友人", ("friend", "training_friend")),
        ("グループ", ("group", "training_group")),
    )
    for label, words in aliases:
        if any(word in lower for word in words):
            return label
    return "不明"


def infer_rarity(text: str) -> str:
    m = re.search(r"\b(SSR|SR|R)\b", text, flags=re.I)
    return m.group(1).upper() if m else ""


def date_from_text(text: str) -> str | None:
    patterns = [
        r"(20\d{2})[./年-](\d{1,2})[./月-](\d{1,2})日?",
        r"(20\d{2})\s+(\d{1,2})\s+(\d{1,2})",
    ]
    for pattern in patterns:
        m = re.search(pattern, text)
        if m:
            try:
                return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
            except ValueError:
                pass
    return None


def skill_guess(name: str, force_grade: str | None = None) -> dict[str, Any]:
    """Conservative fallback used only for newly discovered uncurated skills."""
    n = normalize(name)
    curated_gold={normalize(x) for v in CURATED.values() for x in v.get("goldSkills",[])}
    grade = force_grade or ("gold" if any(normalize(h) == n for h in GOLD_HINTS) or n in curated_gold else "white")
    if grade == "gold":
        sp, evaluation, exam_bonus = 180, 508, 1200
    elif n.endswith("○") and any(x in n for x in ("右回り", "左回り", "春ウマ娘", "夏ウマ娘", "秋ウマ娘", "冬ウマ娘", "良バ場", "道悪", "晴れの日", "曇りの日", "雨の日", "雪の日")):
        sp, evaluation, exam_bonus = 90, 85, 400
    elif any(x in n for x in ("コーナー○", "直線○", "コーナー巧者", "直線巧者")):
        sp, evaluation, exam_bonus = 100, 217, 400
    elif any(x in n for x in ("ためらい", "けん制", "焦り", "駆け引き")):
        sp, evaluation, exam_bonus = 130, 129, 400
    else:
        sp, evaluation, exam_bonus = 160, 217, 400
    return {
        "name": name.strip(),
        "category": "自動追加",
        "priority": 40,
        "note": "公開サポカ情報から自動検出。SP・基礎評価点は暫定値のため後日精査対象。",
        "sp": sp,
        "default": False,
        "tags": ["自動追加", "暫定値"],
        "evaluation": evaluation,
        "evaluationA": evaluation,
        "verifiedEvaluation": False,
        "estimatedEvaluation": True,
        "efficiency": round(evaluation / sp, 3),
        "aptitudeType": None,
        "grade": grade,
        "factorEligible": grade == "white",
        "examBonus": exam_bonus,
    }




def base_trainee_name(value: str) -> str:
    text = re.sub(r"\s+", "", str(value or "").strip())
    # GameWith alt text uses costume labels in parentheses. Genealogy ownership is tracked by base character.
    text = re.sub(r"[（(][^）)]*[）)]$", "", text)
    return text.strip()


async def collect_trainee_roster(page) -> list[str]:
    await page.goto(TRAINEE_LIST_URL, wait_until="domcontentloaded", timeout=90000)
    try:
        await page.wait_for_load_state("networkidle", timeout=25000)
    except PlaywrightTimeoutError:
        pass
    await page.wait_for_timeout(700)
    values = await page.eval_on_selector_all(
        'img[alt]',
        """els => els.map(x => (x.getAttribute('alt') || '').trim()).filter(Boolean)""",
    )
    out=[]; seen=set()
    bad=("アイコン","バナー","logo","ロゴ","ウマ娘攻略","攻略班")
    for value in values:
        name=base_trainee_name(value)
        if not name or len(name)>30 or any(x.lower() in name.lower() for x in bad):
            continue
        # Candidate names on this checker are Japanese character names; exclude generic image alt strings.
        if not re.search(r"[ァ-ヶー一-龠]", name):
            continue
        if name not in seen:
            seen.add(name); out.append(name)
    return out

async def collect_support_links(page) -> list[dict[str, str]]:
    await page.goto(SUPPORT_LIST_URL, wait_until="domcontentloaded", timeout=90000)
    try:
        await page.wait_for_load_state("networkidle", timeout=30000)
    except PlaywrightTimeoutError:
        pass
    await page.wait_for_timeout(1200)
    rows = await page.eval_on_selector_all(
        'a[href*="/umamusume/supports/"]',
        """els => els.map(a => ({href:a.href, text:(a.innerText || a.getAttribute('aria-label') || a.title || '').trim()}))""",
    )
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for row in rows:
        href = row.get("href", "").split("?")[0].rstrip("/")
        if not re.search(r"/supports/\d+(?:-[^/?#]+)?$", href) or href in seen:
            continue
        seen.add(href)
        out.append({"href": href, "text": row.get("text", "")})
    return out



async def collect_utools_links(page) -> list[dict[str, str]]:
    """Collect U-tools support detail links with rendered DOM fallback."""
    await page.goto(UTOOLS_LIST_URL, wait_until="domcontentloaded", timeout=90000)
    try:
        await page.wait_for_load_state("networkidle", timeout=25000)
    except PlaywrightTimeoutError:
        pass
    await page.wait_for_timeout(800)
    rows = await page.eval_on_selector_all(
        'a[href*="/supports/"]',
        """els => els.map(a => ({href:a.href, text:(a.innerText || a.textContent || '').trim()}))""",
    )
    seen=set(); out=[]
    for row in rows:
        href=str(row.get("href") or "").split("?")[0].rstrip("/")
        if not re.search(r"/supports/\d+$", href) or href in seen:
            continue
        seen.add(href); out.append({"href":href,"text":str(row.get("text") or "")})
    return out


def parse_skill_anchor(text: str) -> str:
    text=re.sub(r"\s+"," ",str(text or "")).strip().replace("◯","○").replace("〇","○")
    m=re.match(r"^(.+?)(?:\d+)Pt(?:\s|$)",text)
    value=(m.group(1) if m else text).strip()
    return ALIASES.get(value,value)


async def scrape_utools_detail(page, item: dict[str, str], known_gold: set[str]) -> dict[str, Any] | None:
    await page.goto(item["href"], wait_until="domcontentloaded", timeout=90000)
    try:
        await page.wait_for_load_state("networkidle", timeout=18000)
    except PlaywrightTimeoutError:
        pass
    rows=await page.evaluate("""
      () => {
        const nodes=[...document.querySelectorAll('h1,h2,h3,a[href*="/skills/"]')];
        let section=''; const out=[];
        for(const el of nodes){
          if(/^H[123]$/.test(el.tagName)){
            const t=(el.innerText||el.textContent||'').trim();
            if(t.includes('イベントで取得')) section='event';
            else if(t.includes('トレーニングで取得')) section='training';
            else if(el.tagName!=='H1') section='';
          }else if(section){
            out.push({section,text:(el.innerText||el.textContent||'').trim(),href:el.href||''});
          }
        }
        return out;
      }
    """)
    body=await page.locator("body").inner_text()
    lines=[re.sub(r"\s+"," ",x).strip() for x in body.splitlines() if x.strip()]
    title=""; name=""
    for i,line in enumerate(lines[:20]):
        m=re.fullmatch(r"[\[［【](.+?)[\]］】]",line)
        if m:
            title=m.group(1).strip()
            if i+1<len(lines): name=lines[i+1].strip()
            break
    if not name or not title:
        pn,pt=parse_card_label(item.get("text", "")); name=name or pn; title=title or pt
    hint=[]; event=[]; gold=[]
    for row in rows:
        sk=parse_skill_anchor(row.get("text", ""))
        if not sk or len(sk)>60: continue
        key=normalize(sk)
        target=gold if key in known_gold else (hint if row.get("section")=="training" else event)
        if key not in {normalize(x) for x in target}: target.append(sk)
    if not hint and not event and not gold:
        return None
    return {
      "name":name,"title":title,"hintSkills":hint,"eventSkills":event,"goldSkills":gold,
      "skills":list(dict.fromkeys(hint+event)),"source":"U-tools＋GameTora自動照合",
      "sourceUrl":item["href"],"dataChecked":datetime.now(ZoneInfo("Asia/Tokyo")).date().isoformat(),
      "dataQuality":"multi-source-auto",
    }


def apply_curated(card: dict[str, Any]) -> dict[str, Any]:
    key=next((k for k in CURATED if normalize(k[0])==normalize(card.get("name")) and normalize(k[1])==normalize(card.get("title"))),None)
    if not key: return card
    val=CURATED[key]
    card["hintSkills"]=list(dict.fromkeys(ALIASES.get(x,x) for x in val["hintSkills"]))
    card["eventSkills"]=list(dict.fromkeys(ALIASES.get(x,x) for x in val["eventSkills"]))
    card["goldSkills"]=list(dict.fromkeys(ALIASES.get(x,x) for x in val["goldSkills"]))
    card["skills"]=list(dict.fromkeys(card["hintSkills"]+card["eventSkills"]))
    card["source"]="U-tools＋GameWith／Game8等で複数照合"
    card["dataQuality"]="multi-source-curated"
    card["dataChecked"]=datetime.now(ZoneInfo("Asia/Tokyo")).date().isoformat()
    return card

async def scrape_support_detail(page, item: dict[str, str]) -> dict[str, Any] | None:
    href = item["href"]
    await page.goto(href, wait_until="domcontentloaded", timeout=90000)
    try:
        await page.wait_for_load_state("networkidle", timeout=20000)
    except PlaywrightTimeoutError:
        pass
    await page.wait_for_timeout(500)

    body = await page.locator("body").inner_text()
    title = await page.title()
    headings = await page.locator("h1, h2").all_inner_texts()
    h1 = headings[0].strip() if headings else title

    name = ""
    card_title = ""
    rarity = ""
    m = re.search(r"^(.+?)\s*[（(](SSR|SR|R)[）)]\s*サポートカード", h1, flags=re.I)
    if m:
        name = m.group(1).strip()
        rarity = m.group(2).upper()

    lines = [re.sub(r"\s+", " ", line).strip() for line in body.splitlines()]
    lines = [line for line in lines if line]
    for idx, line in enumerate(lines[:40]):
        tm = re.fullmatch(r"[\[［【](.+?)[\]］】]", line)
        if tm and len(tm.group(1)) < 80:
            card_title = tm.group(1).strip()
            if not name:
                for following in lines[idx + 1:idx + 5]:
                    if following not in {"レア度", "得意練習", "実装日"}:
                        name = following.strip()
                        break
            break

    if not name or not card_title:
        parsed_name, parsed_title = parse_card_label(item.get("text") or h1)
        name = name or parsed_name
        card_title = card_title or parsed_title
    rarity = rarity or infer_rarity(item.get("text", "") + "\n" + body[:2500] + "\n" + title)
    if rarity not in {"SSR", "SR"}:
        return None

    images = await page.eval_on_selector_all(
        "img",
        """els => els.slice(0,80).map(img => [img.alt || '', img.title || '', img.src || ''].join(' '))""",
    )
    type_text = body + "\n" + "\n".join(images)

    skill_rows = await page.eval_on_selector_all(
        'a[href*="/umamusume/skills/"]',
        """els => els.map(a => ({
          text:(a.innerText || a.textContent || '').trim(),
          aria:(a.getAttribute('aria-label') || '').trim(),
          title:(a.getAttribute('title') || '').trim(),
          alt:((a.querySelector('img') || {}).alt || '').trim(),
          href:a.href || ''
        }))""",
    )
    skills: list[str] = []
    for row in skill_rows:
        candidates = [row.get("text"), row.get("aria"), row.get("title"), row.get("alt")]
        skill = next((str(v).strip() for v in candidates if v and 1 < len(str(v).strip()) < 60), "")
        skill = re.sub(r"\s+", " ", skill).strip().replace("◯", "○").replace("〇", "○")
        if skill and skill not in skills and not skill.lower().startswith("image"):
            skills.append(skill)

    support_id = re.search(r"/supports/(\d+)", href)
    sid = support_id.group(1) if support_id else hashlib.sha1(href.encode()).hexdigest()[:12]
    checked = datetime.now(ZoneInfo("Asia/Tokyo")).date().isoformat()
    return {
        "id": f"gt-{sid}",
        "builtin": True,
        "rarity": rarity,
        "name": name,
        "title": card_title,
        "type": infer_type(type_text),
        "owned": False,
        "releaseDate": date_from_text(body),
        "priority": 60 if rarity == "SSR" else 42,
        "tags": ["自動更新", "最新候補"],
        "why": "公開データから自動追加。必要因子のカバー数に応じて自動編成で評価します。",
        "hintSkills": skills,
        "eventSkills": [],
        "goldSkills": [],
        "skills": skills,
        "dataChecked": checked,
        "source": "GameToraボタン収集",
        "sourceUrl": href,
        "sourceSupportId": sid,
        "dataQuality": "auto-scraped",
    }


def merge_card(existing: dict[str, Any] | None, scraped: dict[str, Any]) -> dict[str, Any]:
    if not existing:
        return apply_curated(scraped)
    out = deepcopy(existing)
    for key in ("rarity", "name", "title", "type", "releaseDate", "dataChecked", "sourceUrl", "sourceSupportId", "dataQuality"):
        if scraped.get(key): out[key] = scraped[key]
    is_utools=str(scraped.get("source") or "").startswith("U-tools")
    for key in ("hintSkills", "eventSkills", "goldSkills", "skills"):
        values=list(scraped.get(key) or []) if is_utools else list(out.get(key) or [])+list(scraped.get(key) or [])
        merged=[]; seen=set()
        for value in values:
            value=ALIASES.get(str(value).strip(),str(value).strip()); nk=normalize(value)
            if nk and nk not in seen: seen.add(nk); merged.append(value)
        if merged or is_utools: out[key]=merged
    if scraped.get("source"): out["source"]=scraped["source"]
    return apply_curated(out)


async def run() -> int:
    pack = read_pack()
    manifest = requests.get(MANIFEST_URL, timeout=30).json()
    next_hashes = {
        "supportCards": manifest.get("support-cards", ""),
        "skills": manifest.get("skills", ""),
    }
    previous_hashes = pack.get("externalHashes") or {}
    manifest_changed = next_hashes != previous_hashes
    force_refresh = os.environ.get("UMA_FORCE_REFRESH", "0").lower() in {"1", "true", "yes"}
    if not manifest_changed and not force_refresh:
        print("No upstream manifest changes detected.")
        return 0

    cards = pack.get("supportCards", [])
    by_key = {support_key(c): c for c in cards}
    by_source_id = {str(c.get("sourceSupportId")): c for c in cards if c.get("sourceSupportId")}
    details: list[dict[str, Any]] = []
    trainee_roster: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(locale="ja-JP", user_agent="UmaDataUpdater/3.5 (+GitHub Actions)")
        page = await context.new_page()
        links = await collect_support_links(page)
        refresh_budget = MAX_REFRESH_EXISTING
        selected: list[dict[str, str]] = []
        for item in links:
            n, t = parse_card_label(item.get("text", ""))
            known = by_key.get(normalize(n) + "|" + normalize(t)) if n else None
            if not known or refresh_budget > 0:
                selected.append(item)
                if known:
                    refresh_budget -= 1
            if len(selected) >= MAX_DETAIL_PAGES:
                break
        for idx, item in enumerate(selected, 1):
            try:
                detail = await scrape_support_detail(page, item)
                if detail:
                    details.append(detail)
                    print(f"[GameTora {idx}/{len(selected)}] {detail['rarity']} {detail['name']} {detail['title']}")
            except Exception as exc:  # continue when a single page changes layout
                print(f"WARN GameTora detail failed: {item['href']}: {exc}", file=sys.stderr)

        known_gold={normalize(s.get("name")) for s in pack.get("skills",[]) if s.get("grade")=="gold"}
        for val in CURATED.values():
            known_gold.update(normalize(x) for x in val.get("goldSkills",[]))
        trainee_roster=[]
        try:
            trainee_roster=await collect_trainee_roster(page)
            print(f"[GameWith] trainee roster: {len(trainee_roster)} unique base characters")
        except Exception as exc:
            print(f"WARN trainee roster failed: {exc}",file=sys.stderr)
        try:
            ulinks=await collect_utools_links(page)
            # U-tools is normally ordered newest first. Refresh the newest detail pages
            # directly, because list-card text can change and should not decide whether a
            # recent card receives its skill data.
            uselected=ulinks[:MAX_DETAIL_PAGES]
            for idx,item in enumerate(uselected,1):
                try:
                    detail=await scrape_utools_detail(page,item,known_gold)
                    if detail:
                        # U-tools data is merged after GameTora and therefore wins for skill sections.
                        details.append(detail)
                        print(f"[U-tools {idx}/{len(uselected)}] {detail['name']} {detail['title']}")
                except Exception as exc:
                    print(f"WARN U-tools detail failed: {item['href']}: {exc}",file=sys.stderr)
        except Exception as exc:
            print(f"WARN U-tools list failed: {exc}",file=sys.stderr)
        await browser.close()

    added_cards = 0
    updated_cards = 0
    for scraped in details:
        existing = by_source_id.get(str(scraped.get("sourceSupportId"))) or by_key.get(support_key(scraped))
        merged = merge_card(existing, scraped)
        if existing:
            if merged != existing:
                existing.clear()
                existing.update(merged)
                updated_cards += 1
        else:
            cards.append(merged)
            by_key[support_key(merged)] = merged
            by_source_id[str(merged.get("sourceSupportId"))] = merged
            added_cards += 1

    for idx,card in enumerate(cards):
        cards[idx]=apply_curated(card)

    skill_map = {normalize(s.get("name")): s for s in pack.get("skills", [])}
    added_skills = 0
    for card in cards:
        gold_names={normalize(x) for x in card.get("goldSkills") or []}
        all_skills = list(card.get("skills") or []) + list(card.get("hintSkills") or []) + list(card.get("eventSkills") or []) + list(card.get("goldSkills") or [])
        for name in all_skills:
            key = normalize(name)
            if key and key not in skill_map:
                guessed = skill_guess(str(name), "gold" if key in gold_names else None)
                pack["skills"].append(guessed)
                skill_map[key] = guessed
                added_skills += 1
            elif key in gold_names and key in skill_map and skill_map[key].get("grade") != "gold":
                sk=skill_map[key]; sk["grade"]="gold"; sk["factorEligible"]=False; sk["examBonus"]=1200
                if sk.get("estimatedEvaluation") or not sk.get("verifiedEvaluation"):
                    sk.update({"sp":180,"evaluation":508,"evaluationA":508,"efficiency":round(508/180,3)})

    previous_trainees=list(pack.get("trainees") or [])
    trainee_changed=False
    if trainee_roster and len(trainee_roster)>=100:
        pack["trainees"]=trainee_roster
        pack["traineeDataVersion"]=datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y-%m-%d")
        trainee_changed=(trainee_roster!=previous_trainees)

    now = datetime.now(timezone.utc)
    pack["version"] = now.astimezone(ZoneInfo("Asia/Tokyo")).strftime("%Y-%m-%d-auto-%H%M")
    pack["generatedAt"] = now.isoformat().replace("+00:00", "Z")
    pack["sourceLabel"] = "U-tools＋GameWith／Game8＋GameTora複数照合"
    pack["externalHashes"] = next_hashes
    pack["releaseNotes"] = [
        f"サポカ自動追加 {added_cards}枚・既存更新 {updated_cards}枚",
        f"新規スキル名 {added_skills}件を追加",
        f"育成ウマ娘所持リスト {len(pack.get('trainees') or [])}人" + ("へ更新" if trainee_changed else "を確認"),
        "U-toolsでトレーニング／イベント取得を分離しGameToraと照合",
        "直近の不足カードは複数攻略サイト照合済みデータで補完",
        "既存の精査済みSP・基礎評価点は維持し、未確認値のみ暫定表示",
    ]
    pack.setdefault("sources", [])
    source_defs=[
      {"name":"GameTora サポートカード一覧","url":SUPPORT_LIST_URL,"role":"新規カード・タイプ・実装情報の検出"},
      {"name":"GameWith 育成ウマ娘所持率チェッカー","url":TRAINEE_LIST_URL,"role":"育成実装済みウマ娘の所持リスト更新"},
      {"name":"U-tools サポートカード詳細","url":UTOOLS_LIST_URL,"role":"トレーニング取得・イベント取得スキルの自動照合"},
      {"name":"GameWith ウマ娘攻略","url":"https://gamewith.jp/uma-musume/","role":"直近カードの副照合"},
      {"name":"Game8 ウマ娘攻略","url":"https://game8.jp/umamusume","role":"直近カードの副照合"},
    ]
    for sd in source_defs:
        if not any(isinstance(x,dict) and x.get("url")==sd["url"] for x in pack["sources"]): pack["sources"].append(sd)

    # Do not create noisy commits if neither source nor normalized data changed.
    if not manifest_changed and not added_cards and not updated_cards and not added_skills and not trainee_changed:
        print("No upstream data changes detected.")
        return 0
    write_pack(pack)
    print(json.dumps({"cards": len(cards), "skills": len(pack["skills"]), "addedCards": added_cards, "updatedCards": updated_cards, "addedSkills": added_skills}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
