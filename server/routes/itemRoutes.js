const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
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
} = require('../controllers/itemController');

router.route('/').get(getItems).post(protect, createItem);
router.get('/my-reports', protect, getMyReports);
router.get('/:id/similar', getSimilarItems);
router.patch('/:id/confirm-receipt', protect, confirmItemReceipt);
router.patch('/:id/deny-receipt', protect, denyItemReceipt);
router.post('/:id/dispute', protect, disputeItemHandover);
router.route('/:id').get(getItemById).patch(protect, updateItem).delete(protect, deleteItem);

module.exports = router;
