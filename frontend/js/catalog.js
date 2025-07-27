$(function() {
  $('#home').load('header.html');
  let page = 0;
  const pageSize = 12;
  let loading = false;
  let allLoaded = false;
  function loadItems() {
    if (loading || allLoaded) return;
    loading = true;
    $('#loading').show();
    $.get('http://localhost:4000/api/v1/items', function(data) {
      let items = data.rows.slice(page * pageSize, (page + 1) * pageSize);
      if (items.length === 0) {
        allLoaded = true;
        $('#loading').hide();
        return;
      }
      let html = '';
      items.forEach(function(value) {
        const imgSrc = value.image_path ? ('http://localhost:4000/' + value.image_path) : 'https://via.placeholder.com/300x200?text=No+Image';
        html += `<div class="col-md-3 mb-4"><div class="card h-100"><img src="${imgSrc}" class="card-img-top" alt="${value.item_name}"><div class="card-body"><h5 class="card-title">${value.item_name}</h5><p class="card-text">${value.item_description}</p><p class="card-text">₱ ${value.price}</p><a href="item.html?id=${value.item_id}" class="btn btn-outline-primary btn-block">View</a></div></div></div>`;
      });
      $('#catalogGrid').append(html);
      page++;
      loading = false;
      $('#loading').hide();
    });
  }
  loadItems();
  $(window).on('scroll', function() {
    if ($(window).scrollTop() + $(window).height() > $(document).height() - 200) {
      loadItems();
    }
  });
}); 