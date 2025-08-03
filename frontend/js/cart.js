$(document).ready(function () {
    const url = 'http://localhost:4000/';
    function getCart() {
        let cart = localStorage.getItem('cart');
        return cart ? JSON.parse(cart) : [];
    }

    function saveCart(cart) {
        localStorage.setItem('cart', JSON.stringify(cart));
    }

    function renderCart() {
        let cart = getCart();
        let html = '';
        let total = 0;
        if (cart.length === 0) {
            html = '<div class="alert alert-info">Your cart is empty.</div>';
        } else {
            html = `<table class="table table-bordered table-sm align-middle">
                <thead class="thead-light">
                    <tr>
                        <th>Image</th>
                        <th>Description</th>
                        <th class="text-right">Price</th>
                        <th style="width:140px;">Qty</th>
                        <th class="text-right">Subtotal</th>
                        <th>Remove</th>
                    </tr>
                </thead>
                <tbody>`;
            cart.forEach((item, idx) => {
                const qty = parseInt(item.quantity || 1, 10);
                const price = parseFloat(item.price || 0);
                const subtotal = price * qty;
                total += subtotal;
                html += `<tr data-idx="${idx}">
                    <td><img src="${item.image}" width="60" style="object-fit:cover;border-radius:6px;"></td>
                    <td>${item.description}</td>
                    <td class="text-right">₱ ${price.toFixed(2)}</td>
                    <td>
                        <div class="input-group input-group-sm" style="max-width: 140px;">
                            <div class="input-group-prepend">
                                <button type="button" class="btn btn-outline-secondary qty-decrease">-</button>
                            </div>
                            <input type="number" class="form-control text-center cart-qty-input" min="1" value="${qty}">
                            <div class="input-group-append">
                                <button type="button" class="btn btn-outline-secondary qty-increase">+</button>
                            </div>
                        </div>
                    </td>
                    <td class="text-right">₱ ${subtotal.toFixed(2)}</td>
                    <td><button class="btn btn-danger btn-sm remove-item" data-idx="${idx}">&times;</button></td>
                </tr>`;
            });
            html += `</tbody></table>
                <div class="d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">Total: ₱ ${total.toFixed(2)}</h5>
                    <button id="checkoutBtnInline" class="btn btn-primary">Checkout</button>
                </div>`;
        }

        $('#cartTable').html(html);
    }

    function getUserId() {
        let userId = sessionStorage.getItem('userId');

        return userId ?? '';
    }

    // const getToken = () => {
    //     const token = sessionStorage.getItem('token');

    //     if (!token) {
    //         Swal.fire({
    //             icon: 'warning',
    //             text: 'You must be logged in to access this page.',
    //             showConfirmButton: true
    //         }).then(() => {
    //             window.location.href = 'login.html';
    //         });
    //         return;
    //     }
    //     return JSON.parse(token)
    // }

    // Remove item
    $('#cartTable').on('click', '.remove-item', function () {
        let idx = $(this).data('idx');
        let cart = getCart();
        cart.splice(idx, 1);
        saveCart(cart);
        renderCart();
    });

    // Quantity controls (+/-) and direct input with clamping to 1..999
    function clampQty(n) {
        n = parseInt(n, 10);
        if (isNaN(n) || n < 1) return 1;
        if (n > 999) return 999;
        return n;
    }

    $('#cartTable').on('click', '.qty-increase', function () {
        const $tr = $(this).closest('tr');
        const idx = parseInt($tr.data('idx'), 10);
        let cart = getCart();
        if (!isNaN(idx) && cart[idx]) {
            cart[idx].quantity = clampQty((cart[idx].quantity || 1) + 1);
            saveCart(cart);
            renderCart();
        }
    });

    $('#cartTable').on('click', '.qty-decrease', function () {
        const $tr = $(this).closest('tr');
        const idx = parseInt($tr.data('idx'), 10);
        let cart = getCart();
        if (!isNaN(idx) && cart[idx]) {
            cart[idx].quantity = clampQty((cart[idx].quantity || 1) - 1);
            saveCart(cart);
            renderCart();
        }
    });

    $('#cartTable').on('input change', '.cart-qty-input', function () {
        const $tr = $(this).closest('tr');
        const idx = parseInt($tr.data('idx'), 10);
        let cart = getCart();
        if (!isNaN(idx) && cart[idx]) {
            cart[idx].quantity = clampQty($(this).val());
            saveCart(cart);
            // Update row subtotal without full re-render for snappier feel
            const qty = cart[idx].quantity;
            const price = parseFloat(cart[idx].price || 0);
            $(this).val(qty);
            $tr.find('td').eq(4 - 1) // text-right subtotal cell (0:img,1:desc,2:price,3:qty,4:subtotal)
                .text('₱ ' + (price * qty).toFixed(2));
            // Recompute and update total
            let total = 0;
            cart.forEach(it => total += (parseFloat(it.price || 0) * parseInt(it.quantity || 1, 10)));
            $('#cartTable').find('h5:contains("Total:")').text('Total: ₱ ' + total.toFixed(2));
        }
    });

    $('#header').load("header.html");

    function proceedCheckout() {
        let cart = getCart();

        // Warn when trying to checkout with an empty cart
        if (!Array.isArray(cart) || cart.length === 0) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'warning',
                    text: 'Your cart is empty.',
                    timer: 1500,
                    showConfirmButton: false,
                    position: 'bottom-right'
                });
            } else {
                alert('Your cart is empty.');
            }
            return;
        }

        // Require user session and token
        const token = sessionStorage.getItem('token');
        const userId = getUserId();

        if (!userId || !token) {
            Swal.fire({
                icon: 'warning',
                text: 'You must be logged in to checkout.',
                showConfirmButton: true
            }).then(() => {
                window.location.href = 'login.html';
            });
            return;
        }

        const payload = JSON.stringify({ cart });

        $.ajax({
            type: "POST",
            url: `${url}api/v1/create-order`,
            data: payload,
            dataType: "json",
            processData: false,
            contentType: 'application/json; charset=utf-8',
            headers: {
                "Authorization": "Bearer " + token
            },
            success: function (data) {
                Swal.fire({
                    icon: "success",
                    text: data.message || 'Order placed successfully',
                });
                localStorage.removeItem('cart');
                renderCart();
            },
            error: function (error) {
                console.log(error);
                Swal.fire({
                    icon: 'error',
                    text: (error.responseJSON && (error.responseJSON.message || error.responseJSON.error)) || 'Checkout failed'
                });
            }
        });
    }

    // Support both the inline checkout button (rendered with the table) and the page-level button
    $('#cartTable').on('click', '#checkoutBtnInline', proceedCheckout);
    $('#checkoutBtn').on('click', proceedCheckout);

    renderCart()

})