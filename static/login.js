// static/login.js
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form'); // Make sure your login HTML form has id="login-form"

    if (loginForm) {
        const generalLoginErrorEl = document.getElementById('generalLoginError'); // Make sure this element exists in your login.html

        function clearLoginErrors() {
            if (generalLoginErrorEl) generalLoginErrorEl.textContent = '';
        }

        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();
            clearLoginErrors();

            const identifier = document.getElementById('identifier').value; // Assuming login form has id="identifier"
            const passwordInput = loginForm.querySelector('#password'); // Assuming login form has id="password"
            const password = passwordInput ? passwordInput.value : ''; // Ensure password input exists

            if (!identifier || !password) {
                 if (generalLoginErrorEl) generalLoginErrorEl.textContent = 'Username/Email and password are required.';
                 else alert('Username/Email and password are required.');
                 return;
            }

            fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: identifier, password: password }),
            })
            .then(response => response.json().then(data => ({ status: response.status, body: data, ok: response.ok })))
            .then(result => {
                const { status, body, ok } = result;
                if (ok && body.redirect) { // Check response.ok for success
                    // alert(body.message || 'Login successful!'); // Success message is optional before redirect
                    console.log('Login successful:', body);
                    if (body.redirect) {
                        window.location.href = body.redirect;
                    }
                } else {
                    const errorMessage = body.message || `Login failed (Status: ${status})`;
                    console.error('Login error:', body);
                    if (generalLoginErrorEl) generalLoginErrorEl.textContent = errorMessage;
                    else alert(errorMessage);
                }
            })
            .catch(error => {
                console.error('There was an error during login:', error);
                const errorMessage = 'An error occurred during login. Please check network or console.';
                if (generalLoginErrorEl) generalLoginErrorEl.textContent = errorMessage;
                else alert(errorMessage);
            });
        });
    }
});