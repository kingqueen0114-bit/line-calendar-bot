import express from 'express';
import crypto from 'crypto';
import { handleWebhook } from '../app.js';

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        // 署名検証
        const signature = req.headers['x-line-signature'];
        const channelSecret = process.env.LINE_CHANNEL_SECRET;

        const hash = crypto
            .createHmac('SHA256', channelSecret)
            .update(req.rawBody)
            .digest('base64');

        if (hash !== signature) {
            console.error('Invalid signature');
            return res.status(401).send('Invalid signature');
        }

        // Webhook処理
        await handleWebhook(req.body);
        res.sendStatus(200);
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).send('Internal Server Error');
    }
});

export default router;
