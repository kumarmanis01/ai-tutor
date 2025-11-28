'use client';

import { useState } from 'react';
import Icon from '@/components/UI/AppIcon';
import AppImage from '@/components/UI/AppImage';

interface Testimonial {
  id: number;
  name: string;
  location: string;
  role: string;
  image: string;
  alt: string;
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
      location: 'Jaipur, Rajasthan',
      role: 'Mother of Class 8 Student',
      image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1991a1fec-1763300922786.png',
      alt: 'Indian mother in traditional saree smiling warmly at camera in home setting',
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
      location: 'Indore, Madhya Pradesh',
      role: 'Father of Class 10 Student',
      image: 'https://img.rocket.new/generatedImages/rocket_gen_img_149bf6de3-1763295161377.png',
      alt: 'Indian father in casual shirt smiling confidently at camera in office environment',
      rating: 5,
      testimonialEn:
        "As a small business owner, I couldn't afford ₹4000 monthly tuition. AI Tutor at ₹99 is a blessing! My son now solves Math problems independently and his confidence has grown tremendously.",
      testimonialHi:
        'छोटे व्यवसायी होने के नाते मैं ₹4000 महीना ट्यूशन नहीं दे सकता था। ₹99 में AI Tutor एक वरदान है! मेरा बेटा अब Math के सवाल खुद हल करता है और उसका आत्मविश्वास बहुत बढ़ गया है।',
      beforeGrade: '52%',
      afterGrade: '81%',
      savings: '₹3900/month',
    },
    {
      id: 3,
      name: 'Priya Patel',
      location: 'Lucknow, Uttar Pradesh',
      role: 'Mother of Class 6 & 9 Students',
      image: 'https://img.rocket.new/generatedImages/rocket_gen_img_10ca1ffd3-1763301127083.png',
      alt: 'Indian mother in modern casual wear smiling happily at camera in bright home interior',
      rating: 5,
      testimonialEn:
        'Having two children in different classes was expensive with separate tutors. Family plan at ₹199 covers both kids! The 24×7 availability means they get help even at 11 PM before exams.',
      testimonialHi:
        'दो बच्चों के लिए अलग-अलग ट्यूटर बहुत महंगे थे। ₹199 का Family Plan दोनों बच्चों के लिए है! 24×7 उपलब्ध होने से exam से पहले रात 11 बजे भी मदद मिल जाती है।',
      beforeGrade: '58% & 61%',
      afterGrade: '76% & 84%',
      savings: '₹5000/month',
    },
  ];

  return (
    <section id="testimonials" className="py-16 md:py-24 bg-background">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-full text-sm font-medium mb-4">
            <Icon name="StarIcon" size={20} variant="solid" />
            <span>Real Parent Reviews</span>
          </div>
          <h2 className="font-headline font-bold text-3xl md:text-4xl lg:text-5xl text-secondary mb-4">
            Parents & Students Love AI Tutor
          </h2>
          <p className="font-accent text-xl md:text-2xl text-primary mb-2">
            माता-पिता और छात्रों को AI Tutor पसंद है
          </p>
          <p className="font-body text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            See how families across India are achieving better results while saving thousands
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-12">
          {testimonials.map((testimonial, index) => (
            <button
              key={testimonial.id}
              onClick={() => setActiveTestimonial(index)}
              className={`text-left p-6 rounded-2xl border-2 transition-all duration-250 ${
                activeTestimonial === index
                  ? 'border-primary bg-primary/5 shadow-xl scale-105'
                  : 'border-border bg-background hover:border-primary/30'
              }`}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-primary flex-shrink-0">
                  <AppImage
                    src={testimonial.image}
                    alt={testimonial.alt}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-headline font-bold text-lg text-secondary">
                    {testimonial.name}
                  </h3>
                  <p className="font-body text-sm text-muted-foreground">{testimonial.location}</p>
                  <p className="font-body text-xs text-primary mt-1">{testimonial.role}</p>
                </div>
              </div>

              <div className="flex gap-1 mb-3">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Icon
                    key={i}
                    name="StarIcon"
                    size={18}
                    variant="solid"
                    className="text-warning"
                  />
                ))}
              </div>

              <p className="font-body text-sm text-foreground mb-3 line-clamp-4">
                {testimonial.testimonialEn}
              </p>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
                <div className="text-center">
                  <p className="font-headline font-bold text-lg text-error">
                    {testimonial.beforeGrade}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">Before</p>
                </div>
                <div className="flex items-center justify-center">
                  <Icon
                    name="ArrowRightIcon"
                    size={20}
                    variant="outline"
                    className="text-success"
                  />
                </div>
                <div className="text-center">
                  <p className="font-headline font-bold text-lg text-success">
                    {testimonial.afterGrade}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">After</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl p-8 md:p-12">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg mb-6">
                <AppImage
                  src={testimonials[activeTestimonial].image}
                  alt={testimonials[activeTestimonial].alt}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="font-headline font-bold text-2xl md:text-3xl text-secondary mb-2">
                {testimonials[activeTestimonial].name}
              </h3>
              <p className="font-body text-base text-muted-foreground mb-1">
                {testimonials[activeTestimonial].location}
              </p>
              <p className="font-body text-sm text-primary mb-6">
                {testimonials[activeTestimonial].role}
              </p>

              <div className="space-y-4">
                <div className="bg-background rounded-lg p-4 border border-border">
                  <p className="font-body text-base text-foreground leading-relaxed">
                    "{testimonials[activeTestimonial].testimonialEn}"
                  </p>
                </div>
                <div className="bg-background rounded-lg p-4 border border-border">
                  <p className="font-accent text-base text-foreground leading-relaxed">
                    "{testimonials[activeTestimonial].testimonialHi}"
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-background rounded-xl p-6 border-2 border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                    <Icon name="ChartBarIcon" size={28} variant="solid" className="text-success" />
                  </div>
                  <h4 className="font-headline font-bold text-xl text-secondary">
                    Grade Improvement
                  </h4>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="font-headline font-bold text-3xl text-error mb-1">
                      {testimonials[activeTestimonial].beforeGrade}
                    </p>
                    <p className="font-body text-sm text-muted-foreground">Before AI Tutor</p>
                  </div>
                  <Icon
                    name="ArrowRightIcon"
                    size={32}
                    variant="outline"
                    className="text-success"
                  />
                  <div className="text-center">
                    <p className="font-headline font-bold text-3xl text-success mb-1">
                      {testimonials[activeTestimonial].afterGrade}
                    </p>
                    <p className="font-body text-sm text-muted-foreground">After 3 Months</p>
                  </div>
                </div>
              </div>

              <div className="bg-background rounded-xl p-6 border-2 border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon
                      name="CurrencyRupeeIcon"
                      size={28}
                      variant="solid"
                      className="text-primary"
                    />
                  </div>
                  <h4 className="font-headline font-bold text-xl text-secondary">
                    Monthly Savings
                  </h4>
                </div>
                <p className="font-headline font-bold text-4xl text-primary mb-2">
                  {testimonials[activeTestimonial].savings}
                </p>
                <p className="font-body text-sm text-muted-foreground">
                  Saved by switching from traditional tuition to AI Tutor
                </p>
              </div>

              <div className="bg-background rounded-xl p-6 border-2 border-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                    <Icon name="ClockIcon" size={28} variant="solid" className="text-secondary" />
                  </div>
                  <div>
                    <h4 className="font-headline font-bold text-xl text-secondary">3 Months</h4>
                    <p className="font-body text-sm text-muted-foreground">
                      Time to see significant improvement
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
