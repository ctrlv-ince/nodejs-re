$(document).ready(function () {
    const url = 'http://localhost:4000/'

    const getToken = () => {
        const userId = sessionStorage.getItem('userId');
        const token = sessionStorage.getItem('token');

        if (!userId || !token) {
            Swal.fire({
                icon: 'warning',
                text: 'You must be logged in to access this page.',
                showConfirmButton: true
            }).then(() => {
                window.location.href = 'login.html';
            });
            return null;
        }
        return token;
    }

    // Load user profile data on page load
    const loadUserProfile = () => {
        const token = getToken();
        if (!token) return;

        $.ajax({
            method: "GET",
            url: `${url}api/v1/profile`,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            dataType: "json",
            success: function (data) {
                console.log('Profile data:', data);
                if (data.success && data.user) {
                    const user = data.user;
                    
                    // Populate form fields from joined users + accounts (getUserProfile)
                    $('#username').val(user.username || '');
                    $('#firstName').val(user.first_name || '');
                    $('#lastName').val(user.last_name || '');
                    $('#email').val(user.email || '');
                    $('#phone').val(user.phone_number || '');
                    $('#age').val(user.age || '');
                    $('#sex').val(user.sex || '');
                    // Remove role editing in UI (role field no longer settable)
                    $('#accountStatus').val(user.account_status || '');
                    
                    // Show profile image if exists
                    if (user.profile_img && user.profile_img !== 'default.jpg') {
                        $('#avatarPreview').attr('src', `${url}${user.profile_img}`).show();
                    } else {
                        // Optional fallback avatar
                        $('#avatarPreview').attr('src', 'https://via.placeholder.com/120x120?text=Avatar').show();
                    }
                }
            },
            error: function (error) {
                console.log('Error loading profile:', error);
                if (error.status === 401) {
                    Swal.fire({
                        icon: 'error',
                        text: 'Session expired. Please login again.',
                        showConfirmButton: true
                    }).then(() => {
                        sessionStorage.clear();
                        window.location.href = 'login.html';
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        text: 'Failed to load profile data.',
                        showConfirmButton: false,
                        timer: 2000
                    });
                }
            }
        });
    };

    // Load profile data if on profile page
    if (window.location.pathname.includes('profile.html')) {
        loadUserProfile();
    }

    // Fix placeholder image DNS issue on register: ensure a valid, resolvable placeholder is used
    if (window.location.pathname.includes('register.html')) {
        const $img = $('#avatarPreview');
        if ($img.length) {
            // Use a reliable placeholder host
            $img.attr('src', 'https://placehold.co/120x120?text=Preview');
            // Add robust error fallback to a data URI if network fails
            $img.on('error', function () {
                // simple gray circle data URI fallback
                const fallback = 'data:image/svg+xml;utf8,' +
                  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#e0e0e0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="14" fill="#666">Preview</text></svg>');
                $(this).attr('src', fallback);
            });
        }
    }

    $("#profile_img").on('change', function () {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                $('#avatarPreview').attr('src', e.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    $("#register").off('click.register').on('click.register', function (e) {
        e.preventDefault();

        const $btn = $(this);
        const $form = $('#registerForm');

        // Guard if form missing
        if (!$form.length) {
            console.error('Register form not found');
            try { Swal.fire({ icon: 'error', text: 'Form not found.' }); } catch(_) {}
            return;
        }

        // Important: clear any stale submitting flag when inputs change
        $form.one('input change', function () {
            $btn.data('submitting', false).prop('disabled', false);
        });

        // Prevent double-submit
        if ($btn.data('submitting')) return;
        $btn.data('submitting', true).prop('disabled', true);

        try {
            // If jQuery Validate is present and form exists, enforce validation before submit
            if (typeof $form.valid === 'function') {
                $form.addClass('validated');
                // Validate all inputs to update UI immediately
                $form.find(':input').each(function () {
                    if (typeof $(this).valid === 'function') $(this).valid();
                });
                if (!$form.valid()) {
                    try {
                        Swal.fire({
                            icon: 'error',
                            text: 'Please fix the highlighted fields before submitting.',
                            position: 'bottom-right',
                            showConfirmButton: false,
                            timer: 1500
                        });
                    } catch(_) { alert('Please fix the highlighted fields before submitting.'); }
                    // Re-enable so user can try again after fixing fields
                    $btn.data('submitting', false).prop('disabled', false);
                    return;
                }
            } else {
                // Fallback manual checks if validator isn't loaded for any reason
                const requiredFields = [
                    '#first_name',
                    '#last_name',
                    '#username',
                    '#email',
                    '#phone_number',
                    '#password',
                    '#confirm_password'
                ];
                let missing = [];
                requiredFields.forEach(sel => {
                    const val = $(sel).val();
                    if (!val || String(val).trim() === '') missing.push(sel);
                });
                if (missing.length) {
                    try {
                        Swal.fire({
                            icon: 'error',
                            text: 'Please complete all required fields.',
                            position: 'bottom-right',
                            showConfirmButton: false,
                            timer: 1500
                        });
                    } catch(_) { alert('Please complete all required fields.'); }
                    $btn.data('submitting', false).prop('disabled', false);
                    return;
                }
                // Basic confirm password check
                if ($('#password').val() !== $('#confirm_password').val()) {
                    try {
                        Swal.fire({
                            icon: 'error',
                            text: 'Passwords do not match.',
                            position: 'bottom-right',
                            showConfirmButton: false,
                            timer: 1500
                        });
                    } catch(_) { alert('Passwords do not match.'); }
                    $btn.data('submitting', false).prop('disabled', false);
                    return;
                }
            }

            const formEl = $form[0];
            const formData = new FormData(formEl);

            console.log('Submitting registration to', `${url}api/v1/register`);

            $.ajax({
                method: "POST",
                url: `${url}api/v1/register`,
                data: formData,
                processData: false,
                contentType: false,
                dataType: "json"
            })
            .done(function () {
                try {
                    Swal.fire({
                        icon: "success",
                        text: "Registration successful",
                        position: 'bottom-right',
                        showConfirmButton: false,
                        timer: 1200,
                        timerProgressBar: true
                    });
                } catch(_) {}
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1200);
            })
            .fail(function (error) {
                console.error('Registration failed', error);
                // Surface field-specific duplicate errors
                if (error && error.responseJSON && error.status === 409 && error.responseJSON.field) {
                    const field = error.responseJSON.field;
                    const message = error.responseJSON.message || 'Already taken';
                    const $input = $form.find(`[name="${field}"]`);
                    if ($input.length) {
                        const group = $input.closest('.form-group');
                        group.find('div.invalid-feedback').remove();
                        $('<div/>', { 'class': 'invalid-feedback', 'text': message }).appendTo(group);
                        $input.addClass('is-invalid').removeClass('is-valid');
                    }
                    try {
                        Swal.fire({
                            icon: 'error',
                            text: message,
                            position: 'bottom-right',
                            showConfirmButton: false,
                            timer: 1800,
                            timerProgressBar: true
                        });
                    } catch(_) { alert(message); }
                    return;
                }
                const msg = (error && error.responseJSON && (error.responseJSON.message || error.responseJSON.error)) || (error && error.statusText) || 'Registration failed';
                try {
                    Swal.fire({
                        icon: "error",
                        text: msg,
                        position: 'bottom-right',
                        showConfirmButton: false,
                        timer: 1800,
                        timerProgressBar: true
                    });
                } catch(_) { alert(msg); }
            })
            .always(function () {
                $btn.data('submitting', false).prop('disabled', false);
            });
        } catch (ex) {
            console.error('Unexpected error during registration', ex);
            try { Swal.fire({ icon: 'error', text: 'Unexpected error. Please try again.' }); } catch(_) { alert('Unexpected error. Please try again.'); }
            $btn.data('submitting', false).prop('disabled', false);
        }
    });

    $("#login").on('click', function (e) {
        e.preventDefault();

        let email = $("#email").val()
        let password = $("#password").val()
        let user = {
            email,
            password
        }
        $.ajax({
            method: "POST",
            url: `${url}api/v1/login`,
            data: JSON.stringify(user),
            processData: false,
            contentType: 'application/json; charset=utf-8',
            dataType: "json",
            success: function (data) {
                console.log(data);
                // Show a concise success notification without exposing raw boolean or verbose message
                Swal.fire({
                    icon: 'success',
                    text: 'Login successful',
                    showConfirmButton: false,
                    position: 'bottom-right',
                    timer: 1000,
                    timerProgressBar: true
                });
                // Store plain userId (not JSON string) for consistency
                sessionStorage.setItem('userId', data.user.id);
                sessionStorage.setItem('token', data.token);
                window.location.href = 'dashboard.html'
            },
            error: function (error) {
                console.log(error);
                Swal.fire({
                    icon: "error",
                    text: (error.responseJSON && error.responseJSON.message) || 'Login failed',
                    showConfirmButton: false,
                    position: 'bottom-right',
                    timer: 1000,
                    timerProgressBar: true
                });
            }
        });
    });

    $('#avatar').on('change', function () {
        const file = this.files[0];
        console.log(file)
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                console.log(e.target.result)
                $('#avatarPreview').attr('src', e.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    // Prevent Enter key from accidentally submitting profile form
    $(document).off('keypress', '#profileForm').on('keypress', '#profileForm', function(e){
        if (e.which === 13) e.preventDefault();
    });

    // Ensure single binding for Update Profile button
    $(document).off('click', '#updateBtn').on('click', '#updateBtn', function (event) {
        event.preventDefault();
        const token = getToken();
        if (!token) return;

        const formEl = $('#profileForm')[0];
        if (!formEl) {
            console.error('Profile form not found');
            return;
        }

        const formData = new FormData(formEl);
        // Enforce non-editable role on client side
        formData.delete('role');

        $.ajax({
            method: "POST",
            url: `${url}api/v1/update-profile`,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            data: formData,
            contentType: false,
            processData: false,
            dataType: "json",
            success: function () {
                Swal.fire({
                    icon: 'success',
                    title: 'Saved',
                    text: 'Profile updated successfully!',
                    showConfirmButton: false,
                    position: 'bottom-right',
                    timer: 1500,
                    timerProgressBar: true
                });
                // Reload profile data
                loadUserProfile();
            },
            error: function (error) {
                const msg = (error.responseJSON && (error.responseJSON.message || error.responseJSON.error)) || 'Failed to update profile.';
                Swal.fire({
                    icon: 'error',
                    text: msg,
                    showConfirmButton: false,
                    position: 'bottom-right',
                    timer: 2000,
                    timerProgressBar: true
                });
            }
        });
    });

    $('#loginBody').load("header.html");


    $("#profile").load("header.html", function () {
        // After header is loaded, check sessionStorage for userId
        if (sessionStorage.getItem('userId')) {
            // Change Login link to Logout
            const $loginLink = $('a.nav-link[href="login.html"]');
            $loginLink.text('Logout').attr({ 'href': '#', 'id': 'logout-link' }).on('click', function (e) {
                e.preventDefault();
                sessionStorage.clear();
                window.location.href = 'login.html';
            });
        }
        // Remove role field from Profile UI if present
        const roleField = $('#role').closest('.form-group');
        if (roleField.length) {
            roleField.remove();
        }
    });

    $("#deactivateBtn").on('click', function (e) {
        e.preventDefault();
        let email = $("#email").val()
        let user = {
            email,
        }
        $.ajax({
            method: "DELETE",
            url: `${url}api/v1/deactivate`,
            data: JSON.stringify(user),
            processData: false,
            contentType: 'application/json; charset=utf-8',
            dataType: "json",
            success: function (data) {
                console.log(data);
                Swal.fire({
                    text: data.message,
                    showConfirmButton: false,
                    position: 'bottom-right',
                    timer: 2000,
                    timerProgressBar: true
                });
                sessionStorage.removeItem('userId')
                // window.location.href = 'home.html'
            },
            error: function (error) {
                console.log(error);
            }
        });
    });

    


})
