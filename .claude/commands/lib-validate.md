---
description: ドラフトを検証してプレビューを作り、目で確かめる（§5）
argument-hint: <sample-id | part-id>
---
`library/CLAUDE.md` の §5 に従って `$ARGUMENTS` を検証する。

1. `node library/tools/validate.mjs $ARGUMENTS`。FAIL はドラフトを直して通るまでやり直す。「既存部品とほぼ同じ」と出たら、そのドラフトは削除して既存部品を使う
2. `node library/tools/preview.mjs $ARGUMENTS`。「フォント未読込」の警告が出たら、フォント名を確かめて描き直す
3. `library/previews/<part-id>.png` を**すべて Read で開いて**、崩れ・はみ出し・狙いと違う動きがないか確かめる。問題があれば直して 1 からやり直す
4. 全部通ったら `node library/tools/status.mjs $ARGUMENTS validated`（サンプルIDのときだけ）
5. 結果の表（部品ID / 検証 / 目視の所見）を示す。icons と palette はプレビュー画像を Taka に見せ、承認が要ることを伝える
