const express = require('express');
const router = express.Router();
const groupController = require('../controllers/group');

router.get('/groups', groupController.getAllGroups);
router.post('/groups', groupController.createGroup);
// ... (other routes for item_groups, item_images)

module.exports = router; 