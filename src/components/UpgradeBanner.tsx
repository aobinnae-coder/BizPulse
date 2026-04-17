import React from 'react';
import { motion } from 'framer-motion';
import { Zap, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface UpgradeBannerProps {
  title: string;
  description: string;
  plan?: string;
  className?: string;
  onUpgrade?: () => void;
}

export default function UpgradeBanner({ 
  title, 
  description, 
  plan = "Pro", 
  className,
  onUpgrade 
}: UpgradeBannerProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "bg-stone-900 p-6 rounded-[32px] text-white relative overflow-hidden shadow-xl",
        className
      )}
    >
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-amber-400 rounded-lg flex items-center justify-center">
            <Zap className="w-3 h-3 text-stone-900 fill-stone-900" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Upgrade to {plan}</span>
        </div>
        <h4 className="text-lg font-bold mb-1">{title}</h4>
        <p className="text-sm text-stone-400 mb-6 leading-relaxed">{description}</p>
        <button 
          onClick={onUpgrade}
          className="w-full py-3 bg-white text-stone-900 rounded-2xl font-bold text-sm hover:bg-stone-100 transition-all flex items-center justify-center gap-2 group"
        >
          View Plans
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
      
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 blur-[60px] rounded-full -mr-16 -mt-16" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-stone-800/50 blur-[60px] rounded-full -ml-16 -mb-16" />
    </motion.div>
  );
}
