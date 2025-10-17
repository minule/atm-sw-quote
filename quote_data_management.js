let db;

// 1. 초기화 함수
window.initializePage = function(database) {
    db = database;
    if (!db || Object.keys(db).length === 0) {
        console.error("Database not loaded!");
        return;
    }

    // 초기 탭 렌더링
    renderBasicDataTab();
    setupPartCostTab();

    // 탭 전환 이벤트 리스너 설정
    setupTabListeners();
};

// 2. 탭 기능 설정
function setupTabListeners() {
    const tabs = document.querySelectorAll('.tab-link');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        });
    });
}

// ===================================================================
// 탭 1: 견적 기초 데이터 관리
// ===================================================================
function renderBasicDataTab() {
    renderProcessingCostTable();
    renderMarginRateTable();
    renderLogisticsCostTable();
    setupAddLogisticsCost();
}

function createAndAppendSaveButton(cell, onSave) {
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-save';
    saveBtn.textContent = '저장';
    saveBtn.addEventListener('click', onSave);
    cell.appendChild(saveBtn);
}

// 가공비 단가 렌더링
function renderProcessingCostTable() {
    const table = document.getElementById('processing-cost-table');
    table.innerHTML = '<thead><tr><th>구분</th><th>단가</th><th>작업</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');

    db.가공비단가.forEach(item => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${item.구분}</td>`;
        const valueCell = row.insertCell();
        valueCell.innerHTML = `<input type="number" value="${item.단가}">`;
        const actionCell = row.insertCell();

        createAndAppendSaveButton(actionCell, () => {
            const newValue = valueCell.querySelector('input').value;
            item.단가 = newValue;
            alert(`'${item.구분}'의 단가가 ${newValue}(으)로 현재 세션에서 업데이트되었습니다.`);
        });
    });
}

// 마진율 렌더링
function renderMarginRateTable() {
    const table = document.getElementById('margin-rate-table');
    table.innerHTML = '<thead><tr><th>구분</th><th>마진율 (%)</th><th>작업</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');

    db.마진율.forEach(item => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${item.구분}</td>`;
        const valueCell = row.insertCell();
        valueCell.innerHTML = `<input type="number" value="${item.마진율}">`;
        const actionCell = row.insertCell();

        createAndAppendSaveButton(actionCell, () => {
            const newValue = valueCell.querySelector('input').value;
            item.마진율 = newValue;
            alert(`'${item.구분}'의 마진율이 ${newValue}%(으)로 현재 세션에서 업데이트되었습니다.`);
        });
    });
}

// 물류비 렌더링
function renderLogisticsCostTable() {
    const table = document.getElementById('logistics-cost-table');
    table.innerHTML = '<thead><tr><th>국가코드</th><th>단가</th><th>작업</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');

    db.물류비.forEach(item => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${item.국가코드}</td>`;
        const valueCell = row.insertCell();
        valueCell.innerHTML = `<input type="number" value="${item.단가}">`;
        const actionCell = row.insertCell();

        createAndAppendSaveButton(actionCell, () => {
            const newValue = valueCell.querySelector('input').value;
            item.단가 = newValue;
            alert(`'${item.국가코드}'의 물류비가 ${newValue}(으)로 현재 세션에서 업데이트되었습니다.`);
        });
    });
}

// 신규 물류비 추가 설정
function setupAddLogisticsCost() {
    const countrySelect = document.getElementById('new-country-select');
    const costInput = document.getElementById('new-logistics-cost-input');
    const addBtn = document.getElementById('add-logistics-cost-btn');

    // 아직 물류비가 등록되지 않은 국가만 선택지에 추가
    const existingCountries = new Set(db.물류비.map(item => item.국가코드));
    countrySelect.innerHTML = '';
    db.국가.forEach(country => {
        if (!existingCountries.has(country.국가코드)) {
            countrySelect.add(new Option(country.국가코드, country.국가코드));
        }
    });

    addBtn.addEventListener('click', () => {
        const country = countrySelect.value;
        const cost = costInput.value;

        if (!country || !cost) {
            alert('국가를 선택하고 단가를 입력해주세요.');
            return;
        }

        db.물류비.push({ 국가코드: country, 단가: cost });
        alert(`'${country}'의 신규 물류비 ${cost}이(가) 현재 세션에 추가되었습니다.`);
        
        // 테이블 및 선택지 새로고침
        renderLogisticsCostTable();
        setupAddLogisticsCost(); 
        costInput.value = '';
    });
}


// ===================================================================
// 탭 2: 부품별 원가 상세 조회
// ===================================================================
function setupPartCostTab() {
    const searchInput = document.getElementById('part-search-input');
    // 자동완성 드롭다운을 위한 컨테이너 (필요 시)
    let dropdown = document.getElementById('autocomplete-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'autocomplete-dropdown';
        searchInput.parentNode.appendChild(dropdown);
    }

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        dropdown.innerHTML = '';
        if (query.length < 2) {
            dropdown.style.display = 'none';
            return;
        }

        const results = db.유닛품번리스트.filter(p => p.유닛품번코드.toLowerCase().includes(query)).slice(0, 10);
        
        if (results.length > 0) {
            results.forEach(part => {
                const item = document.createElement('div');
                item.textContent = part.유닛품번코드;
                item.addEventListener('click', () => {
                    searchInput.value = part.유닛품번코드;
                    dropdown.style.display = 'none';
                    renderPartCostDetails(part.유닛품번코드);
                });
                dropdown.appendChild(item);
            });
            dropdown.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target !== searchInput) {
            dropdown.style.display = 'none';
        }
    });
}

function renderPartCostDetails(partNumber) {
    const detailsContainer = document.getElementById('part-cost-details');

    // 부품 추가 정보 조회
    const partInfo = db.유닛품번리스트.find(p => p.유닛품번코드 === partNumber);
    const unitInfo = partInfo ? db.유닛.find(u => u.유닛코드 === partInfo.유닛코드) : null;
    const specText = db.unitFullSpecText ? (db.unitFullSpecText[partNumber] || '스펙 정보 없음') : '스펙 정보 없음';

    let infoHtml = '<div class="part-info-box">';
    if (unitInfo) {
        infoHtml += `<div><strong>유닛:</strong> ${unitInfo.유닛설명} (${unitInfo.유닛코드})</div>`;
    }
    infoHtml += `<div><strong>전체스펙:</strong> ${specText}</div>`;
    infoHtml += '</div>';

    // 원가 정보 조회
    const standardCost = db.유닛품번정상원가.find(c => c.유닛품번코드 === partNumber);
    const avgActualCost = db.avgActualCosts ? db.avgActualCosts[partNumber] : null;
    const monthlyActualCosts = db.유닛품번실적원가 
        ? db.유닛품번실적원가.filter(c => c.유닛품번코드 === partNumber)
                           .sort((a, b) => b.년월.localeCompare(a.년월))
                           .slice(0, 6)
        : [];

    let tableHtml = `<h4 class="cost-detail-title">'${partNumber}' 원가 정보</h4>
                     <table><thead><tr><th>구분</th><th>직접재료비</th><th>간접재료비</th><th>외주임가공공수</th><th>본사가공공수</th></tr></thead><tbody>`;

    // 정상원가 행
    if (standardCost) {
        tableHtml += `<tr>
            <td><strong>정상원가</strong></td>
            <td>${standardCost.직접재료비 || 0}</td>
            <td>${standardCost.간접재료비 || 0}</td>
            <td>${standardCost.외주임가공공수 || 0}</td>
            <td>${standardCost.본사가공공수 || 0}</td>
        </tr>`;
    } else {
        tableHtml += `<tr><td><strong>정상원가</strong></td><td colspan="4">데이터 없음</td></tr>`;
    }

    // 6개월 평균 실적원가 행 (소수점 2자리)
    if (avgActualCost) {
        tableHtml += `<tr>
            <td><strong>실적 (6개월 평균)</strong></td>
            <td>${(avgActualCost.직접재료비 || 0).toFixed(2)}</td>
            <td>${(avgActualCost.간접재료비 || 0).toFixed(2)}</td>
            <td>${(avgActualCost.외주임가공공수 || 0).toFixed(2)}</td>
            <td>${(avgActualCost.본사가공공수 || 0).toFixed(2)}</td>
        </tr>`;
    } else {
        tableHtml += `<tr><td><strong>실적 (6개월 평균)</strong></td><td colspan="4">데이터 없음</td></tr>`;
    }

    // 월별 실적원가 행
    if (monthlyActualCosts.length > 0) {
        monthlyActualCosts.forEach(cost => {
             tableHtml += `<tr>
                <td>실적 (${cost.년월})</td>
                <td>${cost.직접재료비 || 0}</td>
                <td>${cost.간접재료비 || 0}</td>
                <td>${cost.외주임가공공수 || 0}</td>
                <td>${cost.본사가공공수 || 0}</td>
            </tr>`;
        });
    } else {
        tableHtml += `<tr><td>월별 실적</td><td colspan="4">데이터 없음</td></tr>`;
    }

    tableHtml += '</tbody></table>';
    detailsContainer.innerHTML = infoHtml + tableHtml;
}
