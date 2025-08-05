const express = require('express');
const router = express.Router();
const groupController = require('../controllers/group');

router.get('/groups', groupController.getAllGroups);
router.post('/groups', groupController.createGroup);
router.put('/groups/:id', groupController.updateGroup);
router.delete('/groups/:id', groupController.deleteGroup);

module.exports = router;