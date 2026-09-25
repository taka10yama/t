---
description: サンプルを inbox に取り込み intake.yaml の雛形を作る（§3）
argument-hint: <path or url>
---
`library/CLAUDE.md` の §0・§3 に従って、次のサンプルを inbox に取り込む: $ARGUMENTS

1. 種別を決める。自分・自社のファイルは `own`、ライセンスが明記された公開コードは `licensed_code`、他社の動画・サイトは `observation_only`（スクリーンショットのみ。コードやSVGは取り込まない）
2. `node library/tools/intake.mjs <path|url> --type <種別>` を実行する（必要なら `--id YYYY-MM-DD_<slug>`、`--axes motion,type`）
3. `why_collected` についてユーザーに**1問だけ**聞く:「このサンプルの何が良いと思ったか、具体的に（動き・文字・配置など）」
4. 答えを intake.yaml の `why_collected` に書き、答えから `target_axes` を埋める。`licensed_code` なら `license` も確認する
5. 作成したフォルダと intake.yaml の中身を示す。`why_collected` が空のままなら「処理しない」と伝えて止まる
