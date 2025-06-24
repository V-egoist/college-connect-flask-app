// static/comments.js

document.addEventListener('DOMContentLoaded', function() {
    // POST_ID is available globally from the comments.html script tag
    // const POST_ID = "{{ post_id }}"; // This line is for reference, actual value is injected by Jinja2

    if (!POST_ID) {
        console.error("Post ID not found! Cannot fetch comments.");
        // Redirect or show an error message
        return;
    }

    const originalPostDisplay = document.getElementById('original-post-display');
    const commentsList = document.getElementById('comments-list');
    const commentInput = document.getElementById('comment-input');
    const postCommentBtn = document.getElementById('post-comment-btn');
    const currentUserAvatarCommentForm = document.getElementById('current-user-avatar-comment-form');

    // Function to fetch and display the original post and its comments
    async function fetchPostAndComments() {
        try {
            // API call to get the specific post details
            const response = await fetch(`/api/posts/${POST_ID}`);
            const data = await response.json();

            if (response.ok) {
                renderPost(data.post); // Render the main post
                renderComments(data.comments); // Render comments associated with the post
                // Update current user's avatar on the comment form
                if (data.current_user_profile_pic) {
                    currentUserAvatarCommentForm.src = data.current_user_profile_pic;
                }
            } else {
                console.error('Failed to fetch post and comments:', data.message || 'Unknown error');
                originalPostDisplay.innerHTML = `<p class="error-message">Error: ${data.message || 'Could not load post.'}</p>`;
                commentsList.innerHTML = ''; // Clear comments if post fails to load
            }
        } catch (error) {
            console.error('Network error fetching post and comments:', error);
            originalPostDisplay.innerHTML = '<p class="error-message">An error occurred while connecting to the server.</p>';
            commentsList.innerHTML = '';
        }
    }

    // Function to render the original post details
    function renderPost(post) {
        if (!post) {
            originalPostDisplay.innerHTML = '<p>Post not found.</p>';
            return;
        }

        const likedClass = post.current_user_liked ? 'liked' : '';
        const likeIcon = post.current_user_liked ? 'fas' : 'far';

        originalPostDisplay.innerHTML = `
            <div class="post-header">
                <img id="post-author-avatar" src="${post.profile_pic_url}" alt="${post.author_name}" class="profile-pic">
                <div class="post-user-info">
                    <h4 id="post-author-name">${post.author_name}</h4>
                    <p id="post-timestamp">${new Date(post.timestamp).toLocaleString()}</p>
                </div>
            </div>
            <div class="post-content">
                <p id="post-content-text">${post.content}</p>
            </div>
            ${post.image_url ? `<img id="post-image" src="${post.image_url}" alt="Post Image" class="post-image">` : '<img id="post-image" src="" style="display: none;">'}
            <div class="post-actions">
                
            </div>
        `;
        // Add like button listener for the original post here (similar to main.js)
        const postLikeButton = originalPostDisplay.querySelector('.like-button');
        if (postLikeButton) {
            postLikeButton.addEventListener('click', handleLikeButtonClick);
        }
    }

    // Function to render comments
    function renderComments(comments) {
        commentsList.innerHTML = ''; // Clear existing comments
        if (comments && comments.length > 0) {
            comments.forEach(comment => {
                const commentElement = document.createElement('div');
                commentElement.classList.add('comment');
                commentElement.dataset.commentId = comment._id; // Store comment ID

                // Determine initial like state for comments
                const commentLikedClass = comment.current_user_liked ? 'liked' : '';
                const commentLikeIcon = comment.current_user_liked ? 'fas' : 'far';

                commentElement.innerHTML = `
                    <img src="${comment.author_profile_pic_url}" alt="${comment.author_name}" class="comment-avatar">
                    <div class="comment-content">
                        <div class="comment-header">
                            <h5>${comment.author_name}</h5>
                            <span class="comment-time">${new Date(comment.timestamp).toLocaleString()}</span>
                        </div>
                        <p>${comment.content}</p>
                        <div class="comment-actions">
                            <button class="comment-like-btn ${commentLikedClass}" data-comment-id="${comment._id}">
                                <i class="${commentLikeIcon} fa-thumbs-up"></i> Like (<span class="comment-like-count">${comment.like_count || 0}</span>)
                            </button>
                            <button class="comment-reply-btn" data-comment-id="${comment._id}">Reply</button>
                        </div>

                        <div class="reply-form" style="display: none;">
                            <img src="${currentUserAvatarCommentForm.src}" alt="Your Avatar" class="reply-avatar">
                            <div class="reply-input-container">
                                <textarea placeholder="Write a reply..." rows="1"></textarea>
                                <button class="post-reply-btn" data-comment-id="${comment._id}">Reply</button>
                            </div>
                        </div>

                        <div class="replies" id="replies-for-comment-${comment._id}">
                            ${comment.replies && comment.replies.length > 0 ?
                                comment.replies.map(reply => `
                                    <div class="reply" data-reply-id="${reply._id}">
                                        <img src="${reply.author_profile_pic_url}" alt="${reply.author_name}" class="reply-avatar">
                                        <div class="reply-content">
                                            <div class="reply-header">
                                                <h6>${reply.author_name}</h6>
                                                <span class="reply-time">${new Date(reply.timestamp).toLocaleString()}</span>
                                            </div>
                                            <p>${reply.content}</p>
                                            <div class="reply-actions">
                                                <button class="reply-like-btn ${reply.current_user_liked ? 'liked' : ''}" data-reply-id="${reply._id}">
                                                    <i class="${reply.current_user_liked ? 'fas' : 'far'} fa-thumbs-up"></i> Like (<span class="reply-like-count">${reply.like_count || 0}</span>)
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')
                                : ''}
                        </div>
                    </div>
                `;
                commentsList.appendChild(commentElement);

                // Add event listener for reply button
                const replyButton = commentElement.querySelector('.comment-reply-btn');
                if (replyButton) {
                    replyButton.addEventListener('click', toggleReplyForm);
                }
                // Add event listener for comment like button
                const commentLikeButton = commentElement.querySelector('.comment-like-btn');
                if (commentLikeButton) {
                    commentLikeButton.addEventListener('click', handleCommentLikeButtonClick);
                }
                // Add event listener for reply post button
                const postReplyButton = commentElement.querySelector('.post-reply-btn');
                if (postReplyButton) {
                    postReplyButton.addEventListener('click', handlePostReply);
                }
                // NEW: Add event listeners for reply like buttons
                const replyLikeButtons = commentElement.querySelectorAll('.reply-like-btn');
                replyLikeButtons.forEach(button => {
                    button.addEventListener('click', handleReplyLikeButtonClick);
                });
            });
        } else {
            commentsList.innerHTML = '<p>No comments yet. Be the first to comment!</p>';
        }
    }


    // Handle toggling the reply form
    function toggleReplyForm(event) {
        const commentElement = event.target.closest('.comment');
        const replyForm = commentElement.querySelector('.reply-form');
        if (replyForm) {
            replyForm.style.display = replyForm.style.display === 'none' ? 'flex' : 'none';
            if (replyForm.style.display === 'flex') {
                replyForm.querySelector('textarea').focus();
            }
        }
    }

    // Event listener for posting a new comment
    if (postCommentBtn) {
        postCommentBtn.addEventListener('click', async () => {
            const content = commentInput.value.trim();
            if (!content) {
                alert('Comment cannot be empty.');
                return;
            }

            try {
                const response = await fetch(`/api/posts/${POST_ID}/comments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ content: content })
                });
                const data = await response.json();

                if (response.ok) {
                    alert('Comment posted successfully!');
                    commentInput.value = ''; // Clear input
                    fetchPostAndComments(); // Re-fetch all to update
                } else {
                    alert(`Error: ${data.message || 'Failed to post comment.'}`);
                }
            } catch (error) {
                console.error('Error posting comment:', error);
                alert('An error occurred while posting your comment.');
            }
        });
    }

    // Function to handle liking posts (can be reused from main.js or adapted)
    async function handleLikeButtonClick(event) {
        const button = event.currentTarget;
        const postId = button.dataset.postId;
        const isLiked = button.classList.contains('liked');
        const likeIcon = button.querySelector('i');
        const likeCountSpan = button.querySelector('#post-likes') || button.querySelector('.like-count'); // Adapt for main post or individual comments
        let currentLikeCount = parseInt(likeCountSpan.textContent.match(/\d+/)) || 0; // Extract number from "Like (X)"

        let url = `/api/posts/${postId}/${isLiked ? 'unlike' : 'like'}`;

        try {
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
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
                likeCountSpan.textContent = `Like (${currentLikeCount})`; // Update "Like (X)"
            } else {
                alert(data.message || 'Error performing like/unlike action.');
                console.error('API Error:', data.message);
                if (response.status === 401) {
                    window.location.href = '/login';
                }
            }
        } catch (error) {
            console.error('Network or system error on like:', error);
            alert('An unexpected error occurred during like/unlike.');
        }
    }

    // Function to handle liking comments (new for comments.js)
    async function handleCommentLikeButtonClick(event) {
        const button = event.currentTarget;
        const commentId = button.dataset.commentId;
        const isLiked = button.classList.contains('liked');
        const likeIcon = button.querySelector('i');
        const likeCountSpan = button.querySelector('.comment-like-count');
        let currentLikeCount = parseInt(likeCountSpan.textContent) || 0;

        const url = `/api/comments/${commentId}/${isLiked ? 'unlike' : 'like'}`;

        try {
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
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
                alert(data.message || 'Error performing comment like/unlike action.');
                console.error('API Error:', data.message);
                if (response.status === 401) {
                    window.location.href = '/login';
                }
            }
        } catch (error) {
            console.error('Network or system error on comment like:', error);
            alert('An unexpected error occurred during comment like/unlike.');
        }
    }

    // Function to handle posting replies
    async function handlePostReply(event) {
        const button = event.currentTarget;
        const commentId = button.dataset.commentId;
        const replyForm = button.closest('.reply-form');
        const textarea = replyForm.querySelector('textarea');
        const content = textarea.value.trim();

        if (!content) {
            alert('Reply cannot be empty.');
            return;
        }

        try {
            const response = await fetch(`/api/comments/${commentId}/replies`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: content })
            });
            const data = await response.json();

            if (response.ok) {
                alert('Reply posted successfully!');
                textarea.value = ''; // Clear input
                replyForm.style.display = 'none'; // Hide form
                fetchPostAndComments(); // Re-fetch all to update
            } else {
                alert(`Error: ${data.message || 'Failed to post reply.'}`);
            }
        } catch (error) {
            console.error('Error posting reply:', error);
            alert('An error occurred while posting your reply.');
        }
    }

    // NEW: Function to handle liking replies
    async function handleReplyLikeButtonClick(event) {
        const button = event.currentTarget;
        const replyId = button.dataset.replyId;
        const isLiked = button.classList.contains('liked');

        const likeIcon = button.querySelector('i');
        const likeCountSpan = button.querySelector('.reply-like-count');
        let currentLikeCount = parseInt(likeCountSpan.textContent) || 0;

        const url = `/api/replies/${replyId}/like`; // API endpoint for liking replies

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();

            if (response.ok) {
                if (data.current_user_liked) {
                    button.classList.add('liked');
                    likeIcon.classList.remove('far');
                    likeIcon.classList.add('fas');
                } else {
                    button.classList.remove('liked');
                    likeIcon.classList.remove('fas');
                    likeIcon.classList.add('far');
                }
                likeCountSpan.textContent = data.like_count; // Update count from backend
            } else {
                alert(data.message || 'Error performing reply like/unlike action.');
                console.error('API Error liking reply:', data.message);
                if (response.status === 401) {
                    window.location.href = '/login';
                }
            }
        } catch (error) {
            console.error('Network or system error on reply like:', error);
            alert('An unexpected error occurred during reply like/unlike.');
        }
    }


    // Initial call to fetch data when the comments page loads
    fetchPostAndComments();
});