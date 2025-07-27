const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart');

router.get('/cart/:account_id', cartController.getCart);
router.post('/cart', cartController.addToCart);
router.put('/cart/:cart_id', cartController.updateCartItem);
router.delete('/cart/:cart_id', cartController.removeFromCart);
router.delete('/cart/account/:account_id', cartController.clearCart);

module.exports = router; 