window.utils = {
  isSpecialSpecOreo(productObj) {
    if (!productObj || !productObj.spec) return false;
    return productObj.spec.includes("3片装");
  },

  formatQtyToUnits(totalPcs, specCase, specBox) {
    let displayCases = Math.floor(totalPcs / specCase);
    let remPcs = totalPcs % specCase;
    if (specBox > 0) {
      let displayBoxes = Math.floor(remPcs / specBox);
      let displayPcs = remPcs % specBox;
      return `${displayCases}件 ${displayBoxes}盒 ${displayPcs}个`;
    } else {
      return `${displayCases}件 ${remPcs}个`;
    }
  },

  getPriceDecimalPlaces(prodId) {
    const idNum = Number(prodId);
    return (idNum >= 49 && idNum <= 55) ? 2 : 1;
  },

  getLiveRowAmounts(productObj, qty, livePrice, giftQty, returnQty, returnHandle) {
    let saleAmount = 0, giftAmount = 0, restoreAmount = 0, scrapAmount = 0;    
    const isOreo = this.isSpecialSpecOreo(productObj);
    const defaultPrice = isOreo ? 17.5 : (productObj.default_price || 15);
    const specBox = isOreo ? (productObj.pcs_per_box || 6) : 0;

    if (isOreo) {
      saleAmount = qty * livePrice;
      const liveSingleBagPrice = livePrice / (specBox || 6);
      const defaultSingleBagPrice = defaultPrice / (specBox || 6);
      giftAmount = giftQty * defaultSingleBagPrice; 
      if (returnHandle === 'SCRAP') scrapAmount = returnQty * liveSingleBagPrice; 
      else restoreAmount = returnQty * liveSingleBagPrice; 
    } else {
      saleAmount = qty * livePrice;
      giftAmount = giftQty * defaultPrice; 
      if (returnHandle === 'SCRAP') scrapAmount = returnQty * livePrice;
      else restoreAmount = returnQty * livePrice;
    }
    return { saleAmount, giftAmount, restoreAmount, scrapAmount };
  },

  parseReturnHandleText(val) {
    if (!val || typeof val !== 'string' || !val.includes('_')) {
      return { qty: 0, handle: 'RESTORE' };
    }
    const parts = val.split('_');
    return { qty: parseInt(parts[0]) || 0, handle: parts[1] || 'RESTORE' };
  },

  // 获取字符串拼音首字母，用于各种排序列
  getFirstLetter(text) {
    if (!text) return '#';
    try {
      const firstChar = text.trim().charAt(0);
      const pinyin = pinyinPro.pinyin(firstChar, { pattern: 'first', toneType: 'none' });
      if (pinyin && pinyin.length > 0) {
        const letter = pinyin.charAt(0).toUpperCase();
        if (/[A-Z]/.test(letter)) return letter;
      }
    } catch (e) { console.error(e); }
    return '#';
  },

  // 渲染规格选择组件公共 HTML
  generateFilterHeaderHtml() {
    const brands = [...new Set(window.APP_STATE.products.map(p => p.brand))];
    if (!window.APP_STATE.currentSelectedBrand && brands.length > 0) window.APP_STATE.currentSelectedBrand = brands[0];
    const availableSpecs = [...new Set(window.APP_STATE.products.filter(p => p.brand === window.APP_STATE.currentSelectedBrand).map(p => p.spec))];
    if (window.APP_STATE.currentSelectedSpec !== "ALL" && !availableSpecs.includes(window.APP_STATE.currentSelectedSpec)) window.APP_STATE.currentSelectedSpec = "ALL";

    return `
      <div class='brand-nav'>
        ${brands.map(b => `<div class="brand-badge ${b === window.APP_STATE.currentSelectedBrand ? 'active' : ''}" onclick="selectBrand('${b}')">${b}</div>`).join('')}
      </div>
      <div class='spec-nav'>
        <div class="spec-badge ${window.APP_STATE.currentSelectedSpec === 'ALL' ? 'active' : ''}" onclick="selectSpec('ALL')">全部规格</div>
        ${availableSpecs.map(sp => `<div class="spec-badge ${window.APP_STATE.currentSelectedSpec === sp ? 'active' : ''}" onclick="selectSpec('${sp}')">${sp}</div>`).join('')}
      </div>
      <div class='brand'>📂 筛选结果：${window.APP_STATE.currentSelectedBrand || '未选择'} ➔ ${window.APP_STATE.currentSelectedSpec === 'ALL' ? '全部规格' : window.APP_STATE.currentSelectedSpec}</div>
    `;
  },

  makePureQtyOptionsHtml(max, current) {
    let html = '';
    for(let i=0; i<=max; i++) html += `<option value="${i}" ${i === current ? 'selected' : ''}>${i}</option>`;
    return html;
  },

  makePurePriceOptionsHtml(centerPrice, stepPlaces, currentSelected) {
    let html = '';
    let start = Math.max(0.1, centerPrice - 15);
    let end = centerPrice + 30;
    let step = stepPlaces === 2 ? 0.05 : 0.1; 
    for (let p = start; p <= end; p += step) {
      let val = +p.toFixed(stepPlaces);
      html += `<option value="${val}" ${Math.abs(val - currentSelected) < 0.005 ? 'selected' : ''}>${val.toFixed(stepPlaces)}</option>`;
    }
    return html;
  }
};
