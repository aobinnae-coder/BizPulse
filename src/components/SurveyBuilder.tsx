import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Eye, 
  Settings, 
  ChevronRight, 
  Star, 
  CheckCircle2, 
  Type, 
  List, 
  ToggleLeft,
  ArrowUpCircle,
  ArrowUpRight,
  QrCode,
  Copy,
  ExternalLink,
  Users,
  Sparkles,
  Wand2,
  Mail,
  Phone,
  Code,
  Send,
  X,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { GoogleGenAI } from '@google/genai';

import GeminiChat from './GeminiChat';
import UpgradeBanner from './UpgradeBanner';

const QUESTION_TYPES = [
  { id: 'star', label: 'Star Rating', icon: Star },
  { id: 'nps', label: 'NPS (0-10)', icon: ArrowUpCircle },
  { id: 'choice', label: 'Multiple Choice', icon: List },
  { id: 'text', label: 'Short Answer', icon: Type },
  { id: 'long_text', label: 'Long Text', icon: Type },
  { id: 'toggle', label: 'Yes/No Toggle', icon: ToggleLeft },
  { id: 'ranking', label: 'Ranking', icon: List },
];

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is not configured. Please add GEMINI_API_KEY to your secrets.");
  }
  return new GoogleGenAI({ apiKey });
}

export default function SurveyBuilder({ user, business, onViewResponses }: { user: any, business: any, onViewResponses?: (id: string) => void }) {
  const [surveys, setSurveys] = useState<any[]>([]);
  const [distributionLogs, setDistributionLogs] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [currentSurvey, setCurrentSurvey] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'build' | 'settings' | 'share'>('build');
  const [shareTab, setShareTab] = useState<'link' | 'email' | 'sms' | 'embed'>('link');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiGoal, setAiGoal] = useState('');
  const [aiBusinessType, setAiBusinessType] = useState(business?.industry || '');
  const [aiQuestionCount, setAiQuestionCount] = useState(5);
  const [previewQuestions, setPreviewQuestions] = useState<any[] | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [distributionMessages, setDistributionMessages] = useState({
    email: `Hi! We'd love to get your feedback on your recent experience. It only takes a minute!`,
    sms: `Could you spare a minute to give us some feedback?`
  });
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [iframeWidth, setIframeWidth] = useState('100%');
  const [iframeHeight, setIframeHeight] = useState('600px');
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>({});

  const validatePreview = () => {
    const errors: Record<string, string> = {};
    currentSurvey.questions.forEach((q: any) => {
      if (isQuestionVisible(q, previewAnswers) && q.required) {
        const answer = previewAnswers[q.id];
        if (answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
          errors[q.id] = 'This question is required';
        }
      }
    });
    setPreviewErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!business) return;
    const q = query(collection(db, 'customers'), where('businessId', '==', business.id));
    const unsubscribe = onSnapshot(q, (s) => {
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setCustomers(docs);
      setSelectedCustomerIds(new Set(docs.map((d: any) => d.id)));
    });

    const dQuery = query(collection(db, 'distributionLogs'), where('businessId', '==', business.id));
    const dUnsub = onSnapshot(dQuery, (s) => {
      setDistributionLogs(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribe();
      dUnsub();
    }
  }, [business]);

  const handleSendDistribution = async (type: 'email' | 'sms') => {
    if (!currentSurvey || customers.length === 0 || selectedCustomerIds.size === 0) return;
    setIsSending(true);
    
    try {
      const selectedCustomers = customers.filter(c => selectedCustomerIds.has(c.id));
      
      // Process distribution to each selected customer
      const batch = selectedCustomers.map(async (customer) => {
        let status = 'failed';
        if (type === 'email' && customer.email) {
          const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email);
          if (!isValidEmail) {
            status = 'invalid_email';
          } else {
            const body = distributionMessages.email + `\n\nLink: https://bizcompana.com?survey=${currentSurvey.id}`;
            
            try {
              const result = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: customer.email,
                  subject: `Feedback Request from ${business.name}`,
                  text: body
                })
              });
              if (result.ok) status = 'delivered';
            } catch (e) {
              console.error('Failed to send email:', e);
            }
          }
        } else if (type === 'sms' && customer.phone) {
          const isValidPhone = /^\+?[\d\s-]{10,}$/.test(customer.phone);
          if (!isValidPhone) {
            status = 'invalid_phone';
          } else {
            const body = distributionMessages.sms + ` https://bizcompana.com?survey=${currentSurvey.id}`;
            try {
              const result = await fetch('/api/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: customer.phone,
                  body: body
                })
              });
              if (result.ok) status = 'delivered';
            } catch (e) {
              console.error('Failed to send SMS:', e);
            }
          }
        }

        // Log the distribution attempt
        await addDoc(collection(db, 'distributionLogs'), {
          surveyId: currentSurvey.id,
          businessId: business.id,
          customerId: customer.id,
          type,
          status,
          contactMethod: type === 'email' ? customer.email : customer.phone,
          sentAt: new Date().toISOString()
        });
      });

      await Promise.all(batch);
      
      // Update survey last distributed date
      await updateDoc(doc(db, 'surveys', currentSurvey.id), {
        lastDistributed: new Date().toISOString()
      });

      // Create a notification for the business owner
      await addDoc(collection(db, 'notifications'), {
        businessId: business.id,
        ownerUid: user.uid,
        type: 'survey',
        title: 'Survey Distributed',
        message: `Survey "${currentSurvey.title}" has been sent to ${selectedCustomers.length} customers via ${type.toUpperCase()}.`,
        createdAt: new Date().toISOString(),
        read: false
      });

      alert(`Successfully sent to ${selectedCustomers.length} customers!`);
    } catch (error) {
      console.error("Error distributing survey:", error);
      alert("Failed to distribute survey. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const generateAIQuestions = async () => {
    if (!aiGoal || !aiBusinessType || isGenerating) return;
    setIsGenerating(true);
    try {
      const ai = getGenAI();
      const prompt = `You are an expert survey designer and customer experience consultant. 
      Generate ${aiQuestionCount} highly effective, non-redundant survey questions for a business of type "${aiBusinessType}" named "${business?.name}".
      
      The specific strategic goal for this survey is: "${aiGoal}".
      
      Requirements:
      - Mix question types appropriately to get the best data:
        * "star": for general satisfaction (1-5)
        * "nps": for loyalty/recommendation (0-10)
        * "choice": for categorical feedback (provide 3-5 distinct options)
        * "text": for short specific feedback
        * "long_text": for open-ended qualitative insights
        * "toggle": for binary yes/no questions
        * "ranking": for prioritizing options (provide 3-5 options to rank)
      - Ensure questions are unbiased, professional, and easy for customers to understand.
      - If the goal is about service, include a specific question about staff interaction.
      - If the goal is about product, include a question about quality, value, or specific features.
      - For "choice" and "ranking" questions, ensure the options are mutually exclusive and collectively exhaustive.
      
      Return ONLY a JSON array of objects with these fields:
      - label: The question text
      - type: "star", "choice", "text", "long_text", "nps", "toggle", or "ranking"
      - options: array of strings (required for "choice" and "ranking", empty for others)
      - required: boolean (default true)
      - placeholder: string (optional, for text/long_text types)`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      
      const cleanedText = text.replace(/```json|```/g, '').trim();
      const generatedQuestions = JSON.parse(cleanedText).map((q: any) => ({
        ...q,
        id: Math.random().toString(36).substr(2, 9),
        required: true,
        options: q.options || []
      }));

      setPreviewQuestions(generatedQuestions);
      setAiGoal('');
    } catch (error) {
      console.error("AI Generation failed", error);
      alert("Failed to generate questions. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const addPreviewQuestions = () => {
    if (!previewQuestions) return;
    setCurrentSurvey({
      ...currentSurvey,
      questions: [...currentSurvey.questions, ...previewQuestions]
    });
    setPreviewQuestions(null);
  };

  useEffect(() => {
    if (!business) return;
    const q = query(collection(db, 'surveys'), where('businessId', '==', business.id));
    const unsubscribe = onSnapshot(q, (s) => {
      setSurveys(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [business]);

  const handleCreateNew = () => {
    setShowTemplates(true);
  };

  const startWithTemplate = (template: any) => {
    setCurrentSurvey({
      title: template.title || 'New Survey',
      description: template.description || 'Please let us know how we did.',
      questions: template.questions || [],
      settings: {
        requireContact: false,
        active: true,
        responseLimit: null
      }
    });
    setShowTemplates(false);
    setIsCreating(true);
    setActiveTab('build');
  };

  const PREBUILT_TEMPLATES = [
    {
      id: 'blank',
      title: 'Blank Survey',
      description: 'Start from scratch.',
      questions: []
    },
    {
      id: 'csat',
      title: 'Customer Satisfaction',
      description: 'Measure how satisfied customers are with your product or service.',
      questions: [
        { id: 'q1', type: 'star', label: 'How would you rate your overall experience?', required: true },
        { id: 'q2', type: 'long_text', label: 'What could we do better?', required: false }
      ]
    },
    {
      id: 'product_launch',
      title: 'Product Launch Feedback',
      description: 'Gather insights on a newly launched product.',
      questions: [
        { id: 'q1', type: 'choice', label: 'How did you hear about our new product?', options: ['Email', 'Social Media', 'Friend', 'Other'], required: true },
        { id: 'q2', type: 'star', label: 'How satisfied are you with the new features?', required: true },
        { id: 'q3', type: 'long_text', label: 'What feature should we build next?', required: false }
      ]
    },
    {
      id: 'employee_onboarding',
      title: 'Employee Onboarding',
      description: 'Check in with new hires after their first week.',
      questions: [
        { id: 'q1', type: 'nps', label: 'How likely are you to recommend our company as a place to work?', required: true },
        { id: 'q2', type: 'toggle', label: 'Do you feel you have the tools you need to succeed?', required: true },
        { id: 'q3', type: 'long_text', label: 'What was the best part of your onboarding?', required: false }
      ]
    },
    {
      id: 'market_research',
      title: 'Market Research',
      description: 'Understand your target audience and their preferences.',
      questions: [
        { id: 'q1', type: 'choice', label: 'What is your primary goal when using a service like ours?', options: ['Save time', 'Save money', 'Improve quality', 'Other'], required: true },
        { id: 'q2', type: 'choice', label: 'How often do you use similar services?', options: ['Daily', 'Weekly', 'Monthly', 'Rarely'], required: true },
        { id: 'q3', type: 'long_text', label: 'What is one thing missing from current solutions?', required: false }
      ]
    },
    {
      id: 'website_feedback',
      title: 'Website Experience',
      description: 'Get feedback on your website design and usability.',
      questions: [
        { id: 'q1', type: 'star', label: 'How easy was it to navigate our website?', required: true },
        { id: 'q2', type: 'toggle', label: 'Did you find what you were looking for?', required: true },
        { id: 'q3', type: 'long_text', label: 'Any suggestions for improving our site?', required: false }
      ]
    }
  ];

  const handleSave = async () => {
    if (!currentSurvey.title) return;
    
    const surveyData = {
      ...currentSurvey,
      businessId: business.id,
      ownerUid: user.uid,
      createdAt: currentSurvey.id ? currentSurvey.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      if (currentSurvey.id) {
        await updateDoc(doc(db, 'surveys', currentSurvey.id), surveyData);
      } else {
        await addDoc(collection(db, 'surveys'), surveyData);
      }
      setIsCreating(false);
      setCurrentSurvey(null);
    } catch (error) {
      console.error("Save failed", error);
    }
  };

  const addQuestion = (type: string) => {
    const newQuestion = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      label: 'New Question',
      required: true,
      options: (type === 'choice' || type === 'ranking') ? ['Option 1', 'Option 2', 'Option 3'] : []
    };
    setCurrentSurvey({
      ...currentSurvey,
      questions: [...currentSurvey.questions, newQuestion]
    });
  };

  const updateQuestion = (id: string, updates: any) => {
    setCurrentSurvey({
      ...currentSurvey,
      questions: currentSurvey.questions.map((q: any) => q.id === id ? { ...q, ...updates } : q)
    });
  };

  const removeQuestion = (id: string) => {
    setCurrentSurvey({
      ...currentSurvey,
      questions: currentSurvey.questions.filter((q: any) => q.id !== id)
    });
  };

  const isQuestionVisible = (q: any, answers: Record<string, any>) => {
    if (!q.logic || !q.logic.dependsOnId) return true;
    const dependentAnswer = answers[q.logic.dependsOnId];
    if (dependentAnswer === undefined) return false;
    
    const condition = q.logic.condition || 'equals';
    const targetValue = String(q.logic.value).toLowerCase();
    const actualValue = String(dependentAnswer).toLowerCase();

    switch (condition) {
      case 'not_equals':
        return actualValue !== targetValue;
      case 'greater_than':
        return Number(actualValue) > Number(targetValue);
      case 'less_than':
        return Number(actualValue) < Number(targetValue);
      case 'contains':
        return actualValue.includes(targetValue);
      case 'equals':
      default:
        return actualValue === targetValue;
    }
  };

  if (isCreating) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsCreating(false)} className="text-stone-500 hover:text-stone-900">
              <ChevronRight className="w-6 h-6 rotate-180" />
            </button>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-stone-900">{currentSurvey.title || (currentSurvey.id ? 'Edit Survey' : 'Create Survey')}</h1>
              {currentSurvey.id && onViewResponses && (
                <button 
                  onClick={() => onViewResponses(currentSurvey.id)}
                  className="px-3 py-1.5 bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  View Responses <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowPreview(true)}
              className="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button 
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 bg-white border border-stone-200 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors"
            >
              Save Survey
            </button>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar Tabs */}
          <div className="w-64 space-y-2">
            <button 
              onClick={() => setActiveTab('build')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                activeTab === 'build' ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100"
              )}
            >
              <Plus className="w-5 h-5" />
              Build Questions
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                activeTab === 'settings' ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100"
              )}
            >
              <Settings className="w-5 h-5" />
              Survey Settings
            </button>
            {currentSurvey.id && (
              <button 
                onClick={() => setActiveTab('share')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                  activeTab === 'share' ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100"
                )}
              >
                <QrCode className="w-5 h-5" />
                Share & Distribute
              </button>
            )}
          </div>

          {/* Main Editor Area */}
          <div className="flex-1 max-w-3xl">
            {activeTab === 'build' && (
              <div className="space-y-6">
                <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-4">
                  <input 
                    type="text" 
                    value={currentSurvey.title}
                    onChange={(e) => setCurrentSurvey({ ...currentSurvey, title: e.target.value })}
                    placeholder="Survey Title"
                    className="w-full text-3xl font-bold text-stone-900 border-none p-0 focus:ring-0 placeholder:text-stone-200"
                  />
                  <textarea 
                    value={currentSurvey.description}
                    onChange={(e) => setCurrentSurvey({ ...currentSurvey, description: e.target.value })}
                    placeholder="Add a description..."
                    className="w-full text-stone-500 border-none p-0 focus:ring-0 placeholder:text-stone-200 resize-none"
                    rows={2}
                  />
                </div>

                <div className="bg-stone-900 p-8 rounded-[40px] text-white space-y-6 relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      <h3 className="text-lg font-bold">AI Survey Assistant</h3>
                    </div>
                    <p className="text-stone-400 text-sm mb-6">Describe your business type and what you want to learn, and I'll generate the questions for you.</p>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Business Type</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Italian Restaurant, Yoga Studio"
                            value={aiBusinessType}
                            onChange={e => setAiBusinessType(e.target.value)}
                            className="w-full bg-white/10 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/20 transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Feedback Goal</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Improve service speed..."
                            value={aiGoal}
                            onChange={e => setAiGoal(e.target.value)}
                            className="w-full bg-white/10 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/20 transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Number of Questions</label>
                          <select 
                            value={aiQuestionCount}
                            onChange={e => setAiQuestionCount(parseInt(e.target.value))}
                            className="w-full bg-white/10 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/20 transition-all text-white"
                          >
                            {[3, 5, 7, 10].map(n => (
                              <option key={n} value={n} className="bg-stone-900">{n} Questions</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button 
                        onClick={generateAIQuestions}
                        disabled={isGenerating || !aiGoal || business?.plan === 'free'}
                        className="w-full py-4 bg-white text-stone-900 rounded-2xl font-bold text-sm hover:bg-stone-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isGenerating ? <div className="w-4 h-4 border-2 border-stone-900/20 border-t-stone-900 rounded-full animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        {business?.plan === 'free' ? 'Upgrade to Pro for AI' : 'Generate Questions'}
                      </button>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 blur-[100px] rounded-full -mr-32 -mt-32" />
                </div>

                {/* AI Feature Gating Banner */}
                {business?.plan === 'free' && (
                  <UpgradeBanner 
                    title="Unlock AI Survey Builder"
                    description="Get smarter questions generated specifically for your business goals. Upgrade to Pro for unlimited AI generation."
                  />
                )}

                {/* AI Preview Section */}
                {previewQuestions && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-amber-50 rounded-3xl border border-amber-100 overflow-hidden"
                  >
                    <div className="p-6 border-b border-amber-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <h4 className="font-bold text-amber-900">Review AI Questions</h4>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setPreviewQuestions(null)}
                          className="px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-100 rounded-lg"
                        >
                          Discard
                        </button>
                        <button 
                          onClick={addPreviewQuestions}
                          className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 shadow-sm"
                        >
                          Add All to Survey
                        </button>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      {previewQuestions.map((q, idx) => (
                        <div key={q.id} className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <input 
                              type="text"
                              value={q.label}
                              onChange={(e) => {
                                const newPrev = [...previewQuestions];
                                newPrev[idx].label = e.target.value;
                                setPreviewQuestions(newPrev);
                              }}
                              className="flex-1 text-sm font-bold text-stone-900 border-none p-0 focus:ring-0 bg-transparent"
                            />
                            <button 
                              onClick={() => setPreviewQuestions(previewQuestions.filter((_, i) => i !== idx))}
                              className="text-amber-300 hover:text-amber-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <select 
                              value={q.type}
                              onChange={(e) => {
                                const newPrev = [...previewQuestions];
                                newPrev[idx].type = e.target.value;
                                setPreviewQuestions(newPrev);
                              }}
                              className="bg-stone-100 border-none rounded-lg py-1 px-2 text-[10px] font-bold text-stone-600 outline-none uppercase tracking-wider"
                            >
                              {QUESTION_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                <div className="space-y-4">
                  {currentSurvey.questions.map((q: any, index: number) => (
                    <motion.div 
                      key={q.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-2 text-stone-300">
                          <GripVertical className="w-5 h-5" />
                        </div>
                        <div className="flex-1 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Question {index + 1}</span>
                            <button onClick={() => removeQuestion(q.id)} className="text-stone-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <input 
                            type="text"
                            value={q.label}
                            onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                            className="w-full text-lg font-medium text-stone-900 border-none p-0 focus:ring-0"
                            placeholder="Enter your question here..."
                          />
                          
                          {(q.type === 'text' || q.type === 'long_text') && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Placeholder Text</label>
                              <input 
                                type="text"
                                value={q.placeholder || ''}
                                onChange={(e) => updateQuestion(q.id, { placeholder: e.target.value })}
                                className="w-full bg-stone-50 border border-stone-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                                placeholder="e.g. Type your answer here..."
                              />
                            </div>
                          )}
                          
                          {q.type === 'choice' && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Options</label>
                              {q.options.map((opt: string, i: number) => (
                                <div key={i} className="flex items-center gap-2">
                                  <div className="w-4 h-4 rounded-full border border-stone-300" />
                                  <input 
                                    type="text"
                                    value={opt}
                                    onChange={(e) => {
                                      const newOpts = [...q.options];
                                      newOpts[i] = e.target.value;
                                      updateQuestion(q.id, { options: newOpts });
                                    }}
                                    className="flex-1 text-sm text-stone-600 border-none p-0 focus:ring-0"
                                    placeholder={`Option ${i + 1}`}
                                  />
                                  <button 
                                    onClick={() => {
                                      const newOpts = q.options.filter((_: any, idx: number) => idx !== i);
                                      updateQuestion(q.id, { options: newOpts });
                                    }}
                                    className="text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              <button 
                                onClick={() => updateQuestion(q.id, { options: [...q.options, ''] })}
                                className="text-sm text-stone-400 hover:text-stone-600 flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" /> Add Option
                              </button>
                            </div>
                          )}

                          {q.type === 'ranking' && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Options to Rank</label>
                              {q.options.map((opt: string, i: number) => (
                                <div key={i} className="flex items-center gap-2">
                                  <div className="text-stone-300">
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                  <input 
                                    type="text"
                                    value={opt}
                                    onChange={(e) => {
                                      const newOpts = [...q.options];
                                      newOpts[i] = e.target.value;
                                      updateQuestion(q.id, { options: newOpts });
                                    }}
                                    className="flex-1 text-sm text-stone-600 border-none p-0 focus:ring-0"
                                    placeholder={`Option ${i + 1}`}
                                  />
                                  <button 
                                    onClick={() => {
                                      const newOpts = q.options.filter((_: any, idx: number) => idx !== i);
                                      updateQuestion(q.id, { options: newOpts });
                                    }}
                                    className="text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              <button 
                                onClick={() => updateQuestion(q.id, { options: [...q.options, ''] })}
                                className="text-sm text-stone-400 hover:text-stone-600 flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" /> Add Option
                              </button>
                            </div>
                          )}

                          {q.type === 'nps' && (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Low Label (0)</label>
                                <input 
                                  type="text"
                                  value={q.lowLabel || 'Not Likely'}
                                  onChange={(e) => updateQuestion(q.id, { lowLabel: e.target.value })}
                                  className="w-full bg-stone-50 border border-stone-100 rounded-xl px-4 py-2 text-sm outline-none"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">High Label (10)</label>
                                <input 
                                  type="text"
                                  value={q.highLabel || 'Extremely Likely'}
                                  onChange={(e) => updateQuestion(q.id, { highLabel: e.target.value })}
                                  className="w-full bg-stone-50 border border-stone-100 rounded-xl px-4 py-2 text-sm outline-none"
                                />
                              </div>
                            </div>
                          )}

                          {q.type === 'star' && (
                            <div className="flex gap-2">
                              {[1,2,3,4,5].map(n => <Star key={n} className="w-6 h-6 text-stone-200" />)}
                            </div>
                          )}

                          {q.type === 'nps' && (
                            <div className="flex gap-1">
                              {Array.from({ length: 11 }).map((_, i) => (
                                <div key={i} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-xs text-stone-400">
                                  {i}
                                </div>
                              ))}
                            </div>
                          )}

                          {q.type === 'toggle' && (
                            <div className="flex gap-2">
                              {['Yes', 'No'].map(opt => (
                                <div key={opt} className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-400">
                                  {opt}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Conditional Logic UI */}
                          <div className="pt-4 border-t border-stone-100 mt-4">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest bg-stone-100 flex items-center gap-1.5 px-2 py-1 rounded w-fit">
                                <Settings className="w-3 h-3" /> Conditional Logic
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm bg-stone-50 p-3 rounded-xl border border-stone-100">
                              <span className="text-stone-500 font-medium">Show this question if</span>
                              <select 
                                value={q.logic?.dependsOnId || ''}
                                onChange={(e) => {
                                  const dependsOnId = e.target.value;
                                  if (!dependsOnId) {
                                    const { logic, ...rest } = q;
                                    updateQuestion(q.id, rest);
                                  } else {
                                    updateQuestion(q.id, { logic: { ...q.logic, dependsOnId, condition: 'equals', value: '' } });
                                  }
                                }}
                                className="bg-white border border-stone-200 rounded-lg py-1.5 px-3 text-xs font-bold text-stone-700 outline-none focus:ring-2 focus:ring-stone-900 flex-1 min-w-[200px]"
                              >
                                <option value="">Always show (No conditions)</option>
                                {currentSurvey.questions.slice(0, currentSurvey.questions.findIndex((tq: any) => tq.id === q.id)).map((prevQ: any) => (
                                  <option key={prevQ.id} value={prevQ.id}>Q: {prevQ.label || 'Untitled Question'}</option>
                                ))}
                              </select>
                              
                              {q.logic?.dependsOnId && (
                                <>
                                  <select
                                    value={q.logic.condition || 'equals'}
                                    onChange={(e) => updateQuestion(q.id, { logic: { ...q.logic, condition: e.target.value } })}
                                    className="bg-white border border-stone-200 rounded-lg py-1.5 px-3 text-xs font-bold text-stone-700 outline-none focus:ring-2 focus:ring-stone-900"
                                  >
                                    <option value="equals">is exactly</option>
                                    <option value="not_equals">is not</option>
                                    <option value="greater_than">is greater than</option>
                                    <option value="less_than">is less than</option>
                                    <option value="contains">contains</option>
                                  </select>
                                  
                                  {/* Dynamic Input based on target question type */}
                                  {(() => {
                                    const targetQuestion = currentSurvey.questions.find((tq: any) => tq.id === q.logic?.dependsOnId);
                                    if (targetQuestion?.type === 'choice' || targetQuestion?.type === 'ranking') {
                                      return (
                                        <select
                                          value={q.logic.value || ''}
                                          onChange={(e) => updateQuestion(q.id, { logic: { ...q.logic, value: e.target.value } })}
                                          className="bg-white border border-stone-200 rounded-lg py-1.5 px-3 text-xs font-bold text-stone-700 outline-none focus:ring-2 focus:ring-stone-900 min-w-[150px]"
                                        >
                                          <option value="">Select option...</option>
                                          {(targetQuestion.options || []).map((opt: string, i: number) => (
                                            <option key={i} value={opt}>{opt}</option>
                                          ))}
                                        </select>
                                      );
                                    }
                                    if (targetQuestion?.type === 'toggle') {
                                      return (
                                        <select
                                          value={q.logic.value || ''}
                                          onChange={(e) => updateQuestion(q.id, { logic: { ...q.logic, value: e.target.value } })}
                                          className="bg-white border border-stone-200 rounded-lg py-1.5 px-3 text-xs font-bold text-stone-700 outline-none focus:ring-2 focus:ring-stone-900"
                                        >
                                          <option value="">Select option...</option>
                                          <option value="Yes">Yes</option>
                                          <option value="No">No</option>
                                        </select>
                                      );
                                    }
                                    return (
                                      <input 
                                        type="text" 
                                        placeholder="Answer value..."
                                        value={q.logic.value || ''}
                                        onChange={(e) => updateQuestion(q.id, { logic: { ...q.logic, value: e.target.value } })}
                                        className="bg-white border border-stone-200 rounded-lg py-1.5 px-3 text-xs font-bold text-stone-700 outline-none focus:ring-2 focus:ring-stone-900 min-w-[150px]"
                                      />
                                    );
                                  })()}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {QUESTION_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => addQuestion(type.id)}
                      className="flex items-center gap-3 p-4 bg-white border border-stone-200 rounded-2xl text-sm font-medium text-stone-600 hover:border-stone-900 hover:text-stone-900 transition-all"
                    >
                      <type.icon className="w-5 h-5" />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-stone-900">Require Contact Info</h3>
                    <p className="text-sm text-stone-500">Ask for name and email before submitting.</p>
                  </div>
                  <button 
                    onClick={() => setCurrentSurvey({ ...currentSurvey, settings: { ...currentSurvey.settings, requireContact: !currentSurvey.settings.requireContact } })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      currentSurvey.settings.requireContact ? "bg-stone-900" : "bg-stone-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                      currentSurvey.settings.requireContact ? "translate-x-7" : "translate-x-1"
                    )} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-stone-900">Require Verification (OTP)</h3>
                    <p className="text-sm text-stone-500">Only valid verified numbers/emails can submit responses.</p>
                  </div>
                  <button 
                    disabled={!currentSurvey.settings.requireContact}
                    onClick={() => setCurrentSurvey({ ...currentSurvey, settings: { ...currentSurvey.settings, requireVerification: !currentSurvey.settings.requireVerification } })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      currentSurvey.settings.requireContact ? (currentSurvey.settings.requireVerification ? "bg-stone-900" : "bg-stone-200") : "bg-stone-100 opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                      currentSurvey.settings.requireVerification && currentSurvey.settings.requireContact ? "translate-x-7" : "translate-x-1"
                    )} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-stone-900">Accepting Responses</h3>
                    <p className="text-sm text-stone-500">Toggle whether this survey is currently active.</p>
                  </div>
                  <button 
                    onClick={() => setCurrentSurvey({ ...currentSurvey, settings: { ...currentSurvey.settings, active: !currentSurvey.settings.active } })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      currentSurvey.settings.active ? "bg-stone-900" : "bg-stone-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                      currentSurvey.settings.active ? "translate-x-7" : "translate-x-1"
                    )} />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'share' && (
              <div className="space-y-6">
                <div className="flex gap-2 p-1 bg-stone-100 rounded-2xl w-fit">
                  {(['link', 'email', 'sms', 'embed'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setShareTab(tab)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                        shareTab === tab ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {shareTab === 'link' && (
                  <div className="space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
                      <h3 className="text-lg font-bold text-stone-900 mb-4">Shareable Link</h3>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input 
                          type="text" 
                          readOnly 
                          value={`https://bizcompana.com?survey=${currentSurvey.id}`}
                          className="flex-1 bg-stone-50 border-stone-200 rounded-xl px-4 py-2 text-sm text-stone-600 outline-none min-w-0"
                        />
                        <div className="flex gap-2 shrink-0">
                          <a 
                            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(`https://bizcompana.com?survey=${currentSurvey.id}`)}&text=${encodeURIComponent(`Take our survey: ${currentSurvey.title}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-[#1DA1F2] text-white rounded-xl hover:bg-[#1DA1F2]/90 flex items-center gap-2 transition-colors text-xs font-bold"
                            title="Share on Twitter"
                          >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                            Twitter
                          </a>
                          <a 
                            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://bizcompana.com?survey=${currentSurvey.id}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-[#1877F2] text-white rounded-xl hover:bg-[#1877F2]/90 flex items-center gap-2 transition-colors text-xs font-bold"
                            title="Share on Facebook"
                          >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                            Facebook
                          </a>
                          <button 
                            onClick={() => handleCopy(`https://bizcompana.com?survey=${currentSurvey.id}`)}
                            className={cn(
                              "flex-1 sm:flex-none px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold",
                              copied ? "bg-emerald-500 text-white" : "bg-stone-900 text-white hover:bg-stone-800"
                            )}
                          >
                            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? "Copied!" : "Copy Link"}
                          </button>
                          <a 
                            href={`https://bizcompana.com?survey=${currentSurvey.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 flex items-center justify-center"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm flex flex-col items-center">
                      <h3 className="text-lg font-bold text-stone-900 mb-6">QR Code</h3>
                      <div className="p-6 bg-white border-4 border-stone-900 rounded-3xl">
                        <QRCodeSVG 
                          value={`https://bizcompana.com?survey=${currentSurvey.id}`} 
                          size={200}
                          level="H"
                          includeMargin
                        />
                      </div>
                      <p className="mt-6 text-sm text-stone-500 text-center max-w-xs">
                        Download and print this QR code for your physical location or marketing materials.
                      </p>
                    </div>
                  </div>
                )}

                {shareTab === 'email' && (
                  <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-stone-900">Email Distribution</h3>
                      <p className="text-sm text-stone-500">Send this survey to your customer list via email.</p>
                    </div>
                    <div className="space-y-4">
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Select Customers</label>
                          <button 
                            onClick={() => {
                              if (selectedCustomerIds.size === customers.length) setSelectedCustomerIds(new Set());
                              else setSelectedCustomerIds(new Set(customers.map(c => c.id)));
                            }}
                            className="text-[10px] font-bold text-stone-900 uppercase tracking-widest hover:underline"
                          >
                            {selectedCustomerIds.size === customers.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto border border-stone-100 rounded-2xl bg-stone-50 p-2 space-y-1">
                          {customers.length === 0 && <p className="text-xs text-stone-500 p-2 text-center">No customers found in directory.</p>}
                          {customers.map((c) => {
                            const dl = distributionLogs.find(l => l.surveyId === currentSurvey.id && l.customerId === c.id && l.type === 'email');
                            return (
                            <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-xl cursor-pointer transition-colors border border-transparent hover:border-stone-100">
                              <input 
                                type="checkbox"
                                checked={selectedCustomerIds.has(c.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedCustomerIds);
                                  if (e.target.checked) newSet.add(c.id);
                                  else newSet.delete(c.id);
                                  setSelectedCustomerIds(newSet);
                                }}
                                className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-stone-900 truncate">{c.name}</p>
                                <p className="text-[10px] text-stone-500 truncate">{c.email || 'No email'}</p>
                              </div>
                              {dl && (
                                <div className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                  dl.status === 'delivered' ? "bg-emerald-50 text-emerald-600" :
                                  dl.status === 'sent' ? "bg-blue-50 text-blue-600" :
                                  dl.status?.startsWith('invalid') ? "bg-amber-50 text-amber-600" :
                                  "bg-red-50 text-red-600"
                                )}>
                                  {dl.status?.replace('_', ' ')}
                                </div>
                              )}
                            </label>
                          )})}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Email Message</label>
                        <textarea 
                          value={distributionMessages.email}
                          onChange={e => setDistributionMessages({...distributionMessages, email: e.target.value})}
                          className="w-full bg-stone-50 border border-stone-100 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-stone-900 min-h-[120px]"
                        />
                      </div>
                      <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Preview</p>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100">
                          <p className="text-sm text-stone-800 mb-4">{distributionMessages.email}</p>
                          <a 
                            href={`${window.location.origin}?survey=${currentSurvey.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-3 px-6 bg-stone-900 text-white rounded-lg text-xs font-bold w-fit inline-block"
                          >
                            Take Survey
                          </a>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleSendDistribution('email')}
                        disabled={isSending || customers.length === 0 || selectedCustomerIds.size === 0}
                        className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold text-sm hover:bg-stone-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isSending ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                        ) : (
                          <Mail className="w-4 h-4" />
                        )}
                        {customers.length === 0 ? 'No Customers to Send To' : selectedCustomerIds.size === 0 ? 'Select Customers to Send To' : `Send to ${selectedCustomerIds.size} Customers`}
                      </button>
                    </div>
                  </div>
                )}

                {shareTab === 'sms' && (
                  <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-stone-900">SMS Distribution</h3>
                      <p className="text-sm text-stone-500">Send a quick text message to your customers.</p>
                    </div>
                    <div className="space-y-4">
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Select Customers</label>
                          <button 
                            onClick={() => {
                              if (selectedCustomerIds.size === customers.length) setSelectedCustomerIds(new Set());
                              else setSelectedCustomerIds(new Set(customers.map(c => c.id)));
                            }}
                            className="text-[10px] font-bold text-stone-900 uppercase tracking-widest hover:underline"
                          >
                            {selectedCustomerIds.size === customers.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto border border-stone-100 rounded-2xl bg-stone-50 p-2 space-y-1">
                          {customers.length === 0 && <p className="text-xs text-stone-500 p-2 text-center">No customers found in directory.</p>}
                          {customers.map((c) => {
                            const dl = distributionLogs.find(l => l.surveyId === currentSurvey.id && l.customerId === c.id && l.type === 'sms');
                            return (
                            <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-xl cursor-pointer transition-colors border border-transparent hover:border-stone-100">
                              <input 
                                type="checkbox"
                                checked={selectedCustomerIds.has(c.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedCustomerIds);
                                  if (e.target.checked) newSet.add(c.id);
                                  else newSet.delete(c.id);
                                  setSelectedCustomerIds(newSet);
                                }}
                                className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-stone-900 truncate">{c.name}</p>
                                <p className="text-[10px] text-stone-500 truncate">{c.phone || 'No phone'}</p>
                              </div>
                              {dl && (
                                <div className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                  dl.status === 'delivered' ? "bg-emerald-50 text-emerald-600" :
                                  dl.status === 'sent' ? "bg-blue-50 text-blue-600" :
                                  dl.status?.startsWith('invalid') ? "bg-amber-50 text-amber-600" :
                                  "bg-red-50 text-red-600"
                                )}>
                                  {dl.status?.replace('_', ' ')}
                                </div>
                              )}
                            </label>
                          )})}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">SMS Text</label>
                        <textarea 
                          value={distributionMessages.sms}
                          onChange={e => setDistributionMessages({...distributionMessages, sms: e.target.value})}
                          className="w-full bg-stone-50 border border-stone-100 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-stone-900 min-h-[80px]"
                        />
                      </div>
                      <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Preview</p>
                        <div className="bg-stone-900 text-white p-3 rounded-2xl rounded-bl-none max-w-[80%]">
                          <p className="text-xs">{distributionMessages.sms} https://bizcompana.com?survey={currentSurvey.id}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleSendDistribution('sms')}
                        disabled={isSending || customers.length === 0 || selectedCustomerIds.size === 0}
                        className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold text-sm hover:bg-stone-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isSending ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                        ) : (
                          <Phone className="w-4 h-4" />
                        )}
                        {customers.length === 0 ? 'No Customers to Send To' : selectedCustomerIds.size === 0 ? 'Select Customers to Send To' : `Send SMS to ${selectedCustomerIds.size} Customers`}
                      </button>
                    </div>
                  </div>
                )}

                {shareTab === 'embed' && (
                  <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-stone-900">Website Embed</h3>
                      <p className="text-sm text-stone-500">Embed this survey directly into your website or blog.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Width</label>
                          <input 
                            type="text" 
                            value={iframeWidth}
                            onChange={e => setIframeWidth(e.target.value)}
                            className="w-full bg-stone-50 border-none rounded-xl py-2 px-3 text-sm outline-none"
                            placeholder="100% or 800px"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Height</label>
                          <input 
                            type="text" 
                            value={iframeHeight}
                            onChange={e => setIframeHeight(e.target.value)}
                            className="w-full bg-stone-50 border-none rounded-xl py-2 px-3 text-sm outline-none"
                            placeholder="600px"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">IFrame Code</label>
                        <div className="relative">
                          <pre className="w-full bg-stone-900 text-stone-300 rounded-2xl p-4 text-[10px] font-mono overflow-x-auto">
                            {`<iframe \n  src="https://bizcompana.com?survey=${currentSurvey.id}" \n  width="${iframeWidth}" \n  height="${iframeHeight}" \n  frameborder="0"\n></iframe>`}
                          </pre>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(`<iframe src="https://bizcompana.com?survey=${currentSurvey.id}" width="${iframeWidth}" height="${iframeHeight}" frameborder="0"></iframe>`);
                            }}
                            className="absolute top-2 right-2 p-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="p-6 bg-stone-50 rounded-3xl border border-stone-100">
                        <h4 className="text-xs font-bold text-stone-900 mb-2">How to use:</h4>
                        <ul className="text-xs text-stone-500 space-y-2 list-disc pl-4">
                          <li>Copy the code snippet above.</li>
                          <li>Paste it into the HTML of your website where you want the survey to appear.</li>
                          <li>The survey will automatically resize to fit your website's layout.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {showPreview && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl h-[80vh] rounded-[32px] shadow-2xl border border-stone-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-stone-400" />
                <h3 className="font-bold text-stone-900">Survey Preview</h3>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-stone-200 rounded-xl transition-colors">
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-stone-50 p-8">
              <div className="max-w-xl mx-auto bg-white p-8 rounded-[40px] shadow-sm border border-stone-100">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-stone-900 mb-2">{currentSurvey.title || 'Untitled Survey'}</h1>
                  {currentSurvey.description && <p className="text-stone-500">{currentSurvey.description}</p>}
                </div>
                
                {currentSurvey.settings?.requireContact && (
                  <div className="space-y-4 mb-8 p-6 bg-stone-50 rounded-3xl border border-stone-100">
                    <h3 className="font-bold text-stone-900 mb-4">Contact Information</h3>
                    <input type="text" placeholder="Your Name" className="w-full bg-white border border-stone-200 rounded-2xl px-4 py-3 text-sm outline-none" />
                    <input type="email" placeholder="Your Email" className="w-full bg-white border border-stone-200 rounded-2xl px-4 py-3 text-sm outline-none" />
                  </div>
                )}

                <div className="space-y-8">
                  {currentSurvey.questions.map((q: any, idx: number) => {
                    const visible = isQuestionVisible(q, previewAnswers);
                    if (!visible) return null;

                    return (
                      <motion.div 
                        key={q.id} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3"
                      >
                        <label className="block font-bold text-stone-900">
                          {q.label || 'Untitled Question'} {q.required && <span className="text-red-500">*</span>}
                        </label>
                        
                        {previewErrors[q.id] && (
                          <p className="text-xs text-red-500 font-medium">{previewErrors[q.id]}</p>
                        )}
                        
                        {q.type === 'text' && (
                          <input 
                            type="text" 
                            placeholder={q.placeholder || "Your answer"} 
                            className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-stone-900 transition-all"
                            onChange={(e) => setPreviewAnswers({ ...previewAnswers, [q.id]: e.target.value })}
                          />
                        )}
                        
                        {q.type === 'long_text' && (
                          <textarea 
                            placeholder={q.placeholder || "Your answer"} 
                            className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-4 py-3 text-sm outline-none min-h-[100px] resize-none focus:ring-2 focus:ring-stone-900 transition-all"
                            onChange={(e) => setPreviewAnswers({ ...previewAnswers, [q.id]: e.target.value })}
                          />
                        )}
                        
                        {q.type === 'star' && (
                          <div className="flex gap-2">
                            {[1,2,3,4,5].map(n => (
                              <button 
                                key={n}
                                onClick={() => setPreviewAnswers({ ...previewAnswers, [q.id]: n })}
                                className="transition-transform hover:scale-110"
                              >
                                <Star 
                                  className={cn(
                                    "w-8 h-8 transition-colors",
                                    (previewAnswers[q.id] || 0) >= n ? "text-amber-400 fill-amber-400" : "text-stone-200"
                                  )} 
                                />
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {q.type === 'nps' && (
                          <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                              {Array.from({ length: 11 }).map((_, i) => (
                                <button 
                                  key={i} 
                                  onClick={() => setPreviewAnswers({ ...previewAnswers, [q.id]: i })}
                                  className={cn(
                                    "w-10 h-10 rounded-xl border font-bold transition-all",
                                    previewAnswers[q.id] === i 
                                      ? "bg-stone-900 text-white border-stone-900 shadow-lg scale-110" 
                                      : "bg-stone-50 text-stone-400 border-stone-200 hover:border-stone-400"
                                  )}
                                >
                                  {i}
                                </button>
                              ))}
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                              <span>{q.lowLabel || 'Not Likely'}</span>
                              <span>{q.highLabel || 'Extremely Likely'}</span>
                            </div>
                          </div>
                        )}
                        
                        {q.type === 'choice' && (
                          <div className="space-y-2">
                            {q.options?.map((opt: string, i: number) => (
                              <button 
                                key={i} 
                                onClick={() => setPreviewAnswers({ ...previewAnswers, [q.id]: opt })}
                                className={cn(
                                  "w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left",
                                  previewAnswers[q.id] === opt
                                    ? "bg-stone-900 text-white border-stone-900 shadow-md"
                                    : "bg-stone-50 border-stone-100 text-stone-600 hover:border-stone-300"
                                )}
                              >
                                <div className={cn(
                                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                  previewAnswers[q.id] === opt ? "border-white" : "border-stone-300"
                                )}>
                                  {previewAnswers[q.id] === opt && <div className="w-2 h-2 bg-white rounded-full" />}
                                </div>
                                <span className="text-sm font-medium">{opt}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {q.type === 'toggle' && (
                          <div className="flex gap-3">
                            {['Yes', 'No'].map(opt => (
                              <button
                                key={opt}
                                onClick={() => {
                                  setPreviewAnswers({ ...previewAnswers, [q.id]: opt });
                                  if (previewErrors[q.id]) {
                                    const newErrors = { ...previewErrors };
                                    delete newErrors[q.id];
                                    setPreviewErrors(newErrors);
                                  }
                                }}
                                className={cn(
                                  "flex-1 py-3 rounded-2xl border font-bold text-sm transition-all",
                                  previewAnswers[q.id] === opt
                                    ? "bg-stone-900 text-white border-stone-900 shadow-md"
                                    : "bg-stone-50 border-stone-100 text-stone-500 hover:border-stone-300"
                                )}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}

                        {q.type === 'ranking' && (
                          <div className="space-y-2">
                            {(previewAnswers[q.id] || q.options || []).map((opt: string, i: number) => (
                              <div 
                                key={i}
                                className="flex items-center gap-3 p-4 bg-stone-50 border border-stone-100 rounded-2xl"
                              >
                                <span className="w-6 h-6 rounded-full bg-stone-900 text-white text-[10px] flex items-center justify-center font-bold">
                                  {i + 1}
                                </span>
                                <span className="flex-1 text-sm font-medium text-stone-700">{opt}</span>
                                <div className="flex gap-1">
                                  <button 
                                    disabled={i === 0}
                                    onClick={() => {
                                      const currentOrder = previewAnswers[q.id] || [...q.options];
                                      const newOrder = [...currentOrder];
                                      [newOrder[i-1], newOrder[i]] = [newOrder[i], newOrder[i-1]];
                                      setPreviewAnswers({ ...previewAnswers, [q.id]: newOrder });
                                    }}
                                    className="p-1 text-stone-400 hover:text-stone-900 disabled:opacity-30"
                                  >
                                    <ChevronRight className="w-4 h-4 -rotate-90" />
                                  </button>
                                  <button 
                                    disabled={i === (previewAnswers[q.id] || q.options).length - 1}
                                    onClick={() => {
                                      const currentOrder = previewAnswers[q.id] || [...q.options];
                                      const newOrder = [...currentOrder];
                                      [newOrder[i+1], newOrder[i]] = [newOrder[i], newOrder[i+1]];
                                      setPreviewAnswers({ ...previewAnswers, [q.id]: newOrder });
                                    }}
                                    className="p-1 text-stone-400 hover:text-stone-900 disabled:opacity-30"
                                  >
                                    <ChevronRight className="w-4 h-4 rotate-90" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
                
                <button 
                  onClick={() => {
                    if (validatePreview()) {
                      alert("Survey submitted successfully (Preview Mode)!");
                      setShowPreview(false);
                      setPreviewAnswers({});
                      setPreviewErrors({});
                    }
                  }}
                  className="w-full mt-8 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg active:scale-[0.98]"
                >
                  Submit Feedback
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTemplates && (
        <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[32px] p-8 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-stone-900">Choose a Template</h2>
              <button onClick={() => setShowTemplates(false)} className="text-stone-400 hover:text-stone-900">
                <ChevronRight className="w-6 h-6 rotate-180" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PREBUILT_TEMPLATES.map(template => (
                <button 
                  key={template.id}
                  onClick={() => startWithTemplate(template)}
                  className="text-left p-6 rounded-3xl border border-stone-200 hover:border-stone-900 hover:shadow-md transition-all group"
                >
                  <h3 className="text-lg font-bold text-stone-900 mb-2 group-hover:text-stone-900">{template.title}</h3>
                  <p className="text-sm text-stone-500">{template.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Surveys</h1>
          <p className="text-stone-500">Manage and create your customer feedback forms.</p>
        </div>
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            placeholder="Search surveys..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 p-2 bg-stone-50 border border-stone-200 rounded-xl outline-none"
          />
          <button 
            onClick={handleCreateNew}
            className="whitespace-nowrap px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create New Survey
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {surveys.filter(s => (s.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (s.description || '').toLowerCase().includes(searchQuery.toLowerCase())).map((survey) => (
          <div key={survey.id} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:border-stone-400 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                survey.settings?.active ? "bg-emerald-50 text-emerald-600" : "bg-stone-100 text-stone-400"
              )}>
                {survey.settings?.active ? 'Active' : 'Draft'}
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => {
                    handleCopy(`${window.location.origin}?survey=${survey.id}`);
                  }}
                  className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-lg"
                  title="Copy Link"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    setCurrentSurvey(survey);
                    setIsCreating(true);
                    setActiveTab('share');
                  }}
                  className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-lg"
                  title="Share"
                >
                  <Send className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    setCurrentSurvey(survey);
                    setIsCreating(true);
                    setActiveTab('build');
                  }}
                  className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-lg"
                  title="Edit"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button 
                  onClick={async () => {
                    if (confirm('Are you sure you want to delete this survey?')) {
                      await deleteDoc(doc(db, 'surveys', survey.id));
                    }
                  }}
                  className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-stone-900">{survey.title}</h3>
              {onViewResponses && (
                <button 
                  onClick={() => onViewResponses(survey.id)}
                  className="text-[10px] font-bold text-stone-900 bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                >
                  <BarChart3 className="w-3 h-3" />
                  Responses
                </button>
              )}
            </div>
            <p className="text-sm text-stone-500 line-clamp-2 mb-6">{survey.description}</p>
            <div className="flex flex-col gap-2 pt-6 border-t border-stone-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-400">
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-medium">{survey.responseCount || 0} responses</span>
                </div>
              </div>
              {survey.lastDistributed && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                  <Send className="w-3 h-3" />
                  Last sent {new Date(survey.lastDistributed).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        ))}

        {surveys.length === 0 && (
          <button 
            onClick={handleCreateNew}
            className="col-span-full h-64 border-2 border-dashed border-stone-200 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-stone-400 hover:bg-stone-50 transition-all"
          >
            <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center">
              <Plus className="text-stone-400 w-6 h-6" />
            </div>
            <div className="text-center">
              <p className="text-stone-900 font-bold">Create your first survey</p>
              <p className="text-stone-400 text-sm">Start gathering feedback from your customers</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
