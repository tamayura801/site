# Tamayura Virtual Try-on

ジャグアタトゥーのバーチャル試着サイト（試作版）。
写真はブラウザ内だけで処理し、サーバーには送信・保存しません。

設計メモ：[docs/PLAN.md](docs/PLAN.md)

## 確認のしかた

- **いちばん簡単**：GitHub Pages で公開して、スマホでURLを開く
  1. GitHub のこのリポジトリ → Settings → Pages
  2. 「Branch」で公開したいブランチ（例：`main`）と `/ (root)` を選んで Save
  3. 数分後に表示される `https://〜.github.io/site/` を開く
  - ※非公開（Private）リポジトリで Pages を使うには有料プランが必要です
- **PCで手元確認**：`index.html` をダブルクリックでも表示・操作はできます。
  ただしこの開き方だと、ブラウザの制限で「完成」（画像づくり）が動かないことがあります。
  その場合は公開URLで確認してください。

## よくある変更

| やりたいこと | 触るファイル |
|---|---|
| 予約ボタンのリンク先を設定 | `js/config.js` の `BOOKING_URL` |
| 料金・サイズ区分・比較の文言 | `js/config.js` の `SIZE_TIERS` |
| 保存画像の文字（透かし） | `js/config.js` の `WATERMARK` |
| デザインを追加・削除 | `designs/` に画像を入れて `js/designs.js` に1行追加 |
| 色を変える | `css/style.css` の先頭 `:root` |

### デザインの追加例

1. `designs/rose.png`（背景透明・黒い線画）を追加
2. `js/designs.js` に次の1行を追加

```js
{ id: 'rose', name: 'Rose', category: '花', tags: ['花', 'キュート'], src: 'designs/rose.png' },
```
