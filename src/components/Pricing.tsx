import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  X, 
  HelpCircle, 
  ArrowRight, 
  Sparkles, 
  Zap, 
  Shield, 
  Globe, 
  Users, 
  CreditCard,
  ChevronDown,
  ChevronUp,
  Info,
  Plus,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PLANS, ADD_ONS, Plan } from '../constants/pricing';
import { db } from '../lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

const FAQ_ITEMS = [
  {
    question: "How do the platform fees work?",
    answer: "Platform fees are charged on every paid order processed through BizPulse. As you move to higher plans, these fees decrease significantly. Our Premium plan has 0% platform fees."
  },
  {
    question: "Can I change my plan later?",
    answer: "Yes, you can upgrade or downgrade your plan at any time. If you upgrade, the changes take effect immediately. Downgrades take effect at the end of your current billing cycle."
  },
  {
    question: "What counts as a 'survey response'?",
    answer: "A survey response is counted every time a customer completes and submits a survey you've built. We don't charge for partial responses or views."
  },
  {
    question: "Do you offer discounts for non-profits?",
    answer: "Yes! We love supporting organizations that do good. Contact our support team with your non-profit documentation for a 20% discount on any paid plan."
  }
];

export default function PricingPage({ business }: { business: any }) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const toggleBilling = () => {
    setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly');
  };

  const handleSelectPlan = async (plan: Plan) => {
    if (!business) return;
    setIsProcessing(plan.id);
    try {
      await updateDoc(doc(db, 'businesses', business.id), {
        plan: plan.id,
        billingCycle: billingCycle,
        updatedAt: new Date().toISOString()
      });
      alert(`Successfully upgraded to ${plan.name} plan!`);
    } catch (error) {
      console.error(error);
      alert('Failed to update plan. Please try again.');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleAddOn = async (addon: any) => {
    if (!business) return;
    setIsProcessing(addon.id);
    try {
      await updateDoc(doc(db, 'businesses', business.id), {
        addons: arrayUnion(addon.id),
        updatedAt: new Date().toISOString()
      });
      alert(`Added ${addon.name} to your plan!`);
    } catch (error) {
      console.error(error);
      alert('Failed to add add-on. Please try again.');
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 rounded-full text-stone-600 text-sm font-bold mb-8"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            Simple, transparent pricing
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold text-stone-900 mb-6 tracking-tight"
          >
            Grow your business <br /> without the guesswork.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-stone-500 max-w-2xl mx-auto mb-12"
          >
            Choose the perfect plan for your business stage. From solo founders to multi-location enterprises, we've got you covered.
          </motion.p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-16">
            <span className={cn("text-sm font-bold transition-colors", billingCycle === 'monthly' ? "text-stone-900" : "text-stone-400")}>Monthly</span>
            <button 
              onClick={toggleBilling}
              className="w-14 h-8 bg-stone-900 rounded-full p-1 relative transition-all"
            >
              <motion.div 
                animate={{ x: billingCycle === 'monthly' ? 0 : 24 }}
                className="w-6 h-6 bg-white rounded-full shadow-sm"
              />
            </button>
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-bold transition-colors", billingCycle === 'yearly' ? "text-stone-900" : "text-stone-400")}>Yearly</span>
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-widest">Save 20%</span>
            </div>
          </div>
        </div>

        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-stone-50 rounded-full blur-[120px] opacity-50" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-stone-50 rounded-full blur-[120px] opacity-50" />
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-7xl mx-auto px-6 mb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {PLANS.map((plan, idx) => (
            <PricingCard 
              key={plan.id} 
              plan={plan} 
              billingCycle={billingCycle} 
              delay={idx * 0.1}
              onSelect={() => handleSelectPlan(plan)}
              isProcessing={isProcessing === plan.id}
              isCurrent={business?.plan === plan.id}
            />
          ))}
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="max-w-7xl mx-auto px-6 mb-32 overflow-hidden">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-stone-900 mb-4">Compare all features</h2>
          <p className="text-stone-500">Everything you need to know about our plans.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="py-6 px-4 text-left text-xs font-bold text-stone-400 uppercase tracking-widest">Features</th>
                {PLANS.map(plan => (
                  <th key={plan.id} className="py-6 px-4 text-center text-sm font-bold text-stone-900">{plan.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              <ComparisonRow label="Admin Users" values={PLANS.map(p => p.entitlements.maxUsers)} />
              <ComparisonRow label="Products/Services" values={PLANS.map(p => p.entitlements.maxProducts > 10000 ? 'Unlimited' : p.entitlements.maxProducts)} />
              <ComparisonRow label="Orders / Month" values={PLANS.map(p => p.entitlements.maxOrdersPerMonth > 10000 ? 'Unlimited' : p.entitlements.maxOrdersPerMonth)} />
              <ComparisonRow label="Survey Responses" values={PLANS.map(p => p.entitlements.maxSurveyResponsesPerMonth > 10000 ? 'Unlimited' : p.entitlements.maxSurveyResponsesPerMonth)} />
              <ComparisonRow label="Platform Fee" values={PLANS.map(p => `${p.entitlements.platformFee}%`)} />
              <ComparisonRow label="Inventory Management" values={PLANS.map(p => p.entitlements.features.inventoryManagement === 'full' ? 'Full' : 'Basic')} />
              <ComparisonRow label="Low-stock Alerts" values={PLANS.map(p => p.entitlements.features.lowStockAlerts)} />
              <ComparisonRow label="Customer CRM" values={PLANS.map(p => p.entitlements.features.crm)} />
              <ComparisonRow label="Coupons & Discounts" values={PLANS.map(p => p.entitlements.features.coupons)} />
              <ComparisonRow label="AI Insights" values={PLANS.map(p => p.entitlements.features.aiInsights)} />
              <ComparisonRow label="Multi-location" values={PLANS.map(p => p.entitlements.features.multiLocation)} />
              <ComparisonRow label="Custom Domain" values={PLANS.map(p => p.entitlements.features.customDomain)} />
              <ComparisonRow label="Support" values={PLANS.map(p => p.entitlements.support.replace('-', ' '))} />
            </tbody>
          </table>
        </div>
      </section>

      {/* Add-ons Section */}
      <section className="bg-stone-50 py-24 px-6 mb-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-stone-900 mb-4">Powerful Add-ons</h2>
            <p className="text-stone-500">Customize your plan with exactly what you need.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ADD_ONS.map((addon, idx) => (
              <motion.button 
                key={addon.id}
                onClick={() => handleAddOn(addon)}
                disabled={isProcessing === addon.id || business?.addons?.includes(addon.id)}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  "bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center justify-between group hover:border-stone-900 hover:shadow-md transition-all text-left w-full",
                  business?.addons?.includes(addon.id) && "opacity-60 cursor-default border-stone-900"
                )}
              >
                <div>
                  <h4 className="font-bold text-stone-900 mb-1 group-hover:text-stone-900">{addon.name}</h4>
                  <p className="text-xs text-stone-500">
                    {typeof addon.price === 'number' ? `$${addon.price}` : addon.price}
                    {addon.period && ` / ${addon.period}`}
                  </p>
                </div>
                <div className={cn(
                  "p-2 rounded-xl transition-all",
                  business?.addons?.includes(addon.id) 
                    ? "bg-stone-900 text-white" 
                    : "bg-stone-50 text-stone-400 group-hover:bg-stone-900 group-hover:text-white"
                )}>
                  {isProcessing === addon.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : business?.addons?.includes(addon.id) ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-3xl mx-auto px-6 mb-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-stone-900 mb-4">Frequently Asked Questions</h2>
          <p className="text-stone-500">Everything you need to know about BizPulse pricing.</p>
        </div>
        <div className="space-y-4">
          {FAQ_ITEMS.map((item, idx) => (
            <div key={idx} className="border border-stone-100 rounded-2xl overflow-hidden">
              <button 
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-stone-50 transition-colors"
              >
                <span className="font-bold text-stone-900">{item.question}</span>
                {expandedFaq === idx ? <ChevronUp className="w-5 h-5 text-stone-400" /> : <ChevronDown className="w-5 h-5 text-stone-400" />}
              </button>
              <AnimatePresence>
                {expandedFaq === idx && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-6 pb-6 text-stone-500 text-sm leading-relaxed"
                  >
                    {item.answer}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-7xl mx-auto px-6 mb-32">
        <div className="bg-stone-900 rounded-[48px] p-12 md:p-24 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 tracking-tight">Ready to pulse-check <br /> your business?</h2>
            <p className="text-stone-400 text-xl mb-12 max-w-xl mx-auto">Join thousands of small business owners who are growing faster with BizPulse.</p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 w-full">
              <button 
                onClick={() => alert('Starting for free!')}
                className="w-full md:w-auto px-8 py-4 bg-white text-stone-900 rounded-2xl font-bold text-lg hover:bg-stone-100 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl"
              >
                Start for Free <ArrowRight className="w-5 h-5" />
              </button>
              <button 
                onClick={() => alert('Contacting sales...')}
                className="w-full md:w-auto px-8 py-4 bg-white/10 text-white rounded-2xl font-bold text-lg hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center backdrop-blur-sm"
              >
                Contact Sales
              </button>
            </div>
          </div>
          {/* Decorative background */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/20 blur-[120px] rounded-full -mr-48 -mt-48" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-stone-800/50 blur-[120px] rounded-full -ml-48 -mb-48" />
        </div>
      </section>

      {/* Upgrade Banner Examples (Floating) */}
      <div className="fixed bottom-8 left-8 z-40 space-y-4 hidden lg:block">
        <UpgradeBanner 
          title="Unlock AI Insights" 
          description="Get deep recommendations based on your customer feedback."
          plan="Premium"
        />
      </div>
    </div>
  );
}

function PricingCard({ 
  plan, 
  billingCycle, 
  delay, 
  onSelect, 
  isProcessing, 
  isCurrent 
}: { 
  plan: Plan, 
  billingCycle: 'monthly' | 'yearly', 
  delay: number,
  onSelect: () => void,
  isProcessing: boolean,
  isCurrent: boolean
}) {
  const price = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      viewport={{ once: true }}
      className={cn(
        "relative p-8 rounded-[40px] border transition-all flex flex-col",
        plan.isPopular 
          ? "bg-stone-900 text-white border-stone-900 shadow-2xl scale-105 z-10" 
          : "bg-white text-stone-900 border-stone-100 hover:border-stone-200 shadow-sm",
        isCurrent && "ring-2 ring-amber-400"
      )}
    >
      {plan.isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-400 text-stone-900 text-[10px] font-black uppercase tracking-widest rounded-full">
          Most Popular
        </div>
      )}

      <div className="mb-8">
        <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
        <p className={cn("text-sm mb-6", plan.isPopular ? "text-stone-400" : "text-stone-500")}>{plan.description}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold">${price}</span>
          <span className={cn("text-sm font-medium", plan.isPopular ? "text-stone-400" : "text-stone-500")}>/mo</span>
        </div>
        {billingCycle === 'yearly' && plan.priceMonthly > 0 && (
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-2">Billed annually</p>
        )}
      </div>

      <div className="space-y-4 mb-12 flex-1">
        <FeatureItem label={`${plan.entitlements.maxUsers} admin user${plan.entitlements.maxUsers > 1 ? 's' : ''}`} active={plan.isPopular} />
        <FeatureItem label={`${plan.entitlements.maxProducts > 10000 ? 'Unlimited' : plan.entitlements.maxProducts} products`} active={plan.isPopular} />
        <FeatureItem label={`${plan.entitlements.maxOrdersPerMonth > 10000 ? 'Unlimited' : plan.entitlements.maxOrdersPerMonth} orders / mo`} active={plan.isPopular} />
        <FeatureItem label={`${plan.entitlements.platformFee}% platform fee`} active={plan.isPopular} />
        <FeatureItem label={plan.entitlements.features.aiInsights ? "AI Insights included" : "Standard reporting"} active={plan.isPopular} />
      </div>

      <button 
        onClick={onSelect}
        disabled={isProcessing || isCurrent}
        className={cn(
        "w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]",
        plan.isPopular 
          ? "bg-white text-stone-900 hover:bg-stone-100 shadow-md" 
          : "bg-stone-900 text-white hover:bg-stone-800 shadow-md",
        (isProcessing || isCurrent) && "opacity-50 cursor-default"
      )}>
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isCurrent ? (
          'Current Plan'
        ) : (
          <>
            {plan.id === 'free' ? 'Get Started' : 'Choose Plan'}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </motion.div>
  );
}

function FeatureItem({ label, active }: { label: string, active?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", active ? "bg-white/10" : "bg-stone-100")}>
        <Check className={cn("w-3 h-3", active ? "text-white" : "text-stone-900")} />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

function ComparisonRow({ label, values }: { label: string, values: any[] }) {
  return (
    <tr className="hover:bg-stone-50/50 transition-colors">
      <td className="py-4 px-4 text-sm font-medium text-stone-600">{label}</td>
      {values.map((val, i) => (
        <td key={i} className="py-4 px-4 text-center">
          {typeof val === 'boolean' ? (
            val ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-stone-200 mx-auto" />
          ) : (
            <span className="text-sm font-bold text-stone-900">{val}</span>
          )}
        </td>
      ))}
    </tr>
  );
}

function UpgradeBanner({ title, description, plan }: { title: string, description: string, plan: string }) {
  return (
    <motion.div 
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="bg-white p-6 rounded-3xl border border-stone-200 shadow-2xl max-w-xs relative overflow-hidden"
    >
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Upgrade to {plan}</span>
        </div>
        <h4 className="font-bold text-stone-900 mb-1">{title}</h4>
        <p className="text-xs text-stone-500 mb-4">{description}</p>
        <button className="text-xs font-bold text-stone-900 flex items-center gap-1 hover:underline">
          View Pricing <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <div className="absolute top-0 right-0 w-24 h-24 bg-stone-50 rounded-full -mr-12 -mt-12" />
    </motion.div>
  );
}
