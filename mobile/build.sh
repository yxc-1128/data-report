#!/bin/bash
# 收支报表 — 一键构建 Android + iOS 安装包
# 前提：已安装 Node.js、Android Studio、Xcode

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "📱 收支报表 — Capacitor 构建脚本"
echo "================================="
echo ""

cd "$DIR"

# 1. 安装 Capacitor 依赖
echo "📦 安装依赖..."
npm install

# 2. 构建 Android
echo ""
echo "🤖 构建 Android APK..."
npx cap add android 2>/dev/null || echo "  Android 平台已存在"
npx cap sync android

# 写 network_security_config 信任自签名证书（如果需要）
NSC_DIR="$DIR/android/app/src/main/res/xml"
mkdir -p "$NSC_DIR"
cat > "$NSC_DIR/network_security_config.xml" << 'NSC'
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- 信任自签名 HTTPS 证书 -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">reporter.zoe.fan</domain>
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </domain-config>
</network-security-config>
NSC

# 在 AndroidManifest 中引用
MANIFEST="$DIR/android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ]; then
  if ! grep -q 'networkSecurityConfig' "$MANIFEST"; then
    sed -i '' 's|<application|<application android:networkSecurityConfig="@xml/network_security_config"|' "$MANIFEST"
  fi
fi

echo ""
echo "📱 Android APK 构建命令："
echo "   npx cap open android"
echo "   (在 Android Studio 中: Build → Build Bundle(s) / APK(s) → Build APK(s))"
echo "   APK 输出: $DIR/android/app/build/outputs/apk/debug/app-debug.apk"

# 3. 构建 iOS
echo ""
echo "🍎 iOS 构建：（仅 macOS）"
npx cap add ios 2>/dev/null || echo "  iOS 平台已存在"
npx cap sync ios

# 配置 ATS 例外
INFO_PLIST="$DIR/ios/App/App/Info.plist"
if [ -f "$INFO_PLIST" ]; then
  if ! grep -q 'NSAppTransportSecurity' "$INFO_PLIST"; then
    # 在 </dict> 前插入 ATS 配置
    sed -i '' 's|</dict>|  <key>NSAppTransportSecurity</key>\
  <dict>\
    <key>NSAllowsArbitraryLoads</key>\
    <true/>\
  </dict>\
</dict>|' "$INFO_PLIST"
  fi
fi

echo ""
echo "   npx cap open ios"
echo "   (在 Xcode 中: Product → Archive → Distribute App)"

echo ""
echo "================================="
echo "✅ 工程已就绪！按上述命令打开对应 IDE 构建即可。"
