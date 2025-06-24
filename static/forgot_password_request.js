document.addEventListener('DOMContentLoaded', () => {
    // Get references to the form and the message display area
    const form = document.getElementById('forgot-password-form');
    const messageArea = document.getElementById('message-area');

    // Check if the form exists on the page
    if (form) {
        // Add an event listener for the form's submission
        form.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent the default browser form submission

            // Get the email value from the input field
            const email = form.email.value;

            // Display a loading/sending message to the user
            messageArea.textContent = 'Sending request...';
            messageArea.className = 'info-message'; // You might need to define this class in your CSS

            try {
                // Send a POST request to your Flask API endpoint
                const response = await fetch('/api/request_password_reset', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json', // Indicate that we're sending JSON
                    },
                    body: JSON.stringify({ email: email }), // Send the email as JSON
                });

                // Parse the JSON response from the server
                const data = await response.json();

                // Check if the response was successful (HTTP status 2xx)
                if (response.ok) {
                    messageArea.textContent = data.message;
                    messageArea.className = 'success-message'; // Define this class for success styling
                } else {
                    // If the response was not OK, display the error message from the server
                    messageArea.textContent = data.message || 'An error occurred during password reset request.';
                    messageArea.className = 'error-message'; // Define this class for error styling
                }
            } catch (error) {
                // Catch any network errors or issues with the fetch request
                console.error('Error sending password reset request:', error);
                messageArea.textContent = 'Failed to connect to the server. Please check your internet connection and try again.';
                messageArea.className = 'error-message';
            }
        });
    }
});
