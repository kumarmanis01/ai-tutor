'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';

const quotes = [
  {
    id: 1,
    text: 'AI Tutor helped me improve my math grades fast.',
    author: 'Priya, Grade 9',
    img: 'https://i.pravatar.cc/96?img=42',
  },
  {
    id: 2,
    text: 'Great for quick explanations and homework help.',
    author: 'Rahul, Grade 11',
    img: 'https://i.pravatar.cc/96?img=12',
  },
  {
    id: 3,
    text: 'My students love the practice questions and badges.',
    author: 'Ms. Kapoor, Teacher',
    img: 'https://i.pravatar.cc/96?img=48',
  },
];

export default function StudentTestimonials() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % quotes.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <section
      aria-labelledby="StudentTestimonials-heading"
      className="p-6 rounded-xl transition-transform transform hover:scale-[1.01] shadow-lg
                 bg-gradient-to-r from-white to-indigo-50 dark:from-gray-900 dark:to-indigo-900
                 border border-indigo-100 dark:border-indigo-800"
    >
      <h3
        id="StudentTestimonials-heading"
        className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100"
      >
        What students say about Spinzy Academy
      </h3>

      <div
        role="group"
        aria-roledescription="carousel"
        aria-label="StudentTestimonials"
        className="flex flex-col md:flex-row items-start gap-4"
      >
        <div className="flex items-center gap-4 flex-1">
          <div
            className="relative w-20 h-20 rounded-full overflow-hidden border-4 border-white dark:border-gray-900 shadow-inner"
            style={{ boxShadow: '0 6px 18px rgba(59,130,246,0.12)' }}
          >
            <Image
              src={quotes[index].img}
              alt={`Photo of ${quotes[index].author}`}
              width={80}
              height={80}
              className="object-cover"
              priority={false}
            />
          </div>

          <div className="flex-1">
            <blockquote className="text-gray-800 dark:text-gray-100 italic text-lg mb-2 leading-relaxed">
              “{quotes[index].text}”
            </blockquote>
            <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">
              — {quotes[index].author}
            </p>

            <div className="flex gap-2 items-center" aria-hidden>
              {quotes.map((q, i) => (
                <button
                  key={q.id}
                  aria-label={`Show testimonial ${i + 1}`}
                  aria-current={i === index}
                  onClick={() => setIndex(i)}
                  className={`w-3.5 h-3.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500
                              ${i === index ? 'bg-indigo-600 scale-110' : 'bg-gray-300 dark:bg-gray-600'}`}
                />
              ))}
            </div>
          </div>
        </div>

        <aside className="w-full md:w-48 mt-2 md:mt-0">
          <div className="p-3 rounded-lg bg-white/70 dark:bg-white/5 border border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Trusted by students and teachers — subtle visuals help the content pop without
              overwhelming the page.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
