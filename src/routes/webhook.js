/**
 * Webhook Routes - LINE Webhook & スケジュールタスク
 */
import { Router } from 'express';
import crypto from 'crypto';
import { rateLimit } from '../security.js';
import { handleWebhook, runScheduledTask } from '../app.js';

const router = Router();

// LINE Webhook（レート制限付き）
router.post('/', rateLimit('webhook'), async (req, res) => {
  console.log('=== WEBHOOK RECEIVED ===');
  console.log('Webhook body:', JSON.stringify(req.body));

  try {
    const signature = req.headers['x-line-signature'];
    const channelSecret = process.env.LINE_CHANNEL_SECRET;

    // LINEの検証リクエスト（eventsが空またはundefined）は署名チェックをスキップ
    if (!req.body.events || req.body.events.length === 0) {
      console.log('Webhook verification request (empty events), responding 200');
      return res.sendStatus(200);
    }

    // 署名検証
    if (!signature) {
      console.error('Missing signature header');
      return res.status(401).send('Missing signature');
    }

    if (!channelSecret) {
      console.error('Channel secret not configured');
      return res.status(500).send('Server configuration error');
    }

    const hash = crypto
      .createHmac('SHA256', channelSecret)
      .update(req.rawBody)
      .digest('base64');

    if (hash !== signature) {
      console.error('Invalid signature. Expected:', hash, 'Got:', signature);
      return res.status(401).send('Invalid signature');
    }

    console.log('Signature verified, calling handleWebhook');
    await handleWebhook(req.body);
    console.log('handleWebhook completed');
    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Internal Server Error');
  }
});

// スケジュールタスク（POST）
router.post('/scheduled', async (req, res) => {
  console.log('Scheduled task triggered via POST');
  try {
    await runScheduledTask();
    console.log('Scheduled task completed successfully');
    res.sendStatus(200);
  } catch (err) {
    console.error('Scheduled task error:', err);
    res.status(500).send('Error');
  }
});

// スケジュールタスク（GET）
router.get('/scheduled', async (req, res) => {
  console.log('Scheduled task triggered via GET');
  try {
    await runScheduledTask();
    console.log('Scheduled task completed successfully');
    res.send('OK');
  } catch (err) {
    console.error('Scheduled task error:', err);
    res.status(500).send('Error');
  }
});

export default router;
