const express = require('express');
const router = express.Router();
const upload = require('../utils/multer')

const {registerUser, loginUser, updateUser, deactivateUser, getUserProfile} = require('../controllers/user')
const {isAuthenticatedUser, requireActive} = require('../middlewares/auth')
router.post('/register', upload.single('profile_img'), registerUser);
router.post('/login', loginUser)

// Refresh and logout endpoints (remember_token-backed refresh flow)
const { refreshToken, logoutUser } = require('../controllers/user');
router.post('/auth/refresh', refreshToken);
router.post('/logout', isAuthenticatedUser, logoutUser);

// Block inactive accounts from protected user endpoints
router.get('/profile', isAuthenticatedUser, requireActive, getUserProfile)
router.post('/update-profile', isAuthenticatedUser, requireActive, upload.single('image'), updateUser)
router.delete('/deactivate', isAuthenticatedUser, requireActive, deactivateUser)

module.exports = router;