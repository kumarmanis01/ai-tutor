import Icon from '@/components/UI/AppIcon';
import AnimatedChatClient from './AnimatedChatClient';

const steps = [
  {
    number: '01',
    icon: 'ClipboardDocumentListIcon' as const,
    titleEn: 'Take a 15-min diagnostic',
    titleHi: '15 मिनट का diagnostic दें',
    descEn:
      'Teacher Vidya maps your knowledge gaps across every chapter. No stress -- it\'s just a starting point.',
    descHi: 'Teacher Vidya हर chapter में आपकी knowledge gaps को समझती है। बिना किसी दबाव के -- यह सिर्फ शुरुआत है।',
  },
  {
    number: '02',
    icon: 'ChatBubbleLeftRightIcon' as const,
    titleEn: 'Teacher Vidya teaches you, Socratically',
    titleHi: 'Teacher Vidya आपको Socratic तरीके से सिखाती है',
    descEn:
      'Not lectures. Teacher Vidya asks you questions, gives hints, and guides you to the answer. Every session, every concept.',
    descHi: 'Lectures नहीं। Teacher Vidya आपसे सवाल पूछती है, hints देती है, और सही जवाब तक पहुंचाती है।',
  },
  {
    number: '03',
    icon: 'TrophyIcon' as const,
    titleEn: 'Track your board exam readiness',
    titleHi: 'Board exam की तैयारी track करें',
    descEn:
      'Watch your readiness score climb chapter by chapter. Know exactly where you stand before exam day.',
    descHi: 'हर chapter में अपनी readiness score बढ़ते देखें। Exam से पहले जानें कि आप कहाँ खड़े हैं।',
  },
];

// Chat messages demo removed -- AnimatedChatClient uses its own sample messages.

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-10 md:py-14 bg-[#EEEDFE]/40">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        {/* Heading */}
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7]/10 text-[#534AB7] rounded-full text-sm font-medium mb-4">
            <Icon name="SparklesIcon" size={20} variant="solid" />
            <span>How Teacher Vidya Works</span>
          </div>
          <h2 className="font-headline font-bold text-3xl md:text-4xl lg:text-5xl text-secondary mb-4">
            Three steps to board exam confidence
          </h2>
          <p className="font-accent text-xl md:text-2xl text-[#534AB7] mb-2">
            तीन कदम और board exam की तैयारी पक्की
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 mb-10">
          {steps.map((step) => (
            <div key={step.number} className="relative flex flex-col items-center text-center md:items-start md:text-left">
              <div className="w-14 h-14 rounded-2xl bg-[#534AB7] flex items-center justify-center mb-4 flex-shrink-0">
                <Icon name={step.icon} size={28} variant="outline" className="text-white" />
              </div>
              <div className="absolute top-0 left-0 -translate-x-1 -translate-y-1 font-headline font-bold text-5xl text-[#534AB7]/10 select-none leading-none">
                {step.number}
              </div>
              <h3 className="font-headline font-bold text-xl text-secondary mb-1">{step.titleEn}</h3>
              <p className="font-accent text-sm text-[#534AB7] mb-3">{step.titleHi}</p>
                  <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed">
                    {step.descEn}
                  </p>
                  <p className="font-accent text-sm text-[#534AB7] mt-2">{step.descHi}</p>
            </div>
          ))}
        </div>
            {/* Animated chat demo (client) */}
            <AnimatedChatClient />
      </div>

    </section>
  );
};

export default HowItWorksSection;
