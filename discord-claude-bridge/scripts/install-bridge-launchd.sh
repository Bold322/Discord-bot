#!/bin/bash
# Bridge-ийг Mac дээр launchd-ээр үргэлж ажиллуулж байх (login хийхэд автоматаар асна, унавал дахин асна).
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/com.way.discord-claude-bridge.plist"
NODE="$(which node)"

cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.way.discord-claude-bridge</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$DIR/src/bridge.js</string></array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DIR/bridge.log</string>
  <key>StandardErrorPath</key><string>$DIR/bridge.log</string>
</dict></plist>
PL

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "✅ bridge launchd service installed. Log: $DIR/bridge.log"
echo "   stop:  launchctl unload $PLIST"
