'use client';

import { useState } from 'react';
import Icon from '@/components/UI/AppIcon';
import AppImage from '@/components/UI/AppImage';

interface Problem {
  id: number;
  icon: string;
  titleEn: string;
  titleHi: string;
  descriptionEn: string;
  descriptionHi: string;
  image: string;
  alt: string;
  cost?: string;
}

const ProblemSection = () => {
  const [selectedProblem, setSelectedProblem] = useState(0);

  const problems: Problem[] = [
    {
      id: 1,
      icon: 'CurrencyRupeeIcon',
      titleEn: 'Expensive Tuition Fees',
      titleHi: 'महंगी ट्यूशन फीस',
      descriptionEn: 'Parents spend ₹3000-5000 monthly on tuition, straining family budgets',
      descriptionHi: 'माता-पिता ट्यूशन पर ₹3000-5000 महीना खर्च करते हैं',
      image: 'https://img.rocket.new/generatedImages/rocket_gen_img_10796cb43-1764310477959.png',
      alt: 'Indian parent looking worried while counting money and bills on table with calculator',
      cost: '₹3000-5000/month',
    },
    {
      id: 2,
      icon: 'MapPinIcon',
      titleEn: 'No Quality Teachers Nearby',
      titleHi: 'पास में अच्छे शिक्षक नहीं',
      descriptionEn: 'Tier 2/3 cities lack experienced teachers for advanced subjects',
      descriptionHi: 'छोटे शहरों में अनुभवी शिक्षकों की कमी',
      image: 'https://images.unsplash.com/photo-1614408500697-b2d010b9ffa7',
      alt: 'Young Indian student girl sitting alone at desk looking confused while studying textbook',
    },
    {
      id: 3,
      icon: 'UserIcon',
      titleEn: 'Parents Cannot Help',
      titleHi: 'माता-पिता मदद नहीं कर पाते',
      descriptionEn: 'English textbooks and advanced topics confuse parents with limited education',
      descriptionHi: 'अंग्रेजी किताबें और कठिन विषय माता-पिता को समझ नहीं आते',
      image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1b53629ec-1764310480592.png',
      alt: 'Indian father and mother looking helpless while trying to help child with homework at home',
    },
    {
      id: 4,
      icon: 'LanguageIcon',
      titleEn: 'English Textbook Confusion',
      titleHi: 'अंग्रेजी की किताबें समझ नहीं आतीं',
      descriptionEn: 'Students struggle with English medium content, need Hindi explanations',
      descriptionHi: 'छात्रों को अंग्रेजी माध्यम की सामग्री समझने में परेशानी',
      image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1e07efd1c-1764310478428.png',
      alt: 'Indian student boy looking frustrated while reading English textbook with confused expression',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="font-headline font-bold text-3xl md:text-4xl lg:text-5xl text-secondary mb-4">
            Kya Aapke Bacche Ko Bhi Ye Problems Hain?
          </h2>
          <p className="font-body text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            Do Your Children Face These Common Learning Challenges?
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="space-y-4">
            {problems.map((problem, index) => (
              <button
                key={problem.id}
                onClick={() => setSelectedProblem(index)}
                className={`w-full text-left p-4 md:p-6 rounded-xl border-2 transition-all duration-250 ${
                  selectedProblem === index
                    ? 'border-primary bg-primary/5 shadow-lg'
                    : 'border-border bg-background hover:border-primary/50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      selectedProblem === index
                        ? 'bg-primary text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon name={problem.icon as any} size={24} variant="outline" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-headline font-bold text-lg md:text-xl text-secondary mb-1">
                      {problem.titleEn}
                    </h3>
                    <p className="font-accent text-sm md:text-base text-primary mb-2">
                      {problem.titleHi}
                    </p>
                    <p className="font-body text-sm md:text-base text-muted-foreground">
                      {problem.descriptionEn}
                    </p>
                    {problem.cost && (
                      <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-error/10 text-error rounded-full text-sm font-semibold">
                        <Icon name="ExclamationTriangleIcon" size={16} variant="solid" />
                        <span>{problem.cost}</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
              <AppImage
                src={problems[selectedProblem].image}
                alt={problems[selectedProblem].alt}
                className="w-full h-auto"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-secondary/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-secondary to-transparent">
                <p className="font-headline font-bold text-xl md:text-2xl text-white">
                  {problems[selectedProblem].titleEn}
                </p>
                <p className="font-accent text-base md:text-lg text-white/90 mt-1">
                  {problems[selectedProblem].titleHi}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 md:mt-16 bg-error/5 border-2 border-error/20 rounded-2xl p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Icon name="ExclamationCircleIcon" size={28} variant="solid" className="text-error" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-xl md:text-2xl text-secondary mb-2">
                The Real Cost of Traditional Tuition
              </h3>
              <p className="font-body text-base md:text-lg text-foreground mb-4">
                Average family spends{' '}
                <span className="font-bold text-error">₹36,000-60,000 yearly</span> on tuition fees
                alone. That's more than 2 months of household income for most families!
              </p>
              <div className="grid sm:grid-cols-3 gap-4 mt-4">
                <div className="bg-background rounded-lg p-4 border border-border">
                  <p className="font-headline font-bold text-2xl text-error">₹3000+</p>
                  <p className="font-body text-sm text-muted-foreground">Monthly Tuition</p>
                </div>
                <div className="bg-background rounded-lg p-4 border border-border">
                  <p className="font-headline font-bold text-2xl text-error">₹500+</p>
                  <p className="font-body text-sm text-muted-foreground">Travel Costs</p>
                </div>
                <div className="bg-background rounded-lg p-4 border border-border">
                  <p className="font-headline font-bold text-2xl text-error">2-3 hrs</p>
                  <p className="font-body text-sm text-muted-foreground">Daily Time Lost</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
