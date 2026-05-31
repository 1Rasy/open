window.renderEmployees = function() {
  window.APP_STATE.STATE = 'EMP';
  window.APP_STATE.orderData = null; 
  document.getElementById('back').classList.add('hide');
  document.getElementById('editStateBadge').classList.add('hide'); 
  document.getElementById('alphabetSidebar').classList.add('hide'); 
  document.getElementById('searchBlock').classList.remove('hide'); 
  document.getElementById('search').placeholder = "🔍 输入姓名或工号搜索员工...";

  const k = document.getElementById('search').value || '';
  
  // 1. 过滤符合搜索条件的员工
  let list = window.APP_STATE.employees.filter(e => 
    (e.employee_name || '').includes(k) || (e.employee_code || '').includes(k)
  );

  // 2. 核心调整：按照拼音首字母进行升序排序 (A-Z)
  list.sort((a, b) => {
    const nameA = a.employee_name || '';
    const nameB = b.employee_name || '';
    return nameA.localeCompare(nameB, 'zh-CN');
  });

  if (list.length === 0) {
    document.getElementById('list').innerHTML = `<div class="sub" style="text-align:center;padding:30px;">⚠️ 未找到匹配的员工</div>`;
    return;
  }

  // 3. 渲染添加了拼音标签提示的员工列表
  document.getElementById('list').innerHTML = `
    <div style="font-size:13px; color:var(--text-muted); margin-bottom:8px; padding-left:4px;">按拼音首字母排序：</div>
    <div class="emp-grid">
      ${list.map(e => {
        const letter = window.utils.getFirstLetter(e.employee_name);
        return `
          <div class='emp-card' onclick="openEmployee('${e.employee_code}','${e.employee_name}')">
            <span style="float:right; font-size:11px; color:var(--text-muted); background:#eee; padding:2px 5px; border-radius:4px;">${letter}</span>
            <strong style="font-size:16px; color:var(--primary); display:block; margin-bottom:4px;">${e.employee_name}</strong>
            <div class='sub' style="font-size:12px;">${e.employee_code}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
};

window.openEmployee = async function(code, name) {
  document.getElementById('search').value = '';
  document.getElementById('clearSearch').style.display = 'none';
  window.APP_STATE.STATE = 'STORE';
  window.APP_STATE.orderData = null; 
  window.APP_STATE.currentEmployee = { code, name };
  document.getElementById('back').classList.remove('hide');
  document.getElementById('editStateBadge').classList.add('hide');
  document.getElementById('searchBlock').classList.remove('hide'); 
  document.getElementById('list').innerHTML = '<div style="color:#756676;padding:10px;">正在加载...</div>';

  const r = await window.client.from('employee_stores').select('atom_code').eq('employee_code', code);
  const codes = (r.data || []).map(i => String(i.atom_code).trim());

  if (codes.length === 0) {
    document.getElementById('alphabetSidebar').classList.add('hide');
    document.getElementById('list').innerHTML = `
      <div class="store-top-gates">
        <button class="btn-gate-half btn-gate-stock" onclick="openStockManagement()">📦 库存管理</button>
        <button class="btn-gate-half btn-gate-report" onclick="openSaleReport()">📊 卖进数据</button>
      </div>
      <div style='font-size:14px; font-weight:700; color:var(--primary); margin: 6px 0 14px 4px;'>门店总数：0 家</div>
      <div class="sub" style="text-align:center;padding:20px;color:red;">⚠️ 该员工未绑定任何门店</div>`;
    return;
  }

  const { data: matchedStores } = await window.client.from('stores_dim').select('*').in('atom_code', codes);
  window.APP_STATE.stores = (matchedStores || []).sort((a, b) => (a.store_name || '').localeCompare((b.store_name || ''), 'zh-CN'));
  window.renderStores();
};
