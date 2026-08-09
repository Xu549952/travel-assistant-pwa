# 旅行助手 PWA 安全审计报告

**审计日期**: 2026-08-09  
**审计文件**: `d:\项目1\旅行助手.html`  
**文件大小**: ~467KB  
**语言/框架**: 纯 JavaScript（Vanilla JS），单文件静态 HTML PWA  
**审计依据**: OWASP DOM-based XSS Prevention Cheat Sheet, MDN CSP/SRI/Trusted Types 文档  

---

## 执行摘要

本次审计对 `旅行助手.html` 进行了全面安全扫描，覆盖 DOM XSS 注入点、CSP 策略、第三方脚本完整性、敏感数据存储、URL 导航安全等关键领域。共发现 **7 项安全问题**，其中 Critical 1 项、High 2 项、Medium 2 项、Low 2 项。

**关键发现**：
- 1 项 Critical XSS 漏洞：分享链接中的 `photo` 字段未转义直接插入 innerHTML
- Vosk-Browser 脚本缺少 SRI 完整性校验
- GitHub Token 和 API Key 存储在 localStorage（架构限制，已记录为已知风险）

**整体安全态势**：应用已具备良好的安全基础（escapeHtml 函数、DOMPurify 消毒、CSP 策略、SRI 哈希），但新实现的功能（P2-4 行程对比、P0-3 日历导出）及部分既有代码存在需修复的安全缺口。

---

## 审计范围与方法

### 识别的语言和框架
- **前端语言**: JavaScript (ES6+, 无 TypeScript)
- **框架**: 无框架（Vanilla JS），使用原生 DOM API
- **第三方库**: DOMPurify 3.1.6, Leaflet 1.9.4, marked.js, Tesseract.js 5.1.1, mammoth 1.6.0, html2canvas 1.4.1, jsPDF 2.5.1, Vosk-Browser 0.0.5
- **架构**: 单文件静态 HTML，无后端服务器

### 扫描模式
依据 `javascript-general-web-frontend-security.md` 和 `javascript-jquery-web-frontend-security.md` 参考文档，按以下顺序系统性扫描：

1. HTML 入口与 CSP 策略
2. DOM XSS 注入点（innerHTML, document.write, eval 等）
3. URL 导航安全（window.location, window.open）
4. 跨窗口通信（postMessage）
5. 敏感数据存储（localStorage）
6. 第三方脚本与 SRI 完整性
7. DOM clobbering 风险

### 扫描结果统计

| 检查项 | 模式 | 命中数 | 状态 |
|--------|------|--------|------|
| innerHTML | `.innerHTML=` | 100+ | 需逐一审查数据源 |
| insertAdjacentHTML | `insertAdjacentHTML(` | 0 | ✅ 安全 |
| document.write | `document.write(` | 0 | ✅ 安全 |
| eval / new Function | `eval(`, `new Function` | 0 | ✅ 安全 |
| 字符串 setTimeout | `setTimeout("` | 0 | ✅ 安全 |
| setAttribute("on...") | `.setAttribute("on` | 0 | ✅ 安全 |
| postMessage | `postMessage(` | 0 | ✅ 安全 |
| 内联 onclick | `onclick=` | 0 | ✅ 已全部重构为 addEventListener |
| javascript: URL | `javascript:` | 0（仅出现在消毒正则中） | ✅ 安全 |
| escapeHtml 函数 | `function escapeHtml` | 1 | ✅ 已实现 |
| sanitizeHtml 函数 | `function sanitizeHtml` | 1 | ✅ 已实现（DOMPurify + 正则回退） |
| CSP meta 标签 | `<meta http-equiv="Content-Security-Policy"` | 1 | ⚠️ 含 unsafe-inline/unsafe-eval |
| SRI 完整性 | `<script ... integrity=` | 4/5 | ⚠️ 1 项缺失 |
| localStorage 敏感数据 | `localStorage.setItem` | 34 | ⚠️ 含 Token/API Key |

---

## 发现详情

### 🔴 SEC-001: 分享链接 photo 字段未转义导致 XSS [Critical]

**Rule ID**: JS-XSS-001  
**Severity**: Critical  
**Location**: `旅行助手.html` 第 6477 行

**Impact**: 攻击者可构造恶意分享链接，通过 `photo` 字段注入任意 JavaScript 代码，在受害者浏览器中执行，可窃取 localStorage 中的 GitHub Token 和 API Key。

**Evidence**:
```javascript
// 第 6459 行：从行程数据（可能来自分享链接）读取 photo
ticketEditPhoto=t.photo||'';

// 第 6477 行：未转义直接插入 innerHTML
pv.innerHTML=ticketEditPhoto?'<img src="'+ticketEditPhoto+'" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px">':'';
```

**数据流分析**:
1. 攻击者构造行程数据，设置 `t.photo` 为 `"><script>alert(document.cookie)</script>`
2. 将行程数据 Base64 编码后放入 URL hash：`#share=<base64>`
3. 受害者打开链接 → `loadSharedTrip()` 解码 JSON → 行程数据被添加到 TripStore
4. 用户查看票务信息时触发 `openTicketModal()` → `ticketEditPhoto` 被设置为恶意值
5. `innerHTML` 注入恶意脚本

**Fix**:
```javascript
// 修复：对 ticketEditPhoto 进行 HTML 转义
pv.innerHTML=ticketEditPhoto?'<img src="'+escapeHtml(ticketEditPhoto)+'" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px">':'';
```

**Mitigation**: 同时增加协议白名单验证，确保 `ticketEditPhoto` 仅允许 `data:image/` 开头：
```javascript
if(ticketEditPhoto && !/^data:image\//.test(ticketEditPhoto)) ticketEditPhoto='';
```

---

### 🟠 SEC-002: Vosk-Browser 脚本缺少 SRI 完整性校验 [High]

**Rule ID**: JS-SRI-001  
**Severity**: High  
**Location**: `旅行助手.html` 第 2835 行

**Impact**: 若 CDN 被入侵或发生中间人攻击，攻击者可替换 Vosk-Browser 脚本，在应用中注入恶意代码。所有其他动态加载的脚本（Tesseract.js, mammoth, html2canvas, jsPDF）均已配置 SRI 哈希，唯独 Vosk-Browser 缺失。

**Evidence**:
```javascript
// 第 2771 行：定义 CDN URL，无 SRI 常量
VOSK_CDN:'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.5/dist/vosk.js',

// 第 2835 行：加载时未传入 integrity 参数
await loadScript(this.VOSK_CDN);  // ← 缺少第二个参数
```

**对比**（其他脚本均正确配置 SRI）：
```javascript
// Tesseract.js - 有 SRI ✅
await loadScript(TESSERACT_CDN,TESSERACT_SRI);

// mammoth - 有 SRI ✅
await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js','sha384-nFoSjZIoH3CCp8W639jJyQkuPHinJ2NHe7on1xvlUA7SuGfJAfvMldrsoAVm6ECz');

// html2canvas - 有 SRI ✅
loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H');
```

**Fix**:
```javascript
// 1. 添加 SRI 常量
VOSK_CDN:'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.5/dist/vosk.js',
VOSK_SRI:'sha384-<计算后的哈希值>',  // 需要计算

// 2. 加载时传入 SRI
await loadScript(this.VOSK_CDN,this.VOSK_SRI);
```

**注意**: 需要从 cdn.jsdelivr.net 获取 vosk-browser@0.0.5 的实际 SRI 哈希值。可使用 `https://www.srihash.org/` 或命令 `curl -s https://cdn.jsdelivr.net/npm/vosk-browser@0.0.5/dist/vosk.js | openssl dgst -sha384 -binary | openssl base64 -A` 计算。

---

### 🟠 SEC-003: 敏感凭据存储在 localStorage [High]

**Rule ID**: JS-STORAGE-001  
**Severity**: High  
**Location**: `旅行助手.html` 第 3950 行、第 6824 行

**Impact**: localStorage 中的数据可被任何 XSS 漏洞读取。结合 SEC-001 的 XSS 漏洞，攻击者可通过分享链接窃取用户的 GitHub Token 和 AI API Key。

**Evidence**:
```javascript
// 第 3950 行：API Key 存入 localStorage
localStorage.setItem(this.KEY,JSON.stringify(config));  // config 包含 apiKey 字段

// 第 6824 行：GitHub Token 存入 localStorage
localStorage.setItem(this.TOKEN_KEY,token);
```

**Fix**: 此问题受单文件 HTML 无后端架构限制，无法完全修复。建议以下缓解措施：

1. **优先修复 SEC-001**：消除 XSS 漏洞后，localStorage 中的数据无法被窃取
2. **Token 格式验证**：已实现（第 6820 行验证 `ghp_` 或 `github_pat_` 前缀）
3. **用户提示**：在 UI 中明确告知用户 Token 仅存储在本地浏览器
4. **Token 最小权限**：已实现（仅需 gist 权限）

**Mitigation**: 已在 UI 中提示用户（第 1763 行："Token 仅存储在本地浏览器，不会上传到任何第三方服务器"）。在 SEC-001 修复后，风险降至可接受水平。

---

### 🟡 SEC-004: CSP 策略包含 unsafe-inline 和 unsafe-eval [Medium]

**Rule ID**: JS-CSP-001  
**Severity**: Medium  
**Location**: `旅行助手.html` 第 16 行

**Impact**: `unsafe-inline` 削弱了 CSP 阻止内联脚本执行的能力；`unsafe-eval` 允许 eval 类 API，增加 XSS 攻击面。

**Evidence**:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; 
  script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' 
  https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; ...">
```

**Assessment**: 此为单文件 HTML 架构的已知限制，已在代码注释中详细记录（第 10-15 行）。缓解措施包括：
- DOMPurify 3.1.6 进行 HTML 消毒
- 所有 CDN 脚本配置 SRI 哈希
- `connect-src` 限制为已知 API 端点
- `unsafe-eval` 由 marked.js 需要

**Fix**: 架构层面无法修复，维持现有缓解措施。未来若迁移到多文件架构，可使用 nonce-based CSP。

---

### 🟡 SEC-005: 错误消息未转义插入 innerHTML [Medium]

**Rule ID**: JS-XSS-001  
**Severity**: Medium  
**Location**: `旅行助手.html` 第 9115 行

**Impact**: `e.message` 虽然通常由浏览器生成（相对安全），但若错误来源于外部 API 响应且包含恶意内容，可能被注入 DOM。

**Evidence**:
```javascript
// 第 9115 行：e.message 未转义
preview.innerHTML='<div class="share-card-loading">⚠️ '+(e.message||'生成失败')+'</div>';
```

**Fix**:
```javascript
preview.innerHTML='<div class="share-card-loading">⚠️ '+escapeHtml(e.message||'生成失败')+'</div>';
```

---

### 🟢 SEC-006: Google Calendar 链接缺少 noopener [Low]

**Rule ID**: JS-URL-001  
**Severity**: Low  
**Location**: `旅行助手.html` 第 9879 行

**Impact**: `window.open(url,'_blank')` 未指定 `'noopener'`，打开的页面可通过 `window.opener` 访问原始窗口，存在反向标签页劫持风险。

**Evidence**:
```javascript
// 第 9879 行（P0-3 日历导出功能）
window.open(url,'_blank');  // ← 缺少 'noopener'
```

**对比**（其他 window.open 调用已正确配置）：
```javascript
// 第 8863 行 - 交通状态查询 ✅
window.open(url,'_blank','noopener');
```

**Fix**:
```javascript
window.open(url,'_blank','noopener');
```

---

### 🟢 SEC-007: 图片 src 缺少协议白名单验证 [Low]

**Rule ID**: JS-URL-002  
**Severity**: Low  
**Location**: `旅行助手.html` 第 6477 行

**Impact**: 即使修复 SEC-001 的转义问题，仍应验证 `ticketEditPhoto` 仅允许 `data:image/` 协议，防止其他协议注入。

**Evidence**:
```javascript
// ticketEditPhoto 可能来自共享链接的任意值
pv.innerHTML=ticketEditPhoto?'<img src="'+ticketEditPhoto+'" ...>':'';
```

**Fix**: 在读取 `t.photo` 时增加协议验证：
```javascript
// 第 6459 行修复
ticketEditPhoto=t.photo||'';
if(ticketEditPhoto && !/^data:image\//.test(ticketEditPhoto))ticketEditPhoto='';
```

---

## 安全合规检查清单

| 检查项 | 状态 | 说明 |
|--------|------|------|
| escapeHtml() 函数已实现 | ✅ | 第 2200 行，正确转义 &, <, >, ", ' |
| sanitizeHtml() 函数已实现 | ✅ | 第 2215 行，使用 DOMPurify + 正则回退 |
| CSP meta 标签已配置 | ✅ | 第 16 行，含 unsafe-inline/unsafe-eval（架构限制） |
| CDN 脚本 SRI 完整性 | ⚠️ | 4/5 已配置，Vosk-Browser 缺失 (SEC-002) |
| DOMPurify 用于 HTML 消毒 | ✅ | 3.1.6 版本，白名单配置 |
| 无 document.write | ✅ | 未使用 |
| 无 eval / new Function | ✅ | 未使用 |
| 无内联 onclick 处理器 | ✅ | 已全部重构为 addEventListener |
| 无 postMessage 跨窗口通信 | ✅ | 未使用 |
| localStorage 不存储敏感数据 | ⚠️ | 存储 Token/API Key (SEC-003，架构限制) |
| window.open 使用 noopener | ⚠️ | 1 处缺失 (SEC-006) |
| target="_blank" 使用 rel="noopener" | ✅ | 第 6990 行已配置 |
| URL 导航安全 | ✅ | 使用 encodeURIComponent 编码参数 |
| 共享链接数据安全 | ⚠️ | photo 字段未转义 (SEC-001) |
| 导入数据预览验证 | ✅ | validateSchema() 已实现 |
| Service Worker 仅缓存地图瓦片 | ✅ | sw.js 独立文件 |

---

## 修复优先级

| 优先级 | ID | 问题 | 工作量 | 风险 |
|--------|----|------|--------|------|
| **P0** | SEC-001 | photo 字段 XSS | 5 分钟 | Critical - 可通过分享链接远程利用 |
| **P0** | SEC-002 | Vosk-Browser 缺少 SRI | 10 分钟 | High - CDN 篡改风险 |
| **P1** | SEC-005 | 错误消息未转义 | 2 分钟 | Medium - 需特定条件触发 |
| **P1** | SEC-006 | window.open 缺少 noopener | 1 分钟 | Low - 反向标签页劫持 |
| **P1** | SEC-007 | 图片 src 协议验证 | 3 分钟 | Low - 纵深防御 |
| **P2** | SEC-003 | localStorage 存储凭据 | 架构限制 | High - 修复 SEC-001 后风险降低 |
| **P2** | SEC-004 | CSP unsafe-inline/eval | 架构限制 | Medium - 已有缓解措施 |

---

## 总结

旅行助手 PWA 整体安全架构良好，已实现 escapeHtml、DOMPurify 消毒、CSP 策略、SRI 完整性校验等多层防护。主要安全风险集中在：

1. **SEC-001（Critical）**：新实现的分享链接功能中，`photo` 字段未经过 `escapeHtml()` 转义直接插入 innerHTML，可通过构造恶意分享链接实现远程 XSS 攻击。此漏洞与 SEC-003 结合可导致 GitHub Token 和 API Key 被窃取，**建议立即修复**。

2. **SEC-002（High）**：Vosk-Browser 脚本动态加载时缺少 SRI 完整性校验，与其他所有 CDN 脚本的安全实践不一致。

3. **架构限制问题**（SEC-003, SEC-004）：localStorage 存储凭据和 CSP unsafe-inline/eval 是单文件 HTML 无后端架构的固有限制，已有缓解措施（DOMPurify + SRI + 受限 connect-src），在修复 SEC-001 后风险可接受。

**建议修复顺序**：SEC-001 → SEC-002 → SEC-005 → SEC-006 → SEC-007，预计总工作量约 20 分钟。
