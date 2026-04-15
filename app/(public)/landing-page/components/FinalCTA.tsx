import Link from 'next/link';
import Icon from '@/components/UI/AppIcon';

const FinalCTA = () => {
  return (
    <section className="py-12 md:py-16 bg-gradient-to-br from-primary via-accent to-secondary">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-3xl">
        <div className="text-center text-white space-y-6 md:space-y-8">
          <h2 className="font-headline font-bold text-3xl md:text-4xl lg:text-5xl">
            Start learning with Teacher Vidya today
          </h2>

          <p className="font-accent text-xl md:text-2xl">
            आज ही Teacher Vidya के साथ सीखना शुरू करें
          </p>

          <p className="font-body text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
            3 free sessions every month. No credit card. Cancel anytime.
          </p>

          <div className="flex justify-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-8 py-4 md:px-10 md:py-5 min-h-[44px] bg-white text-[#534AB7] font-cta font-bold rounded-lg hover:bg-white/90 transition-all text-lg md:text-xl shadow-xl"
            >
              <Icon name="SparklesIcon" size={24} variant="solid" />
              Start Free -- it takes 2 minutes
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm opacity-90">
            <span className="flex items-center gap-1.5">
              <Icon name="CheckCircleIcon" size={16} variant="solid" />
              CBSE &amp; ICSE aligned
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="CheckCircleIcon" size={16} variant="solid" />
              Class 1-12
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="CheckCircleIcon" size={16} variant="solid" />
              Hindi &amp; English
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
