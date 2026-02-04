/**
 * リッチメニュー画像生成スクリプト
 * puppeteerを使用してHTMLをPNGに変換
 */
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generateImage() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // ビューポートをリッチメニューサイズに設定
  await page.setViewport({
    width: 2500,
    height: 1686,
    deviceScaleFactor: 1
  });

  // HTMLファイルを開く
  const htmlPath = path.join(__dirname, 'richmenu-template.html');
  await page.goto(`file://${htmlPath}`);

  // スクリーンショットを撮影
  const outputPath = path.join(__dirname, '..', 'richmenu-new.png');
  await page.screenshot({
    path: outputPath,
    type: 'png'
  });

  await browser.close();

  console.log(`✅ Image generated: ${outputPath}`);
}

generateImage().catch(console.error);
