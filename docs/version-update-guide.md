# 版本更新机制

## 版本号规范

采用语义化版本号（Semantic Versioning）：`MAJOR.MINOR.PATCH`

| 版本段 | 含义 | 示例 |
|--------|------|------|
| MAJOR | 重大重构/不兼容变更 | 2.0.0（架构升级） |
| MINOR | 新功能/向后兼容 | 1.1.0（新增语音备忘） |
| PATCH | Bug 修复/小优化 | 1.0.1（修复 XSS 漏洞） |

### Android 版本号配置

在 `android/app/build.gradle` 中配置：

```groovy
defaultConfig {
    versionCode 2        // 整数递增，每次发布 +1
    versionName "1.0.1"  // 语义化版本号
}
```

- `versionCode`：Google Play 用于判断升级/降级的整数，每次发布必须递增
- `versionName`：用户可见的版本号字符串

### Web PWA 版本标识

在 `sw.js` 中通过缓存版本号管理：

```javascript
const CACHE = 'travel-assistant-v3';  // 发布新版本时递增 v3 → v4
```

## Web PWA 更新流程

### 自动更新机制

```
用户访问 → SW 检查更新 → 发现新版本 → 后台下载缓存 → 下次刷新生效
```

1. **Service Worker 生命周期**：浏览器在后台调用 `sw.js` 的 `install` 事件，预缓存新资源
2. **激活新缓存**：旧标签页关闭后，新 SW 激活，删除旧缓存（`caches.delete`）
3. **用户感知**：下次刷新页面时加载新版本

### 发布 Web 更新

```bash
# 1. 修改代码
# 2. 更新 sw.js 中的 CACHE 版本号（如 v3 → v4）
# 3. 提交并推送
git add -A
git commit -m "release: v1.0.1 - 修复XXX"
git push origin main

# 4. GitHub Actions 自动部署到 GitHub Pages
# 5. 用户刷新浏览器即可获取新版本
```

### 强制更新提示（可选）

在 `travel-assistant.html` 中添加更新检测：

```javascript
// 监听 SW 更新
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        // 显示"新版本可用，刷新以更新"提示
    });
}
```

## Android APK 更新流程

### 构建新版本

```powershell
# 1. 更新 android/app/build.gradle 中的 versionCode 和 versionName
# 2. 同步 Web 资源
npx cap sync android

# 3. 构建 Release APK
.\build-android.ps1 -BuildType release

# 4. 验证签名
& $env:LOCALAPPDATA\Android\Sdk\build-tools\36.0.0\apksigner.bat verify --print-certs app-release.apk
```

### 分发方式

#### 方式一：直接安装（推荐，个人使用）

```bash
# 通过 ADB 安装（覆盖更新，保留 localStorage 数据）
adb install -r app-release.apk
```

将 APK 文件传输到手机（微信/USB/云盘），手机点击安装即可。

#### 方式二：GitHub Release 分发

```bash
# 创建 GitHub Release 并上传 APK
gh release create v1.0.1 app-release.apk --title "v1.0.1" --notes "修复XXX"
```

用户通过 Release 页面下载 APK 安装。

#### 方式三：Google Play（如需公开发布）

```bash
# 构建 AAB
.\build-android.ps1 -BuildType release -AAB

# 上传 app-release.aab 到 Google Play Console
# 用户通过 Play Store 自动更新
```

### 更新通知

对于直接安装方式，可在应用内添加版本检查：

```javascript
// 检查最新版本（通过 GitHub API）
async function checkUpdate() {
    const res = await fetch('https://api.github.com/repos/Xu549952/travel-assistant-pwa/releases/latest');
    const data = await res.json();
    const latestVersion = data.tag_name; // e.g. "v1.0.1"
    // 比较版本号，提示用户更新
}
```

## 数据兼容性

### localStorage 数据迁移

行程数据存储在 localStorage 的 `TripStore` 中。版本更新时需确保数据兼容：

```javascript
// 数据版本检测与迁移
const DATA_VERSION = '1.0';
const storedVersion = localStorage.getItem('dataVersion');
if (storedVersion !== DATA_VERSION) {
    // 执行数据迁移逻辑
    migrateData(storedVersion, DATA_VERSION);
    localStorage.setItem('dataVersion', DATA_VERSION);
}
```

### 向后兼容原则

- 新版本读取旧数据时，缺失字段使用默认值
- 不删除已有字段，只新增字段
- Schema 验证（`validateSchema()`）自动处理字段缺失

## 回滚方案

### Web PWA 回滚

```bash
# 回退到上一个 commit
git revert HEAD
git push origin main
# GitHub Actions 自动重新部署
```

### Android APK 回滚

```bash
# 卸载新版本，安装旧版本
adb uninstall com.zhonggu.travelassistant
adb install app-release-1.0.0.apk

# 注意：卸载会清除 localStorage 数据
# 建议回滚前先导出数据备份
```

## 发布检查清单

每次发布新版本前，逐项确认：

- [ ] 更新 `sw.js` 中的 CACHE 版本号
- [ ] 更新 `android/app/build.gradle` 中的 versionCode 和 versionName
- [ ] 所有单元测试通过（`npm test`）
- [ ] Lighthouse CI 评分达标（Performance ≥ 85）
- [ ] 真机测试通过（安装、启动、离线、核心功能）
- [ ] 数据兼容性验证（旧数据在新版本中正常加载）
- [ ] 提交 Git 并推送
- [ ] GitHub Actions CI 通过
- [ ] 构建 Release APK 并验证签名
- [ ] 更新 Release Notes
