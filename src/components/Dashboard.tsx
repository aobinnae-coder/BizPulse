import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { 
  Users, 
  ClipboardList, 
  Star, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  AlertCircle,
  CheckSquare,
  CheckCircle2,
  Plus
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { format, subDays } from 'date-fns';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import UpgradeBanner from './UpgradeBanner';
import { PLANS } from '../constants/pricing';

export default function Dashboard({ user, business, onNavigate }: { user: any, business: any, onNavigate: (view: string) => void }) {
  const [stats, setStats] = useState({
    totalSurveys: 0,
    totalResponses: 0,
    avgSatisfaction: 0,
    openActions: 0,
    totalSales: 0,
    totalOrders: 0,
    totalDiscount: 0,
    totalProducts: 0
  });
  const [recentResponses, setRecentResponses] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [revenueChartData, setRevenueChartData] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [popularCoupons, setPopularCoupons] = useState<any[]>([]);
  const [totalRedemptions, setTotalRedemptions] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!business) return;

    // Low stock items
    const stockQuery = query(collection(db, 'products'), where('businessId', '==', business.id));
    const unsubStock = onSnapshot(stockQuery, (s) => {
      const items = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setLowStockItems(items.filter((i: any) => i.stock <= (i.threshold || 5)));
      setStats(prev => ({ ...prev, totalProducts: s.size }));
    });

    // Fetch stats
    const surveysQuery = query(collection(db, 'surveys'), where('businessId', '==', business.id));
    const responsesQuery = query(collection(db, 'responses'), where('businessId', '==', business.id));
    const actionsQuery = query(collection(db, 'actionItems'), where('businessId', '==', business.id), where('status', '!=', 'done'));
    const ordersQuery = query(collection(db, 'orders'), where('businessId', '==', business.id));

    const unsubSurveys = onSnapshot(surveysQuery, (s) => setStats(prev => ({ ...prev, totalSurveys: s.size })));
    const unsubOrders = onSnapshot(ordersQuery, (s) => {
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() }));
      const totalSales = docs.reduce((acc, d: any) => acc + (d.total || 0), 0);
      const totalDiscount = docs.reduce((acc, d: any) => acc + (d.discount || 0), 0);
      setStats(prev => ({ ...prev, totalOrders: s.size, totalSales, totalDiscount }));

      // Prepare revenue chart data (last 30 days)
      const days = Array.from({ length: 30 }, (_, i) => {
        const date = format(subDays(new Date(), i), 'MMM dd');
        const revenue = docs
          .filter((d: any) => format(new Date(d.createdAt), 'MMM dd') === date)
          .reduce((acc, d: any) => acc + (d.total || 0), 0);
        return { date, revenue };
      }).reverse();
      setRevenueChartData(days);
    });
    const unsubResponses = onSnapshot(responsesQuery, (s) => {
      setStats(prev => ({ ...prev, totalResponses: s.size }));
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Calculate avg satisfaction
      const totalScore = docs.reduce((acc, d: any) => acc + (d.score || 0), 0);
      setStats(prev => ({ ...prev, avgSatisfaction: docs.length ? totalScore / docs.length : 0 }));

      // Prepare chart data (last 30 days)
      const days = Array.from({ length: 30 }, (_, i) => {
        const date = format(subDays(new Date(), i), 'MMM dd');
        const count = docs.filter((d: any) => format(new Date(d.createdAt), 'MMM dd') === date).length;
        return { date, count };
      }).reverse();
      setChartData(days);
    });
    const unsubActions = onSnapshot(actionsQuery, (s) => setStats(prev => ({ ...prev, openActions: s.size })));

    // Recent responses
    const recentQuery = query(
      collection(db, 'responses'), 
      where('businessId', '==', business.id), 
      orderBy('createdAt', 'desc'), 
      limit(5)
    );
    const unsubRecent = onSnapshot(recentQuery, (s) => {
      setRecentResponses(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Coupons
    const couponsQuery = query(collection(db, 'coupons'), where('businessId', '==', business.id));
    const unsubCoupons = onSnapshot(couponsQuery, (s) => {
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() }));
      const redemptions = docs.reduce((acc, d: any) => acc + (d.usageCount || 0), 0);
      setTotalRedemptions(redemptions);
      
      const sorted = [...docs].sort((a: any, b: any) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 3);
      setPopularCoupons(sorted);
    });

    return () => {
      unsubSurveys();
      unsubOrders();
      unsubResponses();
      unsubActions();
      unsubRecent();
      unsubStock();
      unsubCoupons();
    };
  }, [business]);

  if (!business) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="text-stone-400 w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-stone-900 mb-2">Welcome to BizCompana</h2>
        <p className="text-stone-500 max-w-md mb-6">Complete your business profile to start creating surveys and gathering feedback.</p>
        <button 
          onClick={() => onNavigate('settings')}
          className="px-6 py-2 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors"
        >
          Complete Profile
        </button>
      </div>
    );
  }

  const cards = [
    { label: 'Total Sales', value: `$${stats.totalSales.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Orders', value: stats.totalOrders, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Avg Satisfaction', value: stats.avgSatisfaction.toFixed(1), icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Open Actions', value: stats.openActions, icon: CheckSquare, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  const currentPlan = PLANS.find(p => p.id === (business?.plan || 'free')) || PLANS[0];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>
          <p className="text-stone-500">Welcome back, {business.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Current Plan</span>
            <span className="text-sm font-bold text-stone-900">{currentPlan.name}</span>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => handleCopy(`${window.location.origin}?store=${business.id}`)}
              className={cn(
                "px-4 py-2 border rounded-xl text-sm font-medium transition-all flex items-center gap-2",
                copied ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
              )}
            >
              {copied ? <CheckCircle2 className="w-4 h-4" /> : null}
              {copied ? 'Copied!' : 'Share Link'}
            </button>
            <button 
              onClick={() => onNavigate('surveys')}
              className="px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Survey
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-2xl", card.bg)}>
                <card.icon className={cn("w-6 h-6", card.color)} />
              </div>
              <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                <TrendingUp className="w-4 h-4" />
                12%
              </div>
            </div>
            <p className="text-stone-500 text-sm font-medium mb-1">{card.label}</p>
            <h3 className="text-2xl font-bold text-stone-900">{card.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Plan Usage & Upgrade */}
          {business?.plan === 'free' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
                <h4 className="text-sm font-bold text-stone-900 mb-4">Plan Usage</h4>
                <div className="space-y-4">
                  <UsageBar label="Orders" current={stats.totalOrders} max={currentPlan.entitlements.maxOrdersPerMonth} />
                  <UsageBar label="Products" current={stats.totalProducts} max={currentPlan.entitlements.maxProducts} />
                </div>
              </div>
              <UpgradeBanner 
                title="Scale your business"
                description="Unlock more orders, products, and advanced analytics with the Pro plan."
                className="h-full"
              />
            </div>
          )}

          {/* Low Stock Alerts */}
          {lowStockItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-amber-900">Low Stock Alerts</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lowStockItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-white/50 p-3 rounded-xl border border-amber-200">
                    <span className="text-sm font-medium text-stone-900">{item.name}</span>
                    <span className="text-xs font-bold text-amber-600 uppercase">{item.stock} units left</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coupon Performance */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
            <h3 className="text-lg font-bold text-stone-900 mb-6">Coupon Performance</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Total Redemptions</p>
                <p className="text-2xl font-bold text-stone-900">{totalRedemptions}</p>
              </div>
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Total Discount Given</p>
                <p className="text-2xl font-bold text-stone-900">${stats.totalDiscount.toFixed(2)}</p>
              </div>
            </div>
            
            {popularCoupons.length > 0 ? (
              <div>
                <h4 className="text-sm font-bold text-stone-900 mb-4">Popular Codes</h4>
                <div className="space-y-3">
                  {popularCoupons.map((coupon, idx) => (
                    <div key={coupon.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-stone-900 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-stone-900 font-mono">{coupon.code}</p>
                          <p className="text-[10px] text-stone-500 uppercase tracking-wider">
                            {coupon.type === 'percentage' ? `${coupon.value}% OFF` : `$${coupon.value} OFF`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-stone-900">{coupon.usageCount}</p>
                        <p className="text-[10px] text-stone-500 uppercase tracking-wider">Uses</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-stone-50 rounded-2xl border border-stone-100">
                <p className="text-stone-400 text-sm">No coupon data yet</p>
              </div>
            )}
          </div>

          {/* Revenue Trend */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-stone-900">Revenue Trend</h3>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-stone-900 rounded-full" />
                <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">Daily Revenue</span>
              </div>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    cursor={{ fill: '#f9f9f9' }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#1c1917" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Response Volume */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-stone-900">Response Volume</h3>
            <select className="bg-stone-50 border-none text-sm font-medium text-stone-600 rounded-lg px-3 py-1 outline-none">
              <option>Last 30 days</option>
              <option>Last 7 days</option>
            </select>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: '#f9f9f9' }}
                />
                <Bar dataKey="count" fill="#1c1917" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <h3 className="text-lg font-bold text-stone-900 mb-6">Recent Feedback</h3>
          <div className="space-y-6">
            {recentResponses.map((response) => (
              <div key={response.id} className="flex gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                  response.sentiment === 'positive' ? 'bg-emerald-50 text-emerald-600' :
                  response.sentiment === 'negative' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                )}>
                  {response.sentiment === 'positive' ? <TrendingUp className="w-5 h-5" /> : <TrendingUp className="w-5 h-5 rotate-180" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-stone-900 truncate">
                      {response.respondent?.name || 'Anonymous'}
                    </p>
                    <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">
                      {format(new Date(response.createdAt), 'MMM dd')}
                    </span>
                  </div>
                  <p className="text-sm text-stone-500 line-clamp-2">
                    {Object.values(response.answers || {}).find(v => typeof v === 'string') as string || 'No comment provided'}
                  </p>
                </div>
              </div>
            ))}
            {recentResponses.length === 0 && (
              <div className="text-center py-8">
                <p className="text-stone-400 text-sm">No feedback yet</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => onNavigate('feedback')}
            className="w-full mt-8 py-3 text-sm font-bold text-stone-900 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
          >
            View All Feedback
          </button>
        </div>
      </div>
    </div>
  );
}

function UsageBar({ label, current, max }: { label: string, current: number, max: number }) {
  const percentage = Math.min((current / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium">
        <span className="text-stone-500">{label}</span>
        <span className="text-stone-900">{current} / {max}</span>
      </div>
      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className={cn(
            "h-full rounded-full",
            percentage > 90 ? "bg-red-500" : percentage > 70 ? "bg-amber-500" : "bg-stone-900"
          )}
        />
      </div>
    </div>
  );
}
