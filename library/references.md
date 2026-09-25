# 観察用の参考チャンネル

ここに載っているのは他者の著作物。`source_type: observation_only` として扱い、取るのはスクリーンショットと `observation.md` の観察メモだけにする。コード・SVGパス・画像・キャラクターは持ち込まない（§0・§3）。

**最初のバッチは Kurzgesagt / Vox / TED-Ed から始める。** 自社スタイル（フラット・アイコン中心）に一番近い。

## フラットスタイル解説系（構成・間・図像）

| チャンネル | 何を観察するか | 主な軸 |
|---|---|---|
| Kurzgesagt – In a Nutshell | 配色の規則、キャラクターの記号化、込み入った話を短い間で運ぶ構成 | palette, icons, pacing |
| TED-Ed | 1テーマを起承転結に詰める台本構造、ペース配分 | pacing |
| Vox | 図表とテロップの組み方、データを見せるときの情報量 | layout, type |
| CGP Grey | 地図・図解での説明、ナレーションと画の同期 | pacing, layout |
| PolyMatter | 速い画面転換と、間を持たせる箇所の使い分け | pacing, motion |
| Wendover Productions | 10分超の章立て、データ可視化の丁寧さ | pacing, layout |
| Real Engineering | 精密な図解、専門用語をアイコンに置き換える方法 | icons |
| The Infographics Show | ランキング・数字ものの型、量産向きのテロップの出し方 | type, motion |
| Company（旧 Half as Interesting） | 短尺でのフック、軽いトーンでの情報整理 | pacing |
| Cleo Abram（Huge If True） | 明るい配色でのフラットスタイルの別解 | palette |

## モーション・タイポグラフィ（動き・文字）

| チャンネル | 何を観察するか | 主な軸 |
|---|---|---|
| Vox（Overtime枠含む） | キネティックタイポグラフィの字間と登場タイミング | type, motion |
| Nucleus | イージングと余白設計の手本 | motion, layout |
| School of Motion | イージングカーブ・staggerの理論 | motion |
| The Futur | タイポグラフィとブランディングの結びつけ方 | type |
| Every Frame a Painting（アーカイブ） | カット尺の設計、間の作り方の分析の視点 | pacing |

## 日本語チャンネル（テロップ・日本語組版・尺感）

| チャンネル | 何を観察するか | 主な軸 |
|---|---|---|
| 中田敦彦のYouTube大学 | 手書き風フリップと口頭説明の組み合わせ、日本語の間 | pacing, type |
| フェルミ漫画大学 | マンガ調フラットイラストの解説、キャラクターの記号化 | icons |
| サラタメさん | ホワイトボード風アニメの情報量、ビジネス系テロップの型 | type, layout |
| PIVOT | 図解＋インタビューの構成、テロップの読みやすさ | type, layout |
| 日経テレ東大学 | 情報量の多いテロップと編集リズム | type, pacing |

## 観察サンプルの登録例

```bash
node library/tools/intake.mjs "https://www.youtube.com/watch?v=XXXX" --type observation_only --id 2026-09-25_kurzgesagt-01
```

`intake.yaml` の記入例:

```yaml
id: 2026-09-25_kurzgesagt-01
source_type: observation_only
source_ref: "https://www.youtube.com/watch?v=XXXX"
license: "なし（観察のみ）"
why_collected: "背景1色＋アクセント1色で画面を締めている。場面転換の前に0.5秒ほど止めて間を作っている"
target_axes: [palette, pacing]
collected_by: "Taka"
status: collected
```

observation_only のサンプルから登録できるのは、数値・規則として書き直した技法（palette の規則、pacing の比率、motion のカーブ）と、元を見ずに描き直した図像だけ。
