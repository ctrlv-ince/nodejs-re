$(function () {
  const url = 'http://localhost:4000/';

  // Load header and enforce admin-only access
  $('#home').load('header.html', function () {
    const token = sessionStorage.getItem('token');
    if (!token) {
      Swal.fire({
        icon: 'warning',
        text: 'You must be logged in as an admin to access Manage Items.',
        showConfirmButton: true
      }).then(() => window.location.href = 'login.html');
      return;
    }
    // Optionally verify role by calling profile
    $.ajax({
      method: 'GET',
      url: `${url}api/v1/profile`,
      headers: { Authorization: `Bearer ${token}` },
      success: function (data) {
        if (!(data && data.user && data.user.role === 'admin')) {
          Swal.fire({
            icon: 'error',
            text: 'Admin access required.',
            showConfirmButton: true
          }).then(() => window.location.href = 'dashboard.html');
        }
      },
      error: function () {
        Swal.fire({
          icon: 'error',
          text: 'Unable to verify access.',
        }).then(() => window.location.href = 'login.html');
      }
    });
  });

  const $tableBody = $('#itemsTable tbody');
  const token = sessionStorage.getItem('token');

  function imgTagOrPlaceholder(imagePath, alt) {
    const src = imagePath ? (url + imagePath) : 'https://via.placeholder.com/80x60?text=No+Image';
    return `<img src="${src}" alt="${alt || 'img'}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;">`;
  }

  // Populate group select options with robust parsing (API returns array of rows)
  function populateGroupSelect($select, preselectId) {
    $.ajax({
      url: `${url}api/v1/groups`,
      method: 'GET',
      dataType: 'json',
      success: function (data) {
        const rows = Array.isArray(data) ? data : (data.rows || data || []);
        $select.empty().append('<option value="">-- none --</option>');
        rows.forEach(function (g) {
          if (g && (g.group_id !== undefined)) {
            const gid = g.group_id;
            const name = g.group_name || `Group ${gid}`;
            $select.append(`<option value="${gid}">${name}</option>`);
          }
        });
        if (preselectId) {
          $select.val(String(preselectId));
        }
      },
      error: function (xhr) {
        console.error('Failed to load groups:', xhr);
        // keep existing options if any
      }
    });
  }

  function fetchItems() {
    $.get(`${url}api/v1/items`, function (data) {
      const rows = data.rows || [];
      $tableBody.empty();
      rows.forEach(function (row) {
        const tr = `
          <tr data-id="${row.item_id}">
            <td>${row.item_id}</td>
            <td>${row.item_name}</td>
            <td class="text-truncate" style="max-width: 320px;" title="${row.item_description}">${row.item_description}</td>
            <td>₱ ${Number(row.price).toFixed(2)}</td>
            <td>${row.quantity ?? row.qty ?? ''}</td>
            <td>${row.group_name || '-'}</td>
            <td>
              <div class="btn-group btn-group-sm">
                <button class="btn btn-warning btn-edit" type="button">Edit Item</button>
                <button class="btn btn-outline-danger btn-delete">Delete</button>
              </div>
            </td>
          </tr>
        `;
        $tableBody.append(tr);
      });
    }).fail(function (xhr) {
      console.error('Fetch items error:', xhr);
      Swal.fire({ icon: 'error', text: 'Failed to load items.' });
    });
  }

  // Open modal for new item
  $('#btnNewItem').on('click', function () {
    resetForm();
    $('#itemModalLabel').text('New Item');
    populateGroupSelect($('#group_id'), null);
    $('#itemModal').modal('show');
  });

  // Edit item
  $(document).on('click', '.btn-edit', function () {
    const $tr = $(this).closest('tr');
    const id = $tr.data('id');
    $.get(`${url}api/v1/items/${id}`, function (data) {
      const item = (data.result && data.result[0]) ? data.result[0] : null;
      if (!item) {
        Swal.fire({ icon: 'error', text: 'Item not found.' });
        return;
      }
      resetForm();
      $('#itemModalLabel').text('Edit Item');
      $('#itemId').val(item.item_id);
      $('#item_name').val(item.item_name);
      $('#item_description').val(item.item_description);
      $('#price').val(item.price);
      if (item.quantity !== undefined) $('#quantity').val(item.quantity);

      // Populate groups and preselect if API returns group_id
      populateGroupSelect($('#group_id'), item.group_id || null);

      // Clear and render images with delete (X) buttons
      $('#imagePreview').empty();

      $.ajax({
        method: 'GET',
        url: `${url}api/v1/items/${id}/images`
      }).done(function (imgData) {
        const rows = Array.isArray(imgData) ? imgData : (imgData && imgData.rows ? imgData.rows : []);
        const seen = new Set();

        if ((!rows || rows.length === 0) && item.image_path) {
          const onceSrc = item.image_path.startsWith('http') ? item.image_path : (url + item.image_path);
          $('#imagePreview').append(
            `<div class="position-relative d-inline-block m-1">
               <img src="${onceSrc}" class="border rounded" style="width:80px;height:80px;object-fit:cover;">
             </div>`
          );
          return;
        }

        rows.forEach(function (img) {
          const raw = img.image_path || '';
          const full = raw.startsWith('http') ? raw : (url + raw);
          if (raw && !seen.has(raw)) {
            seen.add(raw);
            $('#imagePreview').append(
              `<div class="position-relative d-inline-block m-1">
                 <img src="${full}" class="border rounded" style="width:80px;height:80px;object-fit:cover;">
                 <button class="btn btn-sm btn-danger position-absolute" style="top:-8px;right:-8px;border-radius:50%;padding:2px 6px;"
                         data-image="${raw}" data-id="${id}" title="Delete image">&times;</button>
               </div>`
            );
          }
        });
      }).always(function () {
        $('#itemModal').modal('show');
      });

    }).fail(function () {
      Swal.fire({ icon: 'error', text: 'Failed to load item details.' });
    });
  });

  // Delete item
  $(document).on('click', '.btn-delete', function () {
    const id = $(this).closest('tr').data('id');
    const token = sessionStorage.getItem('token');
    Swal.fire({
      title: 'Delete item?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete',
    }).then((res) => {
      if (!res.isConfirmed) return;
      $.ajax({
        method: 'DELETE',
        url: `${url}api/v1/items/${id}`,
        headers: { Authorization: `Bearer ${token}` },
        success: function () {
          Swal.fire({ icon: 'success', text: 'Item deleted.' });
          fetchItems();
        },
        error: function (xhr) {
          console.error(xhr);
          Swal.fire({ icon: 'error', text: 'Failed to delete item.' });
        }
      });
    });
  });

  // Preview multiple images on create
  $(document).on('change', '#images', function () {
    $('#imagePreview').empty();
    const files = this.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = function (e) {
        $('#imagePreview').append(
          `<img src="${e.target.result}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;margin:4px;">`
        );
      };
      reader.readAsDataURL(file);
    });
  });

  function resetForm() {
    $('#itemForm')[0].reset();
    $('#itemId').val('');
    $('#imagePreview').empty();
  }

  // Track pending action to avoid overlapping toasts (e.g., delete confirmation vs. update success)
  let actionPending = null; // 'delete-image' | 'update' | null

  // Ensure single binding for submit and delete handlers
  $(document).off('submit', '#itemForm');

  // Create or update submit
  $('#itemForm').on('submit', function (e) {
    e.preventDefault();
    // If a delete confirmation is in progress, block updates
    if (window.__modalBusy) return;

    const id = $('#itemId').val();
    const isEdit = !!id;
    const token = sessionStorage.getItem('token');

    if (!token) {
      Swal.fire({ icon: 'warning', text: 'You must be logged in.' });
      return;
    }

    actionPending = 'update';

    if (!isEdit) {
      const formEl = $('#itemForm')[0];
      const formData = new FormData(formEl);
      // Ensure group_id is included
      const gid = $('#group_id').val();
      if (gid) formData.append('group_id', gid);

      $.ajax({
        method: 'POST',
        url: `${url}api/v1/items`,
        data: formData,
        processData: false,
        contentType: false,
        headers: { Authorization: `Bearer ${token}` },
        success: function () {
          if (actionPending === 'update') {
            Swal.fire({ icon: 'success', text: 'Item created.' });
          }
          $('#itemModal').modal('hide');
          actionPending = null;
          fetchItems();
        },
        error: function (xhr) {
          console.error(xhr);
          actionPending = null;
          const msg = (xhr.responseJSON && (xhr.responseJSON.error || xhr.responseJSON.message)) || 'Failed to create item.';
          Swal.fire({ icon: 'error', text: msg });
        }
      });
    } else {
      const formData = new FormData();
      formData.append('item_name', $('#item_name').val());
      formData.append('item_description', $('#item_description').val());
      formData.append('price', $('#price').val());
      formData.append('quantity', $('#quantity').val());
      const gid = $('#group_id').val();
      if (gid) formData.append('group_id', gid);
      const files = $('#images')[0].files;
      if (files && files.length > 0) {
        formData.append('image', files[0]);
      }
      $.ajax({
        url: `${url}api/v1/items/${id}`,
        type: 'PUT',
        data: formData,
        processData: false,
        contentType: false,
        headers: { Authorization: `Bearer ${token}` },
        success: function (resp) {
          if (actionPending === 'update') {
            Swal.fire({ icon: 'success', text: (resp && resp.message) ? resp.message : 'Item updated.' });
          }
          $('#itemModal').modal('hide');
          actionPending = null;
          fetchItems();
        },
        error: function (xhr) {
          console.error('Update error:', xhr);
          actionPending = null;
          const detail = (xhr.responseJSON && (xhr.responseJSON.details || xhr.responseJSON.error || xhr.responseJSON.image_error)) || xhr.statusText || 'Unknown error';
          Swal.fire({ icon: 'error', text: `Failed to update item: ${detail}` });
        }
      });
    }
  });

  // SINGLE delete image handler (X button) - prevent duplicate bindings and form submits
  $(document).off('click', '#imagePreview button[data-image]');
  $(document).on('click', '#imagePreview button[data-image]', function (e) {
    // Prevent this click from submitting form
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const token = sessionStorage.getItem('token');
    if (!token) {
      Swal.fire({ icon: 'warning', text: 'You must be logged in.' });
      return;
    }

    // Always coerce button to type="button" to avoid implicit submit
    $(this).attr('type', 'button');

    const raw = $(this).data('image');
    // Prefer the hidden input value for current item id
    const id = $('#itemId').val() || $(this).data('id');

    // Block updates while delete confirmation is active
    window.__modalBusy = true;

    // Disable save to avoid accidental submit via Enter key
    const $submitBtn = $('#itemForm button[type="submit"]');
    const prevDisabled = $submitBtn.prop('disabled');
    $submitBtn.prop('disabled', true);

    Swal.fire({
      title: 'Delete image?',
      text: 'This will remove the image from the gallery.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      allowOutsideClick: false,
      allowEscapeKey: false,
      focusConfirm: true,
      didOpen: () => {
        window.__modalBusy = true;
      }
    }).then((res) => {
      if (!res.isConfirmed) {
        window.__modalBusy = false;
        $submitBtn.prop('disabled', prevDisabled);
        return;
      }

      $.ajax({
        url: `${url}api/v1/items/${id}/images`,
        type: 'DELETE',
        data: JSON.stringify({ image_path: raw }),
        processData: false,
        contentType: 'application/json; charset=utf-8',
        headers: { Authorization: `Bearer ${token}` },
        success: function () {
          Swal.fire({ icon: 'success', text: 'Image deleted.' });

          // Rebuild thumbnails only (do not close modal or trigger update flow)
          $('#imagePreview').empty();
          $.get(`${url}api/v1/items/${id}/images`, function (imgData) {
            const rows = Array.isArray(imgData) ? imgData : (imgData && imgData.rows ? imgData.rows : []);
            const seen = new Set();
            rows.forEach(function (img) {
              const raw2 = img.image_path || '';
              const full = raw2.startsWith('http') ? raw2 : (url + raw2);
              if (raw2 && !seen.has(raw2)) {
                seen.add(raw2);
                $('#imagePreview').append(
                  `<div class="position-relative d-inline-block m-1">
                     <img src="${full}" class="border rounded" style="width:80px;height:80px;object-fit:cover;">
                     <button type="button" class="btn btn-sm btn-danger position-absolute"
                             style="top:-8px;right:-8px;border-radius:50%;padding:2px 6px;"
                             data-image="${raw2}" data-id="${id}" title="Delete image">&times;</button>
                   </div>`
                );
              }
            });
          }).always(function () {
            window.__modalBusy = false;
            $submitBtn.prop('disabled', prevDisabled);
          });
        },
        error: function (xhr) {
          const detail = (xhr.responseJSON && (xhr.responseJSON.details || xhr.responseJSON.error)) || xhr.statusText || 'Unknown error';
          Swal.fire({ icon: 'error', text: `Failed to delete image: ${detail}` });
          window.__modalBusy = false;
          $submitBtn.prop('disabled', prevDisabled);
        }
      });
    });
  });

  // Initial load
  fetchItems();
});