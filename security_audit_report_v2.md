# 安全复审报告 v2

**审计日期**: 2026-08-09  
**审计范围**: travel-assistant.html, sw.js, manifest.json, lib/  
**审计方法**: 基于 OWASP 前端安全规范 + 项目历次变更增量审查  
**上次审计**: 2026-08-09（首次审计，修复 SEC-001~007）

---

## 执行摘要

本次复审聚焦于上次审计后的变更：SW 应用壳缓存扩展、CDN 资源本地化、core-utils.js 提取。审计发现 **3 个新问题**（2 Medium, 1 Low），均与图片 URL 未转义相关。上次审计的 2 个架构限制问题（SEC-003 Token 存储、SEC-004 CSP unsafe-inline）维持原状，已有缓解措施。

**威胁模型**: 攻击者通过构造恶意分享链接（URL hash 中的 base64 编码行程数据），在受害者浏览器中执行 XSS。

---

## 新发现问题

### SEC-008: 日记照片 URL 未转义导致 XSS（Medium）

**Rule ID**: JS-XSS-001  
**Severity**: Medium  
**Location**: `travel-assistant.html` 第 6140 行，`renderDiary()` 函数

**Evidence**:
```javascript
// Line 6140
html+='<img class="diary-photo-thumb" src="'+p+'" data-src="'+p+'" alt="日记照片" loading="lazy">';
```

**Impact**: `p` 来自 `e.photos` 数组，行程数据可通过分享链接（URL hash base64 编码）注入。若 `p` 包含 `" onerror="alert(1)" x="`，将突破 src 属性边界执行任意 JavaScript。攻击者构造恶意分享链接即可在受害者浏览器中执行 XSS。

**Fix**: 对 `p` 应用 `escapeHtml()` 转义：
```javascript
html+='<img class="diary-photo-thumb" src="'+escapeHtml(p)+'" data-src="'+escapeHtml(p)+'" alt="日记照片" loading="lazy">';
```

---

### SEC-009: 票务照片 URL 未转义导致 XSS（Medium）

**Rule ID**: JS-XSS-001  
**Severity**: Medium  
**Location**: `travel-assistant.html` 第 6411 行，票务渲染函数

**Evidence**:
```javascript
// Line 6411
html+='<img class="ticket-photo" src="'+t.photo+'" data-src="'+t.photo+'" alt="票务截图" loading="lazy">';
```

**Impact**: `t.photo` 来自票务数据，同样可通过分享链接注入。注意：SEC-007 修复（第 6465 行）仅在编辑模态框中验证了 `ticketEditPhoto` 的协议白名单，但此渲染路径未做任何转义或验证。

**Fix**: 对 `t.photo` 应用 `escapeHtml()` 转义：
```javascript
html+='<img class="ticket-photo" src="'+escapeHtml(t.photo)+'" data-src="'+escapeHtml(t.photo)+'" alt="票务截图" loading="lazy">';
```

---

### SEC-010: 日记模态框照片预览 URL 未转义（Medium）

**Rule ID**: JS-XSS-001  
**Severity**: Medium  
**Location**: `travel-assistant.html` 第 6213 行，`updateDiaryPhotoPreview()` 函数

**Evidence**:
```javascript
// Line 6213
'<img src="'+p+'" style="width:60px;height:60px;object-fit:cover;border-radius:6px;cursor:pointer" data-del-photo="'+i+'">'
```

**Impact**: `p` 来自 `diaryEditPhotos` 数组。虽然该数组通常来自用户本地上传，但当编辑来自分享链接的行程日记时，`p` 可能为攻击者控制的值。

**Fix**: 对 `p` 应用 `escapeHtml()` 转义：
```javascript
'<img src="'+escapeHtml(p)+'" style="..." data-del-photo="'+i+'">'
```

---

### SEC-011: Amap 链接 window.open 缺少 'noopener'（Low）

**Rule ID**: JS-URL-001  
**Severity**: Low  
**Location**: `travel-assistant.html` 第 5875、5877 行，`openInMaps()` 函数

**Evidence**:
```javascript
// Line 5875
setTimeout(()=>{window.open(amapUrl,'_blank')},1500);
// Line 5877
window.open(amapUrl,'_blank');
```

**Impact**: 打开新标签页时未指定 `'noopener'`，新页面可通过 `window.opener` 访问原始页面（反向标签页劫持）。虽然 `amapUrl` 指向可信的 `uri.amap.com`，但仍违反安全最佳实践。上次审计的 SEC-006 已修复 Google Calendar 的同类问题，此处遗漏。

**Fix**: 添加 `'noopener'` 参数：
```javascript
window.open(amapUrl,'_blank','noopener');
```

---

## 已知架构限制（维持原状）

### SEC-003: GitHub Token 存储在 localStorage（Low，已接受）

**Location**: 第 6809、6818 行  
**Status**: 架构限制。单文件 HTML 无后端，Token 必须存储在客户端。已有缓解：CSP 限制 connect-src、Token 格式校验、用户可随时清除。  
**Risk**: 单次 XSS 可窃取 Token。但 SEC-008/009/010 修复后，XSS 攻击面大幅缩小。

### SEC-004: CSP 含 'unsafe-inline'/'unsafe-eval'（Low，已接受）

**Location**: 第 16 行 CSP meta 标签  
**Status**: 架构限制。单文件 HTML 内联脚本必然需要 'unsafe-inline'；marked.js 需要 'unsafe-eval'。已有缓解：DOMPurify sanitization + SRI 完整性校验 + restricted connect-src/img-src。

### AI API Key 存储在 localStorage（Low，已接受）

**Location**: 第 3947-3954 行  
**Status**: 与 SEC-003 同类。API Key 仅发送到用户选择的 LLM 端点，不经过第三方。

---

## 已验证安全的项目

| 检查项 | 状态 | 说明 |
|--------|------|------|
| document.write / eval / new Function | ✅ 无 | 全文搜索未发现 |
| setAttribute("on...", string) | ✅ 无 | 事件处理均使用 addEventListener 或函数赋值 |
| postMessage | ✅ 无 | 未使用跨窗口通信 |
| 外部脚本 SRI | ✅ 完整 | 3 个首屏脚本 + 5 个按需加载脚本均有 SRI hash |
| CSP connect-src | ✅ 限制 | 仅允许已知 API 域名 |
| CSP img-src | ✅ 限制 | 'self' data: https: blob: |
| escapeHtml() 使用 | ⚠️ 部分 | 多数 innerHTML 已使用，但照片 URL 路径遗漏（SEC-008/009/010） |
| sanitizeHtml() 使用 | ✅ 正确 | parseHTML 路径先 sanitize 再 innerHTML |
| img src 协议验证 | ⚠️ 部分 | ticketEditPhoto 有验证（SEC-007），渲染路径未验证 |
| SW 缓存安全 | ✅ 安全 | 仅缓存应用壳静态资源，不缓存 API 响应或用户数据 |
| core-utils.js | ✅ 安全 | 仅包含纯函数，无敏感信息，未被 HTML 加载 |
| manifest.json | ✅ 安全 | start_url 指向正确应用页面 |

---

## 修复优先级

| ID | 严重度 | 修复复杂度 | 建议顺序 |
|----|--------|-----------|---------|
| SEC-008 | Medium | 低（1 行） | 1 |
| SEC-009 | Medium | 低（1 行） | 2 |
| SEC-010 | Medium | 低（1 行） | 3 |
| SEC-011 | Low | 低（2 行） | 4 |

**预估总工时**: 10 分钟  
**修复方式**: 每处添加 `escapeHtml()` 调用 + `window.open` 添加 `'noopener'`

---

## 结论

本次复审发现的核心问题是**照片 URL 在 innerHTML 中未转义**，形成通过分享链接的 XSS 攻击链。这与上次审计修复的 SEC-001（ticketEditPhoto 未转义）属于同一类问题的不同代码路径。修复方案统一且简单：在所有图片 URL 插入 innerHTML 的位置添加 `escapeHtml()` 调用。

SW 应用壳缓存扩展和 CDN 本地化变更未引入新的安全问题。SRI 完整性校验覆盖所有外部脚本，SW 缓存策略正确排除了 API 响应和用户数据。
