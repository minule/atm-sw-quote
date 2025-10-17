let db = {};
const HEADERS = [
    '공급업체명', '운영 SW', '메시지 프로토콜', '호스트/서버 SW', '네트워크 중앙 HW', 
    '관리/모니터링 SW', '원격 SW 배포', '현금 예측/관리 SW', 'CRM/광고/마케팅 SW', 
    '전용 ATM 보안 SW', '응용 SW', '국가', '고객', '납품대수'
];

window.initializePage = function(db_from_parent) {
    db = db_from_parent;
    $(document).ready(function() {
        if (db && db['공급업체 상세']) {
            renderFilters();
            initializeEventHandlers();
            renderSwTable(); // 초기 전체 목록 표시
        } else {
            $('#sw-view-container').html('<div class="placeholder">데이터를 불러오지 못했습니다.</div>');
        }
    });
};

function renderFilters() {
    const filterContainer = $('#filters');
    filterContainer.empty();

    // 응용 SW 필터
    const appSwGroup = '응용 SW';
    const appSwItems = db.코드관리.filter(item => item.그룹코드 === appSwGroup);
    let appSwFilter = '<div class="filter-group"><label for="app-sw-filter">응용 SW</label><select id="app-sw-filter"><option value="">전체</option>';
    appSwItems.forEach(item => appSwFilter += `<option value="${item.코드명}">${item.코드명}</option>`);
    appSwFilter += '</select></div>';
    filterContainer.append(appSwFilter);

    // 국가 필터
    const countries = [...new Set(db.고객정보.map(item => item.국가))].sort();
    let countryFilter = '<div class="filter-group"><label for="country-filter">국가</label><select id="country-filter"><option value="">전체</option>';
    countries.forEach(c => countryFilter += `<option value="${c}">${c}</option>`);
    countryFilter += '</select></div>';
    filterContainer.append(countryFilter);
}

function initializeEventHandlers() {
    $('#search-btn').on('click', renderSwTable);
    $('#import-excel-btn').on('click', handleExcelImport);
}

function handleExcelImport() {
    const input = document.getElementById('excel-file-input');
    if (!input.files || input.files.length === 0) {
        alert("먼저 엑셀 파일을 선택해주세요.");
        return;
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

            if (jsonData.length === 0) {
                alert("엑셀 파일에 데이터가 없습니다.");
                return;
            }

            const excelHeaders = Object.keys(jsonData[0]).map(h => h.trim());
            const missingHeaders = HEADERS.filter(h => !excelHeaders.includes(h));

            if (missingHeaders.length > 0) {
                alert(`엑셀 파일의 헤더가 올바르지 않습니다. 다음 열이 필요합니다: ${missingHeaders.join(', ')}`);
                return;
            }

            const originalExcelHeaders = Object.keys(jsonData[0]);

            const processedData = jsonData.map(row => {
                const newEntry = {};
                HEADERS.forEach(expectedHeader => {
                    const excelHeader = originalExcelHeaders.find(h => h.trim() === expectedHeader);
                    newEntry[expectedHeader] = row[excelHeader] || '';
                });
                return newEntry;
            });

            db['공급업체 상세'].push(...processedData);

            alert(`${processedData.length}개의 항목을 성공적으로 가져왔습니다.`);
            renderSwTable(); // Refresh the table
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

function renderSwTable() {
    const container = $('#sw-view-container');
    container.empty();

    const selectedSw = $('#app-sw-filter').val();
    const selectedCountry = $('#country-filter').val();
    const appSwGroup = '응용 SW';

    const filteredData = db['공급업체 상세'].filter(d => {
        const swMatch = !selectedSw || d[appSwGroup] === selectedSw;
        const countryMatch = !selectedCountry || d.국가 === selectedCountry;
        return swMatch && countryMatch;
    });

    if (filteredData.length === 0) {
        container.html('<div class="placeholder">해당 조건의 데이터가 없습니다.</div>');
        return;
    }

    let table = '<table><thead><tr>';
    HEADERS.forEach(h => table += `<th>${h}</th>`);
    table += '</tr></thead><tbody>';

    filteredData.forEach((item, index) => {
        table += `<tr>`;
        HEADERS.forEach(h => {
            table += `<td>${item[h] || ''}</td>`;
        });
        table += '</tr>';
    });

    table += '</tbody></table>';
    container.html(table);
}


// In case the page is loaded directly for development
if (!window.parent || !window.parent.initializePage) {
    console.log("Development mode: Loading CSV directly.");
    
    async function loadCSVForDevelopment() {
        try {
            const responses = await Promise.all([
                fetch('SW관리.csv'),
                fetch('사양견적관리.csv')
            ]);

            const tempDb = {};

            for (const response of responses) {
                if (!response.ok) {
                    throw new Error(`Network response was not ok ${response.statusText}`);
                }
                const csvText = await response.text();
                
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
                        if (!tempDb[currentTableName]) {
                            tempDb[currentTableName] = [];
                        }
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
            }
            
            initializePage(tempDb);

        } catch (error) {
            console.error("Dev mode CSV loading failed:", error);
            $('#sw-view-container').html('<div class="placeholder">Failed to load CSV for development.</div>');
        }
    }
    
    $(document).ready(function() {
        loadCSVForDevelopment();
    });
}