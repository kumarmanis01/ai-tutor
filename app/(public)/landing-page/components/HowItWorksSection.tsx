'use client';

import Icon from '@/components/UI/AppIcon';

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

const chatMessages = [
  {
    sender: 'vidya' as const,
    text: 'Before we start -- what do you already know about quadratic equations?',
    textHi: 'शुरू करने से पहले -- quadratic equations के बारे में आप पहले से क्या जानते हैं?',
  },
  {
    sender: 'student' as const,
    text: 'I know it\'s ax² + bx + c = 0...',
    textHi: 'मुझे पता है यह ax² + bx + c = 0 है...',
  },
  {
    sender: 'vidya' as const,
    text: 'Perfect start! Now, if a=1, b=−5, c=6 -- what\'s the discriminant?',
    textHi: 'बढ़िया! अब, अगर a=1, b=−5, c=6 -- तो discriminant क्या होगा?',
  },
  {
    sender: 'student' as const,
    text: 'Is it b² − 4ac? So... 25 − 24 = 1?',
    textHi: 'क्या यह b² − 4ac है? तो... 25 − 24 = 1?',
  },
  {
    sender: 'vidya' as const,
    text: 'Exactly right ✓  And what does D=1 tell you about the roots?',
    textHi: 'बिल्कुल सही ✓  और D=1 roots के बारे में क्या बताता है?',
  },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-[#EEEDFE]/40">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        {/* Heading */}
        <div className="text-center mb-12 md:mb-16">
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
        <div className="grid md:grid-cols-3 gap-8 mb-16">
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
            </div>
          ))}
        </div>

        {/* Animated chat demo */}
        <div className="max-w-sm mx-auto">
          <p className="text-center text-sm font-semibold text-[#534AB7] mb-3 tracking-wide uppercase">
            This is how Teacher Vidya actually teaches
          </p>

          <div className="border border-border rounded-2xl bg-white dark:bg-gray-900 p-4 space-y-3 overflow-hidden">
            {/* Teacher Vidya label */}
            <p className="text-xs font-semibold text-[#534AB7] pl-1">Teacher Vidya</p>

            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.sender === 'student' ? 'justify-end' : 'justify-start'}`}
                style={{
                  animation: `fadeInChat 0.4s ease both`,
                  animationDelay: `${i * 1.2}s`,
                  animationIterationCount: 1,
                }}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 text-sm leading-snug ${
                    msg.sender === 'vidya'
                      ? 'bg-[#EEEDFE] text-[#3C3489] rounded-[4px_12px_12px_12px]'
                      : 'bg-[#534AB7] text-white rounded-[12px_4px_12px_12px]'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            <div
              className="flex justify-start"
              style={{
                animation: `fadeInChat 0.4s ease both`,
                animationDelay: `${chatMessages.length * 1.2}s`,
              }}
            >
              <div className="bg-[#EEEDFE] rounded-[4px_12px_12px_12px] px-4 py-3 flex gap-1 items-center">
                <span className="w-2 h-2 rounded-full bg-[#534AB7] typing-dot" style={{ animationDelay: '0s' }} />
                <span className="w-2 h-2 rounded-full bg-[#534AB7] typing-dot" style={{ animationDelay: '0.2s' }} />
                <span className="w-2 h-2 rounded-full bg-[#534AB7] typing-dot" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInChat {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes typingBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-4px); opacity: 1; }
        }
        .typing-dot {
          animation: typingBounce 1.2s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
};

export default HowItWorksSection;
