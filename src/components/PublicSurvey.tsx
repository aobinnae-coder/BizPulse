import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, addDoc, collection, updateDoc, increment } from 'firebase/firestore';
import { updateOrCreateCustomer } from '../lib/customers';
import { createNotification } from '../lib/notifications';
import { Star, CheckCircle2, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export default function PublicSurvey({ surveyId }: { surveyId: string }) {
  const [survey, setSurvey] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [contact, setContact] = useState({ name: '', email: '' });
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOrderId(params.get('order'));
    
    const fetchSurvey = async () => {
      try {
        const surveyDoc = await getDoc(doc(db, 'surveys', surveyId));
        if (surveyDoc.exists()) {
          const data = surveyDoc.data();
          setSurvey({ id: surveyDoc.id, ...data });
          const bizDoc = await getDoc(doc(db, 'businesses', data.businessId));
          if (bizDoc.exists()) setBusiness({ id: bizDoc.id, ...bizDoc.data() });
          
          // Increment views
          try {
            await updateDoc(doc(db, 'surveys', surveyId), {
              views: increment(1)
            });
          } catch (e) {
            console.error("Failed to increment views", e);
          }
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchSurvey();
  }, [surveyId]);

  const handleSubmit = async () => {
    if (!survey) return;
    const scores = Object.values(answers).filter(v => typeof v === 'number') as number[];
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 3;
    const sentiment = avgScore >= 4 ? 'positive' : avgScore <= 2 ? 'negative' : 'neutral';

    await addDoc(collection(db, 'responses'), {
      surveyId, businessId: survey.businessId, ownerUid: business?.ownerUid || null, answers, respondent: contact,
      sentiment, score: avgScore, status: 'new', orderId, createdAt: new Date().toISOString()
    });

    // Update customer record
    if (contact.email) {
      await updateOrCreateCustomer(survey.businessId, {
        name: contact.name,
        email: contact.email,
        score: avgScore
      }, business?.ownerUid);
    }

    // Create notification
    await createNotification({
      businessId: survey.businessId,
      type: 'feedback',
      title: 'New Feedback Received',
      message: `${contact.name || 'Anonymous'} just submitted a ${sentiment} response (${avgScore.toFixed(1)}/5.0)`,
      link: 'feedback'
    }, business?.ownerUid);

    setSubmitted(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-4 border-stone-200 border-t-stone-800 rounded-full" /></div>;
  if (!survey) return <div className="min-h-screen flex items-center justify-center">Survey not found</div>;
  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full bg-white p-12 rounded-[40px] shadow-sm border border-stone-200 text-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-4">Thank You!</h1>
        <p className="text-stone-500">Your feedback helps us improve.</p>
      </motion.div>
    </div>
  );

  const allQuestions = survey.questions || [];
  
  // Filter questions based on conditional logic
  const questions = allQuestions.filter((q: any) => {
    if (!q.logic || !q.logic.dependsOnId) return true;
    const dependentAnswer = answers[q.logic.dependsOnId];
    if (q.logic.condition === 'equals') {
      return String(dependentAnswer) === String(q.logic.value);
    }
    return true;
  });

  const totalSteps = questions.length + (survey.settings?.requireContact ? 1 : 0);
  const currentQuestion = questions[currentStep];

  // If currentStep is out of bounds due to logic changes, adjust it
  useEffect(() => {
    if (currentStep > totalSteps - 1) {
      setCurrentStep(Math.max(0, totalSteps - 1));
    }
  }, [questions.length, currentStep, totalSteps]);

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="flex flex-col items-center mb-12">
          {business?.logoUrl ? <img src={business.logoUrl} className="h-10 mb-4" /> : <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center mb-4"><Sparkles className="text-white w-5 h-5" /></div>}
          <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest">{business?.name}</h2>
        </div>
        <div className="mb-8 flex gap-1">{Array.from({ length: totalSteps }).map((_, i) => <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-all", i <= currentStep ? "bg-stone-900" : "bg-stone-200")} />)}</div>
        <AnimatePresence mode="wait">
          <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-white p-8 md:p-12 rounded-[40px] shadow-sm border border-stone-200">
            {currentStep < questions.length ? (
              <div className="space-y-8">
                <h1 className="text-2xl font-bold text-center">{currentQuestion.label}</h1>
                <div className="py-4">
                  {currentQuestion.type === 'star' && <div className="flex justify-center gap-4">{[1,2,3,4,5].map(n => <button key={n} onClick={() => setAnswers({...answers, [currentQuestion.id]: n})} className={cn("p-4 rounded-2xl", answers[currentQuestion.id] === n ? "bg-stone-900 text-white" : "bg-stone-50 text-stone-300")}><Star className={cn("w-8 h-8", answers[currentQuestion.id] === n ? "fill-current" : "")} /></button>)}</div>}
                  {currentQuestion.type === 'choice' && <div className="space-y-3">{currentQuestion.options?.map((opt: string) => <button key={opt} onClick={() => setAnswers({...answers, [currentQuestion.id]: opt})} className={cn("w-full p-4 rounded-2xl text-left border-2", answers[currentQuestion.id] === opt ? "border-stone-900 bg-stone-50" : "border-stone-100")}>{opt}</button>)}</div>}
                  {(currentQuestion.type === 'text' || currentQuestion.type === 'long_text') && <textarea value={answers[currentQuestion.id] || ''} onChange={e => setAnswers({...answers, [currentQuestion.id]: e.target.value})} className="w-full p-4 bg-stone-50 rounded-2xl outline-none" rows={3} />}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold text-center">Contact Info</h1>
                <input type="text" placeholder="Name" value={contact.name} onChange={e => setContact({...contact, name: e.target.value})} className="w-full p-4 bg-stone-50 rounded-2xl outline-none" />
                <input type="email" placeholder="Email" value={contact.email} onChange={e => setContact({...contact, email: e.target.value})} className="w-full p-4 bg-stone-50 rounded-2xl outline-none" />
              </div>
            )}
            <div className="mt-12 flex justify-between">
              <button disabled={currentStep === 0} onClick={() => setCurrentStep(currentStep - 1)} className="flex items-center gap-2 text-stone-400 disabled:opacity-0 font-bold"><ChevronLeft /> Back</button>
              {currentStep === totalSteps - 1 ? <button onClick={handleSubmit} className="px-8 py-4 bg-stone-900 text-white rounded-2xl font-bold">Submit</button> : <button onClick={() => setCurrentStep(currentStep + 1)} className="px-8 py-4 bg-stone-900 text-white rounded-2xl font-bold flex items-center gap-2">Next <ChevronRight /></button>}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
