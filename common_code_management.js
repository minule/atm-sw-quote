let db = {};
let selectedGroupCode = null;

const GROUP_HEADERS = ['그룹코드', '그룹명', '디스플레이순서'];
const CODE_HEADERS = ['코드명', '코드디스플레이순서']; // 그룹코드는 선택된 것으로 가정

// Initialization from parent window
window.initializePage = function(db_from_parent) {
    db = db_from_parent;
    $(document).ready(function() {
        if (db && db['그룹코드관리'] && db['코드관리']) {
            console.log("DB data loaded:", db);
            renderGroupCodeTable();
            initializeEventListeners();
        } else {
            console.error("Required data tables are missing from DB object.", db);
            $('#group-code-table-container').html('<div class="placeholder">데이터 로딩 실패.</div>');
        }
    });
};

function renderGroupCodeTable() {
    const container = $('#group-code-table-container');
    let table = '<table><thead><tr>';
    GROUP_HEADERS.forEach(h => table += `<th>${h}</th>`);
    table += '<th>동작</th></tr></thead><tbody>';

    db.그룹코드관리.sort((a, b) => (a.디스플레이순서 || 999) - (b.디스플레이순서 || 999));

    db.그룹코드관리.forEach((item, index) => {
        const isSelected = item.그룹코드 === selectedGroupCode ? 'selected' : '';
        table += `<tr data-group-code="${item.그룹코드}" class="${isSelected}">`;
        GROUP_HEADERS.forEach(h => table += `<td>${item[h] || ''}</td>`);
        table += `<td class="item-actions">
                <button class="edit-group-btn">수정</button>
                <button class="delete-group-btn">삭제</button>
            </td>`;
        table += '</tr>';
    });

    table += '</tbody></table>';
    container.html(table);
}

function renderCodeTable(groupCode) {
    selectedGroupCode = groupCode;
    $('#add-code-btn').prop('disabled', !groupCode);

    const container = $('#code-table-container');
    container.empty();

    if (!groupCode) {
        container.html('<div class="placeholder">상위 그룹코드를 선택하세요.</div>');
        return;
    }

    const filteredCodes = db.코드관리.filter(c => c.그룹코드 === groupCode);
    filteredCodes.sort((a, b) => (a.코드디스플레이순서 || 999) - (b.코드디스플레이순서 || 999));

    let table = '<table><thead><tr>';
    CODE_HEADERS.forEach(h => table += `<th>${h}</th>`);
    table += '<th>동작</th></tr></thead><tbody>';

    if (filteredCodes.length > 0) {
        filteredCodes.forEach((item, index) => {
            table += `<tr data-code-name="${item.코드명}">`;
            CODE_HEADERS.forEach(h => table += `<td>${item[h] || ''}</td>`);
            table += '<td class="item-actions"><button class="edit-code-btn">수정</button><button class="delete-code-btn">삭제</button></td>';
            table += '</tr>';
        });
    } else {
        table += '<tr><td colspan="3" class="placeholder">코드가 없습니다.</td></tr>';
    }

    table += '</tbody></table>';
    container.html(table);
    renderGroupCodeTable(); // Re-render to show selection
}

function initializeEventListeners() {
    // Row selection
    $('#group-code-table-container').on('click', 'tr', function(e) {
        if ($(e.target).is('button, input')) return;
        const groupCode = $(this).data('group-code');
        renderCodeTable(groupCode);
    });

    // Save all changes
    $('#save-btn').on('click', function() {
        if (window.parent && window.parent.handleSystemSave) {
            // Pass the whole db object to the parent to handle which tables to save
            window.parent.handleSystemSave(db);
        } else {
            alert('저장 기능이 연동되지 않았습니다.');
        }
    });

    // Add buttons
    $('#add-group-btn').on('click', handleAddGroup);
    $('#add-code-btn').on('click', handleAddCode);

    // Dynamic event handlers for edit/delete/save/cancel
    setupDynamicRowEventHandlers('#group-code-table-container', 'group', GROUP_HEADERS, db.그룹코드관리, renderGroupCodeTable);
    setupDynamicRowEventHandlers('#code-table-container', 'code', CODE_HEADERS, db.코드관리, () => renderCodeTable(selectedGroupCode));
}

function handleAddGroup() {
    if ($('#group-code-table-container .edit-item-row').length > 0) return alert('편집 중인 항목을 먼저 저장하세요.');
    const newRowHtml = createEditRow('group', {}, GROUP_HEADERS, true);
    $('#group-code-table-container tbody').prepend(newRowHtml);
}

function handleAddCode() {
    if (!selectedGroupCode) return alert('코드를 추가할 그룹을 먼저 선택하세요.');
    if ($('#code-table-container .edit-item-row').length > 0) return alert('편집 중인 항목을 먼저 저장하세요.');
    const newRowHtml = createEditRow('code', {}, CODE_HEADERS, true);
    const codeTableBody = $('#code-table-container tbody');
    if(codeTableBody.find('.placeholder').length > 0) codeTableBody.empty();
    codeTableBody.prepend(newRowHtml);
}

function createEditRow(type, item, headers, isNew = false) {
    let row = `<tr class="edit-item-row" data-is-new="${isNew}">`;
    headers.forEach(h => {
        const value = item[h] || '';
        const isDisabled = !isNew && h === '그룹코드' ? 'disabled' : '';
        row += `<td><input type="text" name="${h}" value="${value}" ${isDisabled}></td>`;
    });
    row += '<td class="item-actions"><button class="save-row-btn" data-type="${type}">저장</button><button class="cancel-row-btn" data-type="${type}">취소</button></td>';
    row += '</tr>';
    return row;
}

function setupDynamicRowEventHandlers(containerId, type, headers, dataArray, renderFn) {
    const container = $(containerId);

    container.on('click', `.edit-${type}-btn`, function() {
        if ($(containerId + ' .edit-item-row').length > 0) return alert('편집 중인 항목을 먼저 저장하세요.');
        const $row = $(this).closest('tr');
        const key = type === 'group' ? $row.data('group-code') : $row.data('code-name');
        const keyName = type === 'group' ? '그룹코드' : '코드명';
        const item = dataArray.find(d => d[keyName] == key && (type === 'code' ? d.그룹코드 === selectedGroupCode : true));
        const editRowHtml = createEditRow(type, item, headers, false);
        $row.replaceWith(editRowHtml);
    });

    container.on('click', `.delete-${type}-btn`, function() {
        const $row = $(this).closest('tr');
        const key = type === 'group' ? $row.data('group-code') : $row.data('code-name');
        const keyName = type === 'group' ? '그룹코드' : '코드명';
        
        if (confirm(`'${key}' 항목을 정말 삭제하시겠습니까?`)) {
            if (type === 'group' && db.코드관리.some(c => c.그룹코드 === key)) {
                return alert('하위 코드가 있는 그룹은 삭제할 수 없습니다.');
            }
            const itemIndex = dataArray.findIndex(d => d[keyName] == key && (type === 'code' ? d.그룹코드 === selectedGroupCode : true));
            if (itemIndex > -1) {
                dataArray.splice(itemIndex, 1);
                alert('삭제되었습니다.');
                renderFn();
            }
        }
    });

    container.on('click', `.save-row-btn[data-type="${type}"]`, function() {
        const $row = $(this).closest('tr');
        const isNew = $row.data('is-new') === true;
        const newValues = {};
        let isValid = true;
        $row.find('input').each(function() {
            const name = $(this).attr('name');
            newValues[name] = $(this).val();
            if (!newValues[name]) isValid = false;
        });

        if (!isValid) return alert('모든 필드를 입력해야 합니다.');

        if (isNew) {
            if (type === 'group') {
                if (db.그룹코드관리.some(g => g.그룹코드 === newValues.그룹코드)) return alert('이미 존재하는 그룹코드입니다.');
                db.그룹코드관리.push(newValues);
            } else { // type === 'code'
                if (db.코드관리.some(c => c.그룹코드 === selectedGroupCode && c.코드명 === newValues.코드명)) return alert('이미 존재하는 코드명입니다.');
                const group = db.그룹코드관리.find(g => g.그룹코드 === selectedGroupCode);
                newValues.그룹코드 = selectedGroupCode;
                newValues.그룹디스플레이순서 = group ? group.디스플레이순서 : '';
                db.코드관리.push(newValues);
            }
            alert('새 항목이 추가되었습니다.');
        } else { // Editing
            const keyName = type === 'group' ? '그룹코드' : '코드명';
            const key = $row.find(`input[name="${keyName}"]`).val();
            const item = dataArray.find(d => d[keyName] == key && (type === 'code' ? d.그룹코드 === selectedGroupCode : true));
            if (item) {
                headers.forEach(h => item[h] = newValues[h]);
                alert('항목이 수정되었습니다.');
            } else {
                alert('항목을 찾을 수 없습니다.');
            }
        }
        renderFn();
    });

    container.on('click', `.cancel-row-btn[data-type="${type}"]`, renderFn);
}

// Development mode loader
if (!window.parent || !window.parent.initializePage) {
    console.log("Development mode: Loading CSV directly.");
    async function loadDevData() {
        try {
            const response = await fetch('시스템관리.CSV');
            const csvText = await response.text();
            const tempDb = {};
            // Simple parser for dev
            let currentTableName = null, headers = [];
            const lines = csvText.split(/\r\n|\n/).map(line => line.trim());
            for (const line of lines) {
                if (!line.trim()) { currentTableName = null; headers = []; continue; }
                const columns = line.split(',').map(c => c.replace(/"/g, '').trim());
                if (columns.length > 1 && columns.slice(1).every(c => c === '')) {
                    currentTableName = columns[0];
                    tempDb[currentTableName] = [];
                    headers = [];
                    continue;
                }
                if (currentTableName) {
                    if (headers.length === 0) {
                        headers = columns.filter(h => h);
                    } else {
                        const record = {};
                        headers.forEach((h, i) => { if (columns[i]) record[h] = columns[i]; });
                        if (Object.keys(record).length > 0) tempDb[currentTableName].push(record);
                    }
                }
            }
            initializePage(tempDb);
        } catch (e) {
            console.error("Dev data load failed", e);
        }
    }
    $(document).ready(loadDevData);
}
