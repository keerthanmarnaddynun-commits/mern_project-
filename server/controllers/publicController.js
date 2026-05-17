const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Activity = require('../models/Activity');
const { extractKeyword, isPlural } = require('../utils/titleKeyword');


const getCommunityInsights = async (req, res) => {
  try {
    // 1. Stats
    const totalReports = await Item.countDocuments();
    const lostItems = await Item.countDocuments({ type: 'lost' });
    const foundItems = await Item.countDocuments({ type: 'found' });
    const claimsSubmitted = await Claim.countDocuments();
    const itemsResolved = await Item.countDocuments({ status: 'resolved' });
    const pendingClaims = await Claim.countDocuments({ status: 'pending' });

    // 2. Trend Data (Last 14 Days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const recentItems = await Item.find({ createdAt: { $gte: fourteenDaysAgo } })
      .select('type createdAt date_occurred')
      .lean();

    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      return {
        dateString: d.toISOString().split('T')[0],
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        lost: 0,
        found: 0
      };
    });

    recentItems.forEach(item => {
      const dateVal = item.createdAt || item.date_occurred;
      if (!dateVal) return;
      const dateStr = new Date(dateVal).toISOString().split('T')[0];
      const dayData = last14Days.find(d => d.dateString === dateStr);
      if (dayData) {
        if (item.type === 'lost') dayData.lost++;
        else if (item.type === 'found') dayData.found++;
      }
    });

    // 3. Trending Categories
    const categoryCounts = await Item.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    const trendingCategories = categoryCounts.map(c => c._id);

    // 4. Recovery Insights
    const resolvedCategoryCounts = await Item.aggregate([
      { $match: { status: 'resolved' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    
    let recoveryInsight = "Community recovery efforts are ongoing.";
    if (resolvedCategoryCounts.length > 0 && resolvedCategoryCounts[0]._id) {
      recoveryInsight = `${resolvedCategoryCounts[0]._id} currently have the highest recovery rate.`;
    }

    // 5. Recent Community Activity Feed
    // Only expose category-level context — no usernames, emails, titles, or locations
    const rawActivities = await Activity.find({
      type: { $in: ['item_reported', 'claim_submitted', 'item_resolved', 'manual_review_requested'] }
    }).sort({ createdAt: -1 }).limit(10).lean();

    const recentActivity = rawActivities.map(act => {
      // ── Label resolution priority (all run through whitelist extractor) ──────
      // 1. metadata.keyword  — set on records created after the last backend deploy
      // 2. extractKeyword(itemTitle)        — covers older records with stored titles
      // 3. extractKeyword(relatedItemTitle) — secondary title (claims/manual reviews)
      // 4. extractKeyword(message)          — last-resort: internal message may hint
      // 5. category (if not blank / "other")  — user-selected bucket
      // 6. 'item'  — absolute fallback
      const rawKeyword  = act.metadata && act.metadata.keyword   ? act.metadata.keyword.toLowerCase()  : null;
      const rawCategory = act.metadata && act.metadata.category  ? act.metadata.category.toLowerCase() : null;
      const itemType    = act.metadata && act.metadata.itemType   ? act.metadata.itemType.toLowerCase() : null;

      const safeCategory = rawCategory && rawCategory !== 'other' ? rawCategory : null;

      const label =
        rawKeyword                          ||
        extractKeyword(act.itemTitle)       ||
        extractKeyword(act.relatedItemTitle)||
        extractKeyword(act.message)         ||
        safeCategory                        ||
        'item';

      // Grammar helpers — plural keywords need different article/verb/pronoun
      const plural = isPlural(label);
      const article   = plural ? ''        : 'A ';   // "Glasses" vs "A watch"
      const wasWere   = plural ? 'were'    : 'was';
      const itsTheir  = plural ? 'their'   : 'its';
      // Capitalise label when used as sentence subject (plural, no leading article)
      const subject   = plural ? label.charAt(0).toUpperCase() + label.slice(1) : label;

      let safeMessage;

      if (act.type === 'item_reported') {
        if (itemType) {
          // Singular: "A lost watch was reported"
          // Plural:   "Lost glasses were reported"
          safeMessage = plural
            ? `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} ${subject} ${wasWere} reported`
            : `${article}${itemType} ${label} ${wasWere} reported`;
        } else {
          // Infer lost/found from stored internal message (safe: just contains the word lost/found)
          const isLost = act.message && act.message.toLowerCase().includes('lost');
          const typeWord = isLost ? 'lost' : 'found';
          safeMessage = plural
            ? `${typeWord.charAt(0).toUpperCase() + typeWord.slice(1)} ${subject} ${wasWere} reported`
            : `${article}${typeWord} ${label} ${wasWere} reported`;
        }
      } else if (act.type === 'item_resolved') {
        // Singular: "A watch was successfully returned to its owner"
        // Plural:   "Glasses were successfully returned to their owner"
        safeMessage = `${article}${subject} ${wasWere} successfully returned to ${itsTheir} owner`;
      } else if (act.type === 'claim_submitted') {
        // Singular: "A claim was submitted for a watch"
        // Plural:   "A claim was submitted for glasses"
        // Vowel-start singular: "A claim was submitted for an item"
        const forArticle = plural ? '' : /^[aeiou]/.test(label) ? 'an ' : 'a ';
        const forPhrase = plural ? `for ${label}` : `for ${forArticle}${label}`;
        safeMessage = `A claim was submitted ${forPhrase}`;
      } else if (act.type === 'manual_review_requested') {
        // Singular: "A manual review request was submitted for a watch"
        // Plural:   "A manual review request was submitted for glasses"
        // Vowel-start singular: "A manual review request was submitted for an item"
        const forArticle = plural ? '' : /^[aeiou]/.test(label) ? 'an ' : 'a ';
        const forPhrase = plural ? `for ${label}` : `for ${forArticle}${label}`;
        safeMessage = `A manual review request was submitted ${forPhrase}`;
      } else {
        safeMessage = 'Community activity recorded';
      }

      return {
        _id: act._id,
        message: safeMessage,
        createdAt: act.createdAt
      };
    });

    res.status(200).json({
      stats: {
        totalReports,
        lostItems,
        foundItems,
        claimsSubmitted,
        itemsResolved,
        pendingClaims
      },
      trendData: last14Days,
      trendingCategories,
      recoveryInsight,
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching community insights:', error);
    res.status(500).json({ message: 'Server error fetching insights' });
  }
};

module.exports = {
  getCommunityInsights
};
