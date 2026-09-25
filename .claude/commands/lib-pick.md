---
description: 案件の条件に合う候補を軸ごとに出す（§7）
argument-hint: <条件 例: 力強い 歴史 short>
---
`library/CLAUDE.md` の §7 に従い、次の条件で部品の候補を出す: $ARGUMENTS

1. 条件を `library/vocab.json` の語（mood / fit）と format（short / long）に当てはめる。当てはまらない語があれば、近い語を提案する
2. `node library/tools/pick.mjs --mood <..> --fit <..> --format <..> --n 3`（図像がいるなら `--axis icons --motif <モチーフ>` も）
3. 軸ごとに、どれを選ぶかと**その理由を1行**書く。推奨の組み合わせは `node library/tools/pick.mjs --check <ids>` で §7 のルールを満たすか確かめる
4. 候補がない軸は「新規に作り、案件が終わったら inbox に回す」と明記する
5. 使うものが決まったら `node library/tools/log-usage.mjs <video_id> <part-id> …` で使用履歴を記録する（§8）
