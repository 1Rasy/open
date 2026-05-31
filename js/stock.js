window.openStockManagement = async function() {
  window.APP_STATE.STATE = 'STOCK'; 
  window.APP_STATE.orderData = null; 
  document.getElementById('back').classList.remove('hide');
  document.getElementById('editStateBadge').classList.add('hide');
  document.getElementById('alphabetSidebar').classList.add('hide'); 
  document.getElementById('searchBlock').classList.add('hide'); 
  document.getElementById('list').innerHTML = '<div style="color:#756676;padding:10px;">正在加载...</div>';

  const { data: currentStocks } = await window.client.from('emp_stocks').select('*').eq('employee_code', window.APP_STATE.currentEmployee.code);
  const stockMap = {};
  (currentStocks || []).forEach(st => { stockMap[st.product_id] = st.stock_qty || 0; });
  window.APP_STATE.stockData = { emp_code: window.APP_STATE.currentEmployee.code, currentStockMap: stockMap, additions: {} };

  // 修复漏洞：防御性获取商品品牌，防止 products 为空或未加载完成时直接报错卡死
  if (window.APP_STATE.products && window.APP_STATE.products.length > 0) {
    const brands = [...new Set(window.APP_STATE.products.map(p => p.brand).filter(Boolean))];
    window.APP_STATE.currentSelectedBrand = brands.length > 0 ? brands[0] : null;
  } else {
    window.APP_STATE.currentSelectedBrand = null;
  }
  window.APP_STATE.currentSelectedSpec = "ALL";

  window.renderStockPage();
};

window.renderStockPage = function() {
  window.APP_STATE.STATE = 'STOCK';
  
  // 防御如果没有选中的品牌，则提示
  if (!window.APP_STATE.currentSelectedBrand) {
    document.getElementById('list').innerHTML = `
      <div class="big-store-title">📦 库存表</div>
      <div class="sub" style="text-align:center;padding:20px;">⚠️ 暂无商品数据，无法管理库存</div>`;
    return;
  }

  const displayProducts = window.APP_STATE.products.filter(p => p.brand === window.APP_STATE.currentSelectedBrand && (window.APP_STATE.currentSelectedSpec === "ALL" ? true : p.spec === window.APP_STATE.currentSelectedSpec));

  document.getElementById('list').innerHTML = `
    <div class="big-store-title">📦 库存表</div>
    <div class='sub' style='font-weight:700;color:var(--primary); font-size:15px; margin-bottom:6px;'>🏢 主体：${window.APP_STATE.currentEmployee.name}</div>
    ${window.utils.generateFilterHeaderHtml()}
    ${displayProducts.map(p => {
      const specCase = p.pcs_per_case || 24, specBox = p.pcs_per_box || 0; 
      const totalPcs = window.APP_STATE.stockData.currentStockMap[p.id] || 0; 
      const currentDir = window.APP_STATE.stockData.additions[p.id]?.dir || 'plus';
      return `
        <div class="stock-row">
          <div style="font-weight:600; font-size:15px; color:var(--primary);">${p.spec} ${p.product_name}</div>
          <div style="font-size:13px; margin-top:6px; color:#333; background:#f0ebf1; padding:6px 10px; border-radius:6px;">当前库存: <strong>${window.utils.formatQtyToUnits(totalPcs, specCase, specBox)}</strong></div>
          <div class="stock-input-group">
            <button id="dir_btn_${p.id}" class="btn-toggle-dir ${currentDir==='plus'?'plus':'minus'}" onclick="toggleStockDirection('${p.id}')">${currentDir==='plus'?'增加 ➕':'减少 ➖'}</button>
            <div class="picker-wrapper"><select class="ios-picker" onchange="updateStockInput('${p.id}', 'cases', this.value)">${window.utils.makePureQtyOptionsHtml(50, window.APP_STATE.stockData.additions[p.id]?.cases||0)}</select><span class="unit-txt">件</span></div>
            <div class="picker-wrapper ${specBox===0?'hide':''}"><select class="ios-picker" onchange="updateStockInput('${p.id}', 'boxes', this.value)">${window.utils.makePureQtyOptionsHtml(50, window.APP_STATE.stockData.additions[p.id]?.boxes||0)}</select><span class="unit-txt">盒</span></div>
            <div class="picker-wrapper"><select class="ios-picker" onchange="updateStockInput('${p.id}', 'pcs', this.value)">${window.utils.makePureQtyOptionsHtml(100, window.APP_STATE.stockData.additions[p.id]?.pcs||0)}</select><span class="unit-txt">个</span></div>
          </div>
        </div>`;
    }).join('')}
    <button id="stockSubmitBtn" class='float-submit' onclick='submitStock()'>💾 更新库存</button>
  `;
};

window.toggleStockDirection = function(prodId) {
  if(!window.APP_STATE.stockData.additions[prodId]) window.APP_STATE.stockData.additions[prodId] = { dir: 'plus', cases: 0, boxes: 0, pcs: 0 };
  const nextDir = window.APP_STATE.stockData.additions[prodId].dir === 'plus' ? 'minus' : 'plus';
  window.APP_STATE.stockData.additions[prodId].dir = nextDir;
  const btn = document.getElementById(`dir_btn_${prodId}`);
  if(btn) {
    btn.className = "btn-toggle-dir " + nextDir;
    btn.innerText = nextDir === 'plus' ? "增加 ➕" : "减少 ➖";
  }
};

window.updateStockInput = function(prodId, type, val){
  if(!window.APP_STATE.stockData.additions[prodId]) window.APP_STATE.stockData.additions[prodId] = { dir: 'plus', cases: 0, boxes: 0, pcs: 0 };
  window.APP_STATE.stockData.additions[prodId][type] = parseInt(val) || 0;
};

window.submitStock = async function(){
  const addIds = Object.keys(window.APP_STATE.stockData.additions);
  let hasData = false; const updates = []; 
  for(let id of addIds){
    const p = window.APP_STATE.products.find(x => x.id == id);
    const d = window.APP_STATE.stockData.additions[id];
    let delta = (p.pcs_per_box||0) > 0 ? ((d.cases||0)*(p.pcs_per_case||24)) + ((d.boxes||0)*(p.pcs_per_box||0)) + (d.pcs||0) : ((d.cases||0)*(p.pcs_per_case||24)) + (d.pcs||0);
    if(delta > 0){
      hasData = true; 
      let newTotal = d.dir === 'plus' ? (window.APP_STATE.stockData.currentStockMap[id]||0) + delta : (window.APP_STATE.stockData.currentStockMap[id]||0) - delta;
      if (newTotal < 0) { alert(`❌ [${p.product_name}] 可用库存不足！`); return; }
      updates.push({ employee_code: window.APP_STATE.stockData.emp_code, product_id: id, stock_qty: newTotal });
    }
  }
  if(!hasData){ alert("请输入变更量！"); return; }
  await window.client.from('emp_stocks').upsert(updates, { onConflict: 'employee_code,product_id' });
  window.openStockManagement();
};
