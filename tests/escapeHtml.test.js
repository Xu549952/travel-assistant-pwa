/**
 * escapeHtml 单元测试
 * 测试 HTML 特殊字符转义函数的各种输入场景
 */
const { escapeHtml } = require('../lib/core-utils');

describe('escapeHtml - HTML 特殊字符转义', () => {

  describe('空值处理', () => {
    test('null 输入应返回空字符串', () => {
      expect(escapeHtml(null)).toBe('');
    });

    test('undefined 输入应返回空字符串', () => {
      expect(escapeHtml(undefined)).toBe('');
    });
  });

  describe('普通字符串', () => {
    test('不含特殊字符的字符串应原样返回', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });

    test('中文字符串应原样返回', () => {
      expect(escapeHtml('桂林山水甲天下')).toBe('桂林山水甲天下');
    });

    test('空字符串应返回空字符串', () => {
      expect(escapeHtml('')).toBe('');
    });

    test('包含空格的字符串应保留空格', () => {
      expect(escapeHtml('  空格  测试  ')).toBe('  空格  测试  ');
    });
  });

  describe('HTML 特殊字符转义', () => {
    test('尖括号 < 应被转义为 &lt;', () => {
      expect(escapeHtml('<')).toBe('&lt;');
    });

    test('尖括号 > 应被转义为 &gt;', () => {
      expect(escapeHtml('>')).toBe('&gt;');
    });

    test('和号 & 应被转义为 &amp;', () => {
      expect(escapeHtml('&')).toBe('&amp;');
    });

    test('双引号 " 应被转义为 &quot;', () => {
      expect(escapeHtml('"')).toBe('&quot;');
    });

    test('单引号应被转义为 &#39;', () => {
      expect(escapeHtml("'")).toBe('&#39;');
    });

    test('所有特殊字符组合应全部转义', () => {
      expect(escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#39;');
    });

    test('和号应最先转义以避免二次转义', () => {
      // & 必须先于其他字符转义，否则 &lt; 中的 & 会被再次转义
      expect(escapeHtml('&lt;')).toBe('&amp;lt;');
    });
  });

  describe('XSS 攻击防护', () => {
    test('应中和 <script> 标签 XSS 载荷', () => {
      const payload = '<script>alert(\'xss\')</script>';
      const result = escapeHtml(payload);
      expect(result).toBe('&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;');
      // 确保结果中不包含可执行的 HTML 标签
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    test('应中和 img onerror XSS 载荷', () => {
      const payload = '"><img src=x onerror=alert(1)>';
      const result = escapeHtml(payload);
      expect(result).toBe('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
      expect(result).not.toContain('<img');
    });

    test('应中和事件处理器注入', () => {
      const payload = '<div onclick="alert(\'xss\')">点击</div>';
      const result = escapeHtml(payload);
      expect(result).toBe('&lt;div onclick=&quot;alert(&#39;xss&#39;)&quot;&gt;点击&lt;/div&gt;');
      expect(result).not.toContain('<div');
      expect(result).not.toContain('onclick="');
    });

    test('应中和 javascript: 协议注入', () => {
      const payload = '<a href="javascript:alert(1)">链接</a>';
      const result = escapeHtml(payload);
      expect(result).toContain('&lt;a href=&quot;javascript:alert(1)&quot;&gt;');
      expect(result).not.toContain('<a ');
    });

    test('应中和 SVG onload XSS 载荷', () => {
      const payload = '<svg onload=alert(1)>';
      const result = escapeHtml(payload);
      expect(result).toBe('&lt;svg onload=alert(1)&gt;');
      expect(result).not.toContain('<svg');
    });
  });

  describe('非字符串类型转换', () => {
    test('数字应被转换为字符串', () => {
      expect(escapeHtml(42)).toBe('42');
    });

    test('数字 0 应被转换为字符串 "0"（不因 falsy 而返回空）', () => {
      expect(escapeHtml(0)).toBe('0');
    });

    test('浮点数应被转换为字符串', () => {
      expect(escapeHtml(3.14)).toBe('3.14');
    });

    test('NaN 应被转换为字符串 "NaN"', () => {
      expect(escapeHtml(NaN)).toBe('NaN');
    });

    test('布尔值 true 应被转换为字符串 "true"', () => {
      expect(escapeHtml(true)).toBe('true');
    });

    test('布尔值 false 应被转换为字符串 "false"（不因 falsy 而返回空）', () => {
      expect(escapeHtml(false)).toBe('false');
    });

    test('普通对象应通过 toString 转换为 "[object Object]"', () => {
      expect(escapeHtml({})).toBe('[object Object]');
    });

    test('自定义 toString 的对象应调用 toString 方法', () => {
      const obj = { toString: () => '<b>加粗</b>' };
      expect(escapeHtml(obj)).toBe('&lt;b&gt;加粗&lt;/b&gt;');
    });

    test('数组应被转换为逗号分隔字符串', () => {
      expect(escapeHtml([1, 2, 3])).toBe('1,2,3');
    });
  });

  describe('混合内容', () => {
    test('HTML 标签与文本混合应正确转义', () => {
      const input = '访问 <b>桂林</b> & <i>阳朔</i>';
      const result = escapeHtml(input);
      expect(result).toBe('访问 &lt;b&gt;桂林&lt;/b&gt; &amp; &lt;i&gt;阳朔&lt;/i&gt;');
    });

    test('包含 & 符号的 URL 应正确转义', () => {
      const input = 'https://example.com?a=1&b=2';
      const result = escapeHtml(input);
      expect(result).toBe('https://example.com?a=1&amp;b=2');
    });

    test('多次出现的特殊字符应全部转义', () => {
      const input = '<<>>&&""\'\'';
      const result = escapeHtml(input);
      expect(result).toBe('&lt;&lt;&gt;&gt;&amp;&amp;&quot;&quot;&#39;&#39;');
    });
  });
});
