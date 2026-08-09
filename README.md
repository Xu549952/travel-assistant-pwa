# 旅行助手 PWA

个人旅行规划工具，支持行程管理、预算追踪、预订提醒、离线地图、日记记录等功能。基于 PWA 技术构建，可通过 Capacitor 打包为 Android 原生应用。

## 功能特性

- **行程管理**：多行程创建与切换，时间轴展示每日安排，自动检测行程冲突
- **预算追踪**：分类预算（门票/餐饮/交通/其他），逐日预算分配，收支统计仪表盘
- **预订清单**：预订截止提醒（提前 3 天/1 天/当天通知），勾选完成状态
- **出发清单**：智能打包清单生成，自定义待办事项
- **旅行日记**：图文日记记录，照片附件支持
- **离线地图**：Leaflet + 高德地图瓦片缓存，POI 标记（住宿=紫色/景点=绿色/交通=橙色/餐饮=粉色）
- **攻略导入**：支持 .md / .docx / .txt / .json 格式，预览验证后导入
- **数据备份**：本地 JSON 导入导出 + GitHub Gist 云备份
- **日历导出**：.ics 文件下载（含 1 小时提醒）+ Google Calendar 跳转
- **语音备忘**：Vosk-Browser 离线中文语音识别

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | 原生 HTML/CSS/JavaScript（单文件架构） |
| PWA | Service Worker v3 + Web App Manifest |
| 地图 | Leaflet 1.9.4 + 高德地图瓦片 |
| 安全 | DOMPurify 3.1.6 + escapeHtml + CSP + SRI |
| 测试 | Jest（159 个单元测试） |
| CI/CD | GitHub Actions（单元测试 + Lighthouse CI） |
| 原生打包 | Capacitor 8.5（Android） |
| 语音识别 | Vosk-Browser WASM（离线中文模型） |

## 快速开始

### Web 版本（PWA）

```bash
# 安装依赖
npm install

# 启动本地服务器
npm run serve

# 浏览器访问 http://localhost:8080/travel-assistant.html
```

在线访问：https://xu549952.github.io/travel-assistant-pwa/travel-assistant.html

### Android 版本

#### 环境要求

- Node.js 22+
- JDK 21
- Android SDK（API 24+，Build-Tools 36.0.0）
- Android Studio 2025.2.1+（可选，用于模拟器）

#### 构建步骤

```powershell
# Debug APK（调试用，自带调试签名）
.\build-android.ps1 -BuildType debug

# Release APK（发布用，需配置签名）
.\build-android.ps1 -BuildType release

# Release AAB（Google Play 上架用）
.\build-android.ps1 -BuildType release -AAB

# 清理重建
.\build-android.ps1 -BuildType release -Clean
```

构建产物输出到项目根目录：
- `app-debug.apk` — 调试版（~18MB）
- `app-release.apk` — 发布版（~15MB，已签名）
- `app-release.aab` — Google Play 包（~15MB）

#### 安装到设备

```bash
# USB 连接设备（需开启 USB 调试）
adb install -r app-release.apk
```

## 项目结构

```
travel-assistant-pwa/
├── travel-assistant.html    # 主应用（单文件 HTML）
├── index.html               # Capacitor WebView 入口
├── sw.js                    # Service Worker v3
├── manifest.json            # PWA Manifest
├── capacitor.config.json    # Capacitor 配置
├── build-android.ps1        # Android 构建脚本
├── lib/                     # 本地化第三方库
│   ├── core-utils.js        # 核心工具函数（escapeHtml/validateSchema/parseMarkdown）
│   ├── dompurify-3.1.6.min.js
│   ├── leaflet-1.9.4.min.js
│   ├── leaflet-1.9.4.css
│   ├── marked.min.js
│   ├── notify.js            # 通知模块
│   ├── secure-store.js      # 安全存储模块
│   ├── file-export.js       # 文件导出模块
│   ├── vosk-browser-0.0.7.min.js
│   ├── tesseract-5.x.min.js # OCR（按需加载）
│   └── ...
├── tests/                   # 单元测试
│   ├── escapeHtml.test.js   # 30 个测试
│   ├── validateSchema.test.js # 63 个测试
│   └── parseMarkdown.test.js  # 66 个测试
├── android/                 # Capacitor Android 平台
│   └── app/src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/zhonggu/travelassistant/MainActivity.java
│       └── res/             # 图标/启动画面/配置
├── .github/workflows/
│   └── lighthouse-ci.yml    # CI 工作流
├── lighthouserc.json        # Lighthouse CI 配置
└── package.json
```

## 测试

```bash
# 运行单元测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage
```

测试覆盖：
- `escapeHtml()` — 30 个用例（XSS 防护）
- `validateSchema()` — 63 个用例（数据结构验证）
- `parseMarkdown()` — 66 个用例（攻略文件解析）

## CI/CD

GitHub Actions 自动化流程（2 个并行任务）：

| 任务 | 内容 | 阈值 |
|------|------|------|
| unit-tests | Jest 单元测试 | 全部通过 |
| lighthouse-ci | Lighthouse 性能审计 | Performance ≥ 85, Accessibility ≥ 90 |

Lighthouse 评分：Performance 99 / Accessibility 100 / Best Practices 100 / SEO 100

部署：GitHub Pages 自动部署，访问地址 https://xu549952.github.io/travel-assistant-pwa/travel-assistant.html

## 安全

已完成两轮安全审计，修复 11 个问题：

| 严重级别 | 数量 | 示例 |
|----------|------|------|
| Critical | 1 | XSS（共享链接 photo 字段未转义） |
| High | 4 | SRI 缺失、window.open 缺少 noopener |
| Medium | 4 | innerHTML 未转义、图片协议未校验 |
| Low | 2 | localStorage 存储 Token（架构限制） |

安全措施：DOMPurify HTML 消毒 + escapeHtml 转义 + CSP 内容安全策略 + SRI 子资源完整性 + 网络安全配置（HTTPS only）

## Android 应用信息

| 属性 | 值 |
|------|-----|
| 包名 | com.zhonggu.travelassistant |
| 应用名 | 旅行助手 |
| 版本 | 1.0 (versionCode=1) |
| minSdk | 24 (Android 7.0) |
| targetSdk | 36 (Android 16) |
| 签名证书 | CN=Zhonggu Logistics, OU=Training Tools, O=Zhonggu Logistics, L=Shanghai, ST=Shanghai, C=CN |
| 证书有效期 | 至 2053 年 |

### 权限说明

| 权限 | 用途 |
|------|------|
| INTERNET | 地图瓦片加载、天气 API |
| POST_NOTIFICATIONS | 行程提醒通知 |
| VIBRATE | 通知振动反馈 |
| ACCESS_FINE_LOCATION | 地图定位 |
| SCHEDULE_EXACT_ALARM | 精确闹钟提醒 |
| RECEIVE_BOOT_COMPLETED | 开机自启通知调度 |
| WAKE_LOCK | 通知触发时保持唤醒 |
| ACCESS_NETWORK_STATE | 网络状态检测 |

## License

个人项目，保留所有权利。
