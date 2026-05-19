/**
 * FILE OBJECTIVE:
 * - Grammar domain taxonomy for language subjects.
 * - Provides per-board, per-grade grammar domains for English, Hindi,
 *   Sanskrit, French, Urdu, and all major Indian regional languages.
 * - Supplies detection utilities consumed by the notes and questions
 *   prompt builders.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompts/grammar.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-19T00:00:00Z | claude | created grammar taxonomy for language subjects
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type SubjectType = 'language' | 'stem' | 'social_science' | 'arts';

export type LanguageName =
  | 'English'
  | 'Hindi'
  | 'Sanskrit'
  | 'French'
  | 'Urdu'
  | 'Marathi'
  | 'Bengali'
  | 'Tamil'
  | 'Telugu'
  | 'Kannada'
  | 'Gujarati'
  | 'Punjabi'
  | string;

export type TopicCategory =
  | 'grammar'
  | 'prose'
  | 'poetry'
  | 'composition'
  | 'comprehension'
  | 'letter_writing'
  | 'creative_writing'
  | 'drama';

export type GrammarDomain = string;

export interface GrammarDomainSpec {
  language: LanguageName;
  domain: GrammarDomain;
  label: string;
  gradeMin: number;
  gradeMax: number;
  /** Board codes that include this domain, or ['*'] for all boards. */
  boards: string[];
  description: string;
  /** Typical board-exam question patterns for this domain. */
  examPatterns: string[];
  /** Language-specific nuances a teacher must highlight. */
  nuances: string[];
}

export interface LanguageSubjectMeta {
  language: LanguageName;
  topicCategory: TopicCategory;
  grammarDomain?: GrammarDomain;
  grammarLabel?: string;
  grammarDescription?: string;
  examPatterns?: string[];
  nuances?: string[];
  chapterHasGrammarAnchor?: string;
}

// ---------------------------------------------------------------------------
// STEM / social-science / arts subject name fragments (used to exclude them)
// ---------------------------------------------------------------------------

const STEM_PATTERNS =
  /mathematics|math|science|physics|chemistry|biology|computer|evs|environmental/i;
const SOCIAL_PATTERNS = /history|civics|geography|social|political|economics/i;
const ARTS_PATTERNS = /art|music|physical education|pe\b|general knowledge|gk\b/i;

// ---------------------------------------------------------------------------
// Grammar taxonomy -- per language, per board, per grade band
// ---------------------------------------------------------------------------

/* eslint-disable max-lines */
const GRAMMAR_TAXONOMY: GrammarDomainSpec[] = [

  // ============================================================
  // ENGLISH
  // ============================================================

  // --- Grades 6-8 (CBSE/ICSE/IB/IGCSE/State) ---
  {
    language: 'English', domain: 'parts_of_speech', label: 'Parts of Speech',
    gradeMin: 6, gradeMax: 8, boards: ['*'],
    description: 'Nouns, pronouns, verbs, adjectives, adverbs, prepositions, conjunctions, and interjections with their sub-types.',
    examPatterns: ['identify the part of speech', 'underline the adjective/adverb', 'fill in with correct form'],
    nuances: ['Gerunds and participial phrases look like verbs but function as nouns/adjectives.', 'Adverbs can modify adjectives and other adverbs, not just verbs.'],
  },
  {
    language: 'English', domain: 'articles_prepositions', label: 'Articles and Prepositions',
    gradeMin: 6, gradeMax: 8, boards: ['*'],
    description: 'Definite/indefinite articles, zero article usage, and prepositions of place, time, direction, and manner.',
    examPatterns: ['fill in the blank with a/an/the', 'choose the correct preposition', 'rewrite without changing meaning'],
    nuances: ["'The' is used before unique nouns and superlatives.", "Prepositions after adjectives often have no rule -- students must memorise: 'afraid of', 'good at', 'interested in'."],
  },
  {
    language: 'English', domain: 'tenses_basic', label: 'Tenses (Simple & Continuous)',
    gradeMin: 6, gradeMax: 8, boards: ['*'],
    description: 'Simple present, present continuous, simple past, past continuous, simple future, and future continuous -- form and use.',
    examPatterns: ['fill in with correct tense', 'rewrite in the tense indicated', 'identify the tense'],
    nuances: ['State verbs (know, believe, love) rarely take continuous form.', 'Simple present is used for habitual actions and universal truths, not just "now".'],
  },
  {
    language: 'English', domain: 'subject_verb_agreement', label: 'Subject-Verb Agreement',
    gradeMin: 6, gradeMax: 8, boards: ['*'],
    description: 'Rules for singular/plural agreement including collective nouns, indefinite pronouns, and intervening phrases.',
    examPatterns: ['correct the error', 'choose the correct verb form', 'editing exercise'],
    nuances: ["Collective nouns (team, committee) take singular verb in British English.", "'Neither...nor' and 'either...or' -- verb agrees with the nearer subject."],
  },
  {
    language: 'English', domain: 'degrees_of_comparison', label: 'Degrees of Comparison',
    gradeMin: 6, gradeMax: 8, boards: ['*'],
    description: 'Positive, comparative, and superlative degrees of adjectives and adverbs, including irregular forms.',
    examPatterns: ['rewrite using positive/comparative degree', 'fill in with correct degree', 'sentence transformation'],
    nuances: ['Comparative used for two things; superlative for three or more.', "Avoid 'more better' -- double comparatives are a common error."],
  },
  {
    language: 'English', domain: 'punctuation', label: 'Punctuation',
    gradeMin: 6, gradeMax: 8, boards: ['*'],
    description: 'Full stop, comma, question mark, exclamation, colon, semicolon, apostrophe, quotation marks, and capitalisation rules.',
    examPatterns: ['punctuate the passage', 'add capitals and punctuation', 'rewrite with correct punctuation'],
    nuances: ["Apostrophe for possession vs. contraction -- it's (it is) vs. its (belonging to it).", 'Serial/Oxford comma is optional in CBSE but required in ICSE.'],
  },
  {
    language: 'English', domain: 'conjunctions_connectives', label: 'Conjunctions and Connectives',
    gradeMin: 6, gradeMax: 8, boards: ['*'],
    description: 'Coordinating, subordinating, and correlative conjunctions; discourse connectives (however, therefore, moreover).',
    examPatterns: ['join using conjunction given', 'fill in suitable conjunction', 'identify type of conjunction'],
    nuances: ['Correlative conjunctions must be parallel (both...and, either...or, neither...nor).', "Subordinating conjunctions create dependent clauses -- can't stand alone as sentences."],
  },

  // --- Grades 9-10 (CBSE) ---
  {
    language: 'English', domain: 'active_passive_voice', label: 'Active and Passive Voice',
    gradeMin: 9, gradeMax: 10, boards: ['CBSE', 'ICSE', 'STATE'],
    description: 'Transformation between active and passive voice across all tenses, including interrogative and negative forms.',
    examPatterns: ['change to passive voice', 'change to active voice', 'rewrite as directed'],
    nuances: ['Passive is formed with appropriate tense of "be" + past participle.', 'Intransitive verbs have no passive form.', 'By-phrase is omitted when the agent is unknown or unimportant.'],
  },
  {
    language: 'English', domain: 'direct_indirect_speech', label: 'Direct and Indirect Speech (Narration)',
    gradeMin: 9, gradeMax: 10, boards: ['CBSE', 'ICSE', 'STATE'],
    description: 'Reported speech transformation: statements, questions, commands, exclamations, and mixed sentence types.',
    examPatterns: ['change to indirect speech', 'change to direct speech', 'report the dialogue'],
    nuances: ['Tense backshift rules: simple present becomes simple past in indirect.', "Time/place references change: 'today' becomes 'that day', 'here' becomes 'there'.", 'Commands use "told/asked/ordered + to + infinitive".'],
  },
  {
    language: 'English', domain: 'tenses_perfect', label: 'Perfect Tenses',
    gradeMin: 9, gradeMax: 10, boards: ['*'],
    description: 'Present perfect, past perfect, future perfect, and their continuous forms -- form, time markers, and use.',
    examPatterns: ['fill in with correct perfect tense', 'since/for exercises', 'sequence of events with past perfect'],
    nuances: ["Present perfect with 'since' (point in time) vs. 'for' (duration).", 'Past perfect for the earlier of two past actions.'],
  },
  {
    language: 'English', domain: 'modals', label: 'Modals',
    gradeMin: 9, gradeMax: 10, boards: ['*'],
    description: 'Modal verbs (can, could, may, might, shall, should, will, would, must, ought to) -- form and semantic function.',
    examPatterns: ['fill in with suitable modal', 'rewrite using given modal', 'identify modal function'],
    nuances: ["'Should' for advice, 'must' for obligation, 'have to' for external necessity.", "'May' for permission (formal), 'can' for permission (informal)."],
  },
  {
    language: 'English', domain: 'clauses', label: 'Clauses',
    gradeMin: 9, gradeMax: 10, boards: ['*'],
    description: 'Noun, adjective (relative), and adverb clauses; defining vs non-defining relative clauses.',
    examPatterns: ['identify the clause type', 'combine using a relative pronoun', 'add punctuation for non-defining clause'],
    nuances: ["Defining relative clauses don't use commas; non-defining ones do.", "'Whom' (object) vs 'who' (subject) in relative clauses."],
  },
  {
    language: 'English', domain: 'non_finites', label: 'Non-Finites (Infinitive, Gerund, Participle)',
    gradeMin: 9, gradeMax: 10, boards: ['*'],
    description: 'Infinitive (to + V), gerund (V+ing as noun), and participle (V+ing/V3 as adjective) -- identification and use.',
    examPatterns: ['identify non-finite type', 'fill in with infinitive/gerund', 'rewrite using participle phrase'],
    nuances: ["After prepositions, always use gerund: 'interested in reading', not 'to read'.", 'Some verbs take only gerund (avoid, enjoy, mind), others only infinitive (wish, want, decide).'],
  },
  {
    language: 'English', domain: 'editing_omission', label: 'Editing and Omission (Error Correction)',
    gradeMin: 9, gradeMax: 10, boards: ['CBSE'],
    description: 'CBSE-specific editing and omission exercises: spotting and correcting grammar errors in a passage.',
    examPatterns: ['identify and correct the error', 'fill in the missing word', 'rewrite the corrected paragraph'],
    nuances: ['One error per line in CBSE editing; look for tense, article, preposition errors.', 'Omission: a word is missing -- identify the correct word and write it.'],
  },
  {
    language: 'English', domain: 'sentence_transformation', label: 'Sentence Transformation',
    gradeMin: 9, gradeMax: 10, boards: ['CBSE', 'ICSE'],
    description: 'Combining/splitting sentences, degree transformation, voice/narration change, and rewriting using given words.',
    examPatterns: ['rewrite using "although"', 'combine without using "and"', 'change degree of comparison'],
    nuances: ['No change in meaning is the primary rule -- paraphrase must be semantically identical.', 'Beginning with a given word forces students to rethink sentence structure.'],
  },
  {
    language: 'English', domain: 'conditionals', label: 'Conditionals',
    gradeMin: 9, gradeMax: 10, boards: ['*'],
    description: 'Zero, first, second, and third conditionals -- form, meaning (real vs. unreal/hypothetical), and mixed conditionals.',
    examPatterns: ['fill in with correct conditional form', 'identify condition type', 'rewrite in another conditional type'],
    nuances: ['Type 2 uses past simple + would, not "would + would".', 'Type 3 expresses regret about the past (unreal past).'],
  },

  // --- Grades 11-12 (CBSE/ICSE/IB/IGCSE) ---
  {
    language: 'English', domain: 'idioms_phrases', label: 'Idioms and Phrasal Verbs',
    gradeMin: 11, gradeMax: 12, boards: ['*'],
    description: 'Common idiomatic expressions and multi-word verbs (phrasal verbs) -- meaning, register, and use in context.',
    examPatterns: ['use in a sentence', 'choose the correct meaning', 'rewrite using an idiom'],
    nuances: ['Phrasal verbs can be separable or inseparable.', 'Idiom meaning rarely matches literal word meaning -- context is the key.'],
  },
  {
    language: 'English', domain: 'advanced_transformation', label: 'Advanced Sentence Transformation',
    gradeMin: 11, gradeMax: 12, boards: ['CBSE', 'ICSE'],
    description: 'Complex synthesis, cleft sentences, inversion for emphasis, and rhetorical transformations.',
    examPatterns: ['rewrite emphasising the given element', 'invert to begin with "Seldom"', 'combine using given structure'],
    nuances: ["Inversion after negative adverbials: 'Never have I seen...' (auxiliary before subject).", 'Cleft sentences: It is/was + focused element + that/who clause.'],
  },
  {
    language: 'English', domain: 'note_making_summary', label: 'Note Making and Summary',
    gradeMin: 11, gradeMax: 12, boards: ['CBSE'],
    description: 'Organised note-making from a passage, use of abbreviations, and condensing a passage into a summary.',
    examPatterns: ['make notes on the given passage', 'write a summary in 80 words', 'create a title and sub-headings'],
    nuances: ['Notes use abbreviations and symbols -- not full sentences.', 'Summary must be in continuous prose, not point form.'],
  },
  {
    language: 'English', domain: 'literary_grammar', label: 'Grammar in Literary Context (IB/IGCSE)',
    gradeMin: 11, gradeMax: 12, boards: ['IB', 'IGCSE'],
    description: 'Stylistic grammar: foregrounding, marked themes, passive for objectivity, modality for hedging -- in literary analysis.',
    examPatterns: ['comment on the effect of the passive voice here', 'identify how modality creates uncertainty', 'analyse sentence structure'],
    nuances: ['IB/IGCSE expects grammar discussion in terms of effect, not just form.', 'Writers choose grammar for impact -- always ask "why this structure here?".'],
  },

  // ============================================================
  // HINDI
  // ============================================================

  // --- Grades 6-8 ---
  {
    language: 'Hindi', domain: 'sangya', label: 'Sangya (Noun -- Naama)',
    gradeMin: 6, gradeMax: 8, boards: ['*'],
    description: 'Vyakti-vachak, jati-vachak, bhaav-vachak, samuh-vachak, and dravya-vachak sangya -- definition, identification, examples.',
    examPatterns: ['sangya ke bhed likhiye', 'vakya mein sangya pahchaniey', 'udaaharan sahit paribhasha'],
    nuances: ['Bhaav-vachak sangya is abstract -- students confuse with visheshan.', 'Samuh-vachak sangya refers to a group as a single unit.'],
  },
  {
    language: 'Hindi', domain: 'sarvanam', label: 'Sarvanam (Pronoun)',
    gradeMin: 6, gradeMax: 8, boards: ['*'],
    description: 'Purush-vachak, nishchay-vachak, anishchay-vachak, sambandh-vachak, prashna-vachak, and nij-vachak sarvanam.',
    examPatterns: ['sarvanam bhed pahchaniey', 'rekhankit sarvanam ka bhed bataiey', 'rikt sthan bhariey'],
    nuances: ["'Aap' is both respectful second person and reflexive (apne aap) -- context differentiates.", 'Nij-vachak: apna, apni, apne -- always refers back to subject.'],
  },
  {
    language: 'Hindi', domain: 'visheshan', label: 'Visheshan (Adjective)',
    gradeMin: 6, gradeMax: 8, boards: ['*'],
    description: 'Gunvachak, parimaan-vachak, sankhya-vachak, sarvanam-janya visheshan -- bhed and tulnatmak roop (comparative/superlative).',
    examPatterns: ['visheshan pahchaniey', 'tulnatmak roop likhiye', 'vakya mein visheshan ka prayog'],
    nuances: ['Visheshan agrees in gender and number with the noun it qualifies.', "Parimaan-vachak can be definite ('do kilo') or indefinite ('bahut')."],
  },
  {
    language: 'Hindi', domain: 'kriya', label: 'Kriya (Verb)',
    gradeMin: 6, gradeMax: 8, boards: ['*'],
    description: 'Sakarma-akarma kriya, prerna-rtha kriya, sanyukt kriya, and kriya ke kaal (tense) -- vartman, bhoot, bhavishy.',
    examPatterns: ['kriya bhed pahchaniey', 'kriya ka kaal bataiey', 'kriya roop badaliey'],
    nuances: ['Sakarma kriya needs an object; akarma kriya does not.', 'Prerna-rtha (causative) has two levels: praapak and prerna.'],
  },
  {
    language: 'Hindi', domain: 'ling_vachan', label: 'Ling aur Vachan (Gender and Number)',
    gradeMin: 6, gradeMax: 8, boards: ['*'],
    description: 'Pulling vs. striling, ek vachan vs. bahu vachan -- transformation rules and exceptions.',
    examPatterns: ['ling badaliey', 'vachan badaliey', 'sahi roop chuniey'],
    nuances: ['Many Hindi gender assignments are arbitrary -- students must memorise.', "Collective nouns remain singular in Hindi: 'Ladke khel rahe hain' (bahu vachan used here)."],
  },
  {
    language: 'Hindi', domain: 'karak', label: 'Karak aur Vibhakti',
    gradeMin: 6, gradeMax: 8, boards: ['*'],
    description: '8 karak: karta, karma, karan, sampradaan, apadan, sambandh, adhikaran, sambodhan -- with their vibhakti (case markers).',
    examPatterns: ['vibhakti pahchaniey', 'karak ka naam bataiey', 'vakya mein karak rekhankit kariye'],
    nuances: ["'Ne' marks karta in perfect tenses with transitive verbs -- a common confusion point.", "'Ko' can mark karma or sampradaan -- context determines which."],
  },
  {
    language: 'Hindi', domain: 'vilom_paryayavachi', label: 'Vilom aur Paryaayavaachi Shabd',
    gradeMin: 6, gradeMax: 8, boards: ['*'],
    description: 'Antonyms (vilom shabd) and synonyms (paryaayavaachi shabd) -- commonly tested sets in board exams.',
    examPatterns: ['vilom shabd likhiye', 'paryaayavaachi bataiey', 'samaan arth shabd chuniey'],
    nuances: ['Hindi synonyms carry subtle register differences -- classical vs colloquial.', 'Antonym pairs are fixed in NCERT/board lists; memorisation is essential.'],
  },
  {
    language: 'Hindi', domain: 'anek_shabdon_ke_liye_ek_shabd', label: 'Anek Shabdon ke liye Ek Shabd',
    gradeMin: 6, gradeMax: 8, boards: ['*'],
    description: 'Condensing a phrase or description into a single Hindi word -- a standard vocabulary exercise.',
    examPatterns: ['ek shabd dijiye', 'rikt sthan bhariey', 'match the column'],
    nuances: ['These are fixed collocations -- students must memorise the standard list.', 'Often tested as MCQ or fill-in-the-blank in SA1/SA2.'],
  },

  // --- Grades 9-10 ---
  {
    language: 'Hindi', domain: 'sandhi', label: 'Sandhi (Sound Junction)',
    gradeMin: 9, gradeMax: 10, boards: ['*'],
    description: 'Swar sandhi (dirgha, gun, vriddhi, ayan, yaan), vyanjan sandhi, and visarg sandhi -- rules, splitting, joining.',
    examPatterns: ['sandhi kijiye', 'sandhi-viched kijiye', 'sandhi ka bhed bataiey'],
    nuances: ['Swar sandhi is most common; students confuse gun and vriddhi.', 'Visarg sandhi rules vary by the following consonant class -- use a chart.'],
  },
  {
    language: 'Hindi', domain: 'samas', label: 'Samas (Compound Words)',
    gradeMin: 9, gradeMax: 10, boards: ['*'],
    description: 'Avyayibhaav, tatpurush (6 sub-types), dvandva, dviguu, bahuvrihi, and karmadharaya samas -- vigraha and identification.',
    examPatterns: ['samaas-vigraha kijiye', 'samaas ka bhed bataiey', 'samaas parichay dijiye'],
    nuances: ['Bahuvrihi names something else, not the compound itself -- the key differentiator.', 'Tatpurush sub-type is identified by the vibhakti in the vigraha.'],
  },
  {
    language: 'Hindi', domain: 'muhavare_lokoktiyan', label: 'Muhaavare aur Lokoktiyan',
    gradeMin: 9, gradeMax: 10, boards: ['*'],
    description: 'Commonly used Hindi idioms (muhavare) and proverbs (lokoktiyan) -- meaning and use in sentences.',
    examPatterns: ['muhavare ka arth likhiye', 'vakya mein prayog kijiye', 'lokokti ka arth bataiey'],
    nuances: ['Muhaavare are phrases used within a sentence; lokoktiyan are complete sentences.', 'Both must be used in context -- never just define.'],
  },
  {
    language: 'Hindi', domain: 'ras_chhand_alankar', label: 'Ras, Chhand, Alankar',
    gradeMin: 9, gradeMax: 10, boards: ['*'],
    description: 'Nauras (9 ras), doha/chaupai/sortha (chhand), and shabd/arth alankar (upama, rupak, utpreksha, anupraas).',
    examPatterns: ['ras pahchaniey', 'chhand ka naam bataiey', 'alankar pahchaniey aur paribhasha dijiye'],
    nuances: ['Ras needs identification of sthayi bhaav, vibhaav, anubhaav, sanchari bhaav.', 'Chhand: doha has 24+26 maatraa; chaupai has 4 charan of 16 maatraa each.'],
  },

  // --- Grades 11-12 ---
  {
    language: 'Hindi', domain: 'sandhi_advanced', label: 'Sandhi (Advanced)',
    gradeMin: 11, gradeMax: 12, boards: ['*'],
    description: 'Complex sandhi cases, exceptions, and sandhi in Sanskrit-origin tatsam words used in Hindi prose.',
    examPatterns: ['jatil sandhi-viched', 'tatsam shabdon mein sandhi pahchaniey', 'nirukti sahit sandhi parichay'],
    nuances: ['At 11-12 level, sandhi appears in literary prose analysis -- not just as isolated exercise.'],
  },
  {
    language: 'Hindi', domain: 'samas_advanced', label: 'Samas (Advanced)',
    gradeMin: 11, gradeMax: 12, boards: ['*'],
    description: 'Multi-word samas, complex vigraha, and samas in literary/classical passages.',
    examPatterns: ['jatil samaas ka vigraha', 'tatpurush ke upabhed pahchaniey', 'gadyansh mein samaas rekhankit kijiye'],
    nuances: ['At 11-12, samas questions are embedded in prose extracts, not standalone lists.'],
  },
  {
    language: 'Hindi', domain: 'alankar_advanced', label: 'Alankar (Advanced)',
    gradeMin: 11, gradeMax: 12, boards: ['*'],
    description: 'All 8 major alankar including vyatireka, vibhavana, mानवीकरण (personification), and bhrantiman -- with kavita examples.',
    examPatterns: ['alankar parichay dijiye', 'kavita panktiyaan mein alankar bataiey', 'shodaran parichay'],
    nuances: ['At 11-12, alankar must be identified AND explained in terms of kavita ka prabhav.'],
  },
  {
    language: 'Hindi', domain: 'nibandh_lekhan', label: 'Nibandh aur Patra Lekhan',
    gradeMin: 11, gradeMax: 12, boards: ['CBSE', 'STATE'],
    description: 'Formal essay (nibandh) structure, formal/informal letter (patra) writing with grammar accuracy.',
    examPatterns: ['5-mark nibandh likhiye', 'aupcharik/anaupcharik patra', 'sandesh lekhan'],
    nuances: ['Nibandh: bhoomika + vishay-vastu (3-4 paragraphs) + upasanhar.', 'Aupcharik patra uses respectful language; anaupcharik is conversational.'],
  },

  // ============================================================
  // SANSKRIT
  // ============================================================

  {
    language: 'Sanskrit', domain: 'sandhi_sanskrit', label: 'Sandhi',
    gradeMin: 6, gradeMax: 8, boards: ['CBSE', 'ICSE', 'STATE'],
    description: 'Swar sandhi, vyanjan sandhi, and visarg sandhi in Sanskrit -- rules and application to textbook shloka.',
    examPatterns: ['sandhi-viched kijiye', 'sandhi kijiye', 'sandhi ka bhed likhiye'],
    nuances: ['Sanskrit sandhi rules are more extensive than Hindi -- 12+ swar sandhi sub-types.', 'Always anchor to a shloka from the textbook to make it concrete.'],
  },
  {
    language: 'Sanskrit', domain: 'shabda_roop', label: 'Shabda Roop (Noun Declension)',
    gradeMin: 6, gradeMax: 8, boards: ['CBSE', 'ICSE', 'STATE'],
    description: 'Declension of common nouns across 8 cases (vibhakti) and 3 numbers (vachan) for all 3 genders.',
    examPatterns: ['shabda roop likhiye', 'vibhakti pahchaniey', 'rikt sthan bhariye'],
    nuances: ['Students must memorise paradigm tables (ram, lata, phala for 3 genders).', 'Vibhakti determines function in sentence -- equivalent to English preposition + case.'],
  },
  {
    language: 'Sanskrit', domain: 'dhatu_lakar', label: 'Dhatu Roop aur Lakar (Verb Conjugation)',
    gradeMin: 6, gradeMax: 8, boards: ['CBSE', 'ICSE', 'STATE'],
    description: 'Conjugation of common dhatu (roots) in Lat (present), Lung (simple past), Lot (imperative), and Vidhiling (potential) lakar.',
    examPatterns: ['dhatu roop likhiye', 'lakar ka naam bataiey', 'sahi roop chuniey'],
    nuances: ['Three persons (purush) x three numbers = 9 forms per lakar.', 'Parasmaipadi vs atmanepadi dhatu -- must be learned per root.'],
  },
  {
    language: 'Sanskrit', domain: 'karak_vibhakti_sanskrit', label: 'Karak aur Vibhakti',
    gradeMin: 7, gradeMax: 9, boards: ['CBSE', 'ICSE', 'STATE'],
    description: '7 karak (karta to adhikaran) mapped to 8 vibhakti -- application in sentence construction and translation.',
    examPatterns: ['vibhakti bataiye', 'vakya mein karak pahchaniey', 'anuvad kijiye'],
    nuances: ['Second vibhakti marks karma (object) -- different from Hindi usage.', 'Sambodhan is the 8th vibhakti for address -- not a karak.'],
  },
  {
    language: 'Sanskrit', domain: 'samas_sanskrit', label: 'Samas',
    gradeMin: 9, gradeMax: 10, boards: ['CBSE', 'ICSE', 'STATE'],
    description: 'Avyayibhaav, tatpurush, dvandva, dviguu, bahuvrihi, and karmadharaya samas in Sanskrit -- vigraha and identification.',
    examPatterns: ['samaas-vigraha kijiye', 'samaas ka bhed likhiye', 'gadyansh mein samaas pahchaniey'],
    nuances: ['Sanskrit samas vigraha requires correct vibhakti forms.', 'Bahuvrihi in Sanskrit often has three-word vigraha.'],
  },
  {
    language: 'Sanskrit', domain: 'pratyay_upsarg', label: 'Pratyay aur Upsarg',
    gradeMin: 9, gradeMax: 10, boards: ['CBSE', 'STATE'],
    description: 'Krit pratyay (verb-based), taddhit pratyay (noun-based), and 22 upsarg -- meaning change when added to dhatu.',
    examPatterns: ['pratyay pahchaniey', 'upsarg likhiye', 'shabd ka arth badaliey'],
    nuances: ['Same upsarg changes meaning differently with different dhatu.', 'Taddhit pratyay creates nouns from other nouns/adjectives.'],
  },
  {
    language: 'Sanskrit', domain: 'anuvad_rachna', label: 'Anuvad aur Vakya Rachna',
    gradeMin: 9, gradeMax: 12, boards: ['CBSE', 'ICSE', 'STATE'],
    description: 'Hindi-to-Sanskrit and Sanskrit-to-Hindi translation, and sentence construction using given grammatical elements.',
    examPatterns: ['Sanskrit mein anuvad kijiye', 'Hindi mein anuvad kijiye', 'shabdon se vakya banaiey'],
    nuances: ['Correct vibhakti and lakar are the primary marking criteria in translation.', 'SOV word order in Sanskrit: Subject + Object + Verb.'],
  },

  // ============================================================
  // FRENCH
  // ============================================================

  {
    language: 'French', domain: 'articles_gender_number_fr', label: 'Articles and Gender/Number Agreement',
    gradeMin: 6, gradeMax: 8, boards: ['CBSE', 'ICSE', 'IB', 'IGCSE'],
    description: 'Definite (le, la, les), indefinite (un, une, des), and partitive (du, de la) articles; noun gender and number agreement.',
    examPatterns: ['fill in with correct article', 'make the adjective agree', 'choose le/la/les'],
    nuances: ['Gender of French nouns must be memorised -- no reliable pattern.', "Plural nouns use 'les' regardless of gender."],
  },
  {
    language: 'French', domain: 'verbes_present', label: 'Verbes au Present (Present Tense Verbs)',
    gradeMin: 6, gradeMax: 8, boards: ['CBSE', 'ICSE', 'IB', 'IGCSE'],
    description: 'Conjugation of etre, avoir, and regular -er/-ir/-re verbs in present tense; common irregular verbs (aller, faire, venir).',
    examPatterns: ['conjuguez le verbe', 'completez avec la forme correcte', 'traduisez en francais'],
    nuances: ["Stem-changing verbs (-cer, -ger) change spelling for nous form.", "'Etre' vs 'avoir' as auxiliary for compound tenses must be learned early."],
  },
  {
    language: 'French', domain: 'negation_questions_fr', label: 'Negation and Questions',
    gradeMin: 6, gradeMax: 8, boards: ['CBSE', 'ICSE', 'IB', 'IGCSE'],
    description: "Negation with ne...pas, ne...jamais, ne...rien; questions with est-ce que, inversion, and question words (qui, que, ou, quand, pourquoi, comment).",
    examPatterns: ['mettez a la forme negative', 'posez la question', 'repondez a la question'],
    nuances: ["In spoken French, 'ne' is often dropped -- but always required in written/formal.", "Inversion: verb before subject pronoun -- 'Parles-tu francais?'"],
  },
  {
    language: 'French', domain: 'passe_compose_imparfait', label: 'Passe Compose and Imparfait',
    gradeMin: 9, gradeMax: 10, boards: ['CBSE', 'ICSE', 'IB', 'IGCSE'],
    description: "Past tense: passe compose (completed action) with avoir/etre + past participle, and imparfait (habit/description in past).",
    examPatterns: ['mettez au passe compose', 'mettez a l\'imparfait', 'choisissez le bon temps'],
    nuances: ["Verbs of movement (aller, venir, partir...) use 'etre' as auxiliary in passe compose.", 'Imparfait for background/description; passe compose for main event.'],
  },
  {
    language: 'French', domain: 'pronoms_fr', label: 'Pronoms (Pronouns)',
    gradeMin: 9, gradeMax: 10, boards: ['CBSE', 'ICSE', 'IB', 'IGCSE'],
    description: 'Subject, direct object (COD), indirect object (COI), and reflexive pronouns -- placement and order.',
    examPatterns: ['remplacez par un pronom', 'placez le pronom correctement', 'combinez les deux phrases'],
    nuances: ['COD comes before COI except with 3rd person pronouns (le/la/les before lui/leur).', 'Reflexive pronouns must agree with subject.'],
  },
  {
    language: 'French', domain: 'futur_conditionnel_fr', label: 'Futur Simple and Conditionnel',
    gradeMin: 10, gradeMax: 12, boards: ['CBSE', 'ICSE', 'IB', 'IGCSE'],
    description: 'Future simple (regular/irregular stems) and conditional (politeness, hypothesis) -- form and function.',
    examPatterns: ['mettez au futur', 'mettez au conditionnel', 'si + imparfait + conditionnel'],
    nuances: ['Future stem for irregular verbs (aller -> ir-, etre -> ser-, avoir -> aur-) must be memorised.', 'Conditional is used for polite requests and hypothetical statements.'],
  },
  {
    language: 'French', domain: 'subjonctif_fr', label: 'Subjonctif',
    gradeMin: 11, gradeMax: 12, boards: ['CBSE', 'IB', 'IGCSE'],
    description: 'Present subjunctive formation and use after expressions of doubt, emotion, necessity (il faut que, vouloir que, bien que).',
    examPatterns: ['mettez au subjonctif', 'completez avec la forme correcte', 'identifiez le mode'],
    nuances: ["Subjunctive is triggered by the main verb or expression -- 'que' is the structural signal.", 'Many irregular subjunctive forms must be memorised (etre, avoir, aller, faire).'],
  },

  // ============================================================
  // URDU
  // ============================================================

  {
    language: 'Urdu', domain: 'urdu_grammar_basics', label: 'Urdu Qawaid -- Bunyadi (Basics)',
    gradeMin: 6, gradeMax: 8, boards: ['CBSE', 'STATE'],
    description: 'Isam (noun), zameer (pronoun), sifat (adjective), fail (verb) -- classification and identification in text.',
    examPatterns: ['isam pahchaniey', 'sifat bataiye', 'fail ka roop badliey'],
    nuances: ['Urdu gender (muzakkar/muannas) determines verb and adjective agreement.', 'Persian/Arabic loanwords dominate formal Urdu -- gender assignments differ from Hindi.'],
  },
  {
    language: 'Urdu', domain: 'urdu_muhavre_zarb_ul_misal', label: 'Muhavre aur Zarb ul Misal',
    gradeMin: 9, gradeMax: 10, boards: ['CBSE', 'STATE'],
    description: 'Urdu idioms (muhavre) and proverbs (zarb ul misal) -- meaning and use in sentences.',
    examPatterns: ['muhavare ka istemal kijiye', 'zarb ul misal ka matlab bataiey', 'jumlah likhiey'],
    nuances: ['Many Urdu idioms are Persian/Arabic in origin -- students must memorise meanings.', 'Proverbs carry cultural wisdom -- contextual use matters in CBSE essays.'],
  },
  {
    language: 'Urdu', domain: 'urdu_asnaf_e_adab', label: 'Asnaf-e-Adab (Literary Forms)',
    gradeMin: 9, gradeMax: 12, boards: ['CBSE', 'STATE'],
    description: 'Ghazal, nazm, qasida, masnavi, rubayi -- characteristics and examples from the syllabus text.',
    examPatterns: ['asnaf pahchaniey', 'ghazal ki khasiyat bataiey', 'shayr ka matlab likhiey'],
    nuances: ['Ghazal: each sher is independent but shares radif and qafia.', 'Nazm has a central theme -- unlike the fragmented ghazal.'],
  },

  // ============================================================
  // REGIONAL LANGUAGES (Marathi, Bengali, Tamil, Telugu, Kannada, Gujarati, Punjabi)
  // Each follows: noun/pronoun/verb/adjective (Grades 6-8),
  //               sandhi/samas/idioms/voice (Grades 9-10),
  //               advanced literary grammar (Grades 11-12)
  // ============================================================

  {
    language: 'Marathi', domain: 'marathi_vyakaran_basic', label: 'Marathi Vyakaran (Basic)',
    gradeMin: 6, gradeMax: 8, boards: ['STATE'],
    description: 'Naam, sarvanaam, visheshan, kriyapad -- classification and use in Marathi prose.',
    examPatterns: ['pad-parichay kara', 'rikt jagha bhara', 'vakya sudhara'],
    nuances: ['Marathi verb agreement differs by tense -- present vs. past agreement rules.', 'Vibhakti pratyay in Marathi is post-positional (suffix).'],
  },
  {
    language: 'Marathi', domain: 'marathi_samas_sandhi', label: 'Samas aur Sandhi (Marathi)',
    gradeMin: 9, gradeMax: 10, boards: ['STATE'],
    description: 'Marathi samas (dvandva, tatpurush, bahuvrihi) and sandhi rules in Marathi literary text.',
    examPatterns: ['samaas-vigrah kara', 'sandhi pahcha', 'samas-bhed liha'],
    nuances: ['Marathi samas follows Sanskrit rules but with Marathi phonology applied.'],
  },
  {
    language: 'Bengali', domain: 'bangla_vyakaran_basic', label: 'Bengali Vyakaran (Basic)',
    gradeMin: 6, gradeMax: 8, boards: ['STATE', 'ICSE'],
    description: 'Noun (sangya), pronoun (sarbonaam), adjective (bisheshan), verb (kriya) in Bengali with gender and number.',
    examPatterns: ['pad-porichoy dao', 'shunyo sthan puro koro', 'bakyo shuddho koro'],
    nuances: ['Bengali nouns do not have grammatical gender -- natural gender only.', 'Verb conjugation is based on person and formality level, not gender.'],
  },
  {
    language: 'Tamil', domain: 'tamil_ilakkanam_basic', label: 'Tamil Ilakkanam (Basic)',
    gradeMin: 6, gradeMax: 8, boards: ['STATE'],
    description: 'Peyar (noun), vidai (verb), uriyai (adjective), idai (adverb) -- identification and sentence use in Tamil.',
    examPatterns: ['sol vaguppu kuru', 'vendum idam niraippu', 'thappu thiruththu'],
    nuances: ['Tamil is an agglutinative language -- suffixes change the grammatical role of a word.', 'Classical vs. colloquial Tamil differ significantly -- textbooks use literary Tamil.'],
  },
  {
    language: 'Telugu', domain: 'telugu_vyakaranam_basic', label: 'Telugu Vyakaranam (Basic)',
    gradeMin: 6, gradeMax: 8, boards: ['STATE'],
    description: 'Namavachakam (noun), kriyavachakam (verb), viseshanam (adjective) in Telugu with sandhi rules.',
    examPatterns: ['padalu kalagalannu chepu', 'samasa vigraham cheyyi', 'sandhi prayogam'],
    nuances: ['Telugu sandhi (samasa rules) is extensive -- practice with textbook examples.'],
  },
  {
    language: 'Kannada', domain: 'kannada_vyakarana_basic', label: 'Kannada Vyakarana (Basic)',
    gradeMin: 6, gradeMax: 8, boards: ['STATE'],
    description: 'Naama (noun), kriya (verb), vishesha (adjective), sandhi, samasa in Kannada with examples from prose.',
    examPatterns: ['pada parichaya', 'sandhi vibhajise', 'samasa vigraha'],
    nuances: ['Kannada sandhi is phonologically driven -- knowledge of Kannada script helps.'],
  },
  {
    language: 'Gujarati', domain: 'gujarati_vyakaran_basic', label: 'Gujarati Vyakaran (Basic)',
    gradeMin: 6, gradeMax: 8, boards: ['STATE'],
    description: 'Naam (noun), sarvanam (pronoun), visheshan (adjective), kriya (verb) in Gujarati prose.',
    examPatterns: ['pad-parichay apo', 'khali jaga bharo', 'vakya sudhar karo'],
    nuances: ['Gujarati has three genders (masculine, feminine, neuter).', 'Verb forms change based on gender of subject in some tenses.'],
  },
  {
    language: 'Punjabi', domain: 'punjabi_vyakaran_basic', label: 'Punjabi Vyakaran (Basic)',
    gradeMin: 6, gradeMax: 8, boards: ['STATE'],
    description: 'Naam (noun), purnava (pronoun), visheshan (adjective), kiriya (verb) in Punjabi with case markers.',
    examPatterns: ['shabd da vargiakaran karo', 'khali thaav bharo', 'vakya sahi karo'],
    nuances: ['Punjabi has two genders; verbs agree with the subject in gender/number.'],
  },
];

// ---------------------------------------------------------------------------
// Detection utilities
// ---------------------------------------------------------------------------

const LANGUAGE_SUBJECT_PATTERNS: Array<[RegExp, LanguageName]> = [
  [/english/i, 'English'],
  [/hindi/i, 'Hindi'],
  [/sanskrit/i, 'Sanskrit'],
  [/french/i, 'French'],
  [/urdu/i, 'Urdu'],
  [/marathi/i, 'Marathi'],
  [/bengali|bangla/i, 'Bengali'],
  [/tamil/i, 'Tamil'],
  [/telugu/i, 'Telugu'],
  [/kannada/i, 'Kannada'],
  [/gujarati/i, 'Gujarati'],
  [/punjabi/i, 'Punjabi'],
];

export function detectSubjectType(subjectName: string): SubjectType {
  if (STEM_PATTERNS.test(subjectName)) return 'stem';
  if (SOCIAL_PATTERNS.test(subjectName)) return 'social_science';
  if (ARTS_PATTERNS.test(subjectName)) return 'arts';
  for (const [pattern] of LANGUAGE_SUBJECT_PATTERNS) {
    if (pattern.test(subjectName)) return 'language';
  }
  return 'stem';
}

export function detectLanguageName(subjectName: string): LanguageName | null {
  for (const [pattern, lang] of LANGUAGE_SUBJECT_PATTERNS) {
    if (pattern.test(subjectName)) return lang;
  }
  return null;
}

const GRAMMAR_TOPIC_PATTERNS =
  /tense|voice|narration|parts of speech|article|preposition|conjunction|pronoun|noun|verb|adjective|adverb|clause|phrase|gerund|participle|infinitive|modal|conditional|subjunctive|editing|omission|transformation|agreement|gender|number|sandhi|samas|karak|vibhakti|ling|vachan|kriya|sarvanam|visheshan|sangya|muhavare|lokokti|alankar|ras|chhand|pratyay|dhatu|lakar|shabda roop|passif|imparfait|futur|subjonctif|conditionnel|pronom|zarb ul misal|muhavre|ilakkanam|vyakaranam|vyakaran|vyakarana|grammar|grammaire|qawaid/i;

const POETRY_TOPIC_PATTERNS =
  /poem|poetry|kavita|doha|shlok|ghazal|verse|stanza|rhyme|padya|nazm|rubayi|kavya|prabandha/i;

const COMPOSITION_TOPIC_PATTERNS =
  /letter writing|write a letter|formal letter|informal letter|letter to the editor|letter to the principal|letter to the manager|essay writing|paragraph writing|notice writing|report writing|story writing|application writing|advertisement writing|speech writing|creative writing|patra lekhan|nibandh lekhan|sandesh lekhan/i;

const COMPREHENSION_TOPIC_PATTERNS =
  /comprehension|unseen passage|reading comprehension|gadyansh|padyansh|apathit/i;

const DRAMA_TOPIC_PATTERNS =
  /drama|play|natika|ekankee|script|dialogue/i;

export function detectTopicCategory(topicName: string, chapterName: string): TopicCategory {
  const combined = `${topicName} ${chapterName}`;
  if (GRAMMAR_TOPIC_PATTERNS.test(combined)) return 'grammar';
  if (POETRY_TOPIC_PATTERNS.test(combined)) return 'poetry';
  if (COMPOSITION_TOPIC_PATTERNS.test(combined)) return 'composition';
  if (COMPREHENSION_TOPIC_PATTERNS.test(combined)) return 'comprehension';
  if (DRAMA_TOPIC_PATTERNS.test(combined)) return 'drama';
  return 'prose';
}

/**
 * Returns all grammar domains applicable for a given language, board, and grade.
 * Results are ordered so more specific board matches appear first.
 */
export function getGrammarDomainsForContext(
  language: LanguageName,
  board: string,
  grade: number,
): GrammarDomainSpec[] {
  return GRAMMAR_TAXONOMY.filter(
    spec =>
      spec.language === language &&
      grade >= spec.gradeMin &&
      grade <= spec.gradeMax &&
      (spec.boards.includes('*') || spec.boards.includes(board)),
  ).sort((a, b) => {
    const aSpecific = !a.boards.includes('*') ? 1 : 0;
    const bSpecific = !b.boards.includes('*') ? 1 : 0;
    return bSpecific - aSpecific;
  });
}

/**
 * Infers the primary grammar domain for a topic from its name and chapter.
 * Returns the first matching domain spec, or undefined when no match.
 */
export function inferGrammarDomain(
  topicName: string,
  chapterName: string,
  language: LanguageName,
  board: string,
  grade: number,
): GrammarDomainSpec | undefined {
  const available = getGrammarDomainsForContext(language, board, grade);
  const combined = `${topicName} ${chapterName}`.toLowerCase();

  // Attempt keyword matching against domain/label
  for (const spec of available) {
    const keywords = [spec.domain, spec.label, ...spec.description.split(/\s+/).slice(0, 6)]
      .join(' ')
      .toLowerCase();
    const domainKeywords = spec.domain.replace(/_/g, ' ');
    if (
      combined.includes(domainKeywords) ||
      combined.includes(spec.label.toLowerCase().split(' ')[0])
    ) {
      return spec;
    }
    void keywords; // suppress unused-var warning -- reserved for future fuzzy matching
  }

  // Fall back to first available domain for this grade/board/language
  return available[0];
}

/**
 * Builds the LanguageSubjectMeta to inject into prompt templates.
 * Returns null when the subject is not a language subject.
 */
export function buildLanguageMeta(
  subjectName: string,
  topicName: string,
  chapterName: string,
  board: string,
  grade: number,
): LanguageSubjectMeta | null {
  const language = detectLanguageName(subjectName);
  if (!language) return null;

  const topicCategory = detectTopicCategory(topicName, chapterName);
  const domainSpec = inferGrammarDomain(topicName, chapterName, language, board, grade);

  return {
    language,
    topicCategory,
    grammarDomain: domainSpec?.domain,
    grammarLabel: domainSpec?.label,
    grammarDescription: domainSpec?.description,
    examPatterns: domainSpec?.examPatterns,
    nuances: domainSpec?.nuances,
  };
}
