let db;

// Helper to format numbers with commas and 2 decimal places
function formatNumber(num) {
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 1. 페이지 초기화
window.initializePage = function(db_from_parent) {
    db = db_from_parent;
    renderRequestList();
};

// 2. 좌측: 견적 요청 목록 렌더링
function renderRequestList() {
    const listDiv = document.getElementById('request-list');
    listDiv.innerHTML = '';

    if (!db.견적요청 || db.견적요청.length === 0) {
        listDiv.innerHTML = '<p class="placeholder">표시할 견적 요청이 없습니다.</p>';
        return;
    }

    db.견적요청.forEach(req => {
        const productInfo = db.제품품번정보.find(p => p.제품품번코드 === req.제품품번코드);
        const itemDiv = document.createElement('div');
        itemDiv.className = 'request-list-item';
        itemDiv.dataset.requestId = req.견적요청번호;
        itemDiv.innerHTML = `
            <h4>요청번호: ${req.견적요청번호}</h4>
            <div class="part-info">
                <img class="part-image" src="product-images/${req.제품품번코드}.png" 
                     onerror="this.onerror=null; this.src='product-images/${req.제품품번코드}.jpg'; this.onerror=() => { this.style.display='none' };">
                <div>
                    <p><strong>${productInfo?.제품명 || '제품명 없음'}</strong></p>
                    <p><small>Base: ${req.제품품번코드}</small></p>
                    <p><small>국가: ${req.판매국가}</small></p>
                </div>
            </div>
        `;
        itemDiv.addEventListener('click', () => handleRequestSelection(req.견적요청번호));
        listDiv.appendChild(itemDiv);
    });
}

// 3. 요청 선택 핸들러
function handleRequestSelection(requestId) {
    document.querySelectorAll('.request-list-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.requestId === requestId);
    });

    const request = db.견적요청.find(r => r.견적요청번호 === requestId);
    if (!request) return;

    const baseBom = {};
    db.제품BOM정보
        .filter(bom => bom.제품품번코드 === request.제품품번코드)
        .forEach(bom => baseBom[bom.유닛코드] = bom.유닛품번코드);

    const requestedBom = { ...baseBom };
    const requestDetails = db.견적요청상세.filter(d => d.견적요청번호 === requestId);
    requestDetails.forEach(detail => {
        if (requestedBom.hasOwnProperty(detail.유닛코드)) {
            requestedBom[detail.유닛코드] = detail.변경유닛부품번호;
        }
    });

    renderUnitComparison(baseBom, requestedBom);
    renderQuoteComparison(baseBom, requestedBom, request.판매국가);
}

// 4. 중앙: 유닛 구성 비교 렌더링
function renderUnitComparison(baseBom, requestedBom) {
    const area = document.getElementById('unit-comparison-area');
    let tableHtml = '<table class="comparison-table"><tr><th>유닛그룹</th><th>유닛</th><th>Base 제품 부품</th><th>요청 제품 부품</th><th>변경</th></tr>';

    const allUnitCodes = new Set([...Object.keys(baseBom), ...Object.keys(requestedBom)]);
    const unitsByGroup = {};
    allUnitCodes.forEach(unitCode => {
        const unitInfo = db.유닛.find(u => u.유닛코드 === unitCode);
        if (unitInfo) {
            if (!unitsByGroup[unitInfo.유닛그룹코드]) unitsByGroup[unitInfo.유닛그룹코드] = [];
            unitsByGroup[unitInfo.유닛그룹코드].push(unitCode);
        }
    });

    for (const groupCode in unitsByGroup) {
        const groupInfo = db.유닛그룹.find(g => g.유닛그룹코드 === groupCode);
        unitsByGroup[groupCode].sort((a, b) => {
            const unitA = db.유닛.find(u => u.유닛코드 === a);
            const unitB = db.유닛.find(u => u.유닛코드 === b);
            return (parseInt(unitA?.디스플레이순서) || 0) - (parseInt(unitB?.디스플레이순서) || 0);
        });

        unitsByGroup[groupCode].forEach(unitCode => {
            const unitInfo = db.유닛.find(u => u.유닛코드 === unitCode);
            const basePart = baseBom[unitCode];
            const requestedPart = requestedBom[unitCode];
            const isChanged = basePart !== requestedPart;

            tableHtml += `<tr class="${isChanged ? 'changed-row' : ''}">
                <td>${groupInfo?.유닛그룹설명 || groupCode}</td>
                <td>${unitInfo?.유닛설명 || unitCode}</td>
                <td>${renderPartInfo(basePart)}</td>
                <td>${isChanged ? diffAndHighlightSpecs(basePart, requestedPart) : renderPartInfo(requestedPart)}</td>
                <td>${isChanged ? '<strong>✔</strong>' : '-'}</td>
            </tr>`;
        });
    }

    tableHtml += '</table>';
    area.innerHTML = tableHtml;
}

function renderPartInfo(partCode, highlightedSpecHtml = null) {
    if (!partCode) return '-';
    const specText = highlightedSpecHtml || db.unitFullSpecText[partCode] || '스펙 정보 없음';
    return `
        <div class="part-info">
            <img class="part-image" src="product-images/${partCode}.png" 
                 onerror="this.onerror=null; this.src='product-images/${partCode}.jpg'; this.onerror=() => { this.style.display='none' };">
            <div>
                <strong>${partCode}</strong>
                <div style="font-size:0.8em; color:#6c757d;">${specText}</div>
            </div>
        </div>
    `;
}

// 스펙 텍스트를 비교하고 다른 부분을 하이라이트하는 함수
function diffAndHighlightSpecs(basePartCode, requestedPartCode) {
    const baseSpecText = db.unitFullSpecText[basePartCode] || '';
    const requestedSpecText = db.unitFullSpecText[requestedPartCode] || '';

    const baseSpecs = Object.fromEntries(baseSpecText.split(' / ').map(s => s.split(':')));
    const requestedSpecs = Object.fromEntries(requestedSpecText.split(' / ').map(s => s.split(':')));

    const highlightedParts = [];
    for (const key in requestedSpecs) {
        if (baseSpecs[key] !== requestedSpecs[key]) {
            highlightedParts.push(`<strong>${key}:${requestedSpecs[key]}</strong>`);
        } else {
            highlightedParts.push(`${key}:${requestedSpecs[key]}`);
        }
    }
    return renderPartInfo(requestedPartCode, highlightedParts.join(' / '));
}


// 5. 우측: 견적 비교 렌더링
function renderQuoteComparison(baseBom, requestedBom, salesCountry) {
    const area = document.getElementById('quote-comparison-area');
    
    const baseQuote = calculateQuote(baseBom, salesCountry);
    const requestedQuote = calculateQuote(requestedBom, salesCountry);

    const diff = requestedQuote.finalPrice - baseQuote.finalPrice;

    area.innerHTML = `
        <div class="quote-wrapper">
            ${renderQuoteTable('Base 제품 견적', baseQuote)}
        </div>
        <div class="quote-wrapper">
            ${renderQuoteTable('요청 제품 견적', requestedQuote)}
        </div>
        <div class="quote-diff">
            견적 차액: <span style="color:${diff >= 0 ? 'blue' : 'red'}">${formatNumber(diff)}</span>
            <button id="send-quote-btn">견적 회신</button>
        </div>
    `;

    document.getElementById('send-quote-btn').addEventListener('click', () => {
        alert('견적 회신 기능은 아직 구현되지 않았습니다.');
    });
}

function renderQuoteTable(title, quoteData) {
    return `
    <div class="quote-document">
        <h3>${title}</h3>
        <table class="quote-table">
            <tr><th colspan="2">비용 상세 내역</th></tr>
            <tr class="category-row"><td colspan="2">제조원가</td></tr>
            <tr class="item-row"><td>직접재료비</td><td>${formatNumber(quoteData.totalDirectMaterialCost)}</td></tr>
            <tr class="item-row"><td>간접재료비</td><td>${formatNumber(quoteData.totalIndirectMaterialCost)}</td></tr>
            <tr class="subtotal-row"><td>재료비 소계</td><td>${formatNumber(quoteData.totalMaterialCost)}</td></tr>
            <tr class="item-row"><td>외주임가공비</td><td>${formatNumber(quoteData.totalOutsourcedProcessingCost)}</td></tr>
            <tr class="item-row"><td>본사가공비</td><td>${formatNumber(quoteData.totalInternalProcessingCost)}</td></tr>
            <tr class="subtotal-row"><td>가공비 소계</td><td>${formatNumber(quoteData.totalProcessingCost)}</td></tr>
            <tr class="total-row"><td>제조원가</td><td>${formatNumber(quoteData.manufacturingCost)}</td></tr>
            <tr class="category-row"><td colspan="2">판매가</td></tr>
            <tr class="item-row"><td>VINA 판가 (본사원가)</td><td>${formatNumber(quoteData.hqCost)}</td></tr>
            <tr class="item-row"><td>물류비</td><td>${formatNumber(quoteData.logisticsCost)}</td></tr>
            <tr class="subtotal-row"><td>매출원가</td><td>${formatNumber(quoteData.cogs)}</td></tr>
            <tr class="total-row"><td>최종 예상 판가</td><td>${formatNumber(quoteData.finalPrice)}</td></tr>
        </table>
        <div class="meta-info">
            VINA마진: ${quoteData.vinaMargin * 100}% / 
            매출이익율: ${(quoteData.profitMargin * 100).toFixed(2)}%
        </div>
    </div>`;
}

// 6. 공통: 견적 계산 로직
function calculateQuote(bom, salesCountry) {
    const costBasis = 'standard'; // 견적 회신은 정상원가 기준
    const outsourcedUnitCost = parseFloat(db.가공비단가.find(c => c.구분 === '외주임가공비').단가) || 0;
    const internalUnitCost = parseFloat(db.가공비단가.find(c => c.구분 === '본사가공비').단가) || 0;
    const vinaMargin = parseFloat(db.마진율.find(m => m.구분 === 'VINA판가').마진율) / 100 || 0;
    const profitMargin = parseFloat(db.마진율.find(m => m.구분 === '매출이익율').마진율) / 100 || 0;
    const logisticsCost = parseFloat(db.물류비.find(l => l.국가코드 === salesCountry)?.단가) || 0;

    let totalDirectMaterialCost = 0, totalIndirectMaterialCost = 0, totalOutsourcedProcessingCost = 0, totalInternalProcessingCost = 0;

    for (const unitCode in bom) {
        const partCode = bom[unitCode];
        let costs = db.유닛품번정상원가.find(c => c.유닛품번코드 === partCode);
        if (costs) {
            totalDirectMaterialCost += (parseFloat(costs.직접재료비) || 0);
            totalIndirectMaterialCost += (parseFloat(costs.간접재료비) || 0);
            const internalHoursValue = costs.본사가공비공수 || costs.본사가공공수; // 데이터 불일치 핸들링
            totalOutsourcedProcessingCost += ((parseFloat(costs.외주임가공공수) || 0) * outsourcedUnitCost);
            totalInternalProcessingCost += ((parseFloat(internalHoursValue) || 0) * internalUnitCost);
        }
    }

    const totalMaterialCost = totalDirectMaterialCost + totalIndirectMaterialCost;
    const totalProcessingCost = totalOutsourcedProcessingCost + totalInternalProcessingCost;
    const manufacturingCost = totalMaterialCost + totalProcessingCost;
    const hqCost = manufacturingCost * (1 + vinaMargin);
    const cogs = hqCost + logisticsCost;
    const finalPrice = cogs * (1 + profitMargin);

    return { totalDirectMaterialCost, totalIndirectMaterialCost, totalMaterialCost, totalOutsourcedProcessingCost, totalInternalProcessingCost, totalProcessingCost, manufacturingCost, hqCost, logisticsCost, cogs, finalPrice, vinaMargin, profitMargin };
}