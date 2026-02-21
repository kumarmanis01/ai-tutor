'use client';

import { useState } from 'react';
import Icon from '@/components/UI/AppIcon';

interface PricingPlan {
  id: string;
  name: string;
  nameHi: string;
  price: string;
  period: string;
  periodHi: string;
  description: string;
  descriptionHi: string;
  features: string[];
  featuresHi: string[];
  recommended: boolean;
  savings?: string;
  ctaText: string;
  ctaTextHi: string;
}

const PricingSection = () => {
  const [, setSelectedPlan] = useState('individual');

  const plans: PricingPlan[] = [
    {
      id: 'free',
      name: 'Free Plan',
      nameHi: 'मुफ्त योजना',
      price: '₹0',
      period: 'Forever',
      periodHi: 'हमेशा के लिए',
      description: 'Try AI Tutor with limited features',
      descriptionHi: 'सीमित सुविधाओं के साथ AI Tutor आज़माएं',
      features: [
        '5 questions per day',
        'Basic explanations',
        'Hindi + English support',
        'NCERT notes access',
      ],
      featuresHi: [
        'प्रतिदिन 5 सवाल',
        'बुनियादी समाधान',
        'हिंदी + अंग्रेजी सहायता',
        'NCERT नोट्स एक्सेस',
      ],
      recommended: false,
      ctaText: 'Start Free',
      ctaTextHi: 'मुफ्त शुरू करें',
    },
    {
      id: 'individual',
      name: 'Individual Plan',
      nameHi: 'व्यक्तिगत योजना',
      price: '₹99',
      period: 'per month',
      periodHi: 'प्रति माह',
      description: 'Perfect for one student',
      descriptionHi: 'एक छात्र के लिए बिल्कुल सही',
      features: [
        'Unlimited questions',
        'Detailed step-by-step solutions',
        'Voice explanations',
        'Practice tests & worksheets',
        'Doubt solving in 30 seconds',
        'All subjects (Class 1-12)',
        'Priority support',
        'Progress tracking',
      ],
      featuresHi: [
        'असीमित सवाल',
        'विस्तृत स्टेप-बाय-स्टेप समाधान',
        'आवाज में समझाना',
        'अभ्यास टेस्ट और वर्कशीट',
        '30 सेकंड में doubt solving',
        'सभी विषय (कक्षा 1-12)',
        'प्राथमिकता सहायता',
        'प्रगति ट्रैकिंग',
      ],
      recommended: true,
      savings: 'Save ₹2900 vs tuition',
      ctaText: 'Start Free Trial',
      ctaTextHi: 'मुफ्त परीक्षण शुरू करें',
    },
    {
      id: 'family',
      name: 'Family Plan',
      nameHi: 'परिवार योजना',
      price: '₹199',
      period: 'per month',
      periodHi: 'प्रति माह',
      description: 'Best value for multiple children',
      descriptionHi: 'कई बच्चों के लिए सर्वोत्तम मूल्य',
      features: [
        'Everything in Individual Plan',
        'Up to 3 children',
        'Separate progress tracking',
        'Family dashboard',
        'Parental controls',
        'Monthly progress reports',
        'Dedicated support manager',
        'Early access to new features',
      ],
      featuresHi: [
        'Individual Plan की सभी सुविधाएं',
        '3 बच्चों तक',
        'अलग प्रगति ट्रैकिंग',
        'परिवार डैशबोर्ड',
        'माता-पिता नियंत्रण',
        'मासिक प्रगति रिपोर्ट',
        'समर्पित सहायता प्रबंधक',
        'नई सुविधाओं तक पहली पहुंच',
      ],
      recommended: false,
      savings: 'Save ₹5000+ vs multiple tutors',
      ctaText: 'Start Free Trial',
      ctaTextHi: 'मुफ्त परीक्षण शुरू करें',
    },
  ];

  return (
    <section
      id="pricing"
      className="py-16 md:py-24 bg-gradient-to-br from-secondary/5 to-primary/5"
    >
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
            <Icon name="CurrencyRupeeIcon" size={20} variant="solid" />
            <span>Transparent Pricing</span>
          </div>
          <h2 className="font-headline font-bold text-3xl md:text-4xl lg:text-5xl text-secondary mb-4">
            Choose Your Perfect Plan
          </h2>
          <p className="font-accent text-xl md:text-2xl text-primary mb-2">अपनी सही योजना चुनें</p>
          <p className="font-body text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            No hidden charges. Cancel anytime. 30-day money-back guarantee.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-12">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 transition-all duration-250 ${
                plan.recommended
                  ? 'border-primary bg-primary/5 shadow-2xl scale-105'
                  : 'border-border bg-background hover:border-primary/30'
              }`}
            >
              {plan.recommended && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white rounded-full text-sm font-bold shadow-lg">
                  Recommended
                </div>
              )}

              <div className="p-6 md:p-8">
                <div className="text-center mb-6">
                  <h3 className="font-headline font-bold text-2xl text-secondary mb-1">
                    {plan.name}
                  </h3>
                  <p className="font-accent text-base text-primary mb-4">{plan.nameHi}</p>
                  <div className="flex items-baseline justify-center gap-2 mb-2">
                    <span className="font-headline font-bold text-5xl text-secondary">
                      {plan.price}
                    </span>
                    <span className="font-body text-base text-muted-foreground">
                      /{plan.period}
                    </span>
                  </div>
                  <p className="font-body text-sm text-muted-foreground">{plan.description}</p>
                  {plan.savings && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-success/10 text-success rounded-full text-sm font-semibold">
                      <Icon name="CheckCircleIcon" size={16} variant="solid" />
                      <span>{plan.savings}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <Icon
                        name="CheckCircleIcon"
                        size={20}
                        variant="solid"
                        className={plan.recommended ? 'text-primary' : 'text-success'}
                      />
                      <span className="font-body text-sm text-foreground flex-1">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`w-full py-3 rounded-lg font-cta font-semibold transition-all duration-250 ${
                    plan.recommended
                      ? 'bg-primary text-white hover:bg-accent shadow-lg'
                      : 'bg-secondary text-white hover:bg-secondary/90'
                  }`}
                >
                  {plan.ctaText}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-background rounded-2xl border-2 border-border p-6 md:p-8 mb-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="font-headline font-bold text-2xl md:text-3xl text-secondary mb-4">
                Compare with Traditional Tuition
              </h3>
              <p className="font-body text-base text-muted-foreground mb-6">
                See how much you can save while getting better results
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-error/5 rounded-lg border border-error/20">
                  <div>
                    <p className="font-headline font-bold text-lg text-secondary">
                      Traditional Tuition
                    </p>
                    <p className="font-body text-sm text-muted-foreground">Per month, per child</p>
                  </div>
                  <p className="font-headline font-bold text-2xl text-error">₹3000-5000</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-success/5 rounded-lg border border-success/20">
                  <div>
                    <p className="font-headline font-bold text-lg text-secondary">
                      AI Tutor Individual
                    </p>
                    <p className="font-body text-sm text-muted-foreground">
                      Per month, unlimited access
                    </p>
                  </div>
                  <p className="font-headline font-bold text-2xl text-success">₹99</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div>
                    <p className="font-headline font-bold text-lg text-secondary">Your Savings</p>
                    <p className="font-body text-sm text-muted-foreground">Every single month</p>
                  </div>
                  <p className="font-headline font-bold text-2xl text-primary">₹2900+</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-6 border border-border">
                <div className="flex items-start gap-3 mb-3">
                  <Icon name="ShieldCheckIcon" size={24} variant="solid" className="text-success" />
                  <div>
                    <h4 className="font-headline font-bold text-lg text-secondary mb-1">
                      30-Day Money-Back Guarantee
                    </h4>
                    <p className="font-body text-sm text-muted-foreground">
                      Not satisfied? Get 100% refund, no questions asked
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-6 border border-border">
                <div className="flex items-start gap-3 mb-3">
                  <Icon name="XCircleIcon" size={24} variant="solid" className="text-primary" />
                  <div>
                    <h4 className="font-headline font-bold text-lg text-secondary mb-1">
                      Cancel Anytime
                    </h4>
                    <p className="font-body text-sm text-muted-foreground">
                      No long-term commitment. Stop subscription whenever you want
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-6 border border-border">
                <div className="flex items-start gap-3 mb-3">
                  <Icon
                    name="CreditCardIcon"
                    size={24}
                    variant="solid"
                    className="text-secondary"
                  />
                  <div>
                    <h4 className="font-headline font-bold text-lg text-secondary mb-1">
                      No Credit Card for Trial
                    </h4>
                    <p className="font-body text-sm text-muted-foreground">
                      Start free trial without entering payment details
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="font-body text-base text-muted-foreground mb-6">
            Still have questions about pricing?{' '}
            <a href="#faq" className="text-primary hover:underline font-semibold">
              Check our FAQ
            </a>{' '}
            or{' '}
            <a href="tel:+911234567890" className="text-primary hover:underline font-semibold">
              call us
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
