/**
 * Claude Chat Page - Inline Handler Version
 */

export function getClaudeChatPage(liffId) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Claude Chat</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f5f5;height:100vh;display:flex;flex-direction:column}
.hd{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:16px;text-align:center}
.hd h1{font-size:18px}
#st{font-size:12px;margin-top:4px}
#ch{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
.m{max-width:85%;padding:12px 16px;border-radius:18px;font-size:15px;line-height:1.5;white-space:pre-wrap}
.m.u{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;align-self:flex-end}
.m.b{background:#fff;color:#333;align-self:flex-start;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.m.s{background:#e8e8e8;color:#666;align-self:center;font-size:13px}
.m.e{background:#ffebee;color:#c62828;align-self:center}
#ty{display:none;padding:12px 16px;background:#fff;border-radius:18px;align-self:flex-start}
#ty.v{display:flex;gap:4px}
#ty span{width:8px;height:8px;background:#667eea;border-radius:50%;animation:bn 1.4s infinite}
#ty span:nth-child(2){animation-delay:.2s}
#ty span:nth-child(3){animation-delay:.4s}
@keyframes bn{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-8px)}}
.ia{background:#fff;padding:12px 16px;display:flex;gap:12px;align-items:center}
#mi{flex:1;border:2px solid #e0e0e0;border-radius:24px;padding:12px 16px;font-size:16px;outline:none}
#mi:focus{border-color:#667eea}
#sb{width:48px;height:48px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:50%;font-size:20px}
#sb:disabled{opacity:.5}
</style>
</head>
<body>
<div class="hd"><h1>Claude Code</h1><div id="st">読込中...</div></div>
<div id="ch">
<div class="m s">Claude Codeに指示できます</div>
<div id="ty"><span></span><span></span><span></span></div>
</div>
<div class="ia">
<input type="text" id="mi" placeholder="メッセージを入力..." onkeypress="if(event.keyCode==13)doSend()">
<button id="sb" onclick="doSend()">➤</button>
</div>
<script>
var AID=null,BUSY=false,API=location.origin;
function gid(x){return document.getElementById(x)}
function addM(t,c){var d=document.createElement('div');d.className='m '+c;d.textContent=t;var ch=gid('ch'),ty=gid('ty');ch.insertBefore(d,ty);ch.scrollTop=ch.scrollHeight}
function doSend(){
var i=gid('mi'),t=i.value.trim();
if(!t||BUSY)return;
if(!AID){addM('接続中...','e');return}
addM(t,'u');i.value='';BUSY=true;gid('sb').disabled=true;gid('ty').className='v';
var x=new XMLHttpRequest();
x.open('POST',API+'/api/claude/chat',true);
x.setRequestHeader('Content-Type','application/json');
x.onload=function(){
gid('ty').className='';BUSY=false;gid('sb').disabled=false;
try{var r=JSON.parse(x.responseText);if(r.success&&r.response)addM(r.response,'b');else addM('Error: '+(r.error||'Unknown'),'e')}catch(e){addM('Parse error','e')}
};
x.onerror=function(){gid('ty').className='';BUSY=false;gid('sb').disabled=false;addM('Network error','e')};
x.send(JSON.stringify({userId:AID,message:t}));
}
(function(){
var x=new XMLHttpRequest();
x.open('GET',API+'/api/admin-check',true);
x.onload=function(){
try{var d=JSON.parse(x.responseText);if(d.adminUserId){AID=d.adminUserId;gid('st').textContent='Online';gid('st').style.color='#4caf50'}else{gid('st').textContent='No admin';gid('st').style.color='#f44336'}}catch(e){gid('st').textContent='Error';gid('st').style.color='#f44336'}
};
x.send();
})();
</script>
</body>
</html>`;
}
