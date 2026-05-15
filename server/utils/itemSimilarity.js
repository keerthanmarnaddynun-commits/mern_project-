/**
 * Shared lost/found similarity rules (same hierarchy as GET /items/:id/similar).
 * Used by getSimilarItems and createClaim (matching lost → found).
 */
const { tokenizeWithSynonyms } = require('./synonymMatcher');

function tokenize(text) {
  if (!text || typeof text !== 'string') return new Set();
  const result = tokenizeWithSynonyms(text);
  return new Set(result.tokens);
}

function intersectionWords(setA, setB) {
  const out = [];
  for (const w of setA) {
    if (setB.has(w)) out.push(w);
  }
  return out;
}

function confidenceRank(confidence) {
  if (confidence === 'Extremely Strong Match') return 3;
  if (confidence === 'Very Strong Match') return 2;
  return 1;
}

/**
 * @param {object} anchor - Item doc or lean (lost or found)
 * @param {object} candidate - opposite type, pending, same category expected from query
 * @returns {null | { confidence: string, reasons: string[], rank: number, titleOverlapLen: number }}
 */
function matchOppositePendingSameCategory(anchor, candidate) {
  if (!anchor || !candidate) return null;
  if (String(anchor._id) === String(candidate._id)) return null;
  if (anchor.type === candidate.type) return null;
  if (anchor.status !== 'pending' || candidate.status !== 'pending') return null;
  if (anchor.is_resolved === true || candidate.is_resolved === true) return null;
  if (anchor.category !== candidate.category) return null;

  const titleOverlap = intersectionWords(tokenize(anchor.title), tokenize(candidate.title));
  if (titleOverlap.length === 0) return null;

  const descOverlap = intersectionWords(tokenize(anchor.description), tokenize(candidate.description));
  const locOverlap = intersectionWords(tokenize(anchor.location), tokenize(candidate.location));
  const hasDesc = descOverlap.length > 0;
  const hasLoc = locOverlap.length > 0;

  let confidence;
  if (hasLoc && hasDesc) {
    confidence = 'Extremely Strong Match';
  } else if (hasLoc || hasDesc) {
    confidence = 'Very Strong Match';
  } else {
    confidence = 'Strong Match';
  }

  const reasons = [];
  reasons.push(`Same category: ${anchor.category}`);
  reasons.push(`Title keyword overlap: ${titleOverlap.join(', ')}`);
  if (hasLoc) {
    reasons.push(`Location keyword overlap: ${locOverlap.join(', ')}`);
  }
  if (hasDesc) {
    reasons.push(`Description keyword overlap: ${descOverlap.join(', ')}`);
  }
  reasons.push(`Confidence: ${confidence}`);

  return {
    confidence,
    reasons,
    rank: confidenceRank(confidence),
    titleOverlapLen: titleOverlap.length,
  };
}

/**
 * Pick best LOST item owned by claimant that matches this FOUND item.
 * @returns {null | { lost: object, match: object }}
 */
function pickBestMatchingLostForFound(foundItem, userLostItemsLean, claimantId) {
  if (!foundItem || foundItem.type !== 'found' || !claimantId) return null;

  const ranked = [];
  for (const lost of userLostItemsLean) {
    if (!lost) continue;
    if (lost.type !== 'lost') continue;
    if (String(lost.postedBy) !== String(claimantId)) continue;
    if (lost.status !== 'pending') continue;
    if (lost.is_resolved === true) continue;

    const m = matchOppositePendingSameCategory(foundItem, lost);
    if (m) ranked.push({ lost, match: m });
  }
  ranked.sort((a, b) => {
    if (b.match.rank !== a.match.rank) return b.match.rank - a.match.rank;
    if (b.match.titleOverlapLen !== a.match.titleOverlapLen) return b.match.titleOverlapLen - a.match.titleOverlapLen;
    const tb = new Date(b.lost.createdAt || 0).getTime();
    const ta = new Date(a.lost.createdAt || 0).getTime();
    return tb - ta;
  });
  if (ranked.length === 0) return null;
  return ranked[0];
}

/** Mongo filter: claimant's active lost listings eligible for matching */
function getEligibleUserLostFilter(userId) {
  return {
    type: 'lost',
    postedBy: userId,
    status: 'pending',
    is_resolved: { $ne: true },
  };
}

module.exports = {
  matchOppositePendingSameCategory,
  confidenceRank,
  pickBestMatchingLostForFound,
  getEligibleUserLostFilter,
};
