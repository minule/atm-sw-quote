let db;
let originalBom = {}; // 시뮬레이션 시작 시의 원본 BOM
let currentBom = {};  // 현재 사용자가 선택한 BOM
let simulationStarted = false; // 시뮬레이션 시작 여부 플래그

// Helper to format numbers with commas and 2 decimal places
function formatNumber(num) {
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 페이지 초기화
function initializePage(centralDb) {
    db = centralDb;
    populateInitialDropdowns();
    addEventListeners();
}

// 초기 드롭다운 채우기
function populateInitialDropdowns() {
    const productFamilySelect = document.getElementById('product-family-select');
    const countrySelect = document.getElementById('country-select');
    db.제품군.forEach(item => productFamilySelect.add(new Option(item.제품군코드, item.제품군코드)));
    db.국가.forEach(item => countrySelect.add(new Option(item.국가코드, item.국가코드)));
    populateProductDropdown();
}

// 제품 드롭다운 채우기
function populateProductDropdown() {
    const family = document.getElementById('product-family-select').value;
    const productSelect = document.getElementById('product-select');
    productSelect.innerHTML = '';
    db.제품정보
        .filter(p => p.제품군코드 === family)
        .forEach(p => productSelect.add(new Option(p.제품코드, p.제품코드)));
    populateProductNumberDropdown();
}

// 제품 품번 드롭다운 채우기 (국가 필터링 제거)
function populateProductNumberDropdown() {
    const productCode = document.getElementById('product-select').value;
    const productNumberSelect = document.getElementById('product-number-select');
    productNumberSelect.innerHTML = '';
    db.제품품번정보
        .filter(p => p.제품코드 === productCode)
        .forEach(p => {
            const displayText = `${p.제품품번코드} - ${p.제품명}`;
            productNumberSelect.add(new Option(displayText, p.제품품번코드));
        });
    previewProduct();
}

// 이벤트 리스너 등록
function addEventListeners() {
    document.getElementById('product-family-select').addEventListener('change', populateProductDropdown);
    document.getElementById('product-select').addEventListener('change', populateProductNumberDropdown);
    document.getElementById('product-number-select').addEventListener('change', previewProduct);
    document.getElementById('start-simulation-btn').addEventListener('click', startSimulation);
    
    // 판매 국가 변경 시, 시뮬레이션이 진행중일 때만 견적 업데이트
    document.getElementById('country-select').addEventListener('change', () => {
        if (simulationStarted) updateQuoteValues();
    });

    // 원가 기준 변경 시, 시뮬레이션이 진행중일 때만 견적 업데이트
    document.querySelectorAll('input[name="cost-basis"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (simulationStarted) updateQuoteValues();
        });
    });
}

// 제품 이미지 등 미리보기
function previewProduct() {
    const productNumber = document.getElementById('product-number-select').value;
    const summaryArea = document.getElementById('quote-summary-area');
    if (!productNumber) {
        summaryArea.innerHTML = '<p class="placeholder">여기에 견적 결과가 표시됩니다.</p>';
        return;
    }
    const selectedProduct = db.제품품번정보.find(p => p.제품품번코드 === productNumber);
    summaryArea.innerHTML = `
    <div class="quote-document">
        <h3>견적서</h3>
        <div class="base-product-image-container">
            <img class="base-product-image" src="product-images/${selectedProduct.제품품번코드}.png" 
                 onerror="this.onerror=null; this.src='product-images/${selectedProduct.제품품번코드}.jpg'; this.onerror=() => { this.style.display='none' };">
        </div>
        <div class="base-product-info">
            <strong>Base 제품:</strong> ${selectedProduct.제품명} (${selectedProduct.제품품번코드})
        </div>
        <p class="placeholder">'시뮬레이션 시작' 버튼을 누르면<br>상세 견적이 표시됩니다.</p>
    </div>`;
}

// 시뮬레이션 시작
function startSimulation() {
    const productNumber = document.getElementById('product-number-select').value;
    if (!productNumber) {
        alert("시뮬레이션할 제품 품번을 선택해주세요.");
        return;
    }
    simulationStarted = true;
    originalBom = {};
    db.제품BOM정보
        .filter(bom => bom.제품품번코드 === productNumber)
        .forEach(bom => originalBom[bom.유닛코드] = bom.유닛품번코드);
    currentBom = { ...originalBom };

    renderSpecConfigArea();
    renderQuoteStructure(); // 견적서 구조를 한 번만 렌더링
    updateQuoteValues();    // 값만 계산하여 업데이트
}

// 사양 구성 영역 렌더링
function renderSpecConfigArea() {
    const specArea = document.getElementById('spec-config-area');
    specArea.innerHTML = '';
    const unitsByGroup = {};
    for (const unitCode in originalBom) {
        const unitInfo = db.유닛.find(u => u.유닛코드 === unitCode);
        if (unitInfo) {
            if (!unitsByGroup[unitInfo.유닛그룹코드]) unitsByGroup[unitInfo.유닛그룹코드] = [];
            unitsByGroup[unitInfo.유닛그룹코드].push(unitInfo);
        }
    }

    for (const groupCode in unitsByGroup) {
        const groupInfo = db.유닛그룹.find(g => g.유닛그룹코드 === groupCode);
        const groupDiv = document.createElement('div');
        groupDiv.className = 'unit-group';
        const groupTitle = document.createElement('div');
        groupTitle.className = 'unit-group-title';
        groupTitle.textContent = groupInfo ? groupInfo.유닛그룹설명 : groupCode;
        groupTitle.addEventListener('click', (e) => e.currentTarget.parentElement.classList.toggle('collapsed'));
        groupDiv.appendChild(groupTitle);
        const unitContainer = document.createElement('div');
        unitContainer.className = 'unit-container';
        unitsByGroup[groupCode].forEach(unitInfo => {
            const unitCode = unitInfo.유닛코드;
            const unitDiv = document.createElement('div');
            unitDiv.className = 'unit-item';
            unitDiv.innerHTML = `<div class="unit-title">${unitInfo.유닛설명} (${unitCode})</div>`;
            const selectionList = document.createElement('div');
            selectionList.className = 'part-selection-list';
            selectionList.id = `part-list-${unitCode}`;
            const alternativeParts = db.유닛품번리스트.filter(p => p.유닛코드 === unitCode && db.unitFullSpecText[p.유닛품번코드]);
            alternativeParts.forEach(part => {
                const partCode = part.유닛품번코드;
                const specText = db.unitFullSpecText[partCode];
                const isDefault = originalBom[unitCode] === partCode;
                const isSelected = currentBom[unitCode] === partCode;
                const label = document.createElement('label');
                label.className = 'part-radio-label';
                if(isDefault) label.classList.add('is-default');
                if(isSelected) label.classList.add('selected');
                label.innerHTML = `
                    <div class="part-image-container">
                        <input type="radio" name="${unitCode}" value="${partCode}" ${isSelected ? 'checked' : ''}>
                        <img class="part-image" src="product-images/${partCode}.png" 
                             onerror="this.onerror=null; this.src='product-images/${partCode}.jpg'; this.onerror=() => { this.style.display='none' };">
                        <div>
                            <div class="part-spec-text">${specText}</div>
                            <div class="part-code-text">품번: ${partCode} ${isDefault ? '(기본)' : ''}</div>
                        </div>
                    </div>
                `;
                selectionList.appendChild(label);
            });
            unitDiv.appendChild(selectionList);
            unitContainer.appendChild(unitDiv);
        });
        groupDiv.appendChild(unitContainer);
        specArea.appendChild(groupDiv);
    }
    specArea.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', handlePartSelection);
    });
}

// 부품 선택 핸들러
function handlePartSelection(event) {
    const unitCode = event.target.name;
    const newPartCode = event.target.value;
    currentBom[unitCode] = newPartCode;
    const listContainer = document.getElementById(`part-list-${unitCode}`);
    listContainer.querySelectorAll('.part-radio-label').forEach(label => {
        label.classList.remove('selected');
    });
    event.target.closest('.part-radio-label').classList.add('selected');
    updateQuoteValues();
}

// 견적서 구조 렌더링 (최초 1회)
function renderQuoteStructure() {
    const summaryArea = document.getElementById('quote-summary-area');
    summaryArea.innerHTML = `
    <div class="quote-document">
        <h3>견적서</h3>
        <div id="quote-base-product-info"></div>
        <div id="quote-changes"></div>
        <table class="quote-table">
            <tr><th colspan="2">비용 상세 내역</th></tr>
            <tr class="category-row"><td colspan="2">제조원가</td></tr>
            <tr class="item-row"><td>직접재료비</td><td id="val-direct-material">0.00</td></tr>
            <tr class="item-row"><td>간접재료비</td><td id="val-indirect-material">0.00</td></tr>
            <tr class="subtotal-row"><td>재료비 소계</td><td id="val-total-material">0.00</td></tr>
            <tr class="item-row"><td>외주임가공비</td><td id="val-outsourced-processing">0.00</td></tr>
            <tr class="item-row"><td>본사가공비</td><td id="val-internal-processing">0.00</td></tr>
            <tr class="subtotal-row"><td>가공비 소계</td><td id="val-total-processing">0.00</td></tr>
            <tr class="total-row"><td>제조원가</td><td id="val-manufacturing">0.00</td></tr>
            <tr class="category-row"><td colspan="2">판매가</td></tr>
            <tr class="item-row"><td>VINA 판가 (본사원가)</td><td id="val-hq-cost">0.00</td></tr>
            <tr class="item-row"><td>물류비</td><td id="val-logistics">0.00</td></tr>
            <tr class="subtotal-row"><td>매출원가</td><td id="val-cogs">0.00</td></tr>
            <tr class="total-row"><td>최종 예상 판가</td><td id="val-final-price">0.00</td></tr>
        </table>
        <div class="meta-info" id="quote-meta-info"></div>
    </div>`;
    
    // Base 제품 정보 렌더링
    const selectedProduct = db.제품품번정보.find(p => p.제품품번코드 === document.getElementById('product-number-select').value);
    document.getElementById('quote-base-product-info').innerHTML = `
        <div class="base-product-image-container">
            <img class="base-product-image" src="product-images/${selectedProduct.제품품번코드}.png" 
                 onerror="this.onerror=null; this.src='product-images/${selectedProduct.제품품번코드}.jpg'; this.onerror=() => { this.style.display='none' };">
        </div>
        <div class="base-product-info">
            <strong>Base 제품:</strong> ${selectedProduct.제품명} (${selectedProduct.제품품번코드})
        </div>`;
}

// 견적 값 업데이트 (계산 및 DOM 업데이트)
function updateQuoteValues() {
    if (!simulationStarted || Object.keys(currentBom).length === 0) return;

    // --- 계산 로직 ---
    const costBasis = document.querySelector('input[name="cost-basis"]:checked').value;
    const countryCode = document.getElementById('country-select').value;
    const outsourcedUnitCost = parseFloat(db.가공비단가.find(c => c.구분 === '외주임가공비').단가) || 0;
    const internalUnitCost = parseFloat(db.가공비단가.find(c => c.구분 === '본사가공비').단가) || 0;
    const vinaMargin = parseFloat(db.마진율.find(m => m.구분 === 'VINA판가').마진율) / 100 || 0;
    const profitMargin = parseFloat(db.마진율.find(m => m.구분 === '매출이익율').마진율) / 100 || 0;
    const logisticsCost = parseFloat(db.물류비.find(l => l.국가코드 === countryCode)?.단가) || 0;

    let totalDirectMaterialCost = 0, totalIndirectMaterialCost = 0, totalOutsourcedProcessingCost = 0, totalInternalProcessingCost = 0;

    for (const unitCode in currentBom) {
        const partCode = currentBom[unitCode];
        let costs = (costBasis === 'standard') 
            ? db.유닛품번정상원가.find(c => c.유닛품번코드 === partCode)
            : db.avgActualCosts[partCode];
        if (costs) {
            totalDirectMaterialCost += (parseFloat(costs.직접재료비) || 0);
            totalIndirectMaterialCost += (parseFloat(costs.간접재료비) || 0);
            totalOutsourcedProcessingCost += ((parseFloat(costs.외주임가공공수) || 0) * outsourcedUnitCost);
            totalInternalProcessingCost += ((parseFloat(costs.본사가공공수) || 0) * internalUnitCost);
        }
    }

    const totalMaterialCost = totalDirectMaterialCost + totalIndirectMaterialCost;
    const totalProcessingCost = totalOutsourcedProcessingCost + totalInternalProcessingCost;
    const manufacturingCost = totalMaterialCost + totalProcessingCost;
    const hqCost = manufacturingCost * (1 + vinaMargin);
    const cogs = hqCost + logisticsCost;
    const finalPrice = cogs * (1 + profitMargin);

    // --- DOM 업데이트 ---
    let changesHtml = '<div class="quote-section-title">구성 변경 내역</div><ul class="change-list">';
    let hasChanges = false;
    for (const unitCode in originalBom) {
        if (originalBom[unitCode] !== currentBom[unitCode]) {
            hasChanges = true;
            const unitName = db.유닛.find(u => u.유닛코드 === unitCode)?.유닛설명 || unitCode;
            changesHtml += `<li>${unitName}: ${originalBom[unitCode]} → <strong>${currentBom[unitCode]}</strong></li>`;
        }
    }
    if (!hasChanges) changesHtml += '<li>변경 없음</li>';
    changesHtml += '</ul>';
    document.getElementById('quote-changes').innerHTML = changesHtml;

    document.getElementById('val-direct-material').textContent = formatNumber(totalDirectMaterialCost);
    document.getElementById('val-indirect-material').textContent = formatNumber(totalIndirectMaterialCost);
    document.getElementById('val-total-material').textContent = formatNumber(totalMaterialCost);
    document.getElementById('val-outsourced-processing').textContent = formatNumber(totalOutsourcedProcessingCost);
    document.getElementById('val-internal-processing').textContent = formatNumber(totalInternalProcessingCost);
    document.getElementById('val-total-processing').textContent = formatNumber(totalProcessingCost);
    document.getElementById('val-manufacturing').textContent = formatNumber(manufacturingCost);
    document.getElementById('val-hq-cost').textContent = formatNumber(hqCost);
    document.getElementById('val-logistics').textContent = formatNumber(logisticsCost);
    document.getElementById('val-cogs').textContent = formatNumber(cogs);
    document.getElementById('val-final-price').textContent = formatNumber(finalPrice);

    document.getElementById('quote-meta-info').innerHTML = `
        원가기준: ${costBasis === 'standard' ? '정상원가' : '실적원가'} / 
        VINA마진: ${vinaMargin * 100}% / 
        매출이익율: ${(profitMargin * 100).toFixed(2)}%
    `;
}