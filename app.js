// ===== 数据管理 =====
const STORAGE_KEY = 'weighttrack_entries';
const STORAGE_KEY_UNIT = 'weighttrack_unit';
const STORAGE_KEY_HEIGHT = 'weighttrack_height';

function loadEntries() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
}
function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}
function getEntries() {
    return loadEntries().sort((a, b) => new Date(b.date) - new Date(a.date));
}
function getEntriesAsc() {
    return loadEntries().sort((a, b) => new Date(a.date) - new Date(b.date));
}
function addEntry(entry) {
    const entries = loadEntries();
    entry.id = Date.now().toString() + Math.random().toString(36).slice(2, 8);
    entries.push(entry);
    saveEntries(entries);
}
function updateEntry(id, updates) {
    const entries = loadEntries();
    const idx = entries.findIndex(e => e.id === id);
    if (idx !== -1) { entries[idx] = { ...entries[idx], ...updates }; saveEntries(entries); }
}
function deleteEntry(id) {
    saveEntries(loadEntries().filter(e => e.id !== id));
}

// ===== 单位管理 (内部统一用kg存储) =====
function getDisplayUnit() { return localStorage.getItem(STORAGE_KEY_UNIT) || 'kg'; }
function setDisplayUnit(unit) { localStorage.setItem(STORAGE_KEY_UNIT, unit); }
function getUnitLabel() { return getDisplayUnit() === 'jin' ? '斤' : 'kg'; }
function kgToDisplay(kg) { return getDisplayUnit() === 'jin' ? kg * 2 : kg; }
function displayToKg(val) { return getDisplayUnit() === 'jin' ? val / 2 : val; }
function formatWeight(kg) { return kgToDisplay(kg).toFixed(1); }

// ===== 身高管理 =====
function getHeight() { const h = localStorage.getItem(STORAGE_KEY_HEIGHT); return h ? parseFloat(h) : null; }
function setHeight(cm) { localStorage.setItem(STORAGE_KEY_HEIGHT, cm.toString()); }

// ===== 日期工具 =====
function formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function formatShortDate(date) {
    const d = new Date(date); return `${d.getMonth()+1}/${d.getDate()}`;
}
function getRelativeDate(date) {
    const d = new Date(date), today = new Date(), yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return '今天';
    if (d.toDateString() === yesterday.toDateString()) return '昨天';
    const diff = Math.floor((today - d) / 86400000);
    if (diff < 7) return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
    return formatShortDate(date);
}
function toLocalISO(date) {
    const tz = date.getTimezoneOffset() * 60000;
    return new Date(date - tz).toISOString().slice(0, 16);
}

// ===== 页面切换 =====
let currentPage = 'records';
function switchPage(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab-item[data-page="${page}"]`).classList.add('active');
    if (page === 'records') renderRecords();
    else if (page === 'chart') renderChart();
    else if (page === 'stats') renderStats();
    else if (page === 'settings') renderSettings();
}

// ===== 记录列表 =====
function renderRecords() {
    const container = document.getElementById('records-content');
    const entries = getEntries();
    const ul = getUnitLabel();
    if (entries.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">⚖️</div><div class="title">还没有记录</div><div class="desc">点击右上方按钮添加第一条体重记录</div><button class="btn" onclick="openAddModal()">添加记录</button></div>';
        return;
    }
    let html = '<div class="record-list">';
    entries.forEach(e => {
        html += `<div class="record-item" data-id="${e.id}"><div class="record-content" onclick="openEditModal('${e.id}')"><div class="record-date"><span class="rel">${getRelativeDate(e.date)}</span><span class="abs">${formatShortDate(e.date)}</span></div><div class="record-divider"></div><div class="record-info"><div class="record-weight"><span class="val">${formatWeight(e.weight)}</span><span class="unit">${ul}</span></div>${e.note ? `<div class="record-note">${escapeHtml(e.note)}</div>` : ''}</div><span class="record-chevron">›</span></div><div class="record-delete" onclick="handleDelete('${e.id}')">删除</div></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
    bindSwipeToDelete();
}
function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

// ===== 滑动删除 =====
function bindSwipeToDelete() {
    document.querySelectorAll('.record-item').forEach(item => {
        let startX = 0, currentX = 0, isDragging = false;
        const content = item.querySelector('.record-content');
        content.addEventListener('touchstart', (e) => {
            if (e.target.closest('.record-delete')) return;
            startX = e.touches[0].clientX; isDragging = true;
        }, { passive: true });
        content.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentX = e.touches[0].clientX - startX;
            if (currentX < 0 && currentX > -80) content.style.transform = `translateX(${currentX}px)`;
        }, { passive: true });
        content.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            if (currentX < -40) item.classList.add('swiped'); else item.classList.remove('swiped');
            content.style.transform = ''; currentX = 0;
        });
    });
}
function handleDelete(id) { deleteEntry(id); renderRecords(); showToast('已删除'); }

// ===== 添加/编辑弹窗 =====
let editingId = null;
let inputUnit = 'kg';

function openAddModal() {
    editingId = null;
    inputUnit = getDisplayUnit();
    document.getElementById('modal-title').textContent = '添加记录';
    updateModalUnitUI();
    setModalWeight(65);
    document.getElementById('date-input').value = toLocalISO(new Date());
    document.getElementById('note-input').value = '';
    document.getElementById('modal-overlay').classList.add('show');
}
function openEditModal(id) {
    const entry = loadEntries().find(e => e.id === id);
    if (!entry) return;
    editingId = id;
    inputUnit = getDisplayUnit();
    document.getElementById('modal-title').textContent = '编辑记录';
    updateModalUnitUI();
    setModalWeight(entry.weight);
    document.getElementById('date-input').value = toLocalISO(new Date(entry.date));
    document.getElementById('note-input').value = entry.note || '';
    document.getElementById('modal-overlay').classList.add('show');
}
function closeModal(event) {
    if (event && event.target.id !== 'modal-overlay') return;
    document.getElementById('modal-overlay').classList.remove('show');
}
function switchInputUnit(unit) {
    const currentKg = getModalWeightKg();
    inputUnit = unit;
    updateModalUnitUI();
    setModalWeight(currentKg);
}
function updateModalUnitUI() {
    document.getElementById('unit-kg').classList.toggle('active', inputUnit === 'kg');
    document.getElementById('unit-jin').classList.toggle('active', inputUnit === 'jin');
    document.getElementById('weight-unit-label').textContent = inputUnit === 'jin' ? '斤' : 'kg';
    const slider = document.getElementById('weight-slider');
    if (inputUnit === 'jin') { slider.min = 60; slider.max = 400; } else { slider.min = 30; slider.max = 200; }
    const btns = document.querySelectorAll('.quick-btn');
    const steps = inputUnit === 'jin' ? ['-1','-0.2','+0.2','+1'] : ['-0.5','-0.1','+0.1','+0.5'];
    btns.forEach((btn, i) => { if (steps[i]) btn.textContent = steps[i]; });
}
function getModalWeightKg() {
    const val = parseFloat(document.getElementById('weight-input').value);
    if (isNaN(val)) return 65;
    return inputUnit === 'jin' ? val / 2 : val;
}
function setModalWeight(kg) {
    const dv = inputUnit === 'jin' ? kg * 2 : kg;
    const slider = document.getElementById('weight-slider');
    slider.value = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), dv));
    document.getElementById('weight-val').textContent = dv.toFixed(1);
    document.getElementById('weight-input').value = dv.toFixed(1);
}
function onSliderChange() {
    const val = parseFloat(document.getElementById('weight-slider').value);
    document.getElementById('weight-val').textContent = val.toFixed(1);
    document.getElementById('weight-input').value = val.toFixed(1);
}
function onInputChange() {
    const val = parseFloat(document.getElementById('weight-input').value);
    if (isNaN(val)) return;
    const slider = document.getElementById('weight-slider');
    slider.value = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), val));
    document.getElementById('weight-val').textContent = val.toFixed(1);
}
function adjustWeight(delta) {
    const slider = document.getElementById('weight-slider');
    let val = parseFloat(slider.value) + delta;
    val = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), val));
    slider.value = val; onSliderChange();
}
function saveEntry() {
    const kg = getModalWeightKg();
    if (!kg || kg < 15 || kg > 200) { showToast('请输入有效的体重值'); return; }
    const dateInput = document.getElementById('date-input').value;
    const date = dateInput ? new Date(dateInput).toISOString() : new Date().toISOString();
    const note = document.getElementById('note-input').value.trim();
    if (editingId) { updateEntry(editingId, { weight: kg, date, note }); showToast('已保存'); }
    else { addEntry({ date, weight: kg, note }); showToast('已添加'); }
    document.getElementById('modal-overlay').classList.remove('show');
    switchPage(currentPage);
}

// ===== 趋势图表 =====
let currentRange = 'month';
function renderChart() {
    const container = document.getElementById('chart-content');
    const all = getEntriesAsc();
    const ul = getUnitLabel();
    if (all.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📊</div><div class="title">暂无数据</div><div class="desc">请先在「记录」页面添加数据</div></div>';
        return;
    }
    const now = new Date(); let startDate;
    switch (currentRange) {
        case 'week': startDate = new Date(now.getTime() - 7*86400000); break;
        case 'month': startDate = new Date(now.getTime() - 30*86400000); break;
        case 'quarter': startDate = new Date(now.getTime() - 90*86400000); break;
        case 'all': startDate = new Date(0); break;
    }
    const entries = all.filter(e => new Date(e.date) >= startDate);
    if (entries.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📊</div><div class="title">该时间范围内暂无数据</div><div class="desc">试试切换其他时间范围</div></div>' + renderRangePicker();
        return;
    }
    const weights = entries.map(e => e.weight);
    const avg = weights.reduce((a,b)=>a+b,0) / weights.length;
    const change = weights[weights.length-1] - weights[0];
    const cc = change > 0 ? 'var(--red)' : (change < 0 ? 'var(--green)' : 'var(--text-secondary)');
    const cs = change > 0 ? '+' : '';
    let html = renderRangePicker();
    html += `<div class="chart-summary"><div class="summary-card" style="background:rgba(0,122,255,0.1)"><div class="label">平均</div><div class="value" style="color:var(--blue)">${formatWeight(avg)}<span class="unit"> ${ul}</span></div></div><div class="summary-card" style="background:${change>0?'rgba(255,59,48,0.1)':(change<0?'rgba(52,199,89,0.1)':'rgba(142,142,147,0.1)')}"><div class="label">变化</div><div class="value" style="color:${cc}">${cs}${formatWeight(change)}<span class="unit"> ${ul}</span></div></div></div>`;
    html += `<div class="chart-container"><canvas id="weight-chart" height="220"></canvas></div>`;
    html += `<div class="stat-section-title" style="margin-top:20px">详细数据</div><div class="detail-list">`;
    [...entries].reverse().forEach(e => {
        html += `<div class="detail-item"><span>${getRelativeDate(e.date)} · ${formatShortDate(e.date)}</span><span class="weight">${formatWeight(e.weight)} ${ul}</span></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
    drawChart(entries);
    bindRangePicker();
}
function renderRangePicker() {
    const ranges = [{key:'week',label:'本周'},{key:'month',label:'本月'},{key:'quarter',label:'近三月'},{key:'all',label:'全部'}];
    let html = '<div class="range-picker">';
    ranges.forEach(r => { html += `<button class="range-btn ${currentRange===r.key?'active':''}" data-range="${r.key}">${r.label}</button>`; });
    html += '</div>'; return html;
}
function bindRangePicker() {
    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.addEventListener('click', () => { currentRange = btn.dataset.range; renderChart(); });
    });
}

// ===== Canvas 图表 =====
function drawChart(entries) {
    const canvas = document.getElementById('weight-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = 220 * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = 220;
    const pad = { top: 30, right: 20, bottom: 30, left: 48 };
    const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;
    const dws = entries.map(e => kgToDisplay(e.weight));
    const minW = Math.min(...dws) - 2, maxW = Math.max(...dws) + 2;
    const wRange = maxW - minW || 1;
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const tc = '#8E8E93', gc = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', ac = '#FF9500';
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = gc; ctx.lineWidth = 1; ctx.font = '11px -apple-system, sans-serif';
    ctx.fillStyle = tc; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
        const y = pad.top + (cH/4)*i, val = maxW - (wRange/4)*i;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W-pad.right, y); ctx.stroke();
        ctx.fillText(val.toFixed(1), pad.left-8, y);
    }
    const points = entries.map((e, i) => {
        const x = entries.length === 1 ? pad.left + cW/2 : pad.left + (cW/(entries.length-1))*i;
        const y = pad.top + cH - ((kgToDisplay(e.weight)-minW)/wRange)*cH;
        return { x, y, entry: e };
    });
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top+cH);
    grad.addColorStop(0, 'rgba(255,149,0,0.3)'); grad.addColorStop(1, 'rgba(255,149,0,0.02)');
    ctx.beginPath(); ctx.moveTo(points[0].x, pad.top+cH);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length-1].x, pad.top+cH); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); points.forEach((p,i) => { if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
    ctx.strokeStyle = ac; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    points.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
        ctx.fillStyle = ac; ctx.fill();
        ctx.strokeStyle = isDark ? '#1C1C1E' : '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke();
    });
    const li = Math.ceil(points.length / 6);
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    points.forEach((p, i) => {
        if (points.length <= 8 || i % li === 0 || i === points.length-1) {
            ctx.fillStyle = tc; ctx.fillText(formatWeight(p.entry.weight), p.x, p.y-10);
        }
    });
    ctx.textBaseline = 'top';
    const di = Math.ceil(points.length / 5);
    points.forEach((p, i) => {
        if (i % di === 0 || i === points.length-1) {
            ctx.fillStyle = tc; ctx.fillText(formatShortDate(p.entry.date), p.x, H-pad.bottom+6);
        }
    });
}

// ===== 统计页 =====
function renderStats() {
    const container = document.getElementById('stats-content');
    const entries = getEntries(), entriesAsc = getEntriesAsc();
    const ul = getUnitLabel();
    if (entries.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><div class="title">暂无统计数据</div><div class="desc">添加体重记录后将显示统计信息</div></div>';
        return;
    }
    const latest = entries[0], first = entriesAsc[0];
    const totalChange = latest.weight - first.weight;
    const weights = entries.map(e => e.weight);
    const avg = weights.reduce((a,b)=>a+b,0) / weights.length;
    const maxW = Math.max(...weights), minW = Math.min(...weights);
    const weekAgo = new Date(Date.now() - 7*86400000);
    const recent = entriesAsc.filter(e => new Date(e.date) >= weekAgo);
    let weeklyChange = recent.length > 1 ? recent[recent.length-1].weight - recent[0].weight : null;
    const totalDays = Math.floor((Date.now() - new Date(first.date)) / 86400000);

    // BMI - 使用用户身高
    const heightCm = getHeight();
    const hasHeight = heightCm !== null && heightCm > 0;
    let bmi = 0, bmiCat = '', bmiColor = '';
    if (hasHeight) {
        const h = heightCm / 100;
        bmi = latest.weight / (h * h);
        if (bmi < 18.5) { bmiCat = '偏瘦'; bmiColor = '#007AFF'; }
        else if (bmi < 24) { bmiCat = '正常'; bmiColor = '#34C759'; }
        else if (bmi < 28) { bmiCat = '超重'; bmiColor = '#FF9500'; }
        else { bmiCat = '肥胖'; bmiColor = '#FF3B30'; }
    }

    const cc = totalChange > 0 ? 'var(--red)' : (totalChange < 0 ? 'var(--green)' : 'var(--text-secondary)');
    const ca = totalChange > 0 ? '↑' : (totalChange < 0 ? '↓' : '—');
    const cs = totalChange > 0 ? '+' : '';
    const wc = weeklyChange === null ? 'var(--text-secondary)' : (weeklyChange > 0 ? 'var(--red)' : (weeklyChange < 0 ? 'var(--green)' : 'var(--text-secondary)'));
    const wa = weeklyChange === null ? '—' : (weeklyChange > 0 ? '↑' : (weeklyChange < 0 ? '↓' : '—'));
    const ws = weeklyChange !== null && weeklyChange > 0 ? '+' : '';
    const wv = weeklyChange !== null ? `${ws}${formatWeight(weeklyChange)}` : '--';

    let html = '';
    html += `<div class="stat-current"><div class="label">当前体重</div><div class="weight">${formatWeight(latest.weight)}<span class="unit"> ${ul}</span></div><div class="date">最后记录于 ${getRelativeDate(latest.date)}</div></div>`;
    html += `<div class="stat-section"><div class="stat-section-title">变化趋势</div><div class="stat-card"><div class="change-row"><div class="change-item"><div class="label">总变化</div><div class="val" style="color:${cc}">${ca} ${cs}${formatWeight(totalChange)}<span class="unit"> ${ul}</span></div></div><div class="change-divider"></div><div class="change-item"><div class="label">近7天</div><div class="val" style="color:${wc}">${wa} ${wv}<span class="unit"> ${ul}</span></div></div></div></div></div>`;

    if (hasHeight) {
        html += `<div class="stat-section"><div class="stat-section-title">BMI 指数</div><div class="stat-card" style="display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:32px;font-weight:700">${bmi.toFixed(1)}</div><div style="font-size:12px;color:var(--text-secondary);margin-top:4px">身高 ${heightCm}cm</div></div><div><span class="bmi-badge" style="background:${bmiColor}22;color:${bmiColor}">${bmiCat}</span></div></div></div>`;
    } else {
        html += `<div class="stat-section"><div class="stat-section-title">BMI 指数</div><div class="stat-card" style="text-align:center;padding:24px"><div style="font-size:15px;color:var(--text-secondary);margin-bottom:8px">请先在「设置」中填写身高</div><button class="settings-btn" style="display:inline-block;width:auto;padding:8px 24px" onclick="switchPage('settings')">去设置</button></div></div>`;
    }

    html += `<div class="stat-section"><div class="stat-section-title">详细统计</div><div class="stat-grid"><div class="stat-cell" style="background:rgba(0,122,255,0.08)"><div class="icon">📊</div><div class="label">平均体重</div><div class="value" style="color:var(--blue)">${formatWeight(avg)}<span class="unit"> ${ul}</span></div></div><div class="stat-cell" style="background:rgba(255,59,48,0.08)"><div class="icon">↑</div><div class="label">最高体重</div><div class="value" style="color:var(--red)">${formatWeight(maxW)}<span class="unit"> ${ul}</span></div></div><div class="stat-cell" style="background:rgba(52,199,89,0.08)"><div class="icon">↓</div><div class="label">最低体重</div><div class="value" style="color:var(--green)">${formatWeight(minW)}<span class="unit"> ${ul}</span></div></div><div class="stat-cell" style="background:rgba(175,82,222,0.08)"><div class="icon">📝</div><div class="label">记录次数</div><div class="value" style="color:#AF52DE">${entries.length}<span class="unit"> 次</span></div></div></div></div>`;

    html += `<div class="stat-section"><div class="stat-section-title">记录信息</div><div class="stat-card"><div class="info-row"><span class="label">首次记录</span><span class="value">${formatDate(first.date)}</span></div><div class="info-row"><span class="label">最近记录</span><span class="value">${formatDate(latest.date)}</span></div><div class="info-row"><span class="label">记录天数</span><span class="value">${totalDays} 天</span></div><div class="info-row"><span class="label">记录总数</span><span class="value">${entries.length} 条</span></div></div></div>`;

    container.innerHTML = html;
}

// ===== 设置页 =====
function renderSettings() {
    const container = document.getElementById('settings-content');
    const unit = getDisplayUnit();
    const heightCm = getHeight();
    const entryCount = loadEntries().length;

    let html = '';

    // 偏好设置
    html += `<div class="settings-group"><div class="settings-group-title">偏好设置</div><div class="settings-card">`;
    html += `<div class="settings-row"><span class="label">体重单位</span><div class="settings-segment"><button class="${unit==='kg'?'active':''}" onclick="changeUnit('kg')">kg</button><button class="${unit==='jin'?'active':''}" onclick="changeUnit('jin')">斤</button></div></div>`;
    html += `<div class="settings-row"><span class="label">身高</span><div class="height-input-wrap"><input type="number" id="height-input" placeholder="未设置" value="${heightCm || ''}" step="1" min="50" max="250"><span class="suffix">cm</span></div></div>`;
    html += `</div></div>`;

    // 数据管理
    html += `<div class="settings-group"><div class="settings-group-title">数据管理</div><div class="settings-card">`;
    html += `<div class="settings-row" onclick="exportData()"><div><div class="label">导出数据</div><div class="desc">将所有记录保存为文件，用于备份或迁移</div></div><span style="color:var(--accent);font-size:20px">›</span></div>`;
    html += `<div class="settings-row" onclick="document.getElementById('import-file-input').click()"><div><div class="label">导入数据</div><div class="desc">从备份文件恢复记录（将覆盖现有数据）</div></div><span style="color:var(--accent);font-size:20px">›</span></div>`;
    html += `</div></div>`;

    // 数据统计
    html += `<div class="settings-group"><div class="settings-group-title">数据统计</div><div class="settings-card"><div class="settings-row"><span class="label">记录总数</span><span class="label" style="color:var(--text-secondary)">${entryCount} 条</span></div></div></div>`;

    // 关于
    html += `<div class="settings-group"><div class="settings-group-title">关于</div><div class="settings-card"><div class="settings-row"><span class="label">应用名称</span><span class="label" style="color:var(--text-secondary)">体重记录</span></div><div class="settings-row"><span class="label">版本</span><span class="label" style="color:var(--text-secondary)">1.1.1</span></div></div></div>`;

    container.innerHTML = html;

    // 绑定身高输入保存
    const heightInput = document.getElementById('height-input');
    if (heightInput) {
        heightInput.addEventListener('change', () => {
            const val = parseFloat(heightInput.value);
            if (val && val >= 50 && val <= 250) {
                setHeight(val);
                showToast('身高已保存');
            } else if (!heightInput.value) {
                localStorage.removeItem(STORAGE_KEY_HEIGHT);
                showToast('身高已清除');
            } else {
                showToast('请输入 50-250 之间的数值');
                heightInput.value = heightCm || '';
            }
        });
    }
}

function changeUnit(unit) {
    setDisplayUnit(unit);
    renderSettings();
    showToast(unit === 'jin' ? '已切换为斤' : '已切换为 kg');
}

// ===== 数据导出导入 =====
function exportData() {
    const entries = loadEntries();
    const height = getHeight();
    const unit = getDisplayUnit();
    const data = {
        version: '1.1.0',
        exportDate: new Date().toISOString(),
        unit: unit,
        height: height,
        entries: entries
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weighttrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('数据已导出');
}

function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.entries || !Array.isArray(data.entries)) {
                showToast('文件格式不正确');
                return;
            }
            if (confirm(`确定导入 ${data.entries.length} 条记录吗？这将覆盖当前所有数据。`)) {
                saveEntries(data.entries);
                if (data.height) setHeight(data.height);
                if (data.unit) setDisplayUnit(data.unit);
                showToast('数据导入成功');
                switchPage('records');
            }
        } catch (err) {
            showToast('文件解析失败');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // 重置以便重复导入
}

// ===== Toast =====
let toastTimer;
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ===== Service Worker =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW failed:', err));
    });
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => { renderRecords(); });