document.addEventListener('DOMContentLoaded', () => {
    // Get references to the form and the message display area
    const form = document.getElementById('reset-password-form');
    const statusMessage = document.getElementById('status-message');

    // Check if the form exists on the page
    if (form) {
        // --- IMPORTANT: Extract the token from the current URL ---
        // The URL will look something like: http://127.0.0.1:5000/reset_password/YOUR_UNIQUE_TOKEN
        const pathSegments = window.location.pathname.split('/');
        // The token should be the last segment in the URL path
        const token = pathSegments[pathSegments.length - 1];

        // Add an event listener for the form's submission
        form.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent the default browser form submission

            // Get the new password and confirm password values
            const newPassword = form.new_password.value;
            const confirmPassword = form.confirm_password.value;

            // Basic client-side validation
            if (newPassword !== confirmPassword) {
                statusMessage.textContent = 'Passwords do not match!';
                statusMessage.className = 'error-message';
                return; // Stop execution if passwords don't match
            }
            if (newPassword.length < 6) { // Matches backend validation
                statusMessage.textContent = 'Password must be at least 6 characters long.';
                statusMessage.className = 'error-message';
                return;
            }

            // Display a processing message
            statusMessage.textContent = 'Resetting password...';
            statusMessage.className = 'info-message';

            try {
                // Send a POST request to your Flask API endpoint for password reset
                const response = await fetch(`/reset_password/${token}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json', // Indicate that we're sending JSON
                    },
                    // Send the new password and confirmed password as JSON
                    body: JSON.stringify({ new_password: newPassword, confirm_password: confirmPassword }),
                });

                // Parse the JSON response from the server
                const data = await response.json();

                // Check if the response was successful (HTTP status 2xx)
                if (response.ok) {
                    statusMessage.textContent = data.message;
                    statusMessage.className = 'success-message';
                    // Redirect to login page after a short delay for better UX
                    if (data.redirect_url) {
                        setTimeout(() => {
                            window.location.href = data.redirect_url;
                        }, 3000); // Redirect after 3 seconds
                    }
                } else {
                    // If the response was not OK, display the error message from the server
                    statusMessage.textContent = data.message || 'An error occurred during password reset.';
                    statusMessage.className = 'error-message';
                }
            } catch (error) {
                // Catch any network errors or issues with the fetch request
                console.error('Error resetting password:', error);
                statusMessage.textContent = 'Failed to connect to the server. Please check your internet connection and try again.';
                statusMessage.className = 'error-message';
            }
        });
    }
});
