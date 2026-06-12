# 收支报表 — Android/iOS 移动端构建

本目录是基于 [Capacitor](https://capacitorjs.com/) 的移动端壳工程，
将 Web 应用包装为原生 APK/IPA。

## 前提

- Node.js ≥ 18
- **Android**: Android Studio + JDK 17 + Android SDK
- **iOS**: Xcode 15+ + CocoaPods (仅 macOS)

## 构建 Android APK

```bash
cd mobile

# 1. 安装依赖
npm install

# 2. 构建 web 资源（空目录即可，实际加载远程 URL）
mkdir -p www

# 3. 同步 Android 项目
npx cap add android
npx cap sync android

# 4. 用 Android Studio 打开并构建
npx cap open android
# → Build → Build Bundle(s) / APK(s) → Build APK(s)
```

APK 输出在 `mobile/android/app/build/outputs/apk/debug/`

## 构建 iOS

```bash
cd mobile
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
# → Xcode 中 Product → Archive
```

## 服务器地址

当前指向 `https://reporter.zoe.fan:16666`。
如需修改，编辑 `capacitor.config.ts` 中的 `server.url`。

## 首次运行注意事项

- Android 模拟器用 `10.0.2.2` 访问宿主机
- 自签名证书需在 Android 的 `network_security_config.xml` 中信任
- iOS 需在 `Info.plist` 中配置 `App Transport Security` 例外
