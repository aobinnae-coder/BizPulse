import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { TrendingUp, Users, Star, MessageSquare, ArrowUpRight, ArrowDownRight, Zap, Target } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, subDays, isAfter } from 'date-fns';

export default function Analytics({ user, business, initialSurveyId }: { user: any, business: any, initialSurveyId?: string | null }) {
  const [responses, setResponses] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('30d');
  
  // New Filter States
  const [filterSurveyId, setFilterSurveyId] = useState<string>(initialSurveyId || 'all');
  const [filterSentiment, setFilterSentiment] = useState<string>('all');
  const [filterScoreMin, setFilterScoreMin] = useState<number>(1);
  const [filterScoreMax, setFilterScoreMax] = useState<number>(10);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (!business) return;
    const q = query(collection(db, 'responses'), where('businessId', '==', business.id));
    const unsubResponses = onSnapshot(q, (s) => {
      setResponses(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const oq = query(collection(db, 'orders'), where('businessId', '==', business.id));
    const unsubOrders = onSnapshot(oq, (s) => {
      setOrders(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const sq = query(collection(db, 'surveys'), where('businessId', '==', business.id));
    const unsubSurveys = onSnapshot(sq, (s) => {
      setSurveys(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubResponses();
      unsubOrders();
      unsubSurveys();
    };
  }, [business]);

  const filterByDate = (items: any[]) => {
    if (dateRange === 'all') return items;
    const cutoff = subDays(new Date(), dateRange === '7d' ? 7 : 30);
    return items.filter(item => isAfter(new Date(item.createdAt), cutoff));
  };

  const getFilteredResponses = () => {
    let filtered = filterByDate(responses);

    if (filterSurveyId !== 'all') {
      filtered = filtered.filter(r => r.surveyId === filterSurveyId);
    }
    
    if (filterSentiment !== 'all') {
      filtered = filtered.filter(r => r.sentiment === filterSentiment);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => (r.status || 'new') === filterStatus);
    }

    filtered = filtered.filter(r => {
      const score = r.score || 0;
      return score >= filterScoreMin && score <= filterScoreMax;
    });

    return filtered;
  }

  const filteredResponses = getFilteredResponses();
  const filteredOrders = filterByDate(orders);

  const sentimentData = [
    { name: 'Positive', value: filteredResponses.filter(r => r.sentiment === 'positive').length, color: '#10b981' },
    { name: 'Neutral', value: filteredResponses.filter(r => r.sentiment === 'neutral').length, color: '#f59e0b' },
    { name: 'Negative', value: filteredResponses.filter(r => r.sentiment === 'negative').length, color: '#ef4444' },
  ];

  const scoreBreakdownData = [
    { name: '10 Stars', value: filteredResponses.filter(r => r.score === 10).length, color: '#10b981' },
    { name: '9 Stars', value: filteredResponses.filter(r => r.score === 9).length, color: '#34d399' },
    { name: '8 Stars', value: filteredResponses.filter(r => r.score === 8).length, color: '#6ee7b7' },
    { name: '7 Stars', value: filteredResponses.filter(r => r.score === 7).length, color: '#a7f3d0' },
    { name: '6 Stars', value: filteredResponses.filter(r => r.score === 6).length, color: '#fcd34d' },
    { name: '5 Stars', value: filteredResponses.filter(r => r.score === 5).length, color: '#fbbf24' },
    { name: '4 Stars', value: filteredResponses.filter(r => r.score === 4).length, color: '#f59e0b' },
    { name: '3 Stars', value: filteredResponses.filter(r => r.score === 3).length, color: '#f87171' },
    { name: '2 Stars', value: filteredResponses.filter(r => r.score === 2).length, color: '#ef4444' },
    { name: '1 Star', value: filteredResponses.filter(r => r.score === 1).length, color: '#dc2626' },
  ].filter(s => s.value > 0);

  const avgScore = filteredResponses.length ? filteredResponses.reduce((acc, r) => acc + (r.score || 0), 0) / filteredResponses.length : 0;
  const overallAvgScore = responses.length ? responses.reduce((acc, r) => acc + (r.score || 0), 0) / responses.length : 0;
  const totalRevenue = filteredOrders.reduce((acc, o) => acc + (o.total || 0), 0);
  
  const totalViews = surveys.reduce((acc, s) => acc + (s.views || 0), 0);
  const completionRate = totalViews > 0 ? (filteredResponses.length / totalViews) * 100 : 0;

  // Calculate trends (comparing current period with previous)
  const getTrend = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const prevCutoff = subDays(new Date(), dateRange === '7d' ? 14 : 60);
  const currentCutoff = subDays(new Date(), dateRange === '7d' ? 7 : 30);
  
  const currentResponses = responses.filter(r => isAfter(new Date(r.createdAt), currentCutoff));
  const prevResponses = responses.filter(r => isAfter(new Date(r.createdAt), prevCutoff) && !isAfter(new Date(r.createdAt), currentCutoff));
  
  const currentRevenue = orders.filter(o => isAfter(new Date(o.createdAt), currentCutoff)).reduce((acc, o) => acc + (o.total || 0), 0);
  const prevRevenue = orders.filter(o => isAfter(new Date(o.createdAt), prevCutoff) && !isAfter(new Date(o.createdAt), currentCutoff)).reduce((acc, o) => acc + (o.total || 0), 0);

  const revenueTrend = getTrend(currentRevenue, prevRevenue);
  const responseTrend = getTrend(currentResponses.length, prevResponses.length);

  const revenueData = Array.from({ length: 30 }, (_, i) => {
    const date = format(subDays(new Date(), i), 'MMM dd');
    const revenue = orders
      .filter((d: any) => format(new Date(d.createdAt), 'MMM dd') === date)
      .reduce((acc, d: any) => acc + (d.total || 0), 0);
    return { name: date, revenue };
  }).reverse();

  const sentimentTrendData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), i);
    const dayResponses = responses.filter(r => format(new Date(r.createdAt), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
    return {
      name: format(date, 'MMM dd'),
      positive: dayResponses.filter(r => r.sentiment === 'positive').length,
      negative: dayResponses.filter(r => r.sentiment === 'negative').length,
    };
  }).reverse();

  // Create question type stats based on replies
  const questionTypeStats = React.useMemo(() => {
    const qTypes: Record<string, string> = {};
    surveys.forEach(s => {
      s.questions?.forEach((q: any) => {
        qTypes[q.id] = q.type;
      });
    });

    const stats: Record<string, number> = {};
    filteredResponses.forEach(r => {
      if (r.answers) {
        Object.keys(r.answers).forEach(qId => {
          const type = qTypes[qId] || 'unknown';
          const val = r.answers[qId];
          // Simple validation: is it not empty
          if (val !== undefined && val !== '' && (Array.isArray(val) ? val.length > 0 : true)) {
            stats[type] = (stats[type] || 0) + 1;
          }
        });
      }
    });

    return Object.entries(stats).sort((a,b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [surveys, filteredResponses]);

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1'];

  // Complex question stats
  const questionDetailedStats = React.useMemo(() => {
    const qMap: Record<string, any> = {};
    surveys.forEach(s => {
      s.questions?.forEach((q: any) => {
        if (!qMap[q.id]) {
          qMap[q.id] = { ...q, surveyTitle: s.title, answerCounts: {} };
        }
      });
    });

    filteredResponses.forEach(r => {
      if (r.answers) {
        Object.keys(r.answers).forEach(qId => {
          if (qMap[qId]) {
            let val = r.answers[qId];
            if (val !== undefined && val !== '') {
              if (Array.isArray(val)) {
                val.forEach(v => {
                  const key = String(v);
                  qMap[qId].answerCounts[key] = (qMap[qId].answerCounts[key] || 0) + 1;
                });
              } else {
                const key = String(val);
                qMap[qId].answerCounts[key] = (qMap[qId].answerCounts[key] || 0) + 1;
              }
            }
          }
        });
      }
    });

    return Object.values(qMap).filter(q => Object.keys(q.answerCounts).length > 0);
  }, [surveys, filteredResponses]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Analytics</h1>
          <p className="text-stone-500">Deep dive into your customer satisfaction metrics.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setDateRange('7d')}
            className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all border", dateRange === '7d' ? "bg-stone-900 border-stone-900 text-white shadow-md shadow-stone-900/10" : "bg-white border-stone-200 text-stone-500 hover:text-stone-900 hover:border-stone-300")}
          >
            7 Days
          </button>
          <button 
            onClick={() => setDateRange('30d')}
            className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all border", dateRange === '30d' ? "bg-stone-900 border-stone-900 text-white shadow-md shadow-stone-900/10" : "bg-white border-stone-200 text-stone-500 hover:text-stone-900 hover:border-stone-300")}
          >
            30 Days
          </button>
          <button 
            onClick={() => setDateRange('all')}
            className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all border", dateRange === 'all' ? "bg-stone-900 border-stone-900 text-white shadow-md shadow-stone-900/10" : "bg-white border-stone-200 text-stone-500 hover:text-stone-900 hover:border-stone-300")}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Survey</label>
          <select
            value={filterSurveyId}
            onChange={(e) => setFilterSurveyId(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm font-medium text-stone-900 outline-none focus:border-stone-400 focus:bg-white transition-all"
          >
            <option value="all">All Surveys</option>
            {surveys.map(s => <option key={s.id} value={s.id}>{s.title || 'Untitled Survey'}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm font-medium text-stone-900 outline-none focus:border-stone-400 focus:bg-white transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="flagged">Flagged</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Sentiment</label>
          <select
            value={filterSentiment}
            onChange={(e) => setFilterSentiment(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm font-medium text-stone-900 outline-none focus:border-stone-400 focus:bg-white transition-all"
          >
            <option value="all">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Min Score</label>
            <input
              type="number"
              min="1"
              max="10"
              value={filterScoreMin}
              onChange={(e) => setFilterScoreMin(Number(e.target.value))}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-900 outline-none focus:border-stone-400 focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Max Score</label>
            <input
              type="number"
              min="1"
              max="10"
              value={filterScoreMax}
              onChange={(e) => setFilterScoreMax(Number(e.target.value))}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-900 outline-none focus:border-stone-400 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-stone-900 p-8 rounded-3xl text-white relative overflow-hidden">
          <div className="relative z-10">
            <Star className="w-8 h-8 text-amber-400 mb-4" />
            <p className="text-stone-400 text-sm font-medium uppercase tracking-widest mb-1">Global Average Score</p>
            <h4 className="text-4xl font-bold text-white">{overallAvgScore.toFixed(1)} / 10</h4>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-xs font-medium text-stone-400">
                All-time average from {responses.length} responses
              </span>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
        </div>
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <TrendingUp className="w-8 h-8 text-emerald-500 mb-4" />
            <p className="text-stone-500 text-sm font-medium uppercase tracking-widest mb-1">Total Revenue</p>
            <h4 className="text-4xl font-bold">${totalRevenue.toLocaleString()}</h4>
            <div className="flex items-center gap-1 mt-2">
              {revenueTrend >= 0 ? <ArrowUpRight className="w-4 h-4 text-emerald-500" /> : <ArrowDownRight className="w-4 h-4 text-red-500" />}
              <span className={cn("text-xs font-bold", revenueTrend >= 0 ? "text-emerald-500" : "text-red-500")}>
                {Math.abs(revenueTrend).toFixed(1)}% vs prev period
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <Star className="w-8 h-8 text-amber-400 mb-4" />
          <p className="text-stone-500 text-sm font-medium uppercase tracking-widest mb-1">Filtered NPS</p>
          <h4 className="text-4xl font-bold text-stone-900">{avgScore.toFixed(1)} / 10</h4>
          <p className="text-xs text-stone-400 mt-2">Based on {filteredResponses.length} filtered reviews</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <Users className="w-8 h-8 text-stone-400 mb-4" />
          <p className="text-stone-500 text-sm font-medium uppercase tracking-widest mb-1">Total Respondents</p>
          <h4 className="text-4xl font-bold text-stone-900">{filteredResponses.length}</h4>
          <div className="flex items-center gap-1 mt-2">
            {responseTrend >= 0 ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
            <span className={cn("text-xs font-bold", responseTrend >= 0 ? "text-emerald-400" : "text-red-400")}>
              {Math.abs(responseTrend).toFixed(1)}% vs prev period
            </span>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <MessageSquare className="w-8 h-8 text-blue-400 mb-4" />
          <p className="text-stone-500 text-sm font-medium uppercase tracking-widest mb-1">Completion Rate</p>
          <h4 className="text-4xl font-bold text-stone-900">{completionRate.toFixed(1)}%</h4>
          <p className="text-xs text-stone-500 mt-2">From {totalViews} views</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-stone-900">Sentiment Trend</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Positive</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Negative</span>
              </div>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sentimentTrendData}>
                <defs>
                  <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="positive" stroke="#10b981" fillOpacity={1} fill="url(#colorPos)" strokeWidth={2} />
                <Area type="monotone" dataKey="negative" stroke="#ef4444" fillOpacity={1} fill="url(#colorNeg)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <h3 className="text-lg font-bold text-stone-900 mb-8">Revenue Trend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#1c1917" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <h3 className="text-lg font-bold text-stone-900 mb-8">Sentiment Breakdown</h3>
          <div className="h-[300px] flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-4 pr-8">
              {sentimentData.map(s => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-sm font-medium text-stone-600">{s.name} ({s.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <h3 className="text-lg font-bold text-stone-900 mb-8">Score Breakdown</h3>
          {scoreBreakdownData.length > 0 ? (
            <div className="h-[300px] flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scoreBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {scoreBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 pr-8 max-h-full overflow-y-auto w-1/2">
                {scoreBreakdownData.map(s => (
                  <div key={s.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-sm font-medium text-stone-600 truncate flex-1">{s.name}</span>
                    <span className="text-sm font-bold text-stone-900">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-stone-400">
              No score data available for selected filters.
            </div>
          )}
        </div>

        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <h3 className="text-lg font-bold text-stone-900 mb-8">Breakdown by Question Type</h3>
          <div className="h-[300px] flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={questionTypeStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {questionTypeStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-4 pr-8 max-h-full overflow-y-auto w-1/3">
              {questionTypeStats.map((s, idx) => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-sm font-medium text-stone-600 truncate capitalize">{s.name} ({s.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <h3 className="text-lg font-bold text-stone-900 mb-8">Actionable Insights</h3>
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-900">High Satisfaction Trend</h4>
                <p className="text-xs text-emerald-700">Customer sentiment is up 12% this week. Keep up the great service!</p>
              </div>
            </div>
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900">Improve Response Time</h4>
                <p className="text-xs text-amber-700">3 negative reviews mentioned slow delivery. Consider optimizing your logistics.</p>
              </div>
            </div>
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-blue-900">New Customer Segment</h4>
                <p className="text-xs text-blue-700">A new group of customers from Retail sector is showing high engagement.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {questionDetailedStats.length > 0 && (
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm mt-8">
          <h3 className="text-lg font-bold text-stone-900 mb-8">Detailed Answers Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {questionDetailedStats.map(q => (
              <div key={q.id} className="p-6 bg-stone-50 rounded-2xl border border-stone-100 flex flex-col gap-4">
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest bg-stone-200 inline-block px-2 py-1 rounded-md mb-2">{q.type} - {q.surveyTitle}</p>
                  <h4 className="font-bold text-stone-900 text-sm leading-relaxed">{q.label}</h4>
                </div>
                <div className="space-y-2 mt-auto">
                  {Object.entries(q.answerCounts).sort((a: any, b: any) => b[1] - a[1]).map(([answer, count]: any) => (
                    <div key={answer} className="flex items-center justify-between text-xs">
                      <span className="text-stone-600 truncate mr-2" title={answer}>
                         {q.type === 'star' ? `${answer} Star${answer !== '1' ? 's' : ''}` : answer}
                      </span>
                      <span className="font-bold text-stone-900 bg-white px-2 py-1 rounded-lg shadow-sm border border-stone-100">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
