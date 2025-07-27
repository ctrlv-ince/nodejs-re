const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review');

router.get('/reviews/:item_id', reviewController.getReviews);
router.post('/reviews', reviewController.createReview);
router.delete('/reviews/:review_id', reviewController.deleteReview);

module.exports = router; 