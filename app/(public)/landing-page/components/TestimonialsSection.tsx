'use client';

import { useState } from 'react';
import Icon from '@/components/UI/AppIcon';

interface Testimonial {
  id: number;
  name: string;
  initial: string;
  avatarColor: string;
  location: string;
  role: string;
  rating: number;
  testimonialEn: string;
  testimonialHi: string;
  beforeGrade: string;
  afterGrade: string;
  savings: string;
}

const TestimonialsSection = () => {
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  const testimonials: Testimonial[] = [
    {
      id: 1,
      name: 'Sunita Sharma',
      initial: 'S',
      avatarColor: 'bg-brand-primary',
      location: 'Jaipur, Rajasthan',
      role: 'Mother of Class 8 Student',
      rating: 5,
      testimonialEn:
        "My daughter's marks improved from 45% to 78% in just 3 months! The Hindi explanations helped her understand concepts she struggled with for years. We saved ₹2500 monthly by canceling expensive tuition.",
      testimonialHi:
        'मेरी बेटी के अंक सिर्फ 3 महीने में 45% से 78% हो गए! हिंदी में समझाने से उसे वो concepts समझ आए जो सालों से नहीं समझ पा रही थी। महंगी ट्यूशन बंद करके हमने ₹2500 महीना बचाए।',
      beforeGrade: '45%',
      afterGrade: '78%',
      savings: '₹2500/month',
    },
    {
      id: 2,
      name: 'Rajesh Kumar',
      initial: 'R',
      avatarColor: 'bg-brand-success',
      location: 'Indore, Madhya Pradesh',
      role: 'Father of Class 10 Student',
      rating: 4,
      testimonialEn:
        "As a small business owner, I couldn't afford ₹4000 monthly tuition. Spinzy Academy at ₹399 is a blessing! My son now solves Math problems independently and his confidence has grown tremendously.",
      testimonialHi:
        'छोटे व्यवसायी होने के नाते मैं ₹4000 महीना ट्यूशन नहीं दे सकता था। ₹399 में Spinzy Academy एक वरदान है! मेरा बेटा अब Math के सवाल खुद हल करता है और उसका आत्मविश्वास बहुत बढ़ गया है।',
      beforeGrade: '52%',
      afterGrade: '81%',
      savings: '₹3900/month',
    },
    {
      id: 3,
      name: 'Priya Patel',
      initial: 'P',
      avatarColor: 'bg-brand-warning',
      location: 'Lucknow, Uttar Pradesh',
      role: 'Mother of Class 3 & 9 Students',
      rating: 4,
      testimonialEn:
        'Having two children in different classes was expensive with separate tutors. Family plan at ₹199 covers both kids! The 24x7 availability means they get help even at 11 PM before exams.',
      testimonialHi:
        'दो बच्चों के लिए अलग-अलग ट्यूटर बहुत महंगे थे। ₹199 का Family Plan दोनों बच्चों के लिए है! 24x7 उपलब्ध होने से exam से पहले रात 11 बजे भी मदद मिल जाती है।',
      beforeGrade: '58% & 61%',
      afterGrade: '76% & 84%',
      savings: '₹5000/month',
    },
  ];

  const active = testimonials[activeTestimonial];

  const Avatar = ({
    initial,
    color,
    size = 'md',
  }: {
    initial: string;
    color: string;
    size?: 'sm' | 'md' | 'lg';
  }) => {
    const sizeClass =
      size === 'lg' ? 'w-20 h-20 text-2xl' : size === 'sm' ? 'w-12 h-12 text-base' : 'w-16 h-16 text-xl';
    return (
      <div
        className={`${sizeClass} ${color} rounded-full flex items-center justify-center font-headline font-bold text-white border-2 border-white shadow-md flex-shrink-0`}
      >
        {initial}
      </div>
    );
  };

  return (
    <section id="testimonials" className="py-10 md:py-14 bg-brand-success-bg/40">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-success/10 text-brand-success rounded-full text-sm font-semibold mb-4">
            <Icon name="StarIcon" size={18} variant="solid" />
            <span>Real Parent Reviews</span>
          </div>
          <h2 className="font-headline font-bold text-3xl md:text-4xl lg:text-5xl text-secondary mb-3">
            Parents & Students Love Spinzy Academy
          </h2>
          <p className="font-accent text-xl md:text-2xl text-brand-primary mb-2">
            माता-पिता और छात्रों को Spinzy Academy पसंद है
          </p>
          <p className="font-body text-lg text-muted-foreground max-w-3xl mx-auto">
            See how families across India are achieving better results while saving thousands
          </p>
        </div>

        {/* Testimonial cards */}
        <div className="grid lg:grid-cols-3 gap-5 mb-8">
          {testimonials.map((testimonial, index) => (
            <button
              key={testimonial.id}
              onClick={() => setActiveTestimonial(index)}
              className={`text-left p-5 rounded-2xl border-2 transition-all duration-250 ${
                activeTestimonial === index
                  ? 'border-brand-primary bg-brand-primary/5 shadow-lg'
                  : 'border-border bg-background hover:border-brand-primary/30'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <Avatar initial={testimonial.initial} color={testimonial.avatarColor} size="sm" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-headline font-bold text-base text-secondary truncate">
                    {testimonial.name}
                  </h3>
                  <p className="font-body text-xs text-muted-foreground">{testimonial.location}</p>
                  <p className="font-body text-xs text-brand-primary mt-0.5">{testimonial.role}</p>
                </div>
              </div>

              <div className="flex gap-0.5 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Icon
                    key={i}
                    name="StarIcon"
                    size={14}
                    variant="solid"
                    className={i < testimonial.rating ? 'text-brand-warning' : 'text-muted-foreground/30'}
                  />
                ))}
              </div>

              <p className="font-body text-sm text-foreground mb-3 line-clamp-3">
                {testimonial.testimonialEn}
              </p>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
                <div className="text-center">
                  <p className="font-headline font-bold text-base text-muted-foreground">
                    {testimonial.beforeGrade}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">Before</p>
                </div>
                <div className="flex items-center justify-center">
                  <Icon name="ArrowRightIcon" size={16} variant="outline" className="text-brand-success" />
                </div>
                <div className="text-center">
                  <p className="font-headline font-bold text-base text-brand-success">
                    {testimonial.afterGrade}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">After</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Active testimonial detail */}
        <div className="bg-gradient-to-br from-brand-primary/10 to-brand-success/10 rounded-2xl p-6 md:p-10">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center gap-4 mb-5">
                <Avatar initial={active.initial} color={active.avatarColor} size="lg" />
                <div>
                  <h3 className="font-headline font-bold text-2xl text-secondary">{active.name}</h3>
                  <p className="font-body text-sm text-muted-foreground">{active.location}</p>
                  <p className="font-body text-xs text-brand-primary">{active.role}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-background rounded-xl p-4 border border-border">
                  <p className="font-body text-base text-foreground leading-relaxed">
                    &ldquo;{active.testimonialEn}&rdquo;
                  </p>
                </div>
                <div className="bg-background rounded-xl p-4 border border-border">
                  <p className="font-accent text-base text-foreground/80 leading-relaxed">
                    &ldquo;{active.testimonialHi}&rdquo;
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-background rounded-xl p-5 border-2 border-border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-brand-success/10 rounded-lg flex items-center justify-center">
                    <Icon name="ChartBarIcon" size={24} variant="solid" className="text-brand-success" />
                  </div>
                  <h4 className="font-headline font-bold text-lg text-secondary">Grade Improvement</h4>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="font-headline font-bold text-3xl text-muted-foreground mb-1">
                      {active.beforeGrade}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">Before</p>
                  </div>
                  <Icon name="ArrowRightIcon" size={28} variant="outline" className="text-brand-success" />
                  <div className="text-center">
                    <p className="font-headline font-bold text-3xl text-brand-success mb-1">
                      {active.afterGrade}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">After 3 Months</p>
                  </div>
                </div>
              </div>

              <div className="bg-background rounded-xl p-5 border-2 border-border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                    <Icon name="CurrencyRupeeIcon" size={24} variant="solid" className="text-brand-primary" />
                  </div>
                  <h4 className="font-headline font-bold text-lg text-secondary">Monthly Savings</h4>
                </div>
                <p className="font-headline font-bold text-4xl text-brand-primary mb-1">{active.savings}</p>
                <p className="font-body text-xs text-muted-foreground">
                  Saved by switching from traditional tuition to Spinzy Academy
                </p>
              </div>

              <div className="bg-background rounded-xl p-5 border-2 border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                    <Icon name="ClockIcon" size={24} variant="solid" className="text-secondary" />
                  </div>
                  <div>
                    <h4 className="font-headline font-bold text-lg text-secondary">3 Months</h4>
                    <p className="font-body text-xs text-muted-foreground">
                      Average time to see significant improvement
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
