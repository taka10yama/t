# 動画デザイン資産ライブラリ 構築・運用指示書（Claude Code用）

この指示書は、Claude Codeに「高品質なHTML/CSS/SVGサンプルを収集し、分解し、タグ付けして、動画量産時に引き出せる資産にする」作業を実行させるためのもの。ルートの `CLAUDE.md` から参照される。

実装の使い方（コマンド・ファイル規約）は末尾の **§12 実装メモ** を参照。

---

## 0. このライブラリの目的とやってはいけないこと

### 目的
動画量産時に、案件ごとに最適な「動き・文字・配置・図像・配色・間」の部品を複数候補から選び、組み合わせて使えるようにする。サンプルは**丸ごと真似る参照元ではなく、部品を取り出す原料**として扱う。

### 禁止事項
- サンプルのHTMLを丸ごと保存して、そのまま次の動画のテンプレにすること
- 他者の著作物（ロゴ、キャラクター、イラスト、写真、商用フォント、特定作品の構図）のパスや画像をそのまま資産に入れること。取り出してよいのは**技法（イージング値、字間の比率、グリッド構成、配色の導出規則、タイミング配分）**と、**自社で描き直した図像**のみ
- 1つのサンプルから取り出した部品を、出典の特徴が分かる組み合わせのまま同じ動画に全部入れること
- 検証（§5）を通っていない部品を `approved` にすること

---

## 1. ディレクトリ構成

```
library/
├── CLAUDE.md                 # この指示書
├── references.md             # 観察用の参考チャンネル一覧
├── vocab.json                # mood / fit / avoid / formats の語彙表
├── index.json                # 全部品の索引（§6で自動生成）
├── inbox/                    # 収集した生サンプル（未処理）
│   └── 2026-09-25_sample-01/
│       ├── source.html       # 元のコード or スクショ
│       ├── source.png
│       ├── intake.yaml       # 収集メモ（§3）
│       ├── observation.md    # 観察メモ（§4②）
│       ├── extract-report.json  # extract.mjs の機械抽出結果
│       └── drafts/<axis>/…   # 分解ドラフト（approved: false）
├── motion/                   # イージング・stagger・入退場
├── type/                     # 書体組み合わせ・字間・可変サイズ規則
├── layout/                   # グリッド・構図
├── icons/                    # 自社で描いたSVGモチーフ（カテゴリ別サブフォルダ）
│   ├── transport/
│   ├── architecture/
│   └── …
├── palette/                  # 配色の導出規則
├── pacing/                   # シーン内の演出/静止の時間配分
├── previews/                 # 各部品の検証用プレビューPNG（自動生成）
├── usage-log.jsonl           # どの動画でどの部品を使ったか（§8）
└── tools/
    ├── extract.mjs           # 分解の補助
    ├── preview.mjs           # 部品単体のプレビュー描画
    ├── validate.mjs          # スキーマ・ルール検証
    ├── build-index.mjs       # index.json 生成
    ├── pick.mjs              # 案件条件から候補を検索
    ├── intake.mjs / register.mjs / report.mjs / log-usage.mjs  # コマンド補助
    ├── lib.mjs               # 共通処理
    └── selftest.mjs          # ダミー部品での通し動作確認
```

---

## 2. 全体フロー

```
① 収集    inbox/ にサンプルを入れ、intake.yaml を書く
② 観察    何が良いのかを軸ごとに言語化する（observation.md）
③ 分解    6軸（motion/type/layout/icons/palette/pacing）に切り出す
④ 再構築  他者の図像は自社で描き直し、技法は数値・規則として書き起こす
⑤ 検証    部品単体でプレビューを描画し、ルール検査を通す
⑥ 登録    メタデータを付けて各フォルダへ、index.json を再生成
⑦ 運用    案件時は pick.mjs で候補を引き、使用履歴を記録
```

各ステップの完了時に、inbox 内のサンプルフォルダに `status: observed / extracted / validated / registered` を記録する。途中で止まっても再開できるようにする。

---

## 3. ① 収集

### 入れてよいもの
- 自社・自分で作ったHTML動画、過去の高評価動画のコード
- 公開されているコードのうち、ライセンスが明記されているもの（MIT等）。ライセンス名を必ず記録
- 他社の動画・サイトは**スクリーンショットや観察メモのみ**。コードやSVGパスはコピーしない

### intake.yaml（必須）
```yaml
id: 2026-09-25_sample-01
source_type: own | licensed_code | observation_only
source_ref: "URL or 社内パス"
license: "MIT" | "自社" | "なし（観察のみ）"
why_collected: "テキストのせり上がりが気持ちいい。見出しの字間が詰まっていて締まって見える"
target_axes: [motion, type]      # 何を取り出したいか
collected_by: "Taka"
status: collected
```
`why_collected` が空のサンプルは処理しない。「なんとなく良い」は資産にならない。

---

## 4. ②〜④ 観察・分解・再構築

### ② 観察（observation.md）
サンプルを開き、次の問いに具体的な数値で答える。推測の数値は「推定」と明記する。

- 動き：何が、何秒で、どのカーブで動くか。登場と退場は対称か
- 文字：書体・サイズ比（見出し:本文）・字間・行間・1行の文字数
- 配置：グリッドの分割、余白の比率、揃え（左/中央）
- 図像：色数、線の太さ、角の処理、情報量
- 配色：背景・文字・アクセントの関係（明度差・彩度差）
- 間：1カット中、動いている時間と止まっている時間の比率

### ③ 分解：6軸それぞれのファイル形式

#### motion/<slug>.json
```json
{
  "id": "motion.pop-overshoot",
  "kind": "enter",
  "curve": "cubic-bezier(.3,1.5,.5,1)",
  "duration_ms": 600,
  "delay_ms": 150,
  "transform_from": "scale(.4) rotate(-8deg)",
  "opacity_from": 0,
  "pair_exit": "motion.exit-fast",
  "notes": "主役オブジェクト専用。テキストには強すぎる"
}
```
退場（`kind: "exit"`）は `transform_to` / `opacity_to` を持つ。

#### motion/stagger-<slug>.json
```json
{ "id": "motion.stagger-text-4", "kind": "stagger", "step_ms": [0, 80, 140, 140], "applies_to": ["num","title","date","body"] }
```

#### type/<slug>.json
```json
{
  "id": "type.dela-zen-display",
  "display": { "family": "Dela Gothic One", "weight": 400, "tracking_em": -0.02, "leading": 1.05 },
  "body":    { "family": "Zen Kaku Gothic New", "weight": 700, "tracking_em": 0.0, "leading": 1.45 },
  "scale_ratio": 5.0,
  "autosize": { "2": 190, "3": 150, "4": 120, "5+": 96 },
  "max_chars_per_line": 20,
  "license": "SIL OFL（Google Fonts）"
}
```
商用ライセンスが不明なフォントは登録しない。

#### layout/<slug>.html ＋ <slug>.json
HTMLは要素をグレーの箱で置いただけの骨組みにする（色・文字・図像を入れない）。
```json
{
  "id": "layout.split-art-left",
  "aspect": ["16:9"],
  "grid": "560px 1fr",
  "padding": [0, 90, 0, 70],
  "align": "left",
  "wireframe": "[ ART 460 ] [ num / TITLE / date / body ]"
}
```
9:16用は別部品として登録する（16:9の流用で済ませない）。

#### icons/<category>/<slug>.svg ＋ <slug>.json
- 自社で描いたもの、またはライセンス上改変・再配布が許可されたものだけ
- 描画ルール：viewBox 200×200、塗りのみ、3〜5色、グラデーション・影なし、stroke-linecap round
- 色は `var(--c1)`〜`var(--c5)` の変数に置き換えて保存し、配色規則から差し込めるようにする
```json
{ "id": "icons.transport.steam-locomotive", "colors": 4, "motifs": ["鉄道","明治","近代化","産業"] }
```

#### palette/<slug>.json（固定色ではなく規則を保存）
```json
{
  "id": "palette.traditional-single-ground",
  "rule": "背景に伝統色1色。discは背景の明度を±6%。inkは背景とのコントラスト比7:1以上。accは背景の補色寄りで彩度高め",
  "min_contrast_ink": 7.0,
  "roles": ["bg", "ink", "acc", "disc"],
  "examples": [["#1F3B6E","#F4EFE4","#F2B84B","#2A4B85"]]
}
```
`roles` は `examples` の各色の役割。省略時は `["bg","ink","acc","disc"]`。

#### pacing/<slug>.json
```json
{ "id": "pacing.act-then-hold", "scene_sec": 3.6, "motion_ratio": 0.33, "hold_ratio": 0.67, "format": ["short","long"] }
```

### ④ 再構築のルール
- 他者の図像を参考にした場合は、元を見ずに描き直す。モチーフ（「蒸気機関車」）は借りてよいが、形・比率・構図は変える
- 技法の数値は、観察値をそのまま入れず、自社の既存トークンと比べて丸めるか、既存に近ければ既存を使う（§5の重複判定）

---

## 5. ⑤ 検証

### 自動検証（tools/validate.mjs）
| チェック | 基準 |
|---|---|
| スキーマ | 各軸の必須キーが揃っているか |
| ライセンス | `license` が空、または「不明」の部品は不合格 |
| SVG | viewBox 200×200、`<image>`・`<linearGradient>`・`filter` を含まない、色数3〜5 |
| 配色 | ink と背景のコントラスト比が規則の最小値以上 |
| モーション | duration 150〜900ms、stagger の step は 50〜200ms |
| 重複 | 既存部品とほぼ同じなら不合格にして既存を示す（カーブの制御点差がすべて0.05未満、SVGのパスが同一、など） |

### 目視検証（tools/preview.mjs）
部品単体を中立な台紙にはめてPNGを描画し、`previews/<id>.png` に保存する。モーションは開始・中間・終了の3コマを横並びで出す。Claude Codeはこの画像を自分で開いて、崩れ・はみ出し・意図と違う動きがないか確認してから次に進む。

### 人間の承認
新規の `icons` と `palette` は、プレビューをTakaに見せて承認を得てから `approved: true` にする。motion/type/layout/pacing は自動検証合格で `approved: true` にしてよい。

---

## 6. ⑥ 登録とメタデータ

全部品に共通で次のメタデータを持たせる。

```json
{
  "id": "motion.pop-overshoot",
  "axis": "motion",
  "mood": ["力強い", "ポップ", "断定的"],
  "fit": ["歴史", "教育", "エンタメ"],
  "avoid": ["金融", "医療", "訃報・災害"],
  "formats": ["short", "long"],
  "source_sample": "2026-09-25_sample-01",
  "license": "自社",
  "approved": true,
  "created_at": "2026-09-25"
}
```
- `mood` と `fit` は既定の語彙表（`library/vocab.json`）から選ぶ。自由記述で増やさない。新しい語が必要なら vocab.json に追加してから使う
- 登録後に `node tools/build-index.mjs` を実行し、`index.json` を再生成する

---

## 7. ⑦ 案件での使い方

### 候補の引き方
```bash
node library/tools/pick.mjs --mood 力強い --fit 歴史 --format short --n 3
```
各軸につき3候補を返す。Claude Codeは候補から選ぶ理由を一行ずつ書いてから使う。

### 組み合わせのルール
- 同じ `source_sample` から来た部品を、1本の動画で3軸以上同時に使わない
- 直近5本の動画と、motion・type・palette の3軸の組み合わせが完全一致しないようにする（usage-log.jsonl で確認）
- ライブラリに適切な候補がない場合のみ新規に作る。作ったものは案件終了後に inbox に回して、§3からの流れで資産化する

---

## 8. 使用履歴

案件ごとに1行追記する。
```json
{"video_id":"2026-09-25_meiji-ishin_short-01","parts":["motion.pop-overshoot","type.dela-zen-display","layout.split-art-left","palette.traditional-single-ground","pacing.act-then-hold"],"result":{"views_7d":null,"retention_avg":null}}
```
再生数や維持率が取れたら後から埋める。一定本数たまったら、成績の良い組み合わせと悪い組み合わせを集計し、`mood`/`fit` タグの見直しに使う。

---

## 9. Claude Code 用スラッシュコマンド

`.claude/commands/` に置く。

| コマンド | 動作 |
|---|---|
| `/lib-intake <path or url>` | inbox にフォルダを作り、intake.yaml の雛形を作成。`why_collected` をユーザーに1問だけ聞く |
| `/lib-observe <id>` | observation.md を作成（§4②） |
| `/lib-extract <id>` | 6軸に分解してドラフトを作成（§4③④）。ドラフトは `approved: false` |
| `/lib-validate <id>` | validate.mjs と preview.mjs を実行し、結果とプレビューを提示 |
| `/lib-register <id>` | 合格部品を各フォルダへ移動し index を再生成 |
| `/lib-pick <条件>` | 案件用の候補を提示 |
| `/lib-report` | 部品数・軸ごとの偏り・未承認数・使用頻度の上位/下位を一覧 |

`/lib-intake` から `/lib-register` までを通しで実行する `/lib-process <id>` も用意する。その場合も、§5の人間承認が必要な部品では必ず止まる。

---

## 10. 完了の定義

1サンプルの処理は、次がすべて満たされたとき完了とする。

- inbox のサンプルに `status: registered` が付いている
- 取り出した部品がすべて validate を通過している
- 各部品の previews/ にPNGがある
- index.json に反映されている
- 取り出さなかった軸について「なぜ取り出さなかったか」が observation.md に一行ある

---

## 11. 最初にやること（初期構築）

1. 上記ディレクトリと `vocab.json`（mood/fit/avoid の語彙、各20語程度）を作る
2. tools/ の5スクリプトを実装し、ダミー部品で動作確認する（`node library/tools/selftest.mjs`）
3. 「60秒でわかる日本の歴史」（nihon-rekishi.html）を最初のサンプルとして `/lib-process` を通す。motion 5件、type 1件、layout 1件、icons 15件、palette 1件、pacing 1件が登録されれば正常
4. `/lib-report` で結果を提示し、Takaの確認を得る

---

## 12. 実装メモ（ツールの使い方と規約）

### ファイル配置の規約
- 部品IDとパスは1対1。`motion.pop-overshoot` → `motion/pop-overshoot.json`、`icons.transport.steam-locomotive` → `icons/transport/steam-locomotive.{json,svg}`、`layout.split-art-left` → `layout/split-art-left.{json,html}`
- 部品のJSONは「§6の共通メタデータ ＋ §4③の軸固有キー」を1ファイルにまとめる
- ドラフトは `inbox/<id>/drafts/` の下に同じ規約で置く（例 `inbox/<id>/drafts/motion/pop-overshoot.json`）
- intake.yaml は `key: value`、`[a, b]` のインライン配列、`#` コメントのみ対応の簡易YAML

### コマンド早見表（リポジトリルートから実行）
```bash
node library/tools/intake.mjs <path|url> [--id <id>] [--type own|licensed_code|observation_only]
node library/tools/extract.mjs <id>                       # extract-report.json を作る（observation_only はコード抽出しない）
node library/tools/extract.mjs <id> --scaffold <axis> <slug>  # ドラフトの雛形（メタデータ入り）を作る
node library/tools/extract.mjs svgvars <file.svg>         # SVGの色を出現順に var(--c1..) へ置換
node library/tools/validate.mjs [<id> | <part-id> | --all] [--json]
node library/tools/preview.mjs  [<id> | <part-id> | --all]  # previews/<part-id>.png
node library/tools/register.mjs <id>                      # 合格ドラフトを移動・承認・index 再生成
node library/tools/register.mjs --approve <part-id> --by Taka  # icons/palette の人間承認
node library/tools/build-index.mjs
node library/tools/pick.mjs --mood 力強い --fit 歴史 --format short --n 3 [--json]
node library/tools/pick.mjs --check <part-id>,<part-id>,…   # §7 組み合わせルールだけ検査
node library/tools/log-usage.mjs <video_id> <part-id> …    # usage-log.jsonl に1行追記
node library/tools/report.mjs
node library/tools/selftest.mjs                           # 一時ディレクトリでダミー部品を通しで検証
```

### 承認の扱い
- `register.mjs` は validate 合格かつプレビューありのドラフトだけを移動する
- motion/type/layout/pacing は移動時に `approved: true`
- icons/palette は `approved: false` のまま移動し、Taka の承認後に `--approve` で `approved: true`, `approved_by` を付与する。承認待ちが残っている間は `status: registered` にしない（`status: awaiting_approval`）

### プレビュー
- Playwright（グローバルインストール可）で Chromium を起動する。モーションは Web Animations API で 0% / 50% / 100% の3コマを横並びにし、イージングカーブのグラフも添える
