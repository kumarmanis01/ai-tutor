'use client';

import { useState, useEffect } from 'react';
import Icon from '@/components/UI/AppIcon';
import ConversionCTA from '@/components/ConversionCTA';

const FinalCTA = () => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    hours: 23,
    minutes: 59,
    seconds: 59,
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev?.seconds > 0) {
          return { ...prev, seconds: prev?.seconds - 1 };
        } else if (prev?.minutes > 0) {
          return { ...prev, minutes: prev?.minutes - 1, seconds: 59 };
        } else if (prev?.hours > 0) {
          return { hours: prev?.hours - 1, minutes: 59, seconds: 59 };
        }
        return { hours: 23, minutes: 59, seconds: 59 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isHydrated]);

  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-primary via-accent to-secondary">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-5xl">
        <div className="text-center text-white space-y-6 md:space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
            <Icon name="ClockIcon" size={20} variant="solid" />
            <span>Limited Time Offer</span>
          </div>

          <h2 className="font-headline font-bold text-3xl md:text-4xl lg:text-6xl">
            Transform Your Child's Learning Today
          </h2>

          <p className="font-accent text-xl md:text-2xl lg:text-3xl">
            आज ही अपने बच्चे की पढ़ाई में सुधार करें
          </p>

          <p className="font-body text-lg md:text-xl max-w-3xl mx-auto opacity-90">
            Join 1,00,000+ families who chose affordable, quality education over expensive tuition
          </p>

          {isHydrated && (
            <div className="flex items-center justify-center gap-4 md:gap-6">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 min-w-[80px]">
                <p className="font-headline font-bold text-3xl md:text-4xl">
                  {timeLeft?.hours?.toString()?.padStart(2, '0')}
                </p>
                <p className="font-body text-xs md:text-sm opacity-80">Hours</p>
              </div>
              <span className="font-headline font-bold text-2xl">:</span>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 min-w-[80px]">
                <p className="font-headline font-bold text-3xl md:text-4xl">
                  {timeLeft?.minutes?.toString()?.padStart(2, '0')}
                </p>
                <p className="font-body text-xs md:text-sm opacity-80">Minutes</p>
              </div>
              <span className="font-headline font-bold text-2xl">:</span>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 min-w-[80px]">
                <p className="font-headline font-bold text-3xl md:text-4xl">
                  {timeLeft?.seconds?.toString()?.padStart(2, '0')}
                </p>
                <p className="font-body text-xs md:text-sm opacity-80">Seconds</p>
              </div>
            </div>
          )}

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 md:p-8 max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Icon name="SparklesIcon" size={32} variant="solid" className="text-warning" />
              <h3 className="font-headline font-bold text-2xl md:text-3xl">Special Launch Offer</h3>
            </div>
            <p className="font-body text-lg md:text-xl mb-6">
              Get <span className="font-bold text-warning">50% OFF</span> on your first 3 months!
            </p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <span className="font-headline font-bold text-3xl md:text-4xl line-through opacity-60">
                ₹297
              </span>
              <Icon name="ArrowRightIcon" size={28} variant="outline" />
              <span className="font-headline font-bold text-4xl md:text-5xl text-warning">
                ₹149
              </span>
            </div>
            <p className="font-body text-sm opacity-80">
              That's just ₹49.67 per month for 3 months!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <ConversionCTA variant="final" className="bg-white text-primary hover:bg-white/90" />
            <button className="inline-flex items-center gap-2 px-8 py-4 md:px-10 md:py-5 bg-white/20 backdrop-blur-sm text-white border-2 border-white rounded-lg hover:bg-white/30 transition-all font-cta font-semibold text-lg md:text-xl">
              <Icon name="PlayCircleIcon" size={24} variant="solid" />
              <span>Watch Demo</span>
            </button>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 md:gap-6 max-w-3xl mx-auto pt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <Icon name="CheckCircleIcon" size={32} variant="solid" className="mx-auto mb-2" />
              <p className="font-body text-sm">No Credit Card Required</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <Icon name="ShieldCheckIcon" size={32} variant="solid" className="mx-auto mb-2" />
              <p className="font-body text-sm">30-Day Money-Back</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <Icon name="UserGroupIcon" size={32} variant="solid" className="mx-auto mb-2" />
              <p className="font-body text-sm">1L+ Happy Families</p>
            </div>
          </div>

          <p className="font-body text-base opacity-80 pt-4">
            🎉 <span className="font-semibold">1,247 parents</span> signed up in the last 24 hours!
          </p>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
