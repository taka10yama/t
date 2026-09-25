---
description: 6軸に分解してドラフトを作る（§4③④、approved: false）
argument-hint: <sample-id>
---
`library/CLAUDE.md` の §0・§4③④・§6 に従って `$ARGUMENTS` を部品に分ける。

1. observation.md と extract-report.json を読む（なければ先に /lib-observe を実行する）
2. 部品ごとに `node library/tools/extract.mjs $ARGUMENTS --scaffold <axis> <slug>` で雛形を作り（icons は `<category>/<slug>`、stagger は slug を `stagger-` で始める）、値を埋める
   - motion: カーブ・時間・開始姿勢を数値で書く。既存部品（`library/index.json`）に近ければ新しく作らず、既存を使うことを observation.md に書く
   - type: フォントのライセンスを確かめる（不明なら作らない）
   - layout: `.html` は灰色の箱だけの骨組みにする（色・文字・図像を入れない）。9:16 は別部品にする
   - icons: own / licensed のSVGは `drafts/_raw-svg/` から持ってきて `node library/tools/extract.mjs svgvars <file> --write` で色を変数にし、viewBox を 0 0 200 200 に合わせる。他者の図像は元を見ずに描き直す
   - palette: 固定色ではなく、色を導く規則を `rule` に書く。`examples` は実例
   - mood / fit / avoid は `library/vocab.json` の語だけを使う。足りない語は、先に vocab.json に追加することをユーザーに提案する
3. すべて `approved: false` のままにする。1つのサンプルの特徴をそのまま再現する組み合わせは作らない（§0）
4. `node library/tools/validate.mjs $ARGUMENTS` でスキーマを先に確かめる
5. `node library/tools/status.mjs $ARGUMENTS extracted`。作った部品を一覧で示す
