---
description: サンプルの observation.md を作る（§4②）
argument-hint: <sample-id>
---
`library/CLAUDE.md` の §4② に従って `library/inbox/$ARGUMENTS/observation.md` を作る。

1. `library/inbox/$ARGUMENTS/intake.yaml` を読む。`why_collected` が空なら止まる
2. source.html があれば読み、`node library/tools/extract.mjs $ARGUMENTS` で extract-report.json を作って数値の根拠にする。スクリーンショットは Read で開いて見る。`observation_only` ならコードは読まない
3. 次の見出しで、**具体的な数値**で書く。コードで確かめていない値には「推定」と付ける
   - 動き / 文字 / 配置 / 図像 / 配色 / 間（§4② の問いに答える）
   - `## 取り出す部品` 軸ごとに予定の部品IDと、その根拠
   - `## 取り出さない軸` 取り出さない軸ごとに理由を1行（§10 の完了条件）
4. `node library/tools/status.mjs $ARGUMENTS observed`
