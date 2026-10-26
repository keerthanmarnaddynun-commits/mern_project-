const express = require('express');
const router = express.Router();
const { protect, optionalProtect, authorize, requireVerifiedEmail } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const { uploadSingle } = require('../middleware/upload');
const { processUploadedImage } = require('../middleware/imageProcessor');
const {
  getItems,
  getMyReports,
  getItemById,
  getSimilarItems,
  createItem,
  updateItem,
  deleteItem,
  confirmItemReceipt,
  denyItemReceipt,
  disputeItemHandover,
  handoverItem,
} = require('../controllers/itemController');

router.route('/').get(getItems).post(protect, requireVerifiedEmail, uploadSingle('image'), processUploadedImage, createItem);
router.get('/my-reports', protect, getMyReports);
router.get('/:id/similar', optionalProtect, validateObjectId, getSimilarItems);
router.patch('/:id/confirm-receipt', protect, requireVerifiedEmail, authorize('admin', 'faculty'), validateObjectId, confirmItemReceipt);
router.patch('/:id/deny-receipt', protect, requireVerifiedEmail, authorize('admin', 'faculty'), validateObjectId, denyItemReceipt);
router.post('/:id/dispute', protect, requireVerifiedEmail, validateObjectId, disputeItemHandover);
router.patch('/:id/handover', protect, requireVerifiedEmail, authorize('admin', 'faculty'), validateObjectId, handoverItem);
router.post('/:id/handover', protect, requireVerifiedEmail, authorize('admin', 'faculty'), validateObjectId, handoverItem);
router.route('/:id')
  .get(optionalProtect, validateObjectId, getItemById)
  .patch(protect, requireVerifiedEmail, validateObjectId, updateItem)
  .delete(protect, requireVerifiedEmail, validateObjectId, deleteItem);

module.exports = router;
