// ===== 数据管理 =====
const STORAGE_KEY = 'weighttrack_entries';

function loadEntries() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
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
    if (idx !== -1) {
        entries[idx] = { ...entries[idx], ...updates };
        saveEntries(entries);
    }
}

function deleteEntry(id) {
    const entries = loadEntries().filter(e => e.id !== id);
    saveEntries(entries);
}

// ===== 日期工具 =====
function formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatShortDate(date) {
    const d = new Date(date);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function getRelativeDate(date) {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return '今天';
    if (d.toDateString() === yesterday.toDateString()) return '昨天';

    const diffDays = Math.floor((today - d) / 86400000);
    if (diffDays < 7) {
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return weekdays[d.getDay()];
    }
    return formatShortDate(date);
}

function toLocalISO(date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date - tzOffset).toISOString().slice(0, 16);
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
}

// ===== 记录列表渲染 =====
function renderRecords() {
    const container = document.getElementById('records-content');
    const entries = getEntries();

    if (entries.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">⚖️</div>
                <div class="title">还没有记录</div>
                <div class="desc">点击下方按钮添加第一条体重记录</div>
                <button class="btn" onclick="openAddModal()">添加记录</button>
            </div>
        `;
        return;
    }

    let html = '<div class="record-list">';
    entries.forEach(entry => {
        html += `
            <div class="record-item" data-id="${entry.id}">
                <div class="record-content" onclick="openEditModal('${entry.id}')">
                    <div class="record-date">
                        <span class="rel">${getRelativeDate(entry.date)}</span>
                        <span class="abs">${formatShortDate(entry.date)}</span>
                    </div>
                    <div class="record-divider"></div>
                    <div class="record-info">
                        <div class="record-weight">
                            <span class="val">${entry.weight.toFixed(1)}</span>
                            <span class="unit">kg</span>
                        </div>
                        ${entry.note ? `<div class="record-note">${escapeHtml(entry.note)}</div>` : ''}
                    </div>
                    <span class="record-chevron">›</span>
                </div>
                <div class="record-delete" onclick="handleDelete('${entry.id}')">删除</div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;

    // 绑定滑动删除
    bindSwipeToDelete();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== 滑动删除 =====
function bindSwipeToDelete() {
    document.querySelectorAll('.record-item').forEach(item => {
        let startX = 0;
        let currentX = 0;
        let isDragging = false;

        const content = item.querySelector('.record-content');

        content.addEventListener('touchstart', (e) => {
            if (e.target.closest('.record-delete')) return;
            startX = e.touches[0].clientX;
            isDragging = true;
        }, { passive: true });

        content.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentX = e.touches[0].clientX - startX;
            if (currentX < 0 && currentX > -80) {
                content.style.transform = `translateX(${currentX}px)`;
            }
        }, { passive: true });

        content.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            if (currentX < -40) {
                item.classList.add('swiped');
            } else {
                item.classList.remove('swiped');
            }
            content.style.transform = '';
            currentX = 0;
        });
    });
}

function handleDelete(id) {
    deleteEntry(id);
    renderRecords();
    showToast('已删除');
}

// ===== 添加/编辑弹窗 =====
let editingId = null;

function openAddModal() {
    editingId = null;
    document.getElementById('modal-title').textContent = '添加记录';
    document.getElementById('weight-slider').value = 65;
    document.getElementById('weight-input').value = '65.0';
    document.getElementById('weight-val').textContent = '65.0';
    document.getElementById('date-input').value = toLocalISO(new Date());
    document.getElementById('note-input').value = '';
    document.getElementById('modal-overlay').classList.add('show');
}

function openEditModal(id) {
    const entries = loadEntries();
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    editingId = id;
    document.getElementById('modal-title').textContent = '编辑记录';
    document.getElementById('weight-slider').value = entry.weight;
    document.getElementById('weight-input').value = entry.weight.toFixed(1);
    document.getElementById('weight-val').textContent = entry.weight.toFixed(1);
    document.getElementById('date-input').value = toLocalISO(new Date(entry.date));
    document.getElementById('note-input').value = entry.note || '';
    document.getElementById('modal-overlay').classList.add('show');
}

function closeModal(event) {
    if (event && event.target.id !== 'modal-overlay') return;
    document.getElementById('modal-overlay').classList.remove('show');
}

function onSliderChange() {
    const val = parseFloat(document.getElementById('weight-slider').value);
    document.getElementById('weight-val').textContent = val.toFixed(1);
    document.getElementById('weight-input').value = val.toFixed(1);
}

function onInputChange() {
    const val = parseFloat(document.getElementById('weight-input').value) || 65;
    document.getElementById('weight-slider').value = val;
    document.getElementById('weight-val').textContent = val.toFixed(1);
}

function adjustWeight(delta) {
    const slider = document.getElementById('weight-slider');
    let val = parseFloat(slider.value) + delta;
    val = Math.max(30, Math.min(200, val));
    slider.value = val;
    onSliderChange();
}

function saveEntry() {
    const weight = parseFloat(document.getElementById('weight-input').value);
    if (!weight || weight < 30 || weight > 200) {
        showToast('请输入有效的体重值');
        return;
    }

    const dateInput = document.getElementById('date-input').value;
    const date = dateInput ? new Date(dateInput).toISOString() : new Date().toISOString();
    const note = document.getElementById('note-input').value.trim();

    if (editingId) {
        updateEntry(editingId, { weight, date, note });
        showToast('已保存');
    } else {
        addEntry({ date, weight, note });
        showToast('已添加');
    }

    document.getElementById('modal-overlay').classList.remove('show');
    switchPage(currentPage);
}

// ===== 趋势图表 =====
let currentRange = 'month';

function renderChart() {
    const container = document.getElementById('chart-content');
    const allEntries = getEntriesAsc();

    if (allEntries.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📊</div>
                <div class="title">暂无数据</div>
                <div class="desc">请先在「记录」页面添加数据</div>
            </div>
        `;
        return;
    }

    // 时间范围过滤
    const now = new Date();
    let startDate;
    switch (currentRange) {
        case 'week': startDate = new Date(now.getTime() - 7 * 86400000); break;
        case 'month': startDate = new Date(now.getTime() - 30 * 86400000); break;
        case 'quarter': startDate = new Date(now.getTime() - 90 * 86400000); break;
        case 'all': startDate = new Date(0); break;
    }

    const entries = allEntries.filter(e => new Date(e.date) >= startDate);

    if (entries.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📊</div>
                <div class="title">该时间范围内暂无数据</div>
                <div class="desc">试试切换其他时间范围</div>
            </div>
            ${renderRangePicker()}
        `;
        return;
    }

    // 计算统计
    const weights = entries.map(e => e.weight);
    const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
    const change = weights[weights.length - 1] - weights[0];
    const changeColor = change > 0 ? 'var(--red)' : (change < 0 ? 'var(--green)' : 'var(--text-secondary)');
    const changeSign = change > 0 ? '+' : '';

    let html = renderRangePicker();

    // 摘要
    html += `
        <div class="chart-summary">
            <div class="summary-card" style="background: rgba(0,122,255,0.1)">
                <div class="label">平均</div>
                <div class="value" style="color: var(--blue)">${avg.toFixed(1)}<span class="unit"> kg</span></div>
            </div>
            <div class="summary-card" style="background: ${change > 0 ? 'rgba(255,59,48,0.1)' : (change < 0 ? 'rgba(52,199,89,0.1)' : 'rgba(142,142,147,0.1)')}">
                <div class="label">变化</div>
                <div class="value" style="color: ${changeColor}">${changeSign}${change.toFixed(1)}<span class="unit"> kg</span></div>
            </div>
        </div>
    `;

    // 图表
    html += `<div class="chart-container"><canvas id="weight-chart" height="220"></canvas></div>`;

    // 详细数据
    html += `<div class="stat-section-title" style="margin-top:20px">详细数据</div>`;
    html += '<div class="detail-list">';
    [...entries].reverse().forEach(entry => {
        html += `
            <div class="detail-item">
                <span>${getRelativeDate(entry.date)} · ${formatShortDate(entry.date)}</span>
                <span class="weight">${entry.weight.toFixed(1)} kg</span>
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;

    // 绘制图表
    drawChart(entries);

    // 绑定范围选择器
    bindRangePicker();
}

function renderRangePicker() {
    const ranges = [
        { key: 'week', label: '本周' },
        { key: 'month', label: '本月' },
        { key: 'quarter', label: '近三月' },
        { key: 'all', label: '全部' }
    ];
    let html = '<div class="range-picker">';
    ranges.forEach(r => {
        html += `<button class="range-btn ${currentRange === r.key ? 'active' : ''}" data-range="${r.key}">${r.label}</button>`;
    });
    html += '</div>';
    return html;
}

function bindRangePicker() {
    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentRange = btn.dataset.range;
            renderChart();
        });
    });
}

// ===== Canvas 图表绘制 =====
function drawChart(entries) {
    const canvas = document.getElementById('weight-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 220 * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = 220;
    const padding = { top: 30, right: 20, bottom: 30, left: 44 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    const weights = entries.map(e => e.weight);
    const minW = Math.min(...weights) - 2;
    const maxW = Math.max(...weights) + 2;
    const wRange = maxW - minW || 1;

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const textColor = isDark ? '#8E8E93' : '#8E8E93';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const accentColor = '#FF9500';

    // 清除
    ctx.clearRect(0, 0, W, H);

    // 绘制网格线
    const ySteps = 4;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= ySteps; i++) {
        const y = padding.top + (chartH / ySteps) * i;
        const val = maxW - (wRange / ySteps) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(W - padding.right, y);
        ctx.stroke();
        ctx.fillText(val.toFixed(1), padding.left - 8, y);
    }

    // 计算点坐标
    const points = entries.map((e, i) => {
        const x = entries.length === 1
            ? padding.left + chartW / 2
            : padding.left + (chartW / (entries.length - 1)) * i;
        const y = padding.top + chartH - ((e.weight - minW) / wRange) * chartH;
        return { x, y, entry: e };
    });

    // 绘制渐变填充
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, 'rgba(255, 149, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 149, 0, 0.02)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, padding.top + chartH);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // 绘制折线
    ctx.beginPath();
    points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // 绘制数据点
    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = accentColor;
        ctx.fill();
        ctx.strokeStyle = isDark ? '#1C1C1E' : '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    // 绘制数值标签（仅显示部分避免重叠）
    const labelInterval = Math.ceil(points.length / 6);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '11px -apple-system, sans-serif';
    points.forEach((p, i) => {
        if (points.length <= 8 || i % labelInterval === 0 || i === points.length - 1) {
            ctx.fillStyle = textColor;
            ctx.fillText(p.entry.weight.toFixed(1), p.x, p.y - 10);
        }
    });

    // 绘制 X 轴日期标签
    ctx.textBaseline = 'top';
    const dateInterval = Math.ceil(points.length / 5);
    points.forEach((p, i) => {
        if (i % dateInterval === 0 || i === points.length - 1) {
            ctx.fillStyle = textColor;
            ctx.fillText(formatShortDate(p.entry.date), p.x, H - padding.bottom + 6);
        }
    });
}

// ===== 统计页 =====
function renderStats() {
    const container = document.getElementById('stats-content');
    const entries = getEntries();
    const entriesAsc = getEntriesAsc();

    if (entries.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📋</div>
                <div class="title">暂无统计数据</div>
                <div class="desc">添加体重记录后\n这里将显示详细的统计信息</div>
            </div>
        `;
        return;
    }

    const latest = entries[0];
    const first = entriesAsc[0];
    const totalChange = latest.weight - first.weight;
    const weights = entries.map(e => e.weight);
    const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
    const maxW = Math.max(...weights);
    const minW = Math.min(...weights);

    // 近7天变化
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const recent = entriesAsc.filter(e => new Date(e.date) >= weekAgo);
    let weeklyChange = null;
    if (recent.length > 1) {
        weeklyChange = recent[recent.length - 1].weight - recent[0].weight;
    }

    // 总天数
    const totalDays = Math.floor((Date.now() - new Date(first.date)) / 86400000);

    // BMI
    const height = 1.70;
    const bmi = latest.weight / (height * height);
    let bmiCategory, bmiColor;
    if (bmi < 18.5) { bmiCategory = '偏瘦'; bmiColor = '#007AFF'; }
    else if (bmi < 24) { bmiCategory = '正常'; bmiColor = '#34C759'; }
    else if (bmi < 28) { bmiCategory = '超重'; bmiColor = '#FF9500'; }
    else { bmiCategory = '肥胖'; bmiColor = '#FF3B30'; }

    const changeColor = totalChange > 0 ? 'var(--red)' : (totalChange < 0 ? 'var(--green)' : 'var(--text-secondary)');
    const changeArrow = totalChange > 0 ? '↑' : (totalChange < 0 ? '↓' : '—');
    const changeSign = totalChange > 0 ? '+' : '';

    const weeklyColor = weeklyChange === null ? 'var(--text-secondary)' : (weeklyChange > 0 ? 'var(--red)' : (weeklyChange < 0 ? 'var(--green)' : 'var(--text-secondary)'));
    const weeklyArrow = weeklyChange === null ? '—' : (weeklyChange > 0 ? '↑' : (weeklyChange < 0 ? '↓' : '—'));
    const weeklySign = weeklyChange !== null && weeklyChange > 0 ? '+' : '';
    const weeklyVal = weeklyChange !== null ? `${weeklySign}${weeklyChange.toFixed(1)}` : '--';

    let html = '';

    // 当前体重
    html += `
        <div class="stat-current">
            <div class="label">当前体重</div>
            <div class="weight">${latest.weight.toFixed(1)}<span class="unit"> kg</span></div>
            <div class="date">最后记录于 ${getRelativeDate(latest.date)}</div>
        </div>
    `;

    // 变化趋势
    html += `
        <div class="stat-section">
            <div class="stat-section-title">变化趋势</div>
            <div class="stat-card">
                <div class="change-row">
                    <div class="change-item">
                        <div class="label">总变化</div>
                        <div class="val" style="color: ${changeColor}">${changeArrow} ${changeSign}${totalChange.toFixed(1)}<span class="unit"> kg</span></div>
                    </div>
                    <div class="change-divider"></div>
                    <div class="change-item">
                        <div class="label">近7天</div>
                        <div class="val" style="color: ${weeklyColor}">${weeklyArrow} ${weeklyVal}<span class="unit"> kg</span></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // BMI
    html += `
        <div class="stat-section">
            <div class="stat-section-title">BMI 指数</div>
            <div class="stat-card" style="display:flex;align-items:center;justify-content:space-between">
                <div>
                    <div style="font-size:32px;font-weight:700">${bmi.toFixed(1)}</div>
                    <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">基于默认身高 170cm</div>
                </div>
                <div>
                    <span class="bmi-badge" style="background:${bmiColor}22;color:${bmiColor}">${bmiCategory}</span>
                </div>
            </div>
        </div>
    `;

    // 统计网格
    html += `
        <div class="stat-section">
            <div class="stat-section-title">详细统计</div>
            <div class="stat-grid">
                <div class="stat-cell" style="background:rgba(0,122,255,0.08)">
                    <div class="icon">📊</div>
                    <div class="label">平均体重</div>
                    <div class="value" style="color:var(--blue)">${avg.toFixed(1)}<span class="unit"> kg</span></div>
                </div>
                <div class="stat-cell" style="background:rgba(255,59,48,0.08)">
                    <div class="icon">↑</div>
                    <div class="label">最高体重</div>
                    <div class="value" style="color:var(--red)">${maxW.toFixed(1)}<span class="unit"> kg</span></div>
                </div>
                <div class="stat-cell" style="background:rgba(52,199,89,0.08)">
                    <div class="icon">↓</div>
                    <div class="label">最低体重</div>
                    <div class="value" style="color:var(--green)">${minW.toFixed(1)}<span class="unit"> kg</span></div>
                </div>
                <div class="stat-cell" style="background:rgba(175,82,222,0.08)">
                    <div class="icon">📝</div>
                    <div class="label">记录次数</div>
                    <div class="value" style="color:#AF52DE">${entries.length}<span class="unit"> 次</span></div>
                </div>
            </div>
        </div>
    `;

    // 记录信息
    html += `
        <div class="stat-section">
            <div class="stat-section-title">记录信息</div>
            <div class="stat-card">
                <div class="info-row">
                    <span class="label">首次记录</span>
                    <span class="value">${formatDate(first.date)}</span>
                </div>
                <div class="info-row">
                    <span class="label">最近记录</span>
                    <span class="value">${formatDate(latest.date)}</span>
                </div>
                <div class="info-row">
                    <span class="label">记录天数</span>
                    <span class="value">${totalDays} 天</span>
                </div>
                <div class="info-row">
                    <span class="label">记录总数</span>
                    <span class="value">${entries.length} 条</span>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
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

// ===== Service Worker 注册 =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW failed:', err));
    });
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    renderRecords();
});
