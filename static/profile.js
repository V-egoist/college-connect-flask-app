// static/profile.js

document.addEventListener('DOMContentLoaded', () => {
    const postsContainer = document.getElementById('posts-container');
    const pathSegments = window.location.pathname.split('/');
    // The username should be the last segment in /profile/username
    const username = pathSegments[pathSegments.length - 1]; 

    // --- Helper function to display messages on the page ---
    // You might want to integrate this with a global message system if you have one.
    function showPageMessage(message, type = 'info') {
        let messageDiv = document.getElementById('profile-message-box');
        if (!messageDiv) {
            messageDiv = document.createElement('div');
            messageDiv.id = 'profile-message-box';
            messageDiv.className = 'message-box'; // Add basic styling via CSS if needed
            postsContainer.before(messageDiv); // Place before posts
        }
        messageDiv.textContent = message;
        messageDiv.className = `message-box show ${type}`; // Add styling classes
        
        setTimeout(() => {
            messageDiv.classList.remove('show');
        }, 3000); // Hide after 3 seconds
    }

    // --- Function to create a single post element ---
    // This is adapted from main.js but simplified for the profile page view.
    function createPostElement(post) {
        const postItem = document.createElement('div');
        postItem.className = 'post-item';
        postItem.dataset.postId = post._id; // Store post ID for actions

        let contentHtml = '';
        if (post.image_url) {
            contentHtml = `<img src="${post.image_url}" alt="Post Image">`;
        } else {
            // For text-only posts, show a preview
            const textPreview = post.content.length > 100 ? 
                                post.content.substring(0, 100) + '...' : 
                                post.content;
            contentHtml = `<div class="post-text-preview">${textPreview}</div>`;
        }

        postItem.innerHTML = `
            ${contentHtml}
            <div class="post-overlay">
                <span><i class="fas fa-heart"></i> ${post.likes_count}</span>
                <span><i class="fas fa-comment"></i> ${post.comments_count}</span>
                <span><i class="fas fa-retweet"></i> ${post.repost_count}</span>
            </div>
        `;
        // In a full implementation, clicking a post item would open a modal for full view.
        // For now, we're just displaying them in a grid.
        
        return postItem;
    }

    // --- Function to fetch and display user-specific posts ---
    async function fetchAndDisplayUserPosts() {
        postsContainer.innerHTML = '<p style="text-align: center; color: #666;">Loading posts...</p>'; // Show loading

        try {
            const response = await fetch(`/api/users/${username}/posts`);
            const data = await response.json();

            if (response.ok) {
                postsContainer.innerHTML = ''; // Clear loading message

                if (data.posts && data.posts.length > 0) {
                    data.posts.forEach(post => {
                        const postElement = createPostElement(post);
                        postsContainer.appendChild(postElement);
                    });
                } else {
                    postsContainer.innerHTML = `<p style="text-align: center; color: #888;">${username} hasn't posted anything yet.</p>`;
                }
            } else {
                postsContainer.innerHTML = `<p style="text-align: center; color: red;">Error: ${data.message || 'Could not load posts.'}</p>`;
                console.error('Failed to fetch user posts:', data.message);
                if (response.status === 401) {
                    window.location.href = '/login'; // Redirect if not authenticated
                }
            }
        } catch (error) {
            postsContainer.innerHTML = `<p style="text-align: center; color: red;">An error occurred while fetching posts.</p>`;
            console.error('Network error fetching user posts:', error);
        }
    }

    // Call the function to fetch and display posts when the page loads
    if (username) { // Only fetch if a username is present in the URL
        fetchAndDisplayUserPosts();
    } else {
        postsContainer.innerHTML = `<p style="text-align: center; color: red;">Invalid profile URL. Username missing.</p>`;
    }
});
