$(function() {
  function renderHeader() {
    const userId = sessionStorage.getItem('userId');
    let html = '';
    if (!userId) {
      html += '<li class="nav-item"><a class="nav-link" href="home.html">Home</a></li>';
      html += '<li class="nav-item"><a class="nav-link" href="catalog.html">Catalog</a></li>';
      html += '<li class="nav-item"><a class="nav-link" href="register.html">Register</a></li>';
      html += '<li class="nav-item"><a class="nav-link" href="login.html">Login</a></li>';
    } else {
      html += '<li class="nav-item"><a class="nav-link" href="home.html">Home</a></li>';
      html += '<li class="nav-item"><a class="nav-link" href="catalog.html">Catalog</a></li>';
      html += '<li class="nav-item"><a class="nav-link" href="dashboard.html">Dashboard</a></li>';
      html += '<li class="nav-item dropdown">';
      html += '<a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">Account</a>';
      html += '<div class="dropdown-menu dropdown-menu-right" aria-labelledby="userDropdown">';
      html += '<a class="dropdown-item" href="profile.html">Profile</a>';
      html += '<a class="dropdown-item" href="#" id="logout-link">Logout</a>';
      html += '</div></li>';
      html += '<li class="nav-item"><a class="nav-link" href="cart.html"><i class="fas fa-shopping-cart"></i> <span id="itemCount" class="badge badge-pill badge-success" style="display:none;">0</span></a></li>';
    }
    $('#headerNav').html(html);
    // Logout logic
    $('#logout-link').on('click', function(e) {
      e.preventDefault();
      sessionStorage.removeItem('userId');
      window.location.href = 'login.html';
    });
  }
  renderHeader();
}); 