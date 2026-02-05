#!/bin/bash
# Dev Agent VM Setup Script
# Cloud VMでClaude Codeを実行する自律開発エージェントのセットアップ

set -e

PROJECT_ID="line-calendar-bot-20260203"
ZONE="asia-northeast1-b"
INSTANCE_NAME="dev-agent-vm"
MACHINE_TYPE="e2-medium"  # 2 vCPU, 4GB RAM

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Dev Agent VM セットアップスクリプト                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Create the VM
echo "📦 Step 1: VMインスタンスを作成..."

# Check if VM exists
if gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID &>/dev/null; then
  echo "VMは既に存在します。"
  read -p "削除して再作成しますか？ (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    gcloud compute instances delete $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID --quiet
  else
    echo "既存のVMを使用します。"
  fi
fi

# Create VM if it doesn't exist
if ! gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID &>/dev/null; then
  gcloud compute instances create $INSTANCE_NAME \
    --project=$PROJECT_ID \
    --zone=$ZONE \
    --machine-type=$MACHINE_TYPE \
    --image-family=debian-12 \
    --image-project=debian-cloud \
    --boot-disk-size=20GB \
    --boot-disk-type=pd-balanced \
    --tags=http-server,https-server \
    --metadata=startup-script='#!/bin/bash
# Initial startup script
apt-get update
apt-get install -y curl git
'

  echo "✅ VMが作成されました"
  echo "VMの起動を待っています..."
  sleep 30
fi

# Get external IP
EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME \
  --zone=$ZONE \
  --project=$PROJECT_ID \
  --format="value(networkInterfaces[0].accessConfigs[0].natIP)")

echo "External IP: $EXTERNAL_IP"
echo ""

# Step 2: Create firewall rule
echo "🔥 Step 2: ファイアウォールルールを作成..."
gcloud compute firewall-rules describe allow-dev-agent --project=$PROJECT_ID &>/dev/null || \
gcloud compute firewall-rules create allow-dev-agent \
  --project=$PROJECT_ID \
  --allow=tcp:8080 \
  --target-tags=http-server \
  --description="Allow dev agent webhook traffic"

echo "✅ ファイアウォールが設定されました"
echo ""

# Step 3: Create setup script for VM
echo "📝 Step 3: VMセットアップスクリプトを生成..."

cat > /tmp/vm-setup.sh << 'VMSETUP'
#!/bin/bash
set -e

echo "=== Dev Agent VM Setup ==="

# Create dev-agent user
if ! id dev-agent &>/dev/null; then
  sudo useradd -m -s /bin/bash dev-agent
fi

# Install dependencies
sudo apt-get update
sudo apt-get install -y curl git build-essential

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install GitHub CLI
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt-get update
sudo apt-get install -y gh

# Install Claude Code
sudo npm install -g @anthropic-ai/claude-code

echo ""
echo "=== 手動セットアップが必要 ==="
echo ""
echo "1. Claude Codeにログイン（初回のみ、対話操作必要）:"
echo "   sudo -u dev-agent claude --login"
echo ""
echo "2. GitHub CLIにログイン:"
echo "   sudo -u dev-agent gh auth login"
echo ""
echo "3. リポジトリをクローン:"
echo "   sudo -u dev-agent git clone https://github.com/yuiyane/line-calendar-bot.git /home/dev-agent/line-calendar-bot"
echo ""
echo "4. 環境変数を設定:"
echo "   sudo nano /home/dev-agent/.env"
echo ""
echo "5. サービスを起動:"
echo "   sudo systemctl start dev-agent"
echo ""
VMSETUP

# Step 4: Create systemd service file
cat > /tmp/dev-agent.service << 'SERVICE'
[Unit]
Description=Dev Agent VM Server
After=network.target

[Service]
Type=simple
User=dev-agent
WorkingDirectory=/home/dev-agent/line-calendar-bot
EnvironmentFile=/home/dev-agent/.env
ExecStart=/usr/bin/node src/dev-agent-vm/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

# Step 5: Create environment template
cat > /tmp/dev-agent.env << 'ENVFILE'
# Dev Agent Environment Variables
PORT=8080
REPO_PATH=/home/dev-agent/line-calendar-bot

# GitHub Webhook Secret (same as configured in GitHub)
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# LINE Notification (optional)
LINE_CHANNEL_ACCESS_TOKEN=your_line_token_here
ADMIN_USER_ID=your_line_user_id_here
ENVFILE

echo ""
echo "📤 Step 4: ファイルをVMに転送..."
gcloud compute scp /tmp/vm-setup.sh $INSTANCE_NAME:/tmp/vm-setup.sh --zone=$ZONE --project=$PROJECT_ID
gcloud compute scp /tmp/dev-agent.service $INSTANCE_NAME:/tmp/dev-agent.service --zone=$ZONE --project=$PROJECT_ID
gcloud compute scp /tmp/dev-agent.env $INSTANCE_NAME:/tmp/dev-agent.env --zone=$ZONE --project=$PROJECT_ID

echo ""
echo "🚀 Step 5: VMでセットアップを実行..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID --command="
  chmod +x /tmp/vm-setup.sh
  sudo /tmp/vm-setup.sh
  sudo mv /tmp/dev-agent.service /etc/systemd/system/
  sudo mv /tmp/dev-agent.env /home/dev-agent/.env
  sudo chown dev-agent:dev-agent /home/dev-agent/.env
  sudo systemctl daemon-reload
  sudo systemctl enable dev-agent
"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    セットアップ完了                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🖥️  VM IP: $EXTERNAL_IP"
echo "🌐 Webhook URL: http://$EXTERNAL_IP:8080/webhook/github"
echo ""
echo "📝 次のステップ（VMにSSH接続して実行）:"
echo ""
echo "gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID"
echo ""
echo "1. Claude Codeにログイン:"
echo "   sudo -u dev-agent claude --login"
echo ""
echo "2. GitHub CLIにログイン:"
echo "   sudo -u dev-agent gh auth login"
echo ""
echo "3. リポジトリをクローン:"
echo "   sudo -u dev-agent git clone https://github.com/yuiyane/line-calendar-bot.git /home/dev-agent/line-calendar-bot"
echo ""
echo "4. 環境変数を編集:"
echo "   sudo nano /home/dev-agent/.env"
echo ""
echo "5. サービス起動:"
echo "   sudo systemctl start dev-agent"
echo "   sudo systemctl status dev-agent"
echo ""
echo "6. GitHubでWebhookを設定:"
echo "   URL: http://$EXTERNAL_IP:8080/webhook/github"
echo ""
