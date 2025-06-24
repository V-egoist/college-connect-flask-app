// static/auth.js
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form'); // This matches your original code

    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const identifier = document.getElementById('identifier').value;
            const password = document.getElementById('password').value;

            fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: identifier, password: password }),
            })
            .then(response => {
                // It's better to try and parse JSON even for errors to get backend messages
                return response.json().then(data => ({ status: response.status, body: data, ok: response.ok }));
            })
            .then(result => {
                const { status, body, ok } = result;
                if (ok && body.redirect) { // Check response.ok for success
                    alert(body.message || 'Login successful!'); // Use backend message or default
                    console.log('Login successful:', body);
                    if (body.redirect) {
                        window.location.href = body.redirect;
                    }
                } else {
                    // Handle login errors - display in a general error div if you add one to login.html
                    const errorMessage = body.message || `Login failed (Status: ${status})`;
                    alert(errorMessage);
                    console.error('Login error:', body);
                    // Example: const generalLoginErrorEl = document.getElementById('generalLoginError');
                    // if(generalLoginErrorEl) generalLoginErrorEl.textContent = errorMessage;
                }
            })
            .catch(error => {
                console.error('There was an error during login:', error);
                alert('An error occurred during login. Please check network or console.');
            });
        });
    }

    if (registerForm) {
        // Get references to error display elements from your register.html
        const nameErrorEl = document.getElementById('nameError');
        const usernameErrorEl = document.getElementById('usernameError');
        const emailErrorEl = document.getElementById('emailError');
        const passwordErrorEl = document.getElementById('passwordError');
        // const repeatPasswordErrorEl = document.getElementById('repeatPasswordError'); // Removed as per your request
        const courseErrorEl = document.getElementById('courseError');
        const collegeIdErrorEl = document.getElementById('collegeIdError');
        const generalRegistrationErrorEl = document.getElementById('generalRegistrationError');

        // Helper function to clear all error messages
        function clearRegistrationErrors() {
            if(nameErrorEl) nameErrorEl.textContent = '';
            if(usernameErrorEl) usernameErrorEl.textContent = '';
            if(emailErrorEl) emailErrorEl.textContent = '';
            if(passwordErrorEl) passwordErrorEl.textContent = '';
            // if(repeatPasswordErrorEl) repeatPasswordErrorEl.textContent = ''; // Removed
            if(courseErrorEl) courseErrorEl.textContent = '';
            if(collegeIdErrorEl) collegeIdErrorEl.textContent = '';
            if(generalRegistrationErrorEl) generalRegistrationErrorEl.textContent = '';
        }

        registerForm.addEventListener('submit', function(event) {
            event.preventDefault();
            clearRegistrationErrors(); // Clear previous errors

            const name = document.getElementById('name').value;
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            // const repeatPassword = document.getElementById('repeat_password').value; // Removed
            const course = document.getElementById('course').value;
            const college_id = document.getElementById('college_id').value;

            // REPEAT PASSWORD CLIENT-SIDE CHECK REMOVED

            const formData = {
                name: name,
                username: username,
                email: email,
                password: password,
                course: course,
                college_id: college_id
            };

            fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            })
            .then(response => {
                // Parse JSON for both success and error to get backend messages
                return response.json().then(data => ({ status: response.status, body: data, ok: response.ok }));
            })
            .then(result => {
                const { status, body, ok } = result;

                if (ok && status === 201) { // Check response.ok and specific success status
                    alert(body.message || 'Registration successful! You can now log in.');
                    console.log('Registration successful:', body);
                    window.location.href = '/login';
                } else {
                    // Handle backend validation errors or other issues
                    const errorMessage = body.message || `An error occurred (Status: ${status})`;
                    console.error('Registration error:', body);

                    // Display specific error messages
                    if (errorMessage.toLowerCase().includes('password must be')) {
                        if (passwordErrorEl) passwordErrorEl.textContent = errorMessage;
                    } else if (errorMessage.toLowerCase().includes('username already exists')) {
                        if (usernameErrorEl) usernameErrorEl.textContent = errorMessage;
                    } else if (errorMessage.toLowerCase().includes('email is already registered')) {
                        if (emailErrorEl) emailErrorEl.textContent = errorMessage;
                    } else if (errorMessage.toLowerCase().includes('college_id is already registered')) {
                        if (collegeIdErrorEl) collegeIdErrorEl.textContent = errorMessage;
                    } else if (errorMessage.toLowerCase().includes('all fields') || errorMessage.toLowerCase().includes('is required')) {
                        if (generalRegistrationErrorEl) generalRegistrationErrorEl.textContent = errorMessage;
                    } else {
                        // For any other messages
                        if (generalRegistrationErrorEl) generalRegistrationErrorEl.textContent = errorMessage;
                    }
                }
            })
            .catch(error => {
                // This catch is for network errors or if response.json() itself fails badly
                // (e.g., if the server sends non-JSON error response and ok is false)
                console.error('There was an error during registration:', error);
                const messageToAlert = 'An error occurred during registration. Please check console or network tab.';
                if (generalRegistrationErrorEl) {
                    generalRegistrationErrorEl.textContent = messageToAlert;
                } else {
                    alert(messageToAlert);
                }
            });
        });
    }
});