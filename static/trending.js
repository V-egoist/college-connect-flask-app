// static/trending.js

document.addEventListener('DOMContentLoaded', async () => {

    // Helper function to fetch and display single metrics for the overview cards
    async function fetchAndDisplayMetric(api_url, element_id) {
        try {
            const element = document.getElementById(element_id);
            if (!element) {
                console.warn(`Element with ID '${element_id}' not found.`);
                return;
            }
            element.textContent = 'Loading...'; // Set loading state
            const response = await fetch(api_url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Assuming data will have a single key like 'total_posts', 'total_likes' etc.
            const value = Object.values(data)[0]; 
            element.textContent = value.toLocaleString(); // Format numbers for readability
        } catch (error) {
            console.error(`Error fetching ${element_id}:`, error);
            const element = document.getElementById(element_id);
            if (element) element.textContent = 'Error';
        }
    }

    // Helper function to fetch and display lists of posts/events for the overview cards
    async function fetchAndDisplayListOverview(api_url, container_id, metricType) { // metricType e.g., 'likes', 'reposts', 'comments', 'participants'
        try {
            const container = document.getElementById(container_id);
            if (!container) {
                console.warn(`Container with ID '${container_id}' not found.`);
                return;
            }
            container.innerHTML = '<p>Loading...</p>'; // Set loading state
            const response = await fetch(api_url + '?limit=3'); // Request top 3 for overview
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            container.innerHTML = ''; // Clear loading message

            if (data.length === 0) {
                container.innerHTML = `<p>No data available yet.</p>`;
                return;
            }

            data.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                // Decide class based on content type (event vs. post) for styling
                // The 'participants' branch is effectively unused if the call to it is removed.
                itemDiv.classList.add(metricType === 'participants' ? 'event-item-small' : 'post-item-small');

                let iconHtml = '';
                let displayValue = '';
                let primaryText = '';
                let secondaryText = '';
                let imageHtml = ''; // Initialize image HTML for the left side of the item

                if (metricType === 'likes') {
                    iconHtml = '<i class="fas fa-thumbs-up"></i>';
                    displayValue = item.like_count || 0;
                    primaryText = item.content ? item.content.substring(0, 50) + '...' : 'No content';
                    secondaryText = item.author_name ? `By ${item.author_name}` : 'Unknown Author';
                    imageHtml = `<img src="${item.profile_pic_url || 'https://placehold.co/100x100/eeeeee/aaaaaa?text=No+Img'}" alt="Profile Pic">`;
                } else if (metricType === 'reposts') {
                    iconHtml = '<i class="fas fa-retweet"></i>';
                    displayValue = item.repost_count || 0;
                    primaryText = item.content ? item.content.substring(0, 50) + '...' : 'No content';
                    secondaryText = item.author_name ? `By ${item.author_name}` : 'Unknown Author';
                    imageHtml = `<img src="${item.profile_pic_url || 'https://placehold.co/100x100/eeeeee/aaaaaa?text=No+Img'}" alt="Profile Pic">`;
                } else if (metricType === 'comments') {
                    iconHtml = '<i class="fas fa-comment"></i>';
                    displayValue = item.comments_count || 0;
                    primaryText = item.content ? item.content.substring(0, 50) + '...' : 'No content';
                    secondaryText = item.author_name ? `By ${item.author_name}` : 'Unknown Author';
                    imageHtml = `<img src="${item.profile_pic_url || 'https://placehold.co/100x100/eeeeee/aaaaaa?text=No+Img'}" alt="Profile Pic">`;
                } else if (metricType === 'participants') {
                    // This block will no longer be reached if the call to fetchAndDisplayListOverview for participants is removed.
                    iconHtml = '<i class="fas fa-users"></i>'; // Users icon for participants
                    displayValue = item.participants_count || 0;
                    primaryText = item.title ? item.title.substring(0, 50) + '...' : 'No event title'; // Event title
                    
                    // Format date and time for events
                    const eventDate = new Date(item.date);
                    secondaryText = `on ${eventDate.toLocaleDateString()} at ${item.time}`;
                    
                    // Use a generic calendar icon for events, or an event image if available
                    imageHtml = `<div class="event-icon-placeholder"><i class="fas fa-calendar-alt"></i></div>`; 
                } else { // Fallback for unexpected types
                    iconHtml = '';
                    displayValue = '';
                    secondaryText = '';
                }

                itemDiv.innerHTML = `
                    <span class="rank">#${index + 1}.</span>
                    ${imageHtml}
                    <div class="info">
                        <p class="title">${primaryText}</p>
                        <p class="sub-info">${secondaryText}</p>
                        <div class="metric">
                            ${iconHtml}
                            ${displayValue}
                        </div>
                    </div>
                `;
                container.appendChild(itemDiv);
            });

        } catch (error) {
            console.error(`Error fetching ${container_id}:`, error);
            const container = document.getElementById(container_id);
            if (container) container.innerHTML = `<p>Error loading data.</p>`;
        }
    }


    // Call the functions to load data when the page loads
    await fetchAndDisplayMetric('/api/trending/total_posts', 'total-posts-value');
    await fetchAndDisplayMetric('/api/trending/total_likes', 'total-likes-value');
    await fetchAndDisplayMetric('/api/trending/total_reposts', 'total-reposts-value');
    await fetchAndDisplayMetric('/api/trending/total_comments', 'total-comments-value'); 
    await fetchAndDisplayListOverview('/api/trending/most_liked_posts', 'most-liked-posts-content', 'likes');
    await fetchAndDisplayListOverview('/api/trending/most_reposted_posts', 'most-reposted-posts-content', 'reposts');
    await fetchAndDisplayListOverview('/api/trending/most_commented_posts', 'most-commented-posts-content', 'comments');
    // Removed the line for 'most_participated_events' as requested:
    // await fetchAndDisplayListOverview('/api/trending/most_participated_events', 'most-participated-events-content', 'participants');
});
