const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account');
const {isAuthenticatedUser} = require('../middlewares/auth');
const {requireAdmin, requireAdminOrOwner} = require('../middlewares/roleAuth');

router.get('/accounts', isAuthenticatedUser, requireAdmin, accountController.getAllAccounts);
router.get('/accounts/:id', isAuthenticatedUser, requireAdminOrOwner, accountController.getAccount);
router.post('/accounts', isAuthenticatedUser, requireAdmin, accountController.createAccount);
router.put('/accounts/:id', isAuthenticatedUser, requireAdmin, accountController.updateAccount);
router.delete('/accounts/:id', isAuthenticatedUser, requireAdmin, accountController.deleteAccount);

module.exports = router;