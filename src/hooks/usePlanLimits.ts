import { useMemo } from 'react';
import { PLANS } from '../constants/pricing';

export function usePlanLimits(business: any, stats: any) {
  const currentPlan = useMemo(() => {
    return PLANS.find(p => p.id === (business?.plan || 'free')) || PLANS[0];
  }, [business?.plan]);

  const checkLimit = (type: 'products' | 'orders' | 'users' | 'surveys') => {
    if (!business || !stats) return { allowed: true };

    const entitlements = currentPlan.entitlements;
    
    switch (type) {
      case 'products':
        return {
          allowed: stats.totalProducts < entitlements.maxProducts,
          current: stats.totalProducts,
          max: entitlements.maxProducts,
          message: `You've reached your limit of ${entitlements.maxProducts} products on the ${currentPlan.name} plan.`
        };
      case 'orders':
        return {
          allowed: stats.totalOrders < entitlements.maxOrdersPerMonth,
          current: stats.totalOrders,
          max: entitlements.maxOrdersPerMonth,
          message: `You've reached your limit of ${entitlements.maxOrdersPerMonth} orders per month on the ${currentPlan.name} plan.`
        };
      case 'users':
        return {
          allowed: stats.totalUsers < entitlements.maxUsers,
          current: stats.totalUsers,
          max: entitlements.maxUsers,
          message: `You've reached your limit of ${entitlements.maxUsers} users on the ${currentPlan.name} plan.`
        };
      default:
        return { allowed: true };
    }
  };

  const hasFeature = (feature: keyof typeof currentPlan.entitlements) => {
    return !!currentPlan.entitlements[feature];
  };

  return {
    currentPlan,
    checkLimit,
    hasFeature
  };
}
