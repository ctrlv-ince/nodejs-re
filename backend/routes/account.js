const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account');

router.get('/accounts', accountController.getAllAccounts);
router.get('/accounts/:id', accountController.getAccount);
router.post('/accounts', accountController.createAccount);
router.put('/accounts/:id', accountController.updateAccount);
router.delete('/accounts/:id', accountController.deleteAccount);

module.exports = router; 