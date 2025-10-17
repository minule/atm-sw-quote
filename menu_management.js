let db = {};
let selectedParentMenu = null;

const SUB_MENU_HEADERS = ['메뉴명', '디스플레이순서'];

window.initializePage = function(db_from_parent) {
    db = db_from_parent;
    $(document).ready(function() {
        if (db && db['메뉴관리']) {
            renderParentMenuList();
            initializeEventListeners();
        } else {
            $('#parent-menu-list').html('<div class="placeholder">데이터 로딩 실패.</div>');
        }
    });
};

function getParentMenus() {
    return [...new Set(db.메뉴관리.map(item => item.상위메뉴명))].sort();
}

function renderParentMenuList() {
    const container = $('#parent-menu-list');
    container.empty();
    const parentMenus = getParentMenus();

    parentMenus.forEach(parentMenu => {
        const isSelected = parentMenu === selectedParentMenu ? 'selected' : '';
        const listItem = `
            <div class="list-item ${isSelected}" data-parent-menu="${parentMenu}">
                <span>${parentMenu}</span>
                <div class="item-actions">
                    <button class="edit-parent-btn">수정</button>
                    <button class="delete-parent-btn">삭제</button>
                </div>
            </div>`;
        container.append(listItem);
    });
}

function renderSubMenuTable(parentMenu) {
    selectedParentMenu = parentMenu;
    $('#add-sub-menu-btn').prop('disabled', !parentMenu);

    const container = $('#sub-menu-table-container');
    container.empty();

    if (!parentMenu) {
        container.html('<div class="placeholder">상위 메뉴를 선택하세요.</div>');
        return;
    }

    const filteredSubMenus = db.메뉴관리.filter(m => m.상위메뉴명 === parentMenu);
    filteredSubMenus.sort((a, b) => (a.디스플레이순서 || 999) - (b.디스플레이순서 || 999));

    let table = '<table><thead><tr>';
    SUB_MENU_HEADERS.forEach(h => table += `<th>${h}</th>`);
    table += '<th>동작</th></tr></thead><tbody>';

    if (filteredSubMenus.length > 0) {
        filteredSubMenus.forEach(item => {
            table += `<tr data-sub-menu-name="${item.메뉴명}">`;
            SUB_MENU_HEADERS.forEach(h => table += `<td>${item[h] || ''}</td>`);
            table += `<td class="item-actions">
                    <button class="edit-sub-menu-btn">수정</button>
                    <button class="delete-sub-menu-btn">삭제</button>
                </td>`;
            table += '</tr>';
        });
    } else {
        table += '<tr><td colspan="3" class="placeholder">하위 메뉴가 없습니다.</td></tr>';
    }

    table += '</tbody></table>';
    container.html(table);
    renderParentMenuList(); // Re-render to show selection
}

function initializeEventListeners() {
    $('#parent-menu-list').on('click', '.list-item', function(e) {
        if ($(e.target).is('button, input')) return;
        const parentMenu = $(this).data('parent-menu');
        renderSubMenuTable(parentMenu);
    });

    $('#save-btn').on('click', function() {
        if (window.parent && window.parent.handleSystemSave) {
            window.parent.handleSystemSave(db);
        } else {
            alert('저장 기능이 연동되지 않았습니다.');
        }
    });

    // Add buttons
    $('#add-parent-btn').on('click', handleAddParentMenu);
    $('#add-sub-menu-btn').on('click', handleAddSubMenu);
    
    // More event listeners for CRUD would go here
}

function handleAddParentMenu() {
    const newParentName = prompt("새로운 상위 메뉴명을 입력하세요:");
    if (newParentName && newParentName.trim() !== '') {
        if (getParentMenus().includes(newParentName)) {
            return alert('이미 존재하는 상위 메뉴명입니다.');
        }
        // Add a dummy sub-menu to make the parent menu appear
        db.메뉴관리.push({
            상위메뉴명: newParentName,
            메뉴명: '임시 하위 메뉴',
            디스플레이순서: '1'
        });
        alert(`상위 메뉴 '${newParentName}'이 추가되었습니다. 첫 하위 메뉴를 추가하고 '임시 하위 메뉴'는 삭제해주세요.`);
        renderParentMenuList();
    }
}

function handleAddSubMenu() {
    if (!selectedParentMenu) return alert('먼저 상위 메뉴를 선택하세요.');
    const newSubMenuName = prompt("새로운 하위 메뉴명을 입력하세요:");
    const newDisplayOrder = prompt("디스플레이 순서를 입력하세요:", "1");
    if (newSubMenuName && newSubMenuName.trim() !== '' && newDisplayOrder) {
        db.메뉴관리.push({
            상위메뉴명: selectedParentMenu,
            메뉴명: newSubMenuName,
            디스플레이순서: newDisplayOrder
        });
        renderSubMenuTable(selectedParentMenu);
    }
}

// Simplified CRUD for brevity. A full implementation would use inline editing like in common_code_management.
$('#parent-menu-list').on('click', '.delete-parent-btn', function(e) {
    e.stopPropagation();
    const parentMenu = $(this).closest('.list-item').data('parent-menu');
    if (confirm(`'${parentMenu}' 상위 메뉴와 모든 하위 메뉴를 삭제하시겠습니까?`)) {
        db.메뉴관리 = db.메뉴관리.filter(m => m.상위메뉴명 !== parentMenu);
        selectedParentMenu = null;
        renderParentMenuList();
        renderSubMenuTable(null);
    }
});

$('#sub-menu-table-container').on('click', '.delete-sub-menu-btn', function(e) {
    const subMenuName = $(this).closest('tr').data('sub-menu-name');
    if (confirm(`'${subMenuName}' 하위 메뉴를 삭제하시겠습니까?`)) {
        const itemIndex = db.메뉴관리.findIndex(m => m.상위메뉴명 === selectedParentMenu && m.메뉴명 === subMenuName);
        if (itemIndex > -1) {
            db.메뉴관리.splice(itemIndex, 1);
            renderSubMenuTable(selectedParentMenu);
        }
    }
});

// Dev-mode loader
if (!window.parent || !window.parent.initializePage) {
    console.log("Development mode: Loading CSV directly.");
    async function loadDevData() {
        try {
            const response = await fetch('시스템관리.CSV');
            const csvText = await response.text();
            const tempDb = {};
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
