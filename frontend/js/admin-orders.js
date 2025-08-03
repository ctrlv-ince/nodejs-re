/**
 * Admin Orders page logic
 * - Requires admin role (via token + backend protection)
 * - Lists recent orders (requires backend GET /api/v1/orders endpoint if implemented)
 * - Allows updating order status via PUT /api/v1/orders/:id
 */
$(function () {
  const url = 'http://localhost:4000/';

  // Load header
  $('#home').load('header.html', function () {
    const userId = sessionStorage.getItem('userId');
    const token = sessionStorage.getItem('token');
    if (!userId || !token) {
      $('#adminOnly').show().text('Login required. Redirecting...');
      setTimeout(() => (window.location.href = 'login.html'), 1200);
      return;
    }
    // Change Login to Logout
    const $loginLink = $('a.nav-link[href="login.html"]');
    $loginLink
      .text('Logout')
      .attr({ href: '#', id: 'logout-link' })
      .on('click', function (e) {
        e.preventDefault();
        sessionStorage.clear();
        window.location.href = 'login.html';
      });
  });

  function getToken() {
    const token = sessionStorage.getItem('token');
    if (!token) {
      Swal.fire({
        icon: 'warning',
        text: 'You must be logged in.',
        showConfirmButton: true,
      }).then(() => (window.location.href = 'login.html'));
      return null;
    }
    return token;
  }

  // Render table rows
  function renderRows(rows) {
    const tbody = $('#ordersTable tbody');
    tbody.empty();
    if (!rows || rows.length === 0) {
      tbody.append(
        '<tr><td colspan="5" class="text-center text-muted">No orders found.</td></tr>'
      );
      return;
    }
    rows.forEach((r) => {
      // Support new and legacy field names
      const id = r.order_no ?? r.order_id ?? r.id ?? r.orderinfo_id ?? '';
      const user =
        r.user ||
        r.customer_name ||
        ((r.first_name || r.last_name) ? `${r.first_name || ''} ${r.last_name || ''}`.trim() : '') ||
        r.user_name ||
        'User';
      const placedRaw = (r.date_ordered ?? r.date_placed ?? r.date) || '';
      const placed = placedRaw ? new Date(placedRaw).toLocaleString() : '';
      const status = r.status || 'processing';
      const row = `
        <tr data-id="${id}">
          <td>#${id}</td>
          <td>${user}</td>
          <td>${placed}</td>
          <td>
            <select class="form-control form-control-sm order-status">
              <option value="processing" ${status === 'processing' ? 'selected' : ''}>processing</option>
              <option value="shipped" ${status === 'shipped' ? 'selected' : ''}>shipped</option>
              <option value="completed" ${status === 'completed' ? 'selected' : ''}>completed</option>
              <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>cancelled</option>
            </select>
          </td>
          <td>
            <button class="btn btn-sm btn-primary save-order">Save</button>
          </td>
        </tr>
      `;
      tbody.append(row);
    });
  }

  // Load orders (requires backend list endpoint GET /api/v1/orders)
  function loadOrders() {
    const token = getToken();
    if (!token) return;

    $.ajax({
      method: 'GET',
      url: `${url}api/v1/orders?limit=20&offset=0`,
      headers: { Authorization: `Bearer ${token}` },
      success: function (resp) {
        const rows = (resp && (resp.rows || resp.data)) || [];
        renderRows(rows);
      },
      error: function () {
        // If list endpoint not available, show placeholder row
        const tbody = $('#ordersTable tbody');
        tbody.empty().append(
          `<tr><td colspan="5" class="text-center text-muted">
              Orders list endpoint not available. You can still update a known order by entering its ID manually below.
            </td></tr>
            <tr>
              <td colspan="5">
                <div class="input-group input-group-sm">
                  <div class="input-group-prepend"><span class="input-group-text">Order #</span></div>
                  <input id="manualOrderId" type="number" class="form-control" placeholder="e.g., 1001">
                  <div class="input-group-prepend"><span class="input-group-text">Status</span></div>
                  <select id="manualOrderStatus" class="form-control">
                    <option>processing</option>
                    <option>shipped</option>
                    <option>completed</option>
                    <option>cancelled</option>
                  </select>
                  <div class="input-group-append">
                    <button id="manualSaveOrder" class="btn btn-primary">Save</button>
                  </div>
                </div>
              </td>
            </tr>`
        );
      },
    });
  }

  // Save button inside table
  $(document).off('click', '.save-order').on('click', '.save-order', function () {
    const token = getToken();
    if (!token) return;

    const $tr = $(this).closest('tr');
    const orderId = $tr.data('id');
    const status = $tr.find('.order-status').val();

    $.ajax({
      method: 'PUT',
      url: `${url}api/v1/orders/${orderId}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ status }),
      success: function (resp) {
        Swal.fire({
          icon: 'success',
          title: 'Updated',
          text:
            (resp && resp.message) || 'Order updated and email sent with PDF',
          timer: 1500,
          showConfirmButton: false,
          position: 'top-end',
        });
      },
      error: function (xhr) {
        const msg =
          (xhr.responseJSON &&
            (xhr.responseJSON.message || xhr.responseJSON.error)) ||
          'Failed to update order';
        Swal.fire({ icon: 'error', text: msg });
      },
    });
  });

  // Manual save (if list endpoint missing)
  $(document).off('click', '#manualSaveOrder').on('click', '#manualSaveOrder', function () {
    const token = getToken();
    if (!token) return;

    const orderId = parseInt($('#manualOrderId').val(), 10);
    const status = $('#manualOrderStatus').val();

    if (!orderId) {
      Swal.fire({ icon: 'warning', text: 'Please enter a valid Order #' });
      return;
    }

    $.ajax({
      method: 'PUT',
      url: `${url}api/v1/orders/${orderId}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ status }),
      success: function (resp) {
        Swal.fire({
          icon: 'success',
          title: 'Updated',
          text:
            (resp && resp.message) || 'Order updated and email sent with PDF',
          timer: 1500,
          showConfirmButton: false,
          position: 'top-end',
        });
      },
      error: function (xhr) {
        const msg =
          (xhr.responseJSON &&
            (xhr.responseJSON.message || xhr.responseJSON.error)) ||
          'Failed to update order';
        Swal.fire({ icon: 'error', text: msg });
      },
    });
  });

  // Refresh button
  $(document).off('click', '#refreshOrders').on('click', '#refreshOrders', function () {
    loadOrders();
  });

  // Initial load
  loadOrders();
});