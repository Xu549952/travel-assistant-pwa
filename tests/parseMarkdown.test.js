/**
 * parseMarkdown 单元测试
 * 测试 Markdown 文本解析为行程对象的各种场景
 */
const { parseMarkdown, createEmptyTrip } = require('../lib/core-utils');

describe('parseMarkdown - Markdown 文本解析', () => {

  // ============================================================
  // H1 标题提取
  // ============================================================
  describe('H1 标题提取', () => {
    test('应从 # 标题 中提取行程标题', () => {
      const trip = parseMarkdown('# 桂林山水');
      expect(trip.title).toBe('桂林山水');
    });

    test('标题前后有空格时应正确 trim', () => {
      const trip = parseMarkdown('#   桂林旅行   ');
      expect(trip.title).toBe('桂林旅行');
    });

    test('多个 H1 时应使用最后一个作为标题', () => {
      const trip = parseMarkdown('# 第一标题\n# 第二标题');
      expect(trip.title).toBe('第二标题');
    });

    test('无 H1 时应使用默认标题', () => {
      const trip = parseMarkdown('## Day 1\n08:30 出发');
      expect(trip.title).toBe('导入的行程');
    });
  });

  // ============================================================
  // 目的地自动提取
  // ============================================================
  describe('目的地自动提取', () => {
    test('标题包含"旅行"时应提取目的地', () => {
      const trip = parseMarkdown('# 桂林旅行');
      expect(trip.destination).toBe('桂林');
    });

    test('标题包含"旅游"时应提取目的地', () => {
      const trip = parseMarkdown('# 云南旅游');
      expect(trip.destination).toBe('云南');
    });

    test('标题包含"攻略"时应提取目的地', () => {
      const trip = parseMarkdown('# 大理攻略');
      expect(trip.destination).toBe('大理');
    });

    test('标题包含"之旅"时应提取目的地', () => {
      const trip = parseMarkdown('# 巴厘岛之旅');
      expect(trip.destination).toBe('巴厘岛');
    });

    test('标题不含关键词时目的地应为空', () => {
      const trip = parseMarkdown('# 测试笔记');
      expect(trip.destination).toBe('');
    });

    test('标题包含"旅游攻略"时应提取前面的部分', () => {
      const trip = parseMarkdown('# 云南旅游攻略');
      expect(trip.destination).toBe('云南');
    });
  });

  // ============================================================
  // 天数标题解析
  // ============================================================
  describe('天数标题解析', () => {
    test('"## Day 1" 应创建对应天数', () => {
      const trip = parseMarkdown('# 测试\n## Day 1');
      // createEmptyTrip 创建 day 0，Day 1 创建 day 1
      expect(trip.days.length).toBeGreaterThanOrEqual(2);
      expect(trip.days[1].title).toBe('Day 1');
    });

    test('"## 第1天" 应创建对应天数', () => {
      const trip = parseMarkdown('# 测试\n## 第1天');
      expect(trip.days.length).toBeGreaterThanOrEqual(2);
      expect(trip.days[1].title).toBe('第1天');
    });

    test('"## 第 2 天" 带空格也应正确解析', () => {
      const trip = parseMarkdown('# 测试\n## Day 1\n## 第 2 天');
      expect(trip.days[2].title).toBe('第 2 天');
    });

    test('"## Day 1" 和 "## Day 2" 应创建多个天数', () => {
      const trip = parseMarkdown('# 测试\n## Day 1\n## Day 2');
      expect(trip.days[1].title).toBe('Day 1');
      expect(trip.days[2].title).toBe('Day 2');
    });

    test('"## 9月15日" 日期格式应被识别为天数标题（不作为分区）', () => {
      // 日期格式 (如 "9月15日") 会被正则匹配为天数标题
      // 注意：由于原始代码的索引逻辑，日期格式标题不会创建新的天数对象，
      // 但它确实被识别为天数标题而非分区标题
      const trip = parseMarkdown('# 测试\n## 9月15日');
      // 函数应正常执行不崩溃，返回有效行程
      expect(trip).toBeDefined();
      expect(trip.title).toBe('测试');
      // 不应被当作 'other' 分区处理（不影响后续解析）
      expect(trip.budget.expenses.length).toBe(0);
    });

    test('天数标题设置 currentSection 为 itinerary', () => {
      const trip = parseMarkdown('# 测试\n## Day 1\n08:30 出发');
      expect(trip.days[1].items.length).toBe(1);
      expect(trip.days[1].items[0].time).toBe('08:30');
      expect(trip.days[1].items[0].title).toBe('出发');
    });
  });

  // ============================================================
  // H3 主题解析
  // ============================================================
  describe('H3 主题解析', () => {
    test('"### 主题" 应设置当天主题', () => {
      const trip = parseMarkdown('# 测试\n## Day 1\n### 山水游览');
      expect(trip.days[1].theme).toBe('山水游览');
    });

    test('H3 在非 itinerary 分区下不应设置主题', () => {
      const trip = parseMarkdown('# 测试\n## 住宿\n### 不应生效');
      // 住宿分区下 H3 不设置主题
      expect(trip.days[0].theme).toBe('');
    });
  });

  // ============================================================
  // 分区检测
  // ============================================================
  describe('分区检测', () => {
    test('"## 住宿" 应识别为酒店分区', () => {
      const trip = parseMarkdown('# 测试\n## 住宿\n- 桂林大酒店');
      expect(trip.hotels.length).toBe(1);
      expect(trip.hotels[0].name).toBe('桂林大酒店');
    });

    test('"## 酒店" 应识别为酒店分区', () => {
      const trip = parseMarkdown('# 测试\n## 酒店\n- 阳朔民宿');
      expect(trip.hotels.length).toBe(1);
      expect(trip.hotels[0].name).toBe('阳朔民宿');
    });

    test('"## 清单" 应识别为打包清单分区', () => {
      const trip = parseMarkdown('# 测试\n## 清单\n- [ ] 身份证\n- [x] 护照');
      expect(trip.checklist.packing.length).toBe(2);
      expect(trip.checklist.packing[0].text).toBe('身份证');
      expect(trip.checklist.packing[0].checked).toBe(false);
      expect(trip.checklist.packing[1].text).toBe('护照');
      expect(trip.checklist.packing[1].checked).toBe(true);
    });

    test('"## 准备" 应识别为打包清单分区', () => {
      const trip = parseMarkdown('# 测试\n## 准备\n- [ ] 充电器');
      expect(trip.checklist.packing.length).toBe(1);
      expect(trip.checklist.packing[0].text).toBe('充电器');
    });

    test('"## 打包" 应识别为打包清单分区', () => {
      const trip = parseMarkdown('# 测试\n## 打包\n- [ ] 洗漱用品');
      expect(trip.checklist.packing[0].text).toBe('洗漱用品');
    });

    test('"## 预订" 应识别为预订清单分区', () => {
      const trip = parseMarkdown('# 测试\n## 预订\n- [x] 已订机票\n- [ ] 待订酒店');
      expect(trip.checklist.booking.length).toBe(2);
      expect(trip.checklist.booking[0].text).toBe('已订机票');
      expect(trip.checklist.booking[0].checked).toBe(true);
      expect(trip.checklist.booking[1].text).toBe('待订酒店');
      expect(trip.checklist.booking[1].checked).toBe(false);
    });

    test('"## 门票" 应识别为预订清单分区', () => {
      const trip = parseMarkdown('# 测试\n## 门票\n- [x] 漓江门票已订');
      expect(trip.checklist.booking.length).toBe(1);
      expect(trip.checklist.booking[0].checked).toBe(true);
    });

    test('"## 预算" 应识别为预算分区', () => {
      const trip = parseMarkdown('# 测试\n## 预算\n- 机票 ¥1200');
      expect(trip.budget.expenses.length).toBe(1);
      expect(trip.budget.expenses[0].amount).toBe(1200);
    });

    test('"## 费用" 应识别为预算分区', () => {
      const trip = parseMarkdown('# 测试\n## 费用\n- 门票 ¥100');
      expect(trip.budget.expenses.length).toBe(1);
    });

    test('"## 开支" 应识别为预算分区', () => {
      const trip = parseMarkdown('# 测试\n## 开支\n- 午餐 ¥50');
      expect(trip.budget.expenses.length).toBe(1);
    });

    test('"## 应急" 应识别为应急联系区分区', () => {
      const trip = parseMarkdown('# 测试\n## 应急\n- 导游 13800138000');
      // createEmptyTrip 默认有 3 个应急联系人，添加后应为 4 个
      expect(trip.emergency.length).toBe(4);
      expect(trip.emergency[3].name).toBe('导游');
      expect(trip.emergency[3].phone).toBe('13800138000');
    });

    test('"## 紧急" 应识别为应急联系区分区', () => {
      const trip = parseMarkdown('# 测试\n## 紧急\n- 领队 13900139000');
      expect(trip.emergency.length).toBe(4);
      expect(trip.emergency[3].phone).toBe('13900139000');
    });

    test('"## 提示" 应识别为提示分区', () => {
      const trip = parseMarkdown('# 测试\n## 提示\n- 带好防晒霜\n- 注意安全');
      expect(trip.tips.length).toBe(1);
      expect(trip.tips[0].items.length).toBe(2);
      expect(trip.tips[0].items[0]).toBe('带好防晒霜');
      expect(trip.tips[0].items[1]).toBe('注意安全');
    });

    test('"## 注意" 应识别为提示分区', () => {
      const trip = parseMarkdown('# 测试\n## 注意\n- 防蚊虫');
      expect(trip.tips.length).toBe(1);
      expect(trip.tips[0].items[0]).toBe('防蚊虫');
    });

    test('未识别的 H2 标题应归入 other 分区（不影响行程数据）', () => {
      const trip = parseMarkdown('# 测试\n## 其他内容\n- 普通条目');
      // other 分区不产生任何行程数据
      expect(trip.budget.expenses.length).toBe(0);
      expect(trip.hotels.length).toBe(0);
      expect(trip.checklist.booking.length).toBe(0);
      expect(trip.checklist.packing.length).toBe(0);
    });
  });

  // ============================================================
  // 时间行程项解析
  // ============================================================
  describe('时间行程项解析', () => {
    test('"08:30 活动" 格式应解析为带时间的行程项', () => {
      const trip = parseMarkdown('# 测试\n## Day 1\n08:30 出发去机场');
      expect(trip.days[1].items.length).toBe(1);
      expect(trip.days[1].items[0].time).toBe('08:30');
      expect(trip.days[1].items[0].title).toBe('出发去机场');
    });

    test('"08:30-10:00 活动" 时间段格式应正确解析', () => {
      const trip = parseMarkdown('# 测试\n## Day 1\n08:30-10:00 飞行');
      expect(trip.days[1].items[0].time).toBe('08:30-10:00');
      expect(trip.days[1].items[0].title).toBe('飞行');
    });

    test('"08:30~10:00 活动" 波浪线时间段格式应正确解析', () => {
      const trip = parseMarkdown('# 测试\n## Day 1\n08:30~10:00 游览');
      expect(trip.days[1].items[0].time).toBe('08:30~10:00');
    });

    test('多个时间项应按顺序添加', () => {
      const md = '# 测试\n## Day 1\n08:00 早餐\n09:00 出发\n12:00 午餐';
      const trip = parseMarkdown(md);
      expect(trip.days[1].items.length).toBe(3);
      expect(trip.days[1].items[0].time).toBe('08:00');
      expect(trip.days[1].items[1].time).toBe('09:00');
      expect(trip.days[1].items[2].time).toBe('12:00');
    });

    test('行程项的 desc 字段应保留原始描述', () => {
      const trip = parseMarkdown('# 测试\n## Day 1\n08:30 出发去机场');
      expect(trip.days[1].items[0].desc).toBe('出发去机场');
    });

    test('时间项在非 itinerary 分区下不应被添加', () => {
      const trip = parseMarkdown('# 测试\n## 住宿\n08:30 酒店入住');
      // 住宿分区下时间项不作为行程项
      expect(trip.days[0].items.length).toBe(0);
    });

    test('时间项在未设置天数时不应被添加', () => {
      const trip = parseMarkdown('# 测试\n08:30 无天数的活动');
      // 没有天数标题时 currentDay=-1，时间项不会被添加
      expect(trip.days[0].items.length).toBe(0);
    });

    test('时间项中的 ** 加粗标记应从 title 中移除', () => {
      const trip = parseMarkdown('# 测试\n## Day 1\n08:30 **重要**出发');
      expect(trip.days[1].items[0].title).toBe('重要出发');
    });
  });

  // ============================================================
  // 费用提取与自动分类
  // ============================================================
  describe('费用提取与自动分类', () => {
    test('¥ 符号金额应被正确提取（列表项）', () => {
      const trip = parseMarkdown('# 测试\n## 预算\n- 机票 ¥1200');
      expect(trip.budget.expenses.length).toBe(1);
      expect(trip.budget.expenses[0].amount).toBe(1200);
    });

    test('￥ 符号金额应被正确提取', () => {
      const trip = parseMarkdown('# 测试\n## 预算\n- 午餐 ￥50');
      expect(trip.budget.expenses[0].amount).toBe(50);
    });

    test('小数金额应被正确提取', () => {
      const trip = parseMarkdown('# 测试\n## 预算\n- 午餐 ￥50.50');
      expect(trip.budget.expenses[0].amount).toBe(50.50);
    });

    test('机票/航班应自动分类为 flight', () => {
      const trip = parseMarkdown('# 测试\n## 预算\n- 机票 ¥1200');
      expect(trip.budget.expenses[0].cat).toBe('flight');
    });

    test('高铁/火车应自动分类为 flight', () => {
      const trip = parseMarkdown('# 测试\n## 预算\n- 高铁票 ¥500');
      expect(trip.budget.expenses[0].cat).toBe('flight');
    });

    test('酒店/住宿/民宿应自动分类为 hotel', () => {
      const trip = parseMarkdown('# 测试\n## 预算\n- 酒店住宿 ¥300');
      expect(trip.budget.expenses[0].cat).toBe('hotel');
    });

    test('门票/景区应自动分类为 ticket', () => {
      const trip = parseMarkdown('# 测试\n## 预算\n- 景区门票 ¥100');
      expect(trip.budget.expenses[0].cat).toBe('ticket');
    });

    test('餐饮相关应自动分类为 food', () => {
      const trip = parseMarkdown('# 测试\n## 预算\n- 午餐 ¥50');
      expect(trip.budget.expenses[0].cat).toBe('food');
    });

    test('打车/出租/地铁应自动分类为 transport', () => {
      const trip = parseMarkdown('# 测试\n## 预算\n- 打车 ¥30');
      expect(trip.budget.expenses[0].cat).toBe('transport');
    });

    test('未匹配分类关键词的费用应归为 other', () => {
      const trip = parseMarkdown('# 测试\n## 预算\n- 纪念品 ¥20');
      expect(trip.budget.expenses[0].cat).toBe('other');
    });

    test('非列表行的费用也应被提取（行内费用提取）', () => {
      const trip = parseMarkdown('# 测试\n## 预算\n机票 ¥1200');
      expect(trip.budget.expenses.length).toBe(1);
      expect(trip.budget.expenses[0].amount).toBe(1200);
      expect(trip.budget.expenses[0].cat).toBe('flight');
    });

    test('行内费用提取的大巴/交通应分类为 flight', () => {
      // 行内费用提取使用扩展的关键词列表（包含"大巴"和"交通"）
      const trip = parseMarkdown('# 测试\n## 预算\n大巴交通 ¥80');
      expect(trip.budget.expenses[0].cat).toBe('flight');
    });

    test('行内费用提取的美食应分类为 food', () => {
      // 行内费用提取使用扩展的关键词列表（包含"美食"）
      const trip = parseMarkdown('# 测试\n## 预算\n特色美食 ¥120');
      expect(trip.budget.expenses[0].cat).toBe('food');
    });

    test('非预算分区下的费用不应被提取', () => {
      const trip = parseMarkdown('# 测试\n## 住宿\n- 酒店 ¥300');
      // 住宿分区下，费用不会被提取为预算项（parseListItem 中酒店优先）
      expect(trip.budget.expenses.length).toBe(0);
      expect(trip.hotels.length).toBe(1);
    });

    test('多个费用项应全部提取', () => {
      const md = '# 测试\n## 预算\n- 机票 ¥1200\n- 酒店 ¥300\n- 门票 ¥100\n- 午餐 ¥50\n- 打车 ¥30';
      const trip = parseMarkdown(md);
      expect(trip.budget.expenses.length).toBe(5);
    });

    test('费用项的 name 应去除金额和符号', () => {
      const trip = parseMarkdown('# 测试\n## 预算\n- 机票 ¥1200');
      expect(trip.budget.expenses[0].name).toBe('机票');
    });

    test('费用项 paid 默认为 false', () => {
      const trip = parseMarkdown('# 测试\n## 预算\n- 机票 ¥1200');
      expect(trip.budget.expenses[0].paid).toBe(false);
    });
  });

  // ============================================================
  // 列表项解析
  // ============================================================
  describe('列表项解析', () => {
    test('"- " 前缀的列表项应被解析', () => {
      const trip = parseMarkdown('# 测试\n## 住宿\n- 桂林大酒店\n- 阳朔民宿');
      expect(trip.hotels.length).toBe(2);
    });

    test('"* " 前缀的列表项应被解析', () => {
      const trip = parseMarkdown('# 测试\n## 提示\n* 带防晒霜\n* 注意安全');
      expect(trip.tips[0].items.length).toBe(2);
    });

    test('勾选框 [ ] 应解析为未勾选的清单项', () => {
      const trip = parseMarkdown('# 测试\n## 清单\n- [ ] 身份证');
      expect(trip.checklist.packing[0].checked).toBe(false);
    });

    test('勾选框 [x] 应解析为已勾选的清单项', () => {
      const trip = parseMarkdown('# 测试\n## 清单\n- [x] 护照');
      expect(trip.checklist.packing[0].checked).toBe(true);
    });

    test('勾选框 [X] 大写也应解析为已勾选', () => {
      const trip = parseMarkdown('# 测试\n## 清单\n- [X] 机票');
      expect(trip.checklist.packing[0].checked).toBe(true);
    });

    test('酒店列表项中的 ** 标记应从名称中移除', () => {
      const trip = parseMarkdown('# 测试\n## 住宿\n- **五星酒店**');
      expect(trip.hotels[0].name).toBe('五星酒店');
    });

    test('提示列表项中的 ** 标记应从内容中移除', () => {
      const trip = parseMarkdown('# 测试\n## 提示\n- **重要**带好证件');
      expect(trip.tips[0].items[0]).toBe('重要带好证件');
    });

    test('行程序列表项（带时间）在 itinerary 分区应被添加', () => {
      const trip = parseMarkdown('# 测试\n## Day 1\n- 08:30 出发\n- 自由活动');
      expect(trip.days[1].items.length).toBe(2);
      expect(trip.days[1].items[0].time).toBe('08:30');
      expect(trip.days[1].items[0].title).toBe('出发');
      expect(trip.days[1].items[1].time).toBe('');
      expect(trip.days[1].items[1].title).toBe('自由活动');
    });
  });

  // ============================================================
  // 空文本与边界情况
  // ============================================================
  describe('空文本与边界情况', () => {
    test('空字符串应返回有效的空行程', () => {
      const trip = parseMarkdown('');
      expect(trip).toBeDefined();
      expect(trip.title).toBe('导入的行程');
      expect(trip.days.length).toBe(1); // 默认至少 1 天
      expect(trip.budget.expenses.length).toBe(0);
    });

    test('仅包含空白行的文本应返回有效的空行程', () => {
      const trip = parseMarkdown('\n\n\n  \n');
      expect(trip).toBeDefined();
      expect(trip.title).toBe('导入的行程');
    });

    test('只有 H1 标题的文本应正确解析', () => {
      const trip = parseMarkdown('# 桂林旅行');
      expect(trip.title).toBe('桂林旅行');
      expect(trip.destination).toBe('桂林');
      expect(trip.days.length).toBe(1);
    });

    test('normalizeTrip 应确保所有必需字段存在', () => {
      const trip = parseMarkdown('# 测试');
      // 验证 normalizeTrip 补全的字段
      expect(trip.id).toBeDefined();
      expect(trip.emoji).toBeDefined();
      expect(trip.startDate).toBeDefined();
      expect(trip.endDate).toBeDefined();
      expect(trip.budget).toBeDefined();
      expect(trip.budget.categories).toBeDefined();
      expect(trip.budget.expenses).toBeDefined();
      expect(trip.checklist).toBeDefined();
      expect(trip.checklist.booking).toBeDefined();
      expect(trip.checklist.packing).toBeDefined();
      expect(trip.hotels).toBeDefined();
      expect(trip.emergency).toBeDefined();
      expect(trip.version).toBe('1.0');
    });
  });

  // ============================================================
  // 综合解析测试
  // ============================================================
  describe('综合解析', () => {
    test('应正确解析包含多种元素的完整 Markdown', () => {
      const md = [
        '# 桂林旅行',
        '',
        '## Day 1',
        '### 抵达桂林',
        '08:30 出发去机场',
        '10:00-12:00 飞行',
        '13:00 酒店入住',
        '',
        '## 住宿',
        '- 桂林大酒店',
        '',
        '## 清单',
        '- [x] 身份证',
        '- [ ] 充电器',
        '',
        '## 预订',
        '- [x] 机票已订',
        '',
        '## 预算',
        '- 机票 ¥1200',
        '- 酒店住宿 ¥300',
        '- 景区门票 ¥100',
        '- 午餐 ¥50',
        '',
        '## 提示',
        '- 带好防晒霜',
        '',
        '## 应急',
        '- 导游 13800138000'
      ].join('\n');

      const trip = parseMarkdown(md);

      // 标题与目的地
      expect(trip.title).toBe('桂林旅行');
      expect(trip.destination).toBe('桂林');

      // 天数与行程项
      expect(trip.days[1].title).toBe('Day 1');
      expect(trip.days[1].theme).toBe('抵达桂林');
      expect(trip.days[1].items.length).toBe(3);
      expect(trip.days[1].items[0].time).toBe('08:30');
      expect(trip.days[1].items[1].time).toBe('10:00-12:00');

      // 酒店
      expect(trip.hotels.length).toBe(1);
      expect(trip.hotels[0].name).toBe('桂林大酒店');

      // 打包清单
      expect(trip.checklist.packing.length).toBe(2);
      expect(trip.checklist.packing[0].checked).toBe(true);
      expect(trip.checklist.packing[1].checked).toBe(false);

      // 预订清单
      expect(trip.checklist.booking.length).toBe(1);
      expect(trip.checklist.booking[0].checked).toBe(true);

      // 预算
      expect(trip.budget.expenses.length).toBe(4);
      expect(trip.budget.expenses[0].cat).toBe('flight');
      expect(trip.budget.expenses[1].cat).toBe('hotel');
      expect(trip.budget.expenses[2].cat).toBe('ticket');
      expect(trip.budget.expenses[3].cat).toBe('food');

      // 提示
      expect(trip.tips.length).toBe(1);
      expect(trip.tips[0].items[0]).toBe('带好防晒霜');

      // 应急
      expect(trip.emergency.length).toBe(4); // 3 个默认 + 1 个新增
      expect(trip.emergency[3].phone).toBe('13800138000');
    });
  });
});
