$(function() {
  function softLogoutInactive(message) {
    try {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'warning',
          title: 'Account inactive',
          text: message || 'Your account is inactive. Please contact support or an administrator.',
          showConfirmButton: true
        }).then(() => {
          sessionStorage.clear();
          window.location.href = 'login.html';
        });
      } else {
        alert(message || 'Your account is inactive.');
        sessionStorage.clear();
        window.location.href = 'login.html';
      }
    } catch (_) {
      sessionStorage.clear();
      window.location.href = 'login.html';
    }
  }

  function renderHeader() {
    const userId = sessionStorage.getItem('userId');
    const token = sessionStorage.getItem('token');
    let html = '';

    // Always show base links
    html += '<li class="nav-item"><a class="nav-link" href="home.html">Home</a></li>';
    html += '<li class="nav-item"><a class="nav-link" href="catalog.html">Catalog</a></li>';

    if (!userId || !token) {
      // Guest-only links
      html += '<li class="nav-item"><a class="nav-link" href="register.html">Register</a></li>';
      html += '<li class="nav-item"><a class="nav-link" href="login.html">Login</a></li>';
      $('#headerNav').html(html);
      return;
    }

    // Logged-in common links
    html += '<li class="nav-item"><a class="nav-link" href="dashboard.html">Dashboard</a></li>';

    // Placeholder for admin-only link; will be inserted after verifying role
    html += '<span id="adminLinksPlaceholder"></span>';

    html += '<li class="nav-item dropdown">';
    html += '<a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">Account</a>';
    html += '<div class="dropdown-menu dropdown-menu-right" aria-labelledby="userDropdown">';
    html += '<a class="dropdown-item" href="profile.html">Profile</a>';
    html += '<a class="dropdown-item" href="#" id="logout-link">Logout</a>';
    html += '</div></li>';
    html += '<li class="nav-item"><a class="nav-link" href="cart.html"><i class="fas fa-shopping-cart"></i> <span id="itemCount" class="badge badge-pill badge-success" style="display:none;">0</span></a></li>';

    $('#headerNav').html(html);

    // Verify role and status; if inactive, force logout with warning
    $.ajax({
      method: 'GET',
      url: `${url}api/v1/profile`,
      headers: { 'Authorization': 'Bearer ' + token }
    }).done(function(data) {
      if (data && data.user) {
        if (data.user.account_status && data.user.account_status !== 'active') {
          // backend/routes/user.js now enforces active, but if token still valid in browser, show warning and logout
          softLogoutInactive('Your account has been set to inactive. Please login again.');
          return;
        }
        if (data.user.role === 'admin') {
          const adminLink = '<li class="nav-item"><a class="nav-link" href="items.html" id="manageItemsLink">Manage Items</a></li>';
          $('#adminLinksPlaceholder').replaceWith(adminLink);
        } else {
          $('#adminLinksPlaceholder').remove();
        }
      }
    }).fail(function(xhr) {
      // If backend blocks inactive with 403 "Account is inactive", surface warning and logout
      if (xhr && (xhr.status === 403 || xhr.status === 401)) {
        const msg = (xhr.responseJSON && (xhr.responseJSON.message || xhr.responseJSON.error)) || 'Your session is not valid.';
        if (/inactive/i.test(msg)) {
          softLogoutInactive('Your account is inactive. Please login again.');
          return;
        }
      }
      $('#adminLinksPlaceholder').remove();
    });

    // Logout logic
    $('#logout-link').on('click', function(e) {
      e.preventDefault();
      sessionStorage.clear();
      window.location.href = 'login.html';
    });
  }
  renderHeader();

  // Global AJAX guard: if any API says inactive, warn and logout immediately
  $(document).ajaxError(function(event, jqxhr, settings) {
    if (!jqxhr) return;
    if (jqxhr.status === 403 || jqxhr.status === 401) {
      const msg = (jqxhr.responseJSON && (jqxhr.responseJSON.message || jqxhr.responseJSON.error)) || '';
      if (/inactive/i.test(msg)) {
        softLogoutInactive('Your account is inactive. Please login again.');
      }
    }
  });
});