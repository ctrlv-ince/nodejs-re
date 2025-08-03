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

    // Load user profile and determine dashboard type
    const loadUserDashboard = () => {
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
                console.log('User data:', data);
                if (data.success && data.user) {
                    const user = data.user;
                    
                    // Update user info
                    $('#userName').text(`${user.first_name} ${user.last_name}`);
                    $('#userRole').text(user.role.toUpperCase());
                    
                    // Inject/Update profile image in the User Info card
                    (function renderProfileImage(){
                        const imgSrc = user.profile_img ? (url + user.profile_img) : 'https://via.placeholder.com/96?text=%20';
                        const $cardBody = $('#userInfo .card .card-body');
                        if ($cardBody.find('#dashboardProfileImg').length === 0) {
                            // Create a small media layout: avatar on left, text on right
                            const avatarHtml = `
                                <div class="d-flex align-items-center mb-2">
                                  <img id="dashboardProfileImg" src="${imgSrc}" alt="Profile" style="width:64px;height:64px;object-fit:cover;border-radius:50%;border:2px solid #1abc9c;margin-right:12px;">
                                  <div>
                                    <div class="small text-muted">Signed in as</div>
                                    <div class="font-weight-bold">${user.username || (user.first_name + ' ' + user.last_name)}</div>
                                  </div>
                                </div>
                            `;
                            // Prepend avatar above the title
                            $cardBody.prepend(avatarHtml);
                        } else {
                            $('#dashboardProfileImg').attr('src', imgSrc);
                        }
                    })();
                    
                    // Show appropriate dashboard based on role
                    if (user.role === 'admin') {
                        $('#adminDashboard').show();
                        loadAdminCharts();
                    } else {
                        $('#userDashboard').show();
                        loadUserOrders();
                    }
                }
            },
            error: function (error) {
                console.log('Error loading user data:', error);
                if (error.status === 401) {
                    Swal.fire({
                        icon: 'error',
                        text: 'Session expired. Please login again.',
                        showConfirmButton: true
                    }).then(() => {
                        sessionStorage.clear();
                        window.location.href = 'login.html';
                    });
                }
            }
        });
    };

    // Generate random colors for charts
    const generateColors = (count) => {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const letters = '0123456789ABCDEF';
            let color = '#';
            for (let x = 0; x < 6; x++) {
                color += letters[Math.floor(Math.random() * 16)];
            }
            colors.push(color);
        }
        return colors;
    };

    // Load admin charts
    const loadAdminCharts = () => {
        const token = getToken();
        if (!token) return;

        // 1) Bar: Top 10 products by revenue (all time)
        $.ajax({
            method: "GET",
            url: `${url}api/v1/dashboard/top-products-revenue`,
            headers: { 'Authorization': `Bearer ${token}` },
            dataType: "json",
            success: function (data) {
                const rows = (data && (data.rows || data.result || [])) || [];
                const top = rows.slice(0, 10);
                const labels = top.map(r => r.item_name || `Item ${r.item_id}`);
                const values = top.map(r => Number(r.revenue || r.total_revenue || 0));
                const ctx = document.getElementById('addressChart').getContext('2d');

                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Revenue (₱)',
                            data: values,
                            backgroundColor: 'rgba(26, 188, 156, 0.6)',
                            borderColor: 'rgba(26, 188, 156, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 } },
                            y: { beginAtZero: true }
                        },
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => `₱${Number(ctx.parsed.y).toLocaleString()}`
                                }
                            }
                        }
                    }
                });
            },
            error: function (error) {
                console.error('Error loading top-products-revenue:', error);
            }
        });

        // 2) Line: Top 10 products by total quantity sold (all time)
        $.ajax({
            type: "GET",
            url: `${url}api/v1/dashboard/top-products-quantity`,
            headers: { 'Authorization': `Bearer ${token}` },
            dataType: "json",
            success: function (data) {
                const rows = (data && (data.rows || data.result || [])) || [];
                const top = rows.slice(0, 10);
                const labels = top.map(r => r.item_name || `Item ${r.item_id}`);
                const values = top.map(r => Number(r.total_qty || r.quantity || 0));
                const ctx = document.getElementById('salesChart').getContext('2d');

                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Total Units Sold',
                            data: values,
                            backgroundColor: 'rgba(52, 152, 219, 0.2)',
                            borderColor: 'rgba(52, 152, 219, 1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.25,
                            pointRadius: 3,
                            pointHoverRadius: 5
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: { beginAtZero: true }
                        }
                    }
                });
            },
            error: function (error) {
                console.error('Error loading top-products-quantity:', error);
            }
        });

        // 3) Pie: Revenue by categories (all time)
        $.ajax({
            type: "GET",
            url: `${url}api/v1/dashboard/revenue-by-category`,
            headers: { 'Authorization': `Bearer ${token}` },
            dataType: "json",
            success: function (data) {
                const rows = (data && (data.rows || data.result || [])) || [];
                const labels = rows.map(r => r.category_name || r.category || 'Uncategorized');
                const values = rows.map(r => Number(r.revenue || r.total_revenue || 0));
                const ctx = document.getElementById('itemsChart').getContext('2d');

                new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Revenue Share (₱)',
                            data: values,
                            backgroundColor: generateColors(values.length),
                            borderColor: '#ffffff',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => {
                                        const v = Number(ctx.parsed).toLocaleString();
                                        const total = values.reduce((a,b)=>a+b,0) || 1;
                                        const pct = ((ctx.parsed / total) * 100).toFixed(1);
                                        return `₱${v} (${pct}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
            },
            error: function (error) {
                console.error('Error loading revenue-by-category:', error);
            }
        });
    };

    // Load user orders - fetch real data from /api/v1/me/orders
    const loadUserOrders = () => {
        const token = getToken();
        if (!token) return;

        $('#recentOrders').html('<p>Loading your recent orders...</p>');

        $.ajax({
            method: 'GET',
            url: `${url}api/v1/me/orders`,
            headers: { 'Authorization': `Bearer ${token}` },
            dataType: 'json',
            success: function(resp) {
                const rows = resp && resp.rows ? resp.rows : [];

                if (!Array.isArray(rows) || rows.length === 0) {
                    $('#recentOrders').html(`
                        <div class="alert alert-info">
                            <h6>No recent orders found.</h6>
                            <p>Start shopping to see your orders here!</p>
                            <a href="catalog.html" class="btn btn-primary btn-sm">Browse Products</a>
                        </div>
                    `);
                    return;
                }

                // group rows by order_id
                const grouped = rows.reduce((acc, r) => {
                    acc[r.order_id] = acc[r.order_id] || { header: r, lines: [] };
                    acc[r.order_id].lines.push(r);
                    return acc;
                }, {});

                // sort by date_ordered desc
                const groups = Object.values(grouped).sort((a, b) => {
                    return new Date(b.header.date_ordered) - new Date(a.header.date_ordered);
                });

                // limit to recent 5
                const recent = groups.slice(0, 5);

                let html = '';
                recent.forEach(group => {
                    const h = group.header;
                    const status = (h.status || 'pending').toUpperCase();
                    const createdAt = new Date(h.date_ordered).toLocaleString();
                    const total = (typeof h.total_amount === 'number') ? h.total_amount : null;

                    html += `
                        <div class="card mb-3">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>Order #${h.order_id}</strong>
                                    <span class="badge badge-secondary ml-2">${status}</span>
                                </div>
                                <div class="text-muted small">${createdAt}</div>
                            </div>
                            <div class="card-body p-0">
                                <div class="table-responsive">
                                    <table class="table mb-0">
                                        <thead>
                                            <tr>
                                                <th style="width:60px;"></th>
                                                <th>Item</th>
                                                <th style="width:120px;">Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                    `;

                    group.lines.forEach(line => {
                        const imgSrc = line.image_path ? (url + line.image_path) : 'https://via.placeholder.com/60?text=%20';
                        html += `
                            <tr>
                                <td><img src="${imgSrc}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;"></td>
                                <td>
                                    <div class="font-weight-bold">${line.item_name}</div>
                                    <div class="small text-muted">${line.item_description || ''}</div>
                                </td>
                                <td>${line.quantity}</td>
                            </tr>
                        `;
                    });

                    html += `
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="card-footer d-flex justify-content-between align-items-center">
                                <a href="orders.html" class="btn btn-sm btn-outline-primary">View all orders</a>
                                ${total !== null ? `<span class="small text-muted">Total: ₱${Number(total).toFixed(2)}</span>` : ''}
                            </div>
                        </div>
                    `;
                });

                $('#recentOrders').html(html);
            },
            error: function(xhr) {
                console.error('Failed to load user recent orders', xhr);
                $('#recentOrders').html(`
                    <div class="alert alert-danger">
                        Failed to load your recent orders.
                    </div>
                `);
            }
        });
    };

    // Logout functionality
    $('#logoutBtn').on('click', function(e) {
        e.preventDefault();
        Swal.fire({
            title: 'Are you sure?',
            text: 'You will be logged out of your account.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, logout'
        }).then((result) => {
            if (result.isConfirmed) {
                sessionStorage.clear();
                window.location.href = 'login.html';
            }
        });
    });

    // Load header
    $("#home").load("header.html", function () {
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

        // Quick Actions: remove "View Reports" if present, and add "Manage Orders" for admins
        const quickActions = $('#quickActions, .quick-actions, #dashboardQuickActions');
        if (quickActions.length) {
            // Remove any "View Reports" action buttons/links
            quickActions.find('a, button').filter(function(){
                const t = ($(this).text() || '').toLowerCase();
                return t.includes('view reports') || t.includes('reports');
            }).closest('a, button, li').remove();

            // Add Manage Orders (admin only)
            const roleText = $('#userRole').text().trim().toLowerCase();
            if (roleText === 'admin' && quickActions.find('#qaManageOrders').length === 0) {
                const manageBtn = $('<a>', {
                    id: 'qaManageOrders',
                    class: 'btn btn-warning btn-sm ml-2',
                    href: 'admin-orders.html',
                    text: 'Manage Orders'
                });
                // If it's a button group/list
                if (quickActions.is('ul, ol')) {
                    quickActions.append($('<li class="list-inline-item"></li>').append(manageBtn));
                } else {
                    quickActions.append(manageBtn);
                }
            }
        }
    });

    // Load header
    $("#home").load("header.html", function () {
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

        // Add Manage Orders button for admins only
        const roleText = $('#userRole').text().trim().toLowerCase();
        if (roleText === 'admin' && $('#goToOrders').length === 0) {
            const btn = $('<a>', { id: 'goToOrders', class: 'btn btn-warning ml-2', href: 'admin-orders.html', text: 'Manage Orders' });
            // Try to place near profile/logout in the header bar if available
            const headerActions = $('.d-flex.justify-content-between .btn-danger').parent();
            if (headerActions.length) {
                headerActions.prepend(btn);
            } else {
                // Fallback: insert above admin dashboard
                if ($('#adminDashboard').length) {
                    $('<div class="mb-3"></div>').append(btn).insertBefore($('#adminDashboard'));
                }
            }
        }
    });

    // Initialize dashboard
    loadUserDashboard();
});