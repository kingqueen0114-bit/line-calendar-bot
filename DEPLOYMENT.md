# LINE Calendar Bot - Deployment Guide

## Multi-User OAuth Implementation

This guide explains how to deploy the multi-user OAuth version of the LINE Calendar Bot.

## Overview of Changes

The bot has been upgraded from a single shared Google account to a multi-user OAuth system:

- **Per-User Authentication**: Each user authenticates with their own Google account
- **Complete Data Isolation**: Users can only access their own calendars and tasks
- **Starred Tasks**: Important tasks are automatically detected and prioritized
- **Enhanced Error Handling**: Conversational follow-ups and helpful error messages
- **Onboarding Flow**: Welcome message with authentication guidance

## Prerequisites

- Cloudflare account with Workers enabled
- LINE Developer account with Messaging API channel
- Google Cloud Console project with OAuth 2.0 credentials
- Wrangler CLI installed (`npm install -g wrangler`)

## Step 1: Environment Variables Setup

### Remove Old Variables

The following environment variable is NO LONGER needed:

```bash
# DO NOT SET THIS - it's for the old single-user system
# GOOGLE_REFRESH_TOKEN
```

### Required Variables

Set these environment variables in your Cloudflare Workers dashboard or via wrangler:

```bash
# LINE Bot credentials (unchanged)
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret

# Google OAuth credentials (unchanged)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# NEW: OAuth redirect URI
OAUTH_REDIRECT_URI=https://your-worker-name.your-subdomain.workers.dev/oauth/callback

# Gemini API (unchanged)
GEMINI_API_KEY=your_gemini_api_key
```

### Set Variables via Wrangler

```bash
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
wrangler secret put LINE_CHANNEL_SECRET
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put OAUTH_REDIRECT_URI
wrangler secret put GEMINI_API_KEY
```

## Step 2: Google Cloud Console Configuration

### 1. Update OAuth 2.0 Client

Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials

1. Select your OAuth 2.0 Client ID
2. Under "Authorized redirect URIs", add:
   ```
   https://your-worker-name.your-subdomain.workers.dev/oauth/callback
   ```
3. Save changes

### 2. Verify Enabled APIs

Ensure these APIs are enabled:
- Google Calendar API
- Google Tasks API

### 3. OAuth Consent Screen

- Configure the OAuth consent screen if not already done
- Add the following scopes:
  - `https://www.googleapis.com/auth/calendar`
  - `https://www.googleapis.com/auth/tasks`

## Step 3: Deploy to Cloudflare Workers

```bash
# Login to Cloudflare (if not already logged in)
wrangler login

# Deploy the worker
wrangler deploy

# Verify deployment
wrangler tail
```

## Step 4: Verify Deployment

### Test OAuth Callback Route

Visit your OAuth callback URL directly:
```
https://your-worker-name.your-subdomain.workers.dev/oauth/callback
```

You should see a "Bad Request" message (this is expected without auth code).

### Test LINE Webhook

The LINE webhook should be at:
```
https://your-worker-name.your-subdomain.workers.dev
```

Update your LINE Messaging API webhook URL if needed.

## Step 5: Configure Cron Trigger

Ensure the cron trigger is set in `wrangler.toml`:

```toml
[triggers]
crons = ["*/15 * * * *"]
```

This runs notifications every 15 minutes.

## Step 6: User Migration

### For New Users

New users will automatically see the welcome message and OAuth flow when they add the bot as a friend.

### For Existing Users

Send a broadcast message to existing users:

```
📢 重要なお知らせ

カレンダーボットがアップデートされました！

【新機能】
✅ あなた専用のGoogleアカウントに接続
✅ プライバシー保護の強化
✅ タスクの重要度管理
✅ より賢いエラー対応

【必要な操作】
Googleアカウントの認証が必要です。
メッセージを送信すると認証URLが届きます。

認証後、すぐにご利用いただけます。
```

## Architecture Overview

### KV Storage Schema

```
user_tokens:{userId} → {
  accessToken: string,
  refreshToken: string,
  expiresAt: number,
  scope: string
}

oauth_state:{state} → {
  userId: string,
  timestamp: number
} // TTL: 10 minutes

authenticated_users → [userId1, userId2, ...]

{userId}_{notificationKey} → "sent" // User-specific notification flags

weekly_report_{userId}_{date} → "sent"
{userId}_{eventId}_day_before → "sent"
{userId}_{eventId}_1hour_before → "sent"
{userId}_{taskId}_task_day_before → "sent"
{userId}_{taskId}_task_morning → "sent"
```

### OAuth Flow

1. User adds bot as friend → Welcome message with OAuth URL
2. User clicks OAuth URL → Redirected to Google consent screen
3. User grants permissions → Redirected back to callback URL
4. Worker exchanges code for tokens → Stores in KV with user ID
5. User added to authenticated_users list
6. User can now use all bot features

### Notification System

The cron trigger runs every 15 minutes and:

1. Retrieves all authenticated users from KV
2. For each user:
   - Fetches their events/tasks using their tokens
   - Checks notification conditions
   - Sends notifications with user-specific keys
3. Errors for one user don't affect others

## Security Considerations

### Token Storage

- Refresh tokens are stored in Cloudflare KV (encrypted at rest)
- Access tokens expire after 1 hour and are auto-refreshed
- State parameters prevent CSRF attacks

### Data Isolation

- Each user can only access their own calendar/tasks
- Notification keys are prefixed with user ID
- No cross-user data leakage

### CSRF Protection

- State parameter with 10-minute expiration
- One-time use (deleted after verification)
- Timestamp validation

## Monitoring & Debugging

### Check User Authentication

```bash
# Use wrangler KV commands
wrangler kv:key get --binding=NOTIFICATIONS "authenticated_users"
```

### View User Tokens

```bash
wrangler kv:key get --binding=NOTIFICATIONS "user_tokens:U1234567890"
```

### Monitor Logs

```bash
wrangler tail
```

### Common Issues

**Issue**: "User not authenticated" error
- **Cause**: User hasn't completed OAuth flow
- **Solution**: User needs to click the authentication button

**Issue**: "Token refresh failed"
- **Cause**: Refresh token expired or revoked
- **Solution**: User needs to re-authenticate

**Issue**: Notifications not working
- **Cause**: Cron trigger not set or user tokens missing
- **Solution**: Verify cron trigger and check user_tokens in KV

## Rollback Plan

If you need to rollback to the single-user version:

1. Restore the old code from git history
2. Re-add GOOGLE_REFRESH_TOKEN secret
3. Remove OAUTH_REDIRECT_URI
4. Deploy the old version

Note: All user OAuth tokens will be lost during rollback.

## Testing Checklist

### OAuth Flow
- [ ] New user adds bot → receives welcome message
- [ ] Click OAuth button → redirects to Google
- [ ] Grant permissions → success message shown
- [ ] User tokens stored in KV
- [ ] User added to authenticated_users list

### Data Isolation
- [ ] User A creates event → User B cannot see it
- [ ] User A creates task → User B cannot see it
- [ ] Notifications sent only to respective users

### Starred Tasks
- [ ] Create task with "重要" → shows ⭐
- [ ] Create task with "★" → shows ⭐
- [ ] Create urgent task → shows ⭐
- [ ] Task list sorted: starred → due date → updated

### Error Handling
- [ ] Gemini API failure → retries 3 times
- [ ] Missing date → asks for date
- [ ] Invalid format → helpful error message
- [ ] Calendar API error → clear instructions

### Notifications
- [ ] Multiple users receive separate notifications
- [ ] Weekly report on Sunday 21:00 (per user)
- [ ] Day before notification at 18:00
- [ ] 1 hour before notification
- [ ] Task deadline notifications

## Support

For issues or questions:
1. Check logs: `wrangler tail`
2. Verify KV storage: `wrangler kv:key list --binding=NOTIFICATIONS`
3. Test OAuth flow manually
4. Check Google Cloud Console audit logs

## Next Steps

Consider implementing:
- User logout command (`/logout`)
- Admin dashboard for monitoring users
- Usage analytics per user
- Rate limiting per user
- Custom notification preferences
