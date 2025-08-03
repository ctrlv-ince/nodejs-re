const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart');
const { isAuthenticatedUser } = require('../middlewares/auth');

// Protect all cart routes; ownership checks can be added inside controllers if needed
router.get('/cart/:account_id', isAuthenticatedUser, cartController.getCart);
router.post('/cart', isAuthenticatedUser, cartController.addToCart);
router.put('/cart/:cart_id', isAuthenticatedUser, cartController.updateCartItem);
router.delete('/cart/:cart_id', isAuthenticatedUser, cartController.removeFromCart);
router.delete('/cart/account/:account_id', isAuthenticatedUser, cartController.clearCart);

module.exports = router;