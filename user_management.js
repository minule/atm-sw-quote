document.addEventListener('DOMContentLoaded', () => {
    const userTableBody = document.querySelector('#user-table tbody');
    const searchButton = document.getElementById('search-button');
    const searchType = document.getElementById('search-type');
    const searchInput = document.getElementById('search-input');
    const saveButton = document.getElementById('save-button');

    let allUsers = [];
    let allRoles = [];

    // CSV 데이터를 가져와서 파싱하는 함수
    async function fetchAndParseData() {
        try {
            const response = await fetch('시스템관리.CSV');
            const text = await response.text();
            const lines = text.split(/\r?\n/);
            
            let isUserSection = false;
            let isRoleSection = false;
            const users = [];
            const roles = [];

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('사용자정보')) {
                    isUserSection = true;
                    isRoleSection = false;
                    continue;
                } else if (trimmedLine.startsWith('권한목록')) {
                    isRoleSection = true;
                    isUserSection = false;
                    continue;
                }

                if (isUserSection && trimmedLine !== '' && !trimmedLine.startsWith('사번')) {
                    const [employeeNumber, name, id, deptCode, deptName, email, role] = trimmedLine.split(',');
                    if(employeeNumber) {
                         users.push({ employeeNumber, name, id, deptCode, deptName, email, role: role.trim() });
                    }
                } else if (isRoleSection && trimmedLine !== '' && !trimmedLine.startsWith('권한코드')) {
                    const [roleCode, roleName, isDeleted] = trimmedLine.split(',');
                    if (roleName && isDeleted === 'N') {
                        roles.push(roleName.trim());
                    }
                }
            }
            allUsers = users;
            allRoles = roles;
            displayUsers(allUsers, allRoles);
        } catch (error) {
            console.error('Error fetching or parsing CSV data:', error);
        }
    }

    // 사용자 데이터를 테이블에 표시하는 함수
    function displayUsers(users, roles) {
        userTableBody.innerHTML = ''; // 기존 내용을 지웁니다.
        users.forEach(user => {
            const row = document.createElement('tr');

            const roleOptions = roles.map(role => 
                `<option value="${role}" ${user.role === role ? 'selected' : ''}>${role}</option>`
            ).join('');

            row.innerHTML = `
                <td data-id="${user.employeeNumber}">${user.employeeNumber}</td>
                <td>${user.name}</td>
                <td>${user.id}</td>
                <td>${user.deptCode}</td>
                <td>${user.deptName}</td>
                <td>${user.email}</td>
                <td><select class="role-select">${roleOptions}</select></td>
            `;
            userTableBody.appendChild(row);
        });
    }

    // 검색 기능
    function searchUsers() {
        const type = searchType.value;
        const query = searchInput.value.toLowerCase();

        const filteredUsers = allUsers.filter(user => {
            if (type === 'department') {
                return user.deptName.toLowerCase().includes(query);
            } else if (type === 'user') {
                return user.name.toLowerCase().includes(query);
            }
            return false;
        });

        displayUsers(filteredUsers, allRoles);
    }

    // 데이터 저장 기능
    async function saveUserData() {
        // 1. DOM에서 현재 테이블 데이터를 읽어 allUsers 배열 업데이트
        const rows = userTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const employeeNumber = row.querySelector('td:first-child').dataset.id;
            const selectedRole = row.querySelector('.role-select').value;
            const user = allUsers.find(u => u.employeeNumber === employeeNumber);
            if (user) {
                user.role = selectedRole;
            }
        });

        try {
            // 2. 원본 CSV 파일 다시 읽기
            const response = await fetch('시스템관리.CSV');
            const originalCsvText = await response.text();
            const lines = originalCsvText.split(/\r?\n/);

            // 3. 새로운 사용자 정보 CSV 블록 생성
            const newUserBlock = ['사용자정보,,,,,,,,,,', '사번,사용자명,사용자ID,부서코드,부서명,이메일,권한'];
            allUsers.forEach(user => {
                newUserBlock.push([user.employeeNumber, user.name, user.id, user.deptCode, user.deptName, user.email, user.role].join(','));
            });

            // 4. 원본 CSV에서 사용자 정보 블록 교체
            const newLines = [];
            let inUserBlock = false;
            for (const line of lines) {
                if (line.trim().startsWith('사용자정보')) {
                    inUserBlock = true;
                    newLines.push(...newUserBlock);
                } else if (inUserBlock && (line.trim() === '' || line.split(',').length < 2)) {
                    // 사용자 블록이 끝나는 지점 (빈 라인 또는 다음 섹션)
                    inUserBlock = false;
                    newLines.push(line);
                } else if (!inUserBlock) {
                    newLines.push(line);
                }
            }

            const newCsvText = newLines.join('\n');

            // 5. 파일 다운로드 트리거
            const blob = new Blob([newCsvText], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', '시스템관리_수정.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            alert('파일이 저장되었습니다.');

        } catch (error) {
            console.error('Error saving data:', error);
            alert('데이터 저장 중 오류가 발생했습니다.');
        }
    }

    searchButton.addEventListener('click', searchUsers);
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            searchUsers();
        }
    });
    saveButton.addEventListener('click', saveUserData);

    // 페이지 로드 시 데이터 로드
    fetchAndParseData();
});
