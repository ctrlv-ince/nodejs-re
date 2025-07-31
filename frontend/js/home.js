$(function() {
  const url = 'http://localhost:4000/'
  
  // Load header
  $('#home').load('header.html');
  
  // Load top-selling products
  $.get(url + 'api/v1/dashboard/top-selling', function(data) {
    let html = '';
    (data.rows || []).forEach(function(value) {
      const imgSrc = value.image_path ? (url + value.image_path) : 'https://via.placeholder.com/300x200?text=No+Image';
      html += `<div class="col-md-3 mb-4"><div class="card h-100"><img src="${imgSrc}" class="card-img-top" alt="${value.item_name}"><div class="card-body"><h5 class="card-title">${value.item_name}</h5><p class="card-text">${value.item_description}</p><p class="card-text">Sold: ${value.total_sold}</p><a href="item.html?id=${value.item_id}" class="btn btn-outline-primary btn-block">View</a></div></div></div>`;
    });
    $('#featuredProducts').html(html);
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