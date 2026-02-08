# K-TREND TIMES: Previous/Next Article 画像非表示の試行結果

**日付**: 2025-02-08

## 問題
Previous Article / Next Article ナビゲーションセクションの画像を非表示にしたい

## 試行したCSS (v4-v10)

```css
/* 試行1: ナビゲーション内画像 */
.newsx-post-navigation img { display: none !important; }

/* 試行2: FIFU属性を持つ画像（広すぎて失敗）*/
img[fifu-featured] { display: none !important; }

/* 試行3: Related Posts プラグイン画像 */
.relpost-block-single-image { display: none !important; }
```

## 結果: CSSアプローチは失敗

1. `img[fifu-featured]`セレクターが広すぎて「おすすめ」セクションの画像まで消えた
2. 画像を非表示にしてもコンテナが残り、大きな空白スペースが発生
3. レイアウトが完全に崩れた

## 解決策

- `ktrend-ads.php`をクリーンバージョンに戻した（ナビゲーション画像CSSなし）
- ブラウザキャッシュのクリアが必要だった（iPhoneのSafariで問題発生）

## 推奨される代替方法

Previous/Next Article画像を非表示にする場合：

1. **テーマのカスタマイザー設定**で画像を無効化
2. **Related Posts Thumbnails プラグインの設定画面**でサムネイル表示をオフにする
3. **CSSでの対応は避けるべき**（レイアウト崩壊のリスク）

## 関連ファイル

- `/var/www/html/wp-content/mu-plugins/ktrend-ads.php`（クリーンバージョン）
- テーマ: `news-magazine-x`
- プラグイン: `Related Posts Thumbnails`, `FIFU (Featured Image From URL)`

## サーバーアクセス

```bash
gcloud compute ssh ktrend-server --zone=asia-northeast1-a --project=k-trend-autobot --tunnel-through-iap
```

## キャッシュクリア方法

```bash
# サーバー側
docker exec ktrend-wordpress rm -rf /var/www/html/wp-content/cache/supercache/*

# iPhoneブラウザ
設定 → Safari → 履歴とWebサイトデータを消去
```
