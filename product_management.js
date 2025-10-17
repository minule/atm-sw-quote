let db = {};
// const unitSpecHashes = {}; // 더 이상 필요 없음
const incompleteProducts = new Set();
const incompleteModels = new Set();
let mappedParts = new Set();

// 부모 창에서 호출할 초기화 함수
window.initializePage = function(db_from_parent) {
    db = db_from_parent;
    console.log("product_bom.js 초기화됨:", db);

    // jQuery가 준비되면 UI 렌더링 및 초기 계산 시작
    $(document).ready(function() {
        // precomputeHashes(); // main.js에서 처리하므로 제거
        populateIncompleteSets();
        initializeUI();
        initializeEventHandlers();
    });
};

// =================================================================
// 초기 계산 함수
// =================================================================
// function precomputeHashes() { ... } // main.js로 이동하여 제거

function populateIncompleteSets() {
    if (!db.유닛품번스펙정보 || !db.제품품번정보) return;
    mappedParts = new Set(db.유닛품번스펙정보.map(s => String(s.유닛품번코드)));
    incompleteProducts.clear();
    incompleteModels.clear();
    db.제품품번정보.forEach(product => {
        const bom = db.제품BOM정보.filter(b => b.제품품번코드 === product.제품품번코드);
        for (const bomItem of bom) {
            if (!mappedParts.has(String(bomItem.유닛품번코드))) {
                incompleteProducts.add(product.제품품번코드);
                incompleteModels.add(product.제품코드);
                break;
            }
        }
    });
}

// =================================================================
// UI 렌더링 함수
// =================================================================
function initializeUI() {
    initializeTree();
    $('#product-list-container').html('<div class="placeholder">좌측 탐색기에서 모델을 선택하세요.</div>');
    $('#bom-container').html('<div class="placeholder">제품 목록에서 제품을 선택하세요.</div>');
    $('#unit-explorer-container').html('<div class="placeholder">제품 목록에서 제품을 선택하세요.</div>');
}

function initializeTree() {
    const treeContainer = $('#product-tree');
    treeContainer.empty();

    db.제품군.sort((a, b) => parseInt(a.디스플레이순서) - parseInt(b.디스플레이순서));

    db.제품군.forEach(family => {
        const familyId = `family-${family.제품군코드}`;
        const familyElement = $(`
            <div class="tree-item collapsed" id="${familyId}">
                <div>
                    <span class="icon">📁</span>
                    <span class="family-name">${family.제품군코드}</span>
                </div>
                <ul></ul>
            </div>
        `);

        const modelsList = familyElement.find('ul');
        const models = db.제품정보
            .filter(m => m.제품군코드 === family.제품군코드)
            .sort((a, b) => parseInt(a.디스플레이순서) - parseInt(b.디스플레이순서));

        models.forEach(model => {
            const modelCode = model.제품코드;
            const marker = incompleteModels.has(modelCode) ? '<span class="needs-mapping-marker">⚠️</span>' : '';
            const modelElement = $(`<li><div class="model" data-model-code="${modelCode}">${modelCode}${marker}</div></li>`);
            modelsList.append(modelElement);
        });

        treeContainer.append(familyElement);
    });
}

function renderProductTable(modelCode) {
    const container = $('#product-list-container');
    container.empty();

    const products = db.제품품번정보.filter(p => p.제품코드 === modelCode);

    if (products.length === 0) {
        container.html('<div class="placeholder">해당 모델에 속한 제품이 없습니다.</div>');
        return;
    }

    const units = db.유닛.filter(u => u && u.유닛코드).sort((a, b) => parseInt(a.디스플레이순서) - parseInt(b.디스플레이순서));
    let table = '<table><thead><tr><th>제품품번코드</th><th>제품명</th><th>국가</th><th>고객</th>';
    units.forEach(unit => {
        table += `<th>${unit.유닛코드}</th>`;
    });
    table += '</tr></thead><tbody>';

    products.forEach(product => {
        const productCode = product.제품품번코드;
        const productMarker = incompleteProducts.has(productCode) ? '<span class="needs-mapping-marker">⚠️</span>' : '';
        table += `<tr>
            <td>${productCode}${productMarker}</td>
            <td>${product.제품명}</td>
            <td>${product.국가코드}</td>
            <td>${product.고객코드}</td>`;
        
        const bom = db.제품BOM정보.filter(b => b.제품품번코드 === product.제품품번코드);
        units.forEach(unit => {
            const bomItem = bom.find(b => b.유닛코드 === unit.유닛코드);
            const partNumber = bomItem ? bomItem.유닛품번코드 : 'N/A';
            const partMarker = (partNumber !== 'N/A' && !mappedParts.has(String(partNumber))) ? '<span class="needs-mapping-marker">⚠️</span>' : '';
            table += `<td>${partNumber}${partMarker}</td>`;
        });

        table += '</tr>';
    });

    table += '</tbody></table>';
    container.html(table);
}

function renderBomView(productPartNumberCode) {
    const container = $('#bom-container');
    container.empty();

    const product = db.제품품번정보.find(p => p.제품품번코드 === productPartNumberCode);
    if (!product) {
        container.html('<div class="placeholder">해당 제품을 찾을 수 없습니다.</div>');
        return;
    }

    const bom = db.제품BOM정보.filter(b => b.제품품번코드 === productPartNumberCode);
    const unitsInBom = db.유닛.filter(u => bom.some(b => b.유닛코드 === u.유닛코드))
                            .sort((a, b) => parseInt(a.디스플레이순서) - parseInt(b.디스플레이순서));

    unitsInBom.forEach(unit => {
        const bomItem = bom.find(b => b.유닛코드 === unit.유닛코드);
        if (!bomItem) return;

        const partNumber = bomItem.유닛품번코드;
        const specs = db.유닛품번스펙정보.filter(s => String(s.유닛품번코드) === String(partNumber));
        let cardContentHtml;
        const hasSpecs = specs.length > 0;
        const marker = !hasSpecs ? '<span class="needs-mapping-marker">⚠️</span>' : '';

        if (hasSpecs) {
            let specListHtml = '<ul class="bom-spec-list">';
            specs.forEach(spec => {
                const specItem = db.스펙항목.find(si => si.스펙항목코드 === spec.스펙항목코드);
                const specValue = db.스펙.find(sv => sv.스펙코드 === spec.스펙코드);
                
                specListHtml += `<li>
                    <span class="spec-name">${specItem ? specItem.스펙항목명 : spec.스펙항목코드}</span>
                    <span class="spec-value">${specValue ? specValue.스펙명 : spec.스펙코드}</span>
                </li>`;
            });
            specListHtml += '</ul>';
            cardContentHtml = specListHtml;
        } else {
            cardContentHtml = `<div class="unmapped-spec-placeholder">
                                    <span>매핑된 스펙 정보가 없습니다.</span></br>
                                    <span class="click-guide">중앙 하단 비교창에서 스펙을 매핑하세요.</span>
                               </div>`;
        }

        const cardHtml = `
            <div class="bom-unit-card">
                <div class="bom-unit-card-header">
                    ${unit.유닛설명} (${unit.유닛코드}) 
                    <span>- ${partNumber}</span>
                    ${marker}
                </div>
                <div class="bom-card-content">${cardContentHtml}</div>
            </div>
        `;
        container.append(cardHtml);
    });
}

function renderUnitPartExplorer(unitCode, partNumberToHighlight) {
    const container = $('#unit-explorer-container');
    container.empty();

    if (!unitCode) {
        container.html('<div class="placeholder">제품 목록에서 유닛을 선택하세요.</div>');
        return;
    }

    const specItemsForUnit = db['유닛 스펙항목 리스트']
        .filter(item => item.유닛코드 === unitCode)
        .map(item => db.스펙항목.find(si => si.스펙항목코드 === item.스펙항목코드))
        .filter(item => item)
        .sort((a, b) => {
            const orderA = db['유닛 스펙항목 리스트'].find(i => i.스펙항목코드 === a.스펙항목코드).디스플레이순서;
            const orderB = db['유닛 스펙항목 리스트'].find(i => i.스펙항목코드 === b.스펙항목코드).디스플레이순서;
            return parseInt(orderA) - parseInt(orderB);
        });

    const partsForUnit = db.유닛품번리스트.filter(p => p.유닛코드 === unitCode);

    if (partsForUnit.length === 0 && !(partNumberToHighlight && !db.유닛품번스펙정보.some(s => String(s.유닛품번코드) === String(partNumberToHighlight)))) {
        container.html('<div class="placeholder">해당 유닛에 대한 부품이 없습니다.</div>');
    }

    let table = '<table><thead><tr><th>유닛품번코드</th>';
    specItemsForUnit.forEach(si => {
        table += `<th>${si.스펙항목명}</th>`;
    });
    table += '<th>동작</th></tr></thead><tbody>'; // 동작 헤더 추가

    partsForUnit.forEach(part => {
        const highlightClass = (String(part.유닛품번코드) === String(partNumberToHighlight)) ? 'selected-row' : '';
        table += `<tr class="${highlightClass}" data-unit-code="${part.유닛코드}" data-part-code="${part.유닛품번코드}"><td>${part.유닛품번코드}</td>`;
        const specsForPart = db.유닛품번스펙정보.filter(s => String(s.유닛품번코드) === String(part.유닛품번코드));

        specItemsForUnit.forEach(si => {
            const spec = specsForPart.find(s => s.스펙항목코드 === si.스펙항목코드);
            const specValue = spec ? db.스펙.find(sv => sv.스펙코드 === spec.스펙코드) : null;
            table += `<td>${specValue ? specValue.스펙명 : 'N/A'}</td>`;
        });
        table += '<td><button class="edit-spec-btn">수정</button></td></tr>'; // 수정 버튼 추가
    });

    // 스펙 매핑이 필요한 경우 입력 행 추가
    const needsMapping = partNumberToHighlight && !db.유닛품번스펙정보.some(s => String(s.유닛품번코드) === String(partNumberToHighlight));
    if (needsMapping) {
        const isPartInRenderedList = partsForUnit.some(p => String(p.유닛품번코드) === String(partNumberToHighlight));
        if (!isPartInRenderedList) {
             let inputRow = `<tr class="new-spec-row" data-unit-code="${unitCode}" data-part-code="${partNumberToHighlight}">
                                <td>${partNumberToHighlight}</td>`;
            specItemsForUnit.forEach(si => {
                let select = `<select data-spec-item-code="${si.스펙항목코드}"><option value="">-- 선택 --</option>`;
                const options = db.스펙.filter(s => s.스펙항목코드 === si.스펙항목코드);
                options.forEach(o => {
                    select += `<option value="${o.스펙코드}">${o.스펙명}</option>`;
                });
                select += '</select>';
                inputRow += `<td>${select}</td>`;
            });
            inputRow += '<td><button class="save-new-spec-btn">저장</button></td></tr>';
            table += inputRow;
        }
    }

    table += '</tbody></table>';
    container.html(table);
}

function updateTitles(titles) {
    $('#product-list-title').text(titles.model ? `- ${titles.model}` : '');
    $('#bom-title').text(titles.product ? `- ${titles.product}` : '');
    $('#unit-compare-title').text(titles.unit ? `- ${titles.unit}` : '');
}

// =================================================================
// 4. 이벤트 핸들러
// =================================================================
function initializeEventHandlers() {
    // 이벤트 핸들러 중복 바인딩 방지를 위해 .off() 사용
    $('#product-tree').off('click').on('click', '.tree-item > div', function(e) {
        if ($(e.target).hasClass('model')) return; // 모델 클릭은 개별 핸들러에서 처리
        const parentItem = $(this).closest('.tree-item');
        parentItem.toggleClass('collapsed');
        const icon = parentItem.find('> div > .icon');
        icon.text(parentItem.hasClass('collapsed') ? '📁' : '📂');
    });

    $('#product-tree').on('click', '.model', function() {
        $('#product-tree .model').removeClass('selected');
        $(this).addClass('selected');
        const modelCode = $(this).data('model-code');
        renderProductTable(modelCode);
        updateTitles({ model: modelCode, product: null, unit: null });
        // Clear other panes
        $('#bom-container').html('<div class="placeholder">제품 목록에서 제품을 선택하세요.</div>');
        $('#unit-explorer-container').html('<div class="placeholder">제품 목록에서 제품을 선택하세요.</div>');
    });

    $('#product-list-container').off('click').on('click', 'tr', function(event) {
        const $row = $(this);
        if ($row.closest('thead').length) return; // 헤더 클릭은 무시

        const productPartNumberCode = $row.find('td:first').text().replace('⚠️','');
        if (!productPartNumberCode || !productPartNumberCode.trim()) return;

        // 1. 우측 패널에 BOM 뷰 렌더링
        renderBomView(productPartNumberCode);

        // 2. 중앙 하단 유닛 탐색기 뷰 렌더링
        const $cell = $(event.target).closest('td');
        const cellIndex = $cell.index();
        let unitCodeToShow;
        let partNumberToHighlight;

        if (cellIndex >= 4) {
            unitCodeToShow = $('#product-list-container thead th').eq(cellIndex).text();
            partNumberToHighlight = $cell.text().replace('⚠️','');
        } else {
            const bomUnits = db.제품BOM정보.filter(b => b.제품품번코드 === productPartNumberCode).map(b => db.유닛.find(u => u.유닛코드 === b.유닛코드)).filter(u => u).sort((a, b) => parseInt(a.디스플레이순서) - parseInt(b.디스플레이순서));
            if (bomUnits.length > 0) {
                unitCodeToShow = bomUnits[0].유닛코드;
                const bomItem = db.제품BOM정보.find(b => b.제품품번코드 === productPartNumberCode && b.유닛코드 === unitCodeToShow);
                partNumberToHighlight = bomItem ? bomItem.유닛품번코드 : null;
            }
        }

        if (unitCodeToShow && partNumberToHighlight && partNumberToHighlight !== 'N/A') {
            renderUnitPartExplorer(unitCodeToShow, partNumberToHighlight);
        } else {
            $('#unit-explorer-container').html('<div class="placeholder">선택된 유닛의 부품 정보가 없거나 스펙 매핑이 불필요합니다.</div>');
        }
        
        const modelCode = $('#product-tree .model.selected').data('model-code');
        updateTitles({ model: modelCode, product: productPartNumberCode, unit: unitCodeToShow });

        // 3. 클릭된 행 하이라이트
        $('#product-list-container tr').removeClass('selected-row');
        $row.addClass('selected-row');
    });

    // 신규 스펙 저장
    $('#unit-explorer-container').off('click', '.save-new-spec-btn').on('click', '.save-new-spec-btn', function() {
        const $row = $(this).closest('.new-spec-row');
        const unitCode = $row.data('unit-code');
        const partCode = $row.data('part-code');
        
        handleSaveSpecs($row, unitCode, partCode, true);
    });

    // 기존 스펙 수정
    $('#unit-explorer-container').off('click', '.edit-spec-btn').on('click', '.edit-spec-btn', function() {
        const $originalRow = $(this).closest('tr');
        const unitCode = $originalRow.data('unit-code');
        const partCode = $originalRow.data('part-code');
        const specsForPart = db.유닛품번스펙정보.filter(s => String(s.유닛품번코드) === String(partCode));
        const specItemsForUnit = db['유닛 스펙항목 리스트'].filter(item => item.유닛코드 === unitCode).sort((a, b) => parseInt(a.디스플레이순서) - parseInt(b.디스플레이순서));

        let editRowHtml = `<tr class="edit-spec-row" data-unit-code="${unitCode}" data-part-code="${partCode}"><td>${partCode}</td>`;

        specItemsForUnit.forEach(unitSpecItem => {
            const specItemCode = unitSpecItem.스펙항목코드;
            const currentSpec = specsForPart.find(s => s.스펙항목코드 === specItemCode);
            const currentSpecCode = currentSpec ? currentSpec.스펙코드 : '';

            let select = `<select data-spec-item-code="${specItemCode}"><option value="">-- 선택 --</option>`;
            const options = db.스펙.filter(s => s.스펙항목코드 === specItemCode);
            options.forEach(o => {
                const selected = (o.스펙코드 === currentSpecCode) ? 'selected' : '';
                select += `<option value="${o.스펙코드}" ${selected}>${o.스펙명}</option>`;
            });
            select += '</select>';
            editRowHtml += `<td>${select}</td>`;
        });

        editRowHtml += '<td><button class="save-edited-spec-btn">저장</button><button class="cancel-edit-btn">취소</button></td></tr>';
        
        $originalRow.replaceWith(editRowHtml);
    });

    // 수정 저장
    $('#unit-explorer-container').off('click', '.save-edited-spec-btn').on('click', '.save-edited-spec-btn', function() {
        const $row = $(this).closest('.edit-spec-row');
        const unitCode = $row.data('unit-code');
        const partCode = $row.data('part-code');

        handleSaveSpecs($row, unitCode, partCode, false);
    });

    // 수정 취소
    $('#unit-explorer-container').off('click', '.cancel-edit-btn').on('click', '.cancel-edit-btn', function() {
        const $row = $(this).closest('tr');
        const unitCode = $row.data('unit-code');
        const partCode = $row.data('part-code');
        renderUnitPartExplorer(unitCode, partCode);
    });
}

function handleSaveSpecs($row, unitCode, partCode, isNew) {
    let allSelected = true;
    const newSpecs = [];
    $row.find('select').each(function() {
        const specItemCode = $(this).data('spec-item-code');
        const specCode = $(this).val();
        if (!specCode) {
            allSelected = false;
        }
        const specItem = db.스펙항목.find(si => si.스펙항목코드 === specItemCode);
        const spec = db.스펙.find(s => s.스펙코드 === specCode);
        newSpecs.push({
            유닛품번코드: partCode,
            유닛코드: unitCode,
            스펙항목코드: specItemCode,
            스펙코드: specCode,
            스펙항목명: specItem ? specItem.스펙항목명 : '',
            스펙명: spec ? spec.스펙명 : ''
        });
    });

    if (!allSelected) {
        alert('모든 스펙 항목을 선택해야 합니다.');
        return;
    }

    // 중복 스펙 검사
    const newSpecHash = newSpecs.map(s => s.스펙코드).sort().join('-');
    const partsInSameUnit = db.유닛품번리스트.filter(p => p.유닛코드 === unitCode);
    let isDuplicate = false;
    for (const existingPart of partsInSameUnit) {
        if (String(existingPart.유닛품번코드) === String(partCode)) continue; // 자기 자신과는 비교하지 않음

        const existingSpecHash = db.unitSpecHashes[existingPart.유닛품번코드];
        if (existingSpecHash && existingSpecHash === newSpecHash) {
            isDuplicate = true;
            break;
        }
    }

    if (isDuplicate) {
        alert('동일한 스펙의 부품이 이미 존재합니다.');
        return;
    }

    if (isNew) {
        // 마스터 리스트에 부품 추가
        const partExists = db.유닛품번리스트.some(p => String(p.유닛품번코드) === String(partCode));
        if (!partExists) {
            db.유닛품번리스트.push({
                유닛품번코드: partCode,
                유닛코드: unitCode,
                스펙해쉬코드: ''
            });
        }
    } else {
        // 기존 스펙 정보 삭제
        db.유닛품번스펙정보 = db.유닛품번스펙정보.filter(s => String(s.유닛품번코드) !== String(partCode));
    }

    // 새 스펙 정보 추가
    db.유닛품번스펙정보.push(...newSpecs);
    // 새 해시 정보 추가/업데이트
    db.unitSpecHashes[partCode] = newSpecHash;

    alert(`부품(${partCode})에 대한 스펙이 현재 세션에 저장되었습니다.`);

    // --- UI 새로고침 ---
    const selectedModel = $('#product-tree .model.selected');
    const modelCode = selectedModel.length > 0 ? selectedModel.data('model-code') : null;
    const selectedProductRow = $('#product-list-container tr.selected-row');
    const productPartNumberCode = selectedProductRow.length > 0 ? selectedProductRow.find('td:first').text().replace('⚠️','') : null;
    const expandedFamilyIds = [];
    $('#product-tree .tree-item:not(.collapsed)').each(function() {
        expandedFamilyIds.push(this.id);
    });

    populateIncompleteSets();

    initializeTree(); 

    if (expandedFamilyIds.length > 0) {
        expandedFamilyIds.forEach(familyId => {
            const familyElement = $(`#${familyId}`);
            if (familyElement.length) {
                familyElement.removeClass('collapsed');
                familyElement.find('> div > .icon').text('📂');
            }
        });
    }
    if (modelCode) {
        $('#product-tree .model[data-model-code="' + modelCode + '"]').addClass('selected');
        renderProductTable(modelCode);
    }

    if (productPartNumberCode) {
        renderBomView(productPartNumberCode);
        renderUnitPartExplorer(unitCode, partCode);
    }
    
    updateTitles({ model: modelCode, product: productPartNumberCode, unit: unitCode });
}