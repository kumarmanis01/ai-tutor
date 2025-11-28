'use client';

import { useState } from 'react';
import Icon from '@/components/UI/AppIcon';

interface FAQ {
  id: number;
  questionEn: string;
  questionHi: string;
  answerEn: string;
  answerHi: string;
  category: string;
}

const FAQSection = () => {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);

  const faqs: FAQ[] = [
    {
      id: 1,
      questionEn: 'Will my child spend too much time on screen?',
      questionHi: 'क्या मेरा बच्चा स्क्रीन पर बहुत समय बिताएगा?',
      answerEn:
        'AI Tutor is designed for quick doubt solving, not endless browsing. Average session is just 10-15 minutes. We provide parental controls to set daily time limits and track usage. Unlike social media, every minute spent here is productive learning.',
      answerHi:
        'AI Tutor त्वरित doubt solving के लिए बनाया गया है, अंतहीन ब्राउज़िंग के लिए नहीं। औसत सत्र केवल 10-15 मिनट का है। हम दैनिक समय सीमा निर्धारित करने और उपयोग ट्रैक करने के लिए parental controls प्रदान करते हैं। सोशल मीडिया के विपरीत, यहां बिताया गया हर मिनट उत्पादक सीखना है।',
      category: 'Usage',
    },
    {
      id: 2,
      questionEn: "Is my child's data safe and private?",
      questionHi: 'क्या मेरे बच्चे का डेटा सुरक्षित और निजी है?',
      answerEn:
        "Absolutely! We comply with Indian data protection laws. No personal information is shared with third parties. All photos of homework are encrypted and automatically deleted after 30 days. We never show ads or sell data. Your child's privacy is our top priority.",
      answerHi:
        'बिल्कुल! हम भारतीय डेटा सुरक्षा कानूनों का पालन करते हैं। कोई व्यक्तिगत जानकारी तीसरे पक्ष के साथ साझा नहीं की जाती है। होमवर्क की सभी तस्वीरें एन्क्रिप्टेड हैं और 30 दिनों के बाद स्वचालित रूप से हटा दी जाती हैं। हम कभी विज्ञापन नहीं दिखाते या डेटा नहीं बेचते। आपके बच्चे की गोपनीयता हमारी सर्वोच्च प्राथमिकता है।',
      category: 'Privacy',
    },
    {
      id: 3,
      questionEn: "Will AI Tutor really improve my child's grades?",
      questionHi: 'क्या AI Tutor वास्तव में मेरे बच्चे के अंक सुधारेगा?',
      answerEn:
        'Yes! Our data shows 78% of students improve grades within 3 months. AI Tutor provides instant explanations, helping students understand concepts immediately instead of waiting for next tuition class. Regular practice tests and personalized learning paths ensure consistent improvement.',
      answerHi:
        'हां! हमारा डेटा दिखाता है कि 78% छात्र 3 महीने के भीतर अंक सुधारते हैं। AI Tutor तत्काल समाधान प्रदान करता है, जिससे छात्रों को अगली ट्यूशन कक्षा की प्रतीक्षा करने के बजाय तुरंत अवधारणाओं को समझने में मदद मिलती है। नियमित अभ्यास परीक्षण और व्यक्तिगत सीखने के रास्ते लगातार सुधार सुनिश्चित करते हैं।',
      category: 'Effectiveness',
    },
    {
      id: 4,
      questionEn: "What if we don't have good internet connection?",
      questionHi: 'अगर हमारे पास अच्छा इंटरनेट कनेक्शन नहीं है तो क्या होगा?',
      answerEn:
        "AI Tutor works on 2G/3G networks! We've optimized the app for slow internet. You can download NCERT notes and practice questions for offline use. Photo uploads are compressed automatically. Even with basic ₹5000 phones and limited data, your child can learn effectively.",
      answerHi:
        'AI Tutor 2G/3G नेटवर्क पर काम करता है! हमने धीमे इंटरनेट के लिए ऐप को अनुकूलित किया है। आप ऑफ़लाइन उपयोग के लिए NCERT नोट्स और अभ्यास प्रश्न डाउनलोड कर सकते हैं। फोटो अपलोड स्वचालित रूप से संकुचित हो जाते हैं। बुनियादी ₹5000 फोन और सीमित डेटा के साथ भी, आपका बच्चा प्रभावी ढंग से सीख सकता है।',
      category: 'Technical',
    },
    {
      id: 5,
      questionEn: 'Can I try before paying?',
      questionHi: 'क्या मैं भुगतान करने से पहले आज़मा सकता हूं?',
      answerEn:
        'Yes! Start with our Free Plan (5 questions daily) to test the app. No credit card required. When ready, upgrade to unlimited access for just ₹99/month. Plus, we offer 30-day money-back guarantee on all paid plans.',
      answerHi:
        'हां! ऐप का परीक्षण करने के लिए हमारी Free Plan (प्रतिदिन 5 सवाल) से शुरू करें। कोई क्रेडिट कार्ड की आवश्यकता नहीं। तैयार होने पर, केवल ₹99/माह में असीमित एक्सेस में अपग्रेड करें। साथ ही, हम सभी paid plans पर 30-दिन की मनी-बैक गारंटी प्रदान करते हैं।',
      category: 'Pricing',
    },
    {
      id: 6,
      questionEn: 'Which boards and classes are supported?',
      questionHi: 'कौन से बोर्ड और कक्षाएं समर्थित हैं?',
      answerEn:
        'We support CBSE, ICSE, and all State Boards for classes 1-12. All major subjects including Math, Science, Social Studies, English, and Hindi are covered. Our AI understands regional language variations and provides explanations accordingly.',
      answerHi:
        'हम कक्षा 1-12 के लिए CBSE, ICSE और सभी State Boards का समर्थन करते हैं। Math, Science, Social Studies, English और Hindi सहित सभी प्रमुख विषय शामिल हैं। हमारा AI क्षेत्रीय भाषा भिन्नताओं को समझता है और तदनुसार समाधान प्रदान करता है।',
      category: 'Coverage',
    },
  ];

  return (
    <section id="faq" className="py-16 md:py-24 bg-background">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-4xl">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary rounded-full text-sm font-medium mb-4">
            <Icon name="QuestionMarkCircleIcon" size={20} variant="solid" />
            <span>Common Questions</span>
          </div>
          <h2 className="font-headline font-bold text-3xl md:text-4xl lg:text-5xl text-secondary mb-4">
            Frequently Asked Questions
          </h2>
          <p className="font-accent text-xl md:text-2xl text-primary mb-2">
            अक्सर पूछे जाने वाले प्रश्न
          </p>
          <p className="font-body text-lg text-muted-foreground">
            Get answers to common parent concerns about AI Tutor
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq) => (
            <div
              key={faq.id}
              className="bg-background border-2 border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors"
            >
              <button
                onClick={() => setOpenFAQ(openFAQ === faq.id ? null : faq.id)}
                className="w-full flex items-center justify-between p-6 text-left"
              >
                <div className="flex-1 pr-4">
                  <h3 className="font-headline font-bold text-lg md:text-xl text-secondary mb-1">
                    {faq.questionEn}
                  </h3>
                  <p className="font-accent text-sm md:text-base text-primary">{faq.questionHi}</p>
                </div>
                <div
                  className={`w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 transition-transform duration-250 ${
                    openFAQ === faq.id ? 'rotate-180' : ''
                  }`}
                >
                  <Icon
                    name="ChevronDownIcon"
                    size={20}
                    variant="outline"
                    className="text-primary"
                  />
                </div>
              </button>

              {openFAQ === faq.id && (
                <div className="px-6 pb-6 space-y-3">
                  <div className="pt-3 border-t border-border">
                    <p className="font-body text-base text-foreground leading-relaxed mb-3">
                      {faq.answerEn}
                    </p>
                    <p className="font-accent text-base text-foreground/80 leading-relaxed">
                      {faq.answerHi}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl p-6 md:p-8 border-2 border-border">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
              <Icon
                name="ChatBubbleLeftRightIcon"
                size={32}
                variant="solid"
                className="text-white"
              />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="font-headline font-bold text-xl md:text-2xl text-secondary mb-2">
                Still Have Questions?
              </h3>
              <p className="font-body text-base text-muted-foreground mb-4">
                Our support team is available 24×7 to help you. Call, WhatsApp, or email us anytime.
              </p>
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                <a
                  href="tel:+911234567890"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent transition-colors font-semibold"
                >
                  <Icon name="PhoneIcon" size={20} variant="solid" />
                  <span>+91 123 456 7890</span>
                </a>
                <a
                  href="mailto:support@aitutor.in"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors font-semibold"
                >
                  <Icon name="EnvelopeIcon" size={20} variant="solid" />
                  <span>support@aitutor.in</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
