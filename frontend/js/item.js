$(function() {
  $('#home').load('header.html');
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  if (!id) {
    $('#itemCard').html('<div class="alert alert-danger">No item specified.</div>');
    return;
  }
  $.get(`http://localhost:4000/api/v1/items/${id}`, function(data) {
    const item = data.result[0];
    const imgSrc = item.image_path ? ('http://localhost:4000/' + item.image_path) : 'https://via.placeholder.com/300x200?text=No+Image';
    let html = `<div class="card mb-3"><div class="row no-gutters"><div class="col-md-5"><img src="${imgSrc}" class="card-img" alt="${item.item_name}"></div><div class="col-md-7"><div class="card-body"><h3 class="card-title" style="color:#1abc9c; font-family:'Orbitron',monospace;">${item.item_name}</h3><p class="card-text">${item.item_description}</p><p class="card-text">₱ ${item.price}</p><div id="itemActions"></div></div></div></div></div>`;
    $('#itemCard').html(html);
    // Show add to cart/checkout only if logged in
    if (sessionStorage.getItem('userId')) {
      $('#itemActions').html(`<input type="number" class="form-control mb-2" id="detailsQty" min="1" value="1"><button type="button" class="btn btn-primary" id="detailsAddToCart">Add to Cart</button> <a href="cart.html" class="btn btn-success ml-2">Go to Cart</a>`);
    } else {
      $('#itemActions').html('<div class="alert alert-info">Login to add to cart or checkout.</div>');
    }
  });
  $(document).on('click', '#detailsAddToCart', function () {
    const qty = parseInt($("#detailsQty").val());
    const description = $(".card-title").text();
    const price = $(".card-text").eq(1).text().replace(/[^\d.]/g, '');
    const image = $(".card-img").attr('src');
    let cart = localStorage.getItem('cart');
    cart = cart ? JSON.parse(cart) : [];
    let existing = cart.find(item => item.item_id == id);
    if (existing) {
      existing.quantity += qty;
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