$(document).ready(function() {
    // Custom validation methods
    $.validator.addMethod("strongPassword", function(value, element) {
        return this.optional(element) || /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(value);
    }, "Password must contain at least 8 characters with uppercase, lowercase, number and special character");

    $.validator.addMethod("phoneNumber", function(value, element) {
        return this.optional(element) || /^09\d{9}$/.test(value);
    }, "Please enter a valid Philippine mobile number (09xxxxxxxxx)");

    // Generic regex/pattern validator (since jQuery Validate has no built-in 'pattern' rule)
    $.validator.addMethod("regex", function(value, element, pattern) {
        if (this.optional(element)) return true;
        let regex = pattern;
        if (typeof pattern === 'string') {
            // support pattern as string e.g. "^[a-z]+$"
            regex = new RegExp(pattern);
        }
        return regex.test(value);
    }, "Invalid format");

    // Registration form validation
    if ($('#registerForm').length) {
        const validator = $('#registerForm').validate({
            rules: {
                first_name: {
                    required: true,
                    minlength: 2,
                    maxlength: 50,
                    regex: /^[a-zA-Z\s]+$/
                },
                last_name: {
                    required: true,
                    minlength: 2,
                    maxlength: 50,
                    regex: /^[a-zA-Z\s]+$/
                },
                username: {
                    required: true,
                    minlength: 3,
                    maxlength: 20,
                    regex: /^[a-zA-Z0-9_]+$/
                },
                email: {
                    required: true,
                    email: true,
                    maxlength: 255
                },
                phone_number: {
                    required: true,
                    phoneNumber: true
                },
                password: {
                    required: true,
                    strongPassword: true
                },
                confirm_password: {
                    required: true,
                    equalTo: "#password"
                },
                age: {
                    required: function() {
                        return $('#age').attr('min') === '18';
                    },
                    number: true,
                    min: 18,
                    max: 120
                },
                profile_img: {
                    extension: "jpg|jpeg|png",
                    filesize: 5242880 // 5MB
                }
            },
            messages: {
                first_name: {
                    required: "Please enter your first name.",
                    minlength: "First name must be at least 2 characters.",
                    maxlength: "First name must be 50 characters or fewer.",
                    regex: "First name can only contain letters and spaces."
                },
                last_name: {
                    required: "Please enter your last name.",
                    minlength: "Last name must be at least 2 characters.",
                    maxlength: "Last name must be 50 characters or fewer.",
                    regex: "Last name can only contain letters and spaces."
                },
                username: {
                    required: "Please choose a username.",
                    minlength: "Username must be at least 3 characters.",
                    maxlength: "Username must be 20 characters or fewer.",
                    regex: "Username can only contain letters, numbers, and underscores."
                },
                email: {
                    required: "Please enter your email address.",
                    email: "Enter a valid email address (e.g., name@example.com).",
                    maxlength: "Email must be 255 characters or fewer."
                },
                phone_number: {
                    required: "Please enter your mobile number.",
                    phoneNumber: "Use PH format: 09xxxxxxxxx."
                },
                password: {
                    required: "Please create a password.",
                    strongPassword: "At least 8 characters with upper, lower, number, and special character."
                },
                confirm_password: {
                    required: "Please re-enter your password.",
                    equalTo: "Passwords do not match."
                },
                age: {
                    required: "Age restriction: 18 years old and above.",
                    number: "Please enter a valid age.",
                    min: "Age restriction: 18 years old and above.",
                    max: "Please enter an age less than or equal to 120."
                },
                profile_img: {
                    extension: "Allowed formats: JPG, JPEG, PNG.",
                    filesize: "Image must be 5MB or smaller."
                }
            },
            errorElement: 'div',
            errorClass: 'invalid-feedback',
            validClass: 'is-valid',
            onkeyup: function(element) {
                $(element).valid();
            },
            onfocusout: function(element) {
                $(element).valid();
            },
            errorPlacement: function(error, element) {
                error.addClass('invalid-feedback');
                const group = element.closest('.form-group');
                // Remove only existing error for this specific element to avoid lingering errors
                group.find('div.invalid-feedback').filter(function() {
                    return $(this).data('for') === element.attr('name');
                }).remove();
                error.attr('data-for', element.attr('name'));
                group.append(error);
            },
            highlight: function(element, errorClass, validClass) {
                const $el = $(element);
                $el.addClass('is-invalid').removeClass('is-valid');
                const group = $el.closest('.form-group');
                group.find('div.invalid-feedback').filter(function() {
                    return $(this).data('for') === $el.attr('name');
                }).show();
            },
            unhighlight: function(element, errorClass, validClass) {
                const $el = $(element);
                const group = $el.closest('.form-group');
                // Remove the specific error for this field when it becomes valid
                group.find('div.invalid-feedback').filter(function() {
                    return $(this).data('for') === $el.attr('name');
                }).remove();
                $el.addClass('is-valid').removeClass('is-invalid');
            },
            submitHandler: function(form) {
                // prevent plugin from submitting; actual submission handled elsewhere
                return false;
            },
            invalidHandler: function(event, validator) {
                // Show a toast when the form is invalid on submit
                if (validator.numberOfInvalids()) {
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'error',
                            text: 'Please fill out the required fields.',
                            position: 'bottom-right',
                            showConfirmButton: false,
                            timer: 1500
                        });
                    }
                }
            }
        });

        // Also trigger validation when the Create Account button is clicked with empty form
        $(document).off('click.registerBtnGuard').on('click.registerBtnGuard', '#register', function(e) {
            const $form = $('#registerForm');
            if (!$form.length) return;
            // Trigger validation
            $form.addClass('validated');
            // Validate all inputs to show inline messages immediately
            if (typeof $form.valid === 'function') {
                $form.find(':input').each(function() { if (typeof $(this).valid === 'function') { $(this).valid(); } });
                // If invalid, show toast and STOP default to avoid double handling
                if (!$form.valid()) {
                    e.preventDefault();
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'error',
                            text: 'Please fill out the required fields.',
                            position: 'bottom-right',
                            showConfirmButton: false,
                            timer: 1500
                        });
                    }
                    return;
                }
            }
            // If form is valid, let user.js handler proceed. Prevent duplicate bindings by triggering the actual click handler once.
            // Do not preventDefault here so the user.js #register click handler can run the AJAX.
        });
    }

    // Login form validation
    if ($('#loginForm').length) {
        $('#loginForm').validate({
            rules: {
                email: {
                    required: true,
                    email: true
                },
                password: {
                    required: true,
                    minlength: 6
                }
            },
            messages: {
                email: {
                    required: "Email is required",
                    email: "Please enter a valid email address"
                },
                password: {
                    required: "Password is required",
                    minlength: "Password must be at least 6 characters"
                }
            },
            errorElement: 'div',
            errorClass: 'invalid-feedback',
            validClass: 'is-valid',
            errorPlacement: function(error, element) {
                error.addClass('invalid-feedback');
                element.closest('.form-group').append(error);
            },
            highlight: function(element, errorClass, validClass) {
                $(element).addClass('is-invalid').removeClass('is-valid');
            },
            unhighlight: function(element, errorClass, validClass) {
                $(element).addClass('is-valid').removeClass('is-invalid');
            },
            submitHandler: function(form) {
                // This will be handled by the existing login button click handler
                return false;
            }
        });
    }

    // Profile update form validation (aligned with profile.html and backend update fields)
    if ($('#profileForm').length) {
        $('#profileForm').validate({
            rules: {
                first_name: {
                    required: true,
                    minlength: 2,
                    maxlength: 50,
                    regex: /^[a-zA-Z\s]+$/
                },
                last_name: {
                    required: true,
                    minlength: 2,
                    maxlength: 50,
                    regex: /^[a-zA-Z\s]+$/
                },
                phone_number: {
                    required: true,
                    phoneNumber: true
                },
                age: {
                    required: function() {
                        return $('#age').attr('min') === '18';
                    },
                    number: true,
                    min: 18,
                    max: 120
                },
                image: {
                    extension: "jpg|jpeg|png",
                    filesize: 5242880 // 5MB
                }
            },
            messages: {
                first_name: {
                    required: "First name is required",
                    minlength: "First name must be at least 2 characters",
                    maxlength: "First name cannot exceed 50 characters",
                    regex: "First name can only contain letters and spaces"
                },
                last_name: {
                    required: "Last name is required",
                    minlength: "Last name must be at least 2 characters",
                    maxlength: "Last name cannot exceed 50 characters",
                    regex: "Last name can only contain letters and spaces"
                },
                phone_number: {
                    required: "Phone number is required"
                },
                age: {
                    number: "Please enter a valid age",
                    min: "Age restriction: 18 years old and above",
                    max: "Please enter an age less than or equal to 120"
                },
                image: {
                    extension: "Please upload a valid image file (JPG, JPEG, PNG)",
                    filesize: "File size must be less than 5MB"
                }
            },
            errorElement: 'div',
            errorClass: 'invalid-feedback',
            validClass: 'is-valid',
            onkeyup: function(element) {
                $(element).valid();
            },
            onfocusout: function(element) {
                $(element).valid();
            },
            errorPlacement: function(error, element) {
                error.addClass('invalid-feedback');
                const group = element.closest('.form-group');
                group.find('div.invalid-feedback').filter(function() {
                    return $(this).data('for') === element.attr('name');
                }).remove();
                error.attr('data-for', element.attr('name'));
                group.append(error);
            },
            highlight: function(element, errorClass, validClass) {
                const $el = $(element);
                $el.addClass('is-invalid').removeClass('is-valid');
                const group = $el.closest('.form-group');
                group.find('div.invalid-feedback').filter(function() {
                    return $(this).data('for') === $el.attr('name');
                }).show();
            },
            unhighlight: function(element, errorClass, validClass) {
                const $el = $(element);
                const group = $el.closest('.form-group');
                group.find('div.invalid-feedback').filter(function() {
                    return $(this).data('for') === $el.attr('name');
                }).remove();
                $el.addClass('is-valid').removeClass('is-invalid');
            },
            submitHandler: function(form) {
                return false;
            },
            invalidHandler: function(event, validator) {
                if (validator.numberOfInvalids() && typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        text: 'Please correct the highlighted fields.',
                        position: 'bottom-right',
                        showConfirmButton: false,
                        timer: 1500
                    });
                }
            }
        });
    }

    // Define 'extension' rule locally (since additional-methods.js is not included) and keep robust filesize
    $.validator.addMethod('extension', function(value, element, param) {
        if (this.optional(element) || !value) return true;
        // param can be a string like "jpg|jpeg|png" or array; normalize to string list
        const exts = Array.isArray(param) ? param.join('|') : String(param || 'jpg|jpeg|png');
        const re = new RegExp('\\.(' + exts.replace(/\s+/g, '') + ')$', 'i');
        return re.test(value);
    }, 'Please upload a file with a valid extension.');

    // Custom file size validation method
    $.validator.addMethod('filesize', function(value, element, param) {
        if (this.optional(element)) return true;
        if (!element.files || !element.files.length) return true;
        return element.files[0].size <= param;
    }, 'File size is too large');

    // Real-time validation feedback
    $('input, select, textarea').on('blur', function() {
        if ($(this).closest('form').hasClass('validated')) {
            $(this).valid();
        }
    });

    // Mark form as validated on first submit attempt
    $('form').on('submit', function() {
        $(this).addClass('validated');
    });
});