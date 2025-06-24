document.addEventListener('DOMContentLoaded', function() {
    const navSearchInput = document.getElementById('navSearchInput');
    const resultsContainer = document.getElementById('results-container');
    const searchErrorArea = document.getElementById('userSearchError');
    const filterButtons = document.querySelectorAll('.filter-btn[data-type]');

    function performSearch(query, type = 'all') {
        if (resultsContainer) resultsContainer.innerHTML = '';
        if (searchErrorArea) searchErrorArea.textContent = '';

        if (!query) {
            if (resultsContainer) {
                resultsContainer.innerHTML = '<p style="text-align: center; color: #666;">Please enter a search query.</p>';
            }
            return;
        }

        if (resultsContainer) {
            resultsContainer.innerHTML = '<p style="text-align: center; color: #666;">Loading search results...</p>';
        }

        const searchUrl = `/api/search?query=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`;

        fetch(searchUrl, {
            method: 'GET',
        })
        .then(response => response.json().then(data => ({ status: response.status, body: data, ok: response.ok })))
        .then(result => {
            const { status, body, ok } = result;
            if (resultsContainer) resultsContainer.innerHTML = '';

            if (ok && status === 200) {
                if (body.results && body.results.length > 0) {
                    body.results.forEach(item => {
                        const resultElement = document.createElement('div');
                        resultElement.classList.add('result-item');

                        switch (item.type) {
                            case 'user':
                                resultElement.innerHTML = `
                                    <a href="/profile/${item.username}" class="result-link" style="text-decoration: none; color: inherit; display: block;">
                                        <div class="result-content">
                                            <h3>${item.username}</h3>
                                            <p>${item.name || 'Name not provided'}</p>
                                        </div>
                                    </a>
                                `;
                                break;

                            case 'community':
                                resultElement.innerHTML = `
                                    <a href="/communities?id=${item._id}" class="result-link" style="text-decoration: none; color: inherit; display: block;">
                                        <div class="result-content">
                                            <h3>${item.name}</h3>
                                            <p>${item.description || 'No description available'}</p>
                                            <div class="result-meta">${item.members_count || '0'} members</div>
                                        </div>
                                    </a>
                                `;
                                break;

                            case 'event':
                                resultElement.innerHTML = `
                                    <a href="/events?id=${item._id}" class="result-link" style="text-decoration: none; color: inherit; display: block;">
                                        <div class="result-content">
                                            <h3>${item.title}</h3>
                                            <p>Location: ${item.location || 'Not specified'}</p>
                                            <div class="result-meta">${item.date || 'Date not specified'}</div>
                                        </div>
                                    </a>
                                `;
                                break;

                            default:
                                resultElement.innerHTML = `<p>Unknown result type: ${item.type}</p>`;
                                break;
                        }

                        if (resultsContainer) resultsContainer.appendChild(resultElement);
                    });
                } else {
                    const message = body.message || 'No results found matching your query.';
                    if (resultsContainer) {
                        resultsContainer.innerHTML = `<p style="text-align: center; color: #666;">${message}</p>`;
                    }
                }
            } else {
                const errorMessage = body.message || `Search failed (Status: ${status})`;
                if (searchErrorArea) searchErrorArea.textContent = errorMessage;
            }
        })
        .catch(error => {
            console.error('Search error:', error);
            if (searchErrorArea) {
                searchErrorArea.textContent = 'An unexpected error occurred. Please try again.';
            }
        });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get('query');
    const initialType = urlParams.get('type') || 'all';

    if (navSearchInput) navSearchInput.value = initialQuery;

    filterButtons.forEach(button => {
        if (button.dataset.type === initialType) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    if (initialQuery) {
        performSearch(initialQuery, initialType);
    } else {
        if (resultsContainer) {
            resultsContainer.innerHTML = '<p style="text-align: center; color: #666;">Type something in the search bar above and hit Enter.</p>';
        }
    }

    if (navSearchInput) {
        navSearchInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                const newQuery = navSearchInput.value.trim();
                const currentActiveButton = document.querySelector('.filter-btn[data-type].active');
                const currentType = currentActiveButton ? currentActiveButton.dataset.type : 'all';

                if (newQuery) {
                    history.pushState({}, '', `/search_results?query=${encodeURIComponent(newQuery)}&type=${encodeURIComponent(currentType)}`);
                    performSearch(newQuery, currentType);
                } else {
                    if (resultsContainer) {
                        resultsContainer.innerHTML = '<p style="text-align: center; color: #666;">Please enter a search query.</p>';
                    }
                    if (searchErrorArea) searchErrorArea.textContent = '';
                }
            }
        });
    }

    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const group = button.closest('.filter-options');
            if (group) {
                group.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            }

            button.classList.add('active');

            const currentQuery = navSearchInput ? navSearchInput.value.trim() : '';
            const selectedType = button.dataset.type;

            history.pushState({}, '', `/search_results?query=${encodeURIComponent(currentQuery)}&type=${encodeURIComponent(selectedType)}`);
            performSearch(currentQuery, selectedType);
        });
    });
});
