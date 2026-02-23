import express from 'express';
import { generateLiffHtml } from '../utils/liff.js';

const router = express.Router();

// LIFF アプリ
router.get('/', async (req, res) => {
    const liffId = process.env.LIFF_ID || 'YOUR_LIFF_ID';
    const apiBase = `https://${req.get('host')}`;
    const html = generateLiffHtml(liffId, apiBase);
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.type('html').send(html);
});

export default router;
