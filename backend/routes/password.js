const express = require('express');
const router = express.Router();
const passwordController = require('../controllers/password');

router.post('/password/request-reset', passwordController.requestReset);
router.post('/password/verify-token', passwordController.verifyToken);
router.post('/password/reset', passwordController.resetPassword);

module.exports = router; 