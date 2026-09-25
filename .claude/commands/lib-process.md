---
description: 取り込みから登録までを通しで実行する（人間の承認が要る所で止まる）
argument-hint: <sample-id | path or url>
---
`library/CLAUDE.md` のフロー全体（§2）を、`$ARGUMENTS` について通しで実行する。

1. 引数が inbox にないパスや URL なら、まず /lib-intake の手順を行う（why_collected を1問だけ聞く）
2. intake.yaml の `status` を見て、途中から再開する: collected → /lib-observe、observed → /lib-extract、extracted → /lib-validate、validated → /lib-register、awaiting_approval → 承認の確認だけ
3. 各段階の手順は `.claude/commands/lib-<段階>.md` に書かれたとおりに行う。段階ごとに status を記録する
4. **止まる所**: icons と palette の登録後は、プレビューを Taka に見せて承認を待つ。承認をもらうまで `--approve` しない
5. 終わったら §10 の完了条件を確かめ、`node library/tools/report.mjs` の要約を示す
