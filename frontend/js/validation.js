$(document).ready(function() {
    // Custom validation methods
    $.validator.addMethod("strongPassword", function(value, element) {
        return this.optional(element) || /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(value);
    }, "Password must contain at least 8 characters with uppercase, lowercase, number and special character");

    $.validator.addMethod("phoneNumber", function(value, element) {
        return this.optional(element) || /^09\d{9}$/.test(value);
    }, "Please enter a valid Philippine mobile number (09xxxxxxxxx)");

    // Registration form validation
    if ($('#registerForm').length) {
        $('#registerForm').validate({
            rules: {
                first_name: {
                    required: true,
                    minlength: 2,
                    maxlength: 50,
                    pattern: /^[a-zA-Z\s]+$/
                },
                last_name: {
                    required: true,
                    minlength: 2,
                    maxlength: 50,
                    pattern: /^[a-zA-Z\s]+$/
                },
                username: {
                    required: true,
                    minlength: 3,
                    maxlength: 20,
                    pattern: /^[a-zA-Z0-9_]+$/
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
                profile_img: {
                    extension: "jpg|jpeg|png",
                    filesize: 5242880 // 5MB
                }
            },
            messages: {
                first_name: {
                    required: "First name is required",
                    minlength: "First name must be at least 2 characters",
                    maxlength: "First name cannot exceed 50 characters",
                    pattern: "First name can only contain letters and spaces"
                },
                last_name: {
                    required: "Last name is required",
                    minlength: "Last name must be at least 2 characters",
                    maxlength: "Last name cannot exceed 50 characters",
                    pattern: "Last name can only contain letters and spaces"
                },
                username: {
                    required: "Username is required",
                    minlength: "Username must be at least 3 characters",
                    maxlength: "Username cannot exceed 20 characters",
                    pattern: "Username can only contain letters, numbers, and underscores"
                },
                email: {
                    required: "Email is required",
                    email: "Please enter a valid email address",
                    maxlength: "Email cannot exceed 255 characters"
                },
                phone_number: {
                    required: "Phone number is required"
                },
                password: {
                    required: "Password is required"
                },
                confirm_password: {
                    required: "Please confirm your password",
                    equalTo: "Passwords do not match"
                },
                profile_img: {
                    extension: "Please upload a valid image file (JPG, JPEG, PNG)",
                    filesize: "File size must be less than 5MB"
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
                // This will be handled by the existing register button click handler
                return false;
            }
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

    // Profile update form validation
    if ($('#profileForm').length) {
        $('#profileForm').validate({
            rules: {
                title: {
                    required: true
                },
                fname: {
                    required: true,
                    minlength: 2,
                    maxlength: 50
                },
                lname: {
                    required: true,
                    minlength: 2,
                    maxlength: 50
                },
                addressline: {
                    required: true,
                    maxlength: 255
                },
                town: {
                    required: true,
                    maxlength: 100
                },
                zipcode: {
                    required: true,
                    pattern: /^\d{4}$/
                },
                phone: {
                    required: true,
                    phoneNumber: true
                },
                image: {
                    extension: "jpg|jpeg|png",
                    filesize: 5242880 // 5MB
                }
            },
            messages: {
                title: "Please select a title",
                fname: {
                    required: "First name is required",
                    minlength: "First name must be at least 2 characters",
                    maxlength: "First name cannot exceed 50 characters"
                },
                lname: {
                    required: "Last name is required",
                    minlength: "Last name must be at least 2 characters",
                    maxlength: "Last name cannot exceed 50 characters"
                },
                addressline: {
                    required: "Address is required",
                    maxlength: "Address cannot exceed 255 characters"
                },
                town: {
                    required: "Town/City is required",
                    maxlength: "Town/City cannot exceed 100 characters"
                },
                zipcode: {
                    required: "ZIP code is required",
                    pattern: "Please enter a valid 4-digit ZIP code"
                },
                phone: {
                    required: "Phone number is required"
                },
                image: {
                    extension: "Please upload a valid image file (JPG, JPEG, PNG)",
                    filesize: "File size must be less than 5MB"
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
            }
        });
    }

    // Custom file size validation method
    $.validator.addMethod('filesize', function(value, element, param) {
        return this.optional(element) || (element.files[0] && element.files[0].size <= param);
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