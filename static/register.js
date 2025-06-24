// static/register.js
document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('register-form'); // Make sure your register HTML form has id="register-form"

    if (registerForm) {
        // Get references to error display elements from your register.html
        const nameErrorEl = document.getElementById('nameError');
        const usernameErrorEl = document.getElementById('usernameError');
        const emailErrorEl = document.getElementById('emailError');
        const passwordErrorEl = document.getElementById('passwordError');
        // const repeatPasswordErrorEl = document.getElementById('repeatPasswordError'); // We removed this earlier
        const courseErrorEl = document.getElementById('courseError');
        const collegeIdErrorEl = document.getElementById('collegeIdError');
        const generalRegistrationErrorEl = document.getElementById('generalRegistrationError');

        // Helper function to clear all error messages
        function clearRegistrationErrors() {
            if (nameErrorEl) nameErrorEl.textContent = '';
            if (usernameErrorEl) usernameErrorEl.textContent = '';
            if (emailErrorEl) emailErrorEl.textContent = '';
            if (passwordErrorEl) passwordErrorEl.textContent = '';
            // if (repeatPasswordErrorEl) repeatPasswordErrorEl.textContent = ''; // We removed this earlier
            if (courseErrorEl) courseErrorEl.textContent = '';
            if (collegeIdErrorEl) collegeIdErrorEl.textContent = '';
            if (generalRegistrationErrorEl) generalRegistrationErrorEl.textContent = '';
        }

        registerForm.addEventListener('submit', function(event) {
            event.preventDefault();
            clearRegistrationErrors(); // Clear previous errors

            const name = document.getElementById('name').value;
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const course = document.getElementById('course').value;
            const college_id = document.getElementById('college_id').value;

            // REPEAT PASSWORD CLIENT-SIDE CHECK IS REMOVED

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
                return response.json().then(data => ({ status: response.status, body: data, ok: response.ok }));
            })
            .then(result => {
                const { status, body, ok } = result;

                if (ok && status === 201) {
                    alert(body.message || 'Registration successful! You can now log in.');
                    console.log('Registration successful:', body);
                    window.location.href = '/login';
                } else {
                    const errorMessage = body.message || `An error occurred (Status: ${status})`;
                    console.error('Registration error:', body);

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
                        if (generalRegistrationErrorEl) generalRegistrationErrorEl.textContent = errorMessage;
                    }
                }
            })
            .catch(error => {
                console.error('Network or parsing error during registration:', error);
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