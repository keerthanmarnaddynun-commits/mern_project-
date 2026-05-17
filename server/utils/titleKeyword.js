/**
 * titleKeyword.js
 *
 * Extracts a single privacy-safe object noun from an item title for use in
 * public community activity feed messages.
 *
 * Strategy:
 *   1. Tokenise and lowercase the title.
 *   2. Scan tokens left-to-right for the first word that appears in
 *      SAFE_OBJECT_NOUNS (a curated whitelist of common lost/found item words).
 *   3. Return that word, or null if nothing matches.
 *
 * This deliberately avoids NLP / external deps and cannot leak private data
 * because every returned word is pre-approved by the whitelist.
 */

// All words must be lowercase, singular preferred.
const SAFE_OBJECT_NOUNS = new Set([
  // Personal electronics
  'phone', 'mobile', 'smartphone', 'iphone', 'charger', 'cable', 'adapter',
  'laptop', 'notebook', 'computer', 'tablet', 'ipad', 'kindle',
  'earphones', 'earbuds', 'headphones', 'airpods',
  'camera', 'lens',
  'watch', 'smartwatch',
  'remote', 'drive', 'pendrive', 'usb', 'harddisk',
  'powerbank',

  // Accessories & jewellery
  'wallet', 'purse', 'pouch',
  'keys', 'keychain', 'keyring',
  'glasses', 'spectacles', 'sunglasses',
  'ring', 'necklace', 'bracelet', 'chain', 'earring', 'pendant', 'jewellery',
  'belt', 'cap', 'hat', 'scarf', 'gloves',

  // Bags & carry items
  'bag', 'backpack', 'handbag', 'satchel', 'tote', 'luggage', 'suitcase',
  'briefcase', 'pouch', 'case',

  // Clothing & footwear
  'jacket', 'coat', 'hoodie', 'sweater', 'shirt',
  'shoe', 'shoes', 'sandal', 'sandals', 'sneakers', 'heels', 'slippers',
  'helmet',

  // Stationery & documents
  'book', 'notebook', 'diary', 'journal',
  'pen', 'pencil', 'marker',
  'card', 'badge', 'pass', 'id',
  'passport', 'document', 'certificate', 'file', 'folder',
  'calculator',

  // Everyday objects
  'bottle', 'waterbottle', 'flask', 'mug', 'cup',
  'umbrella',
  'cycle', 'bicycle', 'bike', 'scooter',
  'charger', 'lock', 'padlock',
  'toy', 'doll',
  'mat',
]);

/**
 * Returns a safe lowercase object noun extracted from the title,
 * or null if no recognised noun is found.
 *
 * @param {string} title - Raw item title from the database.
 * @returns {string|null}
 */
function extractKeyword(title) {
  if (!title || typeof title !== 'string') return null;

  // Tokenise: lowercase, keep only alpha characters, split on non-alpha
  const tokens = title
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(t => t.length > 1); // discard single chars and empty strings

  for (const token of tokens) {
    if (SAFE_OBJECT_NOUNS.has(token)) {
      return token;
    }
  }

  return null;
}

module.exports = { extractKeyword };
