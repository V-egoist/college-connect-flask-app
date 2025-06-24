// static/communities.js
document.addEventListener('DOMContentLoaded', async function() {
    // DOM Element References
    const joinedCommunitiesGrid = document.getElementById('joinedCommunitiesGrid');
    const allCommunitiesGrid = document.getElementById('allCommunitiesGrid');
    const noJoinedCommunitiesMessage = document.getElementById('noJoinedCommunitiesMessage');
    const noAllCommunitiesMessage = document.getElementById('noAllCommunitiesMessage');

    const toggleCreateCommunityFormBtn = document.getElementById('toggleCreateCommunityFormBtn');
    const createCommunityFormContainer = document.getElementById('createCommunityFormContainer');
    const createCommunityForm = document.getElementById('createCommunityForm');
    const cancelCreateCommunityBtn = document.getElementById('cancelCreateCommunityBtn');

    const communityNameInput = document.getElementById('communityName');
    const communityDescriptionInput = document.getElementById('communityDescription');
    const communityProfilePicInput = document.getElementById('communityProfilePic');
    const communityPicturePreview = document.getElementById('communityPicturePreview');
    const formMessage = document.getElementById('formMessage');

    // Get the current user's ID from the global window object (set in Flask template)
    const currentUserId = window.CURRENT_USER_ID;
    console.log("Current User ID from window:", currentUserId);


    // --- Helper Function: Render Community Card ---
    // This function creates the HTML for a single community card.
    function renderCommunityCard(community, isMember) {
        const communityCard = document.createElement('div');
        communityCard.className = 'community-card';

        // Determine button text and class based on membership status
        const buttonText = isMember ? 'Leave Community' : 'Join Community';
        const buttonClass = isMember ? 'btn-danger' : 'btn-primary';

        // Set default image if none is provided
        const imageUrl = community.community_picture_url || '/static/default-community-pic.png';

        communityCard.innerHTML = `
            <a href="/communities/${community._id}">
                <img src="${imageUrl}" alt="${community.name}" class="community-card-img">
            </a>
            <div class="community-card-body">
                <h3 class="community-card-title"><a href="/communities/${community._id}">${community.name}</a></h3>
                <p class="community-card-description">${community.description}</p>
            </div>
            <div class="community-card-footer">
                <span class="members-count">${community.members_count || 0} members</span>
                ${currentUserId && currentUserId !== 'None' ? ` <button type="button" class="btn ${buttonClass} community-action-btn" data-community-id="${community._id}" data-action="${isMember ? 'leave' : 'join'}">
                        ${buttonText}
                    </button>
                ` : ''}
            </div>
        `;
        return communityCard;
    }

    // --- Main Function: Fetch and Display Communities ---
    async function fetchAndDisplayCommunities() {
        try {
            const response = await fetch('/api/communities', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to fetch communities:', errorData.message);
                if (noAllCommunitiesMessage) {
                    noAllCommunitiesMessage.textContent = 'Could not load communities. Please try again.';
                    noAllCommunitiesMessage.style.display = 'block';
                }
                return;
            }

            const communities = await response.json();
            console.log('Fetched communities:', communities);

            // Clear existing content
            if (joinedCommunitiesGrid) joinedCommunitiesGrid.innerHTML = '';
            if (allCommunitiesGrid) allCommunitiesGrid.innerHTML = '';
            if (noJoinedCommunitiesMessage) noJoinedCommunitiesMessage.style.display = 'none';
            if (noAllCommunitiesMessage) noAllCommunitiesMessage.style.display = 'none';

            let hasJoinedCommunities = false;
            let hasAvailableCommunities = false; // Track if there are non-joined communities

            if (communities.length === 0) {
                if (noAllCommunitiesMessage) noAllCommunitiesMessage.style.display = 'block';
            } else {
                communities.forEach(community => {
                    // Check if the current user is a member of this community
                    const isMember = community.members && community.members.some(memberId => String(memberId) === String(currentUserId));

                    if (isMember) {
                        // If the user is a member, add it to 'Your Communities'
                        if (joinedCommunitiesGrid) {
                            const communityCard = renderCommunityCard(community, isMember);
                            joinedCommunitiesGrid.appendChild(communityCard);
                            hasJoinedCommunities = true;
                        }
                    } else {
                        // If the user is NOT a member, add it to 'All Communities'
                        if (allCommunitiesGrid) {
                            const communityCard = renderCommunityCard(community, isMember);
                            allCommunitiesGrid.appendChild(communityCard);
                            hasAvailableCommunities = true;
                        }
                    }
                });

                // Display 'No communities' messages if grids are empty
                if (!hasJoinedCommunities && noJoinedCommunitiesMessage) {
                    noJoinedCommunitiesMessage.style.display = 'block';
                }
                if (!hasAvailableCommunities && noAllCommunitiesMessage) {
                    noAllCommunitiesMessage.style.display = 'block';
                }
            }

        } catch (error) {
            console.error('Error fetching or displaying communities:', error);
            if (noAllCommunitiesMessage) {
                noAllCommunitiesMessage.textContent = 'Failed to load communities due to a network error.';
                noAllCommunitiesMessage.style.display = 'block';
            }
        }
    }

    // --- Function to handle Join/Leave Community Actions ---
    async function handleCommunityAction(communityId, actionType) {
        if (!currentUserId || currentUserId === 'None') { // Check if user ID is valid
            alert('You must be logged in to perform this action.');
            window.location.href = '/login'; // Redirect to login if not logged in
            return;
        }

        const endpoint = `/api/communities/${communityId}/${actionType}`;
        console.log(`Attempting to ${actionType} community: ${communityId} via ${endpoint}`);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId })
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message);
                fetchAndDisplayCommunities(); // Re-fetch to update the UI
            } else {
                alert('Failed to ' + actionType + ' community: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error(`Error ${actionType}ing community:`, error);
            alert('An error occurred while trying to ' + actionType + ' the community.');
        }
    }

    // --- Event Delegation for Join/Leave Buttons ---
    // Attach single click listeners to parent grids for efficiency
    function attachCommunityGridListeners(gridElement) {
        if (gridElement) {
            gridElement.addEventListener('click', function(event) {
                const targetButton = event.target.closest('.community-action-btn');
                if (targetButton) {
                    const communityId = targetButton.dataset.communityId;
                    const actionType = targetButton.dataset.action;
                    if (communityId && actionType) {
                        handleCommunityAction(communityId, actionType);
                    }
                }
            });
        }
    }

    attachCommunityGridListeners(joinedCommunitiesGrid);
    attachCommunityGridListeners(allCommunitiesGrid);


    // --- Toggle Create Community Form Visibility ---
    if (toggleCreateCommunityFormBtn && createCommunityFormContainer) {
        toggleCreateCommunityFormBtn.addEventListener('click', () => {
            createCommunityFormContainer.classList.toggle('active');
            // Clear form and messages when opening or closing
            if (!createCommunityFormContainer.classList.contains('active')) {
                createCommunityForm.reset();
                if (communityPicturePreview) {
                    communityPicturePreview.src = "/static/default-community-pic.png";
                    communityPicturePreview.parentElement.classList.remove('has-image'); // Remove has-image class
                }
                if (formMessage) formMessage.textContent = '';
            } else {
                // When opening, ensure default image state
                if (communityPicturePreview && !communityProfilePicInput.files[0]) {
                    communityPicturePreview.src = "/static/default-community-pic.png";
                    communityPicturePreview.parentElement.classList.remove('has-image'); // Default state is no custom image
                }
            }
        });
    }

    // --- Cancel Create Community Form ---
    if (cancelCreateCommunityBtn && createCommunityFormContainer) {
        cancelCreateCommunityBtn.addEventListener('click', () => {
            createCommunityFormContainer.classList.remove('active');
            if (createCommunityForm) createCommunityForm.reset();
            if (communityPicturePreview) {
                communityPicturePreview.src = "/static/default-community-pic.png";
                communityPicturePreview.parentElement.classList.remove('has-image'); // Remove has-image class
            }
            if (formMessage) formMessage.textContent = '';
        });
    }

    // --- Handle Community Profile Picture Preview ---
    if (communityProfilePicInput && communityPicturePreview) {
        communityProfilePicInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    communityPicturePreview.src = e.target.result;
                    // Add 'has-image' class to parent to show image and hide camera icon
                    communityPicturePreview.parentElement.classList.add('has-image');
                };
                reader.readAsDataURL(file);
            } else {
                // If no file is selected (e.g., cleared), revert to default
                communityPicturePreview.src = "/static/default-community-pic.png";
                communityPicturePreview.parentElement.classList.remove('has-image'); // Remove has-image class
            }
        });
    }

    // --- Create Community Form Submission ---
    if (createCommunityForm) {
        createCommunityForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            if (formMessage) {
                formMessage.textContent = 'Creating community...';
                formMessage.style.color = '#555';
            }

            const formData = new FormData();
            formData.append('name', communityNameInput.value);
            formData.append('description', communityDescriptionInput.value);
            
            if (communityProfilePicInput.files[0]) {
                formData.append('community_picture', communityProfilePicInput.files[0]);
            }

            try {
                const response = await fetch('/api/communities', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    if (formMessage) {
                        formMessage.textContent = data.message;
                        formMessage.style.color = 'green';
                    }
                    
                    setTimeout(() => {
                        window.location.href = `/communities/${data.community_id}`; // Redirect to new community's page
                    }, 1000);
                    
                    // Clear the form and hide it
                    if (createCommunityForm) createCommunityForm.reset();
                    if (communityPicturePreview) {
                        communityPicturePreview.src = "/static/default-community-pic.png";
                        communityPicturePreview.parentElement.classList.remove('has-image');
                    }
                    if (createCommunityFormContainer) createCommunityFormContainer.classList.remove('active');

                } else {
                    if (formMessage) {
                        formMessage.textContent = 'Failed to create community: ' + (data.message || 'Unknown error');
                        formMessage.style.color = 'red';
                    }
                }
            } catch (error) {
                console.error('Error creating community:', error);
                if (formMessage) {
                    formMessage.textContent = 'An error occurred. Please check your connection.';
                    formMessage.style.color = 'red';
                }
            }
        });
    }

    // --- Logout Button Listener ---
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            const response = await fetch('/logout', { method: 'POST' });
            if (response.ok) {
                window.location.href = '/login'; // Redirect to login page after logout
            } else {
                alert('Failed to logout. Please try again.');
            }
        });
    }

    // --- Initial Load ---
    fetchAndDisplayCommunities();

    // Initial check for default image on load for the preview
    // Ensure the camera icon is correctly shown/hidden based on the initial image.
    if (communityPicturePreview && communityPicturePreview.src.includes('default-community-pic.png')) {
        communityPicturePreview.parentElement.classList.remove('has-image'); // Default image -> show camera
    } else if (communityPicturePreview && communityPicturePreview.src) {
        communityPicturePreview.parentElement.classList.add('has-image'); // Real image -> hide camera
    }
});