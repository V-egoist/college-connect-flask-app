// static/most-comments.js

document.addEventListener('DOMContentLoaded', async () => {
    const reportContent = document.getElementById('most-commented-posts-full-list');

    async function fetchMostCommentedPosts() {
        try {
            reportContent.innerHTML = '<p>Loading most commented posts...</p>';
            // This API call will fetch ALL most commented posts (no limit parameter)
            const response = await fetch('/api/trending/most_commented_posts'); 
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            reportContent.innerHTML = ''; // Clear loading message

            if (data.length === 0) {
                reportContent.innerHTML = `<p>No most commented posts available yet.</p>`;
                return;
            }

            // Loop through the fetched data and create HTML for each post
            data.forEach((post, index) => {
                const postCard = document.createElement('div');
                postCard.classList.add('post-card'); // Use the .post-card class for styling

                // Constructing the inner HTML for each post card
                postCard.innerHTML = `
                    <div class="post-card-content">
                        <div class="post-rank">
                            <span>#${index + 1}</span>
                        </div>
                        <div class="post-image">
                            <img src="${post.media_url || post.profile_pic_url || 'https://placehold.co/200x150/eeeeee/aaaaaa?text=No+Img'}" alt="Post Image">
                        </div>
                        <div class="post-details">
                            <h3>${post.content ? post.content.substring(0, 70) + '...' : 'No Content Available'}</h3>
                            <p class="post-excerpt">${post.content ? post.content.substring(0, 150) + '...' : 'This post does not have detailed content.'}</p>
                            <div class="post-meta">
                                <div class="post-author">By ${post.author_name || 'Unknown User'} • ${new Date(post.timestamp).toLocaleDateString()}</div>
                                <div class="post-stat likes">
                                    <i class="fas fa-thumbs-up"></i> ${post.like_count || 0}
                                </div>
                                <div class="post-stat comments">
                                    <i class="fas fa-comment"></i> ${post.comments_count || 0}
                                </div>
                                <div class="post-stat reposts">
                                    <i class="fas fa-retweet"></i> ${post.repost_count || 0}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                reportContent.appendChild(postCard);
            });
        } catch (error) {
            console.error('Error fetching most commented posts:', error);
            reportContent.innerHTML = '<p class="error-message">Error loading most commented posts. Please try again later.</p>';
        }
    }

    // Fetch and display posts when the page loads
    fetchMostCommentedPosts();
});
