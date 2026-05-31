// 初始化入口
async function initSystem(){
  try {
    document.getElementById('list').innerHTML = '<div style="color:#756676;padding:10px;">正在加载基础配置...</div>';
    const e = await window.client.from('employees').select('*');
    const p = await window.client.from('products').select('*');
    window.APP_STATE.employees = e.data || [];
    window.APP_STATE.products = (p.data || []).map(x => ({ 
      ...x, spec: (x.spec || '常规款').trim(), pcs_per_box: parseInt(x.pcs_per_box) || 0
    }));
    window.renderEmployees();
  } catch (err) {
    console.error(err);
    document.getElementById('list').innerHTML = '<div style="color:red;padding:10px;">❌ 页面初始化失败，请检查数据库配置或网络</div>';
  }
}

// 统一头部搜索栏过滤控制
window.handleSearch = function() {
  if(window.APP_STATE.STATE === 'EMP') window.renderEmployees();
  else if(window.APP_STATE.STATE === 'STORE') window.renderStores();
  
  const val = document.getElementById('search').value;
  document.getElementById('clearSearch').style.display = (val && val.length > 0) ? 'block' : 'none';
};

window.clearSearchInput = function() {
  document.getElementById('search').value = '';
  document.getElementById('clearSearch').style.display = 'none';
  if(window.APP_STATE.STATE === 'EMP') window.renderEmployees();
  else if(window.APP_STATE.STATE === 'STORE') window.renderStores();
};

// 统一规格及品牌切换分流器
window.selectBrand = function(b) { window.APP_STATE.currentSelectedBrand = b; window.APP_STATE.currentSelectedSpec = "ALL"; if(window.APP_STATE.STATE==='ORDER') window.renderOrder(); else window.renderStockPage(); };
window.selectSpec = function(s) { window.APP_STATE.currentSelectedSpec = s; if(window.APP_STATE.STATE==='ORDER') window.renderOrder(); else window.renderStockPage(); };

// 核心多级路由树状返回机制
window.goBack = function() {
  document.getElementById('editStateBadge').classList.add('hide'); 
  const currentMode = window.APP_STATE.STATE;
  
  if(currentMode === 'STOCK' || currentMode === 'REPORT') {
    window.APP_STATE.orderData = null; window.renderStores(); 
  }
  else if(currentMode === 'DETAIL') {
    const isFromReport = document.getElementById('list').getAttribute('data-from-report') === 'true';
    if(isFromReport) window.openSaleReport(window.APP_STATE.selectedReportDate);
    else window.renderHistory();
  }
  else if(currentMode === 'ORDER') {
    if(window.APP_STATE.orderData?.id) {
      const savedId = window.APP_STATE.orderData.id;
      const savedDate = window.APP_STATE.orderData.date;
      const isFromReport = document.getElementById('list').getAttribute('data-from-report') === 'true';
      window.APP_STATE.orderData = null; 
      window.viewOrderDetail(savedId, savedDate, isFromReport);
    } else {
      window.APP_STATE.orderData = null; window.renderHistory();
    }
  }
  else if(currentMode === 'HISTORY') {
    window.APP_STATE.orderData = null; window.renderStores(); 
  }
  else if(currentMode === 'STORE') {
    window.APP_STATE.orderData = null; window.renderEmployees();
  }
};

// 启动执行
initSystem();
