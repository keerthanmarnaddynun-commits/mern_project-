const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Activity = require('../models/Activity');

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
    // We only fetch a few generic public activities to maintain privacy
    const rawActivities = await Activity.find({
      type: { $in: ['item_reported', 'claim_submitted', 'item_resolved'] }
    }).sort({ createdAt: -1 }).limit(10).lean();

    const recentActivity = rawActivities.map(act => {
      let safeMessage = "Activity recorded";
      
      if (act.type === 'item_reported') {
        const isLost = act.message && act.message.toLowerCase().includes('lost');
        const typeStr = isLost ? 'lost' : 'found';
        safeMessage = `A ${typeStr} item was reported`;
      } else if (act.type === 'item_resolved') {
        safeMessage = "An item was successfully returned to its owner";
      } else if (act.type === 'claim_submitted') {
        safeMessage = "A potential match claim was submitted for review";
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
