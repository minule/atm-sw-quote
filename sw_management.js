// 전역 db 객체
let db = {};

// 부모 창에서 호출할 초기화 함수
window.initializePage = function(db_from_parent) {
    console.log("sw_management.js 초기화됨");
    $(document).ready(function() {
        loadAndParseCSV();
    });
};

// CSV 데이터 로드 및 파싱
async function loadAndParseCSV() {
    try {
        const response = await fetch('SW관리.csv');
        const csvText = await response.text();

        parseCSV(csvText);
        initializeUI();
        initializeEventHandlers();
    } catch (error) {
        console.error("데이터 로딩 또는 파싱 실패:", error);
        $('#code-filters-container').html('<div class="placeholder">데이터 로딩에 실패했습니다. 파일을 확인해주세요.</div>');
    }
}

function parseCSV(csvText) {
    function parseCsvLine(row) {
        const quoted = /"[^"]+"/g;
        const COMMA_REPLACEMENT = '##COMMA##';
        const tempRow = row.replace(quoted, (match) => match.replace(/,/g, COMMA_REPLACEMENT));
        const columns = tempRow.split(',');
        return columns.map((col) => col.replace(/"/g, '').replace(new RegExp(COMMA_REPLACEMENT, 'g'), ',').trim());
    }

    let currentTableName = null, headers = [];
    const lines = csvText.split(/\r\n|\n/).map(line => line.trim());
    
    for (const line of lines) {
        if (!line.trim()) { currentTableName = null; headers = []; continue; }
        
        const columns = parseCsvLine(line);
        const potentialTableName = columns[0];
        const isTableDefinition = columns.length > 1 && columns.slice(1).every(c => c === '');

        if (isTableDefinition) {
            currentTableName = potentialTableName;
            db[currentTableName] = [];
            headers = [];
            continue;
        }

        if (currentTableName) {
            if (headers.length === 0) {
                headers = columns.filter(h => h);
            } else {
                const record = {};
                headers.forEach((h, i) => { if (columns[i]) record[h] = columns[i]; });
                if (Object.keys(record).length > 0) db[currentTableName].push(record);
            }
        }
    }
    console.log("SW관리 DB 파싱 완료:", db);
}

// UI 초기화
function initializeUI() {
    renderFilters();
    renderModalForm(); // 모달 폼 필드 생성 호출
}

// 모달 폼 필드 렌더링
function renderModalForm() {
    const formGrid = $('#add-new-form .form-grid');
    formGrid.empty();

    const fields = {
        '공급업체명': { label: 'Supplier', type: 'select', options: [...new Set(db.공급업체.map(i => i.공급업체명))] },
        '운영 SW': { label: 'Operating System', type: 'select', options: db.코드관리.filter(i => i.그룹코드 === '운영 SW').map(i => i.코드명) },
        '메시지 프로토콜': { label: 'Message Protocol', type: 'select', options: db.코드관리.filter(i => i.그룹코드 === '메시지 프로토콜').map(i => i.코드명) },
        '호스트/서버 SW': { label: 'Host/Server SW', type: 'select', options: db.코드관리.filter(i => i.그룹코드 === '호스트/서버 SW').map(i => i.코드명) },
        '네트워크 중앙 HW': { label: 'Network Central HW', type: 'select', options: db.코드관리.filter(i => i.그룹코드 === '네트워크 중앙 HW').map(i => i.코드명) },
        '관리/모니터링 SW': { label: 'Management/Monitoring SW', type: 'select', options: db.코드관리.filter(i => i.그룹코드 === '관리/모니터링 SW').map(i => i.코드명) },
        '원격 SW 배포': { label: 'Remote Software Distribution', type: 'select', options: db.코드관리.filter(i => i.그룹코드 === '원격 SW 배포').map(i => i.코드명) },
        '현금 예측/관리 SW': { label: 'Cash Forecasting/Management SW', type: 'select', options: db.코드관리.filter(i => i.그룹코드 === '현금 예측/관리 SW').map(i => i.코드명) },
        'CRM/광고/마케팅 SW': { label: 'CRM/Advertising/Marketing SW', type: 'select', options: db.코드관리.filter(i => i.그룹코드 === 'CRM/광고/마케팅 SW').map(i => i.코드명) },
        '전용 ATM 보안 SW': { label: 'Dedicated ATM Security SW', type: 'select', options: db.코드관리.filter(i => i.그룹코드 === '전용 ATM 보안 SW').map(i => i.코드명) },
        '응용 SW': { label: 'Application SW', type: 'select', options: db.코드관리.filter(i => i.그룹코드 === '응용 SW').map(i => i.코드명) },
        '국가': { label: '국가', type: 'select', options: [...new Set(db.고객정보.map(i => i.국가))] },
        '고객': { label: '고객', type: 'select', options: [...new Set(db.고객정보.map(i => i.고객))] },
		'납품대수': { label: '납품대수', type: 'text', value: '1' }
    };

    for (const key in fields) {
        const field = fields[key];
        let fieldHtml = '<div class="filter-group">';
        fieldHtml += `<label for="form-${key}">${field.label}</label>`;
        if (field.type === 'select') {
            fieldHtml += `<select id="form-${key}" name="${key}"><option value="">선택</option>`;
            field.options.forEach(opt => fieldHtml += `<option value="${opt}">${opt}</option>`);
            fieldHtml += '</select>';
        } else {
            fieldHtml += `<input type="text" id="form-${key}" name="${key}">`;
        }
        fieldHtml += '</div>';
        formGrid.append(fieldHtml);
    }
}

// 필터 렌더링
function renderFilters() {
    const codeFilterContainer = $('#code-filters-container');
    const customerFilterContainer = $('#customer-filters-container');
    codeFilterContainer.empty();
    customerFilterContainer.empty();

    // 1. 코드관리 그룹별 필터 추가 (2열 5행)
    const codeGroups = [...new Set(db.코드관리.map(item => item.그룹코드))].slice(0, 10);
    codeGroups.forEach(group => {
        const items = db.코드관리.filter(item => item.그룹코드 === group);
        let groupFilter = `<div class="filter-group"><label for="filter-${group}">${group}</label><select id="filter-${group}" data-group="${group}"><option value="">전체</option>`;
        items.forEach(item => groupFilter += `<option value="${item.코드명}">${item.코드명}</option>`);
        groupFilter += '</select></div>';
        codeFilterContainer.append(groupFilter);
    });

    // 2. 국가 및 고객 필터 추가
    const countries = [...new Set(db.고객정보.map(item => item.국가))].sort();
    const customers = [...new Set(db.고객정보.map(item => item.고객))].sort();
    
    let countryFilter = '<div class="filter-group"><label for="country-filter">국가</label><select id="country-filter"><option value="">전체</option>';
    countries.forEach(c => countryFilter += `<option value="${c}">${c}</option>`);
    countryFilter += '</select></div>';
    customerFilterContainer.append(countryFilter);

    let customerFilter = '<div class="filter-group"><label for="customer-filter">고객</label><select id="customer-filter"><option value="">전체</option>';
    customers.forEach(c => customerFilter += `<option value="${c}">${c}</option>`);
    customerFilter += '</select></div>';
    customerFilterContainer.append(customerFilter);
}

// 테이블 렌더링
function renderTable() {

    const tableContainer = $('#table-container');
    tableContainer.empty();

    // 1. 필터 값 가져오기
    const selectedCountry = $('#country-filter').val();
    const selectedCustomer = $('#customer-filter').val();
    const selectedCodes = {};
    $('#code-filters-container select[data-group]').each(function() {
        const group = $(this).data('group');
        const value = $(this).val();
        if (value) {
            selectedCodes[group] = value;
        }
    });
        // 2. 필터링된 공급업체 상세 정보
    const filteredDetails = db['공급업체 상세'].filter(detail => { // 지역 변수로 다시 변경
        let countryMatch = !selectedCountry || detail.국가 === selectedCountry;
        let customerMatch = !selectedCustomer || detail.고객 === selectedCustomer;
        let codeMatch = Object.keys(selectedCodes).every(group => {
            return detail[group] === selectedCodes[group];
        });
        return countryMatch && customerMatch && codeMatch;
    });

    if (filteredDetails.length === 0) {
        tableContainer.html('<div class="placeholder">검색 결과가 없습니다.</div>');
        return;
    }

    // 3. 테이블 데이터 구조 생성
    const suppliers = [...new Set(filteredDetails.map(item => item.공급업체명))].sort();
    const codeGroups = db.코드관리.sort((a, b) => a.그룹디스플레이순서 - b.코드디스플레이순서).map(item => item.그룹코드);
    const uniqueCodeGroups = [...new Set(codeGroups)];

    let table = '<table><thead>';
    
    // Header Row 1: Supplier Names
    table += '<tr><th>Supplier</th>';
    suppliers.forEach(s => table += `<th>${s}</th>`);
    table += '</tr></thead><tbody>';

    // Header Row 2: Supplier Counts
    table += '<tr><td>납품대수</td>';
    suppliers.forEach(supplier => {
        const sum = filteredDetails
            .filter(d => d.공급업체명 === supplier)
            .reduce((acc, d) => acc + (parseInt(d.납품대수, 10) || 0), 0);
        table += `<td>${sum}</td>`;
    });
    table += '</tr>';

    // Table Body
	let uniqueItems = [];
    uniqueCodeGroups.forEach(group => {
        table += `<tr><td>${group}</td>`;
		let item = [];
        suppliers.forEach(supplier => {
            const items = filteredDetails
                .filter(d => d.공급업체명 === supplier && d[group])
                .map(d => d[group]);
            // 중복 제거 및 콤마로 병합
            uniqueItems = [...new Set(items)];
			item.push(uniqueItems);
        });
		const uniqueItem = Array.from(
			new Map(
				item.map(i => [JSON.stringify(i), i])
			  ).values()
			);
		console.log(uniqueItem);
		table += `<td colspan='4'>${uniqueItem}</td>`;
        table += '</tr>';
    });

    table += '</tbody></table>';
    tableContainer.html(table);
}

// 이벤트 핸들러 초기화
function initializeEventHandlers() {
    $('#search-btn').on('click', renderTable);
    $('#reset-btn').on('click', () => {
        renderFilters(); // 필터 초기화
        $('#table-container').html('<div class="placeholder">검색 조건을 선택하고 검색 버튼을 눌러주세요.</div>');
    });

    // Modal-related event handlers
    const addNewModal = $('#add-new-modal');
    const excelModal = $('#excel-upload-modal');

    $('#add-new-btn').on('click', () => addNewModal.css('display', 'flex'));
    $('#excel-upload-btn').on('click', () => excelModal.css('display', 'flex'));

    $('#cancel-btn').on('click', () => addNewModal.hide());
    $('#cancel-upload-btn').on('click', () => excelModal.hide());

    addNewModal.on('click', function(e) {
        if ($(e.target).is(addNewModal)) {
            addNewModal.hide();
        }
    });

    excelModal.on('click', function(e) {
        if ($(e.target).is(excelModal)) {
            excelModal.hide();
        }
    });

    $('#add-new-form').on('submit', function(e) {
        e.preventDefault();
        const formData = $(this).serializeArray();
        const newRecord = {};
        formData.forEach(item => {
            if (item.value) { // 값이 있는 필드만 추가
                newRecord[item.name] = item.value;
            }
        });

        if (!newRecord['공급업체명'] || !newRecord['국가'] || !newRecord['고객']) {
            alert('공급업체, 국가, 고객은 필수 항목입니다.');
            return;
        }

        db['공급업체 상세'].push(newRecord);
        alert('새로운 정보가 현재 세션에 등록되었습니다. 파일에는 저장되지 않습니다.');
        addNewModal.hide();
        renderTable(); // 테이블 새로고침
    });

    $('#upload-btn').on('click', function() {
        const fileInput = document.getElementById('csv-file-input');
        if (fileInput.files.length === 0) {
            alert('파일을 선택해주세요.');
            return;
        }
        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = function(e) {
            const text = e.target.result;
            const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) {
                alert('데이터가 없습니다. (헤더 포함 최소 2줄 필요)');
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim());
            // 필요한 컬럼명과 DB의 그룹코드 매핑
            const columnMapping = {
                '공급업체': '공급업체명',
                '운영체제': '운영 SW',
                '메시지 프로토콜': '메시지 프로토콜',
                '호스트/서버 SW': '호스트/서버 SW',
                '네트워크 중앙 HW': '네트워크 중앙 HW',
                '관리/모니터링 SW': '관리/모니터링 SW',
                '원격 SW 배포': '원격 SW 배포',
                '현금 예측/관리 SW': '현금 예측/관리 SW',
                'CRM/광고/마케팅 SW': 'CRM/광고/마케팅 SW',
                '전용 ATM 보안 SW': '전용 ATM 보안 SW',
                '응용 SW': '응용 SW',
				'국가': '국가',
				'고객': '고객',
                'ATM 대수': 'atm_count'
            };

            let addedCount = 0;
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                const record = {};
                let atmCount = 1;
                headers.forEach((header, index) => {
                    const dbKey = columnMapping[header];
                    if (dbKey) {
                        if (dbKey === 'atm_count') {
                            atmCount = parseInt(values[index], 10) || 1;
                        } else {
                            record[dbKey] = values[index];
                        }
                    }
                });

                // ATM 대수만큼 데이터 추가
                for (let j = 0; j < atmCount; j++) {
                    db['공급업체 상세'].push(JSON.parse(JSON.stringify(record)));
                    addedCount++;
                }
            }
            alert(`${addedCount}개의 데이터가 현재 세션에 추가되었습니다.`);
            excelModal.hide();
            renderTable();
        };

        reader.readAsText(file, 'euc-kr'); // 한글 인코딩 처리
    });
}

// 페이지가 로드될 때 직접 호출
if (!window.opener) { // iframe 외부에서 단독으로 열렸을 경우
    initializePage();
}