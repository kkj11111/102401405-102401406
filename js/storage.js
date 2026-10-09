/**
 * storage.js —— 校园失物招领 · 数据持久化（localStorage）
 * 浏览器端直接使用 window.localStorage；Node 测试时可注入 global.localStorage 的内存实现。
 * 对外暴露 CLFStorage（浏览器） / module.exports（Node）。
 */
(function (global) {
  'use strict';

  var CORE = (typeof require !== 'undefined' && typeof module !== 'undefined' && module.exports)
    ? require('./core.js')
    : global.CLFCore;

  var ITEMS_KEY = 'clf_items_v4';
  var HISTORY_KEY = 'clf_search_history_v1';
  var SEED = null;

  /** 获取存储对象：优先浏览器 localStorage，测试时可用注入的全局 localStorage */
  function store() {
    return global.localStorage || {};
  }

  /** 读取全部信息；无数据时返回 null（供 loadItems 判断是否播种） */
  function rawLoad() {
    try {
      var s = store().getItem(ITEMS_KEY);
      if (!s) return null;
      var arr = JSON.parse(s);
      return Array.isArray(arr) ? arr : null;
    } catch (e) {
      return null;
    }
  }

  /** 读取全部信息：无数据则自动初始化种子数据 */
  function loadItems() {
    var arr = rawLoad();
    if (arr === null) {
      arr = seedData();
      saveItems(arr);
    }
    return arr;
  }

  /** 保存全部信息 */
  function saveItems(items) {
    try { store().setItem(ITEMS_KEY, JSON.stringify(items)); return true; }
    catch (e) { return false; }
  }

  /** 生成种子数据（时间为相对当前时刻，保证首页有近期信息） */
  function seedData(now) {
    var base = now || Date.now();
    var H = 3600 * 1000, D = 24 * H;
    var mk = function (fields, age) {
      return CORE.createItem(fields, base - age);
    };
    var list = [
      mk({ type: 'found', category: '证件卡类', title: '校园卡（张同学）', location: '教学楼 3 号楼 301 教室', place: '讲台抽屉', desc: '蓝色卡套，正面有姓名与学号贴纸。', contact: '13850001234', contactName: '王梓萱', mine: true }, 3 * H),
      mk({ type: 'lost', category: '电子设备', title: '白色 AirPods Pro 充电盒', location: '体育馆·风雨操场', place: '篮球场观众席', desc: '充电盒背面有轻微划痕，壳内贴了”FZU”贴纸。', contact: '15960009876', contactName: '陈雨桐' }, 22 * H),
      mk({ type: 'found', category: '电子设备', title: '银色 65W 笔记本充电器', location: '东 3-401 教室', place: '后排插座旁', desc: '联想原装，线长约 1.8 米。', contact: 'qq: 88450123', contactName: '李昊宇' }, 2 * D),
      mk({ type: 'lost', category: '钥匙饰品', title: '钥匙串（带蓝色门禁卡）', location: '图书馆二楼自习区', place: '靠窗第三排', desc: '三把钥匙加一个蓝色门禁卡挂件。', contact: '13770006543', contactName: '王梓萱', mine: true }, 5 * H),
      mk({ type: 'found', category: '生活用品', title: '黑色折叠雨伞', location: '食堂一楼', place: '门口雨伞架', desc: '黑色自动折叠伞，伞柄有挂绳。', contact: '18860007788', contactName: '郑凯' }, D + 4 * H),
      mk({ type: 'lost', category: '证件卡类', title: '学生证（2024级）', location: '运动场', place: '看台', desc: '红色封皮学生证，内有校园卡。', contact: '13650005566', contactName: '赵一鸣' }, 4 * D),
      mk({ type: 'found', category: '生活用品', title: '蓝色保温水杯', location: '宿舍 3 号楼', place: '一楼洗衣房', desc: '500ml 保温杯，杯盖有贴纸。', contact: '15060001122', contactName: '王梓萱', mine: true }, 6 * H),
      mk({ type: 'lost', category: '电子设备', title: '有线耳机（白色）', location: '综合楼 B 区', place: '302 机房', desc: '普通白色有线耳机。', contact: 'qq: 1023456789', contactName: '吴思远' }, 8 * D)
    ];
    // 其中 2 条标记为已找到/已归还，演示状态闭环
    list[5] = CORE.updateStatus(list[5], 'done');
    list[6] = CORE.updateStatus(list[6], 'done');
    return list;
  }

  /** 重置为种子数据（调试/演示用） */
  function resetData() {
    var arr = seedData();
    saveItems(arr);
    return arr;
  }

  /** 搜索历史 */
  function loadHistory() {
    try {
      var s = store().getItem(HISTORY_KEY);
      var arr = s ? JSON.parse(s) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function saveHistory(list) {
    try { store().setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 8))); return true; }
    catch (e) { return false; }
  }

  function addHistory(keyword) {
    var kw = String(keyword || '').trim();
    if (!kw) return loadHistory();
    var list = loadHistory().filter(function (k) { return k.toLowerCase() !== kw.toLowerCase(); });
    list.unshift(kw);
    saveHistory(list);
    return list;
  }

  function removeHistory(keyword) {
    var list = loadHistory().filter(function (k) { return k !== keyword; });
    saveHistory(list);
    return list;
  }

  function clearHistory() {
    saveHistory([]);
    return [];
  }

  var api = {
    ITEMS_KEY: ITEMS_KEY, HISTORY_KEY: HISTORY_KEY,
    loadItems: loadItems,
    rawLoad: rawLoad,
    saveItems: saveItems,
    seedData: seedData,
    resetData: resetData,
    loadHistory: loadHistory,
    saveHistory: saveHistory,
    addHistory: addHistory,
    removeHistory: removeHistory,
    clearHistory: clearHistory
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.CLFStorage = api;
})(typeof window !== 'undefined' ? window : globalThis);
