document.addEventListener('DOMContentLoaded', () => {
    const postForm = document.getElementById('post-form');
    const postContentInput = document.getElementById('post-content');
    const mediaInput = document.getElementById('media-input');
    const postsContainer = document.getElementById('posts-container');
    const leaveBtn = document.getElementById('leave-community');

    // Make sure COMMUNITY_ID is accessible, either defined globally or passed from Flask.
    // Example: const COMMUNITY_ID = document.body.dataset.communityId; // Or similar
    // Assuming COMMUNITY_ID is already defined in your scope for the existing code to work.

    // --- Repost Logic (Added) ---
    /**
     * Handles the repost action when a repost button is clicked.
     * This function will send the repost request to the backend.
     * It performs an immediate repost without a quote modal.
     * @param {Event} event The click event object.
     */
    async function handleRepost(event) {
        event.preventDefault();
        event.stopPropagation(); // Stop event bubbling to parent elements

        const button = event.currentTarget;
        // Get the ID of the original post to be reposted.
        // This is crucial: we want to repost the *original* content,
        // even if the user clicked a repost button on an already reposted item.
        const postIdToTarget = button.dataset.originalPostId;

        if (!postIdToTarget) {
            console.error("Repost failed: Original Post ID is missing from button data attribute.");
            alert("Error: Cannot determine which post to repost.");
            return;
        }

        // For a simple repost, the quote content is empty.
        const quoteContent = '';

        try {
            const response = await fetch(`/api/posts/${postIdToTarget}/repost`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content: quoteContent }) // Send empty content for immediate repost
            });

            const data = await response.json();

            if (response.ok) {
                console.log('Repost successful:', data);
                alert('Post reposted successfully!');
                // After successful repost, re-fetch and display community posts to update the feed
                fetchCommunityPosts(); // Refresh the community feed
            } else {
                console.error('Failed to repost:', data.message);
                alert(`Failed to repost: ${data.message || response.statusText}`);
                if (response.status === 401) {
                    // Redirect to login if unauthenticated
                    window.location.href = '/login';
                }
            }
        } catch (error) {
            console.error('Error during repost fetch:', error);
            alert('An error occurred while trying to repost.');
        }
    }

    /**
     * Attaches click event listeners to all repost buttons currently in the DOM.
     * Call this function whenever posts are added or refreshed in the community view.
     */
    function attachRepostButtonListeners() {
        document.querySelectorAll('.repost-button').forEach(button => {
            // Remove any existing listeners to prevent duplicates if called multiple times
            button.removeEventListener('click', handleRepost);
            button.addEventListener('click', handleRepost);
        });
    }
    // --- End Repost Logic ---

    // ✅ Submit post to Flask backend
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const content = postContentInput.value.trim();
        const mediaFile = mediaInput.files[0];

        if (!content && !mediaFile) {
            alert("Post must have content or an image.");
            return;
        }

        const formData = new FormData();
        if (content) formData.append('content', content);
        if (mediaFile) formData.append('media', mediaFile);

        try {
            const response = await fetch(`/api/communities/${COMMUNITY_ID}/posts`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                postContentInput.value = '';
                mediaInput.value = '';
                fetchCommunityPosts(); // Refresh the feed
            } else {
                alert(data.message || 'Failed to create post.');
            }
        } catch (error) {
            console.error("Error creating post:", error);
            alert("Something went wrong while posting.");
        }
    });

    // ✅ Fetch and display community posts (Modified to handle reposts)
    async function fetchCommunityPosts() {
        postsContainer.innerHTML = '';

        try {
            const response = await fetch(`/api/communities/${COMMUNITY_ID}/posts`);
            const result = await response.json();

            if (!response.ok) {
                postsContainer.innerHTML = `<p>${result.message || "Failed to load posts."}</p>`;
                return;
            }

            if (!result.posts || result.posts.length === 0) {
                postsContainer.innerHTML = `<p>No posts yet in this community.</p>`;
                return;
            }

            result.posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.className = 'post';
                // Store the ID of the current post document being rendered (can be a repost's ID)
                postElement.setAttribute('data-post-id', post._id); 

                let repostIndicatorHtml = '';
                let displayPost = post; // By default, assume it's an original post
                let originalPostTargetId = post._id; // Default to current post's ID for repost action

                // If it's a repost, adjust what content to display and what ID to target for further reposts
                if (post.is_repost) {
                    displayPost = post.original_post_details; // Use original details for content display
                    // The repost button should target the *original* post's ID
                    originalPostTargetId = displayPost ? displayPost._id : null;

                    if (displayPost) { // Check if original post details are available
                        repostIndicatorHtml = `
                            <div class="repost-indicator">
                                <i class="fas fa-retweet"></i> Reposted by ${post.author_name}
                                ${post.content ? `<p class="repost-quote">${post.content}</p>` : ''}
                            </div>
                        `;
                    } else {
                        // Case: Original post for this repost is missing (e.g., deleted)
                        console.warn(`Original post for repost ${post._id} not found.`);
                        postElement.innerHTML = `
                            <div class="post-header">
                                <span class="username">${post.author_name}</span>
                                <span class="timestamp">${new Date(post.timestamp).toLocaleString()}</span>
                            </div>
                            <div class="post-content">
                                <p>This post is a repost, but the original content is no longer available.</p>
                            </div>
                            <div class="post-actions">
                                <div class="action-button repost-button" data-post-id="${post._id}" disabled title="Original post unavailable">
                                    <i class="fas fa-retweet"></i>
                                    <span>Repost (0)</span>
                                </div>
                            </div>
                        `;
                        postsContainer.appendChild(postElement);
                        return; // Skip remaining rendering for this specific post
                    }
                }

                const timestamp = new Date(displayPost.timestamp).toLocaleString();
                const authorName = displayPost.author_name || 'Anonymous';
                const profilePicUrl = displayPost.profile_pic_url || '/static/default-profile.jpg';
                const content = displayPost.content || '';
                const imageHtml = displayPost.media_url ? `<img src="${displayPost.media_url}" alt="Post Media" class="post-image">` : '';

                // Determine initial like button state for the *displayed* post
                const likeIconClass = displayPost.current_user_liked ? 'fas fa-thumbs-up' : 'far fa-thumbs-up';
                const likeCount = displayPost.like_count || 0;
                const commentCount = displayPost.comments_count || 0;
                const repostCount = displayPost.repost_count || 0;


                postElement.innerHTML = `
                    ${repostIndicatorHtml}
                    <div class="post-content-wrapper ${post.is_repost ? 'reposted-wrapper' : ''}">
                        <div class="post-header">
                            <img src="${profilePicUrl}" alt="${authorName}">
                            <div class="post-user-info">
                                <h4>${authorName}</h4>
                                <p>${timestamp}</p>
                            </div>
                        </div>
                        <div class="post-body">
                            <p>${content}</p>
                            ${imageHtml}
                        </div>
                        <div class="post-actions">
                            <div class="action-button like-button" data-post-id="${displayPost._id}">
                                <i class="${likeIconClass}"></i>
                                <span>Like (<span class="like-count">${likeCount}</span>)</span>
                            </div>
                            <a href="/post/${displayPost._id}/details" class="action-button comment-button">
                                <i class="far fa-comment"></i>
                                <span>Comment (${commentCount})</span>
                            </a>
                            <div class="action-button repost-button" ${originalPostTargetId ? `data-original-post-id="${originalPostTargetId}"` : 'disabled title="Original post unavailable"'}>
                                <i class="fas fa-retweet"></i>
                                <span>Repost (${repostCount})</span>
                            </div>
                        </div>
                    </div>
                `;

                postsContainer.appendChild(postElement);
            });

            // Add event listeners after all posts are rendered
            addLikeButtonListeners();
            // ✅ Add this line to attach listeners to the new repost buttons
            attachRepostButtonListeners();

        } catch (err) {
            console.error("Error fetching posts:", err);
            postsContainer.innerHTML = `<p>Error loading posts.</p>`;
        }
    }

    // ✅ Function to handle liking/unliking a post
    async function toggleLike(postId, likeButtonElement) {
        try {
            const response = await fetch(`/api/posts/${postId}/toggle_like`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                // Update UI
                const likeIcon = likeButtonElement.querySelector('i');
                const likeCountSpan = likeButtonElement.querySelector('.like-count');

                if (data.liked) {
                    likeIcon.classList.remove('far');
                    likeIcon.classList.add('fas');
                } else {
                    likeIcon.classList.remove('fas');
                    likeIcon.classList.add('far');
                }
                likeCountSpan.textContent = data.like_count;
            } else {
                alert(data.message || 'Failed to toggle like.');
                console.error('Failed to toggle like:', data.message);
            }
        } catch (error) {
            console.error("Error toggling like:", error);
            alert("Something went wrong while toggling like.");
        }
    }

    // ✅ Add event listeners to all like buttons
    function addLikeButtonListeners() {
        const likeButtons = document.querySelectorAll('.like-button');
        likeButtons.forEach(button => {
            button.removeEventListener('click', (event) => { /* remove old listener */ }); // Prevent duplicate listeners
            button.addEventListener('click', (event) => {
                const postId = button.getAttribute('data-post-id');
                if (postId) {
                    toggleLike(postId, button);
                }
            });
        });
    }

    // ✅ Leave community
    leaveBtn.addEventListener('click', async () => {
        if (!confirm("Are you sure you want to leave this community?")) return;

        try {
            const response = await fetch(`/api/communities/${COMMUNITY_ID}/leave`, {
                method: 'POST'
            });

            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                window.location.href = '/communities'; // Go back to all communities
            } else {
                alert(data.message || "Failed to leave community.");
            }
        } catch (err) {
            console.error("Error leaving community:", err);
            alert("Error occurred while trying to leave the community.");
        }
    });

    // Load posts on page load
    fetchCommunityPosts();
});