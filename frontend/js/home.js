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
});