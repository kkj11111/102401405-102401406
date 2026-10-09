/**
 * core.js —— 校园失物招领 · 数据层核心纯函数
 * 不依赖 DOM 与 localStorage，可在浏览器（window.CLFCore）与 Node（module.exports）双端运行，
 * 供 app.js 渲染使用，也供 test/*.test.js 做单元测试。
 */
(function (global) {
  'use strict';

  var CATEGORIES = ['证件卡类', '电子设备', '钥匙饰品', '生活用品', '其他'];
  var TYPE_LOST = 'lost';      // 寻物
  var TYPE_FOUND = 'found';    // 招领
  var STATUS_OPEN = 'open';    // 进行中
  var STATUS_DONE = 'done';    // 已找到 / 已归还
  var STATUS_DRAFT = 'draft';  // 草稿（仅自己可见）

  /** 生成唯一 id：时间戳36进制 + 随机后缀 */
  function genId(now) {
    var t = (now || Date.now()).toString(36);
    return 'it' + t + Math.random().toString(36).slice(2, 7);
  }

  /**
   * 根据表单字段创建一条信息
   * @param {Object} fields {type, category, title, desc, location, place, happenedAt, contact, contactName, image, status}
   * @param {number} [now] 时间戳，测试时注入
   */
  function createItem(fields, now) {
    var ts = now || Date.now();
    return {
      id: genId(ts),
      type: fields.type,
      category: fields.category || '其他',
      title: String(fields.title || '').trim(),
      desc: String(fields.desc || '').trim(),
      location: String(fields.location || '').trim(),
      place: String(fields.place || '').trim(),
      happenedAt: fields.happenedAt || '',
      contact: String(fields.contact || '').trim(),
      contactName: String(fields.contactName || '').trim() || '匿名同学',
      image: String(fields.image || ''),
      status: fields.status || STATUS_OPEN,
      mine: fields.mine === true,
      createdAt: ts,
      updatedAt: ts
    };
  }

  /**
   * 校验发布表单
   * @returns {{ok:boolean, errors:Object}}
   */
  function validatePublish(fields) {
    var f = fields || {};
    var errors = {};
    if (!f.type || (f.type !== TYPE_LOST && f.type !== TYPE_FOUND)) {
      errors.type = '请选择“寻物”或“招领”类型';
    }
    if (!f.title || !String(f.title).trim()) {
      errors.title = '请输入物品名称';
    } else if (String(f.title).trim().length > 30) {
      errors.title = '物品名称不能超过30个字';
    }
    if (!f.location || !String(f.location).trim()) {
      errors.location = '请输入丢失/拾取地点';
    } else if (String(f.location).trim().length > 20) {
      errors.location = '地点不能超过20个字';
    }
    if (!f.contact || !String(f.contact).trim()) {
      errors.contact = '请留下联系方式，方便对方联系你';
    } else if (!/^[A-Za-z0-9@._+\-]{3,20}$/.test(String(f.contact).trim())) {
      errors.contact = '联系方式格式不正确（手机号、QQ、邮箱、微信号均可）';
    }
    if (f.contactName && String(f.contactName).trim().length > 12) {
      errors.contactName = '昵称不能超过12个字';
    }
    if (f.desc && String(f.desc).trim().length > 200) {
      errors.desc = '描述不能超过200字';
    }
    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  /**
   * 过滤信息：关键词（物品名/地点/描述/昵称）+ 类型 + 类别 + 状态
   * 默认排除草稿（草稿仅在"我的发布"显示）；传 includeDraft=true 可包含草稿
   * @param {Array} items
   * @param {Object} opts {keyword, type, category, status, includeDraft}，'all' 或空表示不过滤
   */
  function filterItems(items, opts) {
    var o = opts || {};
    var keyword = String(o.keyword || '').trim().toLowerCase();
    var type = o.type || 'all';
    var category = o.category || 'all';
    var status = o.status || 'all';
    var list = (items || []).filter(function (it) {
      if (!o.includeDraft && it.status === STATUS_DRAFT) return false;
      if (type !== 'all' && it.type !== type) return false;
      if (category !== 'all' && it.category !== category) return false;
      if (status !== 'all' && it.status !== status) return false;
      return true;
    });
    if (keyword) {
      list = list.filter(function (it) {
        var hay = [it.title, it.location, it.place, it.contactName, it.desc]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.indexOf(keyword) !== -1;
      });
    }
    return list;
  }

  /** 更新状态，返回新对象（不改原对象）；非法输入返回 null */
  function updateStatus(item, status) {
    if (!item || (status !== STATUS_OPEN && status !== STATUS_DONE && status !== STATUS_DRAFT)) return null;
    if (item.status === status) return item;
    return {
      id: item.id, type: item.type, category: item.category,
      title: item.title, desc: item.desc, location: item.location, place: item.place,
      happenedAt: item.happenedAt, contact: item.contact, contactName: item.contactName,
      image: item.image || '',
      status: status, createdAt: item.createdAt, updatedAt: Date.now()
    };
  }

  /** 删除信息，返回新数组（不修改原数组） */
  function removeItem(items, id) {
    return (items || []).filter(function (it) { return it.id !== id; });
  }

  /** 按 id 查信息 */
  function getItemById(items, id) {
    return (items || []).find(function (it) { return it.id === id; }) || null;
  }

  /** 友好时间：今天 14:30 / 昨天 09:10 / 3天前 / 9月1日 */
  function formatTime(ts, now) {
    if (!ts) return '';
    var base = now || Date.now();
    var d = new Date(ts);
    var nowD = new Date(base);
    var day0 = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate()).getTime();
    var tDay0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    var diffDays = Math.round((day0 - tDay0) / 86400000);
    var hh = d.getHours(), mm = d.getMinutes();
    var hm = (hh < 10 ? '0' + hh : hh) + ':' + (mm < 10 ? '0' + mm : mm);
    if (diffDays <= 0) return '今天 ' + hm;
    if (diffDays === 1) return '昨天 ' + hm;
    if (diffDays < 7) return diffDays + '天前';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  /** 首页统计：今日新增 / 累计找回(归还) / 归还成功率（不计草稿） */
  function calcStats(items, now) {
    var base = now || Date.now();
    var nowD = new Date(base);
    var todayStart = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate()).getTime();
    var list = (items || []).filter(function (it) { return it.status !== STATUS_DRAFT; });
    var today = list.filter(function (it) { return it.createdAt >= todayStart; }).length;
    var done = list.filter(function (it) { return it.status === STATUS_DONE; }).length;
    var rate = list.length ? Math.round(done / list.length * 100) : 0;
    return { today: today, done: done, total: list.length, rate: rate };
  }

  /** 按创建时间倒序排序（返回新数组） */
  function sortByTime(items) {
    return (items || []).slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
  }

  /** 类型标签：寻物 / 招领 */
  function typeLabel(type) { return type === TYPE_LOST ? '寻物' : '招领'; }

  /** 状态标签：已找到 / 已归还 / 草稿 / 空 */
  function statusLabel(status, type) {
    if (status === STATUS_DONE) return type === TYPE_LOST ? '已找到' : '已归还';
    if (status === STATUS_DRAFT) return '草稿';
    return '';
  }

  /** 对外 API */
  var api = {
    CATEGORIES: CATEGORIES,
    TYPE_LOST: TYPE_LOST, TYPE_FOUND: TYPE_FOUND,
    STATUS_OPEN: STATUS_OPEN, STATUS_DONE: STATUS_DONE, STATUS_DRAFT: STATUS_DRAFT,
    genId: genId,
    createItem: createItem,
    validatePublish: validatePublish,
    filterItems: filterItems,
    updateStatus: updateStatus,
    removeItem: removeItem,
    getItemById: getItemById,
    formatTime: formatTime,
    calcStats: calcStats,
    sortByTime: sortByTime,
    typeLabel: typeLabel,
    statusLabel: statusLabel
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.CLFCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
