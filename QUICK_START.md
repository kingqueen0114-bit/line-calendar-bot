# Quick Start Guide - Multi-User OAuth Deployment

## 🚀 Fast Track Deployment

### Step 1: Google Cloud Console (5 minutes)

1. Go to https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client ID
3. Add redirect URI:
   ```
   https://your-worker-name.your-subdomain.workers.dev/oauth/callback
   ```
4. Click "Save"

### Step 2: Set Environment Variables (3 minutes)

```bash
# Navigate to your project
cd line-calendar-bot

# Set secrets (you'll be prompted for values)
wrangler secret put OAUTH_REDIRECT_URI
# Enter: https://your-worker-name.your-subdomain.workers.dev/oauth/callback

# Verify other secrets are already set
wrangler secret list
```

Expected secrets:
- ✅ LINE_CHANNEL_ACCESS_TOKEN
- ✅ LINE_CHANNEL_SECRET
- ✅ GOOGLE_CLIENT_ID
- ✅ GOOGLE_CLIENT_SECRET
- ✅ OAUTH_REDIRECT_URI (NEW)
- ✅ GEMINI_API_KEY

### Step 3: Deploy (1 minute)

```bash
wrangler deploy
```

### Step 4: Test (2 minutes)

1. **Test OAuth callback URL:**
   ```bash
   curl https://your-worker-name.your-subdomain.workers.dev/oauth/callback
   ```
   Expected: "無効なリクエストです" (Bad Request)

2. **Test with LINE:**
   - Remove and re-add the bot as a friend
   - Should receive welcome message
   - Click "Google認証を開始" button
   - Complete OAuth flow
   - Send a test message

## 🎯 Quick Verification Checklist

- [ ] OAuth redirect URI added to Google Cloud Console
- [ ] OAUTH_REDIRECT_URI secret set in Cloudflare Workers
- [ ] Worker deployed successfully
- [ ] Welcome message received on friend add
- [ ] OAuth flow completes successfully
- [ ] Test message creates calendar event
- [ ] Starred task feature works (try: "タスク ★重要な資料")

## 🔍 Troubleshooting

### "redirect_uri_mismatch" error
**Fix:** Double-check the OAuth redirect URI in Google Cloud Console matches exactly:
```
https://your-worker-name.your-subdomain.workers.dev/oauth/callback
```

### "User not authenticated" message
**Expected behavior** - User needs to complete OAuth flow first.

### "Invalid signature" on LINE webhook
**Fix:** Verify LINE_CHANNEL_SECRET is set correctly:
```bash
wrangler secret put LINE_CHANNEL_SECRET
```

### Deployment fails
**Fix:** Check wrangler.toml has correct KV namespace binding:
```toml
kv_namespaces = [
  { binding = "NOTIFICATIONS", id = "your-kv-namespace-id" }
]
```

## 📊 Monitoring

### View logs in real-time
```bash
wrangler tail
```

### Check authenticated users
```bash
wrangler kv:key get --binding=NOTIFICATIONS "authenticated_users"
```

### Check specific user tokens
```bash
wrangler kv:key get --binding=NOTIFICATIONS "user_tokens:U1234567890"
```

## 🎉 Success Indicators

You'll know it's working when:
1. ✅ New users receive welcome message on friend add
2. ✅ OAuth flow completes without errors
3. ✅ Users can create events/tasks
4. ✅ Starred tasks show ⭐ in task list
5. ✅ Notifications work per user
6. ✅ No cross-user data leakage

## 📝 User Communication

### Sample Broadcast Message for Existing Users

```
📢 重要なアップデート

カレンダーボットが新しくなりました！

🆕 新機能
・あなた専用のGoogleアカウントで利用
・完全なプライバシー保護
・重要なタスクに⭐マーク
・より詳しいエラーメッセージ

⚙️ 必要な操作
1. メッセージを送信
2. 認証ボタンをクリック
3. Googleアカウントで認証

認証は1回だけで、数秒で完了します！

今すぐメッセージを送信して試してみてください 👇
```

## 🔧 Advanced Configuration

### Custom notification times
Edit `src/index.js` notification functions to change times:
- Weekly report: Sunday 21:00 → Change `hour === 21`
- Day before: 18:00 → Change `setHours(18, 0, 0, 0)`
- Morning: 9:00 → Change `setHours(9, 0, 0, 0)`

### Adjust retry attempts
Edit `src/gemini.js`:
```javascript
const maxRetries = 3; // Change to desired value
```

### Change token expiration buffer
Edit `src/oauth.js`:
```javascript
const expirationBuffer = 5 * 60 * 1000; // 5 minutes
```

## 📚 Additional Resources

- Full deployment guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Implementation details: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- Architecture: See KV Storage Schema in DEPLOYMENT.md

## 🆘 Need Help?

1. Check logs: `wrangler tail`
2. Verify KV data: `wrangler kv:key list --binding=NOTIFICATIONS`
3. Review error messages in LINE chat
4. Check Google Cloud Console audit logs
5. Refer to detailed troubleshooting in DEPLOYMENT.md

---

**Estimated Total Time: 15 minutes** ⏱️

Happy deploying! 🚀
