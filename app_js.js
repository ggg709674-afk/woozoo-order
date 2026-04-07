const SUPABASE_URL = 'https://duclnvlwvzhwhhglaxwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wLKHYM62ImdgoT4EvasMag_ikSGtKTO';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'woozoo-admin-session'
  }
});

// ─── 현재 로그인 사용자 정보 ───
let currentUser = null;
function isSuperAdmin() { return currentUser?.role === 'superadmin'; }
function canView(page) {
  if (isSuperAdmin()) return true;
  const perms = currentUser?.permissions || [];
  return perms.includes('view_' + page) || perms.includes('edit_' + page);
}
function canEdit(page) {
  if (isSuperAdmin()) return true;
  return currentUser?.permissions?.includes('edit_' + page) ?? false;
}
function applyPermissions() {
  // 메뉴는 모두 표시, 클릭 시 showPage에서 접근 차단
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const app = document.getElementById('app');
  const btn = document.getElementById('sidebar-collapse-btn');
  const collapsed = sidebar.classList.toggle('collapsed');
  app.classList.toggle('sidebar-collapsed', collapsed);
  btn.textContent = collapsed ? '▶' : '◀';
  localStorage.setItem('woozoo-sidebar', collapsed ? '1' : '0');
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('woozoo-theme', isDark ? 'dark' : 'light');
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.setAttribute('data-lucide', isDark ? 'moon' : 'sun');
    lucide.createIcons();
  }
}

function initTheme() {
  const saved = localStorage.getItem('woozoo-theme');
  if (saved === 'dark') {
    document.body.classList.add('dark');
    setTimeout(() => {
      const icon = document.getElementById('theme-icon');
      if (icon) { icon.setAttribute('data-lucide', 'moon'); lucide.createIcons(); }
    }, 100);
  }
  if (localStorage.getItem('woozoo-sidebar') === '1') {
    const sidebar = document.getElementById('sidebar');
    const app = document.getElementById('app');
    const btn = document.getElementById('sidebar-collapse-btn');
    if (sidebar) sidebar.classList.add('collapsed');
    if (app) app.classList.add('sidebar-collapsed');
    if (btn) btn.textContent = '▶';
  }
}

function showLogin() {
  document.getElementById('form-login').style.display = 'block';
  document.getElementById('form-signup').style.display = 'none';
  document.getElementById('form-pending').style.display = 'none';
  document.getElementById('login-mode-sub').textContent = '관리자 로그인';
  document.getElementById('login-err').textContent = '';
}
function showSignup() {
  document.getElementById('form-login').style.display = 'none';
  document.getElementById('form-signup').style.display = 'block';
  document.getElementById('form-pending').style.display = 'none';
  document.getElementById('login-mode-sub').textContent = '회원가입';
  document.getElementById('login-err').textContent = '';
}
function showPending() {
  document.getElementById('form-login').style.display = 'none';
  document.getElementById('form-signup').style.display = 'none';
  document.getElementById('form-pending').style.display = 'block';
  document.getElementById('login-mode-sub').textContent = '승인 대기';
}
let appEntered = false;
async function enterApp(email) {
  appEntered = true;
  const { data: { user } } = await sb.auth.getUser();
  if (user) {
    const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (profile) currentUser = { ...profile };
  }
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  const name = currentUser?.name || email || '관리자';
  document.getElementById('sidebar-name').textContent = name;
  const roleLabel = { superadmin: '최고관리자', admin: '관리자', staff: '직원' };
  document.getElementById('sidebar-role').textContent = roleLabel[currentUser?.role] || '직원';
  document.getElementById('sidebar-avatar').textContent = name.charAt(0).toUpperCase();

  // 개발 일지 페이지 .main 안에 동적 삽입
  const main = document.querySelector('.main');
  if (main && !document.getElementById('page-devlog')) {
    const devlogPage = document.createElement('div');
    devlogPage.className = 'page';
    devlogPage.id = 'page-devlog';
    devlogPage.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <div class="page-title">개발 일지</div>
          <div class="page-sub">우주커넥트 시스템 작업 히스토리</div>
        </div>
      </div>
      <div id="devlog-content"></div>
    `;
    main.appendChild(devlogPage);
  }
  setTimeout(() => {
    lucide.createIcons();
    applyPermissions();
    injectSettlSettingsModal();
    const hash = location.hash.replace('#', '');
    const validPages = ['dashboard','stock-in','inventory','orders','partners','settlement','models','plans','support','members','planmap','modelmap','files','devlog','policy-upload'];
    if (hash && validPages.includes(hash)) {
      showPage(hash);
    } else {
      loadDashboard();
    }
  }, 50);
  // presence 채널은 앱 시작 시 딱 한 번 초기화
  setTimeout(() => initPresence(), 300);
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-pw').value;
  const errEl = document.getElementById('login-err');
  if (!email || !pw) { errEl.style.color='var(--red)'; errEl.textContent = '이메일과 비밀번호를 입력해주세요'; return; }
  errEl.style.color = 'var(--text-sub)';
  errEl.textContent = '로그인 중...';
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
  if (error) { errEl.style.color='var(--red)'; errEl.textContent = error.message || '이메일 또는 비밀번호가 틀렸어요'; return; }
  errEl.textContent = '';
  enterApp(email);
}

async function doSignup() {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pw = document.getElementById('signup-pw').value;
  if (!name || !email || !pw) { document.getElementById('login-err').textContent = '모든 항목을 입력해주세요'; return; }
  if (pw.length < 6) { document.getElementById('login-err').textContent = '비밀번호는 6자 이상이어야 해요'; return; }
  const { data, error } = await sb.auth.signUp({ email, password: pw });
  if (error) { document.getElementById('login-err').textContent = error.message; return; }
  await sb.from('profiles').insert({ id: data.user.id, name, email, approved: false, role: 'staff' });
  document.getElementById('login-err').style.color = 'var(--green)';
  document.getElementById('login-err').textContent = '✓ 가입 신청 완료! 관리자 승인 후 이용 가능해요.';
  setTimeout(() => showPending(), 1500);
}

async function doLogout() {
  await sb.auth.signOut();
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
  showLogin();
}

initTheme();

sb.auth.onAuthStateChange((event, session) => {
  if (session && !appEntered) {
    enterApp(session.user.email);
  } else if (!session && !appEntered) {
    document.getElementById('login-page').style.display = 'flex';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  const s = document.createElement('style');
  s.textContent = [
    'input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}',
    'input[type=number]{-moz-appearance:textfield}',
    '.stl-td{border:1px solid var(--border) !important;}',
    '.stl-th{border:1px solid var(--border) !important;}',
    '.settl-table-card ::-webkit-scrollbar{display:none}',
    '.settl-table-card>div{scrollbar-width:none;-ms-overflow-style:none}',
  ].join('');
  document.head.appendChild(s);
});
function refreshIcons() { lucide.createIcons(); }

function showPage(name) {
  if (currentUser && !isSuperAdmin() && name !== 'dashboard' && !canView(name)) {
    toast('🔒 접근 권한이 없어요'); return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  const activeNav = document.querySelector(`.nav-item[data-page="${name}"]`);
  if (activeNav) activeNav.classList.add('active');
  location.hash = name;
  window.scrollTo(0, 0);
  document.querySelector('.main').scrollTop = 0;
  if (name === 'dashboard') loadDashboard();
  if (name === 'inventory') { switchInvTab('list'); }
  if (name === 'stock-in') {
    if (!canEdit('stock-in')) { toast('✏️ 입고 등록은 수정 권한이 필요해요'); showPage('dashboard'); return; }
    loadSIModels();
    document.getElementById('si-date').value = new Date().toISOString().split('T')[0];
  }
  if (name === 'orders') loadOrders();
  if (name === 'partners') loadPartners();
  if (name === 'models') loadModels();
  if (name === 'plans') loadPlans();
  if (name === 'support') loadSupport();
  if (name === 'planmap') loadPlanMap();
  if (name === 'modelmap') loadModelMap();
  if (name === 'members') loadMembers();
  if (name === 'settlement') loadSettlement();
  if (name === 'files') loadFiles();
  if (name === 'devlog') loadDevlog();
  if (name === 'policy-upload') loadPolicyPage();
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function statusBadge(s) {
  const map = {재고:'badge-stock',출고중:'badge-out',개통:'badge-done',숨김:'badge-hidden',접수대기:'badge-wait',접수완료:'badge-stock',출고:'badge-out',취소:'badge-cancel'};
  return `<span class="badge ${map[s]||'badge-wait'}">${s}</span>`;
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', {month:'numeric', day:'numeric'});
}

// ─── 대시보드 ───
async function loadDashboard() {
  const { data: inv } = await sb.from('inventory').select('status, model');
  const cntStock = inv?.filter(i => i.status === '재고').length || 0;
  const cntOut = inv?.filter(i => i.status === '출고중').length || 0;
  const cntDone = inv?.filter(i => i.status === '개통').length || 0;
  const cntHidden = inv?.filter(i => i.status === '숨김').length || 0;
  document.getElementById('s-total').textContent = cntStock + cntOut + cntHidden;
  document.getElementById('s-out').textContent = cntOut;
  if (document.getElementById('dash-cnt-stock')) {
    document.getElementById('dash-cnt-stock').textContent = cntStock;
    document.getElementById('dash-cnt-out').textContent = cntOut;
    document.getElementById('dash-cnt-done').textContent = cntDone;
    document.getElementById('dash-cnt-hidden').textContent = cntHidden;
  }
  const today = new Date(Date.now() + 9*60*60*1000).toISOString().split('T')[0];
  const { data: todayIn } = await sb.from('stock_in').select('id').gte('created_at', today);
  document.getElementById('s-in-today').textContent = todayIn?.length || 0;
  const { data: pending } = await sb.from('orders').select('id').eq('status', '접수대기');
  document.getElementById('s-pending').textContent = pending?.length || 0;

  const { data: models } = await sb.from('models').select('code, price');
  const priceMap = {};
  models?.forEach(m => { priceMap[m.code] = m.price || 0; });

  const stockItems = inv?.filter(i => i.status === '재고') || [];
  const modelCount = {};
  stockItems.forEach(i => { modelCount[i.model] = (modelCount[i.model] || 0) + 1; });
  const sortedModels = Object.entries(modelCount).sort((a,b) => b[1]-a[1]);
  const maxCnt = sortedModels[0]?.[1] || 1;

  const barColors = ['var(--primary)', 'var(--purple)', 'var(--green)', 'var(--orange)', 'var(--red)'];
  const barBody = document.getElementById('model-bar-body');
  const toggleBtn = document.getElementById('model-stock-toggle');
  if (barBody) {
    if (!sortedModels.length) { barBody.innerHTML = '<div class="empty">재고 없음</div>'; }
    else {
      const LIMIT = 8;
      const visible = sortedModels.slice(0, LIMIT);
      const hidden = sortedModels.slice(LIMIT);
      const makeBar = ([model, cnt], i) => `
        <div style="margin-bottom:11px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:12px;font-weight:700;color:var(--text);font-family:monospace">${model}</span>
            <span style="font-size:11px;color:var(--text-sub)">${cnt}대</span>
          </div>
          <div style="background:var(--border-light);border-radius:100px;height:5px">
            <div style="height:5px;border-radius:100px;background:${barColors[i%5]};width:${Math.round(cnt/maxCnt*100)}%;transition:width 0.8s ease"></div>
          </div>
        </div>`;
      barBody.innerHTML = visible.map(makeBar).join('') +
        (hidden.length ? `<div id="bar-hidden" style="display:none">${hidden.map((m,i) => makeBar(m, i+LIMIT)).join('')}</div>` : '') +
        (hidden.length ? `<div style="text-align:center;padding:8px 0 0"><button id="model-stock-toggle" style="background:none;border:1.5px solid var(--border);border-radius:20px;padding:6px 20px;font-size:12px;color:var(--text-sub);cursor:pointer;font-family:inherit">▼ 더보기 (${hidden.length}개)</button></div>` : '');
      if (hidden.length) {
        const toggleBtn = document.getElementById('model-stock-toggle');
        toggleBtn.onclick = () => {
          const h = document.getElementById('bar-hidden');
          const isHidden = h.style.display === 'none';
          h.style.display = isHidden ? '' : 'none';
          toggleBtn.textContent = isHidden ? '▲ 접기' : `▼ 더보기 (${hidden.length}개)`;
        };
      }
    }
  }

  let totalPrice = 0;
  const modelRows = sortedModels.map(([model, cnt]) => {
    const price = priceMap[model] || 0;
    const amount = price * cnt;
    totalPrice += amount;
    return `<tr>
      <td style="font-family:monospace;font-weight:700;color:var(--primary)">${model}</td>
      <td style="color:var(--text-sub)">${price ? price.toLocaleString()+'원' : '<span style="color:var(--text-hint)">미입력</span>'}</td>
      <td style="font-weight:700">${cnt}대</td>
      <td style="font-weight:700;color:var(--purple)">${price ? amount.toLocaleString()+'원' : '-'}</td>
    </tr>`;
  });
  document.getElementById('s-total-price').textContent = totalPrice ? totalPrice.toLocaleString()+'원' : '-';
  const msBody = document.getElementById('model-stock-body');
  if (!modelRows.length) {
    msBody.innerHTML = '<tr><td colspan="4" class="empty">재고 없음</td></tr>';
    if (toggleBtn) toggleBtn.style.display = 'none';
  } else {
    const LIMIT = 10;
    msBody.innerHTML = modelRows.map((row, i) =>
      i < LIMIT ? row : row.replace('<tr>', '<tr class="model-stock-extra" style="display:none">')
    ).join('');
    if (modelRows.length > LIMIT) {
      if (toggleBtn) {
        toggleBtn.style.display = 'block';
        toggleBtn.textContent = `▼ 더보기 (${modelRows.length - LIMIT}개)`;
        toggleBtn.onclick = () => {
          const extras = document.querySelectorAll('.model-stock-extra');
          const isHidden = extras[0].style.display === 'none';
          extras.forEach(r => r.style.display = isHidden ? '' : 'none');
          toggleBtn.textContent = isHidden ? '▲ 접기' : `▼ 더보기 (${modelRows.length - LIMIT}개)`;
        };
      }
    } else {
      if (toggleBtn) toggleBtn.style.display = 'none';
    }
  }

  const { data: orders } = await sb.from('orders').select('*, partners(name)').order('created_at', {ascending: false}).limit(10);
  const tbody = document.getElementById('recent-orders-body');
  if (!orders?.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">주문 없음</td></tr>'; return; }
  tbody.innerHTML = orders.map(o => `<tr>
    <td style="color:var(--text-sub);font-size:12px">${fmtDate(o.created_at)}</td>
    <td style="font-weight:600">${o.partners?.name || '-'}</td>
    <td>${o.customer_name || '-'}</td>
    <td style="font-weight:600">${o.model || '-'}</td>
    <td style="color:var(--text-sub)">${o.color || '-'}</td>
    <td style="color:var(--text-sub)">${o.storage || '-'}</td>
    <td>${statusBadge(o.status)}</td>
  </tr>`).join('');
}

// ─── 재고 현황 ───
function calcDays(d) {
  if (!d) return '-';
  const diff = Math.floor((new Date() - new Date(d)) / 86400000);
  const color = diff > 30 ? 'color:var(--red)' : diff > 14 ? 'color:var(--orange)' : 'color:var(--text-sub)';
  return `<span style="${color}">${diff}일</span>`;
}

function switchInvTab(tab) {
  document.querySelectorAll('.inv-tab[id^="inv-tab"]').forEach(t => t.classList.remove('active'));
  document.getElementById('inv-tab-' + tab).classList.add('active');
  document.getElementById('inv-panel-summary').style.display = tab === 'summary' ? '' : 'none';
  document.getElementById('inv-panel-list').style.display = tab === 'list' ? '' : 'none';
  if (tab === 'summary') { document.getElementById('inv-filter-status').value = ''; loadInvSummary(); }
  if (tab === 'list') loadInventory();
  setTimeout(() => lucide.createIcons(), 30);
}

function getInvSummaryOrder() {
  try { return JSON.parse(localStorage.getItem('inv-summary-order') || '[]'); } catch { return []; }
}
function saveInvSummaryOrder(order) {
  localStorage.setItem('inv-summary-order', JSON.stringify(order));
}

async function loadInvSummary() {
  const [{ data: inv }, { data: models }] = await Promise.all([
    sb.from('inventory').select('model, color, status'),
    sb.from('models').select('code, price'),
  ]);
  if (!inv) return;
  const priceMap = {};
  models?.forEach(m => { priceMap[m.code] = m.price || 0; });

  const map = {};
  inv.forEach(i => {
    const key = `${i.model}||${i.color||'-'}`;
    if (!map[key]) map[key] = { model: i.model, color: i.color||'-', stock:0, hidden:0, out:0, done:0, total:0 };
    map[key].total++;
    if (i.status === '재고') map[key].stock++;
    else if (i.status === '숨김') map[key].hidden++;
    else if (i.status === '출고중') map[key].out++;
    else if (i.status === '개통') map[key].done++;
  });

  const savedOrder = getInvSummaryOrder();
  let rows = Object.values(map);
  if (savedOrder.length) {
    rows.sort((a, b) => {
      const ai = savedOrder.indexOf(`${a.model}||${a.color}`);
      const bi = savedOrder.indexOf(`${b.model}||${b.color}`);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }

  const tbody = document.getElementById('inv-summary-tbody');
  tbody.innerHTML = rows.map((r) => {
    const price = priceMap[r.model] || 0;
    const totalAmt = price * (r.stock + r.out + r.hidden);
    return `<tr draggable="true" data-key="${r.model}||${r.color}">
    <td style="text-align:center;color:var(--text-hint);cursor:grab;font-size:16px;padding:0 8px" class="drag-handle">⠿</td>
    <td style="font-family:monospace;font-weight:700;color:var(--primary)">${r.model}</td>
    <td style="font-size:13px">${r.color}</td>
    <td style="font-weight:700;color:var(--primary);text-align:center">${r.stock}</td>
    <td style="color:var(--text-hint);text-align:center">${r.hidden}</td>
    <td style="color:var(--orange);text-align:center">${r.out}</td>
    <td style="color:var(--green);text-align:center">${r.done}</td>
    <td style="font-weight:600;text-align:center">${r.stock + r.out + r.hidden}</td>
    <td style="text-align:center;color:var(--text-sub);font-size:12px">${price ? price.toLocaleString()+'원' : '<span style="color:var(--text-hint)">-</span>'}</td>
    <td style="text-align:center;font-weight:700;color:var(--purple)">${totalAmt ? totalAmt.toLocaleString()+'원' : '<span style="color:var(--text-hint)">-</span>'}</td>
  </tr>`;
  }).join('');

  initDragSort();
  document.querySelectorAll('.inv-stat-card').forEach(c => c.classList.remove('active'));
  document.getElementById('isc-all').classList.add('active');
}

function initDragSort() {
  const tbody = document.getElementById('inv-summary-tbody');
  let dragSrc = null;
  tbody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('dragstart', e => { dragSrc = row; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    row.addEventListener('dragend', () => { row.classList.remove('dragging'); tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over')); saveInvSummaryOrder([...tbody.querySelectorAll('tr')].map(r => r.dataset.key)); });
    row.addEventListener('dragover', e => { e.preventDefault(); tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over')); row.classList.add('drag-over'); });
    row.addEventListener('drop', e => { e.preventDefault(); if (dragSrc !== row) { const rows = [...tbody.querySelectorAll('tr')]; const si = rows.indexOf(dragSrc); const di = rows.indexOf(row); if (si < di) row.after(dragSrc); else row.before(dragSrc); } });
  });
}

function invResetFilter() {
  ['inv-date-from','inv-date-to','inv-filter-status','inv-search','inv-filter-model','inv-filter-color','inv-filter-group'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.querySelectorAll('.inv-stat-card').forEach(c => c.classList.remove('active'));
  document.getElementById('isc-all').classList.add('active');
  loadInventory();
}

function setInvFilter(status) {
  const isListTab = document.getElementById('inv-panel-list').style.display !== 'none';
  document.getElementById('inv-filter-status').value = status;
  document.querySelectorAll('.inv-stat-card').forEach(c => c.classList.remove('active'));
  const map = {'':'isc-all','재고':'isc-stock','출고중':'isc-out','개통':'isc-done','숨김':'isc-hidden'};
  document.getElementById(map[status]).classList.add('active');
  if (!isListTab) {
    document.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('inv-tab-list').classList.add('active');
    document.getElementById('inv-panel-summary').style.display = 'none';
    document.getElementById('inv-panel-list').style.display = '';
  }
  loadInventory();
}

async function loadInventory() {
  const status = document.getElementById('inv-filter-status').value;
  const search = document.getElementById('inv-search').value.toLowerCase();
  const dateFrom = document.getElementById('inv-date-from').value;
  const dateTo = document.getElementById('inv-date-to').value;
  const modelFilter = document.getElementById('inv-filter-model').value;
  const colorFilter = document.getElementById('inv-filter-color').value;
  const groupFilter = document.getElementById('inv-filter-group')?.value || '';
  let q = sb.from('inventory').select('*').order('created_at', {ascending: false});
  if (status) {
    q = q.eq('status', status);
  } else {
    // 기본: 개통 제외 (재고, 출고중, 숨김만 표시)
    q = q.neq('status', '개통');
  }
  if (modelFilter) q = q.eq('model', modelFilter);
  if (colorFilter) q = q.eq('color', colorFilter);
  if (dateFrom) q = q.gte('created_at', dateFrom);
  if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59');
  if (groupFilter === 'any') q = q.not('visible_groups', 'is', null);
  else if (groupFilter) q = q.contains('visible_groups', [groupFilter]);
  const { data } = await q;
  const all = data || [];

  const modelSel = document.getElementById('inv-filter-model');
  if (modelSel.options.length <= 1) {
    const { data: allInvModels } = await sb.from('inventory').select('model').order('model');
    const models = [...new Set(allInvModels?.map(i => i.model).filter(Boolean))];
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = m;
      modelSel.appendChild(opt);
    });
  }

  const { data: allData } = await sb.from('inventory').select('status');
  const allInv = allData || [];
  document.getElementById('inv-cnt-all').textContent = allInv.filter(i=>i.status!=='개통').length;
  document.getElementById('inv-cnt-stock').textContent = allInv.filter(i=>i.status==='재고').length;
  document.getElementById('inv-cnt-out').textContent = allInv.filter(i=>i.status==='출고중').length;
  document.getElementById('inv-cnt-done').textContent = allInv.filter(i=>i.status==='개통').length;
  document.getElementById('inv-cnt-hidden').textContent = allInv.filter(i=>i.status==='숨김').length;
  const filtered = all.filter(i => !search || i.model?.toLowerCase().includes(search) || i.serial_number?.toLowerCase().includes(search) || i.color?.toLowerCase().includes(search));
  document.getElementById('inv-result-count').textContent = `${filtered.length}건 표시중`;
  const tbody = document.getElementById('inv-tbody');
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="17" class="empty">재고 없음</td></tr>'; return; }
  tbody.innerHTML = filtered.map(i => `<tr>
    <td>${statusBadge(i.status)}</td>
    <td style="font-size:12px;white-space:nowrap;color:var(--text-sub)">${fmtDate(i.stock_date || i.created_at)}</td>
    <td style="font-size:12px">${calcDays(i.stock_date || i.created_at)}</td>
    <td style="font-weight:700">${i.model}</td>
    <td style="font-family:monospace;font-size:12px;color:var(--text-sub)">${i.serial_number}</td>
    <td style="font-size:12px">${i.color || '-'}</td>
    <td style="font-size:12px;color:var(--text-sub)">${i.location || '-'}</td>
    ${['A','B','C','D','E'].map(g => `
      <td style="text-align:center">
        <input type="checkbox" ${(i.visible_groups||[]).includes(g)?'checked':''}
          data-inv-id="${i.id}" data-group="${g}"
          ${canEdit('inventory') ? 'onchange="toggleInvGroup(this)"' : 'disabled'}
          style="width:14px;height:14px;accent-color:var(--red);cursor:${canEdit('inventory')?'pointer':'not-allowed'};opacity:${canEdit('inventory')?1:0.4}"
          title="${g}그룹에 숨김"/>
      </td>`).join('')}
    <td style="font-size:12px;white-space:nowrap">${i.shipped_date ? fmtDate(i.shipped_date) : '-'}</td>
    <td style="font-size:12px">${i.shipped_to || '-'}</td>
    <td style="font-size:12px;white-space:nowrap;color:var(--green)">${i.activated_date ? fmtDate(i.activated_date) : '-'}</td>
    <td style="font-size:12px">${i.activated_at || '-'}</td>
    <td>
      ${canEdit('inventory')
        ? `<select class="filter-select" style="height:28px;font-size:11px" onchange="changeInvStatus('${i.id}', this.value)">
            <option ${i.status==='재고'?'selected':''}>재고</option>
            <option ${i.status==='출고중'?'selected':''}>출고중</option>
            <option ${i.status==='개통'?'selected':''}>개통</option>
            <option ${i.status==='숨김'?'selected':''}>숨김</option>
           </select>`
        : `<span style="font-size:11px;color:var(--text-hint)">${statusBadge(i.status)}</span>`}
    </td>
  </tr>`).join('');
}

async function changeInvStatus(id, status) {
  if (!canEdit('inventory')) { toast('⚠️ 수정 권한이 없어요'); return; }
  const { error } = await sb.from('inventory').update({status}).eq('id', id);
  if (error) { toast('변경 실패'); return; }
  toast('✓ 상태 변경됨');
  const rows = document.querySelectorAll('#inv-tbody tr');
  rows.forEach(row => {
    const sel = row.querySelector('select');
    if (sel && sel.getAttribute('onchange')?.includes(`'${id}'`)) {
      const badgeCell = row.cells[0];
      if (badgeCell) badgeCell.innerHTML = statusBadge(status);
    }
  });
  const { data: allData } = await sb.from('inventory').select('status');
  const allInv = allData || [];
  document.getElementById('inv-cnt-all').textContent = allInv.filter(i=>i.status!=='개통').length;
  document.getElementById('inv-cnt-stock').textContent = allInv.filter(i=>i.status==='재고').length;
  document.getElementById('inv-cnt-out').textContent = allInv.filter(i=>i.status==='출고중').length;
  document.getElementById('inv-cnt-done').textContent = allInv.filter(i=>i.status==='개통').length;
  document.getElementById('inv-cnt-hidden').textContent = allInv.filter(i=>i.status==='숨김').length;
}

// ─── 주문 처리 ───
let currentOrderId = null;
async function loadOrders() {
  const status = document.getElementById('ord-filter').value;
  const search = document.getElementById('ord-search').value.toLowerCase();
  let q = sb.from('orders').select('*, partners(name)').order('created_at', {ascending: false});
  if (status) q = q.eq('status', status);
  const { data } = await q;
  const filtered = data?.filter(o => !search || o.customer_name?.toLowerCase().includes(search) || o.model?.toLowerCase().includes(search)) || [];
  const tbody = document.getElementById('ord-tbody');
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="11" class="empty">주문 없음</td></tr>'; return; }
  tbody.innerHTML = filtered.map(o => `<tr>
    <td style="font-size:12px;color:var(--text-sub);white-space:nowrap">${fmtDate(o.created_at)}</td>
    <td style="font-weight:600">${o.partners?.name || '-'}</td>
    <td>${o.customer_name || '-'}</td>
    <td style="font-size:12px;color:var(--text-sub)">${o.customer_phone || '-'}</td>
    <td style="font-size:12px;color:var(--text-sub);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${[o.address, o.address_detail].filter(Boolean).join(' ') || '-'}</td>
    <td style="font-weight:600">${o.model || '-'}</td>
    <td style="font-size:12px;color:var(--text-sub)">${o.color || '-'}</td>
    <td style="font-size:12px">${o.usim || '-'}</td>
    <td style="font-size:12px;color:var(--text-sub);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.memo || '-'}</td>
    <td>${statusBadge(o.status)}</td>
    <td>${canEdit('orders') ? `<button class="btn btn-outline btn-sm" onclick="openOrderModal('${o.id}')">처리</button>` : '<span style="font-size:11px;color:var(--text-hint)">보기 전용</span>'}</td>
  </tr>`).join('');
}

async function openOrderModal(id) {
  currentOrderId = id;
  const { data: o } = await sb.from('orders').select('*, partners(name)').eq('id', id).single();
  document.getElementById('order-detail').innerHTML = `
    <div class="detail-row"><span class="detail-label">거래처</span><span class="detail-value">${o.partners?.name||'-'}</span></div>
    <div class="detail-row"><span class="detail-label">고객명</span><span class="detail-value">${o.customer_name||'-'}</span></div>
    <div class="detail-row"><span class="detail-label">연락처</span><span class="detail-value">${o.customer_phone||'-'}</span></div>
    <div class="detail-row"><span class="detail-label">주소</span><span class="detail-value">${o.address||'-'} ${o.address_detail||''}</span></div>
    <div class="detail-row"><span class="detail-label">모델</span><span class="detail-value">${o.model} ${o.color} ${o.storage}</span></div>
    <div class="detail-row" style="margin-bottom:16px"><span class="detail-label">유심</span><span class="detail-value">${o.usim||'-'}</span></div>
  `;
  document.getElementById('m-status').value = o.status || '접수대기';
  document.getElementById('m-serial').value = o.serial_number || '';
  document.getElementById('m-tracking').value = o.tracking_number || '';
  document.getElementById('m-shipped-date').value = o.shipped_date || '';
  document.getElementById('order-modal').classList.add('open');
}

async function saveOrder() {
  if (!canEdit('orders')) { toast('⚠️ 수정 권한이 없어요'); return; }
  if (!currentOrderId) return;
  await sb.from('orders').update({
    status: document.getElementById('m-status').value,
    serial_number: document.getElementById('m-serial').value,
    tracking_number: document.getElementById('m-tracking').value,
    shipped_date: document.getElementById('m-shipped-date').value,
  }).eq('id', currentOrderId);
  closeModal('order-modal');
  toast('✓ 저장되었어요');
  loadOrders();
}

// ─── 거래처 ───
async function loadPartners() {
  // 접근만 권한이면 추가 버튼 숨김
  const addBtn = document.querySelector('#page-partners .btn-primary');
  if (addBtn) addBtn.style.display = canEdit('partners') ? '' : 'none';
  const { data } = await sb.from('partners').select('*').order('created_at', {ascending: false});
  const tbody = document.getElementById('partner-tbody');
  if (!data?.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">거래처 없음</td></tr>'; return; }
  const groups = ['A','B','C','D','E'];
  tbody.innerHTML = data.map(p => `<tr>
    <td style="font-weight:700">${p.name}</td>
    <td style="font-family:monospace;font-size:12px;color:var(--text-sub)">${p.vendor_id}</td>
    <td>
      ${canEdit('partners')
        ? `<select class="filter-select" style="height:28px;font-size:12px;width:80px" onchange="updatePartnerGroup('${p.id}',this.value)">
            <option value="" ${!p.partner_group?'selected':''}>없음</option>
            ${groups.map(g=>`<option value="${g}" ${p.partner_group===g?'selected':''}>${g}그룹</option>`).join('')}
           </select>`
        : `<span style="font-size:12px;color:var(--text-sub)">${p.partner_group ? p.partner_group+'그룹' : '없음'}</span>`}
    </td>
    <td style="font-size:12px;color:var(--text-sub)">${fmtDate(p.created_at)}</td>
    <td><button class="btn btn-outline btn-sm" onclick="copyLink('${p.vendor_id}')">🔗 링크 복사</button></td>
    <td style="display:flex;gap:6px">
      ${canEdit('partners') ? `
        <button class="btn btn-outline btn-sm" onclick="openEditPartner('${p.id}','${p.name.replace(/'/g,"\\'")}','${p.vendor_id||''}','${p.partner_group||''}')">수정</button>
        <button class="btn btn-danger btn-sm" onclick="deletePartner('${p.id}','${p.name.replace(/'/g,"\\'")}')">삭제</button>
      ` : ''}
    </td>
  </tr>`).join('');
}

async function toggleInvGroup(checkbox) {
  if (!canEdit('inventory')) { toast('⚠️ 수정 권한이 없어요'); checkbox.checked = !checkbox.checked; return; }
  const id = checkbox.getAttribute('data-inv-id');
  const group = checkbox.getAttribute('data-group');
  const { data } = await sb.from('inventory').select('visible_groups').eq('id', id).single();
  let groups = [...(data?.visible_groups || [])];
  if (checkbox.checked) {
    if (!groups.includes(group)) groups.push(group);
  } else {
    groups = groups.filter(g => g !== group);
  }
  const { error } = await sb.from('inventory').update({ visible_groups: groups.length ? groups : null }).eq('id', id);
  if (error) { toast('저장 실패'); checkbox.checked = !checkbox.checked; }
}

async function updatePartnerGroup(id, group) {
  if (!canEdit('partners')) { toast('⚠️ 수정 권한이 없어요'); return; }
  await sb.from('partners').update({ partner_group: group || null }).eq('id', id);
  toast('✓ 그룹 변경됨');
}

function copyLink(slug) {
  navigator.clipboard.writeText(window.location.origin + '/order/' + slug).then(() => toast('✓ 링크 복사됨!'));
}
function openAddPartner() { document.getElementById('partner-modal').classList.add('open'); }

function openEditPartner(id, name, vendorId, group) {
  document.getElementById('partner-modal-title').textContent = '거래처 수정';
  document.getElementById('p-id').value = id;
  document.getElementById('p-name').value = name;
  document.getElementById('p-slug').value = vendorId;
  const groupSel = document.getElementById('p-group');
  if (groupSel) groupSel.value = group;
  document.getElementById('partner-modal').classList.add('open');
}

async function savePartner() {
  if (!canEdit('partners')) { toast('⚠️ 수정 권한이 없어요'); return; }
  const id = document.getElementById('p-id').value;
  const name = document.getElementById('p-name').value.trim();
  const vendor_id = document.getElementById('p-slug').value.trim();
  const group = document.getElementById('p-group')?.value || null;
  if (!name || !vendor_id) { toast('이름과 거래처 ID를 입력해주세요'); return; }
  let error;
  if (id) {
    ({ error } = await sb.from('partners').update({ name, vendor_id, partner_group: group || null }).eq('id', id));
  } else {
    ({ error } = await sb.from('partners').insert({ name, vendor_id, role: 'vendor' }));
  }
  if (error) { toast('오류: ' + error.message); return; }
  closeModal('partner-modal');
  toast(id ? '✓ 거래처 수정됨' : '✓ 거래처 추가됨');
  loadPartners();
  document.getElementById('p-id').value = '';
  document.getElementById('p-name').value = '';
  document.getElementById('p-slug').value = '';
  if (document.getElementById('p-group')) document.getElementById('p-group').value = '';
  document.getElementById('partner-modal-title').textContent = '거래처 추가';
}

async function deletePartner(id, name) {
  if (!canEdit('partners')) { toast('⚠️ 수정 권한이 없어요'); return; }
  // 미처리 주문 확인
  const { data: pending } = await sb.from('orders')
    .select('id', { count: 'exact' })
    .eq('partner_id', id)
    .in('status', ['접수대기', '접수완료', '출고']);
  if (pending?.length > 0) {
    toast(`⚠️ 미처리 주문 ${pending.length}건이 있어요. 먼저 처리해주세요`);
    return;
  }
  // 전체 주문 건수 확인 (이력)
  const { data: allOrders } = await sb.from('orders').select('id', { count: 'exact' }).eq('partner_id', id);
  const historyCount = allOrders?.length || 0;
  const msg = historyCount > 0
    ? `"${name}" 거래처를 삭제할까요?\n\n⚠️ 거래 이력 ${historyCount}건이 있습니다.\n삭제해도 기존 주문 데이터는 보존되지만\n주문 목록에서 거래처명이 '-'로 표시됩니다.`
    : `"${name}" 거래처를 삭제할까요?`;
  if (!confirm(msg)) return;
  const { error } = await sb.from('partners').delete().eq('id', id);
  if (error) { toast('삭제 실패: ' + error.message); return; }
  toast('✓ 거래처 삭제됨');
  loadPartners();
}

// ─── 모델 관리 ───
let editModelId = null;
let draggedRow = null;
let modelsCache = [];

function handleDragStart(e) {
  draggedRow = e.target.closest('tr');
  e.dataTransfer.effectAllowed = 'move';
  draggedRow.style.opacity = '0.5';
}

function handleDragOver(e) {
  if (e.preventDefault) e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const targetRow = e.target.closest('tr');
  if (targetRow && targetRow !== draggedRow) targetRow.style.borderTop = '2px solid var(--primary)';
  return false;
}

function handleDrop(e) {
  if (e.stopPropagation) e.stopPropagation();
  e.preventDefault();
  const targetRow = e.target.closest('tr');
  if (targetRow && targetRow !== draggedRow) {
    const tbody = targetRow.parentNode;
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    const draggedIndex = allRows.indexOf(draggedRow);
    const targetIndex = allRows.indexOf(targetRow);
    if (draggedIndex < targetIndex) targetRow.parentNode.insertBefore(draggedRow, targetRow.nextSibling);
    else targetRow.parentNode.insertBefore(draggedRow, targetRow);
    updateModelOrder();
  }
  targetRow.style.borderTop = '';
  return false;
}

function handleDragEnd(e) {
  draggedRow.style.opacity = '1';
  document.querySelectorAll('#model-tbody tr').forEach(row => row.style.borderTop = '');
}

async function updateModelOrder() {
  if (!canEdit('models')) return;
  const rows = document.querySelectorAll('#model-tbody tr');
  const updates = [];
  rows.forEach((row, index) => { if (row.dataset.modelId) updates.push({ id: row.dataset.modelId, display_order: index }); });
  for (const u of updates) await sb.from('models').update({ display_order: u.display_order }).eq('id', u.id);
  toast('✓ 순서가 저장되었습니다');
}

async function loadModels() {
  // 접근만 권한이면 추가 버튼 숨김
  const addBtn = document.querySelector('#page-models .btn-primary');
  if (addBtn) addBtn.style.display = canEdit('models') ? '' : 'none';
  const { data } = await sb.from('models').select('*').order('display_order');
  modelsCache = data || [];
  const tbody = document.getElementById('model-tbody');
  if (!data?.length) { tbody.innerHTML = '<tr><td colspan="12" class="empty">등록된 모델이 없어요</td></tr>'; return; }
  tbody.innerHTML = data.map((m, index) => {
    const active = m.is_active ? '<span class="badge badge-done">활성</span>' : '<span class="badge badge-hidden">비활성</span>';
    return `<tr draggable="true" data-model-id="${m.id}" data-order="${m.display_order || index}"
                ondragstart="handleDragStart(event)" ondragover="handleDragOver(event)"
                ondrop="handleDrop(event)" ondragend="handleDragEnd(event)" style="cursor:move">
      <td style="text-align:center;color:var(--text-hint);cursor:move"><i data-lucide="grip-vertical" style="width:16px;height:16px"></i></td>
      <td style="font-family:monospace;font-weight:700;color:var(--primary)">${m.code}</td>
      <td style="font-weight:600">${m.manufacturer || '-'}</td>
      <td style="font-size:12px">${m.color1||'-'}</td><td style="font-size:12px">${m.color2||'-'}</td><td style="font-size:12px">${m.color3||'-'}</td>
      <td style="font-size:12px">${m.color4||'-'}</td><td style="font-size:12px">${m.color5||'-'}</td><td style="font-size:12px">${m.color6||'-'}</td>
      <td style="font-weight:700;color:var(--text)">${m.price ? m.price.toLocaleString()+'원' : '<span style="color:var(--text-hint)">미입력</span>'}</td>
      <td>${active}</td>
      <td style="display:flex;gap:6px">
        ${canEdit('models')
          ? `<button class="btn btn-outline btn-sm" onclick="openEditModelById('${m.id}')">수정</button>
             <button class="btn btn-danger btn-sm" onclick="toggleModel('${m.id}',${m.is_active})">${m.is_active?'비활성화':'활성화'}</button>`
          : '<span style="font-size:12px;color:var(--text-hint)">보기 전용</span>'}
      </td>
    </tr>`;
  }).join('');
  lucide.createIcons();
}

function openAddModel() {
  editModelId = null;
  document.getElementById('model-modal-title').textContent = '모델 추가';
  ['m-code','m-c1','m-c2','m-c3','m-c4','m-c5','m-c6','m-price'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('m-mfg-samsung').checked = true;
  document.getElementById('m-code').readOnly = false;
  document.getElementById('model-modal').classList.add('open');
  setTimeout(() => document.getElementById('m-code').focus(), 100);
}

function openEditModelById(id) {
  const m = modelsCache.find(x => x.id === id);
  if (!m) return;
  openEditModel(m.id, m.code, m.color1||'', m.color2||'', m.color3||'', m.color4||'', m.color5||'', m.color6||'', m.price||0, m.manufacturer||'');
}

function openEditModel(id, code, c1, c2, c3, c4, c5, c6, price, manufacturer) {
  editModelId = id;
  document.getElementById('model-modal-title').textContent = '모델 수정';
  document.getElementById('m-code').value = code;
  document.getElementById('m-code').readOnly = true;
  ['m-c1','m-c2','m-c3','m-c4','m-c5','m-c6'].forEach((id,i) => document.getElementById(id).value = [c1,c2,c3,c4,c5,c6][i]);
  document.getElementById('m-price').value = price || '';
  if (manufacturer === '삼성') document.getElementById('m-mfg-samsung').checked = true;
  else if (manufacturer === '애플') document.getElementById('m-mfg-apple').checked = true;
  else if (manufacturer === '기타') document.getElementById('m-mfg-other').checked = true;
  else document.getElementById('m-mfg-samsung').checked = true;
  document.getElementById('model-modal').classList.add('open');
}

async function saveModel() {
  if (!canEdit('models')) { toast('⚠️ 수정 권한이 없어요'); return; }
  const code = document.getElementById('m-code').value.trim().toUpperCase();
  if (!code) { toast('모델코드를 입력해주세요'); return; }
  const manufacturer = document.querySelector('input[name="manufacturer"]:checked')?.value;
  if (!manufacturer) { toast('제조사를 선택해주세요'); return; }
  const price = parseInt(document.getElementById('m-price').value) || 0;
  const payload = { code, manufacturer, price,
    color1:document.getElementById('m-c1').value.trim()||null,
    color2:document.getElementById('m-c2').value.trim()||null,
    color3:document.getElementById('m-c3').value.trim()||null,
    color4:document.getElementById('m-c4').value.trim()||null,
    color5:document.getElementById('m-c5').value.trim()||null,
    color6:document.getElementById('m-c6').value.trim()||null
  };
  let error;
  if (editModelId) { ({error} = await sb.from('models').update(payload).eq('id', editModelId)); }
  else { ({error} = await sb.from('models').insert(payload)); }
  if (error) { toast('오류: ' + error.message); return; }
  closeModal('model-modal');
  toast(editModelId ? '✓ 모델 수정됨' : '✓ 모델 추가됨');
  loadModels();
}

async function toggleModel(id, isActive) {
  if (!canEdit('models')) { toast('⚠️ 수정 권한이 없어요'); return; }
  await sb.from('models').update({is_active: !isActive}).eq('id', id);
  toast(isActive ? '비활성화됨' : '활성화됨');
  loadModels();
}

// ─── 회원 관리 ───
const MENU_LABELS = {
  settlement:'정산 관리','stock-in':'입고 등록',inventory:'재고 현황',
  orders:'주문 처리',partners:'거래처 관리',models:'모델 관리',
  plans:'요금제 관리',support:'공통지원금',members:'회원 관리',
  planmap:'요금제 매핑',modelmap:'모델 매핑',files:'파일함',devlog:'개발 일지',
  settlement_settings:'정산 설정',policy:'정책 파일 관리'
};
const PERM_MENUS = ['settlement','stock-in','inventory','orders','partners','models','plans','support','members','planmap','modelmap','files','devlog','settlement_settings','policy'];
const ROLE_LABELS = { superadmin:'최고관리자', admin:'관리자', staff:'직원' };
let _membersCache = [];

async function loadMembers() {
  const filter = document.getElementById('mem-filter').value;
  let q = sb.from('profiles').select('*').neq('role','vendor').order('created_at', {ascending:false});
  if (filter !== '') q = q.eq('approved', filter === 'true');
  const { data } = await q;
  _membersCache = data || [];
  const tbody = document.getElementById('mem-tbody');
  if (!data?.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">회원 없음</td></tr>'; return; }
  tbody.innerHTML = data.map(m => {
    const roleColor = m.role==='superadmin'?'#8B5CF6':m.role==='admin'?'#3B82F6':'#64748B';
    const perms = m.permissions || [];
    const chips = m.role==='superadmin'
      ? '<span style="font-size:11px;color:var(--text-hint)">전체 접근+수정</span>'
      : perms.length===0
        ? '<span style="font-size:11px;color:var(--text-hint)">권한 없음</span>'
        : PERM_MENUS.map(k => {
            const e = perms.includes('edit_'+k), v = perms.includes('view_'+k);
            if (!e && !v) return '';
            return `<span style="display:inline-block;padding:2px 7px;border-radius:100px;font-size:10px;font-weight:700;margin:2px;background:${e?'var(--primary-light)':'var(--orange-bg)'};color:${e?'var(--primary)':'var(--orange)'}">${MENU_LABELS[k]}${e?'':' (보기)'}</span>`;
          }).join('');
    return `<tr>
      <td style="font-weight:700">${m.name||'-'}</td>
      <td style="font-size:12px;color:var(--text-sub)">${m.email||'-'}</td>
      <td><span style="background:${roleColor}22;color:${roleColor};padding:3px 10px;border-radius:100px;font-size:11px;font-weight:800">${ROLE_LABELS[m.role]||'직원'}</span></td>
      <td style="font-size:12px;color:var(--text-sub)">${fmtDate(m.created_at)}</td>
      <td>${m.approved?'<span class="badge badge-done">승인</span>':'<span class="badge badge-wait">대기중</span>'}</td>
      <td style="max-width:320px">${chips}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        ${isSuperAdmin() && m.role!=='superadmin' ? `
          ${!m.approved?`<button class="btn btn-primary btn-sm" onclick="approveMember('${m.id}')">승인</button>`:''}
          <button class="btn btn-outline btn-sm" onclick="openPermModal('${m.id}')">권한설정</button>
          <button class="btn btn-danger btn-sm" onclick="rejectMember('${m.id}')">삭제</button>
        `:''}
      </td>
    </tr>`;
  }).join('');
}

async function approveMember(id) { await sb.from('profiles').update({approved:true}).eq('id',id); toast('✓ 승인됐어요'); loadMembers(); }
async function rejectMember(id) { if(!confirm('이 회원을 삭제할까요?')) return; await sb.from('profiles').delete().eq('id',id); toast('삭제됐어요'); loadMembers(); }

function openPermModal(id) {
  const m = _membersCache.find(x => x.id === id);
  if (!m) return;
  const perms = m.permissions || [];
  document.getElementById('perm-modal-name').textContent = (m.name||m.email) + ' 권한 설정';
  document.getElementById('perm-modal-id').value = id;
  document.getElementById('perm-role-select').value = m.role;
  document.getElementById('perm-checks').innerHTML = PERM_MENUS.map(key => {
    const val = perms.includes('edit_'+key)?'edit':perms.includes('view_'+key)?'view':'none';
    const bg = (v) => v==='none'?'var(--red-bg)':v==='view'?'var(--orange-bg)':'var(--primary-light)';
    const cl = (v) => v==='none'?'var(--red)':v==='view'?'var(--orange)':'var(--primary)';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--white);margin-bottom:6px">
      <span style="font-size:13px;font-weight:600;color:var(--text)">${MENU_LABELS[key]}</span>
      <div style="display:flex;gap:4px" id="perm-row-${key}">
        ${['none','view','edit'].map(v => `
          <label style="display:flex;align-items:center;cursor:pointer;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;background:${val===v?bg(v):'transparent'};color:${val===v?cl(v):'var(--text-hint)'}">
            <input type="radio" name="perm_${key}" value="${v}" ${val===v?'checked':''} style="display:none" onchange="updatePermRow(this,'${key}')">
            ${v==='none'?'접근안됨':v==='view'?'접근만':'접근+수정'}
          </label>`).join('')}
      </div>
    </div>`;
  }).join('');
  document.getElementById('perm-modal').style.display = 'flex';
}

function updatePermRow(input, key) {
  const row = document.getElementById('perm-row-'+key);
  const bg = (v) => v==='none'?'var(--red-bg)':v==='view'?'var(--orange-bg)':'var(--primary-light)';
  const cl = (v) => v==='none'?'var(--red)':v==='view'?'var(--orange)':'var(--primary)';
  row.querySelectorAll('label').forEach(label => {
    const r = label.querySelector('input'), v = r.value;
    label.style.background = r.checked ? bg(v) : 'transparent';
    label.style.color = r.checked ? cl(v) : 'var(--text-hint)';
  });
}

function closePermModal() { document.getElementById('perm-modal').style.display = 'none'; }

async function savePermModal() {
  const id = document.getElementById('perm-modal-id').value;
  const role = document.getElementById('perm-role-select').value;
  const permissions = [];
  PERM_MENUS.forEach(key => {
    const checked = document.querySelector(`input[name="perm_${key}"]:checked`);
    if (checked?.value === 'view') permissions.push('view_'+key);
    if (checked?.value === 'edit') permissions.push('edit_'+key);
  });
  await sb.from('profiles').update({ role, permissions }).eq('id', id);
  toast('✓ 권한이 저장됐어요');
  closePermModal();
  loadMembers();
}

// ─── 입고 등록 ───
let SI_MODELS = [], siModel='', siBrand='', siHl=-1, siRowNum=0;

async function loadSIModels() {
  const { data } = await sb.from('models').select('*').eq('is_active', true).order('code');
  SI_MODELS = data || [];
  document.getElementById('si-date').value = new Date().toISOString().split('T')[0];
}

function getBrand(code) { return (code.startsWith('IP')||code.startsWith('IPA')) ? 'apple' : 'samsung'; }
function getColors(code) { const m=SI_MODELS.find(x=>x.code===code); if(!m) return []; return [m.color1,m.color2,m.color3,m.color4,m.color5,m.color6].filter(Boolean); }

function siGetAll() {
  const q = document.getElementById('si-model-search').value.toLowerCase().replace(/\s/g,'');
  return SI_MODELS.filter(m=>m.is_active).filter(m=>!q||m.code.toLowerCase().includes(q)).map(m=>({model:m.code, brand:getBrand(m.code)}));
}
function siFilterModels() { siHl=-1; siOpenDd(); }
function siOpenDd() {
  const dd = document.getElementById('si-dd');
  const res = siGetAll();
  if (!res.length) { dd.innerHTML = '<div class="dd-empty">검색 결과 없음</div>'; }
  else { dd.innerHTML = res.map(r => `<div class="dd-item" data-model="${r.model}" data-brand="${r.brand}" onclick="siSelModel('${r.model}','${r.brand}')">${r.model} <span class="brand-tag ${r.brand==='apple'?'apple-tag':'samsung-tag'}">${r.brand==='apple'?'Apple':'Samsung'}</span></div>`).join(''); }
  dd.classList.add('open');
}
function siHandleKey(e) {
  const items = document.querySelectorAll('#si-dd .dd-item');
  if (e.key==='ArrowDown') { siHl=Math.min(siHl+1,items.length-1); siHL(items); e.preventDefault(); }
  else if (e.key==='ArrowUp') { siHl=Math.max(siHl-1,0); siHL(items); e.preventDefault(); }
  else if (e.key==='Enter'&&siHl>=0) { const it=items[siHl]; siSelModel(it.dataset.model,it.dataset.brand); e.preventDefault(); }
  else if (e.key==='Escape') document.getElementById('si-dd').classList.remove('open');
}
function siHL(items) { items.forEach((it,i)=>it.classList.toggle('hl',i===siHl)); if(items[siHl]) items[siHl].scrollIntoView({block:'nearest'}); }
function siSelModel(model, brand) {
  siModel=model; siBrand=brand;
  document.getElementById('si-model-search').value=model;
  document.getElementById('si-sel-text').textContent=model;
  document.getElementById('si-sel-badge').classList.add('show');
  document.getElementById('si-dd').classList.remove('open');
  const sel=document.getElementById('si-color');
  sel.innerHTML='<option value="">색상 선택</option>';
  getColors(model).forEach(c=>{const o=document.createElement('option');o.textContent=c;sel.appendChild(o);});
}
function siClearModel() { siModel=''; siBrand=''; document.getElementById('si-model-search').value=''; document.getElementById('si-sel-badge').classList.remove('show'); document.getElementById('si-color').innerHTML='<option value="">색상 선택</option>'; }
document.addEventListener('click', e => { if(!e.target.closest('.search-wrap')) document.getElementById('si-dd').classList.remove('open'); });

function extractSerial(barcode, modelCode) {
  barcode = barcode.trim();
  if (!barcode) return '';
  if (modelCode && modelCode.startsWith('IP')) return barcode.slice(1);
  return barcode.length>=8 ? barcode.slice(barcode.length-8, barcode.length-1) : barcode;
}

function siGenRows() {
  const color=document.getElementById('si-color').value;
  const qty=parseInt(document.getElementById('si-qty').value)||1;
  if (!siModel) { toast('모델을 선택해주세요'); return; }
  if (!color) { toast('색상을 선택해주세요'); return; }
  const tbody=document.getElementById('si-tbody');
  const empty=tbody.querySelector('.empty');
  if (empty) empty.parentElement.remove();
  let firstInp=null;
  for (let i=0; i<qty; i++) {
    siRowNum++;
    const rn=siRowNum;
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td style="color:var(--text-hint);font-size:11px;font-weight:700;width:32px">${rn}</td>
      <td style="font-weight:700;font-size:13px">${siModel}</td>
      <td><span style="background:var(--primary-light);color:var(--primary-dark);font-size:12px;padding:3px 10px;border-radius:100px;font-weight:600">${color}</span></td>
      <td><input class="barcode-input" placeholder="바코드 스캔" data-brand="${siBrand}" data-row="${rn}" data-model="${siModel}" data-color="${color}"/></td>
      <td><input class="barcode-input" style="border-color:var(--orange);" placeholder="직접 입력" id="manual-${rn}" data-row="${rn}" oninput="siManual(this)"/></td>
      <td id="ser-${rn}" style="font-family:monospace;font-size:12px;color:var(--text-hint)">-</td>
      <td><span class="status-dot" id="dot-${rn}"></span></td>
      <td><button style="background:var(--red-bg);border:none;color:var(--red);cursor:pointer;font-size:14px;font-weight:700;padding:4px 10px;border-radius:6px;" onclick="this.closest('tr').remove();siUpdateStat()">×</button></td>
    `;
    tbody.insertBefore(tr, tbody.firstChild);
    const inp=tr.querySelector('.barcode-input');
    inp.addEventListener('keydown', e=>{if(e.key==='Enter'){e.preventDefault();siProcess(inp);}});
    inp.addEventListener('change', ()=>siProcess(inp));
    if (i===0) firstInp=inp;
  }
  siUpdateStat();
  toast(`✓ ${siModel} ${color} ${qty}개 생성`);
  document.getElementById('si-qty').value=1;
  if (firstInp) setTimeout(()=>firstInp.focus(), 100);
}

function siProcess(inp) {
  const val=inp.value.trim();
  if (!val) return;
  const serial=extractSerial(val, inp.dataset.model);
  const rn=inp.dataset.row;
  document.getElementById('ser-'+rn).innerHTML=`<span class="serial-ok">${serial}</span>`;
  document.getElementById('dot-'+rn).classList.add('done');
  inp.classList.add('scanned');
  siUpdateStat();
  const all=Array.from(document.querySelectorAll('.barcode-input'));
  const idx=all.indexOf(inp);
  for (let i=idx+1; i<all.length; i++) { if(!all[i].value){all[i].focus();break;} }
}

function siManual(inp) {
  const val = inp.value.trim();
  if (!val) return;
  const rn = inp.dataset.row;
  document.getElementById('ser-'+rn).innerHTML = `<span class="serial-ok">${val}</span>`;
  document.getElementById('dot-'+rn).classList.add('done');
  inp.style.borderColor = 'var(--green)';
  inp.style.background = 'var(--green-bg)';
  const barcodeInp = document.querySelector(`.barcode-input[data-row="${rn}"]`);
  if (barcodeInp) barcodeInp.dataset.manualSerial = val;
  siUpdateStat();
}

function siUpdateStat() {
  const total=document.querySelectorAll('#si-tbody tr:not(:has(.empty))').length;
  const done=document.querySelectorAll('#si-tbody .status-dot.done').length;
  document.getElementById('si-stat').textContent=`${total}개 · 완료 ${done}개`;
}

async function siSaveAll() {
  if (!canEdit('stock-in')) { toast('⚠️ 수정 권한이 없어요'); return; }
  const rows=document.querySelectorAll('#si-tbody tr:not(:has(.empty))');
  const total=rows.length;
  const done=document.querySelectorAll('#si-tbody .status-dot.done').length;
  if (!total) { toast('등록할 재고가 없어요'); return; }
  if (done===0) { toast('스캔된 항목이 없어요'); return; }
  if (done<total && !confirm(`미스캔 ${total-done}개 제외하고 ${done}개만 등록할까요?`)) return;
  const items=[];
  rows.forEach(tr=>{
    const serial=tr.querySelector('.serial-ok')?.textContent;
    const inp=tr.querySelector('.barcode-input');
    const siDate=document.getElementById('si-date').value||new Date().toISOString().split('T')[0];
    const manualSerial = inp?.dataset.manualSerial;
    const finalSerial = manualSerial || serial;
    if (finalSerial && inp?.dataset.model) items.push({model:inp.dataset.model, color:inp.dataset.color, serial_number:finalSerial, barcode:inp.value || null, stock_date:siDate});
  });
  const {error}=await sb.from('inventory').insert(items);
  if (error) { toast('오류: '+error.message); return; }
  await sb.from('stock_in').insert(items);
  toast(`✓ ${items.length}개 재고 등록 완료`);
  document.getElementById('si-tbody').innerHTML='<tr><td colspan="7" class="empty">모델 선택 후 행을 생성하세요</td></tr>';
  siRowNum=0;
  siUpdateStat();
  loadDashboard();
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openModal(id) { document.getElementById(id).classList.add('open'); }

// ─── 판매처/모델/요금제 드롭다운 ───
let partnerDdTarget = null;
const partnerDdEl = document.getElementById('partner-dd');

let modelDdTarget = null;
const modelDdEl = document.getElementById('model-dd');

let planDdTarget = null;
const planDdEl = document.getElementById('plan-dd');

document.addEventListener('click', e => {
  const isPopup = e.target.closest('#partner-dd, #model-dd, #plan-dd');
  if (!isPopup && e.target !== partnerDdTarget?.input) partnerDdEl.style.display='none';
  if (!isPopup && e.target !== modelDdTarget?.input) modelDdEl.style.display='none';
  if (!isPopup && e.target !== planDdTarget?.input) planDdEl.style.display='none';
});

function openPartnerDd(i, input) {
  partnerDdTarget = { i, input };
  const rect = input.getBoundingClientRect();
  partnerDdEl.style.top = (rect.bottom + 2) + 'px';
  partnerDdEl.style.left = Math.max(0, Math.min(rect.left, window.innerWidth - 220)) + 'px';
  partnerDdEl.style.display='block';
  const searchEl = document.getElementById('partner-dd-search');
  searchEl.value = '';
  filterPartnerDd('');
  setTimeout(() => searchEl.focus(), 50);
}

function filterPartnerDd(q) {
  const list = document.getElementById('partner-dd-list');
  const filtered = settlPartners.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  list.innerHTML = `<div class="model-dd-item" data-partner-name="">— 없음 —</div>` +
    filtered.map(p => `<div class="model-dd-item" data-partner-name="${p.name.replace(/"/g,'&quot;')}">${p.name}</div>`).join('');
  list.querySelectorAll('.model-dd-item').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      selectPartnerDd(el.dataset.partnerName);
    });
  });
}

async function selectPartnerDd(name) {
  if (!partnerDdTarget) return;
  const i = partnerDdTarget.i;
  partnerDdEl.style.display='none';
  const partner = name ? settlPartners.find(p => p.name === name) : null;
  const newPolicyType = partner?.partner_group || '';

  settlUpdate(i, 'seller', name || '');
  settlUpdate(i, 'policy_type', newPolicyType);
  settlRows[i].rebate = null;
  settlRows[i].face_price = null;
  settlRows[i].request_amount = null;
  settlRows[i].policy_total = null;

  const tr = document.querySelectorAll('#settl-tbody tr')[i];
  if (tr) {
    const upd = (field, val) => { const inp = tr.querySelector(`input[data-field="${field}"]`); if (inp) inp.value = val ?? ''; };
    upd('seller', name || '');
    upd('policy_type', newPolicyType);
    upd('rebate', '');
    upd('face_price', '');
    upd('request_amount', '');
    upd('policy_total', '');
  }

  if (name) {
    await settlAutoRebate(i); // 재계산 완료 후 저장
  } else {
    settlSaveRow(i, true);
  }
}

function clearPartnerDd(i, input) {
  settlUpdate(i, 'seller', '');
  settlUpdate(i, 'policy_type', '');
  settlRows[i].rebate = null;
  settlRows[i].face_price = null;
  settlRows[i].request_amount = null;
  settlRows[i].policy_total = null;

  const tr = document.querySelectorAll('#settl-tbody tr')[i];
  if (tr) {
    const upd = (field) => { const inp = tr.querySelector(`input[data-field="${field}"]`); if (inp) inp.value = ''; };
    upd('seller'); upd('policy_type'); upd('rebate'); upd('face_price'); upd('request_amount'); upd('policy_total');
  }
  settlSaveRow(i);
}

function partnerDdKey(e) {
  const items = document.querySelectorAll('#partner-dd-list .model-dd-item');
  const hl = document.querySelector('#partner-dd-list .model-dd-item.hl');
  let idx = Array.from(items).indexOf(hl);
  if (e.key === 'ArrowDown') idx = Math.min(idx+1, items.length-1);
  else if (e.key === 'ArrowUp') idx = Math.max(idx-1, 0);
  else if (e.key === 'Enter' && hl) { selectPartnerDd(hl.textContent); return; }
  else if (e.key === 'Escape') { partnerDdEl.style.display='none'; return; }
  items.forEach((it,i) => it.classList.toggle('hl', i===idx));
  if (items[idx]) items[idx].scrollIntoView({block:'nearest'});
}

function openModelDd(i, input) {
  modelDdTarget = { i, input };
  const rect = input.getBoundingClientRect();
  const left = Math.min(rect.left, window.innerWidth - 220);
  modelDdEl.style.top = (rect.bottom + 2) + 'px';
  modelDdEl.style.left = Math.max(0, left) + 'px';
  modelDdEl.style.display='block';
  const searchEl = document.getElementById('model-dd-search');
  searchEl.value = '';
  filterModelDd('');
  setTimeout(() => searchEl.focus(), 50);
}

function filterModelDd(q) {
  const list = document.getElementById('model-dd-list');
  const filtered = settlModels.filter(m => !q || m.code.toLowerCase().includes(q.toLowerCase()));
  list.innerHTML = `<div class="model-dd-item" data-model-code="">— 없음 —</div>` +
    filtered.map(m => `<div class="model-dd-item" data-model-code="${m.code}">${m.code}</div>`).join('');
  list.querySelectorAll('.model-dd-item').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      selectModelDd(el.dataset.modelCode);
    });
  });
}

function selectModelDd(code) {
  if (!modelDdTarget) return;
  const i = modelDdTarget.i;
  modelDdTarget.input.value = code;
  modelDdEl.style.display='none';
  settlUpdateModel(i, code); // settlUpdateModel 안에서 settlSaveRow 호출
}

function clearModelDd(i, input) { input.value = ''; settlUpdateModel(i, ''); }

function modelDdKey(e) {
  const items = document.querySelectorAll('.model-dd-item');
  const hl = document.querySelector('.model-dd-item.hl');
  let idx = Array.from(items).indexOf(hl);
  if (e.key === 'ArrowDown') idx = Math.min(idx+1, items.length-1);
  else if (e.key === 'ArrowUp') idx = Math.max(idx-1, 0);
  else if (e.key === 'Enter' && hl) { selectModelDd(hl.textContent); return; }
  else if (e.key === 'Escape') { modelDdEl.style.display='none'; return; }
  items.forEach((it,i) => it.classList.toggle('hl', i===idx));
  if (items[idx]) items[idx].scrollIntoView({block:'nearest'});
}

function openPlanDd(i, input) {
  planDdTarget = { i, input };
  const rect = input.getBoundingClientRect();
  planDdEl.style.top = (rect.bottom + 2) + 'px';
  planDdEl.style.left = Math.max(0, Math.min(rect.left, window.innerWidth - 220)) + 'px';
  planDdEl.style.display='block';
  const searchEl = document.getElementById('plan-dd-search');
  searchEl.value = '';
  filterPlanDd('');
  setTimeout(() => searchEl.focus(), 50);
}

function filterPlanDd(q) {
  const list = document.getElementById('plan-dd-list');
  const filtered = (settlPlans||[]).filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  list.innerHTML = `<div class="model-dd-item" data-plan-name="">— 없음 —</div>` +
    filtered.map(p => `<div class="model-dd-item" data-plan-name="${p.name.replace(/"/g,'&quot;')}">${p.name}</div>`).join('');
  list.querySelectorAll('.model-dd-item').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault(); // blur 방지
      selectPlanDd(el.dataset.planName);
    });
  });
}

function selectPlanDd(name) {
  if (!planDdTarget) return;
  const i = planDdTarget.i;
  planDdTarget.input.value = name;
  settlUpdate(i, 'plan', name);
  planDdEl.style.display='none';
  settlSaveRow(i);
  settlAutoCommonSub(i);
  settlAutoRebate(i);
  const plan = (settlPlans||[]).find(p => p.name === name);
  const pg = plan?.plan_group || '';
  const row = document.querySelectorAll('#settl-tbody tr')[i];
  if (row) { const pgCell = row.querySelector('.stl-plan-group'); if (pgCell) pgCell.textContent = pg; }
}

function clearPlanDd(i, input) {
  input.value = '';
  settlUpdate(i, 'plan', '');
  settlSaveRow(i);
  const row = document.querySelectorAll('#settl-tbody tr')[i];
  if (row) { const pgCell = row.querySelector('.stl-plan-group'); if (pgCell) pgCell.textContent = ''; }
}

function planDdKey(e) {
  const items = document.querySelectorAll('#plan-dd-list .model-dd-item');
  const hl = document.querySelector('#plan-dd-list .model-dd-item.hl');
  let idx = Array.from(items).indexOf(hl);
  if (e.key === 'ArrowDown') idx = Math.min(idx+1, items.length-1);
  else if (e.key === 'ArrowUp') idx = Math.max(idx-1, 0);
  else if (e.key === 'Enter' && hl) { selectPlanDd(hl.textContent); return; }
  else if (e.key === 'Escape') { planDdEl.style.display='none'; return; }
  items.forEach((it,i) => it.classList.toggle('hl', i===idx));
  if (items[idx]) items[idx].scrollIntoView({block:'nearest'});
}

// ─── 정산 관리 ───
let settlRows = [], tkeyData = [], settlModels = [], settlPartners = [], settlPlans = [], settlRowNum = 0;
let settlFocusedRow = null;   // 현재 내가 편집중인 행 index (Realtime 스킵용)
let settlChannel = null;      // Realtime 구독 채널

function settlSetStatus(msg, color) {
  const el = document.getElementById('settl-save-status');
  if (el) { el.textContent = msg; el.style.color = color || 'var(--text-hint)'; }
}

// 선택값에 따라 select 글자색 적용
const SETTL_COLOR_MAP = {'가입':'#1A202C','미가입':'#A6A6A6','대기':'#0EA5E9','대기후가입':'#C00000','URL발송':'#F59E0B','선약':'#0EA5E9','공통':'#1A202C'};

// ─── 정산 설정 (마스콜/T올케어/추가지원금 정책) ───
let settlSettings = {};      // { mascall_가입: 3000, ... }
let addPolicyRules = [];     // [{ id, model_code, min_add_sub, policy_amount }, ...]

async function loadSettlSettings() {
  const [{ data: settings }, { data: rules }] = await Promise.all([
    sb.from('settlement_settings').select('*'),
    sb.from('add_policy_rules').select('*').order('model_code'),
  ]);
  settlSettings = {};
  settings?.forEach(s => { settlSettings[s.key] = parseInt(s.value) || 0; });
  addPolicyRules = rules || [];
}

// 마스콜 금액 자동계산
function settlAutoMascall(i) {
  const r = settlRows[i];
  const key = r.mascall3 ? `mascall_${r.mascall3}` : null;
  const val = (key && settlSettings[key] !== undefined && r.mascall3 !== '미가입' && r.mascall3 !== 'URL발송')
    ? settlSettings[key] : '';
  settlRows[i].mascall = val;
  _settlSetField(i, 'mascall', val);
}

// T올케어 금액 자동계산
function settlAutoTallcare(i) {
  const r = settlRows[i];
  const key = r.tall ? `tallcare_${r.tall}` : null;
  const val = (key && settlSettings[key] !== undefined && r.tall !== '미가입' && r.tall !== 'URL발송')
    ? settlSettings[key] : '';
  settlRows[i].tallcare = val;
  _settlSetField(i, 'tallcare', val);
}

// 추가지원금 정책 자동계산 (MNP/MVNO MNP/기변 + 특정모델 + add_sub >= min_add_sub)
const ADD_POLICY_ACT_TYPES = ['MNP', 'MVNO MNP', '기변'];
function settlAutoAddPolicy(i) {
  const r = settlRows[i];
  let val = '';
  if (ADD_POLICY_ACT_TYPES.includes(r.act_type) && r.model) {
    const addSub = parseInt(String(r.add_sub ?? '0').replace(/,/g, '')) || 0;
    const rule = addPolicyRules.find(rule => rule.model_code === r.model && addSub >= rule.min_add_sub);
    if (rule) val = rule.policy_amount;
  }
  settlRows[i].add_policy = val;
  _settlSetField(i, 'add_policy', val);
}

// 특정 data-field input 값 직접 업데이트
function _settlSetField(i, field, val) {
  const row = document.querySelectorAll('#settl-tbody tr')[i];
  if (!row) return;
  const input = row.querySelector(`input[data-field="${field}"]`);
  if (input) {
    input.value = val !== '' && val !== null ? Number(val).toLocaleString() : '';
    applyNumColor(input, val);
  }
}

// 정산 설정 모달 열기
function ssetFilterModelDd(q) {
  const dd = document.getElementById('sset-model-dd');
  if (!dd) return;
  const filtered = settlModels.filter(m => !q || m.code.toLowerCase().includes(q.toLowerCase()));
  if (!filtered.length) { dd.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:var(--text-hint)">검색 결과 없음</div>'; dd.style.display = 'block'; return; }
  dd.innerHTML = filtered.map(m => `
    <div onmousedown="ssetSelectModel('${m.code}')"
      style="padding:9px 12px;font-size:12px;font-family:monospace;font-weight:600;cursor:pointer;color:${m.is_active!==false?'var(--text)':'var(--text-hint)'};border-bottom:1px solid var(--border-light)"
      onmouseover="this.style.background='var(--primary-light)'" onmouseout="this.style.background=''">
      ${m.code}${m.is_active===false?' <span style="font-size:10px;color:var(--text-hint)">(비활성)</span>':''}
    </div>`).join('');
  dd.style.display = 'block';
}

function ssetSelectModel(code) {
  document.getElementById('sset-policy-model-input').value = code;
  document.getElementById('sset-policy-model').value = code;
  document.getElementById('sset-model-dd').style.display = 'none';
}

document.addEventListener('click', e => {
  const dd = document.getElementById('sset-model-dd');
  const input = document.getElementById('sset-policy-model-input');
  if (dd && input && !dd.contains(e.target) && e.target !== input) dd.style.display = 'none';
});

async function openSettlSettingsModal() {
  if (!isSuperAdmin() && !canEdit('settlement_settings')) { toast('⚠️ 접근 권한이 없어요'); return; }
  await loadSettlSettings();
  const modal = document.getElementById('settl-settings-modal');

  // 마스콜/T올케어 설정 렌더
  const states = ['가입', '대기', '대기후가입'];
  document.getElementById('sset-mascall-body').innerHTML = states.map(s => `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <span style="font-size:13px;font-weight:600;color:var(--text);width:80px">${s}</span>
      <input type="number" id="sset-mascall-${s}" value="${settlSettings[`mascall_${s}`] ?? ''}"
        placeholder="0" style="width:120px;height:32px;border:1px solid var(--border);border-radius:6px;padding:0 10px;font-size:13px;text-align:right;font-family:inherit;background:var(--white);color:var(--text)"/>
      <span style="font-size:12px;color:var(--text-hint);margin-left:6px">원</span>
    </div>`).join('');

  document.getElementById('sset-tallcare-body').innerHTML = states.map(s => `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <span style="font-size:13px;font-weight:600;color:var(--text);width:80px">${s}</span>
      <input type="number" id="sset-tallcare-${s}" value="${settlSettings[`tallcare_${s}`] ?? ''}"
        placeholder="0" style="width:120px;height:32px;border:1px solid var(--border);border-radius:6px;padding:0 10px;font-size:13px;text-align:right;font-family:inherit;background:var(--white);color:var(--text)"/>
      <span style="font-size:12px;color:var(--text-hint);margin-left:6px">원</span>
    </div>`).join('');

  // 추가지원금 정책 규칙 렌더
  renderAddPolicyRules();

  modal.classList.add('open');
}

function renderAddPolicyRules() {
  const { data: models } = { data: settlModels };
  const tbody = document.getElementById('sset-policy-tbody');
  if (!addPolicyRules.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">등록된 규칙이 없어요</td></tr>';
    return;
  }
  tbody.innerHTML = addPolicyRules.map(r => `
    <tr>
      <td style="font-family:monospace;font-weight:700;color:var(--primary)">${r.model_code}</td>
      <td style="text-align:right">${Number(r.min_add_sub).toLocaleString()}원 이상</td>
      <td style="text-align:right;font-weight:700">${Number(r.policy_amount).toLocaleString()}원</td>
      <td style="text-align:center">
        <button class="btn btn-danger btn-sm" onclick="deleteAddPolicyRule('${r.id}')">삭제</button>
      </td>
    </tr>`).join('');
}

async function saveSettlSettings() {
  const states = ['가입', '대기', '대기후가입'];
  const upserts = [];
  states.forEach(s => {
    const mv = document.getElementById(`sset-mascall-${s}`)?.value;
    const tv = document.getElementById(`sset-tallcare-${s}`)?.value;
    if (mv !== '') upserts.push({ key: `mascall_${s}`, value: String(parseInt(mv) || 0) });
    if (tv !== '') upserts.push({ key: `tallcare_${s}`, value: String(parseInt(tv) || 0) });
  });
  if (upserts.length) {
    const { error } = await sb.from('settlement_settings').upsert(upserts, { onConflict: 'key' });
    if (error) { toast('저장 실패: ' + error.message); return; }
  }
  await loadSettlSettings();
  closeModal('settl-settings-modal');
  toast('✓ 설정 저장됨');
}

async function addAddPolicyRule() {
  const modelCode = document.getElementById('sset-policy-model').value.trim().toUpperCase();
  const minAddSub = parseInt(document.getElementById('sset-policy-min').value) || 0;
  const policyAmount = parseInt(document.getElementById('sset-policy-amt').value) || 0;
  if (!modelCode) { toast('모델코드를 입력해주세요'); return; }
  if (!minAddSub) { toast('최소 추가지원금을 입력해주세요'); return; }
  if (!policyAmount) { toast('정책 금액을 입력해주세요'); return; }
  const { error } = await sb.from('add_policy_rules').insert({ model_code: modelCode, min_add_sub: minAddSub, policy_amount: policyAmount });
  if (error) { toast('저장 실패: ' + error.message); return; }
  document.getElementById('sset-policy-model-input').value = '';
  document.getElementById('sset-policy-model').value = '';
  document.getElementById('sset-policy-min').value = '';
  document.getElementById('sset-policy-amt').value = '';
  await loadSettlSettings();
  renderAddPolicyRules();
  toast('✓ 규칙 추가됨');
}

async function deleteAddPolicyRule(id) {
  if (!confirm('이 규칙을 삭제할까요?')) return;
  const { error } = await sb.from('add_policy_rules').delete().eq('id', id);
  if (error) { toast('삭제 실패'); return; }
  addPolicyRules = addPolicyRules.filter(r => r.id !== id);
  renderAddPolicyRules();
  toast('✓ 삭제됨');
}

// 모델 + 요금제 + 약정유형(공통) 세가지 갖춰지면 공통지원금 자동 조회
async function settlAutoCommonSub(i, save = true) {
  const r = settlRows[i];
  if (!r.model || !r.plan || r.contract !== '공통') {
    if (settlRows[i].common_sub !== '') {
      settlRows[i].common_sub = '';
      if (save) {
        const rows = document.querySelectorAll('#settl-tbody tr');
        if (rows[i]) rows[i].innerHTML = buildSettlRow(i, settlRows[i]);
        applyAllSettlColors(); applySettlDupHighlight(); applyPresenceHighlight();
        settlSaveRow(i, true);
      }
    }
    return;
  }
  const plan = settlPlans.find(p => p.name === r.plan);
  if (!plan) return;
  const { data } = await sb.from('support_amount')
    .select('amount')
    .eq('model_code', r.model)
    .eq('plan_id', plan.id)
    .maybeSingle();
  const amount = data?.amount ?? '';
  settlRows[i].common_sub = amount;
  if (save) {
    const rows = document.querySelectorAll('#settl-tbody tr');
    if (rows[i]) rows[i].innerHTML = buildSettlRow(i, settlRows[i]);
    applyAllSettlColors(); applySettlDupHighlight(); applyPresenceHighlight();
    settlSaveRow(i, true);
    settlAutoInstallment(i);
  }
}
let _settlContractChanging = false;

async function settlContractChange(i, val, selectEl) {
  _settlContractChanging = true;
  _settlDirty.delete(i); // 기존 dirty 클리어
  settlUpdate(i, 'contract', val);
  applySettlSelectColor(selectEl);
  await settlAutoCommonSub(i, false);
  settlAutoAddPolicy(i);
  await settlAutoRebate(i, false);
  settlAutoInstallment(i);
  _settlContractChanging = false;
  settlSaveRow(i, true);
}
async function settlAutoRebate(i, save = true) {
  const r = settlRows[i];
  const [rebate, face, request] = await Promise.all([
    getPolicyRebate(r),
    getPolicyByLabel(r, '액면'),
    getPolicyByLabel(r, '요청'),
  ]);
  // null이 아닌 경우만 업데이트 (null이면 기존값 유지)
  if (rebate !== null) settlRows[i].rebate = rebate;
  if (face !== null) settlRows[i].face_price = face;
  if (request !== null) settlRows[i].request_amount = request;
  const faceVal = parseInt(String(settlRows[i].face_price ?? '').replace(/,/g,'')) || 0;
  const reqVal  = parseInt(String(settlRows[i].request_amount ?? '').replace(/,/g,'')) || 0;
  if (faceVal || reqVal) settlRows[i].policy_total = faceVal + reqVal;
  if (save) {
    const tr = document.querySelectorAll('#settl-tbody tr')[i];
    if (tr) {
      const upd = (field, val) => { const inp = tr.querySelector(`input[data-field="${field}"]`); if (inp) inp.value = fmtNum(val); };
      upd('rebate', settlRows[i].rebate);
      upd('face_price', settlRows[i].face_price);
      upd('request_amount', settlRows[i].request_amount);
      upd('policy_total', settlRows[i].policy_total);
    }
    settlSaveRow(i, true);
  }
}

// 할부원금 값만 업데이트 (리렌더 없이) - 입력 중 실시간 반영용
function settlCalcInstallment(i) {
  const r = settlRows[i];
  if (r.pay_type !== '할부') return;
  const price = r.model ? getSettlPrice(r.model) : 0;
  const common = parseInt(String(r.common_sub ?? '0').replace(/,/g, '')) || 0;
  const add = parseInt(String(r.add_sub ?? '0').replace(/,/g, '')) || 0;
  const val = price - common - add;
  settlRows[i].installment = val;
  // DOM에서 할부원금 input만 찾아서 값 업데이트
  const tr = document.querySelectorAll('#settl-tbody tr')[i];
  if (tr) {
    const inp = tr.cells[23]?.querySelector('input');
    if (inp) inp.value = val.toLocaleString();
  }
}

// 할부원금 자동계산: 할부일 때 = 출고가 - 공통지원금 - 추가지원금
function settlAutoInstallment(i) {
  const r = settlRows[i];
  if (r.pay_type === '할부') {
    const price = r.model ? getSettlPrice(r.model) : 0;
    const common = parseInt(String(r.common_sub ?? '0').replace(/,/g, '')) || 0;
    const add = parseInt(String(r.add_sub ?? '0').replace(/,/g, '')) || 0;
    settlRows[i].installment = price - common - add;
  } else {
    settlRows[i].installment = '';
  }
  const rows = document.querySelectorAll('#settl-tbody tr');
  if (rows[i]) {
    rows[i].innerHTML = buildSettlRow(i, settlRows[i]);
    applyAllSettlColors(); applySettlDupHighlight(); applyPresenceHighlight();
  }
  settlSaveRow(i, true);
}

// 마지막 데이터 행 뒤로 빈 행 10개 보장
function settlPadRows() {
  let lastDataPos = -1;
  for (let i = settlRows.length - 1; i >= 0; i--) {
    if (!settlIsEmpty(settlRows[i])) { lastDataPos = i; break; }
  }
  const neededLen = Math.max(10, lastDataPos + 1 + 10);
  while (settlRows.length < neededLen) settlRows.push({});
}
function applySettlSelectColor(sel) {
  const v = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text.trim() : '';
  const c = SETTL_COLOR_MAP[v] || '';
  sel.style.color = c;
  sel._c = c;
}
function applyAllSettlColors() {
  document.querySelectorAll('#settl-tbody .stl-color-select').forEach(sel => {
    const v = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text.trim() : '';
    const c = SETTL_COLOR_MAP[v] || '';
    sel.style.color = c;
    sel._c = c;
  });
}

// 개통유형 변경 시 유심여부 비활성 처리
function settlActTypeChange(i, val, selectEl) {
  settlUpdate(i, 'act_type', val);
  settlSaveRow(i);
  const row = document.querySelectorAll('#settl-tbody tr')[i];
  if (!row) return;
  // usim select는 act_type select로부터 3칸 뒤 (개통유형=8번째td, 유심=14번째td)
  const usimSelect = row.querySelector('select[onchange*="usim"]');
  if (usimSelect) {
    usimSelect.dataset.locked = (val === '기변') ? '1' : '';
    usimSelect.style.pointerEvents = (val === '기변') ? 'none' : '';
    usimSelect.style.opacity = (val === '기변') ? '0.35' : '1';
    if (val === '기변') { usimSelect.value = ''; settlUpdate(i, 'usim', ''); }
  }
}

// UUID 생성
function genId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8);
    return v.toString(16);
  });
}

// 행 하나를 DB payload로 변환
function settlToPayload(r, i) {
  if (!r._id) r._id = genId();
  return {
    id: r._id,
    row_order: i,
    svc_no: r.svc_no || null, tgate: r.tgate || null, policy: r.policy || null,
    act_date: r.act_date || null, seller: r.seller || null, policy_type: r.policy_type || null,
    act_type: r.act_type || null, customer: r.customer || null, birth: r.birth || null,
    phone: r.phone || null, model: r.model || null, serial: r.serial || null,
    usim: r.usim || null, plan: r.plan || null, mascall3: r.mascall3 || null,
    tall: r.tall || null, pay_type: r.pay_type || null, contract: r.contract || null,
    common_sub: parseInt(String(r.common_sub||'').replace(/,/g,''))||null,
    add_sub: parseInt(String(r.add_sub||'').replace(/,/g,''))||null,
    installment: parseInt(String(r.installment||'').replace(/,/g,''))||null,
    rebate: parseInt(String(r.rebate||'').replace(/,/g,''))||null,
    mascall: parseInt(String(r.mascall||'').replace(/,/g,''))||null,
    tallcare: parseInt(String(r.tallcare||'').replace(/,/g,''))||null,
    partner_settl: parseInt(String(r.partner_settl||'').replace(/,/g,''))||null,
    inspect: r.inspect || null, memo: r.memo || null, tkey: r.tkey || false,
  };
}

// DB row → settlRows 형태로 변환
function settlFromDB(r) {
  return {
    _id: r.id,
    svc_no: r.svc_no||'', tgate: r.tgate||'', policy: r.policy||'',
    act_date: r.act_date||'', seller: r.seller||'', policy_type: r.policy_type||'',
    act_type: r.act_type||'', customer: r.customer||'', birth: r.birth||'',
    phone: r.phone ? fmtPhone(r.phone) : '', model: r.model||'', serial: r.serial||'',
    usim: r.usim||'', plan: r.plan||'', mascall3: r.mascall3||'',
    tall: r.tall||'', pay_type: r.pay_type||'', contract: r.contract||'',
    common_sub: r.common_sub??'', add_sub: r.add_sub??'',
    installment: r.installment??'', rebate: r.rebate??'',
    mascall: r.mascall??'', tallcare: r.tallcare??'',
    add_policy: '', partner_settl: r.partner_settl??'',
    inspect: r.inspect||'', memo: r.memo||'', tkey: r.tkey||false,
    receipt_policy: r.receipt_policy??'', open_policy: r.open_policy??'',
    receipt_face: r.receipt_face??'', open_face: r.open_face??'',
    correction: r.correction??'', policy_total: r.policy_total??'',
    face_price: r.face_price??'', request_amount: r.request_amount??'',
  };
}

// 행이 비어있는지 확인
function settlIsEmpty(r) {
  return Object.entries(r).every(([k,v]) =>
    ['_id','matched','tkey','row_order'].includes(k) || v===''||v===null||v===undefined
  );
}

// 셀 blur 시 해당 행 저장
let settlLastSavedIds = new Map(); // id → 저장 횟수 추적

const _settlDirty = new Set(); // 변경된 행 인덱스

async function settlSaveRow(i, force = false) {
  if (!canEdit('settlement')) return;
  const r = settlRows[i];
  if (!r) return;
  if (settlIsEmpty(r) && !r._id) return;
  // dirty 표시된 행만 저장 (force면 무조건 저장)
  if (!force && !_settlDirty.has(i)) return;
  _settlDirty.delete(i);
  settlSetStatus('저장중...', 'var(--orange)');
  try {
    const payload = settlToPayload(r, i);
    settlLastSavedIds.set(payload.id, (settlLastSavedIds.get(payload.id) || 0) + 1);
    const { error } = await sb.from('settlements').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    settlSetStatus('✓ 저장됨', 'var(--green)');
    setTimeout(() => settlSetStatus('', ''), 2000);
    // 저장 후 자동계산 재적용 (Realtime 덮어쓰기 방어)
    settlAutoMascall(i);
    settlAutoTallcare(i);
    settlAutoAddPolicy(i);
    settlEnsureTrailingRow();
  } catch(e) {
    settlSetStatus('저장 실패 ✕', 'var(--red)');
    console.error('저장 오류:', e);
  }
}


// ─── Presence (다른 사람 셀 위치 표시) ───
const PRESENCE_COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#84CC16'];
const presenceState = {};       // { userId: { row, col, name, color } }
const presenceColorMap = {};    // { userId: color } - 한번 할당된 색상 고정
let presenceColorIdx = 0;

function getPresenceColor(userId) {
  if (!presenceColorMap[userId]) {
    presenceColorMap[userId] = PRESENCE_COLORS[presenceColorIdx % PRESENCE_COLORS.length];
    presenceColorIdx++;
  }
  return presenceColorMap[userId];
}

function applyPresenceHighlight() {
  // 기존 presence 표시 제거
  document.querySelectorAll('.presence-label').forEach(el => el.remove());
  document.querySelectorAll('td[data-presence]').forEach(td => {
    td.removeAttribute('data-presence');
    td.style.outline = '';
    td.style.outlineOffset = '';
  });
  // 현재 상태 반영
  const tbody = document.getElementById('settl-tbody');
  if (!tbody) return;
  Object.entries(presenceState).forEach(([userId, info]) => {
    if (userId === currentUser?.id) return; // 내 자신은 표시 안 함
    const tr = tbody.rows[info.row];
    if (!tr) return;
    const td = tr.cells[info.col];
    if (!td) return;
    td.setAttribute('data-presence', userId);
    td.style.outline = `2px solid ${info.color}`;
    td.style.outlineOffset = '-2px';
    // 이름 태그 (hover 시 표시 - CSS transition으로 제어)
    const tag = document.createElement('div');
    tag.className = 'presence-label';
    tag.textContent = info.name;
    tag.style.background = info.color;
    td.appendChild(tag);
  });
}

function broadcastPresence(row, col) {
  if (!presenceChannel || !currentUser) return;
  cancelClearPresence();
  presenceChannel.track({
    user_id: currentUser.id,
    name: currentUser.name || currentUser.email || '?',
    row, col,
  });
}

// 마우스 이동 기반 presence broadcast (구글시트 방식)
function initSettlMousePresence() {
  const tbody = document.getElementById('settl-tbody');
  if (!tbody || tbody._presenceInited) return;
  tbody._presenceInited = true;

  let _lastRow = -1, _lastCol = -1;

  tbody.addEventListener('mouseover', e => {
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.closest('tr');
    if (!tr) return;
    const row = tr.rowIndex; // tbody 기준 index
    const col = Array.from(tr.cells).indexOf(td);
    if (row === _lastRow && col === _lastCol) return;
    _lastRow = row; _lastCol = col;
    broadcastPresence(row, col);
  });

  tbody.addEventListener('mouseleave', () => {
    _lastRow = -1; _lastCol = -1;
    clearPresence();
  });
}

// ─── 구글시트식 클릭 모드 ───
function initSettlClickMode() {
  const tbody = document.getElementById('settl-tbody');
  if (!tbody || tbody._clickModeInited) return;

  const scroller = document.querySelector('.settl-table-card > div');

  function scrollToEl(el) {
    if (!scroller || !el) return;
    const elRect = el.getBoundingClientRect();
    const scrollRect = scroller.getBoundingClientRect();
    if (elRect.left < scrollRect.left + 80) {
      scroller.scrollLeft -= scrollRect.left + 80 - elRect.left;
    } else if (elRect.right > scrollRect.right - 44) {
      scroller.scrollLeft += elRect.right - (scrollRect.right - 44);
    }
  }
  tbody._clickModeInited = true;

  let _selectedTd = null;
  tbody._selectCell = null;

  function selectCell(td) {
    tbody._selectCell = selectCell;
    if (_selectedTd === td) return;
    if (_selectedTd) {
      _selectedTd.classList.remove('stl-selected');
      const prev = _selectedTd.querySelector('.stl-input.editing');
      if (prev) exitEditMode(prev, false);
    }
    _selectedTd = td;
    if (!td) return;
    const input = td.querySelector('.stl-input:not([readonly])');
    if (!input) { _selectedTd = null; return; }
    td.classList.add('stl-selected');
    input._origValue = input.value;
    input._overwrite = true;
    input.focus({ preventScroll: true });
    scrollToEl(input);
  }

  function enterEditMode(input) {
    if (input.readOnly || input.classList.contains('editing')) return;
    if (input._origValue === undefined) input._origValue = input.value;
    input.classList.add('editing');
  }

  function exitEditMode(input, cancel = false) {
    if (cancel && input._origValue !== undefined) {
      input.value = input._origValue;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    delete input._origValue;
    input.classList.remove('editing');
  }

  // 단일 클릭 → 셀 선택
  tbody.addEventListener('mousedown', e => {
    const input = e.target.closest('.stl-input');
    if (!input || input.readOnly) {
      if (_selectedTd) {
        _selectedTd.classList.remove('stl-selected');
        const prev = _selectedTd.querySelector('.stl-input.editing');
        if (prev) exitEditMode(prev, false);
        _selectedTd = null;
      }
      return;
    }
    const td = input.closest('td');
    if (!td) return;
    if (_selectedTd === td && input.classList.contains('editing')) return;
    e.preventDefault();
    selectCell(td);
  });

  // 더블클릭 → 편집 모드, 마우스 위치에 커서
  tbody.addEventListener('dblclick', e => {
    const input = e.target.closest('.stl-input');
    if (!input || input.readOnly) return;
    e.preventDefault();
    enterEditMode(input);
    input._overwrite = false;
    // input 내 마우스 X 위치로 커서 계산
    requestAnimationFrame(() => {
      const rect = input.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const val = input.value;
      // canvas로 각 글자 너비 측정해서 커서 위치 계산
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = getComputedStyle(input).font;
      let pos = val.length;
      for (let i = 0; i <= val.length; i++) {
        const w = ctx.measureText(val.substring(0, i)).width;
        const padLeft = parseFloat(getComputedStyle(input).paddingLeft) || 7;
        if (w + padLeft >= x) { pos = i; break; }
      }
      input.setSelectionRange(pos, pos);
    });
  });

  // 키 입력 핸들러 (tbody + document 통합)
  tbody.addEventListener('keydown', e => {
    const input = e.target.closest('.stl-input');
    if (!input) return;

    // Escape: 편집 중이면 취소 후 선택 상태, 선택 상태면 원래값 복원 후 선택 해제
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (input.classList.contains('editing')) {
        exitEditMode(input, true);
        input.focus();
      } else {
        if (input._origValue !== undefined) {
          input.value = input._origValue;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        selectCell(null);
      }
      return;
    }

    if (input.classList.contains('editing')) return; // 편집 중엔 기본 동작

    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','Enter'].includes(e.key)) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      enterEditMode(input);
      input.focus();
      document.execCommand('selectAll');
      document.execCommand('delete');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    // 출력 가능한 키 → 값 비우고 편집 모드 진입, 커서 끝으로
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      enterEditMode(input);
      input.focus();
      document.execCommand('selectAll');
      document.execCommand('delete');
      input._overwrite = false;
      requestAnimationFrame(() => {
        const l = input.value.length;
        input.setSelectionRange(l, l);
      });
    }
  });

  // 포커스 잃으면 편집 모드 해제
  tbody.addEventListener('focusout', e => {
    const input = e.target;
    if (!input.classList.contains('stl-input')) return;
    exitEditMode(input, false);
  });
}

let _presenceClearTimer = null;
function clearPresence() {
  if (!presenceChannel) return;
  // 다음 셀로 이동 시 바로 untrack하면 깜빡임 → 200ms 딜레이
  _presenceClearTimer = setTimeout(() => {
    presenceChannel.untrack();
  }, 200);
}

function cancelClearPresence() {
  if (_presenceClearTimer) { clearTimeout(_presenceClearTimer); _presenceClearTimer = null; }
}

// Realtime 구독 시작
let presenceChannel = null;

function settlSubscribe() {
  // postgres_changes 채널 (매번 재구독)
  if (settlChannel) sb.removeChannel(settlChannel);
  settlChannel = sb.channel('settlements-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'settlements' }, payload => {
      settlHandleRemoteChange('INSERT', payload.new);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settlements' }, payload => {
      settlHandleRemoteChange('UPDATE', payload.new);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'settlements' }, payload => {
      settlHandleRemoteChange('DELETE', payload.old);
    })
    .subscribe();
}

// Presence 채널 - 앱 시작 시 딱 한 번만 호출
function initPresence() {
  if (presenceChannel) return; // 이미 있으면 재생성 안 함
  presenceChannel = sb.channel('settlements-presence', { config: { presence: { key: currentUser?.id || 'anon' } } })
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      Object.keys(presenceState).forEach(k => delete presenceState[k]);
      Object.entries(state).forEach(([key, presences]) => {
        const p = presences[0];
        if (!p || key === currentUser?.id || p.row == null || p.col == null) return;
        const uid = p.user_id || key;
        presenceState[uid] = {
          row: p.row, col: p.col,
          name: p.name || '?',
          color: getPresenceColor(uid),
        };
      });
      applyPresenceHighlight();
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      if (key === currentUser?.id) return;
      const p = newPresences[0];
      if (!p || p.row == null || p.col == null) return;
      const uid = p.user_id || key;
      presenceState[uid] = {
        row: p.row, col: p.col,
        name: p.name || '?',
        color: getPresenceColor(uid),
      };
      applyPresenceHighlight();
    })
    .on('presence', { event: 'leave' }, ({ key }) => {
      const uid = Object.keys(presenceState).find(k => k === key) || key;
      delete presenceState[uid];
      applyPresenceHighlight();
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        presenceChannel.track({
          user_id: currentUser?.id,
          name: currentUser?.name || currentUser?.email || '?',
          row: null,
          col: null,
        });
      }
    });
}

// 다른 사람이 저장한 변경사항 반영
function settlHandleRemoteChange(event, data) {
  if (event === 'DELETE') {
    const idx = settlRows.findIndex(r => r._id === data.id);
    if (idx >= 0 && idx !== settlFocusedRow) {
      settlRows.splice(idx, 1);
      settlPadRows();
      renderSettlTable();
    }
    return;
  }
  const idx = settlRows.findIndex(r => r._id === data.id);
  // 내가 지금 편집중인 행만 스킵 (다른 사람 변경사항은 항상 반영)
  if (idx >= 0 && idx === settlFocusedRow) return;

  if (event === 'INSERT') {
    // row_order 위치에 삽입
    const pos = data.row_order ?? settlRows.length;
    if (idx < 0) {
      settlRows[pos] = settlFromDB(data);
      while (settlRows.length < 10) settlRows.push({});
      renderSettlTable();
    }
  } else if (event === 'UPDATE') {
    if (idx >= 0) {
      if (settlLastSavedIds.has(data.id)) {
        const cnt = settlLastSavedIds.get(data.id);
        if (cnt <= 1) settlLastSavedIds.delete(data.id);
        else settlLastSavedIds.set(data.id, cnt - 1);
        return;
      }
      const prevMatched = settlRows[idx].matched;
      settlRows[idx] = settlFromDB(data);
      settlRows[idx].matched = prevMatched; // matched는 DB에 없으니 기존값 유지
      // 자동계산 적용
      const r = settlRows[idx];
      const mascallKey = r.mascall3 ? `mascall_${r.mascall3}` : null;
      if (mascallKey && settlSettings[mascallKey] !== undefined && r.mascall3 !== '미가입' && r.mascall3 !== 'URL발송') settlRows[idx].mascall = settlSettings[mascallKey];
      const tallKey = r.tall ? `tallcare_${r.tall}` : null;
      if (tallKey && settlSettings[tallKey] !== undefined && r.tall !== '미가입' && r.tall !== 'URL발송') settlRows[idx].tallcare = settlSettings[tallKey];
      if (ADD_POLICY_ACT_TYPES.includes(r.act_type) && r.model) {
        const addSub = parseInt(String(r.add_sub ?? '0').replace(/,/g, '')) || 0;
        const rule = addPolicyRules.find(rule => rule.model_code === r.model && addSub >= rule.min_add_sub);
        settlRows[idx].add_policy = rule ? rule.policy_amount : '';
      } else {
        settlRows[idx].add_policy = '';
      }
      // 해당 행만 리렌더
      const tbody = document.getElementById('settl-tbody');
      if (tbody && tbody.rows[idx]) {
        tbody.rows[idx].innerHTML = buildSettlRow(idx, settlRows[idx]);
        applyAllSettlColors(); applySettlDupHighlight(); applyPresenceHighlight();
      }
    }
  }
}

async function loadSettlement() {
  // 행추가 버튼 불필요 (빈 행 10개 자동 유지) → 숨김
  const addRowBtn = document.querySelector('#page-settlement .btn-primary');
  if (addRowBtn) addRowBtn.style.display = 'none';
  const tkeyUploadLabel = document.querySelector('#page-settlement label.btn');
  if (tkeyUploadLabel) tkeyUploadLabel.style.display = canEdit('settlement') ? '' : 'none';
  // 정책 목록 로드
  await loadPolicyList();
  const tkeyPasteArea = document.getElementById('tkey-paste-area');
  if (tkeyPasteArea) {
    tkeyPasteArea.readOnly = !canEdit('settlement');
    tkeyPasteArea.style.opacity = canEdit('settlement') ? '1' : '0.4';
    tkeyPasteArea.placeholder = canEdit('settlement') ? '엑셀에서 T키 행을 복사(Ctrl+C) 후 여기에 붙여넣기(Ctrl+V) 하세요' : '보기 전용 - 수정 권한 없음';
  }
  // 설정 버튼: superadmin만 표시 (없으면 동적 생성)
  let settingsBtn = document.getElementById('settl-settings-btn');
  if (!settingsBtn) {
    const pageHeader = document.querySelector('#page-settlement .page-header');
    if (pageHeader) {
      pageHeader.style.display = 'flex';
      pageHeader.style.alignItems = 'center';
      pageHeader.style.justifyContent = 'space-between';
      settingsBtn = document.createElement('button');
      settingsBtn.id = 'settl-settings-btn';
      settingsBtn.className = 'btn btn-outline btn-sm';
      settingsBtn.innerHTML = '⚙️ 정산 설정';
      settingsBtn.onclick = openSettlSettingsModal;
      pageHeader.appendChild(settingsBtn);
    }
  }
  if (settingsBtn) settingsBtn.style.display = (isSuperAdmin() || canEdit('settlement_settings')) ? '' : 'none';
  const policyListBtn = document.getElementById('policy-list-btn');
  const showPolicy = isSuperAdmin() || canEdit('policy');
  if (policyListBtn) policyListBtn.style.display = showPolicy ? 'inline-flex' : 'none';
  const [{ data: models }, { data: partners }, { data: plans }, { data: saved }] = await Promise.all([
    sb.from('models').select('code, price').order('code'),
    sb.from('partners').select('name, partner_group').order('name'),
    sb.from('plans').select('id, name, monthly_fee, plan_group').eq('is_active', true).order('monthly_fee', {ascending: false}),
    sb.from('settlements').select('*').order('row_order'),
  ]);
  settlModels = models || [];
  settlPartners = partners || [];
  settlPlans = plans || [];
  await loadSettlSettings();

  if (saved && saved.length > 0) {
    settlRows = saved.map(r => settlFromDB(r));
    settlPadRows();
  } else {
    settlRows = Array.from({length: 10}, () => ({}));
  }
  renderSettlTable();

  // 일련번호+모델 있는 행 일괄 매칭 체크 (500개씩 청크)
  const rowsToCheck = settlRows.map((r, i) => ({ r, i })).filter(({ r }) => r.serial && r.model);
  if (rowsToCheck.length > 0) {
    const serials = [...new Set(rowsToCheck.map(({ r }) => r.serial))];
    const chunkSize = 500;
    const invData = [];
    for (let c = 0; c < serials.length; c += chunkSize) {
      const { data } = await sb.from('inventory').select('serial_number, model').in('serial_number', serials.slice(c, c + chunkSize));
      if (data) invData.push(...data);
    }
    const invSet = new Set(invData.map(x => `${x.model}||${x.serial_number}`));
    const tbody = document.querySelectorAll('#settl-tbody tr');
    rowsToCheck.forEach(({ r, i }) => {
      const matched = invSet.has(`${r.model}||${r.serial}`);
      settlRows[i].matched = matched;
      if (tbody[i]) {
        tbody[i].cells[1].innerHTML = matched ? '<span class="match-ok">✓</span>' : '<span class="match-no">✗</span>';
      }
    });
  }

  // 로드 후 전체 행 자동계산 일괄 적용 (렌더 없이 값만 계산 후 한번에 렌더)

  // 공통지원금 일괄 조회 (공통 계약인 행만)
  const commonRows = settlRows.map((r, i) => ({ r, i })).filter(({ r }) => !settlIsEmpty(r) && r.contract === '공통' && r.model && r.plan);
  if (commonRows.length > 0) {
    const planIds = [...new Set(commonRows.map(({ r }) => settlPlans.find(p => p.name === r.plan)?.id).filter(Boolean))];
    const modelCodes = [...new Set(commonRows.map(({ r }) => r.model))];
    const { data: supportData } = await sb.from('support_amount')
      .select('model_code, plan_id, amount')
      .in('model_code', modelCodes)
      .in('plan_id', planIds);
    const supportMap = {};
    (supportData || []).forEach(s => { supportMap[`${s.model_code}||${s.plan_id}`] = s.amount; });
    commonRows.forEach(({ r, i }) => {
      const plan = settlPlans.find(p => p.name === r.plan);
      if (!plan) return;
      const amount = supportMap[`${r.model}||${plan.id}`] ?? '';
      settlRows[i].common_sub = amount; // 로드 시점엔 저장 없이 값만 세팅
    });
  }

  settlRows.forEach((r, i) => {
    if (settlIsEmpty(r)) return;
    // 판매처 기준 정산그룹 자동채우기
    if (r.seller) {
      const partner = settlPartners.find(p => p.name === r.seller);
      if (partner?.partner_group && r.policy_type !== partner.partner_group) {
        settlRows[i].policy_type = partner.partner_group;
        settlSaveRow(i);
      }
    } else if (r.policy_type) {
      // 판매처 없는데 정산그룹 있으면 클리어
      settlRows[i].policy_type = '';
      settlSaveRow(i);
    }
    // 마스콜
    const mascallKey = r.mascall3 ? `mascall_${r.mascall3}` : null;
    if (mascallKey && settlSettings[mascallKey] !== undefined && r.mascall3 !== '미가입' && r.mascall3 !== 'URL발송') {
      settlRows[i].mascall = settlSettings[mascallKey];
    }
    // T올케어
    const tallKey = r.tall ? `tallcare_${r.tall}` : null;
    if (tallKey && settlSettings[tallKey] !== undefined && r.tall !== '미가입' && r.tall !== 'URL발송') {
      settlRows[i].tallcare = settlSettings[tallKey];
    }
    // 추가지원금 정책
    if (ADD_POLICY_ACT_TYPES.includes(r.act_type) && r.model) {
      const addSub = parseInt(String(r.add_sub ?? '0').replace(/,/g, '')) || 0;
      const rule = addPolicyRules.find(rule => rule.model_code === r.model && addSub >= rule.min_add_sub);
      if (rule) settlRows[i].add_policy = rule.policy_amount;
    }
    // 할부원금
    if (r.pay_type === '할부') {
      const price = r.model ? getSettlPrice(r.model) : 0;
      const common = parseInt(String(r.common_sub ?? '0').replace(/,/g, '')) || 0;
      const add = parseInt(String(r.add_sub ?? '0').replace(/,/g, '')) || 0;
      settlRows[i].installment = price - common - add;
    }
    // 정책은 렌더링 시 tgate 기준으로 실시간 계산 (DB 저장 안함)

  });
  // 리베이트/액면/요청 일괄 계산 (메모리만, DB 저장 없음) → 완료 후 렌더
  await Promise.all(settlRows.map(async (r, i) => {
    if (settlIsEmpty(r)) return;
    const [rebate, face, request] = await Promise.all([
      getPolicyRebate(r),
      getPolicyByLabel(r, '액면'),
      getPolicyByLabel(r, '요청'),
    ]);
    if (rebate !== null) settlRows[i].rebate = rebate;
    if (face !== null) settlRows[i].face_price = face;
    if (request !== null) settlRows[i].request_amount = request;
    // 정책총액 = 액면 + 요청 자동계산
    const faceVal = parseInt(String(settlRows[i].face_price ?? '').replace(/,/g,'')) || 0;
    const reqVal  = parseInt(String(settlRows[i].request_amount ?? '').replace(/,/g,'')) || 0;
    if (faceVal || reqVal) settlRows[i].policy_total = faceVal + reqVal;
  }));
  renderSettlTable();
  settlSubscribe();
}

async function settlClearAll() {
  if (!confirm('정산 데이터를 전체 초기화할까요?\n이 작업은 되돌릴 수 없어요.')) return;
  const ids = settlRows.filter(r => r._id).map(r => r._id);
  settlRows = Array.from({length: 10}, () => ({}));
  renderSettlTable();
  if (ids.length) await sb.from('settlements').delete().in('id', ids);
  toast('✓ 초기화 완료');
}

function getSettlPrice(modelCode) {
  const m = settlModels.find(x => x.code === modelCode);
  return m?.price || 0;
}

function fmtPhone(v) {
  const d = v.replace(/\D/g,'');
  if (d.length===11) return d.replace(/(\d{3})(\d{4})(\d{4})/,'$1-$2-$3');
  if (d.length===10) return d.replace(/(\d{3})(\d{3})(\d{4})/,'$1-$2-$3');
  return v;
}

function fmtNum(v) { return v !== '' && v !== null && v !== undefined && !isNaN(Number(String(v).replace(/,/g,''))) ? Number(String(v).replace(/,/g,'')).toLocaleString() : ''; }
function numStyle(v) { const n = Number(String(v ?? '').replace(/,/g,'')); return (!isNaN(n) && n < 0) ? 'color:var(--red)' : ''; }
function applyNumColor(inp, v) { if (inp) inp.style.color = (Number(String(v??'').replace(/,/g,'')) < 0) ? 'var(--red)' : ''; }
function parseNum(v) { return String(v).replace(/,/g,''); }

function buildSettlRow(i, r) {
  const matchBadge = r.matched === true ? '<span class="match-ok">✓</span>' : r.matched === false ? '<span class="match-no">✗</span>' : '';
  const price = r.model ? getSettlPrice(r.model) : 0;
  const autoSvc = '';
  const actDisplay = r.act_date ? (() => { const d = new Date(r.act_date+'T00:00:00'); return `${d.getMonth()+1}/${d.getDate()}`; })() : '';
  const L = 'background:#F7FAFF !important;color:var(--text-sub);cursor:default;';
  const LTD = 'background:#F7FAFF !important;';
  const editable = canEdit('settlement');
  const fb = editable ? `onfocus="settlFocus(${i},this)" onblur="settlBlur(${i})"` : 'readonly style="cursor:default"';
  const fbs = editable ? `onfocus="settlFocus(${i},this)"` : '';
  return `
    <td class="stl-td" style="position:sticky;left:0;background:#fff;z-index:1;font-size:11px;color:#94A3B8;font-weight:700;text-align:center;width:28px;min-width:28px;max-width:28px">${i+1}</td>
    <td class="stl-td" style="text-align:center;width:36px;min-width:36px;max-width:36px;${LTD}">${matchBadge}</td>
    <td class="stl-td" style="width:50px;min-width:50px;max-width:50px;${LTD}"><input class="stl-input ${autoSvc}" value="${r.svc_no||''}" readonly style="${L}"/></td>
    <td class="stl-td" style="width:110px;min-width:110px;max-width:110px;${LTD}"><input class="stl-input ${autoSvc}" value="${r.tgate||''}" readonly style="${L}"/></td>
    <td class="stl-td" style="width:45px;min-width:45px;max-width:45px;${LTD}"><input class="stl-input" value="${r.tgate ? (getPolicyDataByDate(r.tgate)?.policy_name || '') : ''}" readonly style="${L}"/></td>
    <td class="stl-td" style="width:60px;min-width:60px;max-width:60px;${LTD}"><input class="stl-input" data-field="policy_type" value="${r.policy_type||''}" readonly style="${L}"/></td>
    <td class="stl-td" style="width:45px;min-width:45px;max-width:45px;background:#F7FAFF !important;${editable?'cursor:pointer;':''}text-align:center" ${editable ? `onclick="this.querySelector('input[type=date]').showPicker()" ` : ''}>
      <span style="font-size:12px;pointer-events:none;color:#64748B">${actDisplay}</span>
      <input type="date" value="${r.act_date||''}" style="width:0;height:0;opacity:0;position:absolute;pointer-events:none" ${editable ? `
        onchange="settlFocus(${i});settlUpdate(${i},'act_date',this.value);const d=this.value?new Date(this.value+'T00:00:00'):null;this.closest('td').querySelector('span').textContent=d?(d.getMonth()+1)+'/'+d.getDate():'';settlSaveRow(${i}, true)"
        onblur="const v=this.value;const prev=settlRows[${i}]?.act_date||'';if(v!==prev){settlFocus(${i});settlUpdate(${i},'act_date',v);const d=v?new Date(v+'T00:00:00'):null;this.closest('td').querySelector('span').textContent=d?(d.getMonth()+1)+'/'+d.getDate():'';settlSaveRow(${i});}"
      ` : 'disabled'}/>
    </td>
    <td class="stl-td" style="width:100px;min-width:100px;max-width:100px"><input class="stl-input" data-field="seller" value="${r.seller||''}" readonly ${editable ? `onclick="openPartnerDd(${i},this)" onkeydown="if(event.key==='Delete'||event.key==='Backspace')clearPartnerDd(${i},this)" style="cursor:pointer"` : 'style="cursor:default"'}/></td>
    <td class="stl-td" style="width:80px;min-width:80px;max-width:80px">
      <select class="stl-select" ${editable ? `${fbs} onchange="settlActTypeChange(${i},this.value,this);settlAutoRebate(${i})"` : 'disabled'}>
        <option value=""></option>
        <option ${r.act_type==='MNP'?'selected':''}>MNP</option>
        <option ${r.act_type==='MVNO MNP'?'selected':''}>MVNO MNP</option>
        <option ${r.act_type==='기변'?'selected':''}>기변</option>
        <option ${r.act_type==='010신규'?'selected':''}>010신규</option>
      </select>
    </td>
    <td class="stl-td" style="width:60px;min-width:60px;max-width:60px"><input class="stl-input" value="${r.customer||''}" ${fb} oninput="settlUpdate(${i},'customer',this.value);applySettlDupHighlight()"/></td>
    <td class="stl-td" style="width:60px;min-width:60px;max-width:60px"><input class="stl-input" value="${r.birth||''}" maxlength="6" ${fb} oninput="settlUpdate(${i},'birth',this.value)"/></td>
    <td class="stl-td" style="width:100px;min-width:100px;max-width:100px"><input class="stl-input" value="${r.phone ? fmtPhone(r.phone) : ''}" ${editable ? `onfocus="settlFocus(${i},this)"` : 'readonly style="cursor:default"'} oninput="settlUpdate(${i},'phone',this.value);applySettlDupHighlight()" onblur="settlBlur(${i});this.value=fmtPhone(this.value);settlUpdate(${i},'phone',this.value);applySettlDupHighlight()"/></td>
    <td class="stl-td" style="width:70px;min-width:70px;max-width:70px"><input class="stl-input" value="${r.model||''}" readonly ${editable ? `onclick="settlFocus(${i});openModelDd(${i},this)" onkeydown="if(event.key==='Delete'||event.key==='Backspace')clearModelDd(${i},this)" style="cursor:pointer;font-family:monospace"` : 'style="cursor:default;font-family:monospace"'}/></td>
    <td class="stl-td" style="width:80px;min-width:80px;max-width:80px"><input class="stl-input" value="${r.serial||''}" ${editable ? `onfocus="settlFocus(${i},this);this._orig=this.value" onblur="settlBlur(${i});if(this.value!==this._orig)settlUpdateSerial(${i},this.value)"` : 'readonly style="cursor:default"'} oninput="settlUpdate(${i},'serial',this.value)" style="font-family:monospace"/></td>
    <td class="stl-td" style="width:45px;min-width:45px;max-width:45px">
      <select class="stl-select" ${editable ? `${fbs} onchange="settlUpdate(${i},'usim',this.value);settlSaveRow(${i}, true)"` : 'disabled'} ${r.act_type==='기변'?'data-locked="1" style="pointer-events:none;opacity:0.35"':''}>
        <option value=""></option>
        <option ${r.usim==='유심'?'selected':''}>유심</option>
        <option ${r.usim==='ESIM'?'selected':''}>ESIM</option>
      </select>
    </td>
    <td class="stl-td" style="width:100px;min-width:100px;max-width:100px"><input class="stl-input" value="${r.plan||''}" readonly ${editable ? `onclick="settlFocus(${i});openPlanDd(${i},this)" onkeydown="if(event.key==='Delete'||event.key==='Backspace')clearPlanDd(${i},this)" style="cursor:pointer"` : 'style="cursor:default"'}/></td>
    <td class="stl-td" style="width:75px;min-width:75px;max-width:75px">
      <select class="stl-select stl-color-select" style="color:${SETTL_COLOR_MAP[r.mascall3]||''}" onfocus="this._c=this.style.color;this.style.color=''" onblur="this.style.color=this._c||''" ${editable ? `${fbs} onchange="settlUpdate(${i},'mascall3',this.value);settlSaveRow(${i}, true);applySettlSelectColor(this);settlAutoMascall(${i})"` : 'disabled'}>
        <option value=""></option>
        <option ${r.mascall3==='가입'?'selected':''}>가입</option>
        <option ${r.mascall3==='미가입'?'selected':''}>미가입</option>
        <option ${r.mascall3==='대기'?'selected':''}>대기</option>
        <option ${r.mascall3==='대기후가입'?'selected':''}>대기후가입</option>
        <option ${r.mascall3==='URL발송'?'selected':''}>URL발송</option>
      </select>
    </td>
    <td class="stl-td" style="width:60px;min-width:60px;max-width:60px">
      <select class="stl-select stl-color-select" style="color:${SETTL_COLOR_MAP[r.tall]||''}" onfocus="this._c=this.style.color;this.style.color=''" onblur="this.style.color=this._c||''" ${editable ? `${fbs} onchange="settlUpdate(${i},'tall',this.value);settlSaveRow(${i}, true);applySettlSelectColor(this);settlAutoTallcare(${i})"` : 'disabled'}>
        <option value=""></option>
        <option ${r.tall==='가입'?'selected':''}>가입</option>
        <option ${r.tall==='미가입'?'selected':''}>미가입</option>
        <option ${r.tall==='대기'?'selected':''}>대기</option>
        <option ${r.tall==='대기후가입'?'selected':''}>대기후가입</option>
        <option ${r.tall==='URL발송'?'selected':''}>URL발송</option>
      </select>
    </td>
    <td class="stl-td" style="width:80px;min-width:80px;max-width:80px;${LTD}"><input class="stl-input" value="${price ? price.toLocaleString() : ''}" readonly style="${L}"/></td>
    <td class="stl-td" style="width:45px;min-width:45px;max-width:45px">
      <select class="stl-select" ${editable ? `${fbs} onchange="settlUpdate(${i},'pay_type',this.value);settlAutoInstallment(${i})"` : 'disabled'}>
        <option value=""></option>
        <option ${r.pay_type==='일시납'?'selected':''}>일시납</option>
        <option ${r.pay_type==='할부'?'selected':''}>할부</option>
      </select>
    </td>
    <td class="stl-td" style="width:45px;min-width:45px;max-width:45px">
      <select class="stl-select stl-color-select" style="color:${SETTL_COLOR_MAP[r.contract]||''}" onfocus="this._c=this.style.color;this.style.color=''" onblur="this.style.color=this._c||''" ${editable ? `${fbs} onchange="settlContractChange(${i},this.value,this)"` : 'disabled'}>
        <option value=""></option>
        <option ${r.contract==='공통'?'selected':''}>공통</option>
        <option ${r.contract==='선약'?'selected':''}>선약</option>
      </select>
    </td>
    <td class="stl-td" style="width:50px;min-width:50px;max-width:50px;${LTD}"><input class="stl-input" value="${fmtNum(r.common_sub)}" readonly style="${L};color:${numStyle(r.common_sub) ? 'var(--red)' : ''}"/></td>
    <td class="stl-td" style="width:50px;min-width:50px;max-width:50px"><input class="stl-input" value="${fmtNum(r.add_sub)}" style="${numStyle(r.add_sub)}" ${fb} oninput="settlUpdate(${i},'add_sub',parseNum(this.value));applyNumColor(this,parseNum(this.value));settlCalcInstallment(${i})" onfocus="settlFocus(${i});this.value=parseNum(this.value)" onblur="settlUpdate(${i},'add_sub',parseNum(this.value));settlAutoAddPolicy(${i});settlAutoInstallment(${i});settlBlur(${i});this.value=fmtNum(settlRows[${i}].add_sub)"/></td>
    <td class="stl-td" style="width:50px;min-width:50px;max-width:50px;${LTD}"><input class="stl-input" value="${fmtNum(r.installment)}" readonly style="${L};color:${numStyle(r.installment) ? 'var(--red)' : ''}"/></td>
    <td class="stl-td" style="width:50px;min-width:50px;max-width:50px;${LTD}"><input class="stl-input" data-field="rebate" value="${fmtNum(r.rebate)}" style="${numStyle(r.rebate)}" readonly style="${L};color:${numStyle(r.rebate) ? 'var(--red)' : ''}"/></td>
    <td class="stl-td" style="width:65px;min-width:65px;max-width:65px"><input class="stl-input" data-field="mascall" value="${fmtNum(r.mascall)}" oninput="settlUpdate(${i},'mascall',parseNum(this.value));applyNumColor(this,parseNum(this.value))" onfocus="settlFocus(${i});this.value=parseNum(this.value)" onblur="settlBlur(${i});this.value=fmtNum(this.value)"/></td>
    <td class="stl-td" style="width:65px;min-width:65px;max-width:65px"><input class="stl-input" data-field="tallcare" value="${fmtNum(r.tallcare)}" oninput="settlUpdate(${i},'tallcare',parseNum(this.value));applyNumColor(this,parseNum(this.value))" onfocus="settlFocus(${i});this.value=parseNum(this.value)" onblur="settlBlur(${i});this.value=fmtNum(this.value)"/></td>
    <td class="stl-td" style="width:65px;min-width:65px;max-width:65px;${LTD}"><input class="stl-input" data-field="add_policy" value="${fmtNum(r.add_policy)}" style="${numStyle(r.add_policy)}" readonly style="${L};color:${numStyle(r.add_policy) ? 'var(--red)' : ''}"/></td>
    <td class="stl-td" style="width:65px;min-width:65px;max-width:65px;${LTD}"><input class="stl-input" data-field="partner_settl" value="${fmtNum(r.partner_settl)}" style="${numStyle(r.partner_settl)}" readonly style="${L};color:${numStyle(r.partner_settl) ? 'var(--red)' : ''}"/></td>
    <td class="stl-td" style="width:40px;min-width:40px;max-width:40px">
      <select class="stl-select" ${editable ? `${fbs} onchange="settlUpdate(${i},'inspect',this.value);settlSaveRow(${i}, true)"` : 'disabled'}>
        <option value=""></option>
        <option ${r.inspect==='O'?'selected':''}>O</option>
        <option ${r.inspect==='X'?'selected':''}>X</option>
      </select>
    </td>
    <td class="stl-td" style="width:100px;min-width:100px;max-width:100px"><input class="stl-input" value="${r.memo||''}" ${fb} oninput="settlUpdate(${i},'memo',this.value)"/></td>
    <td class="stl-td" style="width:70px;min-width:70px;max-width:70px;text-align:center;background:var(--purple-bg)"><span class="stl-plan-group" style="font-size:11px;font-weight:700;color:var(--purple)">${(()=>{const _p=settlPlans.find(p=>p.name===r.plan);return _p?.plan_group||'';})()}</span></td>
    <td class="stl-td" style="width:70px;min-width:70px;max-width:70px"><input class="stl-input" value="${fmtNum(r.receipt_policy)}" style="${numStyle(r.receipt_policy)}" ${fb} oninput="settlUpdate(${i},'receipt_policy',parseNum(this.value));applyNumColor(this,parseNum(this.value))" onfocus="settlFocus(${i});this.value=parseNum(this.value)" onblur="settlBlur(${i});this.value=fmtNum(settlRows[${i}].receipt_policy)"/></td>
    <td class="stl-td" style="width:70px;min-width:70px;max-width:70px"><input class="stl-input" value="${fmtNum(r.open_policy)}" style="${numStyle(r.open_policy)}" ${fb} oninput="settlUpdate(${i},'open_policy',parseNum(this.value));applyNumColor(this,parseNum(this.value))" onfocus="settlFocus(${i});this.value=parseNum(this.value)" onblur="settlBlur(${i});this.value=fmtNum(settlRows[${i}].open_policy)"/></td>
    <td class="stl-td" style="width:70px;min-width:70px;max-width:70px"><input class="stl-input" value="${fmtNum(r.receipt_face)}" style="${numStyle(r.receipt_face)}" ${fb} oninput="settlUpdate(${i},'receipt_face',parseNum(this.value));applyNumColor(this,parseNum(this.value))" onfocus="settlFocus(${i});this.value=parseNum(this.value)" onblur="settlBlur(${i});this.value=fmtNum(settlRows[${i}].receipt_face)"/></td>
    <td class="stl-td" style="width:70px;min-width:70px;max-width:70px"><input class="stl-input" value="${fmtNum(r.open_face)}" style="${numStyle(r.open_face)}" ${fb} oninput="settlUpdate(${i},'open_face',parseNum(this.value));applyNumColor(this,parseNum(this.value))" onfocus="settlFocus(${i});this.value=parseNum(this.value)" onblur="settlBlur(${i});this.value=fmtNum(settlRows[${i}].open_face)"/></td>
    <td class="stl-td" style="width:60px;min-width:60px;max-width:60px"><input class="stl-input" value="${fmtNum(r.correction)}" style="${numStyle(r.correction)}" ${fb} oninput="settlUpdate(${i},'correction',parseNum(this.value));applyNumColor(this,parseNum(this.value))" onfocus="settlFocus(${i});this.value=parseNum(this.value)" onblur="settlBlur(${i});this.value=fmtNum(settlRows[${i}].correction)"/></td>
    <td class="stl-td" style="width:70px;min-width:70px;max-width:70px"><input class="stl-input" data-field="policy_total" value="${fmtNum(r.policy_total)}" style="${numStyle(r.policy_total)}" ${fb} oninput="settlUpdate(${i},'policy_total',parseNum(this.value));applyNumColor(this,parseNum(this.value))" onfocus="settlFocus(${i});this.value=parseNum(this.value)" onblur="settlBlur(${i});this.value=fmtNum(settlRows[${i}].policy_total)"/></td>
    <td class="stl-td" style="width:70px;min-width:70px;max-width:70px"><input class="stl-input" data-field="face_price" value="${fmtNum(r.face_price)}" style="${numStyle(r.face_price)}" ${fb} oninput="settlUpdate(${i},'face_price',parseNum(this.value));applyNumColor(this,parseNum(this.value))" onfocus="settlFocus(${i});this.value=parseNum(this.value)" onblur="settlBlur(${i});this.value=fmtNum(settlRows[${i}].face_price)"/></td>
    <td class="stl-td" style="width:70px;min-width:70px;max-width:70px"><input class="stl-input" data-field="request_amount" value="${fmtNum(r.request_amount)}" style="${numStyle(r.request_amount)}" ${fb} oninput="settlUpdate(${i},'request_amount',parseNum(this.value));applyNumColor(this,parseNum(this.value))" onfocus="settlFocus(${i});this.value=parseNum(this.value)" onblur="settlBlur(${i});this.value=fmtNum(settlRows[${i}].request_amount)"/></td>
    <td class="stl-td" style="text-align:center;width:28px;min-width:28px;max-width:28px">${editable ? `<button style="background:none;border:none;color:var(--text-hint);cursor:pointer;font-size:16px;padding:0 4px" onclick="settlRemoveRow(${i})">×</button>` : ''}</td>
  `;
}

// 중복 하이라이트 - td 인덱스 기준 (고정 컬럼 순서)
// 0:번호 1:매칭 2:svc_no 3:tgate 4:policy 5:policy_type 6:act_date 7:seller 8:act_type
// 9:customer 10:birth 11:phone 12:model 13:serial ...
const SETTL_DUP_COL = { model: 12, serial: 13, phone: 11, customer: 9 };
let _dupHighlightPending = false;
function applySettlDupHighlight() {
  if (_dupHighlightPending) return;
  _dupHighlightPending = true;
  requestAnimationFrame(() => {
    _dupHighlightPending = false;
    const tbody = document.getElementById('settl-tbody');
    if (!tbody) return;

    // 중복 키 계산
    const dupKeys = new Set(), dupSet = new Set();
    const phoneDupKeys = new Set(), phoneSet = new Set();
    const customerDupKeys = new Set(), customerSet = new Set();
    settlRows.forEach(r => {
      if (r.model && r.serial) {
        const k = r.model + '||' + r.serial;
        if (dupSet.has(k)) dupKeys.add(k); else dupSet.add(k);
      }
      if (r.phone) { if (phoneSet.has(r.phone)) phoneDupKeys.add(r.phone); else phoneSet.add(r.phone); }
      if (r.customer) { if (customerSet.has(r.customer)) customerDupKeys.add(r.customer); else customerSet.add(r.customer); }
    });

    [...tbody.rows].forEach((tr, i) => {
      const r = settlRows[i];
      if (!r) return;
      const tds = tr.cells;
      const isDup = r.model && r.serial && dupKeys.has(r.model + '||' + r.serial);
      const isPhoneDup = r.phone && phoneDupKeys.has(r.phone);
      const isCustomerDup = r.customer && customerDupKeys.has(r.customer);
      if (tds[SETTL_DUP_COL.model]) tds[SETTL_DUP_COL.model].classList.toggle('stl-dup', !!isDup);
      if (tds[SETTL_DUP_COL.serial]) tds[SETTL_DUP_COL.serial].classList.toggle('stl-dup', !!isDup);
      if (tds[SETTL_DUP_COL.phone]) tds[SETTL_DUP_COL.phone].classList.toggle('stl-dup', !!isPhoneDup);
      if (tds[SETTL_DUP_COL.customer]) tds[SETTL_DUP_COL.customer].classList.toggle('stl-dup', !!isCustomerDup);
    });
  });
}

function renderSettlTable() {
  const tbody = document.getElementById('settl-tbody');
  if (!settlRows.length) { tbody.innerHTML = '<tr><td colspan="32" class="empty">행 추가 또는 T키 파일을 업로드하세요</td></tr>'; return; }
  tbody.innerHTML = settlRows.map((r, i) => `<tr>${buildSettlRow(i, r)}</tr>`).join('');
  applyAllSettlColors(); applySettlDupHighlight(); applyPresenceHighlight();
  initSettlArrowKeys();
  initSettlDragScroll();
  initSettlMousePresence();
  initSettlClickMode();
}

function initSettlDragScroll() {
  const scroller = document.querySelector('.settl-table-card > div');
  if (!scroller || scroller._dragInited) return;
  scroller._dragInited = true;

  let isDown = false, startX, scrollLeft, moved = false;

  document.addEventListener('pointerdown', e => {
    if (!scroller.contains(e.target)) return;
    isDown = true; moved = false;
    startX = e.clientX;
    scrollLeft = scroller.scrollLeft;
  });

  document.addEventListener('pointermove', e => {
    if (!isDown) return;
    const dist = e.clientX - startX;
    if (Math.abs(dist) > 8) {
      moved = true;
      scroller.scrollLeft = scrollLeft - dist;
      scroller.style.cursor = 'grabbing';
    }
  });

  document.addEventListener('pointerup', () => {
    if (!isDown) return;
    isDown = false;
    scroller.style.cursor = '';
    moved = false;
  });
}

function initSettlArrowKeys() {
  const tbody = document.getElementById('settl-tbody');
  const scroller = document.querySelector('.settl-table-card > div');
  function scrollToEl(el) {
    if (!scroller || !el) return;
    const elRect = el.getBoundingClientRect();
    const scrollRect = scroller.getBoundingClientRect();
    if (elRect.left < scrollRect.left + 80) scroller.scrollLeft -= scrollRect.left + 80 - elRect.left;
    else if (elRect.right > scrollRect.right - 44) scroller.scrollLeft += elRect.right - (scrollRect.right - 44);
  }
  function moveTo(el) {
    const sc = tbody._selectCell;
    if (sc) sc(null);
    el.focus({ preventScroll: true });
    scrollToEl(el);
  }
  tbody.addEventListener('keydown', function(e) {
    const el = e.target;
    if (!el.matches('input.stl-input, select.stl-select')) return;

    const td = el.closest('td');
    const tr = td.closest('tr');
    const allTrs = [...tbody.querySelectorAll('tr')];
    const allTds = [...tr.querySelectorAll('td')];
    const rowIdx = allTrs.indexOf(tr);
    const colIdx = allTds.indexOf(td);
    const findEl = (td) => td ? td.querySelector("input.stl-input, select.stl-select") : null;

    // Tab: 같은 행 안에서만 이동, 끝에서 멈춤
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        for (let c = colIdx - 1; c >= 0; c--) {
          const candidate = findEl(allTds[c]);
          if (candidate) { moveTo(candidate); return; }
        }
      } else {
        for (let c = colIdx + 1; c < allTds.length; c++) {
          const candidate = findEl(allTds[c]);
          if (candidate) { moveTo(candidate); return; }
        }
      }
      return;
    }

    // Enter: 아래 행 같은 컬럼으로 이동
    if (e.key === 'Enter') {
      e.preventDefault();
      const targetTr = allTrs[rowIdx + 1];
      if (!targetTr) return;
      const targetEl = findEl(targetTr.querySelectorAll('td')[colIdx]);
      if (targetEl) { const sc = tbody._selectCell; if (sc && !targetEl.readOnly) sc(targetEl.closest('td')); else moveTo(targetEl); }
      return;
    }

    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;

    if (el.tagName === 'SELECT' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    } else if (el.tagName === 'SELECT') {
    }

    e.preventDefault();

    if (e.key === 'ArrowUp') {
      const targetTr = allTrs[rowIdx - 1];
      if (!targetTr) return;
      const targetEl = findEl(targetTr.querySelectorAll('td')[colIdx]);
      if (targetEl) { const sc = tbody._selectCell; if (sc && !targetEl.readOnly) sc(targetEl.closest('td')); else moveTo(targetEl); }
    } else if (e.key === 'ArrowDown') {
      const targetTr = allTrs[rowIdx + 1];
      if (!targetTr) return;
      const targetEl = findEl(targetTr.querySelectorAll('td')[colIdx]);
      if (targetEl) { const sc = tbody._selectCell; if (sc && !targetEl.readOnly) sc(targetEl.closest('td')); else moveTo(targetEl); }
    } else if (e.key === 'ArrowLeft') {
      for (let i = colIdx - 1; i >= 0; i--) {
        const candidate = findEl(allTds[i]);
        if (candidate) { const sc = tbody._selectCell; if (sc && candidate.tagName !== 'SELECT' && !candidate.readOnly) sc(candidate.closest('td')); else moveTo(candidate); return; }
      }
    } else if (e.key === 'ArrowRight') {
      for (let i = colIdx + 1; i < allTds.length; i++) {
        const candidate = findEl(allTds[i]);
        if (candidate) { const sc = tbody._selectCell; if (sc && candidate.tagName !== 'SELECT' && !candidate.readOnly) sc(candidate.closest('td')); else moveTo(candidate); return; }
      }
    }
  });
}

function settlAddRow() {
  if (!canEdit('settlement')) { toast('⚠️ 수정 권한이 없어요'); return; }
  settlRows.push({});
  renderSettlTable();
}

function settlRemoveRow(i) {
  if (!canEdit('settlement')) { toast('⚠️ 수정 권한이 없어요'); return; }
  if (!confirm('이 행을 삭제할까요?')) return;
  const r = settlRows[i];
  if (r._id) sb.from('settlements').delete().eq('id', r._id).then(({error}) => {
    if (error) toast('삭제 실패: ' + error.message);
  });
  settlRows.splice(i, 1);
  settlPadRows();
  renderSettlTable();
}

function settlUpdate(i, key, val) {
  if (key === 'phone' && val) val = fmtPhone(val);
  if (settlRows[i][key] !== val) {
    settlRows[i][key] = val;
    _settlDirty.add(i); // 실제 값 변경 시에만 dirty
  }
}

// 셀 포커스 - 편집중 행 기록
function settlFocus(i, el) {
  settlFocusedRow = i;
  if (el) {
    const td = el.closest ? el.closest('td') : null;
    const tr = td?.closest('tr');
    const tbody = document.getElementById('settl-tbody');
    if (td && tr && tbody) {
      const col = Array.from(tr.cells).indexOf(td);
      broadcastPresence(i, col);
    }
  }
}

// 셀 blur - 행 저장
function settlBlur(i) {
  settlFocusedRow = null;
  clearPresence();
  if (!_settlContractChanging) settlSaveRow(i);
  // blur 시점에 값 있는 마지막 행 찾아서 그 다음 빈 행 보장
  settlEnsureTrailingRow();
}

function settlEnsureTrailingRow() {
  // 값 있는 마지막 행 찾기
  let lastDataPos = -1;
  for (let i = settlRows.length - 1; i >= 0; i--) {
    if (!settlIsEmpty(settlRows[i])) { lastDataPos = i; break; }
  }
  // 마지막 데이터 행 기준으로 뒤에 빈 행 10개 보장
  const neededLen = Math.max(10, lastDataPos + 1 + 10);
  if (settlRows.length < neededLen) {
    const tbody = document.getElementById('settl-tbody');
    while (settlRows.length < neededLen) {
      const r = {};
      const i = settlRows.length;
      settlRows.push(r);
      if (tbody) {
        const tr = document.createElement('tr');
        tr.innerHTML = buildSettlRow(i, r);
        tbody.appendChild(tr);
      }
    }
    // 전체 리렌더 없이 색상만 재적용
    applyAllSettlColors(); applySettlDupHighlight(); applyPresenceHighlight();
  }
}

async function settlUpdateModel(i, val) {
  settlRows[i].model = val;
  if (!val) {
    settlRows[i].matched = undefined;
  } else {
    if (settlRows[i].serial) await settlCheckMatch(i);
  }
  // 행 전체 리렌더 (출고가 포함 갱신)
  const _rows = document.querySelectorAll('#settl-tbody tr');
  if (_rows[i]) {
    _rows[i].innerHTML = buildSettlRow(i, settlRows[i]);
    applyAllSettlColors(); applySettlDupHighlight(); applyPresenceHighlight();
  }
  await settlSaveRow(i);
  await settlAutoCommonSub(i);
  settlAutoAddPolicy(i);
  settlAutoRebate(i);
  settlAutoInstallment(i);
  applySettlDupHighlight();
}

async function settlUpdateSerial(i, val) {
  settlRows[i].serial = val;
  if (!val) {
    // 일련번호 지우면 관련 필드 모두 초기화
    settlRows[i].matched = undefined;
    settlRows[i].tgate = '';
    settlRows[i].svc_no = '';
    settlRows[i].tkey = false;
    settlRows[i].rebate = null;
    settlRows[i].face_price = null;
    settlRows[i].request_amount = null;
    settlRows[i].policy_total = null;
    const rows = document.querySelectorAll('#settl-tbody tr');
    if (rows[i]) {
      rows[i].innerHTML = buildSettlRow(i, settlRows[i]);
      applyAllSettlColors(); applySettlDupHighlight(); applyPresenceHighlight();
    }
    settlSaveRow(i, true);
    return;
  }
  // T키 메모리에 있으면 tgate 갱신, 없으면 DB에서 조회
  let tkey = tkeyData.find(t => t.serial === val);
  if (!tkey) {
    const { data } = await sb.from('tkey_data').select('serial,svc_no,tgate').eq('serial', val).maybeSingle();
    if (data) { tkey = data; tkeyData.push(data); }
  }
  if (tkey) {
    settlRows[i].tgate  = tkey.tgate  || '';
    settlRows[i].svc_no = tkey.svc_no || settlRows[i].svc_no || '';
    settlRows[i].tkey   = true;
  }
  // 재고 매칭 체크
  if (settlRows[i].model) {
    await settlCheckMatch(i);
  }
  // tgate 있으면 리베이트/액면/요청 재계산
  if (settlRows[i].tgate) {
    await settlAutoRebate(i);
  }
  // 최종 리렌더 (정책호수 + 모든 값 반영)
  const rows = document.querySelectorAll('#settl-tbody tr');
  if (rows[i]) {
    rows[i].innerHTML = buildSettlRow(i, settlRows[i]);
    applyAllSettlColors(); applySettlDupHighlight(); applyPresenceHighlight();
  }
  settlSaveRow(i, true);
}

async function settlCheckMatch(i) {
  const serial = settlRows[i].serial;
  const model = settlRows[i].model;
  const tgate = settlRows[i].tgate;
  if (!serial || !model) { settlRows[i].matched = undefined; return; }

  try {
    // 1차: 항상 재고DB 모델+일련번호 확인
    const { data, error } = await sb.from('inventory')
      .select('id')
      .eq('serial_number', serial)
      .eq('model', model)
      .limit(1);
    if (error) { console.error('매칭 오류:', error); settlRows[i].matched = undefined; return; }
    const inInventory = !!(data && data.length > 0);

    // 2차: T키 로드됐으면 추가 교차검증 (tgate+일련번호)
    if (tkeyData && tkeyData.length > 0 && tgate) {
      const inTkey = tkeyData.some(t => t.serial === serial && t.tgate === tgate);
      settlRows[i].matched = inInventory && inTkey;
    } else {
      settlRows[i].matched = inInventory;
    }
  } catch(e) {
    console.error('매칭 오류:', e);
    settlRows[i].matched = undefined;
  }
}

async function handleTkeyPaste(e) {
  e.preventDefault();
  const text = e.clipboardData.getData('text');
  if (!text) return;
  const lines = text.trim().split('\n').filter(l => l.trim());
  const parsed = [];
  let svcIdx = 5, serialIdx = 15, tgateIdx = 33; // 기본 인덱스
  let dataStartLine = 0;

  // 헤더 행 찾기 (처리구분 또는 서비스관리번호 포함 행)
  for (let li = 0; li < Math.min(lines.length, 3); li++) {
    const cols = lines[li].split('\t');
    const svc   = cols.findIndex(c => c.trim() === '서비스관리번호');
    const ser   = cols.findIndex(c => c.trim() === '단말기일련번호');
    const tg    = cols.findIndex(c => c.trim() === 'T-GATE접수일시');
    if (svc >= 0 && ser >= 0 && tg >= 0) {
      svcIdx = svc; serialIdx = ser; tgateIdx = tg;
      dataStartLine = li + 1;
      break;
    }
  }

  for (let li = dataStartLine; li < lines.length; li++) {
    const cols = lines[li].split('\t');
    if (cols[0].trim() === '처리구분') continue;
    if (cols[0].trim() !== '처리완료') continue;
    if (cols.length < 16) continue;
    parsed.push({ svc_no: cols[svcIdx]?.trim()||'', serial: cols[serialIdx]?.trim()||'', tgate: cols[tgateIdx]?.trim()||'', tkey: true });
  }
  if (!parsed.length) { toast('파싱할 데이터가 없어요'); return; }

  // tkey_data DB에 upsert (serial 기준)
  const upserts = parsed.filter(p => p.serial).map(p => ({
    serial: p.serial, svc_no: p.svc_no || null, tgate: p.tgate || null, updated_at: new Date().toISOString()
  }));
  if (upserts.length) {
    await sb.from('tkey_data').upsert(upserts, { onConflict: 'serial' });
  }
  // 메모리에도 반영
  upserts.forEach(u => {
    const idx = tkeyData.findIndex(t => t.serial === u.serial);
    if (idx >= 0) { tkeyData[idx] = u; } else { tkeyData.push(u); }
  });

  let added = 0, updated = 0;
  const changedIdxs = [];
  for (const p of parsed) {
    const existIdx = settlRows.findIndex(r => r.serial === p.serial);
    if (existIdx >= 0) {
      settlRows[existIdx].svc_no = p.svc_no; settlRows[existIdx].tgate = p.tgate; settlRows[existIdx].tkey = true;
      changedIdxs.push(existIdx); updated++;
    } else {
      const newIdx = settlRows.length;
      settlRows.push({ serial: p.serial, svc_no: p.svc_no, tgate: p.tgate, tkey: true });
      changedIdxs.push(newIdx); added++;
    }
  }
  const serials = parsed.map(p => p.serial).filter(Boolean);
  if (serials.length) {
    settlRows.forEach(r => {
      if (!r.serial) return;
      if (r.tgate) {
        r.matched = tkeyData.some(t => t.serial === r.serial && t.tgate === r.tgate);
      } else {
        r.matched = tkeyData.some(t => t.serial === r.serial);
      }
    });
  }
  // tgate 기준 정책호수 자동입력 (변경된 행만)
  await applyPolicyFromTgate(changedIdxs);
  // 변경된 행 DB 저장
  for (const i of changedIdxs) { await settlSaveRow(i); }
  document.getElementById('tkey-paste-area').value = '';
  renderSettlTable();
  toast(`✓ ${added}건 추가, ${updated}건 업데이트`);
}


// ─── 정책 파일 ───
let policyData = {};      // 현재 메모리에 로드된 { 시트명: { key: 금액 } }
let policyList = [];      // DB에서 불러온 정책 목록 [{ id, policy_name, started_at, data }]

// 요금제군 정규화: 'I_100 (프라임플러스)' → 'I_100'
function normPlanGroup(v) {
  if (!v) return '';
  return String(v).split(' ')[0].trim();
}

// 엑셀 파싱 → { 시트명: { key: 금액 } } 반환 (첫 3개 시트만)
// wb 직접 받는 버전 (processPolicyFile에서 사용)
async function parsePolicyExcelFromWb(wb, XLSX) {
  const result = {};
  const targetSheets = wb.SheetNames.slice(0, 3);

  for (const sheetName of targetSheets) {
    const ws   = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    if (rows.length < 6) continue;

    // 블록별로 독립 파싱
    // result[sheetName] = { blocks: [{models, data}, ...], data: {} }
    result[sheetName] = { blocks: [], data: {} };

    // '모델명' 위치를 동적으로 탐지
    // 첫번째 시트(index=0)는 가로 블록 전체 수집, 나머지는 첫번째만
    const labelRow = rows[0] || [];
    const isFirstSheet = wb.SheetNames.indexOf(sheetName) === 0;
    const modelNameRows = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || [];
      if (isFirstSheet) {
        // 같은 행의 모든 '모델명' 수집 (협력점/액면/요청)
        let searchFrom = 0;
        while (true) {
          const colIdx = row.indexOf('모델명', searchFrom);
          if (colIdx === -1) break;
          const label = labelRow[colIdx] || null;
          modelNameRows.push({ ri: i, modelCol: colIdx, label });
          searchFrom = colIdx + 1;
        }
      } else {
        // B/C 시트: 행당 첫번째 '모델명'만
        const colIdx = row.findIndex(v => v === '모델명');
        if (colIdx !== -1 && !modelNameRows.some(m => m.ri === i)) {
          modelNameRows.push({ ri: i, modelCol: colIdx, label: null });
        }
      }
    }

    for (const { ri: mrow, modelCol, label } of modelNameRows) {
      // rateRow(모델명-2행)가 비어있으면 헤더가 4행 구조 → 한 행 더 위를 사용
      const isRowEmpty = r => (r || []).every(v => v === null || v === undefined || String(v).trim() === '');
      const rateOffset  = isRowEmpty(rows[mrow - 2]) ? 3 : 2;
      const rateRow     = rows[mrow - rateOffset]     || [];
      const actTypeRow  = rows[mrow - rateOffset + 1] || [];
      const contractRow = rows[mrow]                  || [];

      let dataEnd = rows.length;
      for (let s = mrow + 1; s < rows.length; s++) {
        const sr = rows[s] || [];
        // 해당 블록 컬럼 범위만 체크
        const blockCols = sr.slice(modelCol, modelCol + 23);
        const isEmpty = blockCols.every(v => v === null || v === undefined || String(v).trim() === '');
        const isNextHeader = sr[modelCol] === '모델명';
        if (isEmpty || isNextHeader) { dataEnd = s; break; }
      }

      // 펫네임 컬럼 있으면 +2, 없으면 +1 (액면/요청은 펫네임 없음)
      const hasPetname = contractRow[modelCol + 1] === '펫네임';
      const COL_START = modelCol + (hasPetname ? 2 : 1);
      const COL_END   = modelCol + 21;
      const colMap = {};
      let lastRate = '', lastAct = '';

      for (let c = COL_START; c <= COL_END; c++) {
        const rv = rateRow[c]     ? String(rateRow[c]).trim()     : '';
        const av = actTypeRow[c]  ? String(actTypeRow[c]).trim()  : '';
        const cv = contractRow[c] ? String(contractRow[c]).trim() : '';
        if (rv && !['구분','모델명','펫네임'].includes(rv)) lastRate = normPlanGroup(rv);
        if (['MNP','기변'].includes(av)) lastAct = av;
        if (['공통','선약','공시'].includes(cv) && lastRate && lastAct) {
          colMap[c] = { planGroup: lastRate, actType: lastAct, contract: cv };
        }
      }

      // 이 블록의 모델 목록 + 데이터
      const blockModels = [];
      const blockData   = {};
      // colMap에서 등장 순서대로 planGroup 순서 추출
      const planGroupOrder = [];
      Object.values(colMap).forEach(({ planGroup }) => {
        if (!planGroupOrder.includes(planGroup)) planGroupOrder.push(planGroup);
      });

      for (let r = mrow + 1; r < dataEnd; r++) {
        const row = rows[r] || [];
        const model = row[modelCol];
        if (!model || ['구분','모델명','펫네임'].includes(String(model).trim())) continue;
        const modelStr = String(model).trim();
        if (!blockModels.includes(modelStr)) blockModels.push(modelStr);

        for (const [cStr, info] of Object.entries(colMap)) {
          const val = row[parseInt(cStr)];
          if (val === null || val === undefined || String(val).trim() === '') continue;
          const num = Number(val);
          if (isNaN(num)) continue;
          const key = `${modelStr}||${info.planGroup}||${info.actType}||${info.contract}`;
          blockData[key] = num;
          // 플랫 data는 첫 번째 블록(협력점)만 저장 - 이후 블록이 덮어쓰지 않도록
          if (!(key in result[sheetName].data)) result[sheetName].data[key] = num;
        }
      }

      if (blockModels.length) {
        result[sheetName].blocks.push({ models: blockModels, data: blockData, label: label || null, planGroupOrder });
      }
    }
  }
  return result;
}

// file 받는 버전 (수정/저장 시 재파싱용)
async function parsePolicyExcel(file) {
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: 'array', cellDates: true });
  return parsePolicyExcelFromWb(wb, XLSX);
}

// 정책 목록 DB에서 불러오기
async function loadPolicyList() {
  const { data } = await sb.from('policy_files').select('id,policy_name,started_at,file_name').order('started_at', { ascending: false });
  policyList = data || [];
}

// 정책 파일 업로드 버튼 클릭
async function loadPolicyFile(input) {
  const file = input.files[0];
  if (!file) return;
  const statusEl = document.getElementById('policy-status');

  try {
    if (statusEl) { statusEl.textContent = '읽는 중...'; statusEl.style.color = 'var(--orange)'; }
    const parsed = await parsePolicyExcel(file);
    const sheetNames = Object.keys(parsed);
    if (!sheetNames.length) throw new Error('파싱된 데이터 없음');

    openPolicyUploadModal(parsed, file.name);
    input.value = '';
    if (statusEl) statusEl.textContent = '';
  } catch(e) {
    console.error('정책 파일 오류:', e);
    if (statusEl) { statusEl.textContent = '로드 실패'; statusEl.style.color = 'var(--red)'; }
    toast('정책 파일 로드 실패: ' + e.message);
  }
}

// 정책 업로드 모달
function openPolicyUploadModal(parsed, fileName) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0,16);
  const modal = document.createElement('div');
  modal.id = 'policy-upload-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--white);border-radius:var(--radius-md);padding:28px;min-width:340px;box-shadow:var(--shadow-lg)">
      <div style="font-size:16px;font-weight:700;margin-bottom:20px">정책 파일 등록</div>
      <div style="font-size:12px;color:var(--text-hint);margin-bottom:16px">${fileName}</div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:600;color:var(--text-sub);display:block;margin-bottom:4px">정책명 (호수)</label>
        <input id="policy-name-input" class="modal-input" placeholder="예: 4-1" style="width:100%"/>
      </div>
      <div style="margin-bottom:20px">
        <label style="font-size:12px;font-weight:600;color:var(--text-sub);display:block;margin-bottom:4px">시작 일시</label>
        <input id="policy-date-input" type="datetime-local" class="modal-input" value="${dateStr}" style="width:100%"/>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-outline" onclick="document.getElementById('policy-upload-modal').remove()">취소</button>
        <button class="btn btn-primary" onclick="savePolicyToDB()">저장</button>
      </div>
    </div>
  `;
  modal.dataset.parsed = JSON.stringify(parsed);
  modal.dataset.fileName = fileName;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('policy-name-input')?.focus(), 100);
}

// DB에 정책 저장
async function savePolicyToDB() {
  const modal = document.getElementById('policy-upload-modal');
  if (!modal) return;
  const policyName = document.getElementById('policy-name-input').value.trim();
  const startedAt = document.getElementById('policy-date-input').value;
  const parsed = JSON.parse(modal.dataset.parsed);
  const fileName = modal.dataset.fileName || '';

  if (!policyName) { toast('정책명을 입력해 주세요'); return; }
  if (!startedAt) { toast('시작 일시를 입력해 주세요'); return; }

  const { error } = await sb.from('policy_files').insert({
    policy_name: policyName,
    started_at: new Date(startedAt).toISOString(),
    data: parsed,
    file_name: fileName,
  });

  if (error) { toast('저장 실패: ' + error.message); return; }

  modal.remove();
  toast(`✓ 정책 ${policyName} 저장 완료`);
  if (document.getElementById('sset-policy-list')) renderPolicyListInModal();
}

// 정책 목록 모달
async function openPolicyListModal() {
  await loadPolicyList();
  const existing = document.getElementById('policy-list-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'policy-list-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center';

  const rows = policyList.map(p => {
    const dt = new Date(p.started_at);
    const dateStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    return `<tr style="border-bottom:1px solid var(--border-light)">
      <td style="padding:10px 14px;font-weight:700;color:var(--text)">${p.policy_name}</td>
      <td style="padding:10px 14px;font-size:12px;color:var(--text-sub)">${dateStr}</td>
      <td style="padding:10px 14px;text-align:center">
        <button onclick="deletePolicyFile('${p.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:13px;font-weight:600">삭제</button>
      </td>
    </tr>`;
  }).join('');

  modal.innerHTML = `
    <div style="background:var(--white);border-radius:var(--radius-md);padding:28px;min-width:420px;max-height:80vh;overflow-y:auto;box-shadow:var(--shadow-lg)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="font-size:16px;font-weight:700">정책 파일 목록</div>
        <button onclick="document.getElementById('policy-list-modal').remove()" style="background:none;border:none;cursor:pointer;font-size:20px;color:var(--text-hint)">×</button>
      </div>
      ${policyList.length ? `
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:var(--border-light)">
              <th style="padding:8px 14px;text-align:left;font-size:12px;color:var(--text-sub)">정책명</th>
              <th style="padding:8px 14px;text-align:left;font-size:12px;color:var(--text-sub)">시작 일시</th>
              <th style="padding:8px 14px;text-align:center;font-size:12px;color:var(--text-sub)">관리</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>` 
      : '<div style="text-align:center;padding:40px;color:var(--text-hint)">등록된 정책이 없어요</div>'}
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function deletePolicyFile(id) {
  if (!confirm('이 정책을 삭제할까요?')) return;
  const { error } = await sb.from('policy_files').delete().eq('id', id);
  if (error) { toast('삭제 실패: ' + error.message); return; }
  toast('✓ 삭제됐어요');
  await openPolicyListModal();
  await loadPolicyList();
}

// tgate 기준 정책호수 자동입력 + DB 저장
function applyPolicyFromTgate(idxList) {
  // 정책은 렌더링 시 tgate 기준으로 실시간 계산 (DB 저장 안함)
  // tgate가 세팅된 행들만 렌더링 갱신
  if (!policyList.length) return;
  const targets = idxList ?? settlRows.map((_, i) => i);
  const hasTarget = targets.some(i => settlRows[i]?.tgate);
  if (hasTarget) renderSettlTable();
}

// T-GATE 접수일시(KST) 기준으로 해당 정책 데이터 찾기
// tgate: "YYYY-MM-DD HH:MM:SS" KST 문자열 → 브라우저가 로컬타임(KST)으로 자동 파싱
// started_at: UTC ISO 문자열 → new Date()가 UTC로 파싱
// 브라우저에서 둘 다 getTime() 비교하면 KST 기준으로 정확히 매칭됨
function getPolicyDataByDate(tgateDate) {
  if (!policyList.length) return null;
  if (!tgateDate) return null;
  // "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SS" (공백→T)
  const normalized = String(tgateDate).trim().replace(/\s+/, "T");
  const targetMs = new Date(normalized).getTime();
  if (isNaN(targetMs)) return null;
  // started_at(UTC ISO)과 ms 비교
  const matched = policyList
    .filter(p => new Date(p.started_at).getTime() <= targetMs)
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
  return matched[0] || null;
}

// 정산 행에서 정책 파일 리베이트 조회
async function getPolicyRebate(r) {
  if (!r.model || !r.plan || !r.act_type || !r.contract) return null;
  if (!policyList.length) return null;

  // plan_group 조회
  const plan = settlPlans.find(p => p.name === r.plan);
  if (!plan?.plan_group) return null;
  const planGroup = plan.plan_group;
  const actType = (r.act_type === 'MNP' || r.act_type === 'MVNO MNP') ? 'MNP' : '기변';
  const contract = r.contract === '선약' ? '선약' : '공통';

  // 모델명 정규화: DB모델(S942_256G) vs 정책표모델(S942_256) → G 제거 후 매칭
  const normalizeModel = m => String(m).replace(/G$/i, '').trim();
  const modelNorm = normalizeModel(r.model);

  // T-GATE 접수일시(KST 전체)로 정책 찾기
  const policyMeta = getPolicyDataByDate(r.tgate || null);
  if (!policyMeta) return null;

  // data가 없으면 DB에서 조회
  let data = policyMeta.data;
  if (!data) {
    const { data: row } = await sb.from('policy_files').select('data').eq('id', policyMeta.id).single();
    data = row?.data;
    policyMeta.data = data;
  }
  if (!data) return null;

  // 정산그룹으로 시트 찾기 (그룹명 = 시트명 직접 매칭)
  const sheets = Object.keys(data);
  const sheetName = (r.policy_type && sheets.includes(r.policy_type))
    ? r.policy_type
    : sheets[0];

  // 플랫 data 객체 접근 (파싱 구조: { blocks, data })
  const sheetData = data[sheetName]?.data ?? {};

  // 원본 모델명으로 직접 시도 (정책표에 G 붙은 경우)
  const keyOrig = `${r.model}||${planGroup}||${actType}||${contract}`;
  if (sheetData[keyOrig] !== undefined) return sheetData[keyOrig] * 1000;

  // G 제거 모델명으로 시도
  const keyNorm = `${modelNorm}||${planGroup}||${actType}||${contract}`;
  if (sheetData[keyNorm] !== undefined) return sheetData[keyNorm] * 1000;

  // 둘 다 실패 시 모델명 G 제거 기준 fallback 탐색
  const fallbackKey = Object.keys(sheetData).find(k => {
    const [km, kp, ka, kc] = k.split('||');
    return normalizeModel(km) === modelNorm && kp === planGroup && ka === actType && kc === contract;
  });
  return fallbackKey !== undefined ? sheetData[fallbackKey] * 1000 : null;
}

// 정책 파일에서 특정 label 블록 값 조회 (액면/요청 공통)
async function getPolicyByLabel(r, label) {
  if (!r.model || !r.plan || !r.act_type || !r.contract) return null;
  if (!policyList.length) return null;

  const plan = settlPlans.find(p => p.name === r.plan);
  if (!plan?.plan_group) return null;
  const planGroup = plan.plan_group;
  const actType = (r.act_type === 'MNP' || r.act_type === 'MVNO MNP') ? 'MNP' : '기변';
  const contract = r.contract === '선약' ? '선약' : '공통';
  const normalizeModel = m => String(m).replace(/G$/i, '').trim();
  const modelNorm = normalizeModel(r.model);

  const policyMeta = getPolicyDataByDate(r.tgate || null);
  if (!policyMeta) return null;

  let data = policyMeta.data;
  if (!data) {
    const { data: row } = await sb.from('policy_files').select('data').eq('id', policyMeta.id).single();
    data = row?.data;
    policyMeta.data = data;
  }
  if (!data) return null;

  // 정산그룹 시트 찾기 - 액면/요청은 본사정산이라 항상 A 시트
  const sheets = Object.keys(data);
  const sheetName = sheets.includes('A') ? 'A' : sheets[0];

  // 해당 label 블록 찾기
  const blocks = data[sheetName]?.blocks ?? [];
  const block = blocks.find(b => b.label === label);
  if (!block) return null;

  const blockData = block.data ?? {};
  const keyOrig = `${r.model}||${planGroup}||${actType}||${contract}`;
  if (blockData[keyOrig] !== undefined) return blockData[keyOrig] * 1000;

  const keyNorm = `${modelNorm}||${planGroup}||${actType}||${contract}`;
  if (blockData[keyNorm] !== undefined) return blockData[keyNorm] * 1000;

  const fallbackKey = Object.keys(blockData).find(k => {
    const [km, kp, ka, kc] = k.split('||');
    return normalizeModel(km) === modelNorm && kp === planGroup && ka === actType && kc === contract;
  });
  return fallbackKey !== undefined ? blockData[fallbackKey] * 1000 : null;
}

async function loadTkeyFile(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('tkey-status').textContent = '읽는 중...';
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, {type:'array', cellDates:true});
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, {header:1});
  const header = rows[0];
  const serialIdx = header.findIndex(h => h === '단말기일련번호');
  const svcIdx = header.findIndex(h => h === '서비스관리번호');
  const tgateIdx = header.findIndex(h => h === 'T-GATE접수일시');
  tkeyData = rows.slice(1).filter(r => r[serialIdx]).map(r => ({
    serial: String(r[serialIdx]||'').trim(),
    svc_no: String(r[svcIdx]||'').trim(),
    tgate: r[tgateIdx] ? String(r[tgateIdx]).trim() : '',
  }));
  document.getElementById('tkey-status').textContent = `✓ ${tkeyData.length}건 로드됨`;
  for (let i = 0; i < settlRows.length; i++) {
    const serial = settlRows[i].serial;
    if (!serial) continue;
    const match = tkeyData.find(t => t.serial === serial);
    if (match) { settlRows[i].svc_no = match.svc_no; settlRows[i].tgate = match.tgate; settlRows[i].tkey = true; }
  }
  const existingSerials = settlRows.map(r => r.serial);
  for (const t of tkeyData) {
    if (!existingSerials.includes(t.serial)) settlRows.push({ serial: t.serial, svc_no: t.svc_no, tgate: t.tgate, tkey: true });
  }
  settlRows.forEach(r => {
    if (!r.serial) return;
    if (r.tgate) {
      r.matched = tkeyData.some(t => t.serial === r.serial && t.tgate === r.tgate);
    } else {
      r.matched = tkeyData.some(t => t.serial === r.serial);
    }
  });
  // tgate 기준 정책호수 자동입력
  applyPolicyFromTgate();
  renderSettlTable();
  input.value = '';
}

// ─── 공통지원금 ───
async function renderSupportMatrix() {
  const wrap = document.getElementById('support-matrix-wrap');
  wrap.innerHTML = '<div class="loading">로딩중...</div>';
  const [{ data: modelsData }, { data: modelMappings }, { data: plansData }, { data: amounts }] = await Promise.all([
    sb.from('models').select('code, is_active').order('display_order'),
    sb.from('model_mapping').select('model_code, support_manual').eq('is_active', true).not('model_code', 'is', null),
    sb.from('plans').select('id, name, monthly_fee').eq('is_active', true).order('monthly_fee', { ascending: false }).order('created_at'),
    sb.from('support_amount').select('model_code,plan_id,amount').limit(10000)
  ]);
  if (!modelsData?.length || !plansData?.length) {
    wrap.innerHTML = '<div class="empty">활성화된 모델 또는 요금제가 없습니다.</div>';
    return;
  }
  const supportManualMap = {};
  modelMappings?.forEach(m => { if (m.model_code) supportManualMap[m.model_code] = m.support_manual; });
  const modelList = modelsData.map(m => ({
    model_code: m.code,
    is_active: m.is_active,
    support_manual: supportManualMap[m.code] ?? false,
  }));
  // plans를 직접 컬럼으로 사용
  const planMappings = plansData.map(p => ({ skt_plan_name: p.name, plan_id: p.id }));
  const amtMap = {};
  amounts?.forEach(a => { amtMap[`${a.model_code}||${a.plan_id}`] = a.amount; });
  let html = `<table style="border-collapse:collapse;font-size:12px;white-space:nowrap">
    <thead><tr>
      <th style="padding:8px 12px;background:var(--border-light);border:1px solid var(--border);font-weight:700;color:var(--text);position:sticky;left:0;top:0;z-index:4;min-width:150px;box-shadow:2px 0 4px rgba(0,0,0,0.08);text-align:left">모델명</th>
      ${planMappings.map(p => `<th style="padding:6px 8px;background:var(--border-light);border:1px solid var(--border);text-align:center;min-width:100px;position:sticky;top:0;z-index:2"><div style="font-weight:700;color:var(--text);font-size:11px">${p.skt_plan_name}</div></th>`).join('')}
    </tr></thead>
    <tbody>
      ${modelList.map(m => `
        <tr>
          <td style="padding:7px 12px;border:1px solid var(--border);font-weight:600;color:${m.is_active ? 'var(--text)' : 'var(--text-hint)'};position:sticky;left:0;z-index:1;box-shadow:2px 0 4px rgba(0,0,0,0.08);background:var(--white)">${m.support_manual ? '🔒 ' : ''}${m.model_code}${m.is_active ? '' : ' <span style="font-size:10px;color:var(--text-hint)">(비활성)</span>'}</td>
          ${planMappings.map(p => {
            const key = `${m.model_code}||${p.plan_id}`;
            const amt = amtMap[key];
            const hasVal = amt !== undefined && amt !== null;
            return `<td style="padding:2px;border:1px solid var(--border);text-align:center">
              <input type="text" value="${hasVal ? Number(amt).toLocaleString() : ''}" placeholder="-"
                data-model="${m.model_code}" data-plan="${p.plan_id}"
                style="width:90px;height:28px;border:none;background:transparent;text-align:center;font-size:12px;font-weight:${hasVal&&amt?'600':'400'};color:${hasVal&&amt?'var(--text)':'var(--text-hint)'};outline:none;font-family:inherit;cursor:${canEdit('support')?'pointer':'default'}"
                ${canEdit('support')
                  ? `onfocus="this.value=this.value.replace(/,/g,'');this.style.background='var(--primary-light)';this.style.color='var(--primary)'"
                     onblur="saveSupportCell(this)"
                     onkeydown="if(event.key==='Enter')this.blur()"`
                  : 'readonly'}
              />
            </td>`;
          }).join('')}
        </tr>`).join('')}
    </tbody>
  </table>`;
  wrap.innerHTML = html;
}

async function saveSupportCell(input) {
  if (!canEdit('support')) return;
  input.style.background = 'transparent';
  const modelCode = input.getAttribute('data-model');
  const planId = input.getAttribute('data-plan');
  const amount = parseInt(input.value.replace(/,/g, '')) || 0;
  input.value = amount ? amount.toLocaleString() : '';
  input.style.color = amount ? 'var(--text)' : 'var(--text-hint)';
  input.style.fontWeight = amount ? '600' : '400';
  await sb.from('support_amount').upsert(
    { model_code: modelCode, plan_id: planId, amount },
    { onConflict: 'model_code,plan_id' }
  );
}

async function loadSupport() { renderSupportMatrix(); }

async function downloadSupportExcel() {
  toast('엑셀 생성 중...');
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
  const [{ data: models }, { data: plans }, { data: amounts }] = await Promise.all([
    sb.from('models').select('code').eq('is_active', true).order('code'),
    sb.from('plans').select('id,name,monthly_fee').order('monthly_fee', {ascending: false}).order('name'),
    sb.from('support_amount').select('model_code,plan_id,amount').limit(10000)
  ]);
  const amtMap = {};
  amounts?.forEach(a => { amtMap[`${a.model_code}||${a.plan_id}`] = a.amount; });
  const header = ['모델', ...plans.map(p => p.name)];
  const subHeader = ['', ...plans.map(p => p.monthly_fee ? p.monthly_fee.toLocaleString()+'원' : '-')];
  const rows = [header, subHeader];
  models?.forEach(m => { rows.push([m.code, ...plans.map(p => amtMap[`${m.code}||${p.id}`] || '')]); });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, ...plans.map(() => ({ wch: 10 }))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '공통지원금');
  XLSX.writeFile(wb, '공통지원금_테이블.xlsx');
  toast('✓ 다운로드 완료');
}

async function uploadSupportExcel(input) {
  const file = input.files[0];
  if (!file) return;
  toast('파일 읽는 중...');
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const planNames = rows[0].slice(1).map(h => String(h||'').trim());
  const { data: plans } = await sb.from('plans').select('id,name');
  const planMap = {};
  plans?.forEach(p => { planMap[p.name] = p.id; });
  const upserts = [];
  let skipped = 0;
  rows.slice(2).forEach(row => {
    const modelCode = String(row[0] || '').trim();
    if (!modelCode) return;
    planNames.forEach((planName, idx) => {
      const amount = parseInt(String(row[idx + 1] || '').replace(/,/g, '')) || 0;
      const planId = planMap[planName];
      if (!planId) { skipped++; return; }
      upserts.push({ model_code: modelCode, plan_id: planId, amount });
    });
  });
  if (!upserts.length) { toast('저장할 데이터가 없어요'); return; }
  const { error } = await sb.from('support_amount').upsert(upserts, { onConflict: 'model_code,plan_id' });
  input.value = '';
  if (error) { toast('저장 실패: ' + error.message); return; }
  toast(`✓ ${upserts.length}건 저장 완료${skipped ? ` (${skipped}건 스킵)` : ''}`);
  renderSupportMatrix();
}

// ─── SKT 요금제 매핑 ───
async function loadPlanMap() {
  // 접근만 권한이면 추가 버튼 숨김
  const addBtn = document.querySelector('#page-planmap .btn-primary');
  if (addBtn) addBtn.style.display = canEdit('planmap') ? '' : 'none';
  const { data: maps } = await sb.from('plan_mapping').select('*').order('created_at', { ascending: false });
  const { data: plans } = await sb.from('plans').select('id,name,monthly_fee,created_at').eq('is_active', true).order('monthly_fee', { ascending: false }).order('created_at');
  const tbody = document.getElementById('planmap-tbody');
  if (!maps?.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">매핑 데이터가 없습니다</td></tr>'; return; }
  const planMap = {};
  plans?.forEach(p => planMap[p.id] = { name: p.name, fee: p.monthly_fee, created: p.created_at });
  maps.sort((a,b) => {
    const feeA = planMap[a.plan_id]?.fee || 0, feeB = planMap[b.plan_id]?.fee || 0;
    if (feeB !== feeA) return feeB - feeA;
    return (planMap[a.plan_id]?.created||'').localeCompare(planMap[b.plan_id]?.created||'');
  });
  tbody.innerHTML = maps.map(m => {
    const plan = planMap[m.plan_id];
    return `<tr style="border-bottom:1px solid var(--border-light)">
      <td style="padding:12px 16px;font-weight:600">${m.skt_plan_name}</td>
      <td style="padding:12px 16px;font-family:monospace;color:var(--text-sub);font-size:12px">${m.skt_plan_id}</td>
      <td style="padding:12px 16px;font-weight:700">${plan ? plan.fee.toLocaleString()+'원' : '-'}</td>
      <td style="padding:12px 16px"><span style="background:var(--primary-light);color:var(--primary);padding:3px 10px;border-radius:100px;font-size:12px;font-weight:600">${plan?.name || '❌ 미연결'}</span></td>
      <td style="padding:12px 16px;text-align:center">
        <div style="display:inline-flex;gap:6px">
          ${canEdit('planmap')
            ? `<button onclick="openEditPlanMap('${m.id}','${m.skt_plan_id}','${m.skt_plan_name}','${m.plan_id||''}')" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:13px;font-weight:600">수정</button>
               <button onclick="deletePlanMap('${m.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:13px;font-weight:600">삭제</button>`
            : '<span style="font-size:12px;color:var(--text-hint)">보기 전용</span>'}
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function openPlanMapModal(sktId, sktName) {
  const { data: plans } = await sb.from('plans').select('id,name,monthly_fee').eq('is_active', true).order('monthly_fee', { ascending: false });
  const sel = document.getElementById('pm-plan-id');
  sel.innerHTML = '<option value="">-- 요금제 선택 --</option>';
  plans?.forEach(p => { sel.innerHTML += `<option value="${p.id}">${p.name} (${p.monthly_fee.toLocaleString()}원)</option>`; });
  document.getElementById('pm-skt-name').value = sktName || '';
  document.getElementById('pm-skt-id').value = sktId || '';
  document.getElementById('pm-mapping-id').value = '';
  document.getElementById('planmap-modal').querySelector('.modal-title').textContent = '요금제 매핑 추가';
  document.getElementById('planmap-modal').classList.add('open');
  lucide.createIcons();
}

async function openEditPlanMap(id, sktId, sktName, planId) {
  const { data: plans } = await sb.from('plans').select('id,name,monthly_fee').eq('is_active', true).order('monthly_fee', { ascending: false });
  const sel = document.getElementById('pm-plan-id');
  sel.innerHTML = '<option value="">-- 요금제 선택 --</option>';
  plans?.forEach(p => { sel.innerHTML += `<option value="${p.id}" ${p.id === planId ? 'selected' : ''}>${p.name} (${p.monthly_fee.toLocaleString()}원)</option>`; });
  document.getElementById('pm-skt-name').value = sktName;
  document.getElementById('pm-skt-id').value = sktId;
  document.getElementById('pm-mapping-id').value = id;
  document.getElementById('planmap-modal').querySelector('.modal-title').textContent = '요금제 매핑 수정';
  document.getElementById('planmap-modal').classList.add('open');
  lucide.createIcons();
}

async function savePlanMap() {
  if (!canEdit('planmap')) { toast('⚠️ 수정 권한이 없어요'); return; }
  const mappingId = document.getElementById('pm-mapping-id').value;
  const sktName = document.getElementById('pm-skt-name').value.trim();
  const sktId = document.getElementById('pm-skt-id').value.trim();
  const planId = document.getElementById('pm-plan-id').value;
  if (!sktName || !sktId) { toast('SKT 요금제를 선택해주세요'); return; }
  if (!planId) { toast('우주커넥트 요금제를 선택해주세요'); return; }
  const payload = { skt_plan_name: sktName, skt_plan_id: sktId, plan_id: planId, is_active: true };
  let error;
  if (mappingId) { ({ error } = await sb.from('plan_mapping').update(payload).eq('id', mappingId)); }
  else { ({ error } = await sb.from('plan_mapping').insert(payload)); }
  if (error) { toast('저장 실패: ' + error.message); return; }
  toast(mappingId ? '✓ 매핑 수정 완료' : '✓ 매핑 저장 완료');
  closeModal('planmap-modal');
  loadPlanMap();
}

async function deletePlanMap(id) {
  if (!canEdit('planmap')) { toast('⚠️ 수정 권한이 없어요'); return; }
  if (!confirm('이 매핑을 삭제하시겠습니까?')) return;
  await sb.from('plan_mapping').delete().eq('id', id);
  toast('✓ 삭제 완료');
  loadPlanMap();
}

function showSktPlanList() {
  const sktPlans = [
    { id: 'NA00008489', name: '5GX 플래티넘' }, { id: 'NA00008490', name: '5GX 플래티넘(넷플릭스)' },
    { id: 'NA00008491', name: '5GX 플래티넘(스마트기기)' }, { id: 'NA00008492', name: '5GX 플래티넘(T 우주)' },
    { id: 'NA00008565', name: '5GX 프리미엄' }, { id: 'NA00007790', name: '5GX 프라임' },
    { id: 'NA00007791', name: '5GX 프라임(넷플릭스)' }, { id: 'NA00007792', name: '5GX 프라임(스마트기기)' },
    { id: 'NA00008026', name: '5GX 프라임플러스' }, { id: 'NA00008027', name: '5GX 프라임플러스(넷플릭스)' },
    { id: 'NA00008030', name: '0 청년 109' }, { id: 'NA00008031', name: '0 청년 99' },
    { id: 'NA00008032', name: '5GX 레귤러' }, { id: 'NA00008033', name: '5GX 베이직' },
    { id: 'NA00008034', name: '0 청년 89' }, { id: 'NA00008035', name: '0 청년 79' },
    { id: 'NA00008036', name: '0 청년 69' }, { id: 'NA00008037', name: '5GX 슬림' },
    { id: 'NA00008143', name: '0 청년 59' }, { id: 'NA00008145', name: '0 청년 49' },
    { id: 'NA00006817', name: '0틴 5G' }, { id: 'NA00008563', name: '컴팩트플러스' },
    { id: 'NA00008287', name: '0 청년 43' }, { id: 'NA00008562', name: '컴팩트' },
    { id: 'NA00008677', name: '0 청년 37' }, { id: 'NA00007492', name: '5G ZEM플랜 퍼펙트' },
    { id: 'NA00007493', name: '5G ZEM플랜 베스트' }, { id: 'NA00006155', name: '0플랜 스몰' },
    { id: 'NA00006534', name: 'T플랜 세이브' }, { id: 'NA00007485', name: 'LTE ZEM플랜 베스트' },
    { id: 'NA00004891', name: 'ZEM플랜 스마트' }, { id: 'NA00004934', name: 'T끼리 어르신' },
  ];
  const wrap = document.getElementById('skt-plan-tags');
  wrap.style.display = 'flex';
  wrap.innerHTML = sktPlans.map(p => `
    <span onclick="openPlanMapModal('${p.id}','${p.name}')"
      style="background:var(--primary-light);color:var(--primary);padding:5px 12px;border-radius:100px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid transparent;transition:all .15s"
      onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='transparent'">
      ${p.name}
    </span>`).join('');
}

// ─── SKT 모델 매핑 ───
async function loadModelMap(filterType = 'active') {
  // 접근만 권한이면 추가 버튼 숨김
  const addBtn = document.querySelector('#page-modelmap .btn-primary');
  if (addBtn) addBtn.style.display = canEdit('modelmap') ? '' : 'none';
  ['active','all','inactive'].forEach(t => {
    document.getElementById('filter-'+t).style.background = filterType === t ? 'var(--primary)' : 'var(--border-light)';
    document.getElementById('filter-'+t).style.color = filterType === t ? 'white' : 'var(--text-sub)';
  });
  let query = sb.from('model_mapping').select('*').order('skt_model_name');
  if (filterType === 'active') query = query.eq('is_active', true);
  else if (filterType === 'inactive') query = query.eq('is_active', false);
  const { data: maps } = await query;
  const tbody = document.getElementById('modelmap-tbody');
  if (!maps?.length) { tbody.innerHTML = `<tr><td colspan="4" class="empty">${filterType === 'active' ? '활성화된 모델이 없습니다' : '데이터가 없습니다'}</td></tr>`; return; }
  tbody.innerHTML = maps.map(m => {
    const priceManual = m.price_manual || false;
    const lockIcon = priceManual ? '🔒 ' : '';
    return `<tr style="border-bottom:1px solid var(--border-light)">
      <td style="padding:12px 16px;font-weight:600">${m.skt_model_name}</td>
      <td style="padding:12px 16px"><span style="background:var(--primary-light);color:var(--primary);padding:3px 10px;border-radius:100px;font-size:12px;font-weight:700;font-family:monospace">${m.model_code || '❌ 미연결'}</span></td>
      <td style="padding:12px 16px;text-align:right;font-weight:600;${priceManual?'color:var(--orange)':''}">${lockIcon}${m.price ? m.price.toLocaleString()+'원' : '-'}</td>
      <td style="padding:12px 16px;text-align:center">
        <div style="display:inline-flex;gap:6px">
          ${canEdit('modelmap')
            ? `<button onclick="openEditModelMap('${m.id}','${m.skt_model_name}','${m.model_code||''}','${m.is_active}')" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:13px;font-weight:600">수정</button>
               <button onclick="deleteModelMap('${m.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:13px;font-weight:600">삭제</button>`
            : '<span style="font-size:12px;color:var(--text-hint)">보기 전용</span>'}
        </div>
      </td>
    </tr>`;
  }).join('');
}

let allModelCodes = [];

async function openModelMapModal(sktName) {
  const { data: models } = await sb.from('models').select('code, is_active').order('code');
  allModelCodes = models || [];
  document.getElementById('mm-skt-name').value = sktName || '';
  document.getElementById('mm-model-code-input').value = '';
  document.getElementById('mm-model-code').value = '';
  document.getElementById('mm-price').value = '';
  document.getElementById('mm-price-manual').checked = false;
  document.getElementById('mm-support-manual').checked = false;
  document.getElementById('mm-mapping-id').value = '';
  document.getElementById('mm-code-dropdown').style.display = 'none';
  document.getElementById('modelmap-modal').querySelector('.modal-title').textContent = '모델 매핑 추가';
  document.getElementById('modelmap-modal').classList.add('open');
  lucide.createIcons();
}

async function openEditModelMap(id, sktName, modelCode, isActive) {
  const { data: mapping } = await sb.from('model_mapping').select('*').eq('id', id).single();
  const { data: models } = await sb.from('models').select('code, is_active').order('code');
  allModelCodes = models || [];
  document.getElementById('mm-skt-name').value = sktName;
  document.getElementById('mm-model-code-input').value = modelCode || '';
  document.getElementById('mm-model-code').value = modelCode || '';
  document.getElementById('mm-price').value = mapping?.price || '';
  document.getElementById('mm-price-manual').checked = mapping?.price_manual || false;
  document.getElementById('mm-support-manual').checked = mapping?.support_manual || false;
  document.getElementById('mm-mapping-id').value = id;
  document.getElementById('mm-code-dropdown').style.display = 'none';
  document.getElementById('modelmap-modal').querySelector('.modal-title').textContent = '모델 매핑 수정';
  document.getElementById('modelmap-modal').classList.add('open');
  lucide.createIcons();
}

function searchModelCode(search) {
  const dropdown = document.getElementById('mm-code-dropdown');
  const filtered = search === '' ? allModelCodes : allModelCodes.filter(m => m.code.toUpperCase().includes(search.toUpperCase()));
  if (filtered.length === 0) {
    dropdown.innerHTML = '<div style="padding:12px;color:var(--text-hint);text-align:center">검색 결과 없음</div>';
    dropdown.style.display = 'block';
    return;
  }
  dropdown.innerHTML = filtered.map(m => `
    <div onclick="selectModelCode('${m.code}')"
      style="padding:10px 12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-light);transition:background 0.15s"
      onmouseover="this.style.background='var(--primary-light)'"
      onmouseout="this.style.background='transparent'">
      <span style="font-family:monospace;font-weight:600;color:${m.is_active?'var(--text)':'var(--text-hint)'}">${m.code}</span>
      ${!m.is_active?'<span style="font-size:10px;font-weight:700;color:var(--text-hint);background:var(--border-light);padding:2px 6px;border-radius:4px">비활성</span>':''}
    </div>
  `).join('');
  dropdown.style.display = 'block';
}

function showModelCodeDropdown() { searchModelCode(document.getElementById('mm-model-code-input').value); }

function selectModelCode(code) {
  document.getElementById('mm-model-code-input').value = code;
  document.getElementById('mm-model-code').value = code;
  document.getElementById('mm-code-dropdown').style.display = 'none';
}

document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('mm-code-dropdown');
  const input = document.getElementById('mm-model-code-input');
  if (dropdown && input && !dropdown.contains(e.target) && e.target !== input) dropdown.style.display = 'none';
});

async function saveModelMap() {
  if (!canEdit('modelmap')) { toast('⚠️ 수정 권한이 없어요'); return; }
  const mappingId = document.getElementById('mm-mapping-id').value;
  const sktName = document.getElementById('mm-skt-name').value.trim();
  const modelCode = document.getElementById('mm-model-code').value;
  const priceStr = document.getElementById('mm-price').value.trim().replace(/,/g, '');
  const price = priceStr ? parseInt(priceStr) : null;
  const priceManual = document.getElementById('mm-price-manual').checked;
  const supportManual = document.getElementById('mm-support-manual').checked;
  if (!sktName) { toast('SKT 모델명을 입력해주세요'); return; }
  if (!modelCode) { toast('우주커넥트 모델코드를 선택해주세요'); return; }
  const payload = { skt_model_name: sktName, model_code: modelCode, price, price_manual: priceManual, support_manual: supportManual, is_active: true };
  let error;
  if (mappingId) { ({ error } = await sb.from('model_mapping').update(payload).eq('id', mappingId)); }
  else { ({ error } = await sb.from('model_mapping').insert(payload)); }
  if (error) { toast('저장 실패: ' + error.message); return; }
  toast(mappingId ? '✓ 매핑 수정 완료' : '✓ 매핑 저장 완료');
  closeModal('modelmap-modal');
  loadModelMap();
}

async function deleteModelMap(id) {
  if (!canEdit('modelmap')) { toast('⚠️ 수정 권한이 없어요'); return; }
  if (!confirm('이 매핑을 삭제하시겠습니까?')) return;
  await sb.from('model_mapping').delete().eq('id', id);
  toast('✓ 삭제 완료');
  loadModelMap();
}

async function showSktModelList() {
  const sktModels = [
    'IP15PM_1T','IP15PM_256G','IP15PM_512G','IP15P_128G','IP15P_1T','IP15P_256G','IP15P_512G',
    'IP16P_128G','IP16P_256G','IP16P_512G','IP16P_1T','IP16PL_128G','IP16PL_256G','IP16PL_512G',
    'IP16PM_256G','IP16PM_512G','IP16PM_1T',
    'IPHONE 12','IPHONE 12 MINI','IPHONE 13','IPHONE 13 DEMO','IPHONE 14','IPHONE 14 DEMO',
    'IPHONE 14 PLUS','IPHONE 14 PLUS DEMO','IPHONE 14 PRO','IPHONE 14 PRO DEMO',
    'IPHONE 14 PRO MAX','IPHONE 14 PRO MAX DEMO','IPHONE 15','IPHONE 15 PRO','IPHONE 15 PRO MAX','IPHONE 16 DEMO',
    'iPhone 15 128G','iPhone 15 256G','iPhone 15 512G',
    'iPhone 15 Plus 128G','iPhone 15 Plus 256G','iPhone 15 Plus 512G',
    'iPhone 16 128G','iPhone 16 256G','iPhone 16 512G',
    'iPhone 16e 128G','iPhone 16e 256G','iPhone 16e 512G',
    'iPhone 17 256G','iPhone 17 512G',
    'iPhone 17 Pro 1T','iPhone 17 Pro 256G','iPhone 17 Pro 512G',
    'iPhone 17 Pro Max 1T','iPhone 17 Pro Max 256G','iPhone 17 Pro Max 2T','iPhone 17 Pro Max 512G',
    'iPhone 17e 256G','iPhone 17e 512G','iPhone Air 1T','iPhone Air 256G','iPhone Air 512G',
    '아이폰 13 256G','아이폰 13_128G','아이폰 13_512G',
    '아이폰 14 프로 맥스_128G','아이폰 14 프로 맥스_1T','아이폰 14 프로 맥스_256G','아이폰 14 프로 맥스_512G',
    '아이폰 14 프로_128G','아이폰 14 프로_1T','아이폰 14 프로_256G','아이폰 14 프로_512G',
    '아이폰 14 플러스_128G','아이폰 14 플러스_256G','아이폰 14 플러스_512G',
    '갤럭시 S24 FE 256G','갤럭시 S24 울트라 5G 256G','갤럭시 S24 울트라 5G 512G',
    '갤럭시 S24+ 5G 256G','갤럭시 S24+ 5G 512G',
    '갤럭시 S25 256G','갤럭시 S25 512G','갤럭시 S25 FE 256G',
    '갤럭시 S25 엣지','갤럭시 S25 엣지 256G','갤럭시 S25 엣지 512G',
    '갤럭시 S25 울트라 1T','갤럭시 S25 울트라 256G','갤럭시 S25 울트라 512G',
    '갤럭시 S25+ 256G','갤럭시 S25+ 512G',
    '갤럭시 S26 256G','갤럭시 S26 512G',
    '갤럭시 S26 울트라 1T','갤럭시 S26 울트라 256G','갤럭시 S26 울트라 512G',
    '갤럭시 S26+ 256G','갤럭시 S26+ 512G',
    '갤럭시 Z 폴드5','갤럭시 Z 폴드5_512G','갤럭시 Z 폴드6','갤럭시 Z 폴드6_1T','갤럭시 Z 폴드6_512G',
    '갤럭시 Z 폴드7','갤럭시 Z 폴드7 1T','갤럭시 Z 폴드7 256G','갤럭시 Z 폴드7 512G','갤럭시 Z 폴드7_512G',
    '갤럭시 Z 플립5','갤럭시 Z 플립5_512G','갤럭시 Z 플립6','갤럭시 Z 플립6 256G','갤럭시 Z 플립6 512G','갤럭시 Z 플립6_512G',
    '갤럭시 Z 플립7','갤럭시 Z 플립7 256G','갤럭시 Z 플립7 512G','갤럭시 Z 플립7 FE','갤럭시 Z 플립7 FE 256G','갤럭시 Z 플립7_512G',
    '갤럭시 A25 5G 128G','갤럭시 A35 5G 128G','갤럭시 A36 128G','갤럭시 A36 5G',
    '갤럭시 와이드7','갤럭시 와이드7 128G','갤럭시 와이드8','갤럭시 와이드8 128G',
    '갤럭시 퀀텀6 128G','홍미 14C (4GB RAM) 128G','홍미노트 14 256G','홍미노트 14 프로 5G 256G','A165','A175',
  ];
  const uniqueModels = [...new Set(sktModels)];
  const groups = { 'iPhone': [], '갤럭시 S': [], '갤럭시 Z': [], '기타': [] };
  uniqueModels.forEach(name => {
    if (name.includes('iPhone')||name.includes('IPHONE')||name.includes('IP1')||name.includes('아이폰')) groups['iPhone'].push(name);
    else if (name.includes('갤럭시 S')||name.includes('S2')||name.includes('S3')||name.includes('S4')) groups['갤럭시 S'].push(name);
    else if (name.includes('갤럭시 Z')||name.includes('플립')||name.includes('폴드')) groups['갤럭시 Z'].push(name);
    else groups['기타'].push(name);
  });
  Object.keys(groups).forEach(k => groups[k].sort());
  const wrap = document.getElementById('skt-model-tags');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '16px';
  wrap.innerHTML = Object.keys(groups).filter(g => groups[g].length).map(groupName => `
    <div>
      <div style="font-size:12px;font-weight:700;color:var(--text-sub);margin-bottom:8px;padding-left:4px">${groupName}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${groups[groupName].map(name => `
          <span onclick="openModelMapModal('${name}')"
            style="background:var(--primary-light);color:var(--primary);padding:5px 12px;border-radius:100px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid transparent;transition:all .15s"
            onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='transparent'">${name}</span>`).join('')}
      </div>
    </div>`).join('');
}

// ─── 요금제 관리 ───
let plansCache = [];

async function loadPlans() {
  const tbody = document.getElementById('plan-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="loading">로딩중...</td></tr>';
  const { data, error } = await sb.from('plans').select('*').order('monthly_fee', { ascending: false }).order('created_at');
  if (error) { tbody.innerHTML = '<tr><td colspan="6" class="empty">불러오기 실패</td></tr>'; return; }
  plansCache = data || [];
  renderPlansTable();
}

function renderPlansTable() {
  const tbody = document.getElementById('plan-tbody');
  if (!tbody) return;
  if (!plansCache.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">등록된 요금제가 없어요</td></tr>'; return; }
  const editable = canEdit('plans');
  tbody.innerHTML = plansCache.map((p, i) => `
    <tr>
      <td style="text-align:center;color:var(--text-hint);font-size:12px">${i+1}</td>
      <td style="font-weight:600">${p.name}</td>
      <td style="text-align:right">${p.monthly_fee ? p.monthly_fee.toLocaleString()+'원' : '-'}</td>
      <td style="text-align:center"><span class="badge" style="background:var(--purple-bg);color:var(--purple)">${p.plan_group || '-'}</span></td>
      <td style="text-align:center">
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:${editable?'pointer':'not-allowed'};font-size:13px;opacity:${editable?1:0.5}">
          <input type="checkbox" ${p.is_active?'checked':''} ${editable?`onchange="togglePlan('${p.id}',this.checked)"`:'disabled'} style="width:16px;height:16px;accent-color:var(--primary)"/>
          <span style="color:${p.is_active?'var(--green)':'var(--text-hint)'}">${p.is_active?'활성':'비활성'}</span>
        </label>
      </td>
      <td style="text-align:center;white-space:nowrap;position:sticky;right:0;background:var(--white);box-shadow:-2px 0 4px rgba(0,0,0,0.06)">
        ${editable
          ? `<div style="display:inline-flex;gap:6px"><button class="btn btn-outline btn-sm" onclick="openEditPlan(${i})">수정</button><button class="btn btn-danger btn-sm" onclick="deletePlan('${p.id}')">삭제</button></div>`
          : '<span style="font-size:12px;color:var(--text-hint)">보기 전용</span>'}
      </td>
    </tr>
  `).join('');
}

function openAddPlan() {
  document.getElementById('plan-modal-title').textContent = '요금제 추가';
  document.getElementById('pl-id').value = '';
  document.getElementById('pl-name').value = '';
  document.getElementById('pl-fee').value = '';
  document.getElementById('pl-group').value = '';
  openModal('plan-modal');
}

function openEditPlan(i) {
  const p = plansCache[i];
  document.getElementById('plan-modal-title').textContent = '요금제 수정';
  document.getElementById('pl-id').value = p.id;
  document.getElementById('pl-name').value = p.name;
  document.getElementById('pl-fee').value = p.monthly_fee || '';
  document.getElementById('pl-group').value = p.plan_group || '';
  openModal('plan-modal');
}

async function savePlan() {
  if (!canEdit('plans')) { toast('⚠️ 수정 권한이 없어요'); return; }
  const id = document.getElementById('pl-id').value;
  const name = document.getElementById('pl-name').value.trim();
  const fee = parseInt(document.getElementById('pl-fee').value) || 0;
  const group = document.getElementById('pl-group').value;
  if (!name) { toast('요금제명을 입력해주세요'); return; }
  if (!group) { toast('요금제군을 선택해주세요'); return; }
  const payload = { name, monthly_fee: fee, plan_group: group };
  let error;
  if (id) { ({ error } = await sb.from('plans').update(payload).eq('id', id)); }
  else { ({ error } = await sb.from('plans').insert(payload)); }
  if (error) { toast('저장 실패: ' + error.message); return; }
  closeModal('plan-modal');
  toast(id ? '✓ 요금제 수정 완료' : '✓ 요금제 추가 완료');
  loadPlans();
}

async function togglePlan(id, active) {
  if (!canEdit('plans')) { toast('⚠️ 수정 권한이 없어요'); return; }
  const { error } = await sb.from('plans').update({ is_active: active }).eq('id', id);
  if (error) { toast('변경 실패'); loadPlans(); return; }
  const p = plansCache.find(p => p.id === id);
  if (p) p.is_active = active;
  renderPlansTable();
}

async function deletePlan(id) {
  if (!canEdit('plans')) { toast('⚠️ 수정 권한이 없어요'); return; }
  if (!confirm('요금제를 삭제하면 연결된 공통지원금도 삭제됩니다. 계속할까요?')) return;
  const { error } = await sb.from('plans').delete().eq('id', id);
  if (error) { toast('삭제 실패: ' + error.message); return; }
  toast('✓ 삭제 완료');
  loadPlans();
}

async function updateColorFilter() {
  const model = document.getElementById('inv-filter-model').value;
  const colorSel = document.getElementById('inv-filter-color');
  colorSel.innerHTML = '<option value="">전체 색상</option>';
  if (!model) return;
  const { data } = await sb.from('inventory').select('color').eq('model', model).order('color');
  const colors = [...new Set(data?.map(i => i.color).filter(Boolean))];
  colors.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c; colorSel.appendChild(opt); });
}


// ─── 파일함 ───
let filesData = { shared: [], private: [] };
let pendingUploadFiles = null;
let currentFilesTab = 'shared';

function switchFilesTab(tab) {
  currentFilesTab = tab;
  document.querySelectorAll('.inv-tab[id^="files-tab"]').forEach(t => t.classList.remove('active'));
  document.getElementById('files-tab-' + tab).classList.add('active');
  document.getElementById('files-panel-shared').style.display = tab === 'shared' ? '' : 'none';
  document.getElementById('files-panel-private').style.display = tab === 'private' ? '' : 'none';
}

function formatFileSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(mimeType, name) {
  if (!mimeType && name) {
    const ext = name.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return '📄';
    if (['xlsx','xls','csv'].includes(ext)) return '📊';
    if (['docx','doc'].includes(ext)) return '📝';
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return '🖼️';
    if (['zip','rar','7z'].includes(ext)) return '📦';
    return '📎';
  }
  if (mimeType?.includes('pdf')) return '📄';
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel') || mimeType?.includes('csv')) return '📊';
  if (mimeType?.includes('word') || mimeType?.includes('document')) return '📝';
  if (mimeType?.includes('image')) return '🖼️';
  if (mimeType?.includes('zip') || mimeType?.includes('compressed')) return '📦';
  return '📎';
}

async function loadFiles() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  // 파일 업로드 이벤트 등록 (최초 1회만)
  const fileBtn = document.getElementById('file-upload-btn');
  const fileInput = document.getElementById('file-upload-input');
  if (fileBtn && fileInput && !fileBtn._bound) {
    fileBtn._bound = true;
    fileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', function() {
      handleFileUpload(this);
    });
  }

  // 공용 파일 로드
  const { data: sharedFiles } = await sb.from('files').select('*').eq('scope', 'shared').order('created_at', { ascending: false });
  filesData.shared = sharedFiles || [];

  // 개인 파일 로드 (본인 것만)
  const { data: privateFiles } = await sb.from('files').select('*').eq('scope', 'private').eq('uploaded_by', user.id).order('created_at', { ascending: false });
  filesData.private = privateFiles || [];

  renderFilesTable('shared');
  renderFilesTable('private');
  loadStorageUsage();
}

async function loadStorageUsage() {
  const { data: allFiles } = await sb.from('files').select('size, scope');
  if (!allFiles) return;

  const totalBytes = allFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  const limitBytes = 1024 * 1024 * 1024; // 1GB
  const pct = Math.min((totalBytes / limitBytes) * 100, 100).toFixed(1);

  const bar = document.getElementById('files-storage-bar');
  const text = document.getElementById('files-storage-text');
  const used = document.getElementById('files-storage-used');

  if (bar) {
    bar.style.width = pct + '%';
    bar.style.background = pct > 80 ? 'var(--red)' : pct > 60 ? 'var(--orange)' : 'var(--primary)';
  }
  if (text) text.textContent = `${pct}% 사용중`;
  if (used) used.textContent = `${formatFileSize(totalBytes)} / 1GB · 파일 ${allFiles.length}개`;
}

function renderFilesTable(scope) {
  const search = document.getElementById(`files-search-${scope}`)?.value.toLowerCase() || '';
  const filtered = filesData[scope].filter(f => !search || f.original_name.toLowerCase().includes(search) || (f.memo || '').toLowerCase().includes(search));
  const tbody = document.getElementById(`files-tbody-${scope}`);
  if (!tbody) return;

  if (!filtered.length) {
    const cols = scope === 'shared' ? 6 : 5;
    tbody.innerHTML = `<tr><td colspan="${cols}" class="empty">파일이 없어요. 업로드 버튼을 눌러 추가하세요.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(f => {
    const icon = getFileIcon(f.mime_type, f.original_name);
    const date = new Date(f.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const sharedCol = scope === 'shared' ? `<td style="font-size:12px;color:var(--text-sub)">${f.uploaded_by_email?.split('@')[0] || '-'}</td>` : '';
    const memoDisplay = f.memo
      ? `<span style="font-size:12px;color:var(--text-sub)">${f.memo}</span>`
      : `<span style="font-size:12px;color:var(--text-hint)">-</span>`;
    return `<tr>
      <td>
        <span style="margin-right:6px">${icon}</span>
        <span style="font-weight:600">${f.original_name}</span>
      </td>
      <td style="min-width:160px">
        <div style="display:flex;align-items:center;gap:6px">
          ${memoDisplay}
          <button style="background:none;border:none;cursor:pointer;color:var(--text-hint);padding:2px 4px;border-radius:4px;flex-shrink:0" onclick="editFileMemo('${f.id}','${scope}',this)" title="메모 수정">
            <i data-lucide="pencil" style="width:11px;height:11px"></i>
          </button>
        </div>
      </td>
      <td style="font-size:12px;color:var(--text-sub)">${formatFileSize(f.size)}</td>
      ${sharedCol}
      <td style="font-size:12px;color:var(--text-sub)">${date}</td>
      <td style="display:flex;gap:6px;justify-content:flex-end">
        <button class="btn btn-outline btn-sm" onclick="downloadFile('${f.id}','${f.bucket}','${f.path}','${f.original_name}')">
          <i data-lucide="download" style="width:12px;height:12px"></i> 다운로드
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteFile('${f.id}','${f.bucket}','${f.path}','${scope}')">삭제</button>
      </td>
    </tr>`;
  }).join('');
  lucide.createIcons();
}

function filterFiles(scope) {
  renderFilesTable(scope);
}

function handleFileUpload(input) {
  if (!input.files?.length) return;
  // files를 배열로 복사해서 저장 (input.value 초기화해도 유지됨)
  pendingUploadFiles = Array.from(input.files);
  const names = pendingUploadFiles.map(f => f.name).join(', ');
  const el = document.getElementById('files-scope-names');
  if (el) el.textContent = `📎 ${pendingUploadFiles.length}개 파일: ${names.length > 60 ? names.slice(0, 60) + '...' : names}`;
  document.getElementById('files-scope-modal').classList.add('open');
  input.value = '';
  lucide.createIcons();
}

async function selectScope(scope) {
  closeModal('files-scope-modal');
  if (!pendingUploadFiles) return;

  const { data: { user } } = await sb.auth.getUser();
  const bucket = scope === 'shared' ? 'shared-files' : 'private-files';
  const memo = document.getElementById('file-upload-memo')?.value.trim() || null;

  toast('업로드 중...');
  let successCount = 0;

  for (const file of pendingUploadFiles) {
    try {
      const ext = file.name.split('.').pop();
      const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const path = scope === 'private' ? `${user.id}/${uniqueName}` : uniqueName;

      const { error: uploadError } = await sb.storage.from(bucket).upload(path, file);
      if (uploadError) { toast('업로드 실패: ' + uploadError.message); continue; }

      const { error: dbError } = await sb.from('files').insert({
        name: uniqueName,
        original_name: file.name,
        size: file.size,
        mime_type: file.type,
        bucket,
        path,
        uploaded_by: user.id,
        uploaded_by_email: user.email,
        scope,
        memo,
      });
      if (dbError) { toast('DB 저장 실패: ' + dbError.message); continue; }
      successCount++;
    } catch (e) {
      toast('오류: ' + e.message);
    }
  }

  pendingUploadFiles = null;
  document.getElementById('file-upload-memo').value = '';
  if (successCount > 0) {
    toast(`✓ ${successCount}개 업로드 완료`);
    await loadFiles();
    switchFilesTab(scope);
  }
}

async function editFileMemo(id, scope, btn) {
  const file = filesData[scope].find(f => f.id === id);
  if (!file) return;
  const currentMemo = file.memo || '';
  const newMemo = prompt('메모를 입력하세요:', currentMemo);
  if (newMemo === null) return; // 취소
  const { error } = await sb.from('files').update({ memo: newMemo.trim() || null }).eq('id', id);
  if (error) { toast('저장 실패'); return; }
  file.memo = newMemo.trim() || null;
  renderFilesTable(scope);
  toast('✓ 메모 저장됨');
}

async function downloadFile(id, bucket, path, originalName) {
  try {
    const { data, error } = await sb.storage.from(bucket).download(path);
    if (error) { toast('다운로드 실패: ' + error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = originalName;
    a.click();
    URL.revokeObjectURL(url);
    toast('✓ 다운로드 완료');
  } catch (e) {
    toast('오류: ' + e.message);
  }
}

async function deleteFile(id, bucket, path, scope) {
  if (!confirm('이 파일을 삭제할까요?')) return;
  const { error: storageError } = await sb.storage.from(bucket).remove([path]);
  if (storageError) { toast('스토리지 삭제 실패'); return; }
  const { error: dbError } = await sb.from('files').delete().eq('id', id);
  if (dbError) { toast('DB 삭제 실패'); return; }
  toast('✓ 삭제됐어요');
  filesData[scope] = filesData[scope].filter(f => f.id !== id);
  renderFilesTable(scope);
  loadStorageUsage();
}

// ─── 정산 설정 모달 HTML 주입 ───
function injectSettlSettingsModal() {
  if (document.getElementById('settl-settings-modal')) return;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'settl-settings-modal';
  modal.style.cssText = 'align-items:flex-start;padding-top:60px';
  modal.innerHTML = `
    <div class="modal" style="max-width:720px;width:100%">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 20px 0">
        <div class="modal-title">정산 설정</div>
        <button class="modal-close" onclick="closeModal('settl-settings-modal')">×</button>
      </div>
      <!-- 탭 -->
      <div style="display:flex;border-bottom:2px solid var(--border);padding:0 20px;margin-top:12px">
        <button id="sset-tab-settings" onclick="switchSettlSettingsTab('settings')" style="padding:8px 16px;border:none;background:none;font-size:13px;font-weight:700;color:var(--primary);border-bottom:2px solid var(--primary);margin-bottom:-2px;cursor:pointer">⚙️ 설정</button>
      </div>
      <!-- 설정 탭 -->
      <div id="sset-panel-settings" class="modal-body" style="max-height:60vh;overflow-y:auto;padding-top:20px">

        <!-- 마스콜3 -->
        <div style="margin-bottom:24px">
          <div style="font-size:12px;font-weight:800;color:var(--text-hint);letter-spacing:1px;text-transform:uppercase;margin-bottom:12px">마스콜3 금액</div>
          <div id="sset-mascall-body"></div>
        </div>

        <!-- T올케어 -->
        <div style="margin-bottom:24px">
          <div style="font-size:12px;font-weight:800;color:var(--text-hint);letter-spacing:1px;text-transform:uppercase;margin-bottom:12px">T올케어 금액</div>
          <div id="sset-tallcare-body"></div>
        </div>

        <!-- 추가지원금 정책 -->
        <div style="margin-bottom:8px">
          <div style="font-size:12px;font-weight:800;color:var(--text-hint);letter-spacing:1px;text-transform:uppercase;margin-bottom:12px">추가지원금 정책 규칙</div>
          <div style="font-size:12px;color:var(--text-hint);margin-bottom:12px">선약 + 해당 모델 + 추가지원금 ≥ 기준금액일 때 정책금액 자동입력</div>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px">
            <thead>
              <tr style="border-bottom:2px solid var(--border)">
                <th style="padding:8px;text-align:left;color:var(--text-sub)">모델</th>
                <th style="padding:8px;text-align:right;color:var(--text-sub)">기준 추가지원금</th>
                <th style="padding:8px;text-align:right;color:var(--text-sub)">정책 금액</th>
                <th style="padding:8px;text-align:center;color:var(--text-sub)">삭제</th>
              </tr>
            </thead>
            <tbody id="sset-policy-tbody"></tbody>
          </table>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <div style="flex:1;min-width:140px;position:relative">
              <input id="sset-policy-model-input" placeholder="모델 검색..." autocomplete="off"
                style="width:100%;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 10px;font-size:12px;font-family:monospace;background:var(--white);color:var(--text)"
                oninput="ssetFilterModelDd(this.value)"
                onfocus="ssetFilterModelDd(this.value)"
              />
              <input type="hidden" id="sset-policy-model"/>
              <div id="sset-model-dd" style="display:none;position:absolute;top:36px;left:0;right:0;background:var(--white);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-md);z-index:999;max-height:180px;overflow-y:auto"></div>
            </div>
            <input id="sset-policy-min" type="number" placeholder="기준금액 (예: 200000)" style="width:150px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 10px;font-size:12px;background:var(--white);color:var(--text)"/>
            <input id="sset-policy-amt" type="number" placeholder="정책금액 (예: 100000)" style="width:150px;height:34px;border:1px solid var(--border);border-radius:6px;padding:0 10px;font-size:12px;background:var(--white);color:var(--text)"/>
            <button class="btn btn-primary btn-sm" onclick="addAddPolicyRule()">추가</button>
          </div>
        </div>
      </div>
      <div class="modal-footer" id="sset-footer-settings" style="display:flex;justify-content:center;gap:8px;padding:16px 20px;border-top:1px solid var(--border-light)">
        <button class="btn btn-outline" onclick="closeModal('settl-settings-modal')">취소</button>
        <button class="btn btn-primary" onclick="saveSettlSettings()">저장</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// 정산 설정 탭 전환
function switchSettlSettingsTab(tab) {
  document.getElementById('sset-panel-settings').style.display = '';
  const btnSettings = document.getElementById('sset-tab-settings');
  if (btnSettings) {
    btnSettings.style.color = 'var(--primary)';
    btnSettings.style.borderBottom = '2px solid var(--primary)';
  }
}

// 정책 목록 모달 내 렌더
async function renderPolicyListInModal() {
  await loadPolicyList();
  const el = document.getElementById('sset-policy-list');
  if (!el) return;
  // lucide 아이콘 재초기화 (footer 버튼 포함)
  setTimeout(() => lucide.createIcons(), 50);

  if (!policyList.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-hint)">등록된 정책이 없어요<br><span style="font-size:12px">아래 버튼으로 정책 파일을 등록해 주세요</span></div>';
    return;
  }
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr style="background:var(--border-light)">
        <th style="padding:8px 12px;text-align:left;color:var(--text-sub);width:80px">정책명</th>
        <th style="padding:8px 12px;text-align:left;color:var(--text-sub);width:140px">시작 일시</th>
        <th style="padding:8px 12px;text-align:left;color:var(--text-sub)">파일명</th>
        <th style="padding:8px 12px;text-align:center;color:var(--text-sub);width:110px">관리</th>
      </tr>
    </thead>
    <tbody>
      ${policyList.map(p => {
        const dt = new Date(p.started_at);
        const localStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
        const dtInput = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}T${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
        const fname = p.file_name || '-';
        return `
        <tr id="policy-row-${p.id}" style="border-bottom:1px solid var(--border-light)">
          <td style="padding:8px 12px;font-weight:700">
            <span id="policy-name-txt-${p.id}">${p.policy_name}</span>
            <input id="policy-name-edit-${p.id}" class="modal-input" value="${p.policy_name}" style="display:none;height:30px;font-size:13px;width:70px;padding:0 8px"/>
          </td>
          <td style="padding:8px 12px;font-size:12px;color:var(--text-sub)">
            <span id="policy-date-txt-${p.id}">${localStr}</span>
            <input id="policy-date-edit-${p.id}" type="datetime-local" class="modal-input" value="${dtInput}" style="display:none;height:30px;font-size:12px;width:155px;padding:0 8px"/>
          </td>
          <td style="padding:8px 12px;font-size:12px;color:var(--text-hint)">
            <span id="policy-file-txt-${p.id}" style="word-break:break-all">${fname}</span>
            <label id="policy-file-edit-${p.id}" style="display:none;align-items:center;gap:5px;height:30px;padding:0 8px;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:12px;color:var(--text-sub);white-space:nowrap;max-width:200px">
              <i data-lucide="paperclip" style="width:12px;height:12px;flex-shrink:0"></i>
              <span id="policy-file-edit-name-${p.id}" style="overflow:hidden;text-overflow:ellipsis">변경 안함</span>
              <input type="file" accept=".xlsx,.xls" style="display:none" onchange="ssetPolicyEditFileSelected(this,'${p.id}')"/>
            </label>
          </td>
          <td style="padding:8px 12px;text-align:center;white-space:nowrap">
            <span id="policy-btns-view-${p.id}">
              <button onclick="editPolicyInModal('${p.id}')" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:13px;font-weight:600;margin-right:6px">수정</button>
              <button onclick="deletePolicyFromModal('${p.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:13px;font-weight:600">삭제</button>
            </span>
            <span id="policy-btns-edit-${p.id}" style="display:none">
              <button onclick="savePolicyEdit('${p.id}')" style="background:none;border:none;color:var(--green);cursor:pointer;font-size:13px;font-weight:700;margin-right:6px">저장</button>
              <button onclick="cancelPolicyEdit('${p.id}')" style="background:none;border:none;color:var(--text-hint);cursor:pointer;font-size:13px;font-weight:600">취소</button>
            </span>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
  setTimeout(() => lucide.createIcons(), 50);
}

function editPolicyInModal(id) {
  document.getElementById(`policy-name-txt-${id}`).style.display = 'none';
  document.getElementById(`policy-date-txt-${id}`).style.display = 'none';
  document.getElementById(`policy-file-txt-${id}`).style.display = 'none';
  document.getElementById(`policy-name-edit-${id}`).style.display = 'inline-block';
  document.getElementById(`policy-date-edit-${id}`).style.display = 'inline-block';
  document.getElementById(`policy-file-edit-${id}`).style.display = 'inline-flex';
  document.getElementById(`policy-btns-view-${id}`).style.display = 'none';
  document.getElementById(`policy-btns-edit-${id}`).style.display = 'inline';
  document.getElementById(`policy-name-edit-${id}`).focus();
}

function cancelPolicyEdit(id) {
  document.getElementById(`policy-name-txt-${id}`).style.display = '';
  document.getElementById(`policy-date-txt-${id}`).style.display = '';
  document.getElementById(`policy-file-txt-${id}`).style.display = '';
  document.getElementById(`policy-name-edit-${id}`).style.display = 'none';
  document.getElementById(`policy-date-edit-${id}`).style.display = 'none';
  document.getElementById(`policy-file-edit-${id}`).style.display = 'none';
  document.getElementById(`policy-btns-view-${id}`).style.display = '';
  document.getElementById(`policy-btns-edit-${id}`).style.display = 'none';
  delete window[`_policyEditFile_${id}`];
}

function ssetPolicyEditFileSelected(input, id) {
  const file = input.files[0];
  if (!file) return;
  window[`_policyEditFile_${id}`] = file;
  document.getElementById(`policy-file-edit-name-${id}`).textContent = file.name;
}

async function savePolicyEdit(id) {
  const name = document.getElementById(`policy-name-edit-${id}`).value.trim();
  const date = document.getElementById(`policy-date-edit-${id}`).value;
  if (!name) { toast('정책명을 입력해 주세요'); return; }
  if (!date) { toast('시작 일시를 입력해 주세요'); return; }

  const updateData = {
    policy_name: name,
    started_at: new Date(date).toISOString()
  };

  // 파일 새로 올린 경우 파싱 후 data/file_name도 업데이트
  const newFile = window[`_policyEditFile_${id}`];
  if (newFile) {
    try {
      const parsed = await parsePolicyExcel(newFile);
      if (!Object.keys(parsed).length) { toast('파일 파싱 실패: 데이터가 없어요'); return; }
      updateData.data = parsed;
      updateData.file_name = newFile.name;
    } catch(e) {
      toast('파일 파싱 오류: ' + e.message); return;
    }
  }

  const { error } = await sb.from('policy_files').update(updateData).eq('id', id);
  if (error) { toast('수정 실패: ' + error.message); return; }
  delete window[`_policyEditFile_${id}`];
  toast(`✓ 정책 ${name} 수정 완료`);
  await renderPolicyListInModal();
}

async function deletePolicyFromModal(id) {
  if (!confirm('이 정책을 삭제할까요?')) return;
  const { error } = await sb.from('policy_files').delete().eq('id', id);
  if (error) { toast('삭제 실패: ' + error.message); return; }
  toast('✓ 삭제됐어요');
  renderPolicyListInModal();
}

// ─── 정책 관리 페이지 ───
let _policyPageFile = null;
let _policyPageParsed = null;
let _policyRawWb = null;
let _policyCurrentSheet = null;

// 드래그 이벤트
function policyDragOver(e) {
  e.preventDefault();
  const z = document.getElementById('policy-drop-zone');
  z.style.borderColor = 'var(--primary)';
  z.style.background  = 'var(--primary-light)';
}
function policyDragLeave(e) {
  const z = document.getElementById('policy-drop-zone');
  z.style.borderColor = 'var(--border)';
  z.style.background  = '';
}
function policyDrop(e) {
  e.preventDefault();
  policyDragLeave(e);
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (!file.name.match(/\.(xlsx|xls)$/i)) { toast('xlsx 파일만 업로드 가능해요'); return; }
  processPolicyFile(file);
}

function onPolicyFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  processPolicyFile(file);
}

async function processPolicyFile(file) {
  _policyPageFile = file;
  _policyPageParsed = null;

  document.getElementById('policy-file-name').textContent = file.name;
  const status = document.getElementById('policy-upload-status');
  status.style.display = 'block';
  status.style.color   = 'var(--orange)';
  status.textContent   = '파일 분석 중...';
  document.getElementById('policy-preview-area').style.display = 'none';

  // 호수 자동 추출
  const mHosu = file.name.match(/(\d+(?:-\d+)?호)/);
  if (mHosu) document.getElementById('policy-name-input').value = mHosu[1];

  try {
    const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf, { type: 'array', cellDates: true });

    // wb를 직접 넘겨서 재파싱 없이 사용
    _policyPageParsed = await parsePolicyExcelFromWb(wb, XLSX);

    const sheets    = Object.keys(_policyPageParsed);
    const totalKeys = sheets.reduce((s, k) => s + Object.keys(_policyPageParsed[k]).length, 0);
    status.style.color = 'var(--green)';
    status.textContent = `✓ 파싱 완료 — ${sheets.join(', ')} · 총 ${totalKeys.toLocaleString()}개 조합`;

    // 뷰 표시
    _policyCurrentSheet = sheets[0];
    const titleEl = document.getElementById('policy-view-title');
    if (titleEl) titleEl.textContent = '원본 뷰';
    const descEl = document.getElementById('policy-raw-desc');
    if (descEl) descEl.textContent = '';
    renderPolicySheetTabs();
    renderPolicyTableView(_policyCurrentSheet);
    document.getElementById('policy-preview-area').style.display = 'block';

  } catch(e) {
    status.style.color = 'var(--red)';
    status.textContent = '파싱 실패: ' + e.message;
    console.error(e);
  }
}

// ── 시트 탭 ──
function renderPolicySheetTabs() {
  const container = document.getElementById('policy-sheet-tabs');
  if (!container || !_policyPageParsed) return;
  const sheets = Object.keys(_policyPageParsed);
  container.innerHTML = sheets.map(name => `
    <button onclick="policySelectSheet('${name}')" id="pstab-${name}"
      style="padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;
             border:1px solid var(--primary);transition:all .15s;
             background:${name === _policyCurrentSheet ? 'var(--primary)' : 'var(--white)'};
             color:${name === _policyCurrentSheet ? 'white' : 'var(--primary)'}">
      ${name}
    </button>`).join('');
  const desc = document.getElementById('policy-raw-desc');
  if (desc && !desc.textContent) desc.textContent = `총 ${sheets.length}개 그룹`;
}

function policySelectSheet(name) {
  _policyCurrentSheet = name;
  renderPolicySheetTabs();
  renderPolicyTableView(name);
}

// ── 파싱 결과 기반 교차표 ──
function renderPolicyTableView(sheetName) {
  const area = document.getElementById('policy-raw-table');
  if (!area || !_policyPageParsed) return;

  const sheet = _policyPageParsed[sheetName];
  if (!sheet) { area.innerHTML = '<div style="padding:20px;color:var(--text-hint)">데이터 없음</div>'; return; }

  // 새 구조: { blocks, data } / 구 구조(보기): 플랫 객체
  const blocks = sheet.blocks || null;

  function buildTable(models, blockData, planGroupOrder) {
    if (!models.length) return '';
    const ratesOrdered = planGroupOrder ? [...planGroupOrder] : [];
    const actTypesOrdered = [];
    const seenR = new Set(ratesOrdered), seenA = new Set(), seenC = new Set();
    const CONTRACT_ORDER = ['공통','공시','선약'];

    models.forEach(m => {
      Object.keys(blockData).filter(k => k.startsWith(m+'||')).forEach(k => {
        const [,r,a,c] = k.split('||');
        if (!seenR.has(r)) { seenR.add(r); ratesOrdered.push(r); }
        if (!seenA.has(a)) { seenA.add(a); actTypesOrdered.push(a); }
        seenC.add(c);
      });
    });
    const contractsOrdered = CONTRACT_ORDER.filter(c => seenC.has(c));

    const cols = [];
    ratesOrdered.forEach(rate => {
      actTypesOrdered.forEach(act => {
        contractsOrdered.forEach(ct => {
          if (models.some(m => blockData[`${m}||${rate}||${act}||${ct}`] !== undefined))
            cols.push({ rate, act, contract: ct });
        });
      });
    });

    // 헤더 행1: 요금제
    const rateSpans = {};
    cols.forEach(c => { rateSpans[c.rate] = (rateSpans[c.rate]||0)+1; });
    const ratesDone = new Set();
    let h1 = `<tr><th rowspan="3" style="border:1px solid var(--border);padding:6px 8px;font-size:11px;font-weight:700;background:#1E2433;color:white;position:sticky;left:0;z-index:3;min-width:90px;max-width:90px;width:90px">모델코드</th>`;
    cols.forEach(c => {
      if (ratesDone.has(c.rate)) return;
      ratesDone.add(c.rate);
      h1 += `<th colspan="${rateSpans[c.rate]}" style="border:1px solid var(--border);padding:4px 5px;font-size:11px;font-weight:700;background:#EFF6FF;color:var(--primary);text-align:center">${c.rate}</th>`;
    });
    h1 += '</tr>';

    // 헤더 행2: MNP/기변
    const actSpans = {};
    cols.forEach(c => { const k=`${c.rate}__${c.act}`; actSpans[k]=(actSpans[k]||0)+1; });
    const actsDone = new Set();
    let h2 = '<tr>';
    cols.forEach(c => {
      const k = `${c.rate}__${c.act}`;
      if (actsDone.has(k)) return; actsDone.add(k);
      const bg = c.act==='MNP' ? 'background:#F0FDF4;color:var(--green)' : 'background:#FFF7ED;color:var(--orange)';
      h2 += `<th colspan="${actSpans[k]}" style="border:1px solid var(--border);padding:3px 5px;font-size:11px;font-weight:700;text-align:center;${bg}">${c.act}</th>`;
    });
    h2 += '</tr>';

    // 헤더 행3: 공통/선약/공시
    let h3 = '<tr>';
    cols.forEach(c => {
      const bg = (c.contract==='공통'||c.contract==='공시') ? 'background:#FFFBEB;color:#92400E' : 'background:#F5F3FF;color:var(--purple)';
      h3 += `<th style="border:1px solid var(--border);padding:3px 4px;font-size:10px;font-weight:700;text-align:center;min-width:46px;${bg}">${c.contract}</th>`;
    });
    h3 += '</tr>';

    // 데이터 행
    let tbody = '';
    models.forEach((model, mi) => {
      const bg = mi%2===0 ? '#fff' : '#FAFBFF';
      let row = `<td style="border:1px solid var(--border);padding:3px 6px;font-size:11px;font-weight:700;font-family:monospace;position:sticky;left:0;z-index:1;min-width:90px;max-width:90px;width:90px;background:${bg}">${model}</td>`;
      cols.forEach(c => {
        const val = blockData[`${model}||${c.rate}||${c.act}||${c.contract}`];
        if (val === undefined) {
          row += `<td style="border:1px solid var(--border);padding:3px 4px;color:var(--text-hint);text-align:center;font-size:11px;background:${bg}">-</td>`;
        } else {
          const color = val<0 ? 'var(--red)' : val===0 ? 'var(--text-hint)' : 'var(--text)';
          const fw = val!==0 ? '600' : '400';
          row += `<td style="border:1px solid var(--border);padding:3px 4px;text-align:center;font-size:11px;color:${color};font-weight:${fw};background:${bg}">${val.toLocaleString()}</td>`;
        }
      });
      tbody += `<tr>${row}</tr>`;
    });

    return `<table style="border-collapse:collapse;white-space:nowrap;width:auto"><thead style="position:sticky;top:0;z-index:2">${h1}${h2}${h3}</thead><tbody>${tbody}</tbody></table>`;
  }

  let html = '';

  if (blocks) {
    // label 있는 블록끼리 가로로 묶기, label 없으면 세로로
    // label 있는 블록 그룹 (협력점/액면/요청) vs label 없는 블록
    const labeled   = blocks.filter(b => b.label);
    const unlabeled = blocks.filter(b => !b.label);

    if (labeled.length > 0) {
      // label 종류 추출 (순서 유지)
      const labelTypes = [...new Set(labeled.map(b => b.label))];
      // 행 수 = 각 label당 블록 수 (위/아래)
      const rowCount = labeled.filter(b => b.label === labelTypes[0]).length;

      for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
        if (rowIdx > 0) html += `<div style="height:10px;background:var(--border-light);border-top:2px solid var(--border);border-bottom:2px solid var(--border)"></div>`;
        html += `<div style="display:flex;gap:0;align-items:flex-start">`;
        labelTypes.forEach((lbl, gi) => {
          const block = labeled.filter(b => b.label === lbl)[rowIdx];
          if (!block) return;
          html += `<div style="flex:none;border-right:${gi < labelTypes.length-1 ? '2px solid var(--border)' : 'none'}">`;

          html += `<div style="padding:4px 10px;font-size:11px;font-weight:700;color:var(--text-sub);background:var(--border-light);border-bottom:1px solid var(--border)">${lbl}</div>`;
          html += buildTable(block.models, block.data, block.planGroupOrder);
          html += `</div>`;
        });
        html += `</div>`;
      }
    }

    if (unlabeled.length > 0) {
      if (labeled.length > 0) html += `<div style="height:10px;background:var(--border-light);border-top:2px solid var(--border);border-bottom:2px solid var(--border)"></div>`;
      unlabeled.forEach((block, bi) => {
        if (bi > 0) html += `<div style="height:10px;background:var(--border-light);border-top:2px solid var(--border);border-bottom:2px solid var(--border)"></div>`;
        html += buildTable(block.models, block.data, block.planGroupOrder);
      });
    }
  } else {
    // 구 구조(DB 보기): 플랫 데이터 → 단일 테이블
    const allModels = [];
    const seenM = new Set();
    Object.keys(sheet).forEach(k => {
      const m = k.split('||')[0];
      if (!seenM.has(m)) { seenM.add(m); allModels.push(m); }
    });
    html = buildTable(allModels, sheet);
  }

  area.innerHTML = html || '<div style="padding:20px;color:var(--text-hint)">데이터 없음</div>';
}

// ── 구 원본 뷰 (미사용) ──
async function renderPolicyRawView_legacy(sheetName) {
  const area = document.getElementById('policy-raw-table');
  if (!area || !_policyRawWb) return;
  area.innerHTML = '<div style="padding:20px;color:var(--text-hint);font-size:13px">렌더링 중...</div>';

  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
  const ws   = _policyRawWb.Sheets[sheetName];
  if (!ws) { area.innerHTML = ''; return; }
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // 유효 열 범위
  let maxCol = 0;
  data.forEach(row => row && row.forEach((v, i) => { if (v !== null && v !== undefined) maxCol = Math.max(maxCol, i); }));

  // 헤더/구분선 행 감지
  let h1 = -1, h2 = -1, sepRow = -1;
  data.forEach((row, i) => {
    if (!row) return;
    if (row[1] === '모델명' && h1 === -1) h1 = i;
    else if (row[1] === '모델명') h2 = i;
    if (row.every(v => v === null || v === undefined || v === '')) sepRow = i;
  });

  const HEADER_COLORS = { rate: '#EFF6FF', mnp: '#F0FDF4', type: '#FFF7ED' };

  const table = document.createElement('table');
  table.style.cssText = 'border-collapse:collapse;font-size:11px;white-space:nowrap';

  data.forEach((row, ri) => {
    if (!row) return;
    const tr = document.createElement('tr');

    if (ri === sepRow) {
      tr.style.background = 'var(--border-light)';
      const td = document.createElement('td');
      td.colSpan = maxCol + 2;
      td.style.height = '6px';
      tr.appendChild(td);
      table.appendChild(tr);
      return;
    }

    // 행번호
    const rth = document.createElement('th');
    rth.textContent = ri + 1;
    rth.style.cssText = 'background:#F8FAFC;color:var(--text-hint);font-size:10px;padding:3px 6px;border:1px solid var(--border);min-width:28px;text-align:center';
    tr.appendChild(rth);

    for (let ci = 1; ci <= maxCol; ci++) {
      const td  = document.createElement('td');
      const val = row[ci];
      let display = val !== null && val !== undefined ? String(val) : '';
      if (val instanceof Date) display = val.toLocaleDateString('ko-KR');
      td.textContent = display;
      td.style.cssText = 'border:1px solid var(--border);padding:3px 7px;min-width:46px;text-align:center';

      // 스타일
      if (ci === 1 && display && ri >= 6) {
        if (['구분','모델명'].includes(display)) {
          td.style.background = HEADER_COLORS.rate; td.style.fontWeight = '700'; td.style.color = 'var(--primary)';
        } else {
          td.style.fontWeight = '600'; td.style.textAlign = 'left'; td.style.background = '#FAFBFF';
        }
      } else if (ri === h1 - 2 || ri === h2 - 2) {
        td.style.background = HEADER_COLORS.rate; td.style.fontWeight = '700'; td.style.color = 'var(--primary)'; td.style.fontSize = '10px';
      } else if (ri === h1 - 1 || ri === h2 - 1) {
        td.style.background = HEADER_COLORS.mnp; td.style.fontWeight = '600'; td.style.color = 'var(--green)'; td.style.fontSize = '10px';
      } else if (ri === h1 || ri === h2) {
        td.style.background = HEADER_COLORS.type; td.style.fontWeight = '600'; td.style.color = 'var(--orange)'; td.style.fontSize = '10px';
      } else if (display) {
        const num = parseFloat(display);
        if (!isNaN(num)) {
          td.style.color = num < 0 ? 'var(--red)' : num === 0 ? 'var(--text-hint)' : 'var(--text)';
          td.style.fontWeight = num !== 0 ? '600' : '400';
        }
      }
      tr.appendChild(td);
    }
    table.appendChild(tr);
  });

  area.innerHTML = '';
  area.appendChild(table);
}

// ── 파싱 통계 ──
async function savePolicyPage() {
  const name   = document.getElementById('policy-name-input').value.trim();
  const date   = document.getElementById('policy-date-input').value;
  const status = document.getElementById('policy-upload-status');
  status.style.display = 'block';

  if (!_policyPageFile)   { toast('파일을 선택해 주세요'); return; }
  if (!_policyPageParsed) { toast('파일 분석 중이에요. 잠시 후 다시 시도해 주세요'); return; }
  if (!name)              { toast('정책 호수를 입력해 주세요'); return; }
  if (!date)              { toast('시작 일시를 입력해 주세요'); return; }

  status.style.color = 'var(--orange)';
  status.textContent = '저장 중...';

  const { error } = await sb.from('policy_files').insert({
    policy_name: name,
    started_at:  new Date(date).toISOString(),
    data:        _policyPageParsed,
    file_name:   _policyPageFile.name,
  });

  if (error) {
    status.style.color = 'var(--red)';
    status.textContent = '저장 실패: ' + error.message;
    return;
  }

  toast(`✓ 정책 ${name} 저장 완료`);
  status.style.color = 'var(--green)';
  status.textContent = `✓ ${name} 저장 완료`;

  // 초기화
  _policyPageFile = null; _policyPageParsed = null;
  _policyRawWb = null;
  document.getElementById('policy-file-input').value = '';
  document.getElementById('policy-file-name').textContent = '파일을 선택하거나 여기에 드래그하세요';
  document.getElementById('policy-name-input').value = '';
  document.getElementById('policy-date-input').value = '';
  document.getElementById('policy-preview-area').style.display = 'none';
  const dz = document.getElementById('policy-drop-zone');
  if (dz) { dz.style.borderColor = 'var(--border)'; dz.style.background = ''; }

  await loadPolicyList();
  renderPolicyPageList();
}

async function loadPolicyPage() {
  await loadPolicyList();
  renderPolicyPageList();
}

function renderPolicyPageList() {
  const tbody = document.getElementById('policy-page-list');
  if (!tbody) return;
  if (!policyList.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">등록된 정책이 없어요</td></tr>';
    return;
  }
  tbody.innerHTML = policyList.map(p => {
    const dt = new Date(p.started_at);
    const startStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    const dtInput  = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}T${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    const createdDt  = p.created_at ? new Date(p.created_at) : null;
    const createdStr = createdDt ? `${createdDt.getMonth()+1}/${createdDt.getDate()}` : '-';
    return `
    <tr id="prow-${p.id}">
      <td style="font-weight:700">
        <span id="pname-txt-${p.id}">${p.policy_name}</span>
        <input id="pname-edit-${p.id}" class="input" value="${p.policy_name}" style="display:none;height:28px;width:80px;font-size:12px;padding:0 8px"/>
      </td>
      <td style="font-size:12px;color:var(--text-sub)">
        <span id="pdate-txt-${p.id}">${startStr}</span>
        <input id="pdate-edit-${p.id}" type="datetime-local" class="input" value="${dtInput}" style="display:none;height:28px;font-size:12px;padding:0 8px;width:160px"/>
      </td>
      <td style="font-size:12px;color:var(--text-hint)">
        <span id="pfile-txt-${p.id}">${p.file_name || '-'}</span>
        <label id="pfile-edit-${p.id}" style="display:none;align-items:center;gap:4px;height:28px;padding:0 8px;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:12px;color:var(--text-sub)">
          <i data-lucide="paperclip" style="width:12px;height:12px"></i>
          <span id="pfile-edit-name-${p.id}">변경 안함</span>
          <input type="file" accept=".xlsx,.xls" style="display:none" onchange="policyPageEditFileSelected(this,'${p.id}')"/>
        </label>
      </td>
      <td style="text-align:center;font-size:12px;color:var(--text-hint)">${createdStr}</td>
      <td style="text-align:center;white-space:nowrap;position:sticky;right:0;background:var(--white);box-shadow:-2px 0 4px rgba(0,0,0,0.06)">
        <span id="pbtns-view-${p.id}">
          <button id="pbtn-view-${p.id}" onclick="viewPolicyFromDB('${p.id}')" style="background:none;border:none;color:var(--green);cursor:pointer;font-size:12px;font-weight:600;margin-right:6px">보기</button>
          <button onclick="editPolicyPageRow('${p.id}')" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:12px;font-weight:600;margin-right:6px">수정</button>
          <button onclick="deletePolicyPageRow('${p.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:12px;font-weight:600">삭제</button>
        </span>
        <span id="pbtns-edit-${p.id}" style="display:none">
          <button onclick="savePolicyPageRow('${p.id}')" style="background:none;border:none;color:var(--green);cursor:pointer;font-size:12px;font-weight:700;margin-right:6px">저장</button>
          <button onclick="cancelPolicyPageRow('${p.id}')" style="background:none;border:none;color:var(--text-hint);cursor:pointer;font-size:12px;font-weight:600">취소</button>
        </span>
      </td>
    </tr>
    <tr id="pexpand-${p.id}" style="display:none">
      <td colspan="5" style="padding:0;border-top:none">
        <div style="background:var(--border-light);border-top:2px solid var(--primary)">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border);position:sticky;left:0">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <span style="font-size:14px;font-weight:700;color:var(--text)" id="pexpand-title-${p.id}"></span>
              <span style="font-size:12px;color:var(--text-sub)" id="pexpand-desc-${p.id}"></span>
              <div style="display:flex;gap:6px;flex-wrap:wrap" id="pexpand-tabs-${p.id}"></div>
            </div>

          </div>
          <div style="overflow:auto;padding:12px 16px" id="pexpand-table-${p.id}">
            <div style="padding:20px;color:var(--text-hint);text-align:center">불러오는 중...</div>
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');
  setTimeout(() => lucide.createIcons(), 50);
}

// ── DB에서 정책 데이터 불러와서 뷰 표시 ──
function editPolicyPageRow(id) {
  ['pname','pdate','pfile'].forEach(k => {
    document.getElementById(`${k}-txt-${id}`).style.display = 'none';
    document.getElementById(`${k}-edit-${id}`).style.display = k === 'pfile' ? 'inline-flex' : 'inline-block';
  });
  document.getElementById(`pbtns-view-${id}`).style.display = 'none';
  document.getElementById(`pbtns-edit-${id}`).style.display = 'inline';
  document.getElementById(`pname-edit-${id}`).focus();
}

function cancelPolicyPageRow(id) {
  ['pname','pdate','pfile'].forEach(k => {
    document.getElementById(`${k}-txt-${id}`).style.display = '';
    document.getElementById(`${k}-edit-${id}`).style.display = 'none';
  });
  document.getElementById(`pbtns-view-${id}`).style.display = '';
  document.getElementById(`pbtns-edit-${id}`).style.display = 'none';
  delete window[`_policyEditFile_${id}`];
}

function policyPageEditFileSelected(input, id) {
  const file = input.files[0];
  if (!file) return;
  window[`_policyEditFile_${id}`] = file;
  document.getElementById(`pfile-edit-name-${id}`).textContent = file.name;
}

async function savePolicyPageRow(id) {
  const name = document.getElementById(`pname-edit-${id}`).value.trim();
  const date = document.getElementById(`pdate-edit-${id}`).value;
  if (!name) { toast('정책명을 입력해 주세요'); return; }
  if (!date) { toast('시작 일시를 입력해 주세요'); return; }

  const updateData = { policy_name: name, started_at: new Date(date).toISOString() };
  const newFile = window[`_policyEditFile_${id}`];
  if (newFile) {
    try {
      const parsed = await parsePolicyExcel(newFile);
      if (!Object.keys(parsed).length) { toast('파일 파싱 실패'); return; }
      updateData.data = parsed;
      updateData.file_name = newFile.name;
    } catch(e) { toast('파일 파싱 오류: ' + e.message); return; }
  }
  const { error } = await sb.from('policy_files').update(updateData).eq('id', id);
  if (error) { toast('수정 실패: ' + error.message); return; }
  delete window[`_policyEditFile_${id}`];
  toast(`✓ 정책 ${name} 수정 완료`);
  await loadPolicyList();
  renderPolicyPageList();
}

// 현재 펼쳐진 보기 행 id 추적
let _expandedPolicyId = null;

async function viewPolicyFromDB(id) {
  // 같은 행 다시 누르면 닫기
  if (_expandedPolicyId === id) {
    closePolicyExpand(id);
    return;
  }
  // 이전에 열린 행 닫기
  if (_expandedPolicyId) closePolicyExpand(_expandedPolicyId);

  _expandedPolicyId = id;

  const expandRow   = document.getElementById(`pexpand-${id}`);
  const tableArea   = document.getElementById(`pexpand-table-${id}`);
  const titleEl     = document.getElementById(`pexpand-title-${id}`);
  const descEl      = document.getElementById(`pexpand-desc-${id}`);
  const tabsEl      = document.getElementById(`pexpand-tabs-${id}`);
  const viewBtn     = document.getElementById(`pbtn-view-${id}`);

  // 펼침 행 표시 & 버튼 텍스트 변경
  expandRow.style.display = '';
  if (viewBtn) viewBtn.textContent = '닫기';

  tableArea.innerHTML = '<div style="padding:20px;color:var(--text-hint);text-align:center">불러오는 중...</div>';

  // 펼쳐진 행으로 스크롤
  setTimeout(() => expandRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);

  const { data, error } = await sb.from('policy_files')
    .select('policy_name, started_at, data')
    .eq('id', id)
    .single();

  if (error || !data) {
    tableArea.innerHTML = '<div style="padding:20px;color:var(--red);text-align:center">불러오기 실패</div>';
    return;
  }

  const dt = new Date(data.started_at);
  const dtStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;

  titleEl.textContent = `${data.policy_name}호 정책`;
  descEl.textContent  = `적용: ${dtStr}`;

  // 시트 탭 렌더 (인라인용)
  const sheets = Object.keys(data.data);
  let currentSheet = sheets[0];

  function renderInlineTabs() {
    tabsEl.innerHTML = sheets.map(name => `
      <button onclick="selectInlinePolicySheet('${id}','${name}')" id="pitab-${id}-${name}"
        style="padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;
               border:1px solid var(--primary);transition:all .15s;
               background:${name === currentSheet ? 'var(--primary)' : 'var(--white)'};
               color:${name === currentSheet ? 'white' : 'var(--primary)'}">
        ${name}
      </button>`).join('');
  }

  function renderInlineTable(sheetName) {
    currentSheet = sheetName;
    renderInlineTabs();
    // _policyPageParsed를 임시 세팅해서 renderPolicyTableView 재사용
    const prev = _policyPageParsed;
    _policyPageParsed = data.data;
    const html = (() => {
      const sheet = data.data[sheetName];
      if (!sheet) return '<div style="padding:20px;color:var(--text-hint)">데이터 없음</div>';
      // buildTable을 직접 호출할 수 없으므로 renderPolicyTableView 결과를 캡처
      const tmpId = 'policy-raw-table';
      const tmpEl = document.getElementById(tmpId);
      const savedHtml = tmpEl ? tmpEl.innerHTML : '';
      _policyCurrentSheet = sheetName;
      renderPolicyTableView(sheetName);
      const result = tmpEl ? tmpEl.innerHTML : '';
      if (tmpEl) tmpEl.innerHTML = savedHtml; // 원래대로 복원
      _policyPageParsed = prev;
      return result;
    })();
    tableArea.innerHTML = html;
  }

  // 전역에 등록 (onclick에서 호출)
  window[`_inlineRender_${id}`] = renderInlineTable;
  renderInlineTable(currentSheet);
}

function selectInlinePolicySheet(id, sheetName) {
  if (window[`_inlineRender_${id}`]) window[`_inlineRender_${id}`](sheetName);
}

function closePolicyExpand(id) {
  const expandRow = document.getElementById(`pexpand-${id}`);
  const viewBtn   = document.getElementById(`pbtn-view-${id}`);
  const closeBtn  = document.getElementById(`pbtn-close-${id}`);
  if (expandRow) expandRow.style.display = 'none';
  if (viewBtn) viewBtn.textContent = '보기';
  if (_expandedPolicyId === id) _expandedPolicyId = null;
  delete window[`_inlineRender_${id}`];
}

function closePolicyView() {
  if (_expandedPolicyId) closePolicyExpand(_expandedPolicyId);
  document.getElementById('policy-preview-area').style.display = 'none';
  _policyPageParsed   = null;
  _policyCurrentSheet = null;
  document.getElementById('policy-raw-table').innerHTML = '';
  document.getElementById('policy-sheet-tabs').innerHTML = '';
}

async function deletePolicyPageRow(id) {
  if (!confirm('이 정책을 삭제할까요?')) return;
  const { error } = await sb.from('policy_files').delete().eq('id', id);
  if (error) { toast('삭제 실패: ' + error.message); return; }
  toast('✓ 삭제됐어요');
  await loadPolicyList();
  renderPolicyPageList();
}

// ─── 개발 일지 ───
function loadDevlog() {
  const el = document.getElementById('devlog-content');
  if (!el) return;
  el.innerHTML = `
    <iframe
      src="woozoo_devlog.html"
      style="width:100%;height:80vh;border:none;border-radius:12px"
      loading="lazy"
    ></iframe>
  `;
}

// v2.4.0 Mon Apr 07 2026
const _APP_VER = 'build ' + '2026-04-07 ' + '07';
document.addEventListener('DOMContentLoaded', () => {
  const foot = document.querySelector('.sidebar-bottom');
  if (foot) {
    const verEl = document.createElement('div');
    verEl.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.5);text-align:center;padding:4px 0 8px;';
    verEl.textContent = _APP_VER;
    foot.appendChild(verEl);
  }
});
