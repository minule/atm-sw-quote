$(document).ready(function() {
    Chart.register(ChartDataLabels);
    let db = {}; // 이 페이지의 DB 객체

    async function initialize() {
        try {
            const response = await fetch('SW관리.csv');
			const csvText = await response.text();
            parseCSV(csvText);
            renderFilters();
            initializeEventHandlers();
        } catch (error) {
            console.error("데이터 로딩 실패:", error);
            $('#report-container').html('<p class="placeholder">데이터 로딩에 실패했습니다.</p>');
        }
    }

    function parseCSV(csvText) {
        // ... (sw_management.js와 동일한 CSV 파싱 로직) ...
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
    }

    function renderFilters() {
        const filterContainer = $('#filters');
        const appSwGroup = '응용 SW'; // '응용 SW'에 해당하는 그룹명

        // 응용 SW 필터
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

    function renderReport() {
        const reportContainer = $('#report-container');
        reportContainer.empty();

        const selectedSw = $('#app-sw-filter').val();
        const selectedCountry = $('#country-filter').val();
        const appSwGroup = '응용 SW';

        let filteredData = db['공급업체 상세'].filter(d => {
            const swMatch = !selectedSw || d[appSwGroup] === selectedSw;
            const countryMatch = !selectedCountry || d.국가 === selectedCountry;
            return swMatch && countryMatch;
        });

        if (filteredData.length === 0) {
            reportContainer.html('<p class="placeholder">해당 조건의 데이터가 없습니다.</p>');
            return;
        }

        const byCountry = filteredData.reduce((acc, item) => {
            const country = item.국가;
            if (!acc[country]) acc[country] = [];
            acc[country].push(item);
            return acc;
        }, {});

        for (const country in byCountry) {
            const countryData = byCountry[country];
            const totalAtmsInCountry = countryData.reduce((sum, item) => sum + parseInt(item.납품대수 || 0, 10), 0);

            const atmsByCustomer = countryData.reduce((acc, item) => {
                const customer = item.고객;
                acc[customer] = (acc[customer] || 0) + parseInt(item.납품대수 || 0, 10);
                return acc;
            }, {});

            const labels = Object.keys(atmsByCustomer);
            const customerCounts = Object.values(atmsByCustomer);

            const countryReportDiv = $(`<div class="country-report"><h2>${country}</h2><div class="chart-container"><canvas id="chart-${country}"></canvas></div><div class="table-container"></div></div>`);
            reportContainer.append(countryReportDiv);

            renderPieChart(`chart-${country}`, `${country} 고객별 점유율`, labels, customerCounts);
            renderTable(countryReportDiv.find('.table-container'), labels, customerCounts, totalAtmsInCountry);
        }
    }

    function initializeEventHandlers() {
        $('#search-btn').on('click', renderReport);
    }

    function renderPieChart(canvasId, title, labels, data) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        const chartColors = ['rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)'];
        new Chart(ctx, {
            type: 'pie',
            data: { labels: labels, datasets: [{ data: data, backgroundColor: labels.map((_, i) => chartColors[i % chartColors.length]) }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: title, font: { size: 16 } },
                    legend: { position: 'top' },
                    datalabels: {
                        color: '#fff', font: { weight: 'bold' },
                        formatter: (value, ctx) => {
                            let sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            let percentage = (value * 100 / sum).toFixed(1) + "%" ;
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
            const percentage = ((count / total) * 100).toFixed(1) + '%' ;
            table += `<tr><td>${label}</td><td>${count}</td><td>${percentage}</td></tr>`;
        });
        table += '</tbody></table>';
        tableContainer.html(table);
    }

    initialize();
});
