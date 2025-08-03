const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review');
const { isAuthenticatedUser } = require('../middlewares/auth');
const { requireAdminOrOwner } = require('../middlewares/roleAuth');

// Public: read reviews for item
router.get('/reviews/:item_id', reviewController.getReviews);

// Authenticated: fetch current user's review for an item (for editing prefill)
router.get('/reviews/me/:item_id', isAuthenticatedUser, reviewController.getMyReviewForItem);

// Authenticated: create review; user/account derived from token
router.post('/reviews', isAuthenticatedUser, reviewController.createReview);

// Authenticated: upsert (create or update) own review
router.put('/reviews', isAuthenticatedUser, reviewController.upsertReview);

// Authenticated: delete review if admin or owner
router.delete('/reviews/:review_id', isAuthenticatedUser, requireAdminOrOwner, reviewController.deleteReview);

module.exports = router;