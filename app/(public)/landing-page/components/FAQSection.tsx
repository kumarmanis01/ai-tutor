'use client';

import { useState } from 'react';
import Icon from '@/components/UI/AppIcon';
import { PLANS } from '@/lib/billing/plans';

interface FAQ {
  id: number;
  questionEn: string;
  questionHi: string;
  answerEn: string;
  answerHi: string;
  category: string;
}

const FAQSection = () => {
  const [openFAQ, setOpenFAQ] = useState<number | null>(1);

  const faqs: FAQ[] = [
    {
      id: 1,
      questionEn: 'Will my child spend too much time on screen?',
      questionHi: 'क्या मेरा बच्चा स्क्रीन पर बहुत समय बिताएगा?',
      answerEn:
        'Spinzy Academy is designed for quick doubt solving, not endless browsing. Average session is just 10-15 minutes. We provide parental controls to set daily time limits and track usage. Unlike social media, every minute spent here is productive learning.',
      answerHi:
        'Spinzy Academy त्वरित doubt solving के लिए बनाया गया है, अंतहीन ब्राउज़िंग के लिए नहीं। औसत सत्र केवल 10-15 मिनट का है। हम दैनिक समय सीमा निर्धारित करने और उपयोग ट्रैक करने के लिए parental controls प्रदान करते हैं। सोशल मीडिया के विपरीत, यहां बिताया गया हर मिनट उत्पादक सीखना है।',
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
      questionEn: "Will Spinzy Academy really improve my child's grades?",
      questionHi: 'क्या Spinzy Academy वास्तव में मेरे बच्चे के अंक सुधारेगा?',
      answerEn:
        'Yes! Our data shows 78% of students improve grades within 3 months. Teacher Vidya provides instant explanations, helping students understand concepts immediately instead of waiting for next tuition class. Regular practice tests and personalized learning paths ensure consistent improvement.',
      answerHi:
        'हां! हमारा डेटा दिखाता है कि 78% छात्र 3 महीने के भीतर अंक सुधारते हैं। Teacher Vidya तत्काल समाधान प्रदान करती है, जिससे छात्रों को अगली ट्यूशन कक्षा की प्रतीक्षा करने के बजाय तुरंत अवधारणाओं को समझने में मदद मिलती है। नियमित अभ्यास परीक्षण और व्यक्तिगत सीखने के रास्ते लगातार सुधार सुनिश्चित करते हैं।',
      category: 'Effectiveness',
    },
    {
      id: 4,
      questionEn: "What if we don't have good internet connection?",
      questionHi: 'अगर हमारे पास अच्छा इंटरनेट कनेक्शन नहीं है तो क्या होगा?',
      answerEn:
        "Spinzy Academy works on 2G/3G networks! We've optimized the app for slow internet. You can download NCERT notes and practice questions for offline use. Photo uploads are compressed automatically. Even with basic ₹5000 phones and limited data, your child can learn effectively.",
      answerHi:
        'Spinzy Academy 2G/3G नेटवर्क पर काम करता है! हमने धीमे इंटरनेट के लिए ऐप को अनुकूलित किया है। आप ऑफ़लाइन उपयोग के लिए NCERT नोट्स और अभ्यास प्रश्न डाउनलोड कर सकते हैं। फोटो अपलोड स्वचालित रूप से संकुचित हो जाते हैं। बुनियादी ₹5000 फोन और सीमित डेटा के साथ भी, आपका बच्चा प्रभावी ढंग से सीख सकता है।',
      category: 'Technical',
    },
    {
      id: 5,
      questionEn: 'Can I try before paying?',
      questionHi: 'क्या मैं भुगतान करने से पहले आज़मा सकता हूं?',
      answerEn: `Yes — try Spinzy Academy with no credit card required. When ready, upgrade to unlimited access for just ${PLANS.standard_monthly.perMonthDisplay}. Refunds are available within 7 days of purchase.`,
      answerHi: `हां — बिना क्रेडिट कार्ड के Spinzy Academy आज़माएं। तैयार होने पर, केवल ${PLANS.standard_monthly.perMonthDisplay} में असीमित एक्सेस में अपग्रेड करें। खरीद के 7 दिनों के भीतर रिफंड उपलब्ध हैं।`,
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
    {
      id: 7,
      questionEn: 'Is Teacher Vidya available in Hindi?',
      questionHi: 'क्या Teacher Vidya हिंदी में उपलब्ध है?',
      answerEn:
        'Yes -- Teacher Vidya teaches in both English and Hindi. You can switch language at any time, even mid-session. All explanations, hints, and feedback are available in the language you prefer.',
      answerHi:
        'हां -- Teacher Vidya अंग्रेजी और हिंदी दोनों में पढ़ाती है। आप कभी भी, यहाँ तक कि session के बीच में भी, भाषा बदल सकते हैं। सभी explanations, hints और feedback आपकी पसंदीदा भाषा में उपलब्ध हैं।',
      category: 'Language',
    },
    {
      id: 8,
      questionEn: 'What is Spinzy AI Tutor and how does Teacher Vidya work?',
      questionHi: 'Spinzy AI Tutor क्या है और Teacher Vidya कैसे काम करती है?',
      answerEn:
        'Spinzy AI Tutor provides curriculum-aligned, AI-powered guidance. Teacher Vidya is an AI persona that offers stepwise hints and explanations to help students learn — to promote mastery, Vidya does not provide direct answers to practice problems. We process minimal usage data to deliver and improve the service; see our Privacy Policy for details. Spinzy AI Tutor is not a substitute for professional educational advice.',
      answerHi:
        'Spinzy AI Tutor पाठ्यक्रम-संगत, AI-आधारित मार्गदर्शन प्रदान करता है। Teacher Vidya एक AI persona है जो चरणबद्ध hints और explanations देती है ताकि छात्र समझें और महारत हासिल कर सकें — इसलिए Vidya अभ्यास समस्याओं के सीधे उत्तर नहीं देती। सेवा प्रदान करने और सुधारने के लिए हम न्यूनतम उपयोग डेटा संसाधित करते हैं; विवरण के लिए हमारी Privacy Policy देखें। Spinzy AI Tutor पेशेवर शैक्षणिक सलाह का विकल्प नहीं है।',
      category: 'Product',
    },
  ];

  return (
    <section id="faq" className="py-12 md:py-16 bg-background">
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
            Get answers to common parent concerns about Spinzy Academy
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
                  href="tel:+918920754675"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent transition-colors font-semibold"
                >
                  <Icon name="PhoneIcon" size={20} variant="solid" />
                  <span>+91 89207 54675</span>
                </a>
                <a
                  href="mailto:support@spinzyacademy.com"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors font-semibold"
                >
                  <Icon name="EnvelopeIcon" size={20} variant="solid" />
                  <span>support@spinzyacademy.com</span>
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
