Chart.register(ChartDataLabels);

// 이 함수는 main.js에서 iframe이 로드된 후 호출됩니다.
function initializePage(db) {
    if (!db || Object.keys(db).length === 0) {
        console.error("DB 객체가 비어있거나 유효하지 않습니다.");
        // 사용자에게 데이터 로딩 중임을 알리는 메시지를 표시할 수 있습니다.
        document.body.innerHTML = "데이터를 로드하고 있습니다. 잠시만 기다려주세요...";
        return;
    }

    // --- 데이터 가공 ---

    // 1. 제품군별 모델 수
    const modelsPerProductLine = {};
    if (db.제품정보) {
        db.제품정보.forEach(product => {
            const lineCode = product.제품군코드;
            modelsPerProductLine[lineCode] = (modelsPerProductLine[lineCode] || 0) + 1;
        });
    }
    const productLineLabels = db.제품군 ? db.제품군.map(p => p.제품군코드) : [];
    const productLineData = productLineLabels.map(label => modelsPerProductLine[label] || 0);

    // 2. 모델별 제품 수
    const productsPerModel = {};
    if (db.제품품번정보) {
        db.제품품번정보.forEach(item => {
            const modelCode = item.제품코드;
            productsPerModel[modelCode] = (productsPerModel[modelCode] || 0) + 1;
        });
    }
    const modelLabels = Object.keys(productsPerModel);
    const modelData = Object.values(productsPerModel);

    // 3. 유닛별 부품 수 & 4. 유닛별 스펙 항목 수
    const unitCodeToName = {};
    if (db.유닛) {
        db.유닛.forEach(unit => {
            unitCodeToName[unit.유닛코드] = unit.유닛설명;
        });
    }
    const partsPerUnit = {};
    if (db.유닛품번리스트) {
        db.유닛품번리스트.forEach(part => {
            const unitCode = part.유닛코드;
            partsPerUnit[unitCode] = (partsPerUnit[unitCode] || 0) + 1;
        });
    }
    const specItemsPerUnit = {};
    if (db['유닛 스펙항목 리스트']) {
        db['유닛 스펙항목 리스트'].forEach(item => {
            const unitCode = item.유닛코드;
            specItemsPerUnit[unitCode] = (specItemsPerUnit[unitCode] || 0) + 1;
        });
    }
    const allUnitCodes = [...new Set([...Object.keys(partsPerUnit), ...Object.keys(specItemsPerUnit)])].sort();
    const allUnitDisplayLabels = allUnitCodes.map(code => `${unitCodeToName[code] || code} (${code})`);
    const unitDataForChart3 = allUnitCodes.map(code => partsPerUnit[code] || 0);
    const specItemDataForChart4 = allUnitCodes.map(code => specItemsPerUnit[code] || 0);

    // 5. 스펙 항목별 매핑 스펙 수
    const specsPerSpecItem = {};
    if (db.스펙) {
        db.스펙.forEach(spec => {
            const specItemCode = spec.스펙항목코드;
            specsPerSpecItem[specItemCode] = (specsPerSpecItem[specItemCode] || 0) + 1;
        });
    }
    const specItemCodeToName = {};
    if (db.스펙항목) {
        db.스펙항목.forEach(item => {
            specItemCodeToName[item.스펙항목코드] = item.스펙항목명;
        });
    }
    const specItemLabels = Object.keys(specsPerSpecItem).map(code => specItemCodeToName[code] || code);
    const specItemCountData = Object.values(specsPerSpecItem);

    // 6. 고객별 제품 수
    const productsPerCustomer = {};
    if (db.제품품번정보) {
        db.제품품번정보.forEach(item => {
            const customerCode = item.고객코드;
            if(customerCode) { // 고객코드가 있는 경우에만
                productsPerCustomer[customerCode] = (productsPerCustomer[customerCode] || 0) + 1;
            }
        });
    }
    const customerLabels = Object.keys(productsPerCustomer);
    const customerData = Object.values(productsPerCustomer);


    // --- 차트 렌더링 ---
    renderChart('chart1', 'bar', '제품군별 모델 수', productLineLabels, productLineData, '모델 수');
    renderChart('chart2', 'pie', '모델별 제품 수', modelLabels, modelData);
    renderChart('chart3', 'bar', '유닛별 부품 수', allUnitDisplayLabels, unitDataForChart3, '부품 수');
    renderChart('chart4', 'bar', '유닛별 스펙 항목 수', allUnitDisplayLabels, specItemDataForChart4, '스펙 항목 수');
    renderChart('chart5', 'doughnut', '스펙 항목별 매핑 스펙 수', specItemLabels, specItemCountData);
    renderChart('chart6', 'pie', '고객별 제품 수', customerLabels, customerData);
}

function renderChart(canvasId, type, title, labels, data, label) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    const chartColors = [
        'rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)',
        'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)',
        'rgba(199, 199, 199, 0.7)', 'rgba(83, 102, 255, 0.7)', 'rgba(40, 159, 64, 0.7)'
    ];

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: title,
                font: { size: 16 }
            },
            legend: {
                position: (type === 'pie' || type === 'doughnut') ? 'top' : 'none',
            },
            datalabels: {
                color: (type === 'pie' || type === 'doughnut') ? '#fff' : '#333',
                anchor: (type === 'bar') ? 'end' : 'center',
                align: (type === 'bar') ? 'top' : 'center',
                font: {
                    weight: 'bold'
                },
                formatter: function(value) {
                    return value > 0 ? value : '';
                }
            }
        },
    };

    if (type === 'bar') {
        options.scales = {
            y: {
                beginAtZero: true,
                ticks: {
                    stepSize: 1
                }
            }
        };
    }

    new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: label || title,
                data: data,
                backgroundColor: (type === 'pie' || type === 'doughnut') ? labels.map((_, i) => chartColors[i % chartColors.length]) : 'rgba(75, 192, 192, 0.6)',
                borderColor: (type === 'pie' || type === 'doughnut') ? '#fff' : 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: options
    });
}
