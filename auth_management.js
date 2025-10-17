let db = {};
let selectedRoleCode = null;

window.initializePage = function(db_from_parent) {
    db = db_from_parent;
    $(document).ready(function() {
        // Initialize data tables if they don't exist
        if (!db['권한목록']) db['권한목록'] = [];
        if (!db['권한별메뉴']) db['권한별메뉴'] = [];
        if (!db['메뉴관리']) db['메뉴관리'] = [];

        renderRoleList();
        renderMenuTree();
        initializeEventListeners();
    });
};

function renderRoleList() {
    const container = $('#role-list-container');
    container.empty();
    if (db.권한목록.length === 0) {
        container.html('<div class="placeholder">권한이 없습니다.</div>');
        return;
    }
    db.권한목록.forEach(role => {
        const isSelected = role.권한코드 === selectedRoleCode ? 'selected' : '';
        const listItem = `
            <div class="list-item ${isSelected}" data-role-code="${role.권한코드}">
                <span>${role.권한명} (${role.권한코드})</span>
                <div class="item-actions">
                    <button class="delete-role-btn">삭제</button>
                </div>
            </div>`;
        container.append(listItem);
    });
}

function renderMenuTree() {
    const container = $('#menu-tree-container');
    container.empty();
    const parentMenus = [...new Set(db.메뉴관리.map(item => item.상위메뉴명))].sort();

    if (parentMenus.length === 0) {
        container.html('<div class="placeholder">메뉴가 없습니다.</div>');
        return;
    }

    parentMenus.forEach(parentMenu => {
        const group = $(`<div class="menu-group"></div>`);
        const parentCheckbox = `
            <div class="parent-menu">
                <label>
                    <input type="checkbox" class="menu-checkbox parent-checkbox" data-menu-name="${parentMenu}">
                    <strong>${parentMenu}</strong>
                </label>
            </div>`;
        group.append(parentCheckbox);

        const subMenuList = $('<ul class="sub-menu-list"></ul>');
        const subMenus = db.메뉴관리.filter(m => m.상위메뉴명 === parentMenu).sort((a, b) => a.디스플레이순서 - b.디스플레이순서);
        
        subMenus.forEach(subMenu => {
            const subMenuItem = `
                <li>
                    <label>
                        <input type="checkbox" class="menu-checkbox sub-menu-checkbox" data-menu-name="${subMenu.메뉴명}" data-parent-name="${parentMenu}">
                        ${subMenu.메뉴명}
                    </label>
                </li>`;
            subMenuList.append(subMenuItem);
        });

        group.append(subMenuList);
        container.append(group);
    });
}

function loadPermissionsForRole(roleCode) {
    selectedRoleCode = roleCode;
    $('#save-perms-btn').prop('disabled', !roleCode);
    $('#menu-tree-container .placeholder').remove();

    // Uncheck all boxes first
    $('.menu-checkbox').prop('checked', false);

    if (!roleCode) {
        renderRoleList();
        return;
    }

    const permittedMenus = db.권한별메뉴
        .filter(p => p.권한코드 === roleCode)
        .map(p => p.메뉴명);

    permittedMenus.forEach(menuName => {
        $(`.menu-checkbox[data-menu-name="${menuName}"]`).prop('checked', true);
    });

    // Handle parent checkbox state
    $('.parent-checkbox').each(function() {
        const parentName = $(this).data('menu-name');
        const $subCheckboxes = $(`.sub-menu-checkbox[data-parent-name="${parentName}"]`);
        const allChecked = $subCheckboxes.length > 0 && $subCheckboxes.not(':checked').length === 0;
        $(this).prop('checked', allChecked);
    });

    renderRoleList(); // Re-render to show selection
}

function savePermissionsForRole(roleCode) {
    if (!roleCode) return alert('먼저 권한을 선택하세요.');

    // Remove all old permissions for this role
    db.권한별메뉴 = db.권한별메뉴.filter(p => p.권한코드 !== roleCode);

    // Add new permissions based on checked boxes
    $('.sub-menu-checkbox:checked').each(function() {
        db.권한별메뉴.push({
            권한코드: roleCode,
            메뉴명: $(this).data('menu-name')
        });
    });

    alert(`'${roleCode}'에 대한 권한이 메모리에 저장되었습니다. 최종 저장을 위해 하단의 CSV 저장 버튼을 눌러주세요.`);
}

function initializeEventListeners() {
    $('#role-list-container').on('click', '.list-item', function(e) {
        if ($(e.target).is('button')) return;
        const roleCode = $(this).data('role-code');
        loadPermissionsForRole(roleCode);
    });

    $('#add-role-btn').on('click', function() {
        const roleCode = prompt("새 권한코드를 입력하세요 (예: ADMIN, USER):");
        const roleName = prompt("새 권한명을 입력하세요 (예: 관리자, 일반사용자):");
        if (roleCode && roleName) {
            if (db.권한목록.some(r => r.권한코드 === roleCode)) {
                return alert('이미 존재하는 권한코드입니다.');
            }
            db.권한목록.push({ 권한코드: roleCode, 권한명: roleName });
            renderRoleList();
        }
    });

    $('#role-list-container').on('click', '.delete-role-btn', function(e) {
        e.stopPropagation();
        const roleCode = $(this).closest('.list-item').data('role-code');
        if (confirm(`'${roleCode}' 권한을 정말 삭제하시겠습니까?\n이 권한에 연결된 모든 메뉴 권한도 삭제됩니다.`)) {
            db.권한목록 = db.권한목록.filter(r => r.권한코드 !== roleCode);
            db.권한별메뉴 = db.권한별메뉴.filter(p => p.권한코드 !== roleCode);
            selectedRoleCode = null;
            renderRoleList();
            loadPermissionsForRole(null);
        }
    });

    $('#save-perms-btn').on('click', () => savePermissionsForRole(selectedRoleCode));
    $('#save-csv-btn').on('click', () => {
        if (window.parent && window.parent.handleSystemSave) {
            window.parent.handleSystemSave(db);
        } else {
            alert('저장 기능이 연동되지 않았습니다.');
        }
    });

    // Checkbox logic: parent checks/unchecks all children
    $('#menu-tree-container').on('change', '.parent-checkbox', function() {
        const parentName = $(this).data('menu-name');
        const isChecked = $(this).prop('checked');
        $(`.sub-menu-checkbox[data-parent-name="${parentName}"]`).prop('checked', isChecked);
    });

    // Checkbox logic: if all children are checked, parent becomes checked
    $('#menu-tree-container').on('change', '.sub-menu-checkbox', function() {
        const parentName = $(this).data('parent-name');
        const $subCheckboxes = $(`.sub-menu-checkbox[data-parent-name="${parentName}"]`);
        const allChecked = $subCheckboxes.length > 0 && $subCheckboxes.not(':checked').length === 0;
        $(`.parent-checkbox[data-menu-name="${parentName}"]`).prop('checked', allChecked);
    });
}

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
