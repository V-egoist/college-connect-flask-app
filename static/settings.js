// static/settings.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const settingsMenu = document.querySelector('.settings-menu');
    const settingsSections = document.querySelectorAll('.settings-section');
    const profileSettingsForm = document.getElementById('profile-settings-form');
    const changePasswordForm = document.getElementById('change-password-form');
    const usernameInput = document.getElementById('username-input');
    const usernameChangeInfo = document.getElementById('username-change-info');
    const logoutButton = document.getElementById('logout-button');
    const messageBox = document.getElementById('custom-message-box');

    // NEW: Profile Picture Elements (ensure these IDs are in settings.html)
    const profilePicInput = document.getElementById('profile-picture-input');
    const profilePicPreview = document.getElementById('profile-pic-preview');
    // Get a reference to the profile picture in the top navigation bar
    const topNavProfilePic = document.querySelector('.top-nav .profile-pic img');


    // --- Constants ---
    // This constant should match the timedelta(days=X) used in your Flask backend for username changes.
    // Flask uses timedelta(days=30), so this is set to 30 days in milliseconds.
    const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000; 

    // --- Helper Function for Messages ---
    // This function can now accept a simple string message or an object { message: "...", type: "..." }
    function showMessage(message, type = 'info') {
        // Clear previous messages before showing new ones to prevent stacking
        messageBox.innerHTML = ''; 
        // Reset all possible type classes before adding the new one
        messageBox.classList.remove('show', 'success', 'danger', 'info', 'warning', 'error'); 

        let actualMessage = typeof message === 'string' ? message : message.message;
        let actualType = typeof message === 'string' ? type : message.type;

        messageBox.textContent = actualMessage;
        messageBox.classList.add('show', actualType); // Apply 'show' and the specific type class
        
        // Hide the message after a set duration (e.g., 3 seconds)
        setTimeout(() => {
            messageBox.classList.remove('show');
        }, 3000); 
    }

    // --- Section Switching Logic ---
    // Handles clicks on the sidebar menu to switch between settings sections
    settingsMenu.addEventListener('click', (event) => {
        const clickedMenuItem = event.target.closest('li');
        // Ensure a list item was clicked and it has a 'data-section' attribute
        // Also, prevent this listener from interfering with the logout button click
        if (clickedMenuItem && clickedMenuItem.dataset.section) {
            // Remove 'active' class from all menu items in the sidebar
            settingsMenu.querySelectorAll('li').forEach(item => {
                item.classList.remove('active');
            });
            // Add 'active' class to the newly clicked menu item
            clickedMenuItem.classList.add('active');

            // Hide all content sections by removing 'active-section' class
            settingsSections.forEach(section => {
                section.classList.remove('active-section');
            });
            // Show the corresponding content section by adding 'active-section' class
            const targetSectionId = clickedMenuItem.dataset.section;
            const targetSection = document.getElementById(targetSectionId);
            if (targetSection) {
                targetSection.classList.add('active-section');
            }
        } else if (event.target.id === 'logout-button' || event.target.closest('#logout-button')) {
            // If the logout button or its child is clicked, let its dedicated listener handle it.
            return; 
        }
    });

    // --- Profile Picture Live Preview ---
    // Displays a real-time preview of the selected image file before upload
    if (profilePicInput && profilePicPreview) {
        profilePicInput.addEventListener('change', function(event) {
            const file = event.target.files[0]; // Get the first selected file
            if (file) {
                const reader = new FileReader(); // Create a FileReader to read the file contents
                reader.onload = function(e) {
                    profilePicPreview.src = e.target.result; // Set the <img> src to the loaded data URL
                };
                reader.readAsDataURL(file); // Read the file as a data URL (base64 string)
            }
        });
    }

    // --- Username Change Logic (30-day cooldown display) ---
    // Checks the last username change date and disables the input if within cooldown
    function applyUsernameChangeRules() {
        // Get the last change date from the data attribute on the username input
        const lastChangeDateStr = usernameInput.dataset.lastUsernameChange;
        if (lastChangeDateStr) {
            const lastChangeDate = new Date(lastChangeDateStr);
            const now = new Date();
            const timeSinceLastChange = now.getTime() - lastChangeDate.getTime();

            if (timeSinceLastChange < THIRTY_DAYS_IN_MS) {
                usernameInput.disabled = true; // Disable input if cooldown is active
                const nextChangeDate = new Date(lastChangeDate.getTime() + THIRTY_DAYS_IN_MS);
                usernameChangeInfo.textContent = `Username can be changed again on: ${nextChangeDate.toLocaleDateString()}`;
                usernameChangeInfo.style.color = '#ef4444'; // Red for restriction
            } else {
                usernameInput.disabled = false; // Enable input if cooldown is over
                usernameChangeInfo.textContent = 'You can change your username now.';
                usernameChangeInfo.style.color = '#10b981'; // Green for availability
            }
        } else {
            // If no last change date, assume first change
            usernameInput.disabled = false;
            usernameChangeInfo.textContent = 'You can change your username now (first change).';
            usernameChangeInfo.style.color = '#10b981';
        }
    }

    // Call rules on page load to set initial state of username input
    applyUsernameChangeRules();

    // --- Form Submission Handlers ---

    // Profile Settings Form (for email, course, bio, username, AND profile picture)
    profileSettingsForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent default browser form submission
        const saveButton = profileSettingsForm.querySelector('.save-button');
        saveButton.disabled = true; // Disable button to prevent double-submission
        saveButton.textContent = 'Saving...'; // Change button text to indicate saving

        // Use FormData directly for multipart/form-data, essential for file uploads.
        // FormData automatically handles encoding all form fields (text and files).
        const formData = new FormData(profileSettingsForm); 
        
        // Optimize: If username is disabled or hasn't changed, remove it from formData.
        // Flask backend also handles this, but it can make the request smaller.
        if (usernameInput.disabled || formData.get('username') === usernameInput.defaultValue) {
             formData.delete('username');
        }

        try {
            // Send the form data to the Flask backend's /settings route
            const response = await fetch(profileSettingsForm.action, { 
                method: 'POST',
                body: formData // Send FormData directly; browser sets Content-Type header automatically
            });

            const result = await response.json(); // Parse the JSON response from Flask

            // Clear any old messages from the message box
            messageBox.innerHTML = '';
            messageBox.classList.remove('show', 'success', 'danger', 'info', 'warning', 'error');

            // Display all messages returned by Flask (Flask now sends an array of messages)
            if (result.messages && Array.isArray(result.messages)) {
                result.messages.forEach(msg => {
                    showMessage(msg.message, msg.type); // Show each message individually
                });
            } else if (result.message) { // Fallback for a single message (if Flask sends it that way)
                 showMessage(result.message, result.type || 'info');
            } else if (!response.ok) { // Generic error if response not OK and no specific message
                 showMessage('An unknown error occurred during update.', 'danger');
            }
            
            // If Flask confirms username was changed, update the data-last-username-change attribute
            // and re-apply rules to reflect new cooldown period.
            if (result.updated_username_date) {
                usernameInput.dataset.lastUsernameChange = result.updated_username_date;
                applyUsernameChangeRules(); 
            }

            // If a new profile picture URL is returned, update the top navigation image source.
            if (result.profile_pic_url && topNavProfilePic) {
                topNavProfilePic.src = result.profile_pic_url;
            }

        } catch (error) {
            console.error('Error updating profile:', error); // Log detailed error to console
            showMessage(`An error occurred: ${error.message}`, 'danger'); // Show user-friendly error
        } finally {
            saveButton.disabled = false; // Re-enable the save button
            saveButton.textContent = 'Save Changes'; // Restore button text
        }
    });

    // Change Password Form Submission
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmNewPassword = document.getElementById('confirm-new-password').value;
        const changePwButton = changePasswordForm.querySelector('.save-button');

        if (newPassword !== confirmNewPassword) {
            showMessage('New passwords do not match!', 'error');
            return;
        }
        if (newPassword.length < 6) { // Example: enforce minimum password length
            showMessage('New password must be at least 6 characters long.', 'error');
            return;
        }

        changePwButton.disabled = true;
        changePwButton.textContent = 'Changing...';

        try {
            // Send password change request to Flask API endpoint
            const response = await fetch('/api/settings/change_password', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }, // This is JSON, so set header
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to change password.');
            }

            const result = await response.json();
            showMessage(result.message || 'Password changed successfully!', 'success');
            changePasswordForm.reset(); // Clear password fields on success

        } catch (error) {
            console.error('Error changing password:', error);
            showMessage(`Error: ${error.message}`, 'error');
        } finally {
            changePwButton.disabled = false;
            changePwButton.textContent = 'Change Password';
        }
    });

    // Logout Button Event Listener
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            // Using window.confirm as a simple modal for logout confirmation.
            // For Canvas compatibility, avoid native alert()/confirm() unless specifically allowed.
            // If you need a custom modal, you'd replace this if() block.
            if (window.confirm('Are you sure you want to log out?')) { 
                try {
                    // Send POST request to Flask logout endpoint
                    const response = await fetch('/logout', { method: 'POST' }); 
                    const data = await response.json(); // Expecting JSON response from Flask logout

                    if (data.redirect) { // Flask /logout now sends a 'redirect' URL
                        showMessage('Logged out successfully.', 'success'); // Show message before redirecting
                        // Give a small delay for the user to see the message before redirection
                        setTimeout(() => { 
                            window.location.href = data.redirect; // Redirect to the login page
                        }, 500); 
                    } else if (response.ok) { // Fallback if no redirect URL is provided but status is OK
                        showMessage('Logged out successfully.', 'success');
                        setTimeout(() => { window.location.href = '/login'; }, 500); // Default redirect
                    } else { // Handle non-OK response from Flask
                        showMessage(`Logout failed: ${data.message || 'Unknown error'}`, 'error');
                    }
                } catch (error) {
                    console.error('Logout error:', error); // Log network or other JS errors
                    showMessage('An error occurred during logout.', 'error');
                }
            }
        });
    }

    // --- Initial setup: Show Account Settings section by default when page loads ---
    document.getElementById('account-settings').classList.add('active-section');
});
