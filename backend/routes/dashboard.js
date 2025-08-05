const express = require('express');

const router = express.Router();

const dashboard = require('../controllers/dashboard');
const {isAuthenticatedUser} = require('../middlewares/auth');


// Featured products
router.get('/dashboard/top-selling', dashboard.topSelling);

// New chart data endpoints used by frontend dashboard
router.get('/dashboard/top-products-revenue', isAuthenticatedUser, dashboard.topProductsRevenue);
router.get('/dashboard/top-products-quantity', isAuthenticatedUser, dashboard.topProductsQuantity);
router.get('/dashboard/revenue-by-category', isAuthenticatedUser, dashboard.revenueByCategory);

module.exports = router;




