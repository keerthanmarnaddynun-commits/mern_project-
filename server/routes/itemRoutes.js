const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const { uploadSingle } = require('../middleware/upload');
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

router.route('/').get(getItems).post(protect, uploadSingle('image'), createItem);
router.get('/my-reports', protect, getMyReports);
router.get('/:id/similar', validateObjectId, getSimilarItems);
router.patch('/:id/confirm-receipt', protect, authorize('admin', 'faculty'), validateObjectId, confirmItemReceipt);
router.patch('/:id/deny-receipt', protect, authorize('admin', 'faculty'), validateObjectId, denyItemReceipt);
router.post('/:id/dispute', protect, validateObjectId, disputeItemHandover);
router.patch('/:id/handover', protect, authorize('admin', 'faculty'), validateObjectId, handoverItem);
router.post('/:id/handover', protect, authorize('admin', 'faculty'), validateObjectId, handoverItem);
router.route('/:id')
  .get(validateObjectId, getItemById)
  .patch(protect, validateObjectId, updateItem)
  .delete(protect, validateObjectId, deleteItem);

module.exports = router;
