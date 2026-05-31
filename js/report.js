window.openSaleReport = async function(targetDate) {
  window.APP_STATE.STATE = 'REPORT'; window.APP_STATE.orderData = null;
  document.getElementById('back').classList.remove('hide'); 
  document.getElementById('editStateBadge').classList.add('hide'); 
  document.getElementById('alphabetSidebar').classList.add('hide'); 
  document.getElementById('searchBlock').classList.add('hide');

  if(!targetDate) {
    const todayObj = new Date();
    targetDate = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
  }
  window.APP_STATE.selectedReportDate = targetDate;
  document.getElementById('list').innerHTML = `<div style="color:#756676;padding:10px;">正在加载...</div>`;

  const { data: dayOrders } = await window.client.from('orders').select('*').eq('employee_code', window.APP_STATE.currentEmployee.code).eq('order_date', targetDate);
  if(!dayOrders || dayOrders.length === 0) {
    renderReportHtml(targetDate, 0, 0, 0, 0, []); return;
  }

  const oIds = dayOrders.map(o => o.id);
  const { data: dayItems } = await window.client.from('order_items').select('*').in('order_id', oIds);
  const itemsList = dayItems || [];

  let dayTotalSale = 0, dayTotalGiftAmt = 0, dayTotalScrapAmt = 0, totalGiftPcs = 0, totalScrapPcs = 0;
  const orderSummaryMap = {};

  dayOrders.forEach(o => {
    const matchStore = window.APP_STATE.stores.find(s => String(s.atom_code).trim() === String(o.atom_code).trim());
    orderSummaryMap[o.id] = { orderId: o.id, orderDate: o.order_date, atomCode: o.atom_code, storeName: matchStore ? matchStore.store_name : `未知门店(${o.atom_code})`, sellInAmount: 0, netRevenue: 0, skuCount: 0 };
  });

  itemsList.forEach(it => {
    const p = window.APP_STATE.products.find(x => x.id == it.product_id); if(!p) return;
    const parsed = window.utils.parseReturnHandleText(it.return_handle);
    const row = window.utils.getLiveRowAmounts(p, Number(it.qty || 0), Number(it.price || 0), Number(it.gift_qty || 0), Number(parsed.qty || 0), parsed.handle);

    dayTotalSale += row.saleAmount; dayTotalGiftAmt += row.giftAmount;
    if(parsed.handle === 'SCRAP') { dayTotalScrapAmt += row.scrapAmount; totalScrapPcs += Number(parsed.qty || 0); }
    totalGiftPcs += Number(it.gift_qty || 0); 

    if(orderSummaryMap[it.order_id]) {
      const targetOrder = orderSummaryMap[it.order_id];
      targetOrder.sellInAmount += row.saleAmount;
      targetOrder.netRevenue += (row.saleAmount - row.giftAmount - (parsed.handle === 'SCRAP' ? row.scrapAmount : 0));
      targetOrder.skuCount += 1;
    }
  });

  renderReportHtml(targetDate, dayTotalSale, (dayTotalSale - dayTotalScrapAmt - dayTotalGiftAmt), totalGiftPcs, totalScrapPcs, Object.values(orderSummaryMap));
};

function renderReportHtml(dateStr, saleSum, netSum, totalGift, totalScrap, rows) {
  document.getElementById('list').innerHTML = `
    <div class="big-store-title">📈 卖进数据日报</div>
    <div class='sub' style='font-weight:700;color:var(--primary); font-size:15px; margin-bottom:10px;'>归属员工：${window.APP_STATE.currentEmployee.name}</div>
    <div style='margin-bottom:14px; font-size:14px;'>📅 选择核算日期：
      <div class="date-picker-wrapper"><button class='smallbtn' style="border-color:var(--primary); color:var(--primary); font-weight:bold;">${dateStr} 🔄</button><input type="date" class="real-date-input" value="${dateStr}" onchange="openSaleReport(this.value)"></div>
    </div>
    <div class="amount-summary-banner" style="line-height:1.6; background:#fbf8fc;">
      <span style="font-size:16px; color:var(--primary);">💵 <strong>当日总实收：${netSum.toFixed(1)} 元</strong></span><br>
      当日总卖进：<strong>${saleSum.toFixed(1)} 元</strong>
      ${(totalGift > 0 || totalScrap > 0) ? `
      <div style="display:flex; gap:20px; font-size:13px; margin-top:2px; color:var(--text-muted);">
        ${totalGift > 0 ? `<span>🎁 总赠送数：<strong style="color:#1890ff;">${totalGift}</strong> 个</span>` : ''}
        ${totalScrap > 0 ? `<span>🔴 总过期数：<strong style="color:red;">${totalScrap}</strong> 个</span>` : ''}
      </div>` : ''}
    </div>
    <div style="font-size:14px; font-weight:800; color:var(--primary); margin:18px 0 8px 4px;">🏪 当日订单明细</div>
    ${rows.length === 0 ? `<div class="sub" style="text-align:center; padding:30px; color:#aaa;">该日期下该员工没有任何开单流水</div>` : 
      rows.map(r => `
        <div class="history-item" style="cursor:pointer; border-left:4px solid var(--primary); padding:14px; margin-bottom:10px;" onclick="window.APP_STATE.currentStore={atom:'${r.atomCode}', name:'${r.storeName}'}; viewOrderDetail('${r.orderId}', '${r.orderDate}', true)">
          <div style="width:100%; display:flex; justify-content:space-between; align-items:center;"><strong style="font-size:15px; color:var(--primary);">${r.storeName}</strong><span style="color:var(--text-muted); font-size:13px;">查看明细 ✏️</span></div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top:4px;"><span>SKU数: ${r.skuCount} 款 | 卖进: ${r.sellInAmount.toFixed(1)} 元</span><br><span style="color:#2b1d2c; font-weight:700; font-size:13px;">💵 实收：${r.netRevenue.toFixed(1)} 元</span></div>
        </div>`).join('')}
  `;
}
