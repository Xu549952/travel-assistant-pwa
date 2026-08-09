/**
 * validateTripSchema 单元测试
 * 测试行程数据结构校验函数的各种场景
 */
const { validateTripSchema } = require('../lib/core-utils');

describe('validateTripSchema - 行程数据结构校验', () => {

  // ============================================================
  // 辅助函数：构建一个完全有效的行程数据对象
  // ============================================================
  function buildValidTrip() {
    return {
      title: '测试行程',
      startDate: '2026-09-15',
      endDate: '2026-09-18',
      days: [
        {
          day: 0,
          title: '第一天',
          date: '2026-09-15',
          items: [
            { time: '08:00', title: '出发', desc: '从家里出发', cost: '', badge: '', badgeType: '', detail: '' }
          ]
        }
      ],
      budget: {
        categories: { food: { name: '餐饮' } },
        expenses: [
          { name: '午餐', amount: 50, cat: 'food', paid: false }
        ],
        dayBudgets: { 0: 200 }
      },
      checklist: {
        booking: [{ text: '订机票' }],
        packing: [{ text: '带充电器' }]
      }
    };
  }

  // ============================================================
  // 顶层类型校验
  // ============================================================
  describe('顶层类型校验', () => {
    test('null 输入应返回 valid:false 及错误信息', () => {
      const result = validateTripSchema(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('数据不是有效的JSON对象');
      expect(result.warnings).toEqual([]);
    });

    test('undefined 输入应返回 valid:false 及错误信息', () => {
      const result = validateTripSchema(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('数据不是有效的JSON对象');
    });

    test('数组输入应返回 valid:false（不是对象）', () => {
      const result = validateTripSchema([1, 2, 3]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('数据不是有效的JSON对象');
    });

    test('空对象应返回 valid:true（所有字段都是可选的）', () => {
      const result = validateTripSchema({});
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  // ============================================================
  // 完整有效数据
  // ============================================================
  describe('有效数据校验', () => {
    test('完整的有效行程数据应通过校验，无错误和警告', () => {
      const result = validateTripSchema(buildValidTrip());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test('仅包含 title 的对象应通过校验', () => {
      const result = validateTripSchema({ title: '简单行程' });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  // ============================================================
  // 标题校验
  // ============================================================
  describe('标题校验', () => {
    test('title 为非字符串类型应生成警告', () => {
      const result = validateTripSchema({ title: 123 });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('title 应为字符串类型，已自动转换');
    });

    test('title 为数组应生成警告', () => {
      const result = validateTripSchema({ title: ['数组'] });
      expect(result.warnings).toContain('title 应为字符串类型，已自动转换');
    });
  });

  // ============================================================
  // 日期校验
  // ============================================================
  describe('日期校验', () => {
    test('startDate 格式无效应生成警告', () => {
      const result = validateTripSchema({ startDate: '2026/09/15' });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('startDate 格式无效（应为 YYYY-MM-DD），将使用默认日期');
    });

    test('startDate 为非字符串应生成警告', () => {
      const result = validateTripSchema({ startDate: 20260915 });
      expect(result.warnings).toContain('startDate 格式无效（应为 YYYY-MM-DD），将使用默认日期');
    });

    test('startDate 格式不完整应生成警告', () => {
      const result = validateTripSchema({ startDate: '2026-9-15' });
      expect(result.warnings).toContain('startDate 格式无效（应为 YYYY-MM-DD），将使用默认日期');
    });

    test('endDate 格式无效应生成警告', () => {
      const result = validateTripSchema({ endDate: 'invalid-date' });
      expect(result.warnings).toContain('endDate 格式无效（应为 YYYY-MM-DD），将使用默认日期');
    });

    test('endDate 早于 startDate 应生成警告', () => {
      const result = validateTripSchema({
        startDate: '2026-09-18',
        endDate: '2026-09-15'
      });
      expect(result.warnings).toContain('结束日期早于开始日期');
    });

    test('endDate 等于 startDate 不应生成警告', () => {
      const result = validateTripSchema({
        startDate: '2026-09-15',
        endDate: '2026-09-15'
      });
      expect(result.warnings).not.toContain('结束日期早于开始日期');
    });

    test('有效的日期范围不应生成任何警告', () => {
      const result = validateTripSchema({
        startDate: '2026-09-15',
        endDate: '2026-09-20'
      });
      expect(result.warnings).not.toContain('结束日期早于开始日期');
    });
  });

  // ============================================================
  // 天数数组校验
  // ============================================================
  describe('天数数组校验', () => {
    test('days 不是数组应生成错误', () => {
      const result = validateTripSchema({ days: '不是数组' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('days 字段应为数组类型');
    });

    test('days 超过 100 天应生成错误', () => {
      const days = [];
      for (let i = 0; i < 101; i++) {
        days.push({ day: i, title: 'Day ' + i, date: '2026-09-15', items: [] });
      }
      const result = validateTripSchema({ days: days });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('行程天数超过100天上限');
    });

    test('days 恰好 100 天不应生成错误', () => {
      const days = [];
      for (let i = 0; i < 100; i++) {
        days.push({ day: i, title: 'Day ' + i, date: '2026-09-15', items: [] });
      }
      const result = validateTripSchema({ days: days });
      expect(result.errors).not.toContain('行程天数超过100天上限');
    });

    test('days 元素不是对象应生成错误', () => {
      const result = validateTripSchema({ days: ['字符串', null, 42] });
      expect(result.errors).toContain('days[0] 不是有效对象');
      expect(result.errors).toContain('days[1] 不是有效对象');
      expect(result.errors).toContain('days[2] 不是有效对象');
    });

    test('day.day 不是数字应生成警告', () => {
      const result = validateTripSchema({ days: [{ day: '零', items: [] }] });
      expect(result.warnings).toContain('days[0].day 应为数字类型');
    });

    test('day.title 不是字符串应生成警告', () => {
      const result = validateTripSchema({ days: [{ title: 123, items: [] }] });
      expect(result.warnings).toContain('days[0].title 应为字符串类型');
    });

    test('day.date 格式无效应生成警告', () => {
      const result = validateTripSchema({ days: [{ date: 'bad-date', items: [] }] });
      expect(result.warnings).toContain('days[0].date 格式无效');
    });

    test('day.items 不是数组应生成错误', () => {
      const result = validateTripSchema({ days: [{ items: '不是数组' }] });
      expect(result.errors).toContain('days[0].items 应为数组类型');
    });

    test('day.items 元素不是对象应生成错误', () => {
      const result = validateTripSchema({ days: [{ items: ['字符串', null] }] });
      expect(result.errors).toContain('days[0].items[0] 不是有效对象');
      expect(result.errors).toContain('days[0].items[1] 不是有效对象');
    });

    test('item 字段类型不正确应生成警告', () => {
      const result = validateTripSchema({
        days: [{
          items: [{ time: 123, title: 456, desc: true }]
        }]
      });
      expect(result.warnings).toContain('days[0].items[0].time 应为字符串类型');
      expect(result.warnings).toContain('days[0].items[0].title 应为字符串类型');
      expect(result.warnings).toContain('days[0].items[0].desc 应为字符串类型');
    });
  });

  // ============================================================
  // 预算校验
  // ============================================================
  describe('预算校验', () => {
    test('budget 不是对象应生成错误', () => {
      const result = validateTripSchema({ budget: '不是对象' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('budget 应为对象类型');
    });

    test('budget 为数组应生成错误', () => {
      const result = validateTripSchema({ budget: [] });
      expect(result.errors).toContain('budget 应为对象类型');
    });

    test('budget.categories 不是对象应生成警告', () => {
      const result = validateTripSchema({ budget: { categories: '不是对象' } });
      expect(result.warnings).toContain('budget.categories 应为对象类型');
    });

    test('budget.expenses 不是数组应生成错误', () => {
      const result = validateTripSchema({ budget: { expenses: '不是数组' } });
      expect(result.errors).toContain('budget.expenses 应为数组类型');
    });

    test('budget.expenses 超过 500 条应生成错误', () => {
      const expenses = [];
      for (let i = 0; i < 501; i++) {
        expenses.push({ name: '费用' + i, amount: 10, cat: 'other', paid: false });
      }
      const result = validateTripSchema({ budget: { expenses: expenses } });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('预算项目超过500条上限');
    });

    test('budget.expenses 恰好 500 条不应生成错误', () => {
      const expenses = [];
      for (let i = 0; i < 500; i++) {
        expenses.push({ name: '费用' + i, amount: 10, cat: 'other', paid: false });
      }
      const result = validateTripSchema({ budget: { expenses: expenses } });
      expect(result.errors).not.toContain('预算项目超过500条上限');
    });

    test('expense.amount 不是数字应生成警告', () => {
      const result = validateTripSchema({
        budget: { expenses: [{ name: '测试', amount: '50', cat: 'food', paid: false }] }
      });
      expect(result.warnings).toContain('budget.expenses[0].amount 应为有效数字，该项将被过滤');
    });

    test('expense.amount 为 NaN 应生成警告', () => {
      const result = validateTripSchema({
        budget: { expenses: [{ name: '测试', amount: NaN, cat: 'food', paid: false }] }
      });
      expect(result.warnings).toContain('budget.expenses[0].amount 应为有效数字，该项将被过滤');
    });

    test('expense.paid 不是布尔值应生成警告', () => {
      const result = validateTripSchema({
        budget: { expenses: [{ name: '测试', amount: 50, cat: 'food', paid: 'yes' }] }
      });
      expect(result.warnings).toContain('budget.expenses[0].paid 应为布尔值');
    });

    test('expense.cat 不是字符串应生成警告', () => {
      const result = validateTripSchema({
        budget: { expenses: [{ name: '测试', amount: 50, cat: 123, paid: false }] }
      });
      expect(result.warnings).toContain('budget.expenses[0].cat 应为字符串类型');
    });

    test('expense 不是对象应生成错误', () => {
      const result = validateTripSchema({
        budget: { expenses: ['字符串', null] }
      });
      expect(result.errors).toContain('budget.expenses[0] 不是有效对象');
      expect(result.errors).toContain('budget.expenses[1] 不是有效对象');
    });

    test('budget.dayBudgets 不是对象应生成警告', () => {
      const result = validateTripSchema({ budget: { dayBudgets: '不是对象' } });
      expect(result.warnings).toContain('budget.dayBudgets 应为对象类型');
    });

    test('budget.dayBudgets 值为非数字应生成警告', () => {
      const result = validateTripSchema({ budget: { dayBudgets: { 0: 'abc' } } });
      expect(result.warnings).toContain('budget.dayBudgets[0] 应为非负数字');
    });

    test('budget.dayBudgets 值为负数应生成警告', () => {
      const result = validateTripSchema({ budget: { dayBudgets: { 1: -50 } } });
      expect(result.warnings).toContain('budget.dayBudgets[1] 应为非负数字');
    });
  });

  // ============================================================
  // 清单校验
  // ============================================================
  describe('清单校验', () => {
    test('checklist 不是对象应生成错误', () => {
      const result = validateTripSchema({ checklist: '不是对象' });
      expect(result.errors).toContain('checklist 应为对象类型');
    });

    test('checklist.booking 不是数组应生成错误', () => {
      const result = validateTripSchema({ checklist: { booking: '不是数组' } });
      expect(result.errors).toContain('checklist.booking 应为数组类型');
    });

    test('checklist.packing 不是数组应生成错误', () => {
      const result = validateTripSchema({ checklist: { packing: 123 } });
      expect(result.errors).toContain('checklist.packing 应为数组类型');
    });

    test('checklist 元素不是对象应生成错误', () => {
      const result = validateTripSchema({
        checklist: { booking: ['字符串'], packing: [null] }
      });
      expect(result.errors).toContain('checklist.booking[0] 不是有效对象');
      expect(result.errors).toContain('checklist.packing[0] 不是有效对象');
    });
  });

  // ============================================================
  // 其他字段校验
  // ============================================================
  describe('其他字段校验', () => {
    test('hotels 不是数组应生成错误', () => {
      const result = validateTripSchema({ hotels: '不是数组' });
      expect(result.errors).toContain('hotels 应为数组类型');
    });

    test('hotels 元素不是对象应生成警告', () => {
      const result = validateTripSchema({ hotels: ['字符串', null] });
      expect(result.warnings).toContain('hotels[0] 不是有效对象，将被跳过');
      expect(result.warnings).toContain('hotels[1] 不是有效对象，将被跳过');
    });

    test('emergency 不是数组应生成错误', () => {
      const result = validateTripSchema({ emergency: '不是数组' });
      expect(result.errors).toContain('emergency 应为数组类型');
    });

    test('emergency 元素 phone 不是字符串应生成警告', () => {
      const result = validateTripSchema({ emergency: [{ name: '测试', phone: 110 }] });
      expect(result.warnings).toContain('emergency[0].phone 应为字符串类型');
    });

    test('tips 不是数组应生成错误', () => {
      const result = validateTripSchema({ tips: '不是数组' });
      expect(result.errors).toContain('tips 应为数组类型');
    });

    test('diary 不是数组应生成错误', () => {
      const result = validateTripSchema({ diary: '不是数组' });
      expect(result.errors).toContain('diary 应为数组类型');
    });

    test('tickets 不是数组应生成错误', () => {
      const result = validateTripSchema({ tickets: 123 });
      expect(result.errors).toContain('tickets 应为数组类型');
    });

    test('photos 超过 50 张应生成错误', () => {
      const photos = [];
      for (let i = 0; i < 51; i++) {
        photos.push({ url: 'test' + i });
      }
      const result = validateTripSchema({ photos: photos });
      expect(result.errors).toContain('照片超过50张上限');
    });

    test('mapPOIs 不是数组应生成错误', () => {
      const result = validateTripSchema({ mapPOIs: '不是数组' });
      expect(result.errors).toContain('mapPOIs 应为数组类型');
    });

    test('mapPOIs 超过 200 个应生成错误', () => {
      const mapPOIs = [];
      for (let i = 0; i < 201; i++) {
        mapPOIs.push({ lat: 25, lng: 110 });
      }
      const result = validateTripSchema({ mapPOIs: mapPOIs });
      expect(result.errors).toContain('地图POI超过200个上限');
    });

    test('mapPOI 纬度超出范围应生成警告', () => {
      const result = validateTripSchema({ mapPOIs: [{ lat: 100, lng: 110 }] });
      expect(result.warnings).toContain('mapPOIs[0].lat 应为有效纬度（-90~90）');
    });

    test('mapPOI 经度超出范围应生成警告', () => {
      const result = validateTripSchema({ mapPOIs: [{ lat: 25, lng: 200 }] });
      expect(result.warnings).toContain('mapPOIs[0].lng 应为有效经度（-180~180）');
    });

    test('weatherLocation 不是对象应生成警告', () => {
      const result = validateTripSchema({ weatherLocation: '不是对象' });
      expect(result.warnings).toContain('weatherLocation 应为对象类型');
    });

    test('weatherLocation 为 null 不应生成警告', () => {
      const result = validateTripSchema({ weatherLocation: null });
      expect(result.warnings).not.toContain('weatherLocation 应为对象类型');
    });
  });

  // ============================================================
  // 返回值结构
  // ============================================================
  describe('返回值结构', () => {
    test('返回值应包含 valid、errors、warnings 三个字段', () => {
      const result = validateTripSchema({});
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });
});
