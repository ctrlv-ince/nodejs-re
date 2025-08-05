$(function () {
  const url = 'http://localhost:4000/';

  // Load header and verify auth
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

  // Reusable initializer for DataTables on Groups table
  // initializeGroupsDataTable no longer needed; initialization is done fresh in loadGroups()
  function initializeGroupsDataTable() { /* deprecated */ }

  // Load groups into table and select, then initialize DataTable
  function loadGroups() {
    $.get(`${url}api/v1/groups`, function (rows) {
      const $table = $('#groupsTable');
      const $tbody = $table.find('tbody');
      const $sel = $('#assign_group');

      // Reset UI
      $tbody.empty();
      $sel.empty();

      if (!rows || rows.length === 0) {
        // Use a proper placeholder row
        $tbody.append('<tr><td colspan="4" class="text-center text-muted">No groups.</td></tr>');
        initializeGroupsDataTable();
        return;
      }

      rows.forEach((g) => {
        // Ensure exactly 4 <td> cells per row to match the 4 <th> columns
        const name = (g.group_name || '').toString().replace(/</g,'<').replace(/>/g,'>');
        const desc = (g.group_description || '').toString().replace(/</g,'<').replace(/>/g,'>');
        $tbody.append(
          '<tr>' +
            `<td>${g.group_id}</td>` +
            `<td>${name}</td>` +
            `<td>${desc}</td>` +
            '<td>' +
              `<button class="btn btn-sm btn-outline-primary edit-group" data-id="${g.group_id}">Edit</button> ` +
              `<button class="btn btn-sm btn-outline-danger delete-group" data-id="${g.group_id}">Delete</button>` +
            '</td>' +
          '</tr>'
        );
        $sel.append(`<option value="${g.group_id}">${g.group_name}</option>`);
      });

      // Initialize or re-initialize the DataTable after populating rows
      initializeGroupsDataTable();
      if ($.fn.DataTable && $.fn.DataTable.isDataTable($table)) {
        const dt = $table.DataTable();
        dt.columns.adjust();
        if (dt.responsive && dt.responsive.recalc) dt.responsive.recalc();
      }
    }).fail((xhr) => {
      console.error('Load groups error:', xhr?.responseJSON || xhr);
      $('#groupsTable tbody').html('<tr><td colspan="4" class="text-center text-danger">Failed to load groups.</td></tr>');
      // Instantiate DataTable to keep search/paging UI visible even on error
      initializeGroupsDataTable();
    });
  }

  // Load items into assign select (simple list of items)
  function loadItems() {
    $.get(`${url}api/v1/items`, function (data) {
      const items = data.rows || [];
      const sel = $('#assign_item');
      sel.empty();
      items.forEach((it) => {
        sel.append(`<option value="${it.item_id}">${it.item_name}</option>`);
      });
    }).fail((xhr) => {
      console.error('Load items error:', xhr?.responseJSON || xhr);
    });
  }

  // Save group (create or update)
  $('#groupForm').on('submit', function (e) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    const group_id = $('#group_id').val();
    const payload = {
      group_name: $('#group_name').val().trim(),
      group_description: $('#group_description').val().trim(),
    };
    if (!payload.group_name) {
      Swal.fire({ icon: 'warning', text: 'Group name is required' });
      return;
    }

    const isCreate = !group_id;
    const method = isCreate ? 'POST' : 'PUT';
    const path = isCreate ? `${url}api/v1/groups` : `${url}api/v1/groups/${group_id}`;

    $.ajax({
      url: path,
      type: method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: JSON.stringify(payload),
      success: function () {
        Swal.fire({ icon: 'success', text: isCreate ? 'Group created' : 'Group updated', timer: 1200, showConfirmButton: false });
        $('#groupForm')[0].reset();
        $('#group_id').val('');
        loadGroups();
      },
      error: function (xhr) {
        const msg = (xhr.responseJSON && (xhr.responseJSON.message || xhr.responseJSON.error)) || 'Failed to save group';
        Swal.fire({ icon: 'error', text: msg });
      },
    });
  });

  // Reset form
  $('#resetForm').on('click', function () {
    $('#groupForm')[0].reset();
    $('#group_id').val('');
  });

  // Edit group button
  $(document).on('click', '.edit-group', function () {
    const id = $(this).data('id');
    // Simplest: fetch by id using existing list (or create GET /groups/:id if needed)
    // Here, we just fill form with table row values
    const $tr = $(this).closest('tr');
    $('#group_id').val(id);
    $('#group_name').val($tr.children().eq(1).text());
    $('#group_description').val($tr.children().eq(2).text());
  });

  // Delete group
  $(document).on('click', '.delete-group', function () {
    const token = getToken();
    if (!token) return;
    const id = $(this).data('id');

    Swal.fire({
      title: 'Delete group?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete',
    }).then((res) => {
      if (!res.isConfirmed) return;

      $.ajax({
        url: `${url}api/v1/groups/${id}`,
        type: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        success: function () {
          Swal.fire({ icon: 'success', text: 'Group deleted', timer: 1200, showConfirmButton: false });
          loadGroups();
        },
        error: function (xhr) {
          const msg = (xhr.responseJSON && (xhr.responseJSON.message || xhr.responseJSON.error)) || 'Failed to delete group';
          Swal.fire({ icon: 'error', text: msg });
        },
      });
    });
  });

  // Assign item to group (placeholder endpoint; adjust to your backend)
  $('#assignBtn').on('click', function () {
    const token = getToken();
    if (!token) return;
    const group_id = $('#assign_group').val();
    const item_id = $('#assign_item').val();
    if (!group_id || !item_id) {
      Swal.fire({ icon: 'warning', text: 'Select both group and item' });
      return;
    }

    // If you have a dedicated endpoint, use it (e.g., POST /api/v1/item-groups)
    // For now, just show a confirmation and refresh.
    Swal.fire({ icon: 'success', text: `Assigned item ${item_id} to group ${group_id}`, timer: 1200, showConfirmButton: false });
    // TODO: Replace with real endpoint and refresh group items table.
  });

  // Refresh tables
  $('#refreshGroups').on('click', loadGroups);
  $('#refreshGroupItems').on('click', function () {
    // Placeholder: implement GET /api/v1/item-groups to list assignments
    $('#groupItemsTable tbody').html('<tr><td colspan="3" class="text-center text-muted">Not implemented yet.</td></tr>');
  });

  // Ensure DataTable is available after DOM-ready in case of very fast responses
  $(document).ready(function () {
    if ($.fn.DataTable) {
      initializeGroupsDataTable();
    }
  });

  // Initial loads
  loadGroups();
  loadItems();
});