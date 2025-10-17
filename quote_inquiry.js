let db;

// 1. 페이지 초기화
window.initializePage = function(database) {
    db = database;
    if (!db || Object.keys(db).length === 0) {
        console.error("Database not loaded!");
        return;
    }
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

    const respondedRequests = db.견적요청.filter(req => 
        db.견적결과.some(res => res.견적요청번호 === req.견적요청번호)
    );

    respondedRequests.forEach(req => {
        const productInfo = db.제품품번정보.find(p => p.제품품번코드 === req.제품품번코드);
        const itemDiv = document.createElement('div');
        itemDiv.className = 'request-list-item';
        itemDiv.dataset.requestId = req.견적요청번호;
        itemDiv.innerHTML = `
            <h4>요청번호: ${req.견적요청번호}</h4>
            <p><strong>${productInfo?.제품명 || '제품명 없음'}</strong></p>
            <p><small>Base 품번: ${req.제품품번코드}</small></p>
            <p><small>판매 국가: ${req.판매국가}</small></p>
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

    const quoteResultData = db.견적결과.filter(res => res.견적요청번호 === requestId);

    renderUnitComparison(baseBom, requestedBom);
    renderFinalQuote(quoteResultData);
}

// 4. 상단: 유닛 구성 비교 렌더링
function renderUnitComparison(baseBom, requestedBom) {
    const area = document.getElementById('unit-comparison-area');
    let tableHtml = '<table class="comparison-table"><tr><th>유닛</th><th>Base 제품 부품</th><th>요청 제품 부품</th><th>변경</th></tr>';

    const allUnitCodes = new Set([...Object.keys(baseBom), ...Object.keys(requestedBom)]);
    const sortedUnits = db.유닛.filter(u => allUnitCodes.has(u.유닛코드)).sort((a, b) => parseInt(a.디스플레이순서) - parseInt(b.디스플레이순서));

    sortedUnits.forEach(unitInfo => {
        const unitCode = unitInfo.유닛코드;
        const basePart = baseBom[unitCode];
        const requestedPart = requestedBom[unitCode];
        const isChanged = basePart !== requestedPart;

        tableHtml += `<tr class="${isChanged ? 'changed-row' : ''}">
            <td>${unitInfo.유닛설명}</td>
            <td>${renderPartInfo(basePart)}</td>
            <td>${isChanged ? diffAndHighlightSpecs(basePart, requestedPart) : renderPartInfo(requestedPart)}</td>
            <td>${isChanged ? '✔' : '-'}</td>
        </tr>`;
    });

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
                <div class="spec-text">${specText}</div>
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

// 5. 하단: 최종 견적 결과 렌더링
function renderFinalQuote(quoteResultData) {
    const area = document.getElementById('final-quote-area');
    if (quoteResultData.length === 0) {
        area.innerHTML = '<p class="placeholder">견적 결과 정보가 없습니다.</p>';
        return;
    }

    const dataMap = new Map(quoteResultData.map(item => [item.구분, parseFloat(item.금액)]));

    const directMaterial = dataMap.get('직접재료비') || 0;
    const indirectMaterial = dataMap.get('간접재료비') || 0;
    const outsourced = dataMap.get('외주임가공비') || 0;
    const internal = dataMap.get('본사가공비') || 0;
    const hqCost = dataMap.get('VINA판가') || 0;
    const logistics = dataMap.get('물류비') || 0;
    const finalPrice = dataMap.get('예상판가') || 0;

    const materialSubtotal = directMaterial + indirectMaterial;
    const processingSubtotal = outsourced + internal;
    const manufacturingCost = materialSubtotal + processingSubtotal;
    const cogs = hqCost + logistics;

    area.innerHTML = `
    <div class="quote-document">
        <table class="quote-table">
            <tbody>
                <tr><th>직접재료비</th><td>${directMaterial.toFixed(2)}</td></tr>
                <tr><th>간접재료비</th><td>${indirectMaterial.toFixed(2)}</td></tr>
                <tr class="subtotal-row"><th>재료비 소계</th><td>${materialSubtotal.toFixed(2)}</td></tr>
                <tr><th>외주임가공비</th><td>${outsourced.toFixed(2)}</td></tr>
                <tr><th>본사가공비</th><td>${internal.toFixed(2)}</td></tr>
                <tr class="subtotal-row"><th>가공비 소계</th><td>${processingSubtotal.toFixed(2)}</td></tr>
                <tr class="total-row"><th>제조원가</th><td>${manufacturingCost.toFixed(2)}</td></tr>
                <tr><th>VINA 판가 (본사원가)</th><td>${hqCost.toFixed(2)}</td></tr>
                <tr><th>물류비</th><td>${logistics.toFixed(2)}</td></tr>
                <tr class="subtotal-row"><th>매출원가</th><td>${cogs.toFixed(2)}</td></tr>
                <tr class="total-row"><th>최종 예상 판가</th><td>${finalPrice.toFixed(2)}</td></tr>
            </tbody>
        </table>
    </div>
    `;
}