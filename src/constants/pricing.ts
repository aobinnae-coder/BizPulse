export interface PlanEntitlements {
  maxUsers: number;
  maxProducts: number;
  maxOrdersPerMonth: number;
  maxSurveyResponsesPerMonth: number;
  platformFee: number;
  features: {
    inventoryManagement: 'basic' | 'full';
    lowStockAlerts: boolean;
    crm: boolean;
    payments: boolean;
    coupons: boolean;
    qrSurveys: boolean;
    brandedSurveys: boolean;
    postPurchaseFeedback: boolean;
    analytics: 'basic' | 'standard' | 'advanced' | 'executive';
    csvExport: boolean;
    actionBoard: boolean;
    sentimentTagging: boolean;
    recurringIssueDetection: boolean;
    automatedCampaigns: boolean;
    customerSegmentation: boolean;
    refundTracking: boolean;
    multiLocation: boolean;
    advancedPermissions: boolean;
    aiInsights: boolean;
    churnRiskDetection: boolean;
    whiteLabel: boolean;
    customDomain: boolean;
  };
  support: 'email' | 'priority-email' | 'priority';
}

export interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  description: string;
  entitlements: PlanEntitlements;
  isPopular?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    description: 'Perfect for getting started with your small business.',
    entitlements: {
      maxUsers: 1,
      maxProducts: 25,
      maxOrdersPerMonth: 50,
      maxSurveyResponsesPerMonth: 100,
      platformFee: 1.0,
      features: {
        inventoryManagement: 'basic',
        lowStockAlerts: false,
        crm: false,
        payments: false,
        coupons: false,
        qrSurveys: false,
        brandedSurveys: false,
        postPurchaseFeedback: false,
        analytics: 'basic',
        csvExport: false,
        actionBoard: false,
        sentimentTagging: false,
        recurringIssueDetection: false,
        automatedCampaigns: false,
        customerSegmentation: false,
        refundTracking: false,
        multiLocation: false,
        advancedPermissions: false,
        aiInsights: false,
        churnRiskDetection: false,
        whiteLabel: false,
        customDomain: false,
      },
      support: 'email',
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 29,
    priceYearly: 24,
    isPopular: true,
    description: 'Advanced tools to help your business grow and scale.',
    entitlements: {
      maxUsers: 2,
      maxProducts: 250,
      maxOrdersPerMonth: 500,
      maxSurveyResponsesPerMonth: 1000,
      platformFee: 0.75,
      features: {
        inventoryManagement: 'full',
        lowStockAlerts: true,
        crm: true,
        payments: true,
        coupons: true,
        qrSurveys: true,
        brandedSurveys: true,
        postPurchaseFeedback: true,
        analytics: 'standard',
        csvExport: true,
        actionBoard: false,
        sentimentTagging: false,
        recurringIssueDetection: false,
        automatedCampaigns: false,
        customerSegmentation: false,
        refundTracking: false,
        multiLocation: false,
        advancedPermissions: false,
        aiInsights: false,
        churnRiskDetection: false,
        whiteLabel: false,
        customDomain: false,
      },
      support: 'email',
    },
  },
  {
    id: 'growth',
    name: 'Growth',
    priceMonthly: 79,
    priceYearly: 69,
    description: 'Deep analytics and automated workflows for established businesses.',
    entitlements: {
      maxUsers: 5,
      maxProducts: 2000,
      maxOrdersPerMonth: 3000,
      maxSurveyResponsesPerMonth: 5000,
      platformFee: 0.4,
      features: {
        inventoryManagement: 'full',
        lowStockAlerts: true,
        crm: true,
        payments: true,
        coupons: true,
        qrSurveys: true,
        brandedSurveys: true,
        postPurchaseFeedback: true,
        analytics: 'advanced',
        csvExport: true,
        actionBoard: true,
        sentimentTagging: true,
        recurringIssueDetection: true,
        automatedCampaigns: true,
        customerSegmentation: true,
        refundTracking: true,
        multiLocation: false,
        advancedPermissions: false,
        aiInsights: false,
        churnRiskDetection: false,
        whiteLabel: false,
        customDomain: false,
      },
      support: 'priority-email',
    },
  },
  {
    id: 'premium',
    name: 'Premium',
    priceMonthly: 199,
    priceYearly: 169,
    description: 'The ultimate operating system for multi-location enterprises.',
    entitlements: {
      maxUsers: 15,
      maxProducts: 1000000, // Unlimited
      maxOrdersPerMonth: 1000000, // Unlimited
      maxSurveyResponsesPerMonth: 1000000, // Unlimited
      platformFee: 0,
      features: {
        inventoryManagement: 'full',
        lowStockAlerts: true,
        crm: true,
        payments: true,
        coupons: true,
        qrSurveys: true,
        brandedSurveys: true,
        postPurchaseFeedback: true,
        analytics: 'executive',
        csvExport: true,
        actionBoard: true,
        sentimentTagging: true,
        recurringIssueDetection: true,
        automatedCampaigns: true,
        customerSegmentation: true,
        refundTracking: true,
        multiLocation: true,
        advancedPermissions: true,
        aiInsights: true,
        churnRiskDetection: true,
        whiteLabel: true,
        customDomain: true,
      },
      support: 'priority',
    },
  },
];

export const ADD_ONS = [
  { id: 'extra-staff', name: 'Extra Staff Seat', price: 10, period: 'month' },
  { id: 'extra-location', name: 'Extra Location', price: 25, period: 'month' },
  { id: 'sms-credits', name: 'SMS Credits', price: 'Usage based', period: '' },
  { id: 'white-label', name: 'White-label / Custom Domain', price: 49, period: 'month' },
  { id: 'onboarding', name: 'Premium Onboarding', price: 199, period: 'one-time' },
  { id: 'ai-pack', name: 'AI Insights Pack', price: 29, period: 'month' },
];
