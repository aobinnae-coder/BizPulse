import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, addDoc } from 'firebase/firestore';
import { Search, Filter, MessageSquare, User, Clock, CheckCircle2, Flag, Archive, MoreVertical, Send, ShoppingBag, Sparkles, Wand2, Edit, Save, X, ArrowUpDown } from 'lucide-react';
import { format, subDays, isAfter, startOfDay } from 'date-fns';
import { cn } from '../lib/utils';
import { GoogleGenAI } from '@google/genai';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is not configured. Please add GEMINI_API_KEY to your secrets.");
  }
  return new GoogleGenAI({ apiKey });
}

export default function FeedbackInbox({ user, business, onViewOrder, initialSurveyId }: { user: any, business: any, onViewOrder?: (orderId: string) => void, initialSurveyId?: string | null }) {
  const [responses, setResponses] = useState<any[]>([]);
  const [selectedResponse, setSelectedResponse] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const [surveyFilter, setSurveyFilter] = useState(initialSurveyId || 'all');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'sentiment' | 'score' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [datePreset, setDatePreset] = useState<'all' | '7d' | '30d' | 'custom'>('all');
  const [actionItemFilter, setActionItemFilter] = useState<'all' | 'with-actions' | 'without-actions'>('all');
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [aiFocus, setAiFocus] = useState('');
  const [aiLength, setAiLength] = useState<'short' | 'medium' | 'detailed'>('medium');

  useEffect(() => {
    if (!business) return;
    const q = query(collection(db, 'responses'), where('businessId', '==', business.id), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (s) => {
      setResponses(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const aiQuery = query(collection(db, 'actionItems'), where('businessId', '==', business.id));
    const aiUnsubscribe = onSnapshot(aiQuery, (s) => {
      setActionItems(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const sQuery = query(collection(db, 'surveys'), where('businessId', '==', business.id));
    const sUnsubscribe = onSnapshot(sQuery, (s) => {
      setSurveys(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribe();
      aiUnsubscribe();
      sUnsubscribe();
    };
  }, [business]);

  const updateStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, 'responses', id), { status });
    if (selectedResponse?.id === id) setSelectedResponse({ ...selectedResponse, status });
  };

  const createActionItem = async (response: any) => {
    const title = `Follow up with ${response.respondent?.name || 'Customer'}`;
    await addDoc(collection(db, 'actionItems'), {
      businessId: business.id,
      ownerUid: user.uid,
      responseId: response.id,
      title,
      description: `Based on feedback: ${Object.values(response.answers)[0]}`,
      priority: response.sentiment === 'negative' ? 'high' : 'medium',
      status: 'todo',
      createdAt: new Date().toISOString()
    });
    alert('Action item created!');
  };

  const filteredResponses = responses.filter(r => {
    if (surveyFilter !== 'all' && r.surveyId !== surveyFilter) return false;
    if (filter !== 'all' && r.status !== filter) return false;
    if (sentimentFilter !== 'all' && r.sentiment !== sentimentFilter) return false;
    
    // Search by name, email, or content
    if (search) {
      const searchLower = search.toLowerCase();
      const name = (r.respondent?.name || '').toLowerCase();
      const email = (r.respondent?.email || '').toLowerCase();
      const answers = JSON.stringify(r.answers).toLowerCase();
      if (!name.includes(searchLower) && !email.includes(searchLower) && !answers.includes(searchLower)) return false;
    }

    // Action item filter
    if (actionItemFilter !== 'all') {
      const hasAction = actionItems.some(ai => ai.responseId === r.id);
      if (actionItemFilter === 'with-actions' && !hasAction) return false;
      if (actionItemFilter === 'without-actions' && hasAction) return false;
    }

    // Date range filter
    if (datePreset === '7d') {
      const sevenDaysAgo = startOfDay(subDays(new Date(), 7));
      if (!isAfter(new Date(r.createdAt), sevenDaysAgo)) return false;
    } else if (datePreset === '30d') {
      const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));
      if (!isAfter(new Date(r.createdAt), thirtyDaysAgo)) return false;
    } else if (datePreset === 'custom') {
      if (dateRange.start && new Date(r.createdAt) < new Date(dateRange.start)) return false;
      if (dateRange.end && new Date(r.createdAt) > new Date(dateRange.end)) return false;
    }

    return true;
  }).sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'date') {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sortBy === 'score') {
      comparison = (a.score || 0) - (b.score || 0);
    } else if (sortBy === 'sentiment') {
      comparison = (a.sentiment || '').localeCompare(b.sentiment || '');
    } else if (sortBy === 'status') {
      comparison = (a.status || '').localeCompare(b.status || '');
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkAction = async (status: string) => {
    if (selectedIds.size === 0) return;
    const promises = Array.from(selectedIds).map(id => updateDoc(doc(db, 'responses', id), { status }));
    await Promise.all(promises);
    setSelectedIds(new Set());
    if (selectedResponse && selectedIds.has(selectedResponse.id)) {
      setSelectedResponse({ ...selectedResponse, status });
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedResponse || !editData) return;
    await updateDoc(doc(db, 'responses', selectedResponse.id), {
      sentiment: editData.sentiment,
      score: editData.score,
      answers: editData.answers
    });
    setSelectedResponse({ ...selectedResponse, ...editData });
    setIsEditing(false);
  };

  const generateAIAssessment = async () => {
    if (responses.length === 0 || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const ai = getGenAI();
      const lengthPrompt = aiLength === 'short' ? 'Keep the summary very concise (max 100 words).' : aiLength === 'detailed' ? 'Provide a detailed and comprehensive analysis.' : 'Keep the summary of medium length.';
      const focusPrompt = aiFocus ? `STRICTLY focus your analysis on: "${aiFocus}".` : 'Specifically focus on extracting actionable insights such as suggestions for product improvement or service enhancements.';
      
      const prompt = `You are a customer experience expert. Analyze the following survey responses for a business named "${business?.name}".
      ${lengthPrompt}
      ${focusPrompt}
      Identify and list common themes or topics across multiple feedback responses.
      Format it as a short paragraph followed by a bulleted list of key themes mentioned by customers, and then a bulleted list of actionable insights.
      
      Responses:
      ${JSON.stringify(responses.map(r => ({ sentiment: r.sentiment, score: r.score, answers: r.answers })))}
      `;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      if (response.text) {
        setAiSummary(response.text);
      }
    } catch (error) {
      console.error("AI Analysis failed", error);
      alert("Failed to analyze responses. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const calculateOverallSentiment = () => {
    if (filteredResponses.length === 0) return { label: 'No Data', value: 0 };
    const score = filteredResponses.reduce((acc, r) => {
      if (r.sentiment === 'positive') return acc + 1;
      if (r.sentiment === 'negative') return acc - 1;
      return acc;
    }, 0) / filteredResponses.length;
    
    if (score > 0.5) return { label: 'Overwhelmingly Positive', value: score };
    if (score > 0.2) return { label: 'Mostly Positive', value: score };
    if (score > -0.2) return { label: 'Mixed / Neutral', value: score };
    if (score > -0.5) return { label: 'Mostly Negative', value: score };
    return { label: 'Overwhelmingly Negative', value: score };
  };

  const overallSentiment = calculateOverallSentiment();

  return (
    <div className="h-[calc(100vh-12rem)] flex gap-6">
      {/* List */}
      <div className="w-1/3 flex flex-col bg-white rounded-3xl border border-stone-200 overflow-hidden">
        <div className="p-4 border-b border-stone-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-stone-900">Inbox</h2>
            <div className="flex items-center gap-2">
              <div className={cn(
                "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest",
                overallSentiment.value > 0.2 ? "bg-emerald-50 text-emerald-700" : 
                overallSentiment.value < -0.2 ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-700"
              )}>
                {overallSentiment.label}
              </div>
              <button 
                onClick={generateAIAssessment}
                disabled={isAnalyzing || responses.length === 0 || business?.plan === 'free'}
                className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title={business?.plan === 'free' ? "Upgrade to Pro for AI Analysis" : "Analyze Responses"}
              >
                {isAnalyzing ? <div className="w-3 h-3 border-2 border-amber-600/20 border-t-amber-600 rounded-full animate-spin" /> : <Sparkles className="w-3 h-3" />}
                AI Summary
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input 
              type="text" 
              placeholder="Search feedback..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-stone-50 border-none rounded-xl py-2 pl-10 pr-4 text-sm outline-none"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
              {['all', 'new', 'reviewed', 'flagged', 'archived'].map(f => (
                <button 
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold capitalize whitespace-nowrap",
                    filter === f ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                showFilters ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
              )}
            >
              <Filter className="w-3 h-3" />
            </button>
          </div>

          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="space-y-4 pt-2 border-t border-stone-100 px-1"
            >
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Survey Filter</label>
                <select
                  value={surveyFilter}
                  onChange={(e) => setSurveyFilter(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-lg py-1.5 px-2 text-xs font-bold text-stone-600 outline-none focus:border-stone-400"
                >
                  <option value="all">All Surveys</option>
                  {surveys.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  {['all', '7d', '30d', 'custom'].map(p => (
                    <button 
                      key={p}
                      onClick={() => setDatePreset(p as any)}
                      className={cn(
                        "px-2 py-1.5 rounded-lg text-xs font-bold transition-all border",
                        datePreset === p ? "bg-stone-900 border-stone-900 text-white" : "bg-white border-stone-200 text-stone-500 hover:border-stone-400"
                      )}
                    >
                      {p === 'all' ? 'All Time' : p === '7d' ? 'Last 7D' : p === '30d' ? 'Last 30D' : 'Custom'}
                    </button>
                  ))}
                </div>
                {datePreset === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input 
                      type="date" 
                      value={dateRange.start}
                      onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-lg py-1.5 px-2 text-xs outline-none focus:border-stone-400"
                    />
                    <input 
                      type="date" 
                      value={dateRange.end}
                      onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-lg py-1.5 px-2 text-xs outline-none focus:border-stone-400"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Action Items</label>
                <div className="flex gap-2">
                  {['all', 'with-actions', 'without-actions'].map(f => (
                    <button 
                      key={f}
                      onClick={() => setActionItemFilter(f as any)}
                      className={cn(
                        "flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border whitespace-nowrap",
                        actionItemFilter === f ? "bg-stone-900 border-stone-900 text-white" : "bg-white border-stone-200 text-stone-500 hover:border-stone-400"
                      )}
                    >
                      {f === 'all' ? 'Any' : f === 'with-actions' ? 'Has Actions' : 'No Actions'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Sentiment</label>
                  <select
                    value={sentimentFilter}
                    onChange={(e) => setSentimentFilter(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-lg py-1.5 px-2 text-xs font-bold text-stone-600 outline-none focus:border-stone-400"
                  >
                    <option value="all">Any Sentiment</option>
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Sort By</label>
                  <div className="flex gap-1">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="flex-1 bg-white border border-stone-200 rounded-lg py-1.5 px-2 text-[10px] font-bold text-stone-600 outline-none focus:border-stone-400"
                    >
                      <option value="date">Date</option>
                      <option value="sentiment">Sentiment</option>
                      <option value="score">Score</option>
                      <option value="status">Status</option>
                    </select>
                    <button 
                      onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                      className="p-1.5 bg-stone-100 text-stone-500 rounded-lg hover:bg-stone-200 transition-colors"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  setDateRange({ start: '', end: '' });
                  setDatePreset('all');
                  setSentimentFilter('all');
                  setActionItemFilter('all');
                  setSortBy('date');
                  setSortOrder('desc');
                }}
                className="w-full py-2 text-[10px] font-black text-stone-400 hover:text-stone-900 uppercase tracking-tighter transition-colors"
              >
                Clear all filters
              </button>
            </motion.div>
          )}

          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between bg-stone-900 text-white p-2 rounded-xl text-xs font-bold">
              <span>{selectedIds.size} selected</span>
              <div className="flex gap-2">
                <button onClick={() => handleBulkAction('reviewed')} className="hover:text-emerald-400 transition-colors">Review</button>
                <button onClick={() => handleBulkAction('flagged')} className="hover:text-amber-400 transition-colors">Flag</button>
                <button onClick={() => handleBulkAction('archived')} className="hover:text-stone-400 transition-colors">Archive</button>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredResponses.map(r => (
            <div
              key={r.id}
              onClick={() => setSelectedResponse(r)}
              className={cn(
                "w-full p-4 text-left border-b border-stone-50 transition-colors flex gap-3 cursor-pointer",
                selectedResponse?.id === r.id ? "bg-stone-50" : "hover:bg-stone-50/50"
              )}
            >
              <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                <input 
                  type="checkbox" 
                  checked={selectedIds.has(r.id)}
                  onChange={(e) => toggleSelection(r.id, e as any)}
                  className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-stone-900 truncate">{r.respondent?.name || 'Anonymous'}</span>
                  <span className="text-[10px] text-stone-400 shrink-0">{format(new Date(r.createdAt), 'MMM dd')}</span>
                </div>
                <p className="text-xs text-stone-500 line-clamp-1 mb-2">{Object.values(r.answers)[0] as string}</p>
                <div className={cn(
                  "inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                  r.sentiment === 'positive' ? "bg-emerald-50 text-emerald-600" :
                  r.sentiment === 'negative' ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                )}>
                  {r.sentiment}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 bg-white rounded-3xl border border-stone-200 flex flex-col overflow-hidden">
        {aiSummary && !selectedResponse && (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="bg-amber-50 rounded-3xl p-8 border border-amber-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Wand2 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-900">AI Insights</h3>
                  <p className="text-sm text-amber-700">Analysis of {responses.length} responses</p>
                </div>
              </div>
              <div className="markdown-body prose prose-amber prose-sm max-w-none">
                <ReactMarkdown>{aiSummary}</ReactMarkdown>
              </div>
              <button 
                onClick={() => setAiSummary(null)}
                className="mt-6 px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-200 transition-colors"
              >
                Close Summary
              </button>
            </div>
          </div>
        )}

        {selectedResponse ? (
          <>
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center">
                  <User className="text-stone-400 w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-stone-900">{selectedResponse.respondent?.name || 'Anonymous Customer'}</h3>
                  <p className="text-sm text-stone-500">{selectedResponse.respondent?.email || 'No email provided'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button onClick={handleSaveEdit} className="p-2 hover:bg-stone-50 rounded-xl text-stone-400 hover:text-emerald-600" title="Save"><Save className="w-5 h-5" /></button>
                    <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-stone-50 rounded-xl text-stone-400 hover:text-red-600" title="Cancel"><X className="w-5 h-5" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => {
                      setEditData({ sentiment: selectedResponse.sentiment, score: selectedResponse.score, answers: selectedResponse.answers });
                      setIsEditing(true);
                    }} className="p-2 hover:bg-stone-50 rounded-xl text-stone-400 hover:text-blue-600" title="Edit"><Edit className="w-5 h-5" /></button>
                    <button onClick={() => updateStatus(selectedResponse.id, 'reviewed')} className="p-2 hover:bg-stone-50 rounded-xl text-stone-400 hover:text-emerald-600" title="Mark Reviewed"><CheckCircle2 className="w-5 h-5" /></button>
                    <button onClick={() => updateStatus(selectedResponse.id, 'flagged')} className="p-2 hover:bg-stone-50 rounded-xl text-stone-400 hover:text-amber-600" title="Flag"><Flag className="w-5 h-5" /></button>
                    <button onClick={() => updateStatus(selectedResponse.id, 'archived')} className="p-2 hover:bg-stone-50 rounded-xl text-stone-400 hover:text-stone-600" title="Archive"><Archive className="w-5 h-5" /></button>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-stone-50 p-4 rounded-2xl">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Sentiment</p>
                  {isEditing ? (
                    <select 
                      value={editData?.sentiment || 'neutral'}
                      onChange={(e) => setEditData({ ...editData, sentiment: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded-lg py-1 px-2 text-sm outline-none"
                    >
                      <option value="positive">Positive</option>
                      <option value="neutral">Neutral</option>
                      <option value="negative">Negative</option>
                    </select>
                  ) : (
                    <p className="text-sm font-bold capitalize">{selectedResponse.sentiment}</p>
                  )}
                </div>
                <div className="bg-stone-50 p-4 rounded-2xl">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Score</p>
                  {isEditing ? (
                    <input 
                      type="number" 
                      min="0" 
                      max="5" 
                      step="0.1"
                      value={editData?.score || 0}
                      onChange={(e) => setEditData({ ...editData, score: parseFloat(e.target.value) })}
                      className="w-full bg-white border border-stone-200 rounded-lg py-1 px-2 text-sm outline-none"
                    />
                  ) : (
                    <p className="text-sm font-bold">{selectedResponse.score.toFixed(1)} / 5.0</p>
                  )}
                </div>
                <div className="bg-stone-50 p-4 rounded-2xl">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Status</p>
                  <p className="text-sm font-bold capitalize">{selectedResponse.status}</p>
                </div>
                {selectedResponse.orderId && (
                  <div className="bg-stone-900 p-4 rounded-2xl text-white col-span-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShoppingBag className="w-5 h-5 text-stone-400" />
                      <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Linked Order</p>
                        <p className="text-sm font-bold font-mono">#{selectedResponse.orderId.slice(-6).toUpperCase()}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => onViewOrder?.(selectedResponse.orderId)}
                      className="text-xs font-bold text-stone-400 hover:text-white transition-colors"
                    >
                      View Order
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-6">
                <h4 className="text-sm font-bold text-stone-400 uppercase tracking-widest">Responses</h4>
                {Object.entries(isEditing ? editData?.answers || {} : selectedResponse.answers).map(([key, val]: any) => (
                  <div key={key} className="space-y-2">
                    <p className="text-sm font-medium text-stone-900">{key}</p>
                    {isEditing ? (
                      <textarea
                        value={val}
                        onChange={(e) => setEditData({
                          ...editData,
                          answers: { ...editData.answers, [key]: e.target.value }
                        })}
                        className="w-full bg-white border border-stone-200 rounded-2xl p-4 text-sm outline-none min-h-[100px] resize-none"
                      />
                    ) : (
                      <p className="text-stone-600 bg-stone-50 p-4 rounded-2xl text-sm">{val}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-stone-100 flex gap-3">
              <button 
                onClick={() => createActionItem(selectedResponse)}
                className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-bold text-sm hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Create Action Item
              </button>
              {selectedResponse.respondent?.email && (
                <a 
                  href={`mailto:${selectedResponse.respondent.email}?subject=Feedback regarding your order&body=Hi ${selectedResponse.respondent.name || 'there'}, thank you for your feedback...`}
                  className="flex-1 py-3 bg-white border border-stone-200 text-stone-900 rounded-xl font-bold text-sm hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Reply to Customer
                </a>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col p-8 overflow-y-auto">
            {!aiSummary ? (
              <div className="flex-1 flex flex-col items-center justify-center text-stone-400">
                <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                <p className="mb-8">Select a response to view details</p>
                
                <div className="w-full max-w-md bg-stone-50 rounded-3xl p-8 border border-stone-100 flex flex-col items-center text-center space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 mb-2">Overall Sentiment</h3>
                    <div className="flex items-end justify-center gap-2 mb-1">
                      <span className="text-4xl font-black text-stone-900">
                        {filteredResponses.filter(r => typeof r.score === 'number').length 
                          ? (filteredResponses.filter(r => typeof r.score === 'number').reduce((a, b) => a + b.score, 0) / filteredResponses.filter(r => typeof r.score === 'number').length).toFixed(1)
                          : "N/A"}
                      </span>
                      {filteredResponses.filter(r => typeof r.score === 'number').length > 0 && <span className="text-stone-400 font-bold mb-1">/ 5.0</span>}
                    </div>
                    <p className="text-[10px] text-stone-500 font-medium">Based on {filteredResponses.length} filtered responses</p>
                  </div>
                  
                  <div className="w-full space-y-4 pt-6 border-t border-stone-100">
                    <div className="text-left space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Analysis Focus</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Focus on pricing feedback, product quality..."
                          value={aiFocus}
                          onChange={e => setAiFocus(e.target.value)}
                          className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-stone-400 transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Summary Length</label>
                        <div className="flex gap-2">
                          {['short', 'medium', 'detailed'].map((l: any) => (
                            <button
                              key={l}
                              onClick={() => setAiLength(l)}
                              className={cn(
                                "flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all capitalize",
                                aiLength === l ? "bg-stone-900 border-stone-900 text-white" : "bg-white border-stone-200 text-stone-500 hover:border-stone-400"
                              )}
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={generateAIAssessment}
                      disabled={isAnalyzing || responses.length === 0 || business?.plan === 'free'}
                      className="w-full py-4 bg-amber-50 text-amber-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-amber-100 transition-colors disabled:opacity-50"
                    >
                      {isAnalyzing ? <div className="w-4 h-4 border-2 border-amber-600/20 border-t-amber-600 rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Generate Intelligence Report
                    </button>
                  </div>
                  {business?.plan === 'free' && <p className="text-[10px] uppercase tracking-widest text-stone-400 mt-2">Requires Pro Plan</p>}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
