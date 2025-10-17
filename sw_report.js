$(document).ready(function() {
    Chart.register(ChartDataLabels);

    const reportContainer = $('#report-container');
    const rawData = sessionStorage.getItem('swReportData');

    if (!rawData) {
        reportContainer.html('<p>표시할 데이터가 없습니다. SW관리 화면에서 먼저 데이터를 검색해주세요.</p>');
        return;
    }

    const data = JSON.parse(rawData);
    // '모니터링/관리 SW' 그룹에 'BlueVerse'가 포함된 데이터만 필터링
    const bvData = data.filter(d => d['응용 SW'] && d['응용 SW'].includes('BlueVerse'));

    if (bvData.length === 0) {
        reportContainer.html('<p>BV Fleet 적용 데이터를 찾을 수 없습니다.</p>');
        return;
    }

    // 국가별로 데이터 그룹화
    const byCountry = bvData.reduce((acc, item) => {
        const country = item.국가;
        if (!acc[country]) {
            acc[country] = [];
        }
        acc[country].push(item);
        return acc;
    }, {});

    reportContainer.empty(); // 초기 메시지 제거

    // 국가별로 차트 및 테이블 생성
    for (const country in byCountry) {
        const countryData = byCountry[country];
        const totalAtmsInCountry = countryData.length;

        // 고객별 ATM 수 계산
        const atmsByCustomer = countryData.reduce((acc, item) => {
            const customer = item.고객;
            acc[customer] = (acc[customer] || 0) + 1;
            return acc;
        }, {});

        const labels = Object.keys(atmsByCustomer);
        const customerCounts = Object.values(atmsByCustomer);

        const countryReportDiv = $(`<div class="country-report"><h2>${country}</h2><div class="chart-container"><canvas id="chart-${country}"></canvas></div><div class="table-container"></div></div>`);
        reportContainer.append(countryReportDiv);

        // 파이 차트 렌더링
        renderPieChart(`chart-${country}`, `${country} 고객별 점유율`, labels, customerCounts);

        // 테이블 렌더링
        renderTable(countryReportDiv.find('.table-container'), labels, customerCounts, totalAtmsInCountry);
    }
});

function renderPieChart(canvasId, title, labels, data) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const chartColors = [
        'rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)',
        'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)',
        'rgba(199, 199, 199, 0.7)', 'rgba(83, 102, 255, 0.7)', 'rgba(40, 159, 64, 0.7)'
    ];

    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: labels.map((_, i) => chartColors[i % chartColors.length]),
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: title, font: { size: 16 } },
                legend: { position: 'top' },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold' },
                    formatter: (value, ctx) => {
                        let sum = 0;
                        let dataArr = ctx.chart.data.datasets[0].data;
                        dataArr.map(d => sum += d);
                        let percentage = (value*100 / sum).toFixed(1)+"%";
                        return percentage;
                    }
                }
            }
        }
    });
}

function renderTable(tableContainer, labels, counts, total) {
    let table = '<table><thead><tr><th>고객</th><th>ATM 수</th><th>점유율</th></tr></thead><tbody>';
    labels.forEach((label, index) => {
        const count = counts[index];
        const percentage = ((count / total) * 100).toFixed(1) + '%';
        table += `<tr><td>${label}</td><td>${count}</td><td>${percentage}</td></tr>`;
    });
    table += '</tbody></table>';
    tableContainer.html(table);
}
