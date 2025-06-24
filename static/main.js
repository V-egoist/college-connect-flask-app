// static/main.js

// --- Global Repost Function (placed outside DOMContentLoaded) ---
async function handleRepost(event, currentPostId) {
    event.preventDefault();
    event.stopPropagation(); // Stop event bubbling

    // Determine the actual post ID to repost:
    // If the button clicked has a data-original-post-id, use that.
    // Otherwise, use the currentPostId (which implies it's an original post on the feed).
    // This allows reposting an original post even if it's shown nested within another repost.
    const postIdToTarget = event.currentTarget.dataset.originalPostId || currentPostId;

    // Optional: If you implement a modal for adding a quote to a repost,
    // you would get the content from that modal's input field here.
    const quoteContent = ''; // For a simple repost, content is empty.

    try {
        const response = await fetch(`/api/posts/${postIdToTarget}/repost`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: quoteContent })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Repost successful:', data);
            alert('Post reposted successfully!');
            // After successful repost, re-fetch and display posts to update the feed
            fetchAndDisplayPosts();
        } else {
            console.error('Failed to repost:', data.message);
            alert(`Failed to repost: ${data.message}`);
        }
    } catch (error) {
        console.error('Error during repost fetch:', error);
        alert('An error occurred while trying to repost.');
    }
}


document.addEventListener('DOMContentLoaded', function() {
    // --- Logout Link Logic ---
    const logoutLink = document.getElementById('logout-link');

    if (logoutLink) {
        logoutLink.addEventListener('click', function(event) {
            event.preventDefault();

            fetch('/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            })
            .then(response => response.json())
            .then(data => {
                alert(data.message || 'Logged out successfully.');
                console.log('Logout successful:', data);
                window.location.href = '/login';
            })
            .catch(error => {
                console.error('There was an error during logout:', error);
                alert('An error occurred during logout.');
            });
        });
    }
    // --- End Logout Link Logic ---


    // --- Nav Search Input Logic ---
    const navSearchInput = document.getElementById('navSearchInput');

    if (navSearchInput) {
        console.log("Nav search input element found, adding keypress listener.");

        navSearchInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                console.log("Enter key pressed in nav search input.");
                event.preventDefault();

                const query = navSearchInput.value.trim();

                if (query) {
                    console.log(`Redirecting to search results for query: "${query}"`);
                    window.location.href = `/search_results?query=${encodeURIComponent(query)}`;
                } else {
                    console.log("Search query is empty, no redirect.");
                }
            }
        });
    } else {
           console.log("Nav search input element (#navSearchInput) not found on this page.");
    }
    // --- End Nav Search Input Logic ---


    // --- Post Creation Logic ---
    const postButton = document.getElementById('post-button');
    const postInput = document.getElementById('post-input'); // Text input for post content
    const imageUploadInput = document.getElementById('image-upload'); // Get image upload input

    if (postButton && postInput) {
        postButton.addEventListener('click', async () => {
            const content = postInput.value.trim();
            const imageFile = imageUploadInput.files[0];

            if (!content && !imageFile) {
                alert('Post content or an image is required.');
                return;
            }

            const formData = new FormData();
            formData.append('content', content);
            if (imageFile) {
                formData.append('image', imageFile);
            }

            try {
                const response = await fetch('/api/posts', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    alert(data.message);
                    postInput.value = '';
                    if (imageUploadInput) {
                        imageUploadInput.value = '';
                    }
                    // Re-fetch and display posts to show the new post
                    fetchAndDisplayPosts();
                } else {
                    alert(`Error: ${data.message || 'Failed to create post.'}`);
                }
            } catch (error) {
                console.error('Error creating post:', error);
                alert('An error occurred while trying to create your post.');
            }
        });
    }
    // --- End Post Creation Logic ---


    // --- Post Feed Display Logic (Handles original posts and Reposts) ---
    async function fetchAndDisplayPosts() {
        const postsContainer = document.querySelector('.posts-container');
        if (!postsContainer) {
            console.error('Posts container not found!');
            return;
        }

        try {
            const response = await fetch('/api/posts');
            const data = await response.json();

            if (response.ok) {
                postsContainer.innerHTML = ''; // Clear existing posts
                data.forEach(post => {
                    const postElement = document.createElement('div');
                    postElement.classList.add('post');
                    // Store the ID of the post (this can be the repost document's ID)
                    postElement.dataset.postId = post._id;

                    // --- Reposting Logic for Display ---
                    let repostIndicatorHTML = '';
                    let displayPost = post; // By default, assume it's an original post

                    if (post.is_repost) {
                        displayPost = post.original_post_details; // Use original details for content display

                        if (displayPost) { // Check if original post details are available
                            repostIndicatorHTML = `
                                <div class="repost-indicator">
                                    <i class="fas fa-retweet"></i> Reposted by ${post.author_name}
                                    ${post.content ? `<p class="repost-quote">${post.content}</p>` : ''}
                                </div>
                            `;
                        } else {
                            // Handle case where original post details are missing (e.g., original deleted)
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
                                    <div class="action-button repost-button" data-post-id="${post._id}" data-original-post-id="${post._id}" disabled title="Original post unavailable">
                                        <i class="fas fa-retweet"></i>
                                        <span>Repost (${post.repost_count || 0})</span>
                                    </div>
                                </div>
                            `;
                            postsContainer.appendChild(postElement);
                            return; // Skip remaining rendering for this specific post
                        }
                    }

                    // Determine the initial state of the like button for the displayed content
                    const likedClass = displayPost.current_user_liked ? 'liked' : '';
                    const likeIcon = displayPost.current_user_liked ? 'fas' : 'far'; // fas for filled, far for outlined

                    postElement.innerHTML = `
                        ${repostIndicatorHTML}
                        <div class="post-content-wrapper ${post.is_repost ? 'reposted-wrapper' : ''}">
                            <div class="post-header">
                                <img src="${displayPost.profile_pic_url || '/static/default-profile.jpg'}" alt="${displayPost.author_name}" class="profile-pic">
                                <div class="post-info">
                                    <span class="username">${displayPost.author_name}</span>
                                    <span class="timestamp">${new Date(displayPost.timestamp).toLocaleString()}</span>
                                </div>
                            </div>
                            <div class="post-body">
                                <p>${displayPost.content || ''}</p>
                                ${displayPost.image_url ? `<img src="${displayPost.image_url}" alt="Post Image" class="post-image">` : ''}
                            </div>
                            <div class="post-actions">
                                <div class="action-button like-button ${likedClass}" data-post-id="${displayPost._id}">
                                    <i class="${likeIcon} fa-thumbs-up"></i>
                                    <span class="like-count">${displayPost.like_count || 0}</span> Like
                                </div>
                                <a href="/post/${displayPost._id}/details" class="action-button comment-button">
                                    <i class="far fa-comment"></i>
                                    <span>Comment (${displayPost.comments_count || 0})</span>
                                </a>
                                <div class="action-button repost-button" data-post-id="${post._id}" data-original-post-id="${displayPost._id}">
                                    <i class="fas fa-retweet"></i>
                                    <span>Repost (${displayPost.repost_count || 0})</span>
                                </div>
                                
                            </div>
                        </div>
                    `;
                    postsContainer.appendChild(postElement);
                });

                // Attach event listeners after posts are added to the DOM
                attachLikeButtonListeners();
                attachRepostButtonListeners(); // Attach listeners for repost buttons

            } else {
                console.error('Failed to fetch posts:', data.message || 'Unknown error');
                postsContainer.innerHTML = `<p class="error-message">Failed to load posts: ${data.message || 'Server error'}</p>`;
            }
        } catch (error) {
            console.error('Error fetching and displaying posts:', error);
            postsContainer.innerHTML = '<p class="error-message">An error occurred while loading posts.</p>';
        }
    }

    function attachLikeButtonListeners() {
        document.querySelectorAll('.like-button').forEach(button => {
            // Remove existing listener to prevent duplicates if fetchAndDisplayPosts runs multiple times
            button.removeEventListener('click', handleLikeButtonClick);
            button.addEventListener('click', handleLikeButtonClick);
        });
    }

    // Function to attach repost button listeners
    function attachRepostButtonListeners() {
        document.querySelectorAll('.repost-button').forEach(button => {
            // Remove existing listener to prevent duplicates
            button.removeEventListener('click', (event) => handleRepost(event, button.dataset.postId));
            // Add the new listener, passing the actual 'post._id' (which could be the repost's ID)
            button.addEventListener('click', (event) => handleRepost(event, button.dataset.postId));
        });
    }

    async function handleLikeButtonClick(event) {
        const button = event.currentTarget;
        // This postId will be the ID of the content being displayed (original post's ID)
        const postId = button.dataset.postId;
        const isLiked = button.classList.contains('liked');
        const likeIcon = button.querySelector('i');
        const likeCountSpan = button.querySelector('.like-count');
        let currentLikeCount = parseInt(likeCountSpan.textContent) || 0;

        let url = `/api/posts/${postId}/${isLiked ? 'unlike' : 'like'}`;
        let method = 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json();

            if (response.ok) {
                if (data.liked) {
                    button.classList.add('liked');
                    likeIcon.classList.remove('far');
                    likeIcon.classList.add('fas');
                    currentLikeCount++;
                } else if (data.unliked) {
                    button.classList.remove('liked');
                    likeIcon.classList.remove('fas');
                    likeIcon.classList.add('far');
                    currentLikeCount--;
                }
                likeCountSpan.textContent = currentLikeCount;
            } else {
                alert(data.message || 'Error performing action.');
                console.error('API Error:', data.message);
                if (response.status === 401) {
                    window.location.href = '/login';
                }
            }
        } catch (error) {
            console.error('Network or system error:', error);
            alert('An unexpected error occurred.');
        }
    }

    // Call the function to fetch and display posts when the page loads
    fetchAndDisplayPosts();

}); // End of DOMContentLoaded