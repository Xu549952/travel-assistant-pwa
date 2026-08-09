/**
 * core-utils.js
 * ============================================================
 * 旅行助手 - 核心工具函数模块（从 travel-assistant.html 中提取）
 *
 * 本模块从单文件 PWA (travel-assistant.html) 中抽取了关键纯函数，
 * 使其可被 Jest 单元测试覆盖，同时保持与原文件完全一致的逻辑。
 *
 * 包含的函数：
 *   - escapeHtml          HTML 转义
 *   - validateTripSchema  行程数据结构校验
 *   - parseMarkdown       Markdown 文本解析为行程对象
 *
 * 辅助函数（parseMarkdown 的依赖，一并内联）：
 *   - uid, getWeekday, createEmptyTrip, normalizeTrip, parseListItem
 *
 * UMD 格式：既可作为 <script> 引入（挂载到全局 CoreUtils），
 *           也可作为 Node.js 模块使用 (module.exports)。
 * ============================================================
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node.js / CommonJS
    module.exports = factory();
  } else {
    // 浏览器全局
    root.CoreUtils = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ============================================================
  // 常量定义（与 travel-assistant.html 中保持一致）
  // ============================================================

  // 预算分类配置
  var DEFAULT_CAT_CONFIG = {
    flight: { name: '大交通', emoji: '✈️', color: '#4B3FE3' },
    hotel: { name: '住宿', emoji: '🏨', color: '#4CAF50' },
    ticket: { name: '门票活动', emoji: '🎫', color: '#FF9800' },
    food: { name: '餐饮', emoji: '🍜', color: '#E91E63' },
    transport: { name: '当地交通', emoji: '🚕', color: '#00BCD4' },
    other: { name: '其他', emoji: '🎁', color: '#9C27B0' }
  };

  // 地图标记默认颜色
  var DEFAULT_CAT_COLORS = { hotel: '#4B3FE3', scenic: '#4CAF50', transport: '#FF9800', food: '#E91E63' };

  // 地图标记默认图标
  var DEFAULT_CAT_ICONS = { hotel: '🏨', scenic: '🏞️', transport: '🚗', food: '🍜' };

  // ============================================================
  // 通用辅助函数
  // ============================================================

  /**
   * 生成唯一 ID
   * @param {string} prefix 前缀
   * @returns {string} 唯一标识符
   */
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  /**
   * 获取中文星期
   * @param {Date} d 日期对象
   * @returns {string} 如 "周一"
   */
  function getWeekday(d) {
    var wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return wd[new Date(d).getDay()];
  }

  // ============================================================
  // escapeHtml —— HTML 特殊字符转义
  // 原始位置: travel-assistant.html 第 2202 行
  // ============================================================

  /**
   * 将字符串中的 HTML 特殊字符转义，防止 XSS
   * @param {*} str 输入值（null/undefined 返回空字符串）
   * @returns {string} 转义后的安全字符串
   */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ============================================================
  // createEmptyTrip —— 创建空行程对象
  // 原始位置: travel-assistant.html 第 3176 行
  // ============================================================

  /**
   * 创建一个包含所有默认字段的空行程对象
   * @param {Object} opts 可选参数 { title, destination, emoji, startDate, endDate, travelers }
   * @returns {Object} 完整的空行程对象
   */
  function createEmptyTrip(opts) {
    opts = opts || {};
    var start = opts.startDate || new Date().toISOString().slice(0, 10);
    var end = opts.endDate || start;
    var days = Math.max(1, Math.ceil((new Date(end) - new Date(start)) / (86400000)) + 1);
    var dayArr = [];
    for (var i = 0; i < days; i++) {
      var d = new Date(start); d.setDate(d.getDate() + i);
      dayArr.push({
        day: i,
        title: 'Day ' + i + ' · ' + (d.getMonth() + 1) + '月' + d.getDate() + '日（' + getWeekday(d) + '）',
        theme: '',
        date: d.toISOString().slice(0, 10),
        items: []
      });
    }
    return {
      id: uid('trip'),
      title: opts.title || '新行程',
      destination: opts.destination || '',
      emoji: opts.emoji || '🧳',
      startDate: start,
      endDate: end,
      travelers: opts.travelers || '',
      highlights: '',
      weatherLocation: null,
      countdownDate: start,
      days: dayArr,
      budget: {
        categories: JSON.parse(JSON.stringify(DEFAULT_CAT_CONFIG)),
        expenses: [],
        dayBudgets: {}
      },
      checklist: { booking: [], packing: [] },
      hotels: [],
      emergency: [
        { name: '报警', phone: '110' },
        { name: '急救', phone: '120' },
        { name: '旅游投诉热线', phone: '12301' }
      ],
      tips: [],
      diary: [],
      tickets: [],
      photos: [],
      splitMembers: [],
      mapPOIs: [],
      dayRoutes: {},
      mapCenter: { lat: 35, lng: 105, zoom: 4 },
      catColors: JSON.parse(JSON.stringify(DEFAULT_CAT_COLORS)),
      catIcons: JSON.parse(JSON.stringify(DEFAULT_CAT_ICONS)),
      createdAt: new Date().toISOString(),
      version: '1.0'
    };
  }

  // ============================================================
  // normalizeTrip —— 规范化行程对象，补全缺失字段
  // 原始位置: travel-assistant.html 第 3749 行（Importer.normalizeTrip）
  // ============================================================

  /**
   * 确保行程对象包含所有必需字段，过滤无效预算项
   * @param {Object} trip 行程对象
   * @returns {Object} 规范化后的行程对象
   */
  function normalizeTrip(trip) {
    if (!trip.id) trip.id = uid('trip');
    if (!trip.emoji) trip.emoji = '🧳';
    if (!trip.startDate) trip.startDate = new Date().toISOString().slice(0, 10);
    if (!trip.endDate) trip.endDate = trip.startDate;
    if (!trip.days) trip.days = [];
    if (!trip.budget) trip.budget = { categories: JSON.parse(JSON.stringify(DEFAULT_CAT_CONFIG)), expenses: [], dayBudgets: {} };
    if (!trip.budget.categories) trip.budget.categories = JSON.parse(JSON.stringify(DEFAULT_CAT_CONFIG));
    if (!trip.budget.expenses) trip.budget.expenses = [];
    if (!trip.budget.dayBudgets) trip.budget.dayBudgets = {};
    if (!trip.checklist) trip.checklist = { booking: [], packing: [] };
    if (!trip.checklist.booking) trip.checklist.booking = [];
    if (!trip.checklist.packing) trip.checklist.packing = [];
    if (!trip.hotels) trip.hotels = [];
    if (!trip.emergency) trip.emergency = [{ name: '报警', phone: '110' }, { name: '急救', phone: '120' }];
    if (!trip.tips) trip.tips = [];
    if (!trip.diary) trip.diary = [];
    if (!trip.tickets) trip.tickets = [];
    if (!trip.photos) trip.photos = [];
    if (!trip.mapPOIs) trip.mapPOIs = [];
    if (!trip.dayRoutes) trip.dayRoutes = {};
    if (!trip.mapCenter) trip.mapCenter = { lat: 35, lng: 105, zoom: 4 };
    if (!trip.catColors) trip.catColors = JSON.parse(JSON.stringify(DEFAULT_CAT_COLORS));
    if (!trip.catIcons) trip.catIcons = JSON.parse(JSON.stringify(DEFAULT_CAT_ICONS));
    if (!trip.countdownDate) trip.countdownDate = trip.startDate;
    if (!trip.version) trip.version = '1.0';
    if (!trip.createdAt) trip.createdAt = new Date().toISOString();

    // 过滤无效的预算项（amount 必须是有效数字）
    trip.budget.expenses = trip.budget.expenses.filter(function (e) {
      return e && typeof e.amount === 'number' && !isNaN(e.amount);
    });
    // 确保每个预算项包含必需字段
    trip.budget.expenses.forEach(function (e) {
      if (!e.id) e.id = uid('exp');
      if (typeof e.paid !== 'boolean') e.paid = false;
      if (!e.cat) e.cat = 'other';
      if (e.custom === undefined) e.custom = false;
      // day 字段: null/undefined = 未分配, number = 天数索引
      if (e.day !== undefined && e.day !== null && (typeof e.day !== 'number' || isNaN(e.day) || e.day < 0)) {
        e.day = null;
      }
    });

    return trip;
  }

  // ============================================================
  // parseListItem —— 解析列表项（Markdown 列表行的具体处理）
  // 原始位置: travel-assistant.html 第 3686 行（Importer.parseListItem）
  // ============================================================

  /**
   * 解析 Markdown 列表项内容，根据当前 section 分发到行程的不同部分
   * @param {string} content 列表项内容（不含 "- " 或 "* " 前缀）
   * @param {Object} trip 行程对象
   * @param {number} currentDay 当前天数索引
   * @param {string} section 当前区域（itinerary/hotels/packing/booking/budget/emergency/tips/other）
   */
  function parseListItem(content, trip, currentDay, section) {
    // 带勾选框的清单项 [ ] / [x]
    var checkMatch = content.match(/^\[([ xX])\]\s*(.+)/);
    if (checkMatch) {
      var checked = checkMatch[1].toLowerCase() === 'x';
      var text = checkMatch[2];
      if (section === 'booking') {
        trip.checklist.booking.push({ id: uid('b'), text: text, tag: '', tagType: '', meta: '', deadline: '', checked: checked, custom: false });
      } else if (section === 'packing') {
        trip.checklist.packing.push({ id: uid('p'), text: text, checked: checked, custom: false });
      }
      return;
    }

    // 预算项（含金额）
    var costMatch = content.match(/(¥|￥)(\d+(?:\.\d+)?)/);
    if (costMatch && section === 'budget') {
      var amount = parseFloat(costMatch[2]);
      var name = content.replace(/[¥￥]\d+(?:\.\d+)?/g, '').replace(/[（）()×]/g, '').trim();
      var cat = 'other';
      if (/机票|航班|高铁|火车/.test(name)) cat = 'flight';
      else if (/酒店|住宿|民宿/.test(name)) cat = 'hotel';
      else if (/门票|景区|游船|竹筏|索道/.test(name)) cat = 'ticket';
      else if (/餐|吃|饭|粉|鱼/.test(name)) cat = 'food';
      else if (/打车|出租|地铁|公交/.test(name)) cat = 'transport';
      trip.budget.expenses.push({ id: uid('exp'), name: name, amount: amount, paid: false, cat: cat, custom: false });
      return;
    }

    // 酒店项
    if (section === 'hotels') {
      var hotelName = content.replace(/\*\*/g, '');
      trip.hotels.push({ id: uid('hotel'), name: hotelName, subtitle: '', icon: '🏨', nights: 1, info: hotelName, tags: [], price: '', paid: false });
      return;
    }

    // 应急联系人
    if (section === 'emergency') {
      var phoneMatch = content.match(/(\d{3,})/);
      if (phoneMatch) {
        trip.emergency.push({ name: content.replace(phoneMatch[0], '').replace(/[：:（）()-]/g, '').trim(), phone: phoneMatch[0] });
      }
      return;
    }

    // 提示
    if (section === 'tips') {
      if (!trip.tips.length) trip.tips.push({ icon: '💡', title: '实用提示', items: [] });
      trip.tips[0].items.push(content.replace(/\*\*/g, ''));
      return;
    }

    // 行程项
    if (section === 'itinerary' && currentDay >= 0 && trip.days[currentDay]) {
      var timeMatch = content.match(/^(\d{1,2}:\d{2}(?:[-~]\d{1,2}:\d{2})?)\s*(.*)/);
      if (timeMatch) {
        trip.days[currentDay].items.push({ time: timeMatch[1], title: timeMatch[2].replace(/\*\*/g, ''), desc: content, cost: '', badge: '', badgeType: '', detail: '' });
      } else {
        trip.days[currentDay].items.push({ time: '', title: content.replace(/\*\*/g, ''), desc: content, cost: '', badge: '', badgeType: '', detail: '' });
      }
    }
  }

  // ============================================================
  // parseMarkdown —— 将 Markdown 文本解析为行程对象
  // 原始位置: travel-assistant.html 第 3282 行（Importer.parseMarkdown）
  // ============================================================

  /**
   * 将 Markdown 文本解析为结构化的行程对象
   *
   * 支持的语法：
   *   # 标题         → 行程标题（H1）
   *   ## Day N       → 天数标题（支持 "Day 1"、"第1天"、"9月15日" 格式）
   *   ## 住宿/清单/预算等 → 分区标题
   *   ### 主题       → 当天主题（H3）
   *   08:30 活动     → 时间行程项
   *   08:30-10:00 活动 → 时间段行程项
   *   - 列表项       → 根据当前分区分发
   *   ¥100 / ￥50.50 → 预算项（自动分类）
   *
   * @param {string} text Markdown 文本
   * @returns {Object} 解析后的行程对象（经过 normalizeTrip 规范化）
   */
  function parseMarkdown(text) {
    var trip = createEmptyTrip({ title: '导入的行程' });
    var lines = text.split('\n');
    var currentDay = -1;
    var currentSection = '';
    var currentItem = null;
    var dayMap = {}; // 天数编号 -> trip.days 中的索引

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      // H1 - 行程标题
      if (line.startsWith('# ') && !line.startsWith('## ')) {
        trip.title = line.slice(2).trim();
        continue;
      }

      // H2 - 天数或分区
      if (line.startsWith('## ')) {
        var heading = line.slice(3).trim();
        var dayMatch = heading.match(/(?:Day\s*(\d+)|第\s*(\d+)\s*天|(\d+)月(\d+)日)/i);
        if (dayMatch) {
          var dayNum = dayMatch[1] || dayMatch[2] || 0;
          if (dayMatch[3]) dayNum = 0; // 基于日期的标题，使用索引
          if (!dayMap[dayNum]) {
            dayMap[dayNum] = trip.days.length;
            if (trip.days.length === 0 || dayNum > 0) {
              if (trip.days.length <= dayNum) {
                while (trip.days.length <= dayNum) {
                  var d = new Date(trip.startDate); d.setDate(d.getDate() + trip.days.length);
                  trip.days.push({ day: trip.days.length, title: 'Day ' + trip.days.length, theme: '', date: d.toISOString().slice(0, 10), items: [] });
                }
              }
            }
          }
          currentDay = dayMap[dayNum] || 0;
          if (trip.days[currentDay]) trip.days[currentDay].title = heading;
          currentSection = 'itinerary';
        } else if (/住宿|酒店/.test(heading)) {
          currentSection = 'hotels';
        } else if (/清单|准备|打包/.test(heading)) {
          currentSection = 'packing';
        } else if (/预订|门票/.test(heading)) {
          currentSection = 'booking';
        } else if (/预算|费用|开支/.test(heading)) {
          currentSection = 'budget';
        } else if (/应急|紧急|电话/.test(heading)) {
          currentSection = 'emergency';
        } else if (/提示|注意|贴士/.test(heading)) {
          currentSection = 'tips';
        } else {
          currentSection = 'other';
        }
        continue;
      }

      // H3 - 子标题
      if (line.startsWith('### ')) {
        if (currentDay >= 0 && currentSection === 'itinerary' && trip.days[currentDay]) {
          trip.days[currentDay].theme = line.slice(4).trim();
        }
        continue;
      }

      // 列表项
      if (line.startsWith('- ') || line.startsWith('* ')) {
        var content = line.slice(2).trim();
        parseListItem(content, trip, currentDay, currentSection);
        continue;
      }

      // 基于时间的行程项（如 "08:30 活动" 或 "08:30-10:00 活动"）
      var timeMatch = line.match(/^(\d{1,2}:\d{2}(?:[-~]\d{1,2}:\d{2})?)\s+(.+)/);
      if (timeMatch && currentDay >= 0 && currentSection === 'itinerary' && trip.days[currentDay]) {
        trip.days[currentDay].items.push({
          time: timeMatch[1],
          title: timeMatch[2].replace(/\*\*/g, ''),
          desc: timeMatch[2],
          cost: '',
          badge: '',
          badgeType: '',
          detail: ''
        });
        continue;
      }

      // 从任意行提取费用（仅在 budget 分区）
      var costMatch = line.match(/(¥|￥)(\d+(?:\.\d+)?)/);
      if (costMatch && currentSection === 'budget') {
        var amount = parseFloat(costMatch[2]);
        var name = line.replace(/¥|￥/g, '').replace(/\d+(?:\.\d+)?/g, '').replace(/[（）()×]/g, '').trim() || '费用';
        var cat = 'other';
        if (/机票|航班|高铁|火车|大巴|交通/.test(name)) cat = 'flight';
        else if (/酒店|住宿|民宿/.test(name)) cat = 'hotel';
        else if (/门票|景区|游船|竹筏|索道/.test(name)) cat = 'ticket';
        else if (/餐|吃|饭|粉|鱼|美食/.test(name)) cat = 'food';
        else if (/打车|出租|地铁|公交/.test(name)) cat = 'transport';
        trip.budget.expenses.push({ id: uid('exp'), name: name, amount: amount, paid: false, cat: cat, custom: false });
        continue;
      }
    }

    // 尝试从标题中提取目的地
    var destMatch = trip.title.match(/([^\d]+?)(?:旅行|旅游|攻略|行程|之旅)/);
    if (destMatch) trip.destination = destMatch[1].trim();

    return normalizeTrip(trip);
  }

  // ============================================================
  // validateTripSchema —— 校验行程数据结构
  // 原始位置: travel-assistant.html 第 3421 行（Importer.validateSchema）
  // ============================================================

  /**
   * 校验导入的行程数据是否符合预期结构
   * @param {*} data 待校验的数据
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   *   - valid: 是否通过校验（无 error）
   *   - errors: 致命错误列表（导致 valid=false）
   *   - warnings: 警告列表（不阻断导入，但会被修正/忽略）
   */
  function validateTripSchema(data) {
    var errors = [];
    var warnings = [];

    // 顶层类型检查
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      errors.push('数据不是有效的JSON对象');
      return { valid: false, errors: errors, warnings: warnings };
    }

    // --- 标题 ---
    if (data.title !== undefined && typeof data.title !== 'string') {
      warnings.push('title 应为字符串类型，已自动转换');
    }

    // --- 日期 ---
    var dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (data.startDate !== undefined) {
      if (typeof data.startDate !== 'string' || !dateRegex.test(data.startDate) || isNaN(new Date(data.startDate).getTime())) {
        warnings.push('startDate 格式无效（应为 YYYY-MM-DD），将使用默认日期');
      }
    }
    if (data.endDate !== undefined) {
      if (typeof data.endDate !== 'string' || !dateRegex.test(data.endDate) || isNaN(new Date(data.endDate).getTime())) {
        warnings.push('endDate 格式无效（应为 YYYY-MM-DD），将使用默认日期');
      }
    }
    if (data.startDate && data.endDate && !isNaN(new Date(data.startDate).getTime()) && !isNaN(new Date(data.endDate).getTime())) {
      if (new Date(data.endDate) < new Date(data.startDate)) {
        warnings.push('结束日期早于开始日期');
      }
    }

    // --- 天数数组 ---
    if (data.days !== undefined) {
      if (!Array.isArray(data.days)) {
        errors.push('days 字段应为数组类型');
      } else {
        if (data.days.length > 100) {
          errors.push('行程天数超过100天上限');
        }
        data.days.forEach(function (day, idx) {
          if (!day || typeof day !== 'object' || Array.isArray(day)) {
            errors.push('days[' + idx + '] 不是有效对象');
            return;
          }
          if (day.day !== undefined && typeof day.day !== 'number') {
            warnings.push('days[' + idx + '].day 应为数字类型');
          }
          if (day.title !== undefined && typeof day.title !== 'string') {
            warnings.push('days[' + idx + '].title 应为字符串类型');
          }
          if (day.date !== undefined && (typeof day.date !== 'string' || !dateRegex.test(day.date))) {
            warnings.push('days[' + idx + '].date 格式无效');
          }
          if (day.items !== undefined) {
            if (!Array.isArray(day.items)) {
              errors.push('days[' + idx + '].items 应为数组类型');
            } else {
              day.items.forEach(function (item, j) {
                if (!item || typeof item !== 'object' || Array.isArray(item)) {
                  errors.push('days[' + idx + '].items[' + j + '] 不是有效对象');
                  return;
                }
                var itemFields = ['time', 'title', 'desc', 'cost', 'badge', 'badgeType', 'detail'];
                itemFields.forEach(function (f) {
                  if (item[f] !== undefined && typeof item[f] !== 'string') {
                    warnings.push('days[' + idx + '].items[' + j + '].' + f + ' 应为字符串类型');
                  }
                });
              });
            }
          }
        });
      }
    }

    // --- 预算 ---
    if (data.budget !== undefined) {
      if (typeof data.budget !== 'object' || Array.isArray(data.budget)) {
        errors.push('budget 应为对象类型');
      } else {
        if (data.budget.categories !== undefined) {
          if (typeof data.budget.categories !== 'object' || Array.isArray(data.budget.categories)) {
            warnings.push('budget.categories 应为对象类型');
          }
        }
        if (data.budget.expenses !== undefined) {
          if (!Array.isArray(data.budget.expenses)) {
            errors.push('budget.expenses 应为数组类型');
          } else {
            if (data.budget.expenses.length > 500) {
              errors.push('预算项目超过500条上限');
            }
            data.budget.expenses.forEach(function (e, idx) {
              if (!e || typeof e !== 'object' || Array.isArray(e)) {
                errors.push('budget.expenses[' + idx + '] 不是有效对象');
                return;
              }
              if (e.amount !== undefined && (typeof e.amount !== 'number' || isNaN(e.amount))) {
                warnings.push('budget.expenses[' + idx + '].amount 应为有效数字，该项将被过滤');
              }
              if (e.paid !== undefined && typeof e.paid !== 'boolean') {
                warnings.push('budget.expenses[' + idx + '].paid 应为布尔值');
              }
              if (e.cat !== undefined && typeof e.cat !== 'string') {
                warnings.push('budget.expenses[' + idx + '].cat 应为字符串类型');
              }
              if (e.day !== undefined && e.day !== null && (typeof e.day !== 'number' || isNaN(e.day))) {
                warnings.push('budget.expenses[' + idx + '].day 应为数字或 null');
              }
            });
          }
        }
        if (data.budget.dayBudgets !== undefined) {
          if (typeof data.budget.dayBudgets !== 'object' || Array.isArray(data.budget.dayBudgets)) {
            warnings.push('budget.dayBudgets 应为对象类型');
          } else {
            Object.keys(data.budget.dayBudgets).forEach(function (k) {
              var v = data.budget.dayBudgets[k];
              if (typeof v !== 'number' || isNaN(v) || v < 0) {
                warnings.push('budget.dayBudgets[' + k + '] 应为非负数字');
              }
            });
          }
        }
      }
    }

    // --- 清单 ---
    if (data.checklist !== undefined) {
      if (typeof data.checklist !== 'object' || Array.isArray(data.checklist)) {
        errors.push('checklist 应为对象类型');
      } else {
        ['booking', 'packing'].forEach(function (key) {
          if (data.checklist[key] !== undefined) {
            if (!Array.isArray(data.checklist[key])) {
              errors.push('checklist.' + key + ' 应为数组类型');
            } else {
              data.checklist[key].forEach(function (item, idx) {
                if (!item || typeof item !== 'object' || Array.isArray(item)) {
                  errors.push('checklist.' + key + '[' + idx + '] 不是有效对象');
                }
              });
            }
          }
        });
      }
    }

    // --- 酒店 ---
    if (data.hotels !== undefined) {
      if (!Array.isArray(data.hotels)) {
        errors.push('hotels 应为数组类型');
      } else {
        data.hotels.forEach(function (h, idx) {
          if (!h || typeof h !== 'object' || Array.isArray(h)) {
            warnings.push('hotels[' + idx + '] 不是有效对象，将被跳过');
          }
        });
      }
    }

    // --- 应急 ---
    if (data.emergency !== undefined) {
      if (!Array.isArray(data.emergency)) {
        errors.push('emergency 应为数组类型');
      } else {
        data.emergency.forEach(function (e, idx) {
          if (!e || typeof e !== 'object' || Array.isArray(e)) {
            warnings.push('emergency[' + idx + '] 不是有效对象');
          } else {
            if (e.phone !== undefined && typeof e.phone !== 'string') {
              warnings.push('emergency[' + idx + '].phone 应为字符串类型');
            }
          }
        });
      }
    }

    // --- 提示 ---
    if (data.tips !== undefined && !Array.isArray(data.tips)) {
      errors.push('tips 应为数组类型');
    }

    // --- 日记 ---
    if (data.diary !== undefined) {
      if (!Array.isArray(data.diary)) {
        errors.push('diary 应为数组类型');
      } else {
        data.diary.forEach(function (e, idx) {
          if (!e || typeof e !== 'object' || Array.isArray(e)) {
            warnings.push('diary[' + idx + '] 不是有效对象，将被跳过');
          }
        });
      }
    }

    // --- 票务 ---
    if (data.tickets !== undefined) {
      if (!Array.isArray(data.tickets)) {
        errors.push('tickets 应为数组类型');
      } else {
        data.tickets.forEach(function (t, idx) {
          if (!t || typeof t !== 'object' || Array.isArray(t)) {
            warnings.push('tickets[' + idx + '] 不是有效对象，将被跳过');
          }
        });
      }
    }

    // --- 照片 ---
    if (data.photos !== undefined) {
      if (!Array.isArray(data.photos)) {
        errors.push('photos 应为数组类型');
      } else {
        if (data.photos.length > 50) errors.push('照片超过50张上限');
        data.photos.forEach(function (p, idx) {
          if (!p || typeof p !== 'object' || Array.isArray(p)) {
            warnings.push('photos[' + idx + '] 不是有效对象，将被跳过');
          }
        });
      }
    }

    // --- 地图POI ---
    if (data.mapPOIs !== undefined) {
      if (!Array.isArray(data.mapPOIs)) {
        errors.push('mapPOIs 应为数组类型');
      } else {
        if (data.mapPOIs.length > 200) {
          errors.push('地图POI超过200个上限');
        }
        data.mapPOIs.forEach(function (poi, idx) {
          if (!poi || typeof poi !== 'object' || Array.isArray(poi)) {
            warnings.push('mapPOIs[' + idx + '] 不是有效对象，将被跳过');
            return;
          }
          if (poi.lat !== undefined && (typeof poi.lat !== 'number' || isNaN(poi.lat) || poi.lat < -90 || poi.lat > 90)) {
            warnings.push('mapPOIs[' + idx + '].lat 应为有效纬度（-90~90）');
          }
          if (poi.lng !== undefined && (typeof poi.lng !== 'number' || isNaN(poi.lng) || poi.lng < -180 || poi.lng > 180)) {
            warnings.push('mapPOIs[' + idx + '].lng 应为有效经度（-180~180）');
          }
        });
      }
    }

    // --- 天气位置 ---
    if (data.weatherLocation !== undefined && data.weatherLocation !== null) {
      if (typeof data.weatherLocation !== 'object' || Array.isArray(data.weatherLocation)) {
        warnings.push('weatherLocation 应为对象类型');
      } else {
        if (data.weatherLocation.lat !== undefined && (typeof data.weatherLocation.lat !== 'number' || isNaN(data.weatherLocation.lat))) {
          warnings.push('weatherLocation.lat 应为数字类型');
        }
        if (data.weatherLocation.lng !== undefined && (typeof data.weatherLocation.lng !== 'number' || isNaN(data.weatherLocation.lng))) {
          warnings.push('weatherLocation.lng 应为数字类型');
        }
      }
    }

    return { valid: errors.length === 0, errors: errors, warnings: warnings };
  }

  // ============================================================
  // 导出公共 API
  // ============================================================
  return {
    escapeHtml: escapeHtml,
    validateTripSchema: validateTripSchema,
    parseMarkdown: parseMarkdown,
    // 辅助函数也一并导出，便于单独测试
    createEmptyTrip: createEmptyTrip,
    normalizeTrip: normalizeTrip,
    parseListItem: parseListItem,
    uid: uid,
    getWeekday: getWeekday,
    DEFAULT_CAT_CONFIG: DEFAULT_CAT_CONFIG,
    DEFAULT_CAT_COLORS: DEFAULT_CAT_COLORS,
    DEFAULT_CAT_ICONS: DEFAULT_CAT_ICONS
  };
}));
