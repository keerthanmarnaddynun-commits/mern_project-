const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getItems, getItemById, getSimilarItems, createItem, updateItem, deleteItem } = require('../controllers/itemController');

router.route('/').get(getItems).post(protect, createItem);
router.get('/:id/similar', getSimilarItems);
router.route('/:id').get(getItemById).patch(protect, updateItem).delete(protect, deleteItem);

module.exports = router;
