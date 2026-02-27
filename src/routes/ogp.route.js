/**
 * OGP メタデータ取得 API
 * URL から Open Graph Protocol のタイトル・説明・画像を取得
 */
import express from 'express';

const router = express.Router();

router.get('/ogp', async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'url required' });
    }

    try {
        // URL が正しい形式かチェック
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return res.status(400).json({ error: 'Invalid URL' });
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; LINECalendarBot/1.0)',
                'Accept': 'text/html',
            },
            signal: controller.signal,
            redirect: 'follow',
        });
        clearTimeout(timeout);

        if (!response.ok) {
            return res.json({ title: parsedUrl.hostname, url });
        }

        const html = await response.text();

        // OGP タグの抽出
        const ogp = {};
        const ogMatches = html.matchAll(/<meta\s+(?:property|name)=["'](og:[\w:]+)["']\s+content=["']([^"']*?)["']/gi);
        for (const m of ogMatches) {
            ogp[m[1].toLowerCase()] = decodeEntities(m[2]);
        }
        // 逆順のパターンも対応 (content が先)
        const ogMatches2 = html.matchAll(/<meta\s+content=["']([^"']*?)["']\s+(?:property|name)=["'](og:[\w:]+)["']/gi);
        for (const m of ogMatches2) {
            ogp[m[2].toLowerCase()] = decodeEntities(m[1]);
        }

        // twitter:card タグ
        const twMatches = html.matchAll(/<meta\s+(?:property|name)=["'](twitter:[\w]+)["']\s+content=["']([^"']*?)["']/gi);
        for (const m of twMatches) {
            ogp[m[1].toLowerCase()] = decodeEntities(m[2]);
        }

        // title タグのフォールバック
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        const fallbackTitle = titleMatch ? decodeEntities(titleMatch[1].trim()) : parsedUrl.hostname;

        // description メタタグのフォールバック
        const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*?)["']/i);
        const fallbackDesc = descMatch ? decodeEntities(descMatch[1]) : '';

        // 画像URLを絶対パスに変換
        let image = ogp['og:image'] || ogp['twitter:image'] || '';
        if (image && !image.startsWith('http')) {
            image = new URL(image, url).href;
        }

        res.json({
            title: ogp['og:title'] || fallbackTitle,
            description: ogp['og:description'] || fallbackDesc,
            image,
            siteName: ogp['og:site_name'] || parsedUrl.hostname,
            url: ogp['og:url'] || url,
        });
    } catch (err) {
        console.error('OGP fetch error:', err.message);
        try {
            const hostname = new URL(url).hostname;
            res.json({ title: hostname, url });
        } catch {
            res.json({ title: url, url });
        }
    }
});

function decodeEntities(str) {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'");
}

export default router;
