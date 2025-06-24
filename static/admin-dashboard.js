document.addEventListener('DOMContentLoaded', function() {

    // Helper function to fetch data
    async function fetchData(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error fetching from ${url}:`, error);
            return null; // Return null on error so functions can handle it
        }
    }

    // --- 1. Populate Overall Stats ---
    async function populateOverallStats() {
        const totalUsersEl = document.getElementById('totalUsers');
        const totalPostsEl = document.getElementById('totalPosts');
        const totalCommunitiesEl = document.getElementById('totalCommunities');
        const totalEventsEl = document.getElementById('totalEvents');

        totalUsersEl.textContent = '...';
        totalPostsEl.textContent = '...';
        totalCommunitiesEl.textContent = '...';
        totalEventsEl.textContent = '...';

        const stats = await fetchData('/api/admin/dashboard/stats'); // Assuming this consolidated endpoint
        if (stats) {
            totalUsersEl.textContent = stats.total_users !== undefined ? stats.total_users : 'N/A';
            totalPostsEl.textContent = stats.total_posts !== undefined ? stats.total_posts : 'N/A';
            totalCommunitiesEl.textContent = stats.total_communities !== undefined ? stats.total_communities : 'N/A';
            totalEventsEl.textContent = stats.total_events !== undefined ? stats.total_events : 'N/A';
        } else {
            totalUsersEl.textContent = 'Error';
            totalPostsEl.textContent = 'Error';
            totalCommunitiesEl.textContent = 'Error';
            totalEventsEl.textContent = 'Error';
        }
    }

    // --- 2. Populate Engagement Metrics ---
    async function populateEngagementMetrics() {
        const totalLikesEl = document.getElementById('totalLikes');
        const totalCommentsEl = document.getElementById('totalComments');
        const totalRepostsEl = document.getElementById('totalReposts');
        const totalHashtagsEl = document.getElementById('totalHashtags'); // New element for total hashtags

        totalLikesEl.textContent = '...';
        totalCommentsEl.textContent = '...';
        totalRepostsEl.textContent = '...';
        totalHashtagsEl.textContent = '...';

        // Assuming consolidated trending stats or individual calls
        const trendingStats = await fetchData('/api/trending/stats'); // Or individual calls like /api/trending/total_likes etc.
        if (trendingStats) {
            totalLikesEl.textContent = trendingStats.total_likes !== undefined ? trendingStats.total_likes : 'N/A';
            totalCommentsEl.textContent = trendingStats.total_comments !== undefined ? trendingStats.total_comments : 'N/A';
            totalRepostsEl.textContent = trendingStats.total_reposts !== undefined ? trendingStats.total_reposts : 'N/A';
            totalHashtagsEl.textContent = trendingStats.total_hashtags !== undefined ? trendingStats.total_hashtags : 'N/A';
        } else {
            totalLikesEl.textContent = 'Error';
            totalCommentsEl.textContent = 'Error';
            totalRepostsEl.textContent = 'Error';
            totalHashtagsEl.textContent = 'Error';
        }
    }

    // --- 3. Populate Recent User Activity ---
    async function populateRecentUserActivity() {
        const recentUserActivityEl = document.getElementById('recentUserActivity');
        recentUserActivityEl.innerHTML = '<p class="text-gray-500 text-center py-4">Loading recent user activity...</p>';

        const activity = await fetchData('/api/admin/recent_user_activity'); // New endpoint for recent activity
        if (activity && activity.length > 0) {
            recentUserActivityEl.innerHTML = ''; // Clear loading message
            activity.forEach(item => {
                const activityItem = document.createElement('div');
                activityItem.className = 'activity-item';
                activityItem.innerHTML = `
                    <div class="activity-user">
                        <div class="user-avatar">${item.username.charAt(0).toUpperCase()}</div>
                        <div class="user-details">
                            <span class="user-name">${item.username}</span>
                            <span class="user-date">${new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="activity-stats">
                        <span class="stat-posts">${item.activity_type}</span>
                        </div>
                `;
                recentUserActivityEl.appendChild(activityItem);
            });
        } else if (activity) {
            recentUserActivityEl.innerHTML = '<p class="text-gray-500 text-center py-4">No recent user activity found.</p>';
        } else {
            recentUserActivityEl.innerHTML = '<p class="text-red-500 text-center py-4">Failed to load recent user activity.</p>';
        }
    }

    // --- 4. Populate Trending Posts (Most Liked, Reposted, Commented) ---
    async function populateTrendingPosts(endpoint, elementId, title) {
        const postsEl = document.getElementById(elementId);
        postsEl.innerHTML = `<p class="text-gray-500 text-center py-4">Loading ${title.toLowerCase()}...</p>`;

        const posts = await fetchData(endpoint);
        if (posts && posts.length > 0) {
            postsEl.innerHTML = ''; // Clear loading message
            posts.forEach((post, index) => {
                const postItem = document.createElement('div');
                postItem.className = 'trending-post-item';
                postItem.innerHTML = `
                    <div class="trending-rank">${index + 1}</div>
                    <div class="trending-post-content">
                        <div class="trending-author">${post.author_name}</div>
                        <div class="trending-text">${post.content ? post.content.substring(0, 100) + (post.content.length > 100 ? '...' : '') : 'No content'}</div>
                    </div>
                    <div class="trending-post-stats">
                        <div class="trending-stat"><i class="fas fa-heart"></i> ${post.like_count}</div>
                        <div class="trending-stat"><i class="fas fa-comments"></i> ${post.comments_count}</div>
                        <div class="trending-stat"><i class="fas fa-share"></i> ${post.repost_count}</div>
                    </div>
                `;
                postsEl.appendChild(postItem);
            });
        } else if (posts) {
            postsEl.innerHTML = `<p class="text-gray-500 text-center py-4">No ${title.toLowerCase()} found.</p>`;
        } else {
            postsEl.innerHTML = `<p class="text-red-500 text-center py-4">Failed to load ${title.toLowerCase()}.</p>`;
        }
    }

    // --- 5. Populate Most Used Hashtags ---
    async function populateMostUsedHashtags() {
        const hashtagsEl = document.getElementById('mostUsedHashtags');
        hashtagsEl.innerHTML = '<p class="text-gray-500 text-center py-4">Loading most used hashtags...</p>';

        const hashtags = await fetchData('/api/trending/most_hashtags_detailed'); // Assuming this endpoint gives details
        if (hashtags && hashtags.length > 0) {
            hashtagsEl.innerHTML = ''; // Clear loading message
            hashtags.forEach((tag, index) => {
                const hashtagItem = document.createElement('div');
                hashtagItem.className = 'activity-item'; // Reusing activity-item style
                hashtagItem.innerHTML = `
                    <div class="activity-user">
                        <span class="user-name">#${tag.hashtag}</span>
                    </div>
                    <div class="activity-stats">
                        <span class="stat-posts">Used: ${tag.count} times</span>
                    </div>
                `;
                hashtagsEl.appendChild(hashtagItem);
            });
        } else if (hashtags) {
            hashtagsEl.innerHTML = '<p class="text-gray-500 text-center py-4">No hashtags found.</p>';
        } else {
            hashtagsEl.innerHTML = '<p class="text-red-500 text-center py-4">Failed to load most used hashtags.</p>';
        }
    }

    // --- 6. Populate Most Participated Events ---
    async function populateMostParticipatedEvents() {
        const eventsEl = document.getElementById('mostParticipatedEvents');
        eventsEl.innerHTML = '<p class="text-gray-500 text-center py-4">Loading most participated events...</p>';

        const events = await fetchData('/api/trending/most_participated_events');
        if (events && events.length > 0) {
            eventsEl.innerHTML = ''; // Clear loading message
            events.forEach((event, index) => {
                const eventItem = document.createElement('div');
                eventItem.className = 'activity-item'; // Reusing activity-item style
                eventItem.innerHTML = `
                    <div class="activity-user">
                        <span class="user-name">${event.name}</span>
                        <span class="user-date">${new Date(event.date).toLocaleDateString()}</span>
                    </div>
                    <div class="activity-stats">
                        <span class="stat-posts">Participants: ${event.participants_count}</span>
                    </div>
                `;
                eventsEl.appendChild(eventItem);
            });
        } else if (events) {
            eventsEl.innerHTML = '<p class="text-gray-500 text-center py-4">No events found.</p>';
        } else {
            eventsEl.innerHTML = '<p class="text-red-500 text-center py-4">Failed to load most participated events.</p>';
        }
    }


    // Call all population functions when the DOM is ready
    populateOverallStats();
    populateEngagementMetrics();
    populateRecentUserActivity();
    populateMostUsedHashtags();
    populateMostParticipatedEvents();
    populateTrendingPosts('/api/trending/most_likes', 'mostLikedPosts', 'Most Liked Posts');
    populateTrendingPosts('/api/trending/most_reposts', 'mostRepostedPosts', 'Most Reposted Posts');
    populateTrendingPosts('/api/trending/most_comments', 'mostCommentedPosts', 'Most Commented Posts');
});
