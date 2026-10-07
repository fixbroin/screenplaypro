import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';

export async function GET() {
  try {
    const rows = await queryDb<any[]>(
      `SELECT u.id, u.email, u.displayName, u.mobileNumber, u.subscriptionActive, u.currentSubscriptionId, u.subscriptionPlanName, u.subscriptionExpiresAt, u.lastSubscriptionAt, u.createdAt
       FROM users u
       WHERE u.subscriptionActive = 1 OR u.subscriptionPlanName IS NOT NULL OR u.subscriptionExpiresAt IS NOT NULL`
    );

    const subHistoryRows = await queryDb<any[]>(
      `SELECT userId, planName, amount, startDate, createdAt FROM userSubscriptions ORDER BY createdAt DESC`
    ).catch(() => []);

    const now = Date.now();
    const subscribers = rows.map(u => {
      const userHistory = subHistoryRows.filter(h => h.userId === u.id);
      const currentPlanName = u.subscriptionPlanName || 'Screenplay Pro';
      
      let previousPlanName = '';
      if (userHistory.length > 1) {
        const differentPlan = userHistory.find(h => h.planName && h.planName !== currentPlanName);
        if (differentPlan) {
          previousPlanName = differentPlan.planName;
        } else {
          previousPlanName = userHistory[1].planName || '';
        }
      }

      const expiresMillis = u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt).getTime() : 0;
      const startMillis = u.lastSubscriptionAt ? new Date(u.lastSubscriptionAt).getTime() : 0;
      const isExpired = !u.subscriptionActive || (expiresMillis > 0 && now > expiresMillis);

      return {
        id: u.id,
        email: u.email || '',
        displayName: u.displayName || '',
        mobileNumber: u.mobileNumber || '',
        subscriptionActive: Boolean(u.subscriptionActive),
        subscriptionPlanName: currentPlanName,
        previousPlanName: previousPlanName,
        totalSubscriptionsCount: userHistory.length,
        subscriptionExpiresAt: u.subscriptionExpiresAt,
        lastSubscriptionAt: u.lastSubscriptionAt,
        isExpired,
        formattedStartDate: startMillis ? new Date(startMillis).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A',
        formattedExpiryDate: expiresMillis ? new Date(expiresMillis).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Lifetime / Unset'
      };
    });

    return NextResponse.json({ success: true, subscribers });
  } catch (error: any) {
    console.error('Error fetching subscribers from MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
