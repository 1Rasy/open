// === 多网页兼容补丁：防止找不到旧节点导致整页卡死 ===
(function() {
  const safeGet = (id) => document.getElementById(id) || { classList: { add:()=>{}, remove:()=>{} }, style: {} };
  
  // 如果在独立的 store.html 里缺了旧首页的节点，自动用空对象顶替，防止 js 报错
  if (!document.getElementById('editStateBadge')) {
    window.addEventListener('DOMContentLoaded', () => {
      if (!document.getElementById('editStateBadge')) {
        const dummy = document.createElement('div');
        dummy.id = 'editStateBadge'; dummy.className = 'hide';
        dummy.style.display = 'none';
        document.body.appendChild(dummy);
      }
      if (!document.getElementById('alphabetSidebar')) {
        const dummy2 = document.createElement('div');
        dummy2.id = 'alphabetSidebar'; dummy2.className = 'hide';
        document.body.appendChild(dummy2);
      }
    });
  }
})();
// === 补丁结束 ===
window.renderStores = function() {
  window.APP_STATE.STATE = 'STORE';
  window.APP_STATE.orderData = null; 
  document.getElementById('back').classList.remove('hide');
  document.getElementById('editStateBadge').classList.add('hide');
  document.getElementById('searchBlock').classList.remove('hide'); 
  document.getElementById('search').placeholder = "🔍 输入门店名称或编码搜索店铺...";

  const k = document.getElementById('search').value || '';
  const f = window.APP_STATE.stores.filter(s => (s.store_name || '').includes(k) || (s.atom_code || '').includes(k));

  const groupedStores = {};
  const activeLetters = new Set();

  f.forEach(s => {
    const letter = window.utils.getFirstLetter(s.store_name);
    if (!groupedStores[letter]) groupedStores[letter] = [];
    groupedStores[letter].push(s);
    activeLetters.add(letter);
  });

  const sortedLetters = Array.from(activeLetters).sort();
  const sidebarEl = document.getElementById('alphabetSidebar');
  
  if (sortedLetters.length > 1 && !k && f.length > 10) { 
    sidebarEl.classList.remove('hide');
    sidebarEl.innerHTML = sortedLetters.map(l => `<div class="alphabet-letter" onclick="scrollToLetterGroup('${l}')">${l}</div>`).join('');
  } else {
    sidebarEl.classList.add('hide'); sidebarEl.innerHTML = '';
  }

  let listHtml = `
    <div class="store-top-gates">
      <button class="btn-gate-half btn-gate-stock" onclick="openStockManagement()">📦 库存管理</button>
      <button class="btn-gate-half btn-gate-report" onclick="openSaleReport()">📊 卖进数据</button>
    </div>
    <div style='font-size:14px; font-weight:700; color:var(--primary); margin: 0 0 14px 4px;'>门店总数：${window.APP_STATE.stores.length} 家</div>
    <div class="store-container">
  `;

  if (sortedLetters.length === 0) {
    listHtml += `<div class="sub" style="text-align:center;padding:20px;">⚠️ 未找到匹配的店铺</div>`;
  } else {
    sortedLetters.forEach(letter => {
      listHtml += `<div id="group_letter_${letter}" class="letter-group-title">${letter}</div>`;
      groupedStores[letter].forEach(s => {
        listHtml += `
          <div class='item' onclick="openStoreHistory('${s.atom_code}','${s.store_name}')">
            <div class="item-main-row">
              <div>
                <strong style="font-size:16px;color:var(--primary);">${s.store_name}</strong>
                <div class='sub'>${s.atom_code}</div>
              </div>
            </div>
          </div>
        `;
      });
    });
  }
  listHtml += `</div>`;
  document.getElementById('list').innerHTML = listHtml;
};

window.scrollToLetterGroup = function(letter) {
  const target = document.getElementById(`group_letter_${letter}`);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.openStoreHistory = async function(atom, name) {
  window.APP_STATE.STATE = 'HISTORY'; window.APP_STATE.currentStore = { atom, name };
  document.getElementById('back').classList.remove('hide'); 
  document.getElementById('editStateBadge').classList.add('hide'); 
  document.getElementById('alphabetSidebar').classList.add('hide'); 
  document.getElementById('searchBlock').classList.add('hide'); 
  document.getElementById('list').innerHTML = '<div style="color:#756676;padding:10px;">正在加载...</div>';
  
  const { data: ordersData } = await window.client.from('orders').select('*').eq('atom_code', atom).order('order_date', { ascending: false });
  window.APP_STATE.historyOrders = ordersData || []; 

  if(window.APP_STATE.historyOrders.length > 0) {
    const orderIds = window.APP_STATE.historyOrders.map(o => o.id);
    const { data: itemsData } = await window.client.from('order_items').select('*').in('order_id', orderIds);
    const allItems = itemsData || [];

    window.APP_STATE.historyOrders.forEach(o => {
      let sSum = 0, gSum = 0, resSum = 0, scrSum = 0;
      const oItems = allItems.filter(it => it.order_id === o.id);
      oItems.forEach(it => {
        const pObj = window.APP_STATE.products.find(x => x.id == it.product_id);
        const parsedReturn = window.utils.parseReturnHandleText(it.return_handle);
        const rowRes = window.utils.getLiveRowAmounts(pObj, Number(it.qty || 0), Number(it.price || 0), Number(it.gift_qty || 0), Number(parsedReturn.qty || 0), parsedReturn.handle);
        sSum += rowRes.saleAmount; 
        gSum += rowRes.giftAmount; 
        resSum += rowRes.restoreAmount; 
        scrSum += rowRes.scrapAmount;
      });
      o.skuCount = oItems.length;
      o.saleSum = sSum; 
      o.giftSum = gSum; 
      o.scrapSum = scrSum;
      o.netRevenue = sSum - scrSum - gSum;
    });
  }
  window.renderHistory();
};

window.renderHistory = function() {
  window.APP_STATE.STATE = 'HISTORY';
  document.getElementById('editStateBadge').classList.add('hide'); 
  document.getElementById('list').innerHTML = `
    <div class="big-store-title">${window.APP_STATE.currentStore.name}</div>
    <div style="margin: 14px 0;"><button class="btn-new-order" onclick="openOrder('${window.APP_STATE.currentStore.atom}','${window.APP_STATE.currentStore.name}')">＋ 新增单据</button></div>
    ${window.APP_STATE.historyOrders.map(o => `
        <div class="history-item" onclick="viewOrderDetail('${o.id}', '${o.order_date}', false)">
          <div style="width:100%; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:15px; font-weight:700;">📅 ${o.order_date}</span>
            <span style="color:var(--primary); font-size:14px;">详情 →</span>
          </div>
          <div style="font-size: 13px; color: var(--text-muted); line-height:1.45;">
            <span style="color:#2b1d2c; font-weight:700; font-size:14px;">💵 实收：${(o.netRevenue||0).toFixed(1)} 元</span><br>
            SKU数: ${o.skuCount || 0} 款 | 卖进: ${(o.saleSum||0).toFixed(1)} 元
            ${o.giftSum > 0 ? ` | 赠送: ${(o.giftSum||0).toFixed(1)} 元` : ''}
            ${o.scrapSum > 0 ? ` | 🔴 过期: ${(o.scrapSum||0).toFixed(1)} 元` : ''}
          </div>
        </div>
      `).join('')}
  `;
};

// 订单详情渲染页（已应用 0 值自动隐藏）
window.viewOrderDetail = async function(orderId, orderDate, fromReport = false) {
  window.APP_STATE.STATE = 'DETAIL'; 
  document.getElementById('list').setAttribute('data-from-report', fromReport ? 'true' : 'false');
  document.getElementById('editStateBadge').classList.add('hide'); 
  document.getElementById('list').innerHTML = '<div style="color:#756676;padding:10px;">正在加载...</div>';
  const { data: items } = await window.client.from('order_items').select('*').eq('order_id', orderId);
  
  let rawItemsJSON = encodeURIComponent(JSON.stringify(items));
  let detailSaleSum = 0, detailGiftSum = 0, detailRestoreSum = 0, detailScrapSum = 0;

  items.forEach(it => {
    const pObj = window.APP_STATE.products.find(x => x.id == it.product_id);
    const parsedReturn = window.utils.parseReturnHandleText(it.return_handle);
    const rowRes = window.utils.getLiveRowAmounts(pObj, Number(it.qty || 0), Number(it.price || 0), Number(it.gift_qty || 0), Number(parsedReturn.qty || 0), parsedReturn.handle);
    detailSaleSum += rowRes.saleAmount; 
    detailGiftSum += rowRes.giftAmount; 
    detailRestoreSum += rowRes.restoreAmount; 
    detailScrapSum += rowRes.scrapAmount;
  });
  
  let detailNetRevenue = detailSaleSum - detailScrapSum - detailGiftSum;

  document.getElementById('list').innerHTML = `
    <div class="big-store-title">${window.APP_STATE.currentStore.name}</div>
    <div class="amount-summary-banner" style="line-height:1.55;">
      <span style="font-size:16px; color:var(--primary);">💵 <strong>实收：${detailNetRevenue.toFixed(1)} 元</strong></span><br>
      SKU数：${items.length} 款 | 卖进：${detailSaleSum.toFixed(1)} 元
      ${detailGiftSum > 0 ? ` | 赠送：${detailGiftSum.toFixed(1)} 元` : ''}
      ${detailScrapSum > 0 ? ` | 🔴 过期：${detailScrapSum.toFixed(1)} 元` : ''}
    </div>
    <div style="display:flex; gap:10px; margin: 10px 0;">
      <button class="smallbtn" style="background:#fdf6ec; color:#e6a23c;" onclick="editExistingOrder('${orderId}', '${orderDate}', '${rawItemsJSON}')">✏️ 修改订单</button>
      <button class="smallbtn" style="background:#fef0f0; color:#f56c6c; border-color:#fde2e2;" onclick="deleteExistingOrder('${orderId}', '${rawItemsJSON}')">🗑️ 删除订单</button>
    </div>
    ${items.map(it => {
      const p = window.APP_STATE.products.find(x => x.id == it.product_id) || { product_name: '未知商品', spec: '常规', pcs_per_box: 0 };
      const parsedReturn = window.utils.parseReturnHandleText(it.return_handle);
      const rowRes = window.utils.getLiveRowAmounts(p, Number(it.qty || 0), Number(it.price || 0), Number(it.gift_qty || 0), Number(parsedReturn.qty || 0), parsedReturn.handle);
      const rowNetRevenue = rowRes.saleAmount - rowRes.scrapAmount - rowRes.giftAmount;

      const isOreoSpecial = window.utils.isSpecialSpecOreo(p);
      let saleUnitLabel = isOreoSpecial ? "盒" : "个"; 
      let saleQtyDisplayText = `${it.qty} ${saleUnitLabel}`;

      const actualScrapQty = parsedReturn.handle === 'SCRAP' ? parsedReturn.qty : 0;
      const hasGift = (it.gift_qty || 0) > 0;
      const hasScrap = actualScrapQty > 0;

      let gridStyle = "grid-template-columns: 1fr 1fr;";
      if(!hasGift && !hasScrap) {
         gridStyle = "grid-template-columns: 1fr 1fr; border-bottom: none; padding-bottom: 0;";
      }

      return `
        <div class='item'>
          <div style="font-weight:600; font-size:15px; color:var(--primary); margin-bottom: 6px;">${p.spec} ${p.product_name}</div>
          <div class="detail-grid-container" style="${gridStyle}">
            <div class="detail-grid-item">
              <span>实收: <strong style="color:var(--primary); font-size:14px;">${rowNetRevenue.toFixed(1)}元</strong></span>
            </div>
            <div class="detail-grid-item" style="text-align: right; justify-content: flex-end;">
              <span>卖进: <strong>${saleQtyDisplayText}</strong> × ${Number(it.price).toFixed(window.utils.getPriceDecimalPlaces(it.product_id))}元</span>
            </div>
            ${hasGift ? `<div class="detail-grid-item"><span>赠送: <span style="color:#1890ff; font-weight:bold;">${it.gift_qty}</span> 个</span></div>` : ''}
            ${hasScrap ? `<div class="detail-grid-item" style="text-align: right; justify-content: flex-end;"><span>过期: <span style="color:red; font-weight:bold;">${actualScrapQty}</span> 个</span></div>` : ''}
          </div>
        </div>`;
    }).join('')}
  `;
};

// 以下是开单保存相关的事件中转与逻辑
window.openOrder = function(atom, name) { templateEditOrNew(null, null, null, atom, name); };
window.editExistingOrder = function(orderId, orderDate, rawItemsEncoded) { templateEditOrNew(orderId, orderDate, rawItemsEncoded); };

function templateEditOrNew(orderId=null, orderDate=null, rawItemsEncoded=null, atom=null, name=null) {
  window.APP_STATE.STATE = 'ORDER';
  if(orderId) {
    const items = JSON.parse(decodeURIComponent(rawItemsEncoded));
    window.APP_STATE.orderData = { id: orderId, atom: window.APP_STATE.currentStore.atom, name: window.APP_STATE.currentStore.name, date: orderDate, items: {}, oldItemsMap: {} };
    items.forEach(it => {
      const parsedReturn = window.utils.parseReturnHandleText(it.return_handle);
      window.APP_STATE.orderData.items[it.product_id] = { 
        qty: Number(it.qty || 0), price: Number(it.price || 0), gift_qty: Number(it.gift_qty || 0),
        return_qty: Number(parsedReturn.qty || 0), return_handle: parsedReturn.handle,
        showPanel: Number(parsedReturn.qty || 0) > 0 || Number(it.gift_qty || 0) > 0
      };
      
      const pObj = window.APP_STATE.products.find(x => x.id == it.product_id);
      const isOreoSpecial = window.utils.isSpecialSpecOreo(pObj);
      const specBox = isOreoSpecial ? (pObj.pcs_per_box || 6) : 1;
      const saleBags = isOreoSpecial ? (Number(it.qty || 0) * specBox) : Number(it.qty || 0);
      const giftBags = Number(it.gift_qty || 0);
      const returnBags = Number(parsedReturn.qty || 0);
      let oldNet = saleBags + giftBags;
      if (parsedReturn.handle === 'RESTORE') oldNet -= returnBags; 
      window.APP_STATE.orderData.oldItemsMap[it.product_id] = oldNet; 
    });
    document.getElementById('editStateBadge').classList.remove('hide');
  } else {
    const d = new Date(); 
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    window.APP_STATE.orderData = { atom, name, date: today, items: {}, oldItemsMap: {} }; 
    document.getElementById('editStateBadge').classList.add('hide');
  }
  window.renderOrder();
}

window.renderOrder = function() {
  window.APP_STATE.STATE = 'ORDER';
  const displayProducts = window.APP_STATE.products.filter(p => p.brand === window.APP_STATE.currentSelectedBrand && (window.APP_STATE.currentSelectedSpec === "ALL" ? true : p.spec === window.APP_STATE.currentSelectedSpec));

  document.getElementById('list').innerHTML = `
    <div class="big-store-title">${window.APP_STATE.orderData.name}</div>
    <div style='margin-bottom:8px;'>📅 日期：<span id='dateText'>${window.APP_STATE.orderData.date}</span>
      <div class="date-picker-wrapper"><button class='smallbtn'>修改日期</button><input type="date" class="real-date-input" value="${window.APP_STATE.orderData.date}" onchange="syncSelectedDate(this.value)"></div>
    </div>
    <div id="liveAmountBanner" class="amount-summary-banner"></div>
    ${window.utils.generateFilterHeaderHtml()}
    ${displayProducts.map(p => {
      const isOreoSpecial = window.utils.isSpecialSpecOreo(p);
      const defaultPriceVal = isOreoSpecial ? 17.5 : (p.default_price || 15);
      const itData = window.APP_STATE.orderData.items[p.id] || { qty: 0, price: defaultPriceVal, gift_qty: 0, return_qty: 0, return_handle: 'RESTORE', showPanel: false };
      const stepPlaces = window.utils.getPriceDecimalPlaces(p.id);
      return `
        <div class='item'>
          <div class="item-main-row">
            <div class='prod-info'>
              <div class='prod-name'>${p.spec} ${p.product_name}</div>
              <button id="btn_as_${p.id}" class="btn-aftersale-trigger ${itData.return_qty > 0 || itData.gift_qty > 0 ? 'active' : ''}" onclick="toggleAfterSalePanel('${p.id}')">🔄 收回及赠送</button>
            </div>
            <div class='control-group'>
              <div class="picker-wrapper"><span class="label-txt">销售:</span><select class="ios-picker" onchange="pickerChangeQty('${p.id}', this.value)">${window.utils.makePureQtyOptionsHtml(100, itData.qty)}</select><span class="unit-txt">${isOreoSpecial?"盒":"个"}</span></div>
              <div class="picker-wrapper"><span class="label-txt">单价:</span><select class="ios-picker" onchange="pickerChangePrice('${p.id}', this.value)">${window.utils.makePurePriceOptionsHtml(defaultPriceVal, stepPlaces, itData.price)}</select><span class="unit-txt">元</span></div>
            </div>
          </div>
          <div id="panel_${p.id}" class="aftersale-panel ${itData.showPanel ? '' : 'hide'}">
            <div class="aftersale-row-picks">
              <div class="picker-wrapper" style="flex:1;"><span class="label-txt">收回量:</span><select class="ios-picker" onchange="pickerChangeReturnQty('${p.id}', this.value)">${window.utils.makePureQtyOptionsHtml(100, itData.return_qty)}</select><span class="unit-txt">个</span></div>
              <div class="picker-wrapper" style="flex:1;"><span class="label-txt">赠送:</span><select class="ios-picker" onchange="pickerChangeGiftQty('${p.id}', this.value)">${window.utils.makePureQtyOptionsHtml(50, itData.gift_qty)}</select><span class="unit-txt">个</span></div>
            </div>
            <div class="aftersale-options">
              <label><input type="radio" name="handle_${p.id}" value="RESTORE" ${itData.return_handle!=='SCRAP'?'checked':''} onchange="setReturnHandle('${p.id}','RESTORE')">🟢 能卖</label>
              <label><input type="radio" name="handle_${p.id}" value="SCRAP" ${itData.return_handle==='SCRAP'?'checked':''} onchange="setReturnHandle('${p.id}','SCRAP')">🔴 过期</label>
            </div>
          </div>
        </div>`;
    }).join('')}
    <button class='float-submit' onclick='submitOrder()'>🚀 提交账单</button>
  `;
  window.calculateLiveOrderAmounts();
};

window.calculateLiveOrderAmounts = function() {
  let s = 0, g = 0, res = 0, scr = 0, activeSKUCount = 0;
  window.APP_STATE.products.forEach(p => {
    const item = window.APP_STATE.orderData.items[p.id];
    if(item) {
      if(Number(item.qty || 0) > 0 || Number(item.gift_qty || 0) > 0 || Number(item.return_qty || 0) > 0) activeSKUCount++;
      const rowRes = window.utils.getLiveRowAmounts(p, Number(item.qty || 0), Number(item.price || 0), Number(item.gift_qty || 0), Number(item.return_qty || 0), item.return_handle);
      s += rowRes.saleAmount; g += rowRes.giftAmount; res += rowRes.restoreAmount; scr += rowRes.scrapAmount;      
    }
  });
  document.getElementById('liveAmountBanner').innerHTML = `
    <span style="font-size:15px; color:var(--primary);">💵 <strong>实收：${(s-scr-g).toFixed(1)} 元</strong></span><br>
    SKU数：${activeSKUCount} 款 | 卖进：${s.toFixed(1)} 元
    ${g > 0 ? ` | 赠送：${g.toFixed(1)} 元` : ''}
    ${scr > 0 ? ` | 过期：${scr.toFixed(1)} 元` : ''}
  `;
};

// 各种 Picker 编辑触发状态同步
function initItemState(id) {
  if(!window.APP_STATE.orderData.items[id]){ 
    const p = window.APP_STATE.products.find(x => x.id == id); 
    const isOreoSpecial = window.utils.isSpecialSpecOreo(p);
    window.APP_STATE.orderData.items[id] = { qty: 0, price: isOreoSpecial?17.5:(p.default_price||15), gift_qty: 0, return_qty: 0, return_handle: 'RESTORE', showPanel: false }; 
  }
}
window.pickerChangeQty = function(id, v) { initItemState(id); window.APP_STATE.orderData.items[id].qty = parseInt(v)||0; window.calculateLiveOrderAmounts(); };
window.pickerChangeGiftQty = function(id, v) { initItemState(id); window.APP_STATE.orderData.items[id].gift_qty = parseInt(v)||0; window.calculateLiveOrderAmounts(); };
window.pickerChangeReturnQty = function(id, v) { initItemState(id); window.APP_STATE.orderData.items[id].return_qty = parseInt(v)||0; window.calculateLiveOrderAmounts(); };
window.toggleAfterSalePanel = function(id) { initItemState(id); window.APP_STATE.orderData.items[id].showPanel = !window.APP_STATE.orderData.items[id].showPanel; window.renderOrder(); };
window.setReturnHandle = function(id, h) { initItemState(id); window.APP_STATE.orderData.items[id].return_handle = h; window.calculateLiveOrderAmounts(); };
window.syncSelectedDate = function(val){ if(!val) return; window.APP_STATE.orderData.date = val; document.getElementById('dateText').innerText = val; };

window.pickerChangePrice = function(id, value) { 
  initItemState(id); const targetPrice = parseFloat(value) || 0;
  const currentProd = window.APP_STATE.products.find(x => x.id == id);
  if (!currentProd) return;
  window.APP_STATE.products.filter(p => p.brand === currentProd.brand && p.spec === currentProd.spec).forEach(p => {
    initItemState(p.id); window.APP_STATE.orderData.items[p.id].price = targetPrice;
  });
  window.renderOrder();
};

window.deleteExistingOrder = async function(orderId, rawItemsEncoded) {
  if (!confirm("确定要删除这笔订单吗？")) return;
  const isFromReport = document.getElementById('list').getAttribute('data-from-report') === 'true';
  document.getElementById('list').innerHTML = '<div style="color:#756676;padding:10px;">正在删除...</div>';
  try {
    const items = JSON.parse(decodeURIComponent(rawItemsEncoded));
    const { data: currentStocks } = await window.client.from('emp_stocks').select('*').eq('employee_code', window.APP_STATE.currentEmployee.code);
    const liveStockMap = {}; (currentStocks || []).forEach(st => { liveStockMap[st.product_id] = st.stock_qty || 0; });
    const stockUpdates = [];
    items.forEach(it => {
      const parsedReturn = window.utils.parseReturnHandleText(it.return_handle);
      const pObj = window.APP_STATE.products.find(x => x.id == it.product_id);
      if (!pObj) return;
      const specBox = window.utils.isSpecialSpecOreo(pObj) ? (pObj.pcs_per_box || 6) : 1;
      let oldNetImpact = (window.utils.isSpecialSpecOreo(pObj) ? Number(it.qty||0)*specBox : Number(it.qty||0)) + Number(it.gift_qty||0);
      if (parsedReturn.handle === 'RESTORE') oldNetImpact -= Number(parsedReturn.qty || 0);
      stockUpdates.push({ employee_code: window.APP_STATE.currentEmployee.code, product_id: it.product_id, stock_qty: Number(liveStockMap[it.product_id]||0) + oldNetImpact });
    });
    await window.client.from('order_items').delete().eq('order_id', orderId);
    await window.client.from('orders').delete().eq('id', orderId);
    if (stockUpdates.length > 0) await window.client.from('emp_stocks').upsert(stockUpdates, { onConflict: 'employee_code,product_id' });
    if (isFromReport) openSaleReport(window.APP_STATE.selectedReportDate);
    else openStoreHistory(window.APP_STATE.currentStore.atom, window.APP_STATE.currentStore.name);
  } catch (err) {
    console.error(err); viewOrderDetail(orderId, window.APP_STATE.selectedReportDate, isFromReport);
  }
};

window.submitOrder = async function(){
  let grandTotalQty = 0;
  Object.keys(window.APP_STATE.orderData.items).forEach(id => {
    const it = window.APP_STATE.orderData.items[id];
    grandTotalQty += Number(it.qty || 0) + Number(it.gift_qty || 0) + Number(it.return_qty || 0);
  });
  if (grandTotalQty === 0) { alert("⚠️ 订单中没有填写任何有效数据，无法提交！"); return; }
  const submitBtn = document.querySelector('.float-submit');
  if(submitBtn) { submitBtn.disabled = true; submitBtn.innerText = '⏳ 提交中...'; }

  const { data: currentStocks } = await window.client.from('emp_stocks').select('*').eq('employee_code', window.APP_STATE.currentEmployee.code);
  const liveStockMap = {}; (currentStocks || []).forEach(st => { liveStockMap[st.product_id] = st.stock_qty || 0; });
  const stockUpdates = []; let isStockDeficit = false; 
  const allProdIds = new Set([...Object.keys(window.APP_STATE.orderData.items), ...Object.keys(window.APP_STATE.orderData.oldItemsMap || {})]);

  for (let id of allProdIds) {
    const item = window.APP_STATE.orderData.items[id] || { qty: 0, gift_qty: 0, return_qty: 0, return_handle: 'RESTORE' };
    const oldNetImpact = Number(window.APP_STATE.orderData.oldItemsMap?.[id] || 0); 
    const pObj = window.APP_STATE.products.find(x => x.id == id);
    const specBox = window.utils.isSpecialSpecOreo(pObj) ? (pObj.pcs_per_box || 6) : 1;
    let currentNetImpact = (window.utils.isSpecialSpecOreo(pObj)?Number(item.qty||0)*specBox:Number(item.qty||0)) + Number(item.gift_qty || 0);
    if (item.return_handle === 'RESTORE') currentNetImpact -= Number(item.return_qty || 0);
    const delta = currentNetImpact - oldNetImpact; 
    const finalNewStock = Number(liveStockMap[id] || 0) - delta;
    if (finalNewStock < 0) isStockDeficit = true;
    if (delta !== 0 || Number(item.qty || 0) > 0 || Number(item.return_qty || 0) > 0 || Number(item.gift_qty || 0) > 0) {
      stockUpdates.push({ employee_code: window.APP_STATE.currentEmployee.code, product_id: id, stock_qty: finalNewStock });
    }
  }

  const formattedItems = [];
  Object.keys(window.APP_STATE.orderData.items).forEach(id => { 
    const it = window.APP_STATE.orderData.items[id]; 
    if(Number(it.qty || 0) > 0 || Number(it.return_qty || 0) > 0 || Number(it.gift_qty || 0) > 0){ 
      formattedItems.push({ product_id: id, qty: Number(it.qty || 0), price: Number(it.price || 0), gift_qty: Number(it.gift_qty || 0), return_handle: `${it.return_qty || 0}_${it.return_handle}` }); 
    } 
  });

  if (window.APP_STATE.orderData.id) {
    await window.client.from('orders').update({ order_date: window.APP_STATE.orderData.date }).eq('id', window.APP_STATE.orderData.id);
    await window.client.from('order_items').delete().eq('order_id', window.APP_STATE.orderData.id);
    formattedItems.forEach(fit => fit.order_id = window.APP_STATE.orderData.id);
    await window.client.from('order_items').insert(formattedItems); 
  } else {
    const { data: o } = await window.client.from('orders').insert({ employee_code: window.APP_STATE.currentEmployee.code, atom_code: window.APP_STATE.orderData.atom, order_date: window.APP_STATE.orderData.date }).select().single();
    formattedItems.forEach(fit => fit.order_id = o.id);
    await window.client.from('order_items').insert(formattedItems); 
  }
  if (stockUpdates.length > 0) await window.client.from('emp_stocks').upsert(stockUpdates, { onConflict: 'employee_code,product_id' });
  if (isStockDeficit) alert('提交成功，但可用库存出现负数，请注意及时补充！');
  window.APP_STATE.orderData = null; 
  document.getElementById('editStateBadge').classList.add('hide');
  openStoreHistory(window.APP_STATE.currentStore.atom, window.APP_STATE.currentStore.name);
};
