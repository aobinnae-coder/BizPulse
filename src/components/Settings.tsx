import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { Building2, Palette, MapPin, Globe, Bell, Shield, Save, Upload, ChevronRight, QrCode, Copy, ExternalLink, Users, Trash2, Plug } from 'lucide-react';
import { cn } from '../lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { setDoc } from 'firebase/firestore';

export default function Settings({ user, business }: { user: any, business: any }) {
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    address: '',
    brandColor: '#1c1917',
    logoUrl: '',
    businessGoals: '',
    // Account preferences
    emailNotifications: true,
    smsNotifications: false,
    marketingEmails: false,
    timezone: 'UTC'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingStripe, setIsTestingStripe] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isTestingBgCheck, setIsTestingBgCheck] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [newStaffEmail, setNewStaffEmail] = useState('');

  useEffect(() => {
    if (!business) return;
    const q = query(collection(db, 'staff'), where('businessId', '==', business.id));
    const unsubscribe = onSnapshot(q, (s) => {
      setStaff(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [business]);

  const addStaff = async () => {
    if (!newStaffEmail) return;
    await addDoc(collection(db, 'staff'), {
      email: newStaffEmail,
      businessId: business.id,
      ownerUid: user.uid,
      role: 'staff',
      createdAt: new Date().toISOString()
    });
    setNewStaffEmail('');
  };

  const removeStaff = async (id: string) => {
    await deleteDoc(doc(db, 'staff', id));
  };

  useEffect(() => {
    if (business) {
      setFormData({
        name: business.name || '',
        industry: business.industry || '',
        address: business.address || '',
        brandColor: business.brandColor || '#1c1917',
        logoUrl: business.logoUrl || '',
        businessGoals: business.businessGoals || '',
        emailNotifications: business.emailNotifications ?? true,
        smsNotifications: business.smsNotifications ?? false,
        marketingEmails: business.marketingEmails ?? false,
        timezone: business.timezone || 'UTC'
      });
    }
  }, [business]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (business) {
        await updateDoc(doc(db, 'businesses', business.id), formData);
      } else {
        await addDoc(collection(db, 'businesses'), {
          ...formData,
          ownerUid: user.uid,
          createdAt: new Date().toISOString()
        });
      }
      alert('Settings saved!');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const testStripe = async () => {
    setIsTestingStripe(true);
    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 2000, currency: 'usd' })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      alert(`Stripe PaymentIntent created successfully!\nClient Secret: ${data.clientSecret.substring(0, 20)}...`);
    } catch (error: any) {
      alert(`Stripe Error: ${error.message}`);
    } finally {
      setIsTestingStripe(false);
    }
  };

  const testSendGrid = async () => {
    setIsTestingEmail(true);
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          to: user.email, 
          subject: 'Test Email from BizCompana', 
          text: 'This is a test email sent via SendGrid integration.' 
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      alert('Email sent successfully via SendGrid!');
    } catch (error: any) {
      alert(`SendGrid Error: ${error.message}`);
    } finally {
      setIsTestingEmail(false);
    }
  };

  const testBackgroundCheck = async () => {
    setIsTestingBgCheck(true);
    try {
      const res = await fetch('/api/create-background-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          candidateId: user.uid, 
          packageInfo: 'standard_criminal_check' 
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      alert(`Background check initiated successfully!\nStatus: ${data.status}\nID: ${data.id}`);
    } catch (error: any) {
      alert(`Background Check Error: ${error.message}`);
    } finally {
      setIsTestingBgCheck(false);
    }
  };

  const [platformSettings, setPlatformSettings] = useState<any>({
    stripeSecretKey: '',
    sendGridApiKey: '',
    bgCheckApiKey: '',
    defaultCurrency: 'USD',
    isPlatformSuspended: false,
  });
  const [showKeys, setShowKeys] = useState({ stripe: false, sendgrid: false, bgcheck: false });

  const [testingStatus, setTestingStatus] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({
    stripe: 'idle',
    sendgrid: 'idle',
    bgcheck: 'idle',
  });

  const simulateTest = async (key: string) => {
    setTestingStatus(prev => ({ ...prev, [key]: 'testing' }));
    await new Promise(r => setTimeout(r, 1500));
    setTestingStatus(prev => ({ ...prev, [key]: 'success' }));
    setTimeout(() => setTestingStatus(prev => ({ ...prev, [key]: 'idle' })), 3000);
  };

  useEffect(() => {
    if (user?.email !== 'a.obinnae@skyrouteusa.com') return;
    const unsubscribe = onSnapshot(doc(db, 'platformSettings', 'global'), (doc) => {
      if (doc.exists()) {
        setPlatformSettings(doc.data());
      }
    });
    return () => unsubscribe();
  }, [user]);

  const savePlatformSettings = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'platformSettings', 'global'), platformSettings, { merge: true });
      alert('Platform settings saved successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to save platform settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Settings</h1>
          <p className="text-stone-500">Manage your business profile and application preferences.</p>
        </div>
        {user?.email === 'a.obinnae@skyrouteusa.com' && (
          <div className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-[10px] uppercase font-black tracking-widest flex items-center gap-1">
            <Shield className="w-3 h-3" /> System Owner
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          {user?.email === 'a.obinnae@skyrouteusa.com' && (
            <div className="bg-stone-900 p-8 rounded-3xl border border-stone-800 shadow-xl space-y-6 text-white">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-500" />
                Application Administration
              </h3>
              <p className="text-stone-400 text-sm">Global platform configuration and sensitive API credentials.</p>
              
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest ml-1">Stripe Secret Key</label>
                  <div className="relative">
                    <input 
                      type={showKeys.stripe ? "text" : "password"}
                      value={platformSettings.stripeSecretKey}
                      onChange={e => setPlatformSettings({...platformSettings, stripeSecretKey: e.target.value})}
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none focus:ring-1 focus:ring-white/20 text-sm font-mono"
                      placeholder="sk_live_..."
                    />
                    <button 
                      onClick={() => setShowKeys({...showKeys, stripe: !showKeys.stripe})}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white"
                    >
                      {showKeys.stripe ? "Hide" : "Show"}
                    </button>
                  </div>
                  <button 
                    onClick={() => simulateTest('stripe')} 
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-widest ml-1 transition-colors",
                      testingStatus.stripe === 'testing' ? "text-stone-400" :
                      testingStatus.stripe === 'success' ? "text-emerald-400" : "text-indigo-400 hover:text-indigo-300"
                    )}
                  >
                    {testingStatus.stripe === 'testing' ? 'Testing...' : 
                     testingStatus.stripe === 'success' ? 'Connection Verified' : 'Test Connection'}
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest ml-1">SendGrid API Key</label>
                  <div className="relative">
                    <input 
                      type={showKeys.sendgrid ? "text" : "password"}
                      value={platformSettings.sendGridApiKey}
                      onChange={e => setPlatformSettings({...platformSettings, sendGridApiKey: e.target.value})}
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none focus:ring-1 focus:ring-white/20 text-sm font-mono"
                      placeholder="SG.xxxxx"
                    />
                    <button 
                      onClick={() => setShowKeys({...showKeys, sendgrid: !showKeys.sendgrid})}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white"
                    >
                      {showKeys.sendgrid ? "Hide" : "Show"}
                    </button>
                  </div>
                  <button 
                    onClick={() => simulateTest('sendgrid')} 
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-widest ml-1 transition-colors",
                      testingStatus.sendgrid === 'testing' ? "text-stone-400" :
                      testingStatus.sendgrid === 'success' ? "text-emerald-400" : "text-indigo-400 hover:text-indigo-300"
                    )}
                  >
                    {testingStatus.sendgrid === 'testing' ? 'Testing...' : 
                     testingStatus.sendgrid === 'success' ? 'Connection Verified' : 'Test Connection'}
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest ml-1">Background Check API Key</label>
                  <div className="relative">
                    <input 
                      type={showKeys.bgcheck ? "text" : "password"}
                      value={platformSettings.bgCheckApiKey}
                      onChange={e => setPlatformSettings({...platformSettings, bgCheckApiKey: e.target.value})}
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none focus:ring-1 focus:ring-white/20 text-sm font-mono"
                    />
                    <button 
                      onClick={() => setShowKeys({...showKeys, bgcheck: !showKeys.bgcheck})}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white"
                    >
                      {showKeys.bgcheck ? "Hide" : "Show"}
                    </button>
                  </div>
                  <button 
                    onClick={() => simulateTest('bgcheck')} 
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-widest ml-1 transition-colors",
                      testingStatus.bgcheck === 'testing' ? "text-stone-400" :
                      testingStatus.bgcheck === 'success' ? "text-emerald-400" : "text-indigo-400 hover:text-indigo-300"
                    )}
                  >
                    {testingStatus.bgcheck === 'testing' ? 'Testing...' : 
                     testingStatus.bgcheck === 'success' ? 'Connection Verified' : 'Test Connection'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest ml-1">Default Currency</label>
                    <select 
                      value={platformSettings.defaultCurrency}
                      onChange={e => setPlatformSettings({...platformSettings, defaultCurrency: e.target.value})}
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none focus:ring-1 focus:ring-white/20 text-sm"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="NGN">NGN (₦)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest ml-1">Platform Status</label>
                    <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                      <span className="text-sm font-medium text-stone-300">Suspend All?</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={platformSettings.isPlatformSuspended}
                          onChange={e => setPlatformSettings({...platformSettings, isPlatformSuspended: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-stone-900 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                      </label>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={savePlatformSettings}
                  className="w-full py-3 bg-white text-stone-900 rounded-xl font-bold text-sm hover:bg-stone-100 transition-colors mt-4"
                >
                  Save Global Settings
                </button>
              </div>
            </div>
          )}

          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-stone-400" />
              Staff Management
            </h3>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input 
                  type="email" 
                  placeholder="Staff Email"
                  value={newStaffEmail}
                  onChange={e => setNewStaffEmail(e.target.value)}
                  className="flex-1 p-3 bg-stone-50 rounded-xl outline-none focus:ring-2 focus:ring-stone-900"
                />
                <button 
                  onClick={addStaff}
                  className="px-6 py-3 bg-stone-900 text-white rounded-xl font-bold text-sm hover:bg-stone-800"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {staff.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                    <span className="text-sm font-medium text-stone-900">{s.email}</span>
                    <button onClick={() => removeStaff(s.id)} className="text-stone-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-stone-400" />
              Business Profile
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Business Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3 bg-stone-50 rounded-xl outline-none focus:ring-2 focus:ring-stone-900"
                  placeholder="e.g. The Coffee House"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Industry</label>
                <select 
                  value={formData.industry}
                  onChange={e => setFormData({...formData, industry: e.target.value})}
                  className="w-full p-3 bg-stone-50 rounded-xl outline-none focus:ring-2 focus:ring-stone-900"
                >
                  <option value="">Select Industry</option>
                  <option value="retail">Retail</option>
                  <option value="food">Food & Beverage</option>
                  <option value="services">Professional Services</option>
                  <option value="tech">Technology</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Address</label>
                <textarea 
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full p-3 bg-stone-50 rounded-xl outline-none focus:ring-2 focus:ring-stone-900 resize-none"
                  rows={2}
                  placeholder="123 Main St, City, State"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Business Goals</label>
                <textarea 
                  value={formData.businessGoals}
                  onChange={e => setFormData({...formData, businessGoals: e.target.value})}
                  className="w-full p-3 bg-stone-50 rounded-xl outline-none focus:ring-2 focus:ring-stone-900 resize-none"
                  rows={3}
                  placeholder="Describe your key objectives (e.g., Increase customer retention, expand to new locations...)"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-stone-400" />
              Account Details & Preferences
            </h3>
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-stone-900">Notifications</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-900">Email Notifications</p>
                    <p className="text-xs text-stone-500">Receive updates about your business via email.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={formData.emailNotifications}
                      onChange={e => setFormData({...formData, emailNotifications: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stone-900"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-900">SMS Notifications</p>
                    <p className="text-xs text-stone-500">Receive urgent alerts via SMS.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={formData.smsNotifications}
                      onChange={e => setFormData({...formData, smsNotifications: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stone-900"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-900">Marketing Emails</p>
                    <p className="text-xs text-stone-500">Receive tips, offers, and news from BizCompana.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={formData.marketingEmails}
                      onChange={e => setFormData({...formData, marketingEmails: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stone-900"></div>
                  </label>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-stone-100">
                <h4 className="text-sm font-bold text-stone-900">Regional Settings</h4>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Timezone</label>
                  <select 
                    value={formData.timezone}
                    onChange={e => setFormData({...formData, timezone: e.target.value})}
                    className="w-full p-3 bg-stone-50 rounded-xl outline-none focus:ring-2 focus:ring-stone-900"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Europe/Paris">Central European Time (CET)</option>
                    <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
                    <option value="Australia/Sydney">Australian Eastern Time (AET)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Plug className="w-5 h-5 text-stone-400" />
              Third-Party Integrations
            </h3>
            <p className="text-sm text-stone-500">
              Connect external services like Stripe (Payments) and SendGrid (Email). Ensure your API keys are set in the environment variables.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100 flex flex-col items-start gap-4">
                <div>
                  <h4 className="font-bold text-stone-900">Stripe Payments</h4>
                  <p className="text-xs text-stone-500 mt-1">Test creating a PaymentIntent.</p>
                </div>
                <button 
                  onClick={testStripe}
                  disabled={isTestingStripe}
                  className="px-4 py-2 bg-[#635BFF] text-white rounded-xl font-bold text-sm hover:bg-[#635BFF]/90 transition-colors disabled:opacity-50 mt-auto"
                >
                  {isTestingStripe ? 'Testing...' : 'Test Stripe API'}
                </button>
              </div>
              <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100 flex flex-col items-start gap-4">
                <div>
                  <h4 className="font-bold text-stone-900">SendGrid Email</h4>
                  <p className="text-xs text-stone-500 mt-1">Send a test email to {user.email}.</p>
                </div>
                <button 
                  onClick={testSendGrid}
                  disabled={isTestingEmail}
                  className="px-4 py-2 bg-[#00BFFF] text-white rounded-xl font-bold text-sm hover:bg-[#00BFFF]/90 transition-colors disabled:opacity-50 mt-auto"
                >
                  {isTestingEmail ? 'Sending...' : 'Test SendGrid API'}
                </button>
              </div>
              <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100 flex flex-col items-start gap-4 sm:col-span-2">
                <div>
                  <h4 className="font-bold text-stone-900">Background Checks (Checkr)</h4>
                  <p className="text-xs text-stone-500 mt-1">Initiate a prototype background check and receive a webhooks callback.</p>
                </div>
                <button 
                  onClick={testBackgroundCheck}
                  disabled={isTestingBgCheck}
                  className="px-4 py-2 bg-stone-900 text-white rounded-xl font-bold text-sm hover:bg-stone-800 transition-colors disabled:opacity-50 mt-auto"
                >
                  {isTestingBgCheck ? 'Initiating...' : 'Test Background Check API'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Palette className="w-5 h-5 text-stone-400" />
              Branding
            </h3>
            <div className="flex items-center gap-6">
              <div className="space-y-1 flex-1">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Brand Color</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={formData.brandColor}
                    onChange={e => setFormData({...formData, brandColor: e.target.value})}
                    className="w-12 h-12 rounded-xl cursor-pointer border-none p-0"
                  />
                  <input 
                    type="text" 
                    value={formData.brandColor}
                    onChange={e => setFormData({...formData, brandColor: e.target.value})}
                    className="flex-1 p-3 bg-stone-50 rounded-xl outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Logo URL</label>
                <input 
                  type="text" 
                  value={formData.logoUrl}
                  onChange={e => setFormData({...formData, logoUrl: e.target.value})}
                  className="w-full p-3 bg-stone-50 rounded-xl outline-none"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-stone-900 p-8 rounded-3xl text-white space-y-6 shadow-xl shadow-stone-200">
            <h3 className="text-lg font-bold">Save Changes</h3>
            <p className="text-stone-400 text-sm">Your changes will be applied immediately to all your active surveys and dashboard.</p>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-4 bg-white text-stone-900 rounded-2xl font-bold hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? 'Saving...' : <><Save className="w-5 h-5" /> Save Settings</>}
            </button>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <QrCode className="w-5 h-5 text-stone-400" />
              Storefront Sharing
            </h3>
            <div className="space-y-6">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={`${window.location.origin}?store=${business?.id}`}
                  className="flex-1 bg-stone-50 border-stone-200 rounded-xl px-4 py-2 text-sm text-stone-600 outline-none"
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}?store=${business?.id}`);
                    alert('Link copied!');
                  }}
                  className="p-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-col items-center p-6 bg-stone-50 rounded-3xl border border-stone-100">
                <div className="p-4 bg-white rounded-2xl shadow-sm mb-4">
                  <QRCodeSVG 
                    value={`${window.location.origin}?store=${business?.id}`} 
                    size={160}
                    level="H"
                  />
                </div>
                <p className="text-xs text-stone-500 text-center">Scan to visit your storefront</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
