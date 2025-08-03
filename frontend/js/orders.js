$(function() {
  const url = 'http://localhost:4000/';

  // Load header
  $('#home').load('header.html', function () {
    // no-op
  });

  function getToken() {
    return sessionStorage.getItem('token');
  }

  function guardAuth() {
    const userId = sessionStorage.getItem('userId');
    const token = getToken();
    if (!userId || !token) {
      Swal.fire({
        icon: 'warning',
        text: 'Please login to view your orders.',
        showConfirmButton: true
      }).then(() => {
        window.location.href = 'login.html';
      });
      return false;
    }
    return true;
  }

  function fetchOrders() {
    if (!guardAuth()) return;

    $.ajax({
      method: 'GET',
      url: `${url}api/v1/me/orders`,
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      dataType: 'json',
      success: function(resp) {
        const rows = resp && resp.rows ? resp.rows : [];
        renderOrders(rows);
      },
      error: function(xhr) {
        console.error('Failed to load orders', xhr);
        Swal.fire({ icon: 'error', text: 'Failed to load your orders' });
      }
    });
  }

  function renderOrders(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      $('#ordersContainer').html('<div class="alert alert-info">You have no orders yet.</div>');
      return;
    }

    // Group by order_id
    const byOrder = rows.reduce((acc, r) => {
      acc[r.order_id] = acc[r.order_id] || { header: r, lines: [] };
      acc[r.order_id].lines.push(r);
      return acc;
    }, {});

    let html = '';
    Object.values(byOrder).forEach(group => {
      const h = group.header;
      const statusBadge = (h.status || 'pending').toUpperCase();
      html += `
        <div class="card mb-3">
          <div class="card-header d-flex justify-content-between align-items-center">
            <div>
              <strong>Order #${h.order_id}</strong>
              <span class="badge badge-secondary ml-2">${statusBadge}</span>
            </div>
            <div class="text-muted small">${new Date(h.date_ordered).toLocaleString()}</div>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table mb-0">
                <thead>
                  <tr>
                    <th style="width:60px;"></th>
                    <th>Item</th>
                    <th style="width:120px;">Qty</th>
                    <th style="width:220px;">Review</th>
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
            <td>
        `;

        if (String(h.status).toLowerCase() === 'completed' && Number(line.can_review) === 1) {
          // Two-column layout so the textarea gets full horizontal room
          html += `
            <div class="review-box p-2 border rounded position-relative" data-order="${h.order_id}" data-item="${line.item_id}" style="width: 100%;">
              <div class="row no-gutters align-items-start">
                <div class="col-md-3 pr-3 d-flex flex-column" style="z-index:1;">
                  <div class="mb-2">
                    <div class="small text-muted mb-1">Rate:</div>
                    <div class="stars" aria-label="Rate this item">
                      ${[1,2,3,4,5].map(v => `
                        <button type="button" class="star btn btn-link p-0 mr-1" data-value="${v}" title="${v} star${v>1?'s':''}" style="font-size:16px; text-decoration:none; line-height:1;">☆</button>
                      `).join('')}
                    </div>
                  </div>
                  <div class="d-inline-block" style="pointer-events:auto;">
                    <button class="btn btn-primary btn-sm submit-review" style="white-space: nowrap;">Submit</button>
                  </div>
                </div>
                <div class="col-md-9 pl-3">
                  <textarea class="form-control comment" rows="6" placeholder="Optional comment" style="min-height: 160px; resize: vertical; width: 100%; position: relative; z-index:0;"></textarea>
                </div>
              </div>
              <input type="hidden" class="rating" value="5" />
            </div>
          `;
        } else {
          // Already reviewed or not eligible: show Edit Review affordance if reviewed
          const isCompleted = String(h.status).toLowerCase() === 'completed';
          const canReview = Number(line.can_review) === 1;
          if (isCompleted && !canReview) {
            html += `
              <div class="text-muted small mb-2">You already reviewed this item.</div>
              <button class="btn btn-link p-0 edit-review-toggle" data-item="${line.item_id}" data-order="${h.order_id}">Edit review</button>
              <div class="edit-review d-none mt-2" data-item="${line.item_id}" data-order="${h.order_id}">
                <div class="review-box p-2 border rounded" data-order="${h.order_id}" data-item="${line.item_id}" style="width: 100%;">
                  <div class="row no-gutters align-items-start">
                    <div class="col-md-3 pr-3 d-flex flex-column" style="z-index:1;">
                      <div class="mb-2">
                        <div class="small text-muted mb-1">Rate:</div>
                        <div class="stars" aria-label="Rate this item">
                          ${[1,2,3,4,5].map(v => `
                            <button type="button" class="star btn btn-link p-0 mr-1" data-value="${v}" title="${v} star${v>1?'s':''}" style="font-size:16px; text-decoration:none; line-height:1;">☆</button>
                          `).join('')}
                        </div>
                      </div>
                      <div class="d-inline-block">
                        <button class="btn btn-primary btn-sm submit-review-update">Save</button>
                      </div>
                    </div>
                    <div class="col-md-9 pl-3">
                      <textarea class="form-control comment" rows="6" placeholder="Update your comment" style="min-height: 160px; resize: vertical; width: 100%;"></textarea>
                    </div>
                  </div>
                  <input type="hidden" class="rating" value="5" />
                </div>
              </div>
            `;
          } else {
            const reason = isCompleted ? 'You already reviewed this item' : 'Available after completion';
            html += `<span class="text-muted small">${reason}</span>`;
          }
        }

        html += `
            </td>
          </tr>
        `;
      });

      html += `
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    });

    $('#ordersContainer').html(html);

    // Toggle edit review editor (prefill rating + comment from server)
    $(document).off('click.editToggle', '.edit-review-toggle').on('click.editToggle', '.edit-review-toggle', function(e) {
      e.preventDefault();
      const $row = $(this).closest('td');
      const itemId = $(this).data('item');
      const orderId = $(this).data('order');

      // Hide any other open editors in same row cell
      $row.find('.edit-review').addClass('d-none');

      // Target editor for this item/order
      const $editor = $row.find(`.edit-review[data-item="${itemId}"][data-order="${orderId}"]`);
      $editor.removeClass('d-none');

      // Prefill via GET /api/v1/reviews/me/:item_id
      $.ajax({
        method: 'GET',
        url: `${url}api/v1/reviews/me/${itemId}`,
        headers: { 'Authorization': `Bearer ${getToken()}` },
        dataType: 'json',
        success: function(resp) {
          const review = resp && resp.review ? resp.review : null;
          const $box = $editor.find('.review-box');
          if (review) {
            // Set rating and comment
            $box.find('.rating').val(parseInt(review.rating) || 5);
            $box.find('.comment').val(review.comment || '');
          } else {
            // No existing review: default rating 5 and empty comment
            $box.find('.rating').val(5);
            $box.find('.comment').val('');
          }
          // Refresh star visuals
          const selected = parseInt($box.find('.rating').val()) || 5;
          $box.find('.star').each(function() {
            const v = parseInt($(this).data('value'));
            $(this).text(v <= selected ? '★' : '☆');
          });
        },
        error: function() {
          // Even if prefill fails, show editor with defaults
          const $box = $editor.find('.review-box');
          $box.find('.rating').val(5);
          const selected = 5;
          $box.find('.star').each(function() {
            const v = parseInt($(this).data('value'));
            $(this).text(v <= selected ? '★' : '☆');
          });
        }
      });
    });

    // Ensure review box elements are interactive
    $('.review-box, .review-box *').css('pointer-events', 'auto');

    // Enhance stars interaction
    $('.review-box .star').off('mouseenter mouseleave click').on('mouseenter', function() {
      const $box = $(this).closest('.review-box');
      const val = parseInt($(this).data('value'));
      $box.find('.star').each(function() {
        const v = parseInt($(this).data('value'));
        $(this).text(v <= val ? '★' : '☆');
      });
    }).on('mouseleave', function() {
      const $box = $(this).closest('.review-box');
      const selected = parseInt($box.find('.rating').val());
      $box.find('.star').each(function() {
        const v = parseInt($(this).data('value'));
        $(this).text(v <= selected ? '★' : '☆');
      });
    }).on('click', function(e) {
      e.preventDefault();
      const $box = $(this).closest('.review-box');
      const val = parseInt($(this).data('value'));
      $box.find('.rating').val(val);
      $box.find('.star').each(function() {
        const v = parseInt($(this).data('value'));
        $(this).text(v <= val ? '★' : '☆');
      });
    });

    // Initialize default star selection to 5
    $('.review-box').each(function() {
      const $box = $(this);
      const selected = parseInt($box.find('.rating').val()) || 5;
      $box.find('.star').each(function() {
        const v = parseInt($(this).data('value'));
        $(this).text(v <= selected ? '★' : '☆');
      });
    });
  }

  // Submit new review (only allowed when status=completed)
  // Bind to the generated review-box to ensure correct context and avoid overlay issues
  $(document).off('click.review', '.submit-review').on('click.review', '.submit-review', function(e) {
    e.preventDefault();
    e.stopPropagation();
    const $box = $(this).closest('.review-box, .review-inline');
    const orderId = parseInt($box.data('order'));
    const itemId = parseInt($box.data('item'));
    const rating = parseInt($box.find('.rating').val());
    const comment = $box.find('.comment').val().trim();

    if (!orderId || !itemId || !rating) {
      Swal.fire({ icon: 'warning', text: 'Please select a rating.' });
      return;
    }

    // Disable button to avoid double submits
    const $btn = $(this);
    $btn.prop('disabled', true);

    $.ajax({
      method: 'POST',
      url: `${url}api/v1/reviews`,
      headers: { 'Authorization': `Bearer ${getToken()}` },
      contentType: 'application/json; charset=utf-8',
      data: JSON.stringify({ order_id: orderId, item_id: itemId, rating, comment }),
      success: function() {
        Swal.fire({ icon: 'success', text: 'Review submitted.' });
        fetchOrders(); // refresh to hide the review box
      },
      error: function(xhr) {
        const msg = (xhr.responseJSON && (xhr.responseJSON.error || xhr.responseJSON.message)) || 'Failed to submit review.';
        Swal.fire({ icon: 'error', text: msg });
      },
      complete: function() {
        $btn.prop('disabled', false);
      }
    });
  });

  // Submit updated review (uses PUT /reviews)
  $(document).off('click.reviewUpdate', '.submit-review-update').on('click.reviewUpdate', '.submit-review-update', function(e) {
    e.preventDefault();
    e.stopPropagation();
    const $box = $(this).closest('.review-box');
    const itemId = parseInt($box.data('item'));
    const rating = parseInt($box.find('.rating').val());
    const comment = $box.find('.comment').val().trim();

    if (!itemId || !rating) {
      Swal.fire({ icon: 'warning', text: 'Please select a rating.' });
      return;
    }

    const $btn = $(this);
    $btn.prop('disabled', true);

    $.ajax({
      method: 'PUT',
      url: `${url}api/v1/reviews`,
      headers: { 'Authorization': `Bearer ${getToken()}` },
      contentType: 'application/json; charset=utf-8',
      data: JSON.stringify({ item_id: itemId, rating, comment }),
      success: function() {
        Swal.fire({ icon: 'success', text: 'Review updated.' });
        fetchOrders();
      },
      error: function(xhr) {
        const msg = (xhr.responseJSON && (xhr.responseJSON.error || xhr.responseJSON.message)) || 'Failed to update review.';
        Swal.fire({ icon: 'error', text: msg });
      },
      complete: function() {
        $btn.prop('disabled', false);
      }
    });
  });

  // Initial load
  fetchOrders();
});