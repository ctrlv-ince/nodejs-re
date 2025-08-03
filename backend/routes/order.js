const express = require('express');

const router = express.Router();

const { createOrder, updateOrder, listOrders, updateOrderStatus, getMyOrders } = require('../controllers/order');
const { isAuthenticatedUser } = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/roleAuth');

// Create order (user)
router.post('/create-order', isAuthenticatedUser, createOrder);

// Update order (admin only) - status or lines
router.put('/orders/:id', isAuthenticatedUser, requireAdmin, updateOrder);

// List orders (admin only) - simple pagination
router.get('/orders', isAuthenticatedUser, requireAdmin, listOrders);

// Explicit endpoint for updating only the status (admin)
router.put('/orders/:id/status', isAuthenticatedUser, requireAdmin, updateOrderStatus);

// Authenticated user's order history with line items (for reviews gating)
router.get('/me/orders', isAuthenticatedUser, getMyOrders);

module.exports = router;