// 전역 db 객체와 데이터. 부모 창(main.html)에서 데이터를 채워줍니다.
let db = {};

// 부모 창에서 호출할 초기화 함수
window.initializePage = function(db_from_parent) {
    db = db_from_parent;
    console.log("spec_search.js 초기화됨:", db);

    // jQuery가 준비되면 UI 렌더링 및 초기 계산 시작
    $(document).ready(function() {
        initializeUI();
        initializeEventHandlers();
    });
};



// =================================================================
// UI 렌더링 함수
// =================================================================
function initializeUI() {
    $('#spec-selector-section .content-wrapper h2').append('<button class="toggle-all-button">전체 접기</button>');
    $('#search-results-section .content-wrapper h2').append('<button class="toggle-all-button">전체 접기</button>');
    $('#optimal-combination-section .content-wrapper h2').append('<button class="toggle-all-button">전체 접기</button>');

    const filtersDiv = $('#spec-filters');
    const optionsDiv = $('#spec-options');
    filtersDiv.empty();
    optionsDiv.empty();

    let familySelect = '<label for="product-family-select">제품군: </label><select id="product-family-select"><option value="">전체</option>';
    db.제품군.forEach(f => { familySelect += `<option value="${f.제품군코드}">${f.제품군코드}</option>`; });
    familySelect += '</select>';
    filtersDiv.append(familySelect);

    let modelSelect = '<label for="product-model-select">모델: </label><select id="product-model-select"><option value="">전체</option>';
    db.제품정보.forEach(m => { modelSelect += `<option value="${m.제품코드}">${m.제품코드}</option>`; });
    modelSelect += '</select>';
    filtersDiv.append(modelSelect);

    db.유닛.sort((a, b) => parseInt(a.디스플레이순서) - parseInt(b.디스플레이순서)).forEach(unit => {
        const unitCode = unit.유닛코드;
        const unitDescription = unit.유닛설명; // 수정된 부분

        const wrapper = $('<div class="unit-table-wrapper"></div>');
        const table = $(`<table class="spec-table"><caption><span class="caption-text">${unitDescription} (${unitCode})</span><span class="toggle-icon">-</span></caption></table>`);
        const tableBody = $('<tbody></tbody>');

        const specItemsForUnit = db['유닛 스펙항목 리스트']
            .filter(item => item.유닛코드 === unitCode)
            .sort((a, b) => parseInt(a.디스플레이순서) - parseInt(b.디스플레이순서));

        specItemsForUnit.forEach(unitSpecItem => {
            const specItem = db.스펙항목.find(item => item.스펙항목코드 === unitSpecItem.스펙항목코드);
            if (!specItem) return;

            const row = $('<tr></tr>');
            const nameCell = $(`<td>${specItem.스펙항목명}</td>`);
            
            const selectEl = $(`<select id="spec-${unitCode}-${specItem.스펙항목코드}" data-unit="${unitCode}" data-spec-item="${specItem.스펙항목코드}"></select>`);
            const optionsForSpecItem = db.스펙.filter(opt => opt.스펙항목코드 === specItem.스펙항목코드);
            optionsForSpecItem.forEach(option => {
                selectEl.append($(`<option value="${option.스펙코드}">${option.스펙명}</option>`));
            });

            const valueCell = $('<td></td>').append(selectEl);
            row.append(nameCell).append(valueCell);
            tableBody.append(row);
        });

        table.append(tableBody);
        wrapper.append(table);
        optionsDiv.append(wrapper);
    });
    console.log("UI 초기화 완료.");
}

function getMatchRateColor(rate) {
    if (rate >= 99.9) return '#28a745';
    if (rate > 70) return '#17a2b8';
    if (rate > 40) return '#ffc107';
    return '#dc3545';
}

function renderSearchResults(results) {
    const resultsDiv = $('#search-results');
    resultsDiv.empty();
    if (results.length === 0) {
        resultsDiv.html('<div class="placeholder">일치하는 제품이 없습니다.</div>');
        return;
    }
    results.forEach(res => {
        res.units.sort((a, b) => {
            const unitA = db.유닛.find(u => u.유닛코드 === a.unitCode); const unitB = db.유닛.find(u => u.유닛코드 === b.unitCode);
            return (parseInt(unitA?.디스플레이순서) || 0) - (parseInt(unitB?.디스플레이순서) || 0);
        });
        const rateColor = getMatchRateColor(res.matchRate);
        let productInfoHtml = '<ul class="product-info-list">';
        productInfoHtml += `<li><strong>제품명:</strong> ${res.product.제품명}</li>`;
        productInfoHtml += `<li><strong>제품품번:</strong> ${res.product.제품품번코드}</li>`;
        productInfoHtml += `<li><strong>국가:</strong> ${res.product.국가코드}</li>`;
        productInfoHtml += `<li><strong>고객:</strong> ${res.product.고객코드}</li>`;
        productInfoHtml += `<li><strong>일치율:</strong> <span class="match-rate" style="color: ${rateColor}">${res.matchRate.toFixed(2)}%</span></li>`;
        productInfoHtml += '</ul>';
        let unitsHtml = '<div class="units-container">';
        res.units.forEach(unit => {
            const icon = unit.isMatch ? 'O' : 'X';
            unit.specs.sort((a,b) => {
                const itemA = db['유닛 스펙항목 리스트'].find(item => item.유닛코드 === unit.unitCode && item.스펙항목코드 === a.specItemCode);
                const itemB = db['유닛 스펙항목 리스트'].find(item => item.유닛코드 === unit.unitCode && item.스펙항목코드 === b.specItemCode);
                return (parseInt(itemA?.디스플레이순서) || 0) - (parseInt(itemB?.디스플레이순서) || 0);
            });
            let specDetailsHtml = '<ul class="spec-details-list">';
            unit.specs.forEach(spec => {
                specDetailsHtml += `<li class="${spec.isMatch ? 'spec-match' : 'spec-mismatch'}"><strong>${spec.specItemName}:</strong> <span>${spec.specName}</span></li>`;
            });
            specDetailsHtml += '</ul>';
            const title = `${icon} ${unit.unitCode} <small>(${unit.partNumber})</small>`;
            unitsHtml += `<div class="unit-card ${unit.isMatch ? 'unit-match' : 'unit-mismatch'}"><h4><span class="caption-text">${title}</span><span class="toggle-icon">-</span></h4>${specDetailsHtml}</div>`;
        });
        unitsHtml += '</div>';
        resultsDiv.append(`<div class="result-item">${productInfoHtml}${unitsHtml}</div>`);
    });
}

function renderOptimalCombination(results, targetHashes, partPool, targetSpecs) {
    const optimalDiv = $('#optimal-combination');
    optimalDiv.empty();
    if (results.length === 0) {
        optimalDiv.html('<div class="placeholder">검색 결과가 없습니다.</div>');
        return;
    }
    const topResult = results[0];
    const optimalParts = {}, swappedUnits = [];
    db.유닛.forEach(unit => {
        const unitType = unit.유닛코드;
        const unitInTopResult = topResult.units.find(u => u.unitCode === unitType);
        if (unitInTopResult && unitInTopResult.isMatch) {
            optimalParts[unitType] = unitInTopResult.partNumber;
        } else {
            let foundPart = null;
            for (const partNumber of partPool) {
                const partInfo = db.유닛품번리스트.find(p => p.유닛품번코드 === partNumber);
                if (partInfo && partInfo.유닛코드 === unitType && db.unitSpecHashes[partNumber] === targetHashes[unitType]) {
                    foundPart = partNumber;
                    break;
                }
            }
            optimalParts[unitType] = foundPart;
            if (unitInTopResult) {
                swappedUnits.push({ unitCode: unitType, originalPart: unitInTopResult.partNumber, newPart: foundPart });
            }
        }
    });

    const hasAnyMatchingUnit = Object.values(optimalParts).some(part => part !== null);
    if (!hasAnyMatchingUnit) {
        optimalDiv.html('<div class="placeholder">요구 스펙에 맞는 유닛을 찾을 수 없습니다.</div>');
        return;
    }

    let summaryHtml = `<div class="summary-box"><p><strong>Base Product:</strong> ${topResult.product.제품품번코드}</p>`;
    if (swappedUnits.length > 0) {
        summaryHtml += '<p><strong>교체 내역:</strong></p><ul>';
        swappedUnits.forEach(swap => {
            summaryHtml += `<li>${swap.unitCode}: ${swap.originalPart} → ${swap.newPart || '대체 부품 없음'}</li>`;
        });
        summaryHtml += '</ul>';
    }
    summaryHtml += '</div>';

    let optimalHtml = '<div class="units-container">';
    db.유닛.sort((a,b) => parseInt(a.디스플레이순서) - parseInt(b.디스플레이순서)).forEach(unit => {
        const unitType = unit.유닛코드;
        const partNumber = optimalParts[unitType];
        const icon = partNumber ? '✔' : '❓';
        const title = partNumber ? `${unit.유닛설명} (${unitType}) <small>(${partNumber})</small>` : `${unit.유닛설명} (${unitType}) <small>(대체 부품 없음)</small>`; // 수정된 부분
        const cardClass = partNumber ? 'unit-match' : 'unit-mismatch';
        let specDetailsHtml = '<ul class="spec-details-list">';
        if (partNumber) {
            const partSpecs = db.유닛품번스펙정보.filter(s => s.유닛품번코드 === partNumber).map(s => {
                const specItem = db.스펙항목.find(si => si.스펙항목코드 === s.스펙항목코드);
                const spec = db.스펙.find(sp => sp.스펙코드 === s.스펙코드);
                return { specItemName: specItem?.스펙항목명, specName: spec?.스펙명, specItemCode: s.스펙항목코드 };
            });
            partSpecs.sort((a, b) => {
                const itemA = db['유닛 스펙항목 리스트'].find(item => item.유닛코드 === unitType && item.스펙항목코드 === a.specItemCode);
                const itemB = db['유닛 스펙항목 리스트'].find(item => item.유닛코드 === unitType && item.스펙항목코드 === b.specItemCode);
                return (parseInt(itemA?.디스플레이순서) || 0) - (parseInt(itemB?.디스플레이순서) || 0);
            });
            partSpecs.forEach(spec => { specDetailsHtml += `<li class="spec-match"><strong>${spec.specItemName}:</strong> <span>${spec.specName}</span></li>`; });
        } else {
            const targetUnitSpecs = targetSpecs[unitType] || {};
            Object.keys(targetUnitSpecs).forEach(specItemCode => {
                const specCode = targetUnitSpecs[specItemCode];
                const specItem = db.스펙항목.find(si => si.스펙항목코드 === specItemCode);
                const spec = db.스펙.find(sp => sp.스펙코드 === specCode);
                specDetailsHtml += `<li class="spec-mismatch"><strong>${specItem?.스펙항목명}:</strong> <span>${spec?.스펙명}</span></li>`;
            });
        }
        specDetailsHtml += '</ul>';
        optimalHtml += `<div class="unit-card ${cardClass}"><h4><span class="caption-text">${icon} ${title}</span><span class="toggle-icon">-</span></h4>${specDetailsHtml}</div>`;
    });
    optimalHtml += '</div>';
    optimalDiv.html(summaryHtml + optimalHtml);

    const isPerfectMatch = Object.values(optimalParts).every(part => part !== null);
    if (isPerfectMatch) {
        const tempProductButton = $('<button id="temp-product-button">견적 요청</button>');
        optimalDiv.append(tempProductButton);
    }
}

// =================================================================
// 이벤트 핸들러
// =================================================================
function initializeEventHandlers() {
    $('#search-button').off('click').on('click', function() {
        const targetSpecs = {}, targetHashes = {}, selectedSpecsByUnit = {};
        $('#spec-options select').each(function() {
            const unit = $(this).data('unit'), specItemCode = $(this).data('spec-item'), specCode = $(this).val();
            if (!selectedSpecsByUnit[unit]) {
                selectedSpecsByUnit[unit] = [];
                targetSpecs[unit] = {};
            }
            selectedSpecsByUnit[unit].push(specCode);
            targetSpecs[unit][specItemCode] = specCode;
        });
        for (const unit in selectedSpecsByUnit) {
            targetHashes[unit] = selectedSpecsByUnit[unit].sort().join('-');
        }

        const selectedFamily = $('#product-family-select').val();
        const selectedModel = $('#product-model-select').val();
        let filteredProducts = db.제품품번정보;
        if (selectedFamily) {
            const modelsInFamily = db.제품정보.filter(m => m.제품군코드 === selectedFamily).map(m => m.제품코드);
            filteredProducts = filteredProducts.filter(p => modelsInFamily.includes(p.제품코드));
        }
        if (selectedModel) {
            filteredProducts = filteredProducts.filter(p => p.제품코드 === selectedModel);
        }

        const results = [];
        filteredProducts.forEach(product => {
            const bom = db.제품BOM정보.filter(b => b.제품품번코드 === product.제품품번코드);
            if (bom.length === 0) return;
            const unitDetails = [];
            let matchCount = 0;
            bom.forEach(bomItem => {
                const unitPartNumber = bomItem.유닛품번코드;
                const unitInfo = db.유닛품번리스트.find(p => p.유닛품번코드 === unitPartNumber);
                if (!unitInfo) return;
                const unitType = unitInfo.유닛코드;
                const partHash = db.unitSpecHashes[unitPartNumber];
                const targetHash = targetHashes[unitType];
                const isUnitMatch = (partHash && targetHash && partHash === targetHash);
                if (isUnitMatch) matchCount++;
                const partSpecs = db.유닛품번스펙정보.filter(s => s.유닛품번코드 === unitPartNumber).map(s => {
                    const specItem = db.스펙항목.find(si => si.스펙항목코드 === s.스펙항목코드);
                    const spec = db.스펙.find(sp => sp.스펙코드 === s.스펙코드);
                    const targetSpecCode = targetSpecs[unitType] ? targetSpecs[unitType][s.스펙항목코드] : null;
                    return { specItemName: specItem?.스펙항목명, specName: spec?.스펙명, isMatch: (s.스펙코드 === targetSpecCode), specItemCode: s.스펙항목코드 };
                });
                unitDetails.push({ unitCode: unitType, isMatch: isUnitMatch, specs: partSpecs, partNumber: unitPartNumber });
            });
            results.push({ product, matchRate: (bom.length > 0 ? (matchCount / bom.length) * 100 : 0), units: unitDetails, bom });
        });
        results.sort((a, b) => b.matchRate - a.matchRate);
        
        renderSearchResults(results);
        const availablePartPool = new Set(filteredProducts.flatMap(p => db.제품BOM정보.filter(b => b.제품품번코드 === p.제품품번코드).map(b => b.유닛품번코드)));
        renderOptimalCombination(results, targetHashes, availablePartPool, targetSpecs);
    });

    $(document).on('click', '#temp-product-button', function() {
        alert('견적 등록 기능은 아직 구현되지 않았습니다.');
    });

    $('.card').off('click').on('click', '.toggle-all-button', function() {
        const button = $(this);
        const section = button.closest('.card');
        const currentlyCollapsing = button.text() === '전체 접기';

        if (currentlyCollapsing) {
            section.find('.spec-table tbody:visible, .spec-details-list:visible').slideUp();
            section.find('.toggle-icon').text('+');
            button.text('전체 펼치기');
        } else {
            section.find('.spec-table tbody:hidden, .spec-details-list:hidden').slideDown();
            section.find('.toggle-icon').text('-');
            button.text('전체 접기');
        }
    });

    $('#spec-filters').off('change').on('change', '#product-family-select', function() {
        const selectedFamily = $(this).val();
        const modelSelect = $('#product-model-select');
        const allModels = db.제품정보;

        const filteredModels = selectedFamily 
            ? allModels.filter(m => m.제품군코드 === selectedFamily)
            : allModels;

        modelSelect.find('option:not(:first)').remove();

        filteredModels.forEach(m => {
            modelSelect.append($(`<option value="${m.제품코드}">${m.제품코드}</option>`));
        });
    });

    $('#spec-options').off('click').on('click', '.spec-table caption', function() {
        const tableBody = $(this).closest('.spec-table').find('tbody');
        const icon = $(this).find('.toggle-icon');

        if (icon.text() === '+') {
            icon.text('-');
            tableBody.slideToggle();
        } else {
            tableBody.slideToggle(function() {
                icon.text('+');
            });
        }
    });

    $('#search-results, #optimal-combination').off('click').on('click', '.unit-card h4', function() {
        const specList = $(this).siblings('.spec-details-list');
        const icon = $(this).find('.toggle-icon');

        if (icon.text() === '+') {
            icon.text('-');
            specList.slideToggle();
        } else {
            specList.slideToggle(function() {
                icon.text('+');
            });
        }
    });
}