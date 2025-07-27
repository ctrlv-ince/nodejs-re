const express = require('express');

const router = express.Router();

const dashboard = require('../controllers/dashboard');
const {isAuthenticatedUser} = require('../middlewares/auth');
router.get('/address-chart', isAuthenticatedUser, dashboard.addressChart);
router.get('/sales-chart', isAuthenticatedUser, dashboard.salesChart);
router.get('/items-chart', isAuthenticatedUser, dashboard.itemsChart);
router.get('/dashboard/top-selling', dashboard.topSelling);

module.exports = router;




