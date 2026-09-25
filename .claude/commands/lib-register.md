---
description: 合格したドラフトをライブラリに登録し、index を作り直す（§6）
argument-hint: <sample-id>
---
`library/CLAUDE.md` の §5・§6・§10 に従って `$ARGUMENTS` を登録する。

1. `node library/tools/register.mjs $ARGUMENTS`（検証に通り、プレビューがある部品だけを移す。index.json も作り直す）
2. skip された部品は理由を示して、/lib-validate に戻す
3. icons と palette は `approved: false` で登録される。プレビューを Taka に見せ、**承認をもらってから** `node library/tools/register.mjs --approve <part-id> --by Taka` を実行する。承認をもらう前に勝手に approve しない
4. §10 の完了条件を確かめて示す: status registered / 全部品が validate を通過 / previews あり / index に反映 / observation.md に取り出さなかった軸の理由
