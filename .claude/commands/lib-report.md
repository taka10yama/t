---
description: ライブラリの状態を報告する（部品数・偏り・承認待ち・使用頻度）
---
1. `node library/tools/build-index.mjs` と `node library/tools/report.mjs` を実行する
2. 結果を要約して示す: 軸ごとの件数と偏り、承認待ちの一覧、プレビューのない部品、mood / fit の偏り、使用頻度の上位と下位、inbox の進み具合
3. 空の軸・偏り・承認待ちがあれば、次にやることを1〜3個提案する（例: references.md の中から、足りない軸に合う参考チャンネルを挙げる）
