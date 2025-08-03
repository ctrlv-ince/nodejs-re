$(function() {
  $('#home').load('header.html');

  function renderStars(rating) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    const full = Math.floor(r);
    const half = r - full >= 0.25 && r - full < 0.75 ? 1 : 0;
    const adjFull = half ? full : Math.round(r);
    const empties = 5 - (adjFull + half);
    const fullStars = '★'.repeat(adjFull);
    const halfStar = half ? '☆' : '';
    const emptyStars = '☆'.repeat(empties);
    return `<span style="color:#f1c40f;font-size:14px;letter-spacing:1px;">${fullStars}${halfStar}${emptyStars}</span>`;
  }

  function loadItemReviews(itemId) {
    $('#reviewsSummary').html('<span class="text-muted">Loading reviews…</span>');
    $('#reviewsList').empty();
    $.get(`http://localhost:4000/api/v1/reviews/${itemId}`, function(data){
      const rows = (data && (data.rows || data.result || data)) || [];
      if (!Array.isArray(rows) || rows.length === 0) {
        $('#reviewsSummary').html('<span class="text-muted">No reviews yet.</span>');
        return;
      }
      const ratings = rows.map(r => Number(r.rating || r.stars || 0)).filter(n => !isNaN(n));
      const avg = ratings.length ? (ratings.reduce((a,b)=>a+b,0) / ratings.length) : 0;
      const summary = `${renderStars(avg)} <span class="ml-2">${avg.toFixed(1)} (${rows.length})</span>`;
      $('#reviewsSummary').html(summary);

      const html = rows.map(r => {
        const stars = renderStars(r.rating || r.stars || 0);
        const who = (r.user_name || r.username || r.account_name || 'Anonymous');
        const when = (r.created_at || r.updated_at || r.date) ? new Date(r.created_at || r.updated_at || r.date).toLocaleString() : '';
        const comment = (r.comment || r.review || '').toString();
        return `
          <div class="border rounded p-2 mb-2">
            <div class="d-flex justify-content-between">
              <div>${stars}</div>
              <div class="text-muted small">${who}${when ? ' · ' + when : ''}</div>
            </div>
            <div class="mt-1">${$('<div>').text(comment).html().replace(/\n/g,'<br>')}</div>
          </div>
        `;
      }).join('');
      $('#reviewsList').html(html);
    }).fail(function(){
      $('#reviewsSummary').html('<span class="text-danger">Failed to load reviews.</span>');
    });
  }

  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  if (!id) {
    $('#itemCard').html('<div class="alert alert-danger">No item specified.</div>');
    return;
  }
  $.get(`http://localhost:4000/api/v1/items/${id}`, function(data) {
    const item = data.result[0];
    const imgSrc = item.image_path ? ('http://localhost:4000/' + item.image_path) : 'https://via.placeholder.com/300x200?text=No+Image';
    const stock = Number(item.quantity || 0);
    const price = item.price;

    let stockBadge = '';
    if (stock > 0) {
      stockBadge = `<span class="badge badge-success">In stock: ${stock}</span>`;
    } else {
      stockBadge = `<span class="badge badge-secondary">Out of stock</span>`;
    }

    let html = `
      <div class="card mb-3">
        <div class="row no-gutters">
          <div class="col-md-5">
            <img src="${imgSrc}" class="card-img" alt="${item.item_name}">
          </div>
          <div class="col-md-7">
            <div class="card-body">
              <h3 class="card-title" style="color:#1abc9c; font-family:'Orbitron',monospace;">${item.item_name}</h3>
              <p class="card-text">${item.item_description}</p>
              <p class="card-text mb-1">₱ ${price}</p>
              <div class="mb-3">${stockBadge}</div>
              <div id="itemActions"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    $('#itemCard').html(html);
    // Load reviews after rendering item
    loadItemReviews(id);

    // Decide what actions to show:
    // - If admin: show Edit button that links to Manage Items (items.html) and preselects this item
    // - If regular logged-in user: show Add to Cart controls
    // - If not logged-in: info message
    const token = sessionStorage.getItem('token');
    if (token) {
      // Attempt to fetch profile to determine role
      $.ajax({
        method: 'GET',
        url: 'http://localhost:4000/api/v1/profile',
        headers: { 'Authorization': `Bearer ${token}` },
        success: function(resp) {
          const role = (resp && resp.user && resp.user.role) ? resp.user.role : 'user';
          if (role === 'admin') {
            // Admin: reveal inline edit form on this page, not redirect
            $('#adminEditSection').show();
            // Pre-fill fields
            $('#edit_item_name').val(item.item_name || '');
            $('#edit_item_description').val(item.item_description || '');
            $('#edit_price').val(item.price || '');
            $('#edit_quantity').val(item.quantity || '');

            // Load thumbs for admins with delete buttons
            $.get(`http://localhost:4000/api/v1/items/${id}/images`, function(imgData) {
              const rows = Array.isArray(imgData) ? imgData : (imgData && imgData.rows ? imgData.rows : []);
              const thumbs = rows.map(r => {
                const src = r.image_path ? ('http://localhost:4000/' + r.image_path) : null;
                if (!src) return '';
                return `
                  <div class="position-relative d-inline-block m-1">
                    <img src="${src}" class="border rounded" style="width:80px;height:80px;object-fit:cover;">
                    <button type="button" class="btn btn-sm btn-danger position-absolute" style="top:-8px;right:-8px;border-radius:50%;padding:2px 6px;"
                            data-image="${r.image_path}" data-id="${id}" title="Delete image">&times;</button>
                  </div>
                `;
              }).join('');
              $('#adminImageThumbs').html(thumbs || '<div class="text-muted">No images</div>');
            });

            // Prevent accidental Enter key submit while editing
            $(document).off('keypress', '#inlineEditForm').on('keypress', '#inlineEditForm', function(e){
              if (e.which === 13) { e.preventDefault(); }
            });

            // Inline edit submit (ensure proper enctype and method)
            $(document).off('submit', '#inlineEditForm').on('submit', '#inlineEditForm', function(e) {
              e.preventDefault();

              const token2 = sessionStorage.getItem('token');
              if (!token2) {
                Swal.fire({ icon: 'warning', text: 'You must be logged in.' });
                return;
              }

              // Build FormData directly from the form so file inputs are included correctly
              const formEl = document.getElementById('inlineEditForm');
              const fd = new FormData(formEl);

              $.ajax({
                url: `http://localhost:4000/api/v1/items/${id}`,
                type: 'PUT',
                data: fd,
                processData: false,
                contentType: false,
                headers: { 'Authorization': `Bearer ${token2}` },
                success: function(resp) {
                  Swal.fire({
                    icon: 'success',
                    title: 'Saved',
                    text: (resp && (resp.message || resp.success)) ? (resp.message || 'Changes saved successfully.') : 'Changes saved successfully.',
                    timer: 1500,
                    showConfirmButton: false,
                    position: 'top-end'
                  });
                  // Reload to reflect changes after brief toast
                  setTimeout(function(){
                    location.reload();
                  }, 1600);
                },
                error: function(xhr) {
                  console.error('Inline update error:', xhr);
                  const detail = (xhr.responseJSON && (xhr.responseJSON.details || xhr.responseJSON.error || xhr.responseJSON.image_error)) || xhr.statusText || 'Unknown error';
                  Swal.fire({ icon: 'error', text: `Failed to update item: ${detail}` });
                }
              });
            });

            // Delete image (strong guards to prevent propagation/submit)
            $(document).off('click', '#adminImageThumbs button[data-image]').on('click', '#adminImageThumbs button[data-image]', function(e){
              e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
              const imagePath = $(this).data('image');
              const token3 = sessionStorage.getItem('token');

              // Ensure button cannot act as submit
              $(this).attr('type', 'button');

              // Disable Save while confirming delete
              const $saveBtn = $('#inlineEditForm button[type="submit"]');
              const prevDisabled = $saveBtn.prop('disabled');
              $saveBtn.prop('disabled', true);

              Swal.fire({
                title: 'Delete image?',
                text: 'This will remove the image from the gallery.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, delete it',
                allowOutsideClick: false,
                allowEscapeKey: false,
                focusConfirm: true
              }).then((res) => {
                if (!res.isConfirmed) {
                  $saveBtn.prop('disabled', prevDisabled);
                  return;
                }
                $.ajax({
                  url: `http://localhost:4000/api/v1/items/${id}/images`,
                  type: 'DELETE',
                  data: JSON.stringify({ image_path: imagePath }),
                  processData: false,
                  contentType: 'application/json; charset=utf-8',
                  headers: { 'Authorization': `Bearer ${token3}` },
                  success: function() {
                    Swal.fire({ icon: 'success', text: 'Image deleted.' });
                    // Rebuild thumbnails without reloading page
                    $('#adminImageThumbs').empty();
                    $.get(`http://localhost:4000/api/v1/items/${id}/images`, function(imgData2) {
                      const rows2 = Array.isArray(imgData2) ? imgData2 : (imgData2 && imgData2.rows ? imgData2.rows : []);
                      const thumbs2 = rows2.map(r => {
                        const src2 = r.image_path ? ('http://localhost:4000/' + r.image_path) : null;
                        if (!src2) return '';
                        return `
                          <div class="position-relative d-inline-block m-1">
                            <img src="${src2}" class="border rounded" style="width:80px;height:80px;object-fit:cover;">
                            <button type="button" class="btn btn-sm btn-danger position-absolute" style="top:-8px;right:-8px;border-radius:50%;padding:2px 6px;"
                                    data-image="${r.image_path}" data-id="${id}" title="Delete image">&times;</button>
                          </div>
                        `;
                      }).join('');
                      $('#adminImageThumbs').html(thumbs2 || '<div class="text-muted">No images</div>');
                    }).always(function(){
                      $saveBtn.prop('disabled', prevDisabled);
                    });
                  },
                  error: function(xhr){
                    const detail = (xhr.responseJSON && (xhr.responseJSON.details || xhr.responseJSON.error)) || xhr.statusText || 'Unknown error';
                    Swal.fire({ icon: 'error', text: `Failed to delete image: ${detail}` });
                    $saveBtn.prop('disabled', prevDisabled);
                  }
                });
              });
            });

          } else {
            // Regular user: Add to Cart + Buy Now UI respecting stock
            const maxQty = Math.max(0, Number(item.quantity || 0));
            const disabled = maxQty === 0 ? 'disabled' : '';
            const help = maxQty > 0 ? `<small class="form-text text-muted">Max: ${maxQty}</small>` : `<div class="text-danger small">Out of stock</div>`;
            const qtyControl = `
              <div class="form-inline mb-2">
                <label class="mr-2" for="detailsQty">Qty</label>
                <input type="number" class="form-control mr-2" id="detailsQty" min="1" value="${Math.min(1, maxQty)}" ${maxQty ? `max="${maxQty}"` : ''} style="width:100px;" ${disabled}>
                ${help}
              </div>
            `;
            $('#itemActions').html(
              `${qtyControl}
               <button type="button" class="btn btn-primary" id="detailsAddToCart" ${disabled}>Add to Cart</button>
               <button type="button" class="btn btn-success ml-2" id="detailsBuyNow" ${disabled}>Buy Now</button>`
            );
          }
        },
        error: function() {
          // Fallback to user flow if profile fails
          $('#itemActions').html(
            `<input type="number" class="form-control mb-2" id="detailsQty" min="1" value="1">
             <button type="button" class="btn btn-primary" id="detailsAddToCart">Add to Cart</button>
             <a href="cart.html" class="btn btn-success ml-2">Go to Cart</a>`
          );
        }
      });
    } else {
      $('#itemActions').html('<div class="alert alert-info">Login to add to cart or checkout.</div>');
    }

    // Load all images for this item (gallery)
    $.ajax({
      method: 'GET',
      url: `http://localhost:4000/api/v1/items/${id}/images`
    }).done(function(imgData) {
      const rows = Array.isArray(imgData) ? imgData : (imgData && imgData.rows ? imgData.rows : []);
      if (rows.length > 0) {
        // Build a simple thumbnail strip under main image
        const thumbs = rows.map(r => {
          const src = r.image_path ? ('http://localhost:4000/' + r.image_path) : null;
          return src ? `<img src="${src}" class="img-thumbnail mr-2 mb-2 item-thumb" style="width:70px;height:70px;object-fit:cover;cursor:pointer;border:${r.is_primary ? '2px solid #1abc9c' : '1px solid #ccc'}">` : '';
        }).join('');
        $('#itemCard .card-body').append(`<div class="mt-3" id="itemThumbs">${thumbs}</div>`);
      }
    });

    // Click on a thumbnail replaces the main image
    $(document).on('click', '.item-thumb', function() {
      const newSrc = $(this).attr('src');
      $('#itemCard img.card-img').attr('src', newSrc);
    });
  });
  // Clamp quantity helper relative to stock
  function clampQty(val, stock) {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 1) return 1;
    if (stock && n > stock) return stock;
    return n;
  }

  // Enforce qty boundaries on input
  $(document).on('input change', '#detailsQty', function () {
    const maxAttr = parseInt($(this).attr('max') || '0', 10);
    const stock = isNaN(maxAttr) ? 0 : maxAttr;
    const clamped = clampQty($(this).val(), stock);
    if (String(clamped) !== String($(this).val())) $(this).val(clamped);
  });

  // Add to Cart respects stock, merges with existing, and caps to stock
  $(document).on('click', '#detailsAddToCart', function () {
    const maxAttr = parseInt($("#detailsQty").attr('max') || '0', 10);
    const stock = isNaN(maxAttr) ? 0 : maxAttr;
    const qty = clampQty($("#detailsQty").val(), stock);

    const description = $(".card-title").text();
    const price = $(".card-text").filter(function(){ return $(this).text().trim().startsWith('₱'); }).first().text().replace(/[^\d.]/g, '');
    const image = $(".card-img").attr('src');

    let cart = localStorage.getItem('cart');
    cart = cart ? JSON.parse(cart) : [];
    let existing = cart.find(item => String(item.item_id) === String(id));

    if (existing) {
      existing.quantity = clampQty((existing.quantity || 0) + qty, stock);
    } else {
      cart.push({ item_id: id, description, price: parseFloat(price), image, quantity: qty });
    }
    localStorage.setItem('cart', JSON.stringify(cart));

    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon: 'success', text: 'Added to cart', timer: 900, showConfirmButton: false, position: 'bottom-right' });
    }
  });

  // Buy Now: add to cart with selected qty (respecting stock), then go to cart
  $(document).on('click', '#detailsBuyNow', function () {
    const maxAttr = parseInt($("#detailsQty").attr('max') || '0', 10);
    const stock = isNaN(maxAttr) ? 0 : maxAttr;
    const qty = clampQty($("#detailsQty").val(), stock);

    const description = $(".card-title").text();
    const price = $(".card-text").filter(function(){ return $(this).text().trim().startsWith('₱'); }).first().text().replace(/[^\d.]/g, '');
    const image = $(".card-img").attr('src');

    let cart = localStorage.getItem('cart');
    cart = cart ? JSON.parse(cart) : [];
    let existing = cart.find(item => String(item.item_id) === String(id));

    if (existing) {
      existing.quantity = clampQty((existing.quantity || 0) + qty, stock);
    } else {
      cart.push({ item_id: id, description, price: parseFloat(price), image, quantity: qty });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    window.location.href = 'cart.html';
  });

  // Image preview for multiple files
  $(document).on('change', '#images', function() {
    $('#imagePreview').empty();
    const files = this.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
          $('#imagePreview').append(`<img src="${e.target.result}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;margin:4px;">`);
        };
        reader.readAsDataURL(file);
      });
    }
  });

  // Handle item creation form submit
  $(document).on('submit', '#itemForm', function(e) {
        e.preventDefault();
    let form = $('#itemForm')[0];
    let formData = new FormData(form);
        $.ajax({
      method: "POST",
      url: 'http://localhost:4000/api/v1/items',
            data: formData,
      processData: false,
            contentType: false,
            dataType: "json",
            success: function (data) {
        alert('Item added!');
        location.reload();
            },
            error: function (error) {
        alert('Error adding item');
                console.log(error);
            }
        });
    });
});