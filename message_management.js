let db = {};
const HEADERS = ['메세지코드','한국어', '영어','구분'];

window.initializePage = function(db_from_parent) {
    db = db_from_parent;
    $(document).ready(function() {
        // If the table doesn't exist in the loaded db, create it.
        if (!db['다국어관리']) {
            db['다국어관리'] = [];
            console.log('다국어관리 table initialized.');
        }
        renderMessageTable();
        initializeEventListeners();
    });
};

function renderMessageTable() {
    const container = $('#message-table-container');
    let table = '<table><thead><tr>';
    HEADERS.forEach(h => table += `<th>${h}</th>`);
    table += '<th>동작</th></tr></thead><tbody>';

    if (db.다국어관리.length === 0) {
        table += '<tr><td colspan="5" class="placeholder">메시지가 없습니다. \'추가\' 버튼으로 새 메시지를 등록하세요.</td></tr>';
    } else {
        db.다국어관리.forEach(item => {
            table += `<tr data-message-code="${item.메세지코드}">`;
            HEADERS.forEach(h => table += `<td>${item[h] || ''}</td>`);
            table += `
                <td class="item-actions">
                    <button class="edit-btn">수정</button>
                    <button class="delete-btn">삭제</button>
                </td>`;
            table += '</tr>';
        });
    }

    table += '</tbody></table>';
    container.html(table);
}

function createEditRow(item, isNew = false) {
    let row = `<tr class="edit-item-row" data-is-new="${isNew}">`;
    HEADERS.forEach(h => {
        const value = item[h] || '';
        const isDisabled = !isNew && h === '메세지코드' ? 'disabled' : '';
        row += `<td><input type="text" name="${h}" value="${value}" ${isDisabled}></td>`;
    });
    row += `
        <td class="item-actions">
            <button class="save-row-btn">저장</button>
            <button class="cancel-row-btn">취소</button>
        </td>`;
    row += '</tr>';
    return row;
}

function initializeEventListeners() {
    $('#add-message-btn').on('click', function() {
        if ($('#message-table-container .edit-item-row').length > 0) return alert('편집 중인 항목을 먼저 저장하세요.');
        const newRowHtml = createEditRow({}, true);
        const tableBody = $('#message-table-container tbody');
        if(db.다국어관리.length === 0) tableBody.empty();
        tableBody.prepend(newRowHtml);
    });

    $('#save-btn').on('click', function() {
        if (window.parent && window.parent.handleSystemSave) {
            window.parent.handleSystemSave(db);
        } else {
            alert('저장 기능이 연동되지 않았습니다.');
        }
    });

    const container = $('#message-table-container');

    container.on('click', '.edit-btn', function() {
        if ($(container).find('.edit-item-row').length > 0) return alert('편집 중인 항목을 먼저 저장하세요.');
        const $row = $(this).closest('tr');
        const messageCode = $row.data('message-code');
        const item = db.다국어관리.find(m => m.메세지코드 === messageCode);
        const editRowHtml = createEditRow(item, false);
        $row.replaceWith(editRowHtml);
    });

    container.on('click', '.delete-btn', function() {
        const messageCode = $(this).closest('tr').data('message-code');
        if (confirm(`'${messageCode}' 메시지를 정말 삭제하시겠습니까?`)) {
            const itemIndex = db.다국어관리.findIndex(m => m.메세지코드 === messageCode);
            if (itemIndex > -1) {
                db.다국어관리.splice(itemIndex, 1);
                alert('삭제되었습니다.');
                renderMessageTable();
            }
        }
    });

    container.on('click', '.save-row-btn', function() {
        const $row = $(this).closest('tr');
        const isNew = $row.data('is-new') === true;
        const newValues = {};
        let isValid = true;
        $row.find('input').each(function() {
            const name = $(this).attr('name');
            newValues[name] = $(this).val();
            if (name === '메세지코드' && !newValues[name]) isValid = false;
        });

        if (!isValid) return alert('메세지코드는 필수 항목입니다.');

        if (isNew) {
            if (db.다국어관리.some(m => m.메세지코드 === newValues.메세지코드)) {
                return alert('이미 존재하는 다국어코드입니다.');
            }
            db.다국어관리.push(newValues);
            alert('새 메시지가 추가되었습니다.');
        } else {
            const messageCode = newValues.메세지코드;
            const itemIndex = db.다국어관리.findIndex(m => m.메세지코드 === messageCode);
            if (itemIndex > -1) {
                db.다국어관리[itemIndex] = newValues;
                alert('메시지가 수정되었습니다.');
            } else {
                alert('항목을 찾을 수 없습니다.');
            }
        }
        renderMessageTable();
    });

    container.on('click', '.cancel-row-btn', renderMessageTable);
    $('#import-excel-btn').on('click', handleExcelImport);
}

function handleExcelImport() {
    const input = document.getElementById('excel-file-input');
    if (!input.files || input.files.length === 0) {
        return alert("먼저 엑셀 파일을 선택해주세요.");
    }
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            if (jsonData.length === 0) return alert("엑셀 파일에 데이터가 없습니다.");

            const excelHeaders = Object.keys(jsonData[0]).map(h => h.trim());
            const missingHeaders = HEADERS.filter(h => !excelHeaders.includes(h));
            if (missingHeaders.length > 0) {
                return alert(`엑셀 파일의 헤더가 올바르지 않습니다. 다음 열이 필요합니다: ${missingHeaders.join(', ')}`);
            }

            const messageMap = new Map(db.다국어관리.map(m => [m.메세지코드, m]));
            let addedCount = 0;
            let updatedCount = 0;

            jsonData.forEach(row => {
                const messageCode = row.메세지코드;
                if (!messageCode) return; // Skip rows without a message code

                const newEntry = {};
                HEADERS.forEach(h => newEntry[h] = row[h] || '');

                if (messageMap.has(messageCode)) {
                    // Update existing
                    const existingEntry = messageMap.get(messageCode);
                    Object.assign(existingEntry, newEntry);
                    updatedCount++;
                } else {
                    // Add new
                    db.다국어메세지.push(newEntry);
                    addedCount++;
                }
            });

            alert(`가져오기 완료. 추가: ${addedCount} 건, 업데이트: ${updatedCount} 건`);
            renderMessageTable();
            input.value = ''; // Reset file input

        } catch (error) {
            console.error("엑셀 파일 처리 중 오류 발생:", error);
            alert("엑셀 파일을 처리하는 중 오류가 발생했습니다. 파일 형식이 올바른지 확인해주세요.");
        }
    };

    reader.onerror = function() {
        alert("파일을 읽는 중 오류가 발생했습니다.");
    };

    reader.readAsArrayBuffer(file);
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
