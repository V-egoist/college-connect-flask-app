document.addEventListener('DOMContentLoaded', function() {
    const usersContentDiv = document.getElementById('all-registered-users-content');

    if (usersContentDiv) {
        fetch('/api/users')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(users => {
                usersContentDiv.innerHTML = ''; // Clear "Loading users..." message

                if (users.length > 0) {
                    const table = document.createElement('table');
                    table.classList.add('users-table');

                    // Create table header - ONLY USERNAME
                    table.innerHTML = `
                        <thead>
                            <tr>
                                <th>Username</th>
                            </tr>
                        </thead>
                        <tbody>
                        </tbody>
                    `;
                    const tbody = table.querySelector('tbody');

                    users.forEach(user => {
                        const row = document.createElement('tr');
                        // Populate cell with ONLY username
                        row.innerHTML = `
                            <td>${user.username || 'N/A'}</td>
                        `;
                        tbody.appendChild(row);
                    });

                    usersContentDiv.appendChild(table);
                } else {
                    usersContentDiv.innerHTML = '<p>No registered users found.</p>';
                }
            })
            .catch(error => {
                console.error('Error fetching registered users:', error);
                usersContentDiv.innerHTML = '<p>Error loading registered users. Please try again later.</p>';
            });
    }
});
