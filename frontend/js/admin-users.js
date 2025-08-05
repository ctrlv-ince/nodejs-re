$(document).ready(function() {
    const url = 'http://localhost:4000/';
    let usersTable;

    // Ensure any order status dropdowns reflect latest enum
    function ensureOrderStatusDropdown() {
        const $statusSelect = $('#orderStatus, #editOrderStatus, select.order-status');
        if ($statusSelect.length) {
            const statuses = ['pending', 'for_confirm', 'processing', 'shipped', 'completed', 'cancelled'];
            $statusSelect.each(function() {
                const $sel = $(this);
                const current = $sel.val();
                $sel.empty();
                statuses.forEach(s => {
                    const text = s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
                    $sel.append(`<option value="${s}">${text}</option>`);
                });
                if (current && statuses.includes(current)) {
                    $sel.val(current);
                }
            });
        }
    }

    // Global: ensure order status dropdown includes the latest enum (pending, for_confirm, processing, shipped, completed, cancelled)
    // If there is a dropdown in the DOM for order status (admin UI), populate it here.
    function ensureOrderStatusDropdown() {
        const $statusSelect = $('#orderStatus, #editOrderStatus, select.order-status');
        if ($statusSelect.length) {
            const statuses = ['pending', 'for_confirm', 'processing', 'shipped', 'completed', 'cancelled'];
            $statusSelect.each(function() {
                const $sel = $(this);
                const current = $sel.val();
                $sel.empty();
                statuses.forEach(s => {
                    const text = s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
                    $sel.append(`<option value="${s}">${text}</option>`);
                });
                if (current && statuses.includes(current)) {
                    $sel.val(current);
                }
            });
        }
    }

    // Check if user is admin
    function checkAdminAccess() {
        const token = sessionStorage.getItem('token');
        if (!token) {
            Swal.fire({
                icon: 'error',
                title: 'Access Denied',
                text: 'You must be logged in as an admin to access this page.',
                showConfirmButton: true
            }).then(() => {
                window.location.href = 'login.html';
            });
            return false;
        }
        return true;
    }

    // Load header
    $('#adminHeader').load('header.html');

    // Initialize DataTable
    function initializeDataTable() {
        usersTable = $('#usersTable').DataTable({
            ajax: {
                url: `${url}api/v1/accounts`,
                type: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + sessionStorage.getItem('token')
                },
                dataSrc: function(json) {
                    // Transform data to include user information
                    return json.map(account => {
                        return {
                            account_id: account.account_id,
                            user_id: account.user_id,
                            username: account.username,
                            full_name: `${account.first_name || ''} ${account.last_name || ''}`.trim(),
                            email: account.email || 'N/A',
                            phone_number: account.phone_number || 'N/A',
                            role: account.role,
                            account_status: account.account_status,
                            created_at: account.created_at,
                            profile_img: account.profile_img
                        };
                    });
                },
                error: function(xhr, error, code) {
                    console.error('DataTable Ajax Error:', error);
                    if (xhr.status === 401 || xhr.status === 403) {
                        Swal.fire({
                            icon: 'error',
                            title: 'Access Denied',
                            text: 'You do not have permission to view this data.',
                            showConfirmButton: true
                        }).then(() => {
                            window.location.href = 'login.html';
                        });
                    }
                }
            },
            columns: [
                { 
                    data: 'account_id',
                    width: '5%'
                },
                { 
                    data: 'username',
                    width: '15%'
                },
                { 
                    data: 'full_name',
                    width: '20%',
                    render: function(data, type, row) {
                        return data || 'Not provided';
                    }
                },
                { 
                    data: 'email',
                    width: '20%'
                },
                { 
                    data: 'phone_number',
                    width: '15%'
                },
                { 
                    data: 'role',
                    width: '10%',
                    render: function(data, type, row) {
                        const badgeClass = data === 'admin' ? 'badge-danger' : 'badge-primary';
                        return `<span class="badge ${badgeClass}">${data.toUpperCase()}</span>`;
                    }
                },
                { 
                    data: 'account_status',
                    width: '10%',
                    render: function(data, type, row) {
                        const badgeClass = data === 'active' ? 'badge-success' : 'badge-warning';
                        return `<span class="badge ${badgeClass}">${data.toUpperCase()}</span>`;
                    }
                },
                { 
                    data: 'created_at',
                    width: '15%',
                    render: function(data, type, row) {
                        if (data) {
                            return new Date(data).toLocaleDateString();
                        }
                        return 'N/A';
                    }
                },
                { 
                    data: null,
                    width: '15%',
                    orderable: false,
                    render: function(data, type, row) {
                        return `
                            <div class="btn-group" role="group">
                                <button class="btn btn-sm btn-outline-primary edit-user" data-id="${row.account_id}" title="Edit User">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger delete-user" data-id="${row.account_id}" title="Delete User">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        `;
                    }
                }
            ],
            responsive: true,
            pageLength: 25,
            lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
            order: [[0, 'desc']],
            language: {
                search: "Search users:",
                lengthMenu: "Show _MENU_ users per page",
                info: "Showing _START_ to _END_ of _TOTAL_ users",
                infoEmpty: "No users found",
                infoFiltered: "(filtered from _MAX_ total users)",
                zeroRecords: "No matching users found"
            },
            dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
                 '<"row"<"col-sm-12"tr>>' +
                 '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>'
        });
    }

    // Edit user functionality
    $(document).on('click', '.edit-user', function() {
        const accountId = $(this).data('id');
        const rowData = usersTable.row($(this).parents('tr')).data();
        
        // Populate modal with current data
        $('#editUserId').val(accountId);
        $('#editUsername').val(rowData.username);
        $('#editRole').val(rowData.role);
        $('#editStatus').val(rowData.account_status);
        
        $('#editUserModal').modal('show');
    });

    // Save user changes
    $('#saveUserBtn').on('click', function() {
        const accountId = $('#editUserId').val();
        const formData = {
            username: $('#editUsername').val(),
            role: $('#editRole').val(),
            account_status: $('#editStatus').val()
        };

        $.ajax({
            url: `${url}api/v1/accounts/${accountId}`,
            type: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + sessionStorage.getItem('token'),
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(formData),
            success: function(response) {
                $('#editUserModal').modal('hide');
                Swal.fire({
                    icon: 'success',
                    title: 'Success!',
                    text: 'User updated successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
                usersTable.ajax.reload();
            },
            error: function(xhr, status, error) {
                console.error('Update error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error!',
                    text: 'Failed to update user: ' + (xhr.responseJSON?.message || error)
                });
            }
        });
    });

    // Delete user functionality
    $(document).on('click', '.delete-user', function() {
        const accountId = $(this).data('id');
        const rowData = usersTable.row($(this).parents('tr')).data();
        
        Swal.fire({
            title: 'Are you sure?',
            text: `Delete user "${rowData.username}"? This action cannot be undone!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
            if (result.isConfirmed) {
                $.ajax({
                    url: `${url}api/v1/accounts/${accountId}`,
                    type: 'DELETE',
                    headers: {
                        'Authorization': 'Bearer ' + sessionStorage.getItem('token')
                    },
                    success: function(response) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Deleted!',
                            text: 'User has been deleted.',
                            timer: 2000,
                            showConfirmButton: false
                        });
                        usersTable.ajax.reload();
                    },
                    error: function(xhr, status, error) {
                        console.error('Delete error:', error);
                        Swal.fire({
                            icon: 'error',
                            title: 'Error!',
                            text: 'Failed to delete user: ' + (xhr.responseJSON?.message || error)
                        });
                    }
                });
            }
        });
    });

    $('#addUserBtn').remove();
    
    // Initialize the page
    if (checkAdminAccess()) {
        initializeDataTable();
        // Populate status dropdowns after table/UI load
        ensureOrderStatusDropdown();
    }
    
    // Refresh table every 30 seconds
    setInterval(function() {
        if (usersTable) {
            usersTable.ajax.reload(null, false); // false = don't reset paging
        }
    }, 30000);
});