const express = require('express');
const router = express.Router();
const upload = require('../utils/multer')


const { getAllItems,
    getSingleItem,
    createItem,
    updateItem,
    deleteItem,
    searchItems
} = require('../controllers/item')

const {isAuthenticatedUser} = require('../middlewares/auth')
const {requireAdmin} = require('../middlewares/roleAuth')

router.get('/items', getAllItems)
router.get('/items/search', searchItems)
router.get('/items/:id', getSingleItem)
router.post('/items', isAuthenticatedUser, requireAdmin, upload.array('images', 10), createItem);
router.put('/items/:id', isAuthenticatedUser, requireAdmin, upload.single('image'), updateItem)
router.delete('/items/:id', isAuthenticatedUser, requireAdmin, deleteItem)
module.exports = router;
