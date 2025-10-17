// 전역 db 객체. 부모 창(main.html)에서 데이터를 채워줍니다.
let db = {};

// 부모 창에서 호출할 초기화 함수
window.initializePage = function(db_from_parent) {
    db = db_from_parent;
    console.log("spec_master.js 초기화됨:", db);
    
    // jQuery가 준비되면 UI 렌더링 및 이벤트 핸들러 바인딩 시작
    $(document).ready(function() {
        initializeUI();
        initializeEventHandlers();
    });
};

// =================================================================
// 2. UI 렌더링 및 헬퍼 함수
// =================================================================
function initializeUI() {
    renderUnitList();
}

function generateNewSpecItemCode() {
    const existingCodes = db.스펙항목.map(item => parseInt(item.스펙항목코드.substring(1))).filter(num => !isNaN(num));
    const maxCode = Math.max(0, ...existingCodes);
    const newCodeNumber = maxCode + 1;
    return 'S' + newCodeNumber.toString().padStart(6, '0');
}

function generateNewSpecCode() {
    const existingCodes = db.스펙.map(item => parseInt(item.스펙코드.substring(1))).filter(num => !isNaN(num));
    const maxCode = Math.max(0, ...existingCodes);
    const newCodeNumber = maxCode + 1;
    return 'O' + newCodeNumber.toString().padStart(6, '0');
}

function renderUnitList() {
    const unitList = $('#unit-list');
    unitList.empty();
    db.유닛그룹.sort((a, b) => parseInt(a.디스플레이순서) - parseInt(b.디스플레이순서));
    db.유닛그룹.forEach(group => {
        const groupEl = $(`<div class="tree-item collapsed"><div><span class="icon">📁</span><span class="group-name">${group.유닛그룹설명}</span></div><ul></ul></div>`);
        const unitsInGroup = db.유닛.filter(u => u.유닛그룹코드 === group.유닛그룹코드);
        unitsInGroup.sort((a, b) => parseInt(a.디스플레이순서) - parseInt(b.디스플레이순서));
        const sublist = groupEl.find('ul');
        unitsInGroup.forEach(unit => {
            const unitEl = $(`<li><div class="list-item" data-unit-code="${unit.유닛코드}">${unit.유닛설명} (${unit.유닛코드})</div></li>`);
            sublist.append(unitEl);
        });
        unitList.append(groupEl);
    });
}

function renderSpecItemList(unitCode) {
    const specItemList = $('#spec-item-list');
    specItemList.empty();
    specItemList.append('<button class="add-button" id="add-spec-item-btn">+ 새 스펙 항목 추가</button>');
    const specItemLinks = db['유닛 스펙항목 리스트'].filter(link => link.유닛코드 === unitCode);
    specItemLinks.sort((a, b) => parseInt(a.디스플레이순서) - parseInt(b.디스플레이순서));
    const specItems = specItemLinks.map(link => {
        const item = db.스펙항목.find(item => item.스펙항목코드 === link.스펙항목코드);
        return { ...item, 디스플레이순서: link.디스플레이순서 };
    }).filter(item => item.스펙항목코드);

    if (specItems.length === 0) {
        specItemList.append('<div class="placeholder">이 유닛에는 스펙 항목이 없습니다.</div>');
        return;
    }

    let table = '<table><thead><tr><th>항목명</th><th>설명</th><th>순서</th><th>동작</th></tr></thead><tbody>';
    specItems.forEach(item => {
        table += `<tr class="list-item" data-spec-item-code="${item.스펙항목코드}">
                    <td>${item.스펙항목명} (${item.스펙항목코드})</td>
                    <td>${item.스펙항목설명 || ''}</td>
                    <td>${item.디스플레이순서}</td>
                    <td class="item-actions">
                        <button class="edit-spec-item-btn">수정</button>
                        <button class="delete-spec-item-btn">삭제</button>
                    </td>
                  </tr>`;
    });
    table += '</tbody></table>';
    specItemList.append(table);
}

function renderSpecList(specItemCode) {
    const specList = $('#spec-list');
    specList.empty();
    specList.append('<button class="add-button" id="add-spec-btn">+ 새 스펙 추가</button>');
    const specs = db.스펙.filter(s => s.스펙항목코드 === specItemCode);
    specs.sort((a, b) => parseInt(a.디스플레이순서) - parseInt(b.디스플레이순서));
    
    if (specs.length === 0) {
        specList.append('<div class="placeholder">이 항목에는 스펙이 없습니다.</div>');
        return;
    }

    let table = '<table><thead><tr><th>스펙명</th><th>설명</th><th>순서</th><th>동작</th></tr></thead><tbody id="spec-list-items">';
    specs.forEach(spec => {
        table += `<tr class="list-item" data-spec-code="${spec.스펙코드}">
                    <td>${spec.스펙명} (${spec.스펙코드})</td>
                    <td>${spec.스펙설명 || ''}</td>
                    <td>${spec.디스플레이순서}</td>
                    <td class="item-actions">
                        <button class="edit-btn">수정</button>
                        <button class="delete-btn">삭제</button>
                    </td>
                  </tr>`;
    });
    table += '</tbody></table>';
    specList.append(table);
}

// =================================================================
// 3. 이벤트 핸들러
// =================================================================
function initializeEventHandlers() {
    // --- 패널 1: 유닛 트리 이벤트 ---
    $('#unit-list').off('click').on('click', '.tree-item > div', function() {
        const parentItem = $(this).closest('.tree-item');
        parentItem.toggleClass('collapsed');
        $(this).find('.icon').text(parentItem.hasClass('collapsed') ? '📁' : '📂');
    });

    $('#unit-list').on('click', '.list-item', function(event) {
        event.stopPropagation(); // 그룹 토글 방지
        const selectedUnitCode = $(this).data('unit-code');
        $('#unit-list .list-item').removeClass('selected');
        $(this).addClass('selected');
        $('#spec-list').html('<div class="placeholder">스펙 항목을 선택하세요.</div>');
        renderSpecItemList(selectedUnitCode);
    });

    // --- 패널 2 이벤트들 ---
    $('#spec-item-list').off('click').on('click', 'tr.list-item', function(event) {
        if ($(event.target).closest('.edit-item-row, .item-actions').length > 0) {
            return;
        }
        const selectedSpecItemCode = $(this).data('spec-item-code');
        $('#spec-item-list .list-item').removeClass('selected');
        $(this).addClass('selected');
        renderSpecList(selectedSpecItemCode);
    });

    $('#spec-item-list').on('click', '#add-spec-item-btn', function() {
        if ($('#spec-item-list .edit-item-row').length > 0) {
            alert('이미 편집 중인 항목이 있습니다. 먼저 저장을 완료해주세요.');
            return;
        }
        const unitCode = $('#unit-list .list-item.selected').data('unit-code');
        if (!unitCode) {
            alert('먼저 유닛을 선택해주세요.');
            return;
        }
        const newRow = $(`
            <tr class="edit-item-row" data-is-new="true">
                <td><input type="text" placeholder="항목명" class="spec-item-name-input"></td>
                <td><input type="text" placeholder="항목설명" class="spec-item-desc-input"></td>
                <td><input type="text" placeholder="순서" class="spec-item-order-input" style="width: 50px;"></td>
                <td>
                    <button class="save-new-spec-item-btn">저장</button>
                    <button class="cancel-spec-item-btn">취소</button>
                </td>
            </tr>
        `);
        $('#spec-item-list tbody').append(newRow);
    });

    $('#spec-item-list').on('click', '.edit-spec-item-btn', function() {
        if ($('#spec-item-list .edit-item-row').length > 0) {
            alert('이미 편집 중인 항목이 있습니다. 먼저 저장을 완료해주세요.');
            return;
        }
        const $itemRow = $(this).closest('tr');
        const specItemCode = $itemRow.data('spec-item-code');
        const specItem = db.스펙항목.find(s => s.스펙항목코드 === specItemCode);
        const unitCode = $('#unit-list .list-item.selected').data('unit-code');
        const link = db['유닛 스펙항목 리스트'].find(l => l.유닛코드 === unitCode && l.스펙항목코드 === specItemCode);
        const displayOrder = link ? link.디스플레이순서 : '';
        const editRow = $(`
            <tr class="edit-item-row" data-spec-item-code="${specItem.스펙항목코드}">
                <td><input type="text" value="${specItem.스펙항목명}" class="spec-item-name-input" placeholder="항목명"></td>
                <td><input type="text" value="${specItem.스펙항목설명 || ''}" class="spec-item-desc-input" placeholder="항목설명"></td>
                <td><input type="text" value="${displayOrder}" class="spec-item-order-input" style="width: 50px;" placeholder="순서"></td>
                <td>
                    <button class="save-edited-spec-item-btn">저장</button>
                    <button class="cancel-spec-item-btn">취소</button>
                </td>
            </tr>
        `);
        $itemRow.replaceWith(editRow);
    });

    $('#spec-item-list').on('click', '.delete-spec-item-btn', function() {
        const $itemRow = $(this).closest('tr');
        const specItemCode = $itemRow.data('spec-item-code');
        const unitCode = $('#unit-list .list-item.selected').data('unit-code');
        const childSpecCodes = db.스펙.filter(s => s.스펙항목코드 === specItemCode).map(s => s.스펙코드);
        const isInUse = db.유닛품번스펙정보.some(item => childSpecCodes.includes(item.스펙코드));
        if (isInUse) {
            alert('이 스펙 항목에 속한 하위 스펙이 하나 이상의 유닛 품번에 사용되고 있어 삭제할 수 없습니다.');
            return;
        }
        if (confirm(`'${specItemCode}' 항목을 정말로 삭제하시겠습니까?
이 항목에 연결된 모든 하위 스펙들도 함께 삭제됩니다.`)) {
            db.스펙 = db.스펙.filter(s => s.스펙항목코드 !== specItemCode);
            db['유닛 스펙항목 리스트'] = db['유닛 스펙항목 리스트'].filter(link => !(link.유닛코드 === unitCode && link.스펙항목코드 === specItemCode));
            db.스펙항목 = db.스펙항목.filter(item => item.스펙항목코드 !== specItemCode);
            alert('스펙 항목 및 관련 하위 스펙들이 현재 세션에서 삭제되었습니다.');
            renderSpecItemList(unitCode);
            $('#spec-list').html('<div class="placeholder">스펙 항목을 선택하세요.</div>');
        }
    });

    $('#spec-item-list').on('click', '.cancel-spec-item-btn', function() {
        const unitCode = $('#unit-list .list-item.selected').data('unit-code');
        renderSpecItemList(unitCode);
    });

    $('#spec-item-list').on('click', '.save-new-spec-item-btn', function() {
        const $row = $(this).closest('tr');
        const unitCode = $('#unit-list .list-item.selected').data('unit-code');
        const newSpecItem = {
            스펙항목코드: generateNewSpecItemCode(),
            스펙항목명: $row.find('.spec-item-name-input').val(),
            스펙항목설명: $row.find('.spec-item-desc-input').val()
        };
        const newOrder = $row.find('.spec-item-order-input').val();
        if (!newSpecItem.스펙항목명 || !newOrder) {
            alert('스펙 항목 이름과 순서는 필수입니다.');
            return;
        }
        if (db.스펙항목.some(item => item.스펙항목코드 === newSpecItem.스펙항목코드)) {
            alert('자동 생성된 코드가 이미 존재합니다. (코드 충돌)');
            return;
        }
        const newLink = {
            유닛코드: unitCode,
            스펙항목코드: newSpecItem.스펙항목코드,
            디스플레이순서: newOrder
        };
        db.스펙항목.push(newSpecItem);
        db['유닛 스펙항목 리스트'].push(newLink);
        alert(`새 스펙 항목(코드: ${newSpecItem.스펙항목코드})이 현재 세션에 저장되었습니다.`);
        renderSpecItemList(unitCode);
    });

    $('#spec-item-list').on('click', '.save-edited-spec-item-btn', function() {
        const $row = $(this).closest('tr');
        const specItemCode = $row.data('spec-item-code');
        const specItem = db.스펙항목.find(s => s.스펙항목코드 === specItemCode);
        const unitCode = $('#unit-list .list-item.selected').data('unit-code');
        const link = db['유닛 스펙항목 리스트'].find(l => l.유닛코드 === unitCode && l.스펙항목코드 === specItemCode);
        const newOrder = $row.find('.spec-item-order-input').val();
        if (link && newOrder) {
            link.디스플레이순서 = newOrder;
        }
        specItem.스펙항목명 = $row.find('.spec-item-name-input').val();
        specItem.스펙항목설명 = $row.find('.spec-item-desc-input').val();
        if (!specItem.스펙항목명) {
            alert('스펙 항목 이름은 필수입니다.');
            return;
        }
        alert('스펙 항목이 현재 세션에서 수정되었습니다.');
        renderSpecItemList(unitCode);
    });

    // --- 패널 3: 스펙 관리 이벤트 핸들러 ---
    $('#spec-list').off('click').on('click', '#add-spec-btn', function() {
        if ($('#spec-list .edit-item-row').length > 0) {
            alert('이미 편집 중인 항목이 있습니다. 먼저 저장을 완료해주세요.');
            return;
        }
        const specItemCode = $('#spec-item-list .list-item.selected').data('spec-item-code');
        if (!specItemCode) {
            alert('먼저 스펙 항목을 선택해주세요.');
            return;
        }
        const newRow = $(`
            <tr class="edit-item-row" data-is-new="true">
                <td><input type="text" placeholder="스펙명" class="spec-name-input"></td>
                <td><input type="text" placeholder="스펙설명" class="spec-desc-input"></td>
                <td><input type="text" placeholder="순서" class="spec-order-input" style="width: 50px;"></td>
                <td>
                    <button class="save-btn">저장</button>
                    <button class="cancel-btn">취소</button>
                </td>
            </tr>
        `);
        $('#spec-list-items').append(newRow);
    });

    $('#spec-list').on('click', '.edit-btn', function() {
        if ($('#spec-list .edit-item-row').length > 0) {
            alert('이미 편집 중인 항목이 있습니다. 먼저 저장을 완료해주세요.');
            return;
        }
        const $itemRow = $(this).closest('tr');
        const specCode = $itemRow.data('spec-code');
        const spec = db.스펙.find(s => s.스펙코드 === specCode);
        const editRow = $(`
            <tr class="edit-item-row" data-spec-code="${spec.스펙코드}">
                <td><input type="text" value="${spec.스펙명}" class="spec-name-input"></td>
                <td><input type="text" value="${spec.스펙설명 || ''}" class="spec-desc-input"></td>
                <td><input type="text" value="${spec.디스플레이순서}" class="spec-order-input" style="width: 50px;"></td>
                <td>
                    <button class="save-btn">저장</button>
                    <button class="cancel-btn">취소</button>
                </td>
            </tr>
        `);
        $itemRow.replaceWith(editRow);
    });

    $('#spec-list').on('click', '.cancel-btn', function() {
        const specItemCode = $('#spec-item-list .list-item.selected').data('spec-item-code');
        renderSpecList(specItemCode);
    });

    $('#spec-list').on('click', '.save-btn', function() {
        const $row = $(this).closest('tr');
        const isNew = $row.data('is-new');
        const specItemCode = $('#spec-item-list .list-item.selected').data('spec-item-code');
        if (isNew) {
            const newSpec = {
                스펙코드: generateNewSpecCode(),
                스펙항목코드: specItemCode,
                스펙명: $row.find('.spec-name-input').val(),
                스펙설명: $row.find('.spec-desc-input').val(),
                디스플레이순서: $row.find('.spec-order-input').val()
            };
            if (!newSpec.스펙명 || !newSpec.디스플레이순서) {
                alert('스펙명, 순서는 필수 항목입니다.');
                return;
            }
            if (db.스펙.some(s => s.스펙코드 === newSpec.스펙코드)) {
                alert('자동 생성된 코드가 이미 존재합니다. (코드 충돌)');
                return;
            }
            db.스펙.push(newSpec);
            alert(`새 스펙(코드: ${newSpec.스펙코드})이 현재 세션에 저장되었습니다.`);
        } else {
            const specCode = $row.data('spec-code');
            const spec = db.스펙.find(s => s.스펙코드 === specCode);
            spec.스펙명 = $row.find('.spec-name-input').val();
            spec.스펙설명 = $row.find('.spec-desc-input').val();
            spec.디스플레이순서 = $row.find('.spec-order-input').val();
            alert('스펙이 현재 세션에서 수정되었습니다. (파일에는 반영되지 않음)');
        }
        renderSpecList(specItemCode);
    });

    $('#spec-list').on('click', '.delete-btn', function() {
        const specCode = $(this).closest('tr').data('spec-code');
        const isInUse = db.유닛품번스펙정보.some(item => item.스펙코드 === specCode);
        if (isInUse) {
            alert('이 스펙은 현재 하나 이상의 유닛 품번에 사용되고 있어 삭제할 수 없습니다.');
            return;
        }
        if (confirm(`'${specCode}' 스펙을 정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
            db.스펙 = db.스펙.filter(s => s.스펙코드 !== specCode);
            const specItemCode = $('#spec-item-list .list-item.selected').data('spec-item-code');
            alert('스펙이 현재 세션에서 삭제되었습니다. (파일에는 반영되지 않음)');
            renderSpecList(specItemCode);
        }
    });
}