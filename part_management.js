let db = {};
let unmappedPartsInfo = {}; // { unitCode: Set(partNumber), ... }

// 1. 초기화 함수
window.initializePage = function(database) {
    db = database;
    if (!db || Object.keys(db).length === 0) {
        console.error("Database not loaded!");
        return;
    }

    preprocessData();
    buildUnitTree();
    setupModalEventListeners();
};

// 2. 데이터 전처리
function preprocessData() {
    unmappedPartsInfo = {};
    if (!db.유닛 || !db.유닛품번리스트 || !db.유닛품번스펙정보) return;

    const requiredSpecsByUnit = {};
    db['유닛 스펙항목 리스트'].forEach(us => {
        if (!requiredSpecsByUnit[us.유닛코드]) requiredSpecsByUnit[us.유닛코드] = [];
        requiredSpecsByUnit[us.유닛코드].push(us.스펙항목코드);
    });

    db.유닛품번리스트.forEach(part => {
        const partNumber = part.유닛품번코드;
        const unitCode = part.유닛코드;
        const requiredSpecs = requiredSpecsByUnit[unitCode] || [];
        const actualSpecs = db.유닛품번스펙정보.filter(s => s.유닛품번코드 === partNumber);

        if (actualSpecs.length < requiredSpecs.length) {
            if (!unmappedPartsInfo[unitCode]) unmappedPartsInfo[unitCode] = new Set();
            unmappedPartsInfo[unitCode].add(partNumber);
        }
    });
}

// 3. 유닛 트리 생성
function buildUnitTree() {
    const treeContainer = document.getElementById('unit-tree');
    treeContainer.innerHTML = '';
    const tree = document.createElement('ul');

    db.유닛그룹.forEach(group => {
        const groupLi = document.createElement('li');
        const groupNode = document.createElement('div');
        groupNode.className = 'tree-node unit-group';
        groupNode.innerHTML = `<span class="node-text">${group.유닛그룹설명}</span>`;
        groupLi.appendChild(groupNode);

        const unitUl = document.createElement('ul');
        const unitsInGroup = db.유닛.filter(u => u.유닛그룹코드 === group.유닛그룹코드);

        unitsInGroup.forEach(unit => {
            const unitLi = document.createElement('li');
            const unitNode = document.createElement('div');
            unitNode.className = 'tree-node unit';
            unitNode.dataset.unitCode = unit.유닛코드;
            unitNode.dataset.unitName = unit.유닛설명;
            
            let warningIcon = unmappedPartsInfo[unit.유닛코드] ? '<span class="warning-icon">⚠️</span>' : '';
            unitNode.innerHTML = `<span class="node-text">${unit.유닛설명} ${warningIcon}</span>`;
            
            unitNode.addEventListener('click', () => handleUnitSelection(unitNode));
            unitLi.appendChild(unitNode);
            unitUl.appendChild(unitLi);
        });

        groupLi.appendChild(unitUl);
        tree.appendChild(groupLi);
    });

    treeContainer.appendChild(tree);
}

function handleUnitSelection(unitNode) {
    document.querySelectorAll('.tree-node.active').forEach(n => n.classList.remove('active'));
    unitNode.classList.add('active');
    const unitCode = unitNode.dataset.unitCode;
    const unitName = unitNode.dataset.unitName;
    document.getElementById('selected-unit-title').textContent = `'${unitName}' 부품 목록`;
    displayPartsForUnit(unitCode);
}

// 4. 부품 목록 표시
function displayPartsForUnit(unitCode) {
    const container = document.getElementById('part-list-table-container');
    const parts = db.유닛품번리스트.filter(p => p.유닛코드 === unitCode);
    const specItems = db['유닛 스펙항목 리스트'].filter(s => s.유닛코드 === unitCode).sort((a,b) => a.디스플레이순서 - b.디스플레이순서);
    const specItemHeaders = specItems.map(si => db.스펙항목.find(h => h.스펙항목코드 === si.스펙항목코드)?.스펙항목명 || si.스펙항목코드);

    let tableHtml = `<table><thead><tr><th>부품 번호</th>`;
    specItemHeaders.forEach(header => tableHtml += `<th>${header}</th>`);
    tableHtml += `<th>작업</th></tr></thead><tbody>`;

    parts.forEach(part => {
        const partSpecs = db.유닛품번스펙정보.filter(s => s.유닛품번코드 === part.유닛품번코드);
        const warningIcon = unmappedPartsInfo[unitCode]?.has(part.유닛품번코드) ? '<span class="warning-icon">⚠️</span>' : '';
        tableHtml += `<tr><td>${part.유닛품번코드} ${warningIcon}</td>`;

        specItems.forEach(specItem => {
            const spec = partSpecs.find(s => s.스펙항목코드 === specItem.스펙항목코드);
            const specName = spec ? db.스펙.find(o => o.스펙코드 === spec.스펙코드)?.스펙명 || '' : '-';
            tableHtml += `<td>${specName}</td>`;
        });

        tableHtml += `<td><button class="btn-edit-spec" data-part-number="${part.유닛품번코드}" data-unit-code="${unitCode}">스펙 편집</button></td></tr>`;
    });

    tableHtml += `</tbody></table>`;
    container.innerHTML = tableHtml;

    container.querySelectorAll('.btn-edit-spec').forEach(btn => {
        btn.addEventListener('click', (e) => openSpecEditor(e.target.dataset.partNumber, e.target.dataset.unitCode));
    });
}

// 5. 스펙 편집기
function openSpecEditor(partNumber, unitCode) {
    const modal = document.getElementById('spec-modal');
    const modalBody = document.getElementById('modal-body');
    document.getElementById('modal-title').textContent = `스펙 편집: ${partNumber}`;
    modalBody.innerHTML = '';

    const specItemsForUnit = db['유닛 스펙항목 리스트'].filter(s => s.유닛코드 === unitCode).sort((a,b) => a.디스플레이순서 - b.디스플레이순서);
    const currentSpecs = db.유닛품번스펙정보.filter(s => s.유닛품번코드 === partNumber);

    specItemsForUnit.forEach(specItem => {
        const specItemInfo = db.스펙항목.find(si => si.스펙항목코드 === specItem.스펙항목코드);
        const options = db.스펙.filter(o => o.스펙항목코드 === specItem.스펙항목코드).sort((a,b) => a.디스플레이순서 - b.디스플레이순서);
        const currentSpec = currentSpecs.find(cs => cs.스펙항목코드 === specItem.스펙항목코드);

        let formGroup = `<div class="form-group"><label for="${specItem.스펙항목코드}">${specItemInfo?.스펙항목명 || specItem.스펙항목코드}</label>`;
        formGroup += `<select id="${specItem.스펙항목코드}" data-spec-item-code="${specItem.스펙항목코드}">`;
        formGroup += `<option value="">-- 선택 --</option>`;
        options.forEach(opt => {
            const selected = currentSpec?.스펙코드 === opt.스펙코드 ? 'selected' : '';
            formGroup += `<option value="${opt.스펙코드}" ${selected}>${opt.스펙명}</option>`;
        });
        formGroup += `</select></div>`;
        modalBody.innerHTML += formGroup;
    });

    document.getElementById('modal-save-btn').dataset.partNumber = partNumber;
    document.getElementById('modal-save-btn').dataset.unitCode = unitCode;
    modal.style.display = 'flex';
}

function setupModalEventListeners() {
    document.getElementById('modal-close-btn').addEventListener('click', () => document.getElementById('spec-modal').style.display = 'none');
    document.getElementById('modal-cancel-btn').addEventListener('click', () => document.getElementById('spec-modal').style.display = 'none');
    document.getElementById('modal-save-btn').addEventListener('click', saveSpecs);
}

// 6. 스펙 저장
function saveSpecs(event) {
    const partNumber = event.target.dataset.partNumber;
    const unitCode = event.target.dataset.unitCode;
    const selects = document.getElementById('modal-body').querySelectorAll('select');
    
    const newSpecs = [];
    let newSpecHash = [];
    selects.forEach(select => {
        if (select.value) {
            newSpecs.push({ 
                specItemCode: select.dataset.specItemCode, 
                specCode: select.value 
            });
            newSpecHash.push(select.value);
        }
    });
    newSpecHash = newSpecHash.sort().join('-');

    // 유효성 검사: 동일 스펙 조합 확인
    const otherPartsInUnit = db.유닛품번리스트.filter(p => p.유닛코드 === unitCode && p.유닛품번코드 !== partNumber);
    for(const otherPart of otherPartsInUnit) {
        if (db.unitSpecHashes[otherPart.유닛품번코드] === newSpecHash) {
            alert(`오류: 동일한 스펙 조합이 부품 번호 ${otherPart.유닛품번코드}에 이미 존재합니다.`);
            return;
        }
    }

    // DB (메모리) 업데이트
    // 1. 기존 스펙 정보 삭제
    db.유닛품번스펙정보 = db.유닛품번스펙정보.filter(s => s.유닛품번코드 !== partNumber);
    // 2. 새 스펙 정보 추가
    newSpecs.forEach(spec => {
        const specItem = db.스펙항목.find(si => si.스펙항목코드 === spec.specItemCode);
        const specOpt = db.스펙.find(so => so.스펙코드 === spec.specCode);
        db.유닛품번스펙정보.push({
            유닛품번코드: partNumber,
            유닛코드: unitCode,
            스펙항목코드: spec.specItemCode,
            스펙코드: spec.specCode,
            스펙항목명: specItem?.스펙항목명,
            스펙명: specOpt?.스펙명
        });
    });
    // 3. 스펙 해시 업데이트
    db.unitSpecHashes[partNumber] = newSpecHash;

    // UI 업데이트
    document.getElementById('spec-modal').style.display = 'none';
    preprocessData(); // 경고 아이콘 재계산을 위해
    buildUnitTree(); // 트리 다시 빌드 (경고 아이콘 업데이트)
    document.querySelector(`.tree-node[data-unit-code="${unitCode}"]`).click(); // 현재 유닛 재선택 및 테이블 새로고침

    alert('스펙이 성공적으로 저장되었습니다.');
}
