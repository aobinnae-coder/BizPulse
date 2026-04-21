import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Building2, Package, ClipboardList, ChevronRight, ChevronLeft, CheckCircle2, QrCode } from 'lucide-react';
import { cn } from '../lib/utils';

interface OnboardingWizardProps {
  user: any;
  onComplete: (business: any) => void;
}

export default function OnboardingWizard({ user, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [businessData, setBusinessData] = useState({
    name: '',
    industry: '',
    brandColor: '#1c1917',
    address: ''
  });
  const [initialProduct, setInitialProduct] = useState({
    name: '',
    price: '',
    stock: '10'
  });
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    setLoading(true);
    try {
      // 1. Create Business
      const bizRef = await addDoc(collection(db, 'businesses'), {
        ...businessData,
        ownerUid: user.uid,
        createdAt: new Date().toISOString()
      });

      // 2. Create Initial Product
      if (initialProduct.name) {
        await addDoc(collection(db, 'products'), {
          businessId: bizRef.id,
          ownerUid: user.uid,
          name: initialProduct.name,
          price: Number(initialProduct.price),
          stock: Number(initialProduct.stock),
          status: 'active',
          createdAt: new Date().toISOString()
        });
      }

      // 3. Create Welcome Survey
      await addDoc(collection(db, 'surveys'), {
        businessId: bizRef.id,
        ownerUid: user.uid,
        title: 'Welcome Feedback',
        description: 'Tell us about your experience!',
        questions: [
          { id: 'q1', type: 'star', label: 'How would you rate your experience?', required: true },
          { id: 'q2', type: 'long_text', label: 'Any suggestions for us?', required: false }
        ],
        settings: { active: true, requireContact: false },
        createdAt: new Date().toISOString()
      });

      onComplete({ id: bizRef.id, ...businessData });
    } catch (error) {
      console.error("Onboarding error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="flex justify-center mb-12">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-stone-900 rounded-2xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-stone-900 tracking-tight">BizCompana</h1>
          </div>
        </div>

        <div className="mb-8 flex gap-2">
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              className={cn(
                "h-2 flex-1 rounded-full transition-all duration-500",
                step >= s ? "bg-stone-900" : "bg-stone-200"
              )} 
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white p-10 md:p-12 rounded-[40px] shadow-xl border border-stone-100"
          >
            {step === 1 && (
              <div className="space-y-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-stone-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Building2 className="w-8 h-8 text-stone-900" />
                  </div>
                  <h2 className="text-3xl font-bold text-stone-900">Business Profile</h2>
                  <p className="text-stone-500 mt-2">Let's start with the basics of your business.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Business Name</label>
                    <input 
                      type="text" 
                      value={businessData.name}
                      onChange={e => setBusinessData({...businessData, name: e.target.value})}
                      placeholder="e.target.value"
                      className="w-full bg-stone-50 border-none rounded-2xl py-4 px-6 text-lg outline-none focus:ring-2 focus:ring-stone-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Industry</label>
                    <select 
                      value={businessData.industry}
                      onChange={e => setBusinessData({...businessData, industry: e.target.value})}
                      className="w-full bg-stone-50 border-none rounded-2xl py-4 px-6 text-lg outline-none focus:ring-2 focus:ring-stone-900 transition-all"
                    >
                      <option value="">Select Industry</option>
                      <option value="Retail">Retail</option>
                      <option value="Restaurant">Restaurant</option>
                      <option value="Salon">Salon / Barbershop</option>
                      <option value="Consulting">Consulting</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-stone-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Package className="w-8 h-8 text-stone-900" />
                  </div>
                  <h2 className="text-3xl font-bold text-stone-900">Your First Product</h2>
                  <p className="text-stone-500 mt-2">Add a product or service to your storefront.</p>
                </div>
                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="Product Name"
                    value={initialProduct.name}
                    onChange={e => setInitialProduct({...initialProduct, name: e.target.value})}
                    className="w-full bg-stone-50 border-none rounded-2xl py-4 px-6 text-lg outline-none focus:ring-2 focus:ring-stone-900 transition-all"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      type="number" 
                      placeholder="Price ($)"
                      value={initialProduct.price}
                      onChange={e => setInitialProduct({...initialProduct, price: e.target.value})}
                      className="w-full bg-stone-50 border-none rounded-2xl py-4 px-6 text-lg outline-none focus:ring-2 focus:ring-stone-900 transition-all"
                    />
                    <input 
                      type="number" 
                      placeholder="Initial Stock"
                      value={initialProduct.stock}
                      onChange={e => setInitialProduct({...initialProduct, stock: e.target.value})}
                      className="w-full bg-stone-50 border-none rounded-2xl py-4 px-6 text-lg outline-none focus:ring-2 focus:ring-stone-900 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-stone-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <ClipboardList className="w-8 h-8 text-stone-900" />
                  </div>
                  <h2 className="text-3xl font-bold text-stone-900">Welcome Survey</h2>
                  <p className="text-stone-500 mt-2">We'll create a default survey to get you started.</p>
                </div>
                <div className="bg-stone-50 p-8 rounded-3xl border border-stone-100">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <QrCode className="w-5 h-5 text-stone-900" />
                    </div>
                    <div>
                      <p className="font-bold text-stone-900">Auto-generated QR Code</p>
                      <p className="text-xs text-stone-500">Customers can scan this to give feedback.</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="p-4 bg-white rounded-2xl text-sm font-medium text-stone-600 border border-stone-100">
                      1. How would you rate your experience? (1-5 Stars)
                    </div>
                    <div className="p-4 bg-white rounded-2xl text-sm font-medium text-stone-600 border border-stone-100">
                      2. Any suggestions for us? (Text)
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-12 flex justify-between gap-4">
              {step > 1 && (
                <button 
                  onClick={() => setStep(step - 1)}
                  className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" /> Back
                </button>
              )}
              <button 
                onClick={() => step === 3 ? handleFinish() : setStep(step + 1)}
                disabled={loading || (step === 1 && !businessData.name)}
                className="flex-[2] py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {step === 3 ? 'Complete Setup' : 'Next Step'} <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
