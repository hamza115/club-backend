const { Router } = require('express');
const { authController } = require('../controllers');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { validate, body } = require('../middleware/validate');
const { ROLES } = require('../config/constants');

const router = Router();

// Public
router.post(
  '/login',
  validate([
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  authController.login,
);

// Public — creates organization + admin
router.post(
  '/register',
  validate([
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone').optional().trim(),
  ]),
  authController.register,
);

// Admin-only — create staff within same organization
router.post(
  '/create-staff',
  auth,
  roleGuard(ROLES.SUPER_ADMIN),
  validate([
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn([ROLES.MANAGER, ROLES.CASHIER]).withMessage('Role must be manager or cashier'),
  ]),
  authController.createStaff,
);

// Authenticated
router.get('/profile', auth, authController.getProfile);
router.put('/profile', auth, authController.updateProfile);
router.put('/change-password', auth, authController.changePassword);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);

module.exports = router;
