$(function() {
  const url = 'http://localhost:4000/';
  
  // Load header
  $('#home').load('header.html', function () {
    // After header is loaded, hide hero Login/Register buttons when logged in
    const uid = sessionStorage.getItem('userId');
    const token = sessionStorage.getItem('token');

    // Also hide inline hero buttons individually to cover cases where wrapper id might be missing
    const $heroWrapper = $('#heroAuthButtons');
    const isLoggedIn = !!uid && !!token;

    if ($heroWrapper.length) {
      $heroWrapper.toggle(!isLoggedIn ? true : false);
    }
    // Additionally hide specific anchor buttons if present
    const $loginBtn = $('a[href="login.html"].btn, a.btn[href="login.html"]');
    const $registerBtn = $('a[href="register.html"].btn, a.btn[href="register.html"]');
    if (isLoggedIn) {
      $loginBtn.hide();
      $registerBtn.hide();
    } else {
      $loginBtn.show();
      $registerBtn.show();
    }
  });
  
  // Star renderer for featured/popular cards
  function renderStars(rating) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    const full = Math.floor(r);
    const half = r - full >= 0.25 && r - full < 0.75 ? 1 : 0;
    const adjFull = half ? full : Math.round(r);
    const empties = 5 - (adjFull + half);
    const fullStars = '★'.repeat(adjFull);
    const halfStar = half ? '☆' : '';
    const emptyStars = '☆'.repeat(empties);
    return `<span style="color:#f1c40f;font-size:13px;letter-spacing:1px;">${fullStars}${halfStar}${emptyStars}</span>`;
  }

  // Load popular products (based on sales)
  $.get(url + 'api/v1/dashboard/top-selling', function(data) {
    let html = '';
    const batchIds = [];
    (data.rows || []).forEach(function(value) {
      const imgSrc = value.image_path ? (url + value.image_path) : 'https://via.placeholder.com/300x200?text=No+Image';
      batchIds.push(value.item_id);
      html += `<div class="col-md-3 mb-4">
        <div class="card h-100">
          <img src="${imgSrc}" class="card-img-top" alt="${value.item_name}">
          <div class="card-body">
            <h5 class="card-title">${value.item_name}</h5>
            <p class="card-text">${value.item_description}</p>
            <p class="card-text mb-1"><small class="text-muted">Popular · Sold ${value.total_sold}</small></p>
            <div class="small" id="feat-rating-${value.item_id}"><span class="text-muted">Loading rating…</span></div>
            <a href="item.html?id=${value.item_id}" class="btn btn-outline-primary btn-block mt-2">View</a>
          </div>
        </div>
      </div>`;
    });
    // Update section title if present and render products
    $('#popularProductsTitle, #featuredProductsTitle').text('Popular Products');
    $('#popularProducts, #featuredProducts').html(html);

    // Attempt bulk rating summary first; fallback per item
    if (batchIds.length) {
      const idsParam = batchIds.join(',');
      $.get(url + 'api/v1/reviews/summary', { ids: idsParam })
        .done(function(sdata){
          const rows = (sdata && (sdata.rows || sdata.result || sdata)) || [];
          const byId = {};
          (Array.isArray(rows) ? rows : []).forEach(r => {
            byId[String(r.item_id)] = { avg: Number(r.avg || r.average || 0), count: Number(r.count || r.total || 0) };
          });
          batchIds.forEach(idVal => {
            const s = byId[String(idVal)];
            if (s && s.count > 0) {
              $(`#feat-rating-${idVal}`).html(`${renderStars(s.avg)} <span class="ml-1">${s.avg.toFixed(1)} (${s.count})</span>`);
            } else {
              $(`#feat-rating-${idVal}`).html('<span class="text-muted">No reviews yet</span>');
            }
          });
        })
        .fail(function(){
          batchIds.forEach(function(idVal){
            $.get(url + `api/v1/reviews/${idVal}`)
              .done(function(rdata){
                const rows = (rdata && (rdata.rows || rdata.result || rdata)) || [];
                if (!Array.isArray(rows) || rows.length === 0) {
                  $(`#feat-rating-${idVal}`).html('<span class="text-muted">No reviews yet</span>');
                  return;
                }
                const ratings = rows.map(r => Number(r.rating || r.stars || 0)).filter(n => !isNaN(n));
                const avg = ratings.length ? (ratings.reduce((a,b)=>a+b,0) / ratings.length) : 0;
                $(`#feat-rating-${idVal}`).html(`${renderStars(avg)} <span class="ml-1">${avg.toFixed(1)} (${rows.length})</span>`);
              })
              .fail(function(){
                $(`#feat-rating-${idVal}`).html('<span class="text-muted">Rating unavailable</span>');
              });
          });
        });
    }
  });

  // Search functionality
  let searchTimeout;
  
  $('#searchInput').on('input', function() {
    const searchTerm = $(this).val().trim();
    
    // Clear previous timeout
    clearTimeout(searchTimeout);
    
    if (searchTerm.length < 2) {
      $('#searchResults').empty();
      return;
    }
    
    // Debounce search requests
    searchTimeout = setTimeout(function() {
      performSearch(searchTerm);
    }, 300);
  });
  
  $('#searchBtn').on('click', function() {
    const searchTerm = $('#searchInput').val().trim();
    if (searchTerm.length >= 2) {
      performSearch(searchTerm);
    }
  });
  
  $('#searchInput').on('keypress', function(e) {
    if (e.which === 13) { // Enter key
      const searchTerm = $(this).val().trim();
      if (searchTerm.length >= 2) {
        performSearch(searchTerm);
      }
    }
  });
  
  function performSearch(term) {
    $.ajax({
      url: url + 'api/v1/items/search',
      method: 'GET',
      data: { term: term },
      success: function(data) {
        displaySearchResults(data.rows);
      },
      error: function(xhr, status, error) {
        console.error('Search error:', error);
        $('#searchResults').html('<div class="alert alert-danger">Search failed. Please try again.</div>');
      }
    });
  }
  
  function displaySearchResults(results) {
    let html = '';
    
    if (results.length === 0) {
      html = '<div class="alert alert-info">No products found matching your search.</div>';
    } else {
      html = '<div class="row">';
      results.forEach(function(item) {
        const imgSrc = item.image_path ? (url + item.image_path) : 'https://via.placeholder.com/200x150?text=No+Image';
        html += `
          <div class="col-md-6 mb-3">
            <div class="card">
              <div class="row no-gutters">
                <div class="col-md-4">
                  <img src="${imgSrc}" class="card-img" alt="${item.item_name}" style="height: 120px; object-fit: cover;">
                </div>
                <div class="col-md-8">
                  <div class="card-body">
                    <h6 class="card-title">${item.item_name}</h6>
                    <p class="card-text small">${item.item_description}</p>
                    <p class="card-text"><strong>₱${item.price}</strong></p>
                    <a href="item.html?id=${item.item_id}" class="btn btn-sm btn-outline-primary">View Details</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      });
      html += '</div>';
    }
    
    $('#searchResults').html(html);
  }
});