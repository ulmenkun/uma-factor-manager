#!/usr/bin/env python3
from __future__ import annotations
import json, re
from pathlib import Path
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
PACK=ROOT/'data/latest-data-pack.json'
PACKJS=ROOT/'data/latest-data-pack.js'
SUPPORT=ROOT/'support-data-v31.js'

# Recent cards that were missing or clearly underfilled in v3.4.
# Event/training/gold are separated from multiple publicly available databases.
CURATED = {
('駿川たづな','一杯のノスタルジア'): {
 'hintSkills':[], 'eventSkills':['心惹かれて','遊びはおしまいっ！','中盤巧者'], 'goldSkills':['お先に失礼っ！']},
('サクラチヨノオー','賑やかな未来を乗せて走れ!'): {
 'hintSkills':['スタミナキープ','闘争心','イグニッション','会心の一歩','品行方正','揺るがぬ信念','さらなる高みへ','憧れを越えて','気ままな足取り','力業','余勢を駆って','実直な走り'],
 'eventSkills':['春ウマ娘○'], 'goldSkills':['強者の証','継続は力なり']},
('タップダンスシチー','刀光散らしてClash!'): {
 'hintSkills':['集中力','急ぎ足','逃げ直線○','逃げコーナー○','危険回避','先頭プライド','しゃかりき','一番乗り','序盤巧者','素直な一歩','逃げ切り体勢','追い風に乗って','みなぎる闘志','弾みをつけて'],
 'eventSkills':['逃げるが勝ち!','先頭プライド'], 'goldSkills':['コンセントレーション','トップランナー','飛竜乗雲']},
('ヴィクトワールピサ',"Let's Go Together!"): {
 'hintSkills':['末脚','コーナー回復○','中山レース場○','ウマ好み','イグニッション','中盤巧者','活路を拓く！','健脚','あふれる活力'],
 'eventSkills':['心惹かれて'], 'goldSkills':['パスファインダー']},
('カジノドライヴ','American Dream'): {
 'hintSkills':[], 'eventSkills':['スリップストリーム','末脚','ウマ好み'], 'goldSkills':['いいとこ入った！']},
('マルシュロレーヌ','響け、二人の凱歌'): {
 'hintSkills':['好戦的','レコメンド','明るい兆し','砂浴び○','裏腹なキモチ','ダート直線○','ダートコーナー○','精進','砂蹴り','バイタリティ','前列狙い','伏兵○','踏み込み上手'],
 'eventSkills':['轟く足音','心惹かれて'], 'goldSkills':['優雅な砂浴び','点滴穿石']},
('タッカーブライン','本能は吼えているか！？'): {
 'hintSkills':[], 'eventSkills':['活路を拓く！','直線回復','端緒'], 'goldSkills':['パスファインダー']},
('タマモクロス','白き稲妻の如く'): {
 'hintSkills':['垂れウマ回避','末脚','尻尾上がり','型破り','快速','一歩ずつ前へ','比類なき','健脚'],
 'eventSkills':['スリップストリーム','序盤巧者','ウマ込み冷静'], 'goldSkills':['神速','真骨頂','悠久走破']},
('メジロライアン','瞳に闘志を胸に勝利の渇望を'): {
 'hintSkills':['差し切り体勢','差しコーナー○','ありったけ','ワンチャンス','恐れぬ心','駆け降り','下準備','足がかり','不断の鍛錬'],
 'eventSkills':['ペースキープ'], 'goldSkills':['秘めた闘魂']},
('フサイチパンドラ','ゼッタイ☆天才伝説'): {
 'hintSkills':['臨機応変','末脚','好位追走','先行コーナー○','直滑降','確かな足取り','飛躍の予感'],
 'eventSkills':['切り替え上手'], 'goldSkills':['勇迅円刃']},
('ウインバリアシオン','水面のプリンシパル'): {
 'hintSkills':['右回り○','夏ウマ娘○','直線回復','内弁慶','長距離直線○','脇目も振らず','ごぼう抜き','奮闘','活路を拓く！','張り切り','臆せぬ心'],
 'eventSkills':['比類なき','長距離コーナー○'], 'goldSkills':['エネルギッシュ','内的体験']},
('ドゥラメンテ','Tranquillo'): {
 'hintSkills':['スリップストリーム','打開策','覇気十分','むきだしの情熱','追込直線○','追込コーナー○','影を追って','追駆','直線一気','不動の心'],
 'eventSkills':['イグニッション'], 'goldSkills':['飛翔脚','残影']},
('ヴィブロス','極上スマイルはっし～ん♪'): {
 'hintSkills':['下り坂巧者','負けん気','十万バリキ','一歩から','アクセラレーション','自信家','差しのコツ○'],
 'eventSkills':['差し直線○'], 'goldSkills':['破竹の勢い']},
('ステイゴールド','気まぐれ渡り星'): {
 'hintSkills':['コーナー巧者○','ウマ好み','地固め','スリップストリーム','しとやかな足取り','イグニッション','折れない心','一歩ずつ前へ','比類なき','夢への挑戦','心惹かれて','気ままな足取り'],
 'eventSkills':['比類なき','直線巧者'], 'goldSkills':['ネバーギブアップ','好奇心','自由奔放']},
('クロノジェネシス','この先の未来で'): {
 'hintSkills':['非根幹距離○','ウマ込み冷静','食らいつき','揺るがぬ信念','克己心','逸る足取り'],
 'eventSkills':['正面突破'], 'goldSkills':['キラーチューン']},
('カルストンライトオ','カルストンライトオ、猫です'): {
 'hintSkills':['直線巧者','遊びはおしまいっ！','素直な一歩','短距離直線○','胸の高鳴り','無二','無三','待ったなし','スプリントギア','急発進','譲れぬ一歩','ポジションセンス','秋ウマ娘○'],
 'eventSkills':['直線巧者','直線コース○'], 'goldSkills':['意気衝天','問答無用']},
('ダンツフレーム','今日が楽しかったから、'): {
 'hintSkills':['阪神レース場○','抜け出し準備','差し切り体勢','フルスロットル','折れない心','品行方正','さらなる高みへ'],
 'eventSkills':['食らいつき'], 'goldSkills':['決死の覚悟']},
('ダイイチルビー','Inseparable'): {
 'hintSkills':['短距離直線○','ひたむき前進','胸の高鳴り','誇りを抱いて','プレリュード','差しコーナー○','一足飛び','ターニングポイント','差し切り体勢','仕掛け準備','秋ウマ娘○'],
 'eventSkills':['詰め寄り'], 'goldSkills':['至宝の輝き']},
('フジキセキ','壇上より魔法を込めて'): {
 'hintSkills':['直線巧者','垂れウマ回避','積極策','マイルコーナー○','スリップストリーム','真っ向勝負','攻めの姿勢','心弾んで','品行方正','後先恐れず','逸る足取り','気丈な姿勢'],
 'eventSkills':['抜け出し準備'], 'goldSkills':['不抜の気概']},
('エイシンフラッシュ','Zirkus der Träume'): {
 'hintSkills':['直線巧者','ペースアップ','差し直線○','差しコーナー○','遊びはおしまいっ！','恐れぬ心','フルスロットル','溢れる情熱','一歩から','静かな熱'],
 'eventSkills':['下準備','レースの真髄・速','前だけ見据えて','綺羅星','徹底マーク○'], 'goldSkills':['千里の道','陽炎']},
('トーセンジョーダン','All-Out Brilliance'): {
 'hintSkills':['東京レース場○','差し切り体勢','がんばり屋','遊びはおしまいっ！','静かな呼吸','溢れる情熱','折れない心','光差す方へ'],
 'eventSkills':['ラッキーセブン'], 'goldSkills':['大胆不敵']},
('カレンブーケドール','決意のフローラ'): {
 'hintSkills':['春ウマ娘○','コーナー回復○','スタミナキープ','攻めの姿勢','食らいつき','本領発揮','飛躍の予感','素直な一歩','光明','活路を拓く！','目覚めの時'],
 'eventSkills':['さらなる高みへ'], 'goldSkills':['円弧のマエストロ','開花']},
('保科健子','ゆるり、ゆこま旅館'): {
 'hintSkills':[], 'eventSkills':['遊びはおしまいっ！','序盤巧者','中盤巧者'], 'goldSkills':['お先に失礼っ！']},
('トウカイテイオー','天才的ユートピア'): {
 'hintSkills':['先行直線○','先行コーナー○','真っ向勝負','攻めの姿勢','さらなる高みへ','逸る足取り','己を信じて','憧れを越えて','光明','勇気の一歩','目覚めの時','意地っ張り'],
 'eventSkills':['比類なき','躍動','先行直線○'], 'goldSkills':['迸る気迫','正々堂々','夢の舞台へ']},
('ミホノブルボン','無機の闘志'): {
 'hintSkills':['根幹距離○','ポジションセンス','先駆け','急ぎ足','逃げ直線○','逃げコーナー○','先頭プライド','地固め','自制心','切り込み隊長','抜きん出る一歩','逃げるが勝ち！'],
 'eventSkills':['ポジションセンス','集中力'], 'goldSkills':['先手必勝','傑出']},
('ゴールドシップ','激録！爆走トナカイ事件'): {
 'hintSkills':['冬ウマ娘○','直線一気','長距離コーナー○','追込直線○','ウマ好み','ロックオン','ごぼう抜き','たぎる血潮','不動の心','急襲','登竜門','捕捉','追駆'],
 'eventSkills':['好機を捉えて','阪神レース場○'], 'goldSkills':['迫る影','心頭滅却']},
('フェノーメノ','ぬくもりのノエル'): {
 'hintSkills':['長距離コーナー○','影打','抜かりなし','本領発揮','込み上げる熱','狙いを定めて','決定打','地道に重ねて','思い切り','勇気の一歩','力業'],
 'eventSkills':['地道に重ねて','狙いを定めて'], 'goldSkills':['真打','一点集中']},
('オルフェーヴル','黄金の夢に溺れよ'): {
 'hintSkills':['冷静','早仕掛け','打開策','快速','込み上げる熱','推力十分','好機を捉えて','影を追って'],
 'eventSkills':['型破り'], 'goldSkills':['下校後のスペシャリスト']},
('イナリワン','故郷に錦を飾るんでい！'): {
 'hintSkills':['右回り○','長距離直線○','差しコーナー○','静かな呼吸','がむしゃら','大急ぎ','込み上げる熱','むきだしの情熱','急襲','下準備','臆せぬ心','ここ一番'],
 'eventSkills':['大急ぎ','京都レース場○'], 'goldSkills':['無我夢中','用意周到']},
}

ALIASES={
 '遊びはおしまいっ!':'遊びはおしまいっ！',
 '逃げるが勝ち!':'逃げるが勝ち！',
 '憧れを超えて':'憧れを越えて',
}

def n(v):
    x=str(v or '').replace('◯','○').replace('〇','○').strip()
    x=ALIASES.get(x,x)
    return re.sub(r'\s+','',x)

def uniq(values):
    out=[]; seen=set()
    for v in values:
        v=ALIASES.get(str(v).strip(),str(v).strip())
        k=n(v)
        if k and k not in seen:
            seen.add(k); out.append(v)
    return out

def guess_skill(name, grade='white'):
    g=grade
    if g=='gold': sp,e,b=180,508,1200
    elif name.endswith('○') and any(x in name for x in ('右回り','左回り','春ウマ娘','夏ウマ娘','秋ウマ娘','冬ウマ娘','良バ場','道悪','晴れの日','曇りの日','雨の日','雪の日','レース場')): sp,e,b=90,85,400
    elif any(x in name for x in ('コーナー○','直線○','コーナー巧者','直線巧者')): sp,e,b=100,217,400
    elif any(x in name for x in ('ためらい','けん制','焦り','駆け引き')): sp,e,b=130,129,400
    else: sp,e,b=160,217,400
    return {'name':name,'category':'最新サポカ','priority':55,'note':'複数攻略データで取得元を照合。SP・基礎評価点は未精査の場合のみ暫定値。','sp':sp,'default':False,'tags':['最新サポカ']+(['暫定値'] if True else []),'evaluation':e,'evaluationA':e,'verifiedEvaluation':False,'estimatedEvaluation':True,'efficiency':round(e/sp,3),'aptitudeType':None,'grade':g,'factorEligible':g=='white','examBonus':b}

def patch_pack(pack):
    cards=pack['supportCards']
    # Canonicalize spelling/punctuation variants on every card, not only patched cards.
    for card in cards:
        for field in ('hintSkills','eventSkills','goldSkills','skills'):
            card[field]=uniq([ALIASES.get(str(x).strip(),str(x).strip()) for x in card.get(field,[])])
    matched=0
    all_gold=set()
    for key,val in CURATED.items():
        card=next((c for c in cards if n(c.get('name'))==n(key[0]) and n(c.get('title'))==n(key[1])),None)
        if not card:
            print('WARN card missing',key)
            continue
        card['hintSkills']=uniq(val['hintSkills'])
        card['eventSkills']=uniq(val['eventSkills'])
        card['goldSkills']=uniq(val['goldSkills'])
        card['skills']=uniq(card['hintSkills']+card['eventSkills'])
        card['dataChecked']='2026-07-30'
        card['source']='U-tools＋GameWith／Game8等で取得スキルを複数照合'
        card['dataQuality']='multi-source-curated'
        card['tags']=uniq(list(card.get('tags') or [])+['取得スキル精査済み'])
        matched+=1; all_gold.update(n(x) for x in card['goldSkills'])
    # Canonicalize known spelling/punctuation variants before adding new records.
    canonical=[]; seen_skills={}
    for skill in pack['skills']:
        original=str(skill.get('name') or '').strip()
        skill['name']=ALIASES.get(original,original)
        key=n(skill['name'])
        if key in seen_skills:
            base=seen_skills[key]
            # Preserve verified numerical data and merge useful labels.
            if skill.get('verifiedEvaluation') and not base.get('verifiedEvaluation'):
                base.update(skill)
            base['tags']=uniq(list(base.get('tags') or [])+list(skill.get('tags') or []))
        else:
            seen_skills[key]=skill; canonical.append(skill)
    pack['skills']=canonical
    sm={n(s.get('name')):s for s in pack['skills']}
    all_names=[]
    for v in CURATED.values():
        all_names.extend((x,'white') for x in v['hintSkills']+v['eventSkills'])
        all_names.extend((x,'gold') for x in v['goldSkills'])
    added=0; upgraded=0
    for name,grade in all_names:
        key=n(name)
        if key not in sm:
            s=guess_skill(name,grade); pack['skills'].append(s); sm[key]=s; added+=1
        elif grade=='gold':
            s=sm[key]
            if s.get('grade')!='gold':
                s['grade']='gold'; s['factorEligible']=False; s['examBonus']=1200
                if s.get('estimatedEvaluation') or not s.get('verifiedEvaluation'):
                    s['sp']=180; s['evaluation']=508; s['evaluationA']=508; s['efficiency']=round(508/180,3)
                upgraded+=1
    pack['version']='2026-07-30-v35-multisource'
    pack['generatedAt']=datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
    pack['minimumAppVersion']='3.5'
    pack['sourceLabel']='U-tools＋GameWith／Game8＋GameTora複数照合'
    pack['releaseNotes']=[
      f'取得スキルが不足していた直近SSR等 {matched}枚を再調査',
      'ヒント取得・イベント取得・金スキルを分離して収録',
      f'未登録スキル {added}件追加・金スキル区分 {upgraded}件補正',
      '日次更新もGameTora単独からU-tools併用方式へ変更',
      '外部アクセスの有無を端末単位の概算で確認できる機能を追加',
    ]
    sources=pack.setdefault('sources',[])
    wanted=[
      {'name':'U-tools サポートカード詳細','url':'https://xn--gck1f423k.xn--1bvt37a.tools/supports','role':'イベント取得・トレーニング取得スキルの主照合'},
      {'name':'GameWith ウマ娘攻略','url':'https://gamewith.jp/uma-musume/','role':'新カードの取得スキルと金スキルの副照合'},
      {'name':'Game8 ウマ娘攻略','url':'https://game8.jp/umamusume','role':'新カードの取得スキルと実装情報の副照合'},
      {'name':'GameTora','url':'https://gametora.com/ja/umamusume/supports','role':'新規カード検出・カード種別の自動確認'},
    ]
    for w in wanted:
        if not any(isinstance(s,dict) and s.get('url')==w['url'] for s in sources): sources.append(w)
    return matched,added,upgraded

def update_support_file(pack):
    text=SUPPORT.read_text(encoding='utf-8')
    prefix='window.UMA_SUPPORT_LIBRARY_V31='
    start=text.index(prefix)+len(prefix)
    dec=json.JSONDecoder(); obj,end=dec.raw_decode(text[start:])
    by={(n(c.get('name')),n(c.get('title'))):c for c in pack['supportCards']}
    for i,c in enumerate(obj.get('cards',[])):
        pc=by.get((n(c.get('name')),n(c.get('title'))))
        if pc:
            for k in ('hintSkills','eventSkills','goldSkills','skills','dataChecked','source','dataQuality','tags'):
                if k in pc: c[k]=pc[k]
    obj['version']=pack['version']
    replacement=json.dumps(obj,ensure_ascii=False,separators=(',',':'))
    SUPPORT.write_text(text[:start]+replacement+text[start+end:],encoding='utf-8')

if __name__=='__main__':
    pack=json.load(PACK.open(encoding='utf-8'))
    print('patch',patch_pack(pack))
    PACK.write_text(json.dumps(pack,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    PACKJS.write_text('window.UMA_BUNDLED_DATA_PACK='+json.dumps(pack,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    update_support_file(pack)
