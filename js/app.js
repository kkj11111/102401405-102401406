/**
 * app.js —— 校园失物招领 · 视图渲染与交互（浏览器端）
 * 依赖：js/core.js（CLFCore）、js/storage.js（CLFStorage）
 * 路由：#/ 首页  #/search 搜索  #/publish 发布  #/detail/:id 详情  #/mine 我的发布  #/done/:id 发布成功
 */
(function () {
  'use strict';

  var C = window.CLFCore;
  var S = window.CLFStorage;
  var view = document.getElementById('view');
  var headerTitle = document.getElementById('header-title');
  var headerSub = document.getElementById('header-sub');

  /* ---------------- 工具 ---------------- */

  /** HTML 转义，防止 XSS */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** 类型/状态徽标 */
  function typeBadge(item) {
    var t = item.type === C.TYPE_LOST ? 'badge-lost' : 'badge-found';
    return '<span class="badge ' + t + '">' + C.typeLabel(item.type) + '</span>';
  }

  function statusBadge(item) {
    var label = C.statusLabel(item.status, item.type);
    if (!label) return '';
    return '<span class="badge badge-done">' + label + '</span>';
  }

  function catBadge(item) {
    return '<span class="badge badge-cat">' + esc(item.category) + '</span>';
  }

  function itemCardHtml(it) {
    return '<div class="item-card type-' + it.type + '" data-action="detail" data-id="' + it.id + '">' +
      '<div class="item-head">' +
        '<div class="item-name">' + esc(it.title) + '</div>' +
        typeBadge(it) + statusBadge(it) +
      '</div>' +
      '<div class="item-loc">📍 ' + esc(it.location) + (it.place ? ' · ' + esc(it.place) : '') + '</div>' +
      '<div class="item-time">🕒 ' + C.formatTime(it.createdAt) + ' · ' + esc(it.contactName) + '</div>' +
      (it.desc ? '<div class="item-desc">' + esc(it.desc) + '</div>' : '') +
      '<div class="item-foot"><span class="publisher">' + esc(it.contactName) + ' 发布</span>' +
      '<span class="badge badge-cat">' + esc(it.category) + '</span></div>' +
    '</div>';
  }

  function emptyHtml(icon, title, tip, actionHtml) {
    return '<div class="empty"><div class="icon">' + icon + '</div>' +
      '<h3>' + title + '</h3><p>' + tip + '</p>' + (actionHtml || '') + '</div>';
  }

  function chipHtml(label, value, active, attr) {
    return '<span class="chip' + (active ? ' active' : '') + '" data-action="' + attr + '" data-value="' + value + '">' + label + '</span>';
  }

  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /** 一键复制联系方式 */
  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('联系方式已复制：' + text);
      }, function () {
        toast(fallback() ? '联系方式已复制：' + text : '复制失败，请长按手动复制');
      });
    } else {
      toast(fallback() ? '联系方式已复制：' + text : '复制失败，请长按手动复制');
    }
  }

  /* ---------------- 视图模板 ---------------- */

  /** 首页 */
  function renderHome() {
    var items = C.sortByTime(S.loadItems());
    var state = HomeState;
    var stats = C.calcStats(items);
    var list = C.filterItems(items, state);

    var html = '<div class="stats">' +
      '<div class="stat"><b>' + stats.today + '</b><span>今日新增</span></div>' +
      '<div class="stat"><b>' + stats.done + '</b><span>累计找回/归还</span></div>' +
      '<div class="stat"><b>' + stats.rate + '%</b><span>归还成功率</span></div>' +
    '</div>';

    html += '<div class="chips">' +
      chipHtml('全部', 'all', state.category === 'all', 'set-cat') +
      C.CATEGORIES.map(function (c) { return chipHtml(c, c, state.category === c, 'set-cat'); }).join('') +
    '</div>';
    html += '<div class="chips-row">' +
      chipHtml('全部', 'all', state.type === 'all', 'set-type') +
      chipHtml('寻物', C.TYPE_LOST, state.type === C.TYPE_LOST, 'set-type') +
      chipHtml('招领', C.TYPE_FOUND, state.type === C.TYPE_FOUND, 'set-type') +
    '</div>';

    if (list.length === 0) {
      html += '<div class="item-list">' + emptyHtml('🔍', '暂无相关信息', '换个分类看看，或发布一条寻物/招领信息。',
        '<button class="btn btn-primary" data-action="go-publish">去发布信息</button>') + '</div>';
    } else {
      html += '<div class="item-list">' + list.map(itemCardHtml).join('') + '</div>';
    }
    view.innerHTML = html;
    setHeader('校园失物招领', '福州大学 · 旗山校区');
  }

  /** 搜索页 */
  function renderSearch() {
    var kw = SearchState.keyword;
    var type = SearchState.type;

    var html = '<div class="search-area">' +
      '<div class="search-box">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>' +
        '<input id="search-input" type="text" placeholder="搜索物品名称、地点或关键字" value="' + esc(kw) + '" autocomplete="off"/>' +
        (kw ? '<button class="clear" data-action="clear-search" aria-label="清空">✕</button>' : '') +
      '</div>' +
      '<div class="chips-row">' +
        chipHtml('全部', 'all', type === 'all', 'set-s-type') +
        chipHtml('寻物', C.TYPE_LOST, type === C.TYPE_LOST, 'set-s-type') +
        chipHtml('招领', C.TYPE_FOUND, type === C.TYPE_FOUND, 'set-s-type') +
      '</div></div>' +
      '<div id="search-results"></div>' +
      '<div id="search-suggest"></div>';

    view.innerHTML = html;
    setHeader('搜索', '输入关键词查找物品');
    updateSearchView();

    var input = document.getElementById('search-input');
    if (input) {
      input.focus();
      input.addEventListener('input', function () {
        SearchState.keyword = input.value.trim();
        updateSearchView();
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && SearchState.keyword) S.addHistory(SearchState.keyword);
      });
    }
  }

  /** 更新搜索结果区与建议区（不重建整页，保持输入框焦点） */
  function updateSearchView() {
    var kw = SearchState.keyword;
    var type = SearchState.type;
    var resultsEl = document.getElementById('search-results');
    var suggestEl = document.getElementById('search-suggest');
    if (!resultsEl || !suggestEl) return;

    if (kw) {
      suggestEl.innerHTML = '';
      var list = C.filterItems(S.loadItems(), { keyword: kw, type: type });
      var html = '<div class="muted" style="padding:6px 14px 0">共找到 <b>' + list.length + '</b> 条相关结果</div>';
      if (list.length === 0) {
        html += '<div class="item-list">' + emptyHtml('🙈', '没有找到相关物品',
          '换个关键词试试，或者直接发布一条寻物信息，让更多人看到。',
          '<button class="btn btn-primary" data-action="go-publish">去发布信息</button>') + '</div>';
      } else {
        html += '<div class="item-list">' + list.map(itemCardHtml).join('') + '</div>';
      }
      resultsEl.innerHTML = html;
    } else {
      resultsEl.innerHTML = '';
      var history = S.loadHistory();
      var s = '<div class="search-area"><div class="search-block"><h3>🔥 热门搜索</h3><div class="search-tags">' +
        ['校园卡', '雨伞', '耳机', '钥匙', '充电器', '水杯'].map(function (k) {
          return '<span class="hot-tag" data-action="hot-search" data-value="' + k + '">' + k + '</span>';
        }).join('') + '</div></div>';
      if (history.length) {
        s += '<div class="search-block"><h3>🕘 搜索历史 <span class="muted" style="float:right;cursor:pointer" data-action="clear-history">清空</span></h3>' +
          history.map(function (k) {
            return '<div class="history-item" data-action="hot-search" data-value="' + esc(k) + '">' +
              esc(k) + '<button class="del" data-action="del-history" data-value="' + esc(k) + '">✕</button></div>';
          }).join('') + '</div>';
      }
      s += '<div class="tip-box">💡 小技巧：按物品名称搜索最有效，如「校园卡」「雨伞」；也可以按地点关键词搜索。</div></div>';
      suggestEl.innerHTML = s;
    }
  }

  /** 发布页 */
  function renderPublish() {
    var html = '<div class="form">' +
      '<div class="seg">' +
        '<button type="button" class="lost' + (PublishState.type === C.TYPE_LOST ? ' active' : '') + '" data-action="set-p-type" data-value="lost">🔶 寻物（我丢了东西）</button>' +
        '<button type="button" class="found' + (PublishState.type === C.TYPE_FOUND ? ' active' : '') + '" data-action="set-p-type" data-value="found">🟢 招领（我捡到东西）</button>' +
      '</div>' +
      '<div class="form-group"><label>物品名称 <span class="req">*</span></label>' +
        '<input id="f-title" type="text" maxlength="30" placeholder="如：白色 AirPods Pro 充电盒"/>' +
        '<div class="form-error" data-for="title"></div></div>' +
      '<div class="form-group"><label>物品类别</label>' +
        '<select id="f-category">' + C.CATEGORIES.map(function (c) {
          return '<option' + (PublishState.category === c ? ' selected' : '') + '>' + c + '</option>';
        }).join('') + '</select></div>' +
      '<div class="form-group"><label>' + (PublishState.type === C.TYPE_LOST ? '丢失地点' : '拾取地点') + ' <span class="req">*</span></label>' +
        '<input id="f-location" type="text" maxlength="20" placeholder="如：教学楼 3 号楼 / 食堂一楼"/>' +
        '<div class="form-error" data-for="location"></div></div>' +
      '<div class="form-group"><label>详细位置（可选）</label>' +
        '<input id="f-place" type="text" maxlength="30" placeholder="如：301 教室讲台抽屉"/>' +
        '<div class="form-error" data-for="place"></div></div>' +
      '<div class="form-group"><label>发生时间（可选）</label>' +
        '<input id="f-time" type="datetime-local"/>' +
        '<div class="form-error" data-for="time"></div></div>' +
      '<div class="form-group"><label>物品描述（可选）</label>' +
        '<textarea id="f-desc" maxlength="200" placeholder="描述物品特征，方便失主/拾到者辨认"></textarea>' +
        '<div class="form-error" data-for="desc"></div></div>' +
      '<div class="form-group"><label>联系方式 <span class="req">*</span></label>' +
        '<input id="f-contact" type="text" maxlength="20" placeholder="手机号 / QQ / 微信号，方便对方联系你"/>' +
        '<div class="form-error" data-for="contact"></div></div>' +
      '<div class="form-group"><label>昵称（可选）</label>' +
        '<input id="f-name" type="text" maxlength="12" placeholder="默认显示：匿名同学"/>' +
        '<div class="form-error" data-for="name"></div></div>' +
      '<button class="btn btn-primary" data-action="submit-publish">立即发布</button>' +
      '<p class="muted" style="text-align:center;font-size:12px">发布成功后可在「我的发布」中修改状态或删除</p>' +
    '</div>';
    view.innerHTML = html;
    setHeader('发布信息', PublishState.type === C.TYPE_LOST ? '我正在寻找物品' : '我捡到了物品');
  }

  /** 详情页 */
  function renderDetail(id) {
    var items = S.loadItems();
    var it = C.getItemById(items, id);
    if (!it) {
      view.innerHTML = '<div class="section">' + emptyHtml('😵', '信息不存在或已被删除', '该条失物招领信息可能已删除。',
        '<button class="btn btn-primary" data-action="go-home">返回首页</button>') + '</div>';
      setHeader('未找到', '');
      return;
    }
    var done = it.status === C.STATUS_DONE;
    var statusText = C.statusLabel(it.status, it.type);

    var html = '<div class="detail">' +
      '<div class="detail-hero type-' + it.type + '">' +
        '<div class="icon">' + (it.type === C.TYPE_LOST ? '🔶' : '🟢') + '</div>' +
        '<h2>' + esc(it.title) + '</h2>' +
        '<div class="meta">' + typeBadge(it) + ' ' + catBadge(it) + ' ' + statusBadge(it) + '</div>' +
        '<div class="meta">发布于 ' + C.formatTime(it.createdAt) + ' · ' + esc(it.contactName) + '</div>' +
      '</div>' +
      '<div class="detail-block"><h3>📋 物品信息</h3>' +
        '<div class="detail-row"><span class="k">类　别</span><span class="v">' + esc(it.category) + '</span></div>' +
        '<div class="detail-row"><span class="k">' + (it.type === C.TYPE_LOST ? '丢失地点' : '拾取地点') + '</span><span class="v">' + esc(it.location) + (it.place ? ' · ' + esc(it.place) : '') + '</span></div>' +
        (it.happenedAt ? '<div class="detail-row"><span class="k">发生时间</span><span class="v">' + esc(it.happenedAt) + '</span></div>' : '') +
        (it.desc ? '<div class="detail-row"><span class="k">物品描述</span><span class="v">' + esc(it.desc) + '</span></div>' : '') +
      '</div>' +
      '<div class="detail-block"><h3>👤 发布者</h3>' +
        '<div class="detail-row"><span class="k">昵　称</span><span class="v">' + esc(it.contactName) + '</span></div>' +
        '<div class="detail-row"><span class="k">联系方式</span><span class="v">' + esc(it.contact) + '</span></div>' +
        '<button class="btn btn-primary contact-btn" data-action="copy-contact" data-value="' + esc(it.contact) + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>' +
          '一键复制联系方式</button>' +
      '</div>';

    if (!done) {
      html += '<div class="detail-block"><h3>✅ 信息状态</h3>' +
        '<p class="muted" style="margin-bottom:10px">如果这条信息已' + (it.type === C.TYPE_LOST ? '找到' : '归还') + '，发布者可以更新状态，避免他人重复询问。</p>' +
        '<button class="btn btn-green" data-action="mark-done" data-id="' + it.id + '">' +
          '标记为“' + (it.type === C.TYPE_LOST ? '已找到' : '已归还') + '”</button>' +
      '</div>';
    } else {
      html += '<div class="detail-block" style="background:var(--done-light)"><h3>✅ 已结案</h3>' +
        '<p class="muted">这条信息已标记为“' + statusText + '”，请在「我的发布」中管理。</p>' +
      '</div>';
    }
    html += '</div>';
    view.innerHTML = html;
    setHeader('物品详情', it.type === C.TYPE_LOST ? '寻物信息' : '招领信息', true, 'back');
  }

  /** 发布成功页 */
  function renderDone(id) {
    var it = C.getItemById(S.loadItems(), id);
    var html = '<div class="success-wrap">' +
      '<div class="success-icon">' +
        '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#16a34a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>' +
      '</div>' +
      '<h2>发布成功</h2>' +
      '<p>' + (it ? '《' + esc(it.title) + '》已发布到首页，其他同学可以看到并联系你。' : '你的信息已发布到首页。') + '</p>' +
      '<div class="success-actions">' +
        '<button class="btn btn-primary" data-action="go-mine">查看我的发布</button>' +
        '<button class="btn btn-ghost" data-action="go-home">返回首页</button>' +
      '</div>' +
    '</div>';
    view.innerHTML = html;
    setHeader('发布成功', '');
  }

  /** 我的发布页 */
  function renderMine() {
    var items = S.loadItems();
    var mine = C.sortByTime(items); // 本地数据即"我发布的"
    var state = MineState;
    var list = C.filterItems(mine, state);

    var html = '<div class="section"><p class="muted">这里集中管理你发布的信息，可修改状态或删除。</p></div>' +
      '<div class="chips-row">' +
        chipHtml('全部', 'all', state.type === 'all', 'set-m-type') +
        chipHtml('寻物', C.TYPE_LOST, state.type === C.TYPE_LOST, 'set-m-type') +
        chipHtml('招领', C.TYPE_FOUND, state.type === C.TYPE_FOUND, 'set-m-type') +
        chipHtml('已结案', 'done', state.status === 'done', 'set-m-status') +
      '</div>';

    if (list.length === 0) {
      html += '<div class="item-list">' + emptyHtml('📭', '还没有发布过信息',
        '去发布第一条寻物或招领信息吧。',
        '<button class="btn btn-primary" data-action="go-publish">去发布信息</button>') + '</div>';
    } else {
      html += '<div class="item-list">' + list.map(function (it) {
        var done = it.status === C.STATUS_DONE;
        return '<div class="item-card type-' + it.type + '" data-action="detail" data-id="' + it.id + '">' +
          '<div class="item-head"><div class="item-name">' + esc(it.title) + '</div>' + typeBadge(it) + statusBadge(it) + '</div>' +
          '<div class="item-loc">📍 ' + esc(it.location) + '</div>' +
          '<div class="item-time">🕒 ' + C.formatTime(it.createdAt) + '</div>' +
          '<div class="mine-actions">' +
            (done
              ? '<button class="btn btn-sm btn-ghost" data-action="reopen" data-id="' + it.id + '">重新开放</button>'
              : '<button class="btn btn-sm ' + (it.type === C.TYPE_LOST ? 'btn-green' : 'btn-green') + '" data-action="mark-done" data-id="' + it.id + '">' +
                (it.type === C.TYPE_LOST ? '标记已找到' : '标记已归还') + '</button>') +
            '<button class="btn btn-sm btn-danger" data-action="ask-delete" data-id="' + it.id + '" data-title="' + esc(it.title) + '">删除</button>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
    }
    view.innerHTML = html;
    setHeader('我的发布', '共 ' + list.length + ' 条');
  }

  /* ---------------- 顶栏 ---------------- */
  function setHeader(title, sub, showBack, backRoute) {
    headerTitle.textContent = title;
    headerSub.textContent = sub || '';
    var back = document.querySelector('.back-btn');
    if (showBack && !back) {
      var b = document.createElement('button');
      b.className = 'back-btn';
      b.textContent = '‹';
      b.setAttribute('aria-label', '返回');
      b.addEventListener('click', function () {
        history.back();
      });
      document.querySelector('.header-inner').insertBefore(b, document.querySelector('.header-inner').firstChild);
    } else if (!showBack && back) {
      back.remove();
    }
  }

  /* ---------------- 页面状态 ---------------- */
  var HomeState = { category: 'all', type: 'all' };
  var SearchState = { keyword: '', type: 'all' };
  var PublishState = { type: C.TYPE_LOST, category: '证件卡类' };
  var MineState = { type: 'all', status: 'all' };

  /* ---------------- 路由 ---------------- */
  function parseHash() {
    var h = location.hash || '#/';
    var m = h.replace(/^#\/?/, '').split('/'); // [''] | ['search'] | ['detail','itxxx'] | ['done','itxxx']
    var page = m[0] || 'home';
    var param = m[1] || '';
    return { page: page, param: param };
  }

  function navigate(page, param) {
    location.hash = '#/' + page + (param ? '/' + param : '');
  }

  function route() {
    var r = parseHash();
    switch (r.page) {
      case 'search': renderSearch(); break;
      case 'publish': renderPublish(); break;
      case 'detail': renderDetail(r.param); break;
      case 'done': renderDone(r.param); break;
      case 'mine': renderMine(); break;
      default: renderHome();
    }
    // 底部 Tab 高亮
    var tab = (r.page === 'done') ? 'publish' : r.page;
    document.querySelectorAll('.tab-item').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-tab') === tab);
    });
  }

  /* ---------------- 事件委托 ---------------- */
  view.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.getAttribute('data-action');
    var id = target.getAttribute('data-id');
    var val = target.getAttribute('data-value');

    switch (action) {
      case 'set-cat': HomeState.category = val; renderHome(); break;
      case 'set-type': HomeState.type = val; renderHome(); break;
      case 'set-s-type': SearchState.type = val; renderSearch(); break;
      case 'set-m-type': MineState.type = val; renderMine(); break;
      case 'set-m-status':
        MineState.status = (val === 'done') ? C.STATUS_DONE : 'all';
        renderMine(); break;
      case 'set-p-type': PublishState.type = val; renderPublish(); break;
      case 'hot-search': SearchState.keyword = val; S.addHistory(val); renderSearch(); break;
      case 'del-history': S.removeHistory(val); renderSearch(); break;
      case 'clear-history': S.clearHistory(); renderSearch(); break;
      case 'clear-search': SearchState.keyword = ''; renderSearch(); break;
      case 'detail': navigate('detail', id); break;
      case 'go-home': navigate(''); break;
      case 'go-mine': navigate('mine'); break;
      case 'go-publish': navigate('publish'); break;
      case 'copy-contact': copyText(val); break;
      case 'mark-done': {
        var itNow = C.getItemById(S.loadItems(), id);
        if (!itNow) { toast('信息不存在'); return; }
        var labelNow = C.statusLabel(C.STATUS_DONE, itNow.type);
        showConfirm('确认标记？', '该信息标记后，其他同学将看到“' + labelNow + '”状态。', function () {
          var items = S.loadItems();
          var it = C.getItemById(items, id);
          if (!it) { toast('信息不存在'); return; }
          var updated = C.updateStatus(it, C.STATUS_DONE);
          S.saveItems(items.map(function (x) { return x.id === id ? updated : x; }));
          toast('已标记为“' + C.statusLabel(C.STATUS_DONE, it.type) + '”');
          renderDetail(id);
        });
        break;
      }
      case 'reopen': {
        var items2 = S.loadItems();
        var it2 = C.getItemById(items2, id);
        if (!it2) { toast('信息不存在'); return; }
        var reopened = C.updateStatus(it2, C.STATUS_OPEN);
        S.saveItems(items2.map(function (x) { return x.id === id ? reopened : x; }));
        toast('已重新开放');
        renderMine();
        break;
      }
      case 'ask-delete':
        showConfirm('删除这条信息？', '“' + val + '”删除后不可恢复。', function () {
          S.saveItems(C.removeItem(S.loadItems(), id));
          toast('已删除');
          renderMine();
        });
        break;
      case 'submit-publish': submitPublish(); break;
      default: break;
    }
  });

  /** 发布提交 */
  function submitPublish() {
    var fields = {
      type: PublishState.type,
      category: document.getElementById('f-category').value,
      title: document.getElementById('f-title').value,
      location: document.getElementById('f-location').value,
      place: document.getElementById('f-place').value,
      happenedAt: document.getElementById('f-time').value,
      desc: document.getElementById('f-desc').value,
      contact: document.getElementById('f-contact').value,
      contactName: document.getElementById('f-name').value
    };
    var r = C.validatePublish(fields);
    if (!r.ok) {
      // 清空并回填错误
      document.querySelectorAll('.form-error').forEach(function (el) { el.textContent = ''; });
      Object.keys(r.errors).forEach(function (k) {
        var box = document.querySelector('.form-error[data-for="' + k + '"]');
        if (box) box.textContent = r.errors[k];
      });
      toast('请检查表单中的必填项');
      return;
    }
    var items = S.loadItems();
    var item = C.createItem(fields);
    items.unshift(item);
    S.saveItems(items);
    PublishState = { type: C.TYPE_LOST, category: '证件卡类' }; // 重置
    navigate('done', item.id);
  }

  /** 确认弹窗 */
  function showConfirm(title, msg, onOk) {
    var mask = document.createElement('div');
    mask.className = 'modal-mask show';
    mask.innerHTML = '<div class="modal">' +
      '<h3>' + esc(title) + '</h3><p>' + esc(msg) + '</p>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-gray" data-act="cancel">取消</button>' +
        '<button class="btn btn-primary" data-act="ok">确定</button>' +
      '</div></div>';
    document.body.appendChild(mask);
    mask.addEventListener('click', function (e) {
      var act = e.target.getAttribute('data-act');
      if (act === 'ok') { mask.remove(); onOk(); }
      else if (act === 'cancel') { mask.remove(); }
    });
  }

  /* ---------------- Tab 导航 ---------------- */
  document.querySelectorAll('.tab-item').forEach(function (el) {
    el.addEventListener('click', function () {
      navigate(el.getAttribute('data-tab'));
    });
  });

  /* ---------------- 启动 ---------------- */
  window.addEventListener('hashchange', route);
  route();
})();
