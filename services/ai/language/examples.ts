/**
 * FILE OBJECTIVE:
 * - Examples of Notes, Practice, and Doubts in Hindi & Hinglish.
 * - Demonstrates proper language usage for each grade band.
 * - Serves as reference for AI output quality.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/ai/language/examples.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created multilingual content examples
 */

// ============================================================================
// NOTES EXAMPLES
// ============================================================================

/**
 * Example notes in different languages
 */
export const NOTES_EXAMPLES = {
  // ----- GRADE 3: ADDITION (MATHS) -----
  
  JUNIOR_ENGLISH: {
    grade: 3,
    subject: 'Maths',
    topic: 'Addition',
    content: {
      title: 'Adding Numbers',
      main_idea: 'Addition means putting things together to find the total.',
      key_points: [
        'Addition uses the + sign',
        '2 + 3 = 5 means 2 and 3 together make 5',
        'We can add using fingers or objects',
      ],
      example: {
        problem: 'Riya has 3 apples. Her mom gives 2 more. How many apples now?',
        steps: ['Start with 3 apples', 'Add 2 more apples', 'Count all: 1, 2, 3, 4, 5'],
        answer: '3 + 2 = 5 apples',
      },
    },
  },
  
  JUNIOR_HINDI: {
    grade: 3,
    subject: 'गणित',
    topic: 'जोड़',
    content: {
      title: 'जोड़ करना सीखें',
      main_idea: 'जोड़ का मतलब है चीज़ों को मिलाकर कुल निकालना।',
      key_points: [
        'जोड़ में + चिन्ह लगता है',
        '2 + 3 = 5 का मतलब 2 और 3 मिलाकर 5',
        'उंगलियों से गिनकर जोड़ सकते हैं',
      ],
      example: {
        problem: 'रिया के पास 3 सेब हैं। माँ ने 2 और दिए। अब कितने सेब हैं?',
        steps: ['पहले 3 सेब हैं', '2 और जोड़ो', 'गिनो: 1, 2, 3, 4, 5'],
        answer: '3 + 2 = 5 सेब',
      },
    },
  },
  
  JUNIOR_HINGLISH: {
    grade: 3,
    subject: 'Maths',
    topic: 'Addition',
    content: {
      title: 'Addition Karna Seekho',
      main_idea: 'Addition ka matlab hai cheezein milakar total nikalna.',
      key_points: [
        'Addition mein + sign lagta hai',
        '2 + 3 = 5 matlab 2 aur 3 milakar 5',
        'Fingers se count karke add kar sakte ho',
      ],
      example: {
        problem: 'Riya ke paas 3 apples hain. Mom ne 2 aur diye. Ab kitne apples hain?',
        steps: ['Pehle 3 apples hain', '2 aur add karo', 'Count karo: 1, 2, 3, 4, 5'],
        answer: '3 + 2 = 5 apples',
      },
    },
  },
  
  // ----- GRADE 7: PHOTOSYNTHESIS (SCIENCE) -----
  
  MIDDLE_ENGLISH: {
    grade: 7,
    subject: 'Science',
    topic: 'Photosynthesis',
    content: {
      title: 'Photosynthesis: How Plants Make Food',
      main_idea: 'Photosynthesis is the process where plants use sunlight, water, and carbon dioxide to make glucose (food) and release oxygen.',
      key_points: [
        'Photo = light, Synthesis = making',
        'Happens in leaves (chloroplasts)',
        'Equation: 6CO₂ + 6H₂O + Light → C₆H₁₂O₆ + 6O₂',
        'Chlorophyll gives leaves green color',
      ],
      example: {
        context: 'Why do plants need sunlight?',
        explanation: 'Sunlight provides energy to break water molecules and combine them with CO₂ to form glucose.',
      },
    },
  },
  
  MIDDLE_HINDI: {
    grade: 7,
    subject: 'विज्ञान',
    topic: 'प्रकाश संश्लेषण',
    content: {
      title: 'प्रकाश संश्लेषण: पौधे भोजन कैसे बनाते हैं',
      main_idea: 'प्रकाश संश्लेषण वह प्रक्रिया है जिसमें पौधे सूर्य की रोशनी, पानी और कार्बन डाइऑक्साइड से ग्लूकोज़ (भोजन) बनाते हैं और ऑक्सीजन छोड़ते हैं।',
      key_points: [
        'प्रकाश = रोशनी, संश्लेषण = बनाना',
        'पत्तियों में होता है (क्लोरोप्लास्ट में)',
        'समीकरण: 6CO₂ + 6H₂O + प्रकाश → C₆H₁₂O₆ + 6O₂',
        'क्लोरोफिल पत्तियों को हरा रंग देता है',
      ],
      example: {
        context: 'पौधों को धूप क्यों चाहिए?',
        explanation: 'सूर्य की रोशनी पानी के अणुओं को तोड़ने की ऊर्जा देती है, जो CO₂ से मिलकर ग्लूकोज़ बनाते हैं।',
      },
    },
  },
  
  MIDDLE_HINGLISH: {
    grade: 7,
    subject: 'Science',
    topic: 'Photosynthesis',
    content: {
      title: 'Photosynthesis: Plants Food Kaise Banate Hain',
      main_idea: 'Photosynthesis wo process hai jisme plants sunlight, water aur CO₂ se glucose (food) banate hain aur oxygen release karte hain.',
      key_points: [
        'Photo = light, Synthesis = banana',
        'Leaves mein hota hai (chloroplasts mein)',
        'Equation: 6CO₂ + 6H₂O + Light → C₆H₁₂O₆ + 6O₂',
        'Chlorophyll leaves ko green color deta hai',
      ],
      example: {
        context: 'Plants ko sunlight kyun chahiye?',
        explanation: 'Sunlight energy deti hai water molecules todne ke liye, jo CO₂ ke saath milkar glucose banaate hain.',
      },
    },
  },
  
  // ----- GRADE 10: QUADRATIC EQUATIONS (MATHS) -----
  
  SENIOR_ENGLISH: {
    grade: 10,
    subject: 'Mathematics',
    topic: 'Quadratic Equations',
    content: {
      title: 'Quadratic Equations: Standard Form and Solutions',
      main_idea: 'A quadratic equation is a polynomial equation of degree 2, written as ax² + bx + c = 0 where a ≠ 0.',
      key_points: [
        'Standard form: ax² + bx + c = 0',
        'Has at most 2 solutions (roots)',
        'Solutions found using: factorization, completing the square, or quadratic formula',
        'Quadratic formula: x = (-b ± √(b²-4ac)) / 2a',
        'Discriminant (b²-4ac) determines nature of roots',
      ],
      example: {
        problem: 'Solve: x² - 5x + 6 = 0',
        steps: [
          'Identify: a=1, b=-5, c=6',
          'Factor: (x-2)(x-3) = 0',
          'Set each factor to 0: x-2=0 or x-3=0',
          'Solve: x=2 or x=3',
        ],
        answer: 'x = 2 or x = 3',
      },
    },
  },
  
  SENIOR_HINDI: {
    grade: 10,
    subject: 'गणित',
    topic: 'द्विघात समीकरण',
    content: {
      title: 'द्विघात समीकरण: मानक रूप और हल',
      main_idea: 'द्विघात समीकरण घात 2 का बहुपद समीकरण है, जो ax² + bx + c = 0 के रूप में लिखा जाता है जहाँ a ≠ 0।',
      key_points: [
        'मानक रूप: ax² + bx + c = 0',
        'अधिकतम 2 हल (मूल) होते हैं',
        'हल निकालने की विधियाँ: गुणनखंड, वर्ग पूर्ण करना, द्विघात सूत्र',
        'द्विघात सूत्र: x = (-b ± √(b²-4ac)) / 2a',
        'विविक्तकर (b²-4ac) मूलों की प्रकृति बताता है',
      ],
      example: {
        problem: 'हल करें: x² - 5x + 6 = 0',
        steps: [
          'पहचानें: a=1, b=-5, c=6',
          'गुणनखंड: (x-2)(x-3) = 0',
          'प्रत्येक गुणनखंड = 0: x-2=0 या x-3=0',
          'हल: x=2 या x=3',
        ],
        answer: 'x = 2 या x = 3',
      },
    },
  },
  
  SENIOR_HINGLISH: {
    grade: 10,
    subject: 'Mathematics',
    topic: 'Quadratic Equations',
    content: {
      title: 'Quadratic Equations: Standard Form aur Solutions',
      main_idea: 'Quadratic equation ek degree 2 ka polynomial equation hai, jo ax² + bx + c = 0 form mein likha jaata hai jahan a ≠ 0.',
      key_points: [
        'Standard form: ax² + bx + c = 0',
        'Maximum 2 solutions (roots) hote hain',
        'Solutions nikalte hain: factorization, completing the square, ya quadratic formula se',
        'Quadratic formula: x = (-b ± √(b²-4ac)) / 2a',
        'Discriminant (b²-4ac) roots ki nature batata hai',
      ],
      example: {
        problem: 'Solve karo: x² - 5x + 6 = 0',
        steps: [
          'Identify karo: a=1, b=-5, c=6',
          'Factor karo: (x-2)(x-3) = 0',
          'Each factor = 0 rakho: x-2=0 ya x-3=0',
          'Solve: x=2 ya x=3',
        ],
        answer: 'x = 2 ya x = 3',
      },
    },
  },
};

// ============================================================================
// PRACTICE QUESTION EXAMPLES
// ============================================================================

/**
 * Example practice questions in different languages
 */
export const PRACTICE_EXAMPLES = {
  JUNIOR_ENGLISH: {
    grade: 3,
    question_type: 'MCQ',
    question_text: 'What is 4 + 3?',
    options: [
      { label: 'A', text: '6', is_correct: false },
      { label: 'B', text: '7', is_correct: true },
      { label: 'C', text: '8', is_correct: false },
      { label: 'D', text: '5', is_correct: false },
    ],
    explanation: 'Count 4 fingers, then count 3 more. You get 7 in total!',
  },
  
  JUNIOR_HINDI: {
    grade: 3,
    question_type: 'MCQ',
    question_text: '4 + 3 = ?',
    options: [
      { label: 'A', text: '6', is_correct: false },
      { label: 'B', text: '7', is_correct: true },
      { label: 'C', text: '8', is_correct: false },
      { label: 'D', text: '5', is_correct: false },
    ],
    explanation: '4 उंगलियाँ गिनो, फिर 3 और गिनो। कुल 7 हो जाएंगी!',
  },
  
  JUNIOR_HINGLISH: {
    grade: 3,
    question_type: 'MCQ',
    question_text: '4 + 3 kitna hota hai?',
    options: [
      { label: 'A', text: '6', is_correct: false },
      { label: 'B', text: '7', is_correct: true },
      { label: 'C', text: '8', is_correct: false },
      { label: 'D', text: '5', is_correct: false },
    ],
    explanation: '4 fingers count karo, phir 3 aur count karo. Total 7 ho jaayenge!',
  },
  
  MIDDLE_ENGLISH: {
    grade: 7,
    question_type: 'MCQ',
    question_text: 'Which gas is released during photosynthesis?',
    options: [
      { label: 'A', text: 'Carbon dioxide', is_correct: false },
      { label: 'B', text: 'Nitrogen', is_correct: false },
      { label: 'C', text: 'Oxygen', is_correct: true },
      { label: 'D', text: 'Hydrogen', is_correct: false },
    ],
    explanation: 'During photosynthesis, plants take in CO₂ and release O₂ (oxygen) as a byproduct.',
  },
  
  MIDDLE_HINGLISH: {
    grade: 7,
    question_type: 'MCQ',
    question_text: 'Photosynthesis mein kaun si gas release hoti hai?',
    options: [
      { label: 'A', text: 'Carbon dioxide', is_correct: false },
      { label: 'B', text: 'Nitrogen', is_correct: false },
      { label: 'C', text: 'Oxygen', is_correct: true },
      { label: 'D', text: 'Hydrogen', is_correct: false },
    ],
    explanation: 'Photosynthesis mein plants CO₂ lete hain aur O₂ (oxygen) byproduct ke roop mein release karte hain.',
  },
  
  SENIOR_ENGLISH: {
    grade: 10,
    question_type: 'MCQ',
    question_text: 'If the discriminant of a quadratic equation is negative, the roots are:',
    options: [
      { label: 'A', text: 'Real and equal', is_correct: false },
      { label: 'B', text: 'Real and distinct', is_correct: false },
      { label: 'C', text: 'Imaginary (complex)', is_correct: true },
      { label: 'D', text: 'Rational', is_correct: false },
    ],
    explanation: 'When D = b²-4ac < 0, the square root of a negative number gives imaginary numbers, so roots are complex conjugates.',
  },
  
  SENIOR_HINGLISH: {
    grade: 10,
    question_type: 'MCQ',
    question_text: 'Agar quadratic equation ka discriminant negative hai, toh roots hain:',
    options: [
      { label: 'A', text: 'Real aur equal', is_correct: false },
      { label: 'B', text: 'Real aur distinct', is_correct: false },
      { label: 'C', text: 'Imaginary (complex)', is_correct: true },
      { label: 'D', text: 'Rational', is_correct: false },
    ],
    explanation: 'Jab D = b²-4ac < 0 ho, toh negative number ka square root imaginary number deta hai, isliye roots complex conjugates hote hain.',
  },
};

// ============================================================================
// DOUBT RESOLUTION EXAMPLES
// ============================================================================

/**
 * Example doubt resolutions in different languages
 */
export const DOUBT_EXAMPLES = {
  JUNIOR_ENGLISH: {
    grade: 3,
    student_question: 'I don\'t understand subtraction',
    response: {
      greeting: 'Hi! Subtraction is like taking away. Let me explain! 🍎',
      clarification: 'When we subtract, we start with some things and take some away. What\'s left is the answer!',
      example: 'You have 5 candies. You eat 2. How many left? 5 - 2 = 3 candies!',
      encouragement: 'You\'re doing great! Try counting on your fingers to help.',
    },
  },
  
  JUNIOR_HINGLISH: {
    grade: 3,
    student_question: 'Mujhe subtraction samajh nahi aa raha',
    response: {
      greeting: 'Hello! Subtraction matlab hataana. Main samjhaata hoon! 🍎',
      clarification: 'Jab hum subtract karte hain, toh kuch cheezein hoti hain aur kuch hataa dete hain. Jo bachti hain wo answer hai!',
      example: 'Tumhare paas 5 candies hain. 2 kha liye. Kitni bachi? 5 - 2 = 3 candies!',
      encouragement: 'Bahut accha! Fingers pe count karke try karo.',
    },
  },
  
  MIDDLE_ENGLISH: {
    grade: 7,
    student_question: 'Why do plants look green?',
    response: {
      greeting: 'Great question!',
      clarification: 'Plants look green because of a pigment called chlorophyll in their leaves. Chlorophyll absorbs red and blue light for photosynthesis but reflects green light back to our eyes.',
      analogy: 'Think of it like a green t-shirt - it absorbs other colors and bounces back green!',
      encouragement: 'Keep asking "why" questions - that\'s how scientists think!',
    },
  },
  
  MIDDLE_HINGLISH: {
    grade: 7,
    student_question: 'Plants green kyun dikhte hain?',
    response: {
      greeting: 'Bahut accha sawaal!',
      clarification: 'Plants green dikhte hain kyunki unki leaves mein chlorophyll naam ka pigment hota hai. Chlorophyll red aur blue light absorb karta hai photosynthesis ke liye, lekin green light reflect karta hai hamare eyes tak.',
      analogy: 'Aise samjho jaise green t-shirt - wo other colors absorb karta hai aur green color wapas bhejta hai!',
      encouragement: 'Aise "kyun" wale questions puchte raho - scientists aise hi sochte hain!',
    },
  },
  
  SENIOR_ENGLISH: {
    grade: 10,
    student_question: 'When do we use completing the square vs quadratic formula?',
    response: {
      greeting: 'Excellent question about method selection!',
      clarification: 'Both methods always work, but: Completing the square is useful when the coefficient of x² is 1 and when you need to derive the vertex form. Quadratic formula is faster for complex coefficients and when you need exact answers quickly.',
      step_by_step: [
        'If equation is simple (like x² + 6x + 5 = 0), try factoring first',
        'If a=1 and you need vertex form, use completing the square',
        'For any other case, quadratic formula is reliable',
      ],
      encouragement: 'In board exams, quadratic formula is usually faster. Master both methods!',
    },
  },
  
  SENIOR_HINGLISH: {
    grade: 10,
    student_question: 'Completing the square aur quadratic formula kab use karein?',
    response: {
      greeting: 'Method selection ke baare mein bahut accha sawaal!',
      clarification: 'Dono methods hamesha kaam karte hain, lekin: Completing the square tab useful hai jab x² ka coefficient 1 ho aur vertex form chahiye. Quadratic formula complex coefficients ke liye faster hai aur jab exact answers jaldi chahiye.',
      step_by_step: [
        'Agar equation simple hai (jaise x² + 6x + 5 = 0), pehle factoring try karo',
        'Agar a=1 hai aur vertex form chahiye, completing the square use karo',
        'Baaki cases mein quadratic formula reliable hai',
      ],
      encouragement: 'Board exams mein quadratic formula usually faster hai. Dono methods master karo!',
    },
  },
};
