# Smart Feedback — Taxonomy Audit

Generated from the code by `scripts/taxonomy-audit.ts`. Do not edit by hand.

For every topic: what can file it, what is weak evidence, what was rejected and why, and whether its meaning depends on who did it. Rules that apply to every topic are in [SMART_FEEDBACK_INTELLIGENCE_RULES.md](SMART_FEEDBACK_INTELLIGENCE_RULES.md): negation, clause scope, attribution, past-versus-now, and the look-alike phrases masked before anything is read.

**Legend.**
- *Specific*: a phrase of two or more words, so the evidence is strong.
- *Weak*: a single word. A confident contradiction from the second reader may overrule it.
- *Attribution-sensitive*: the topic's wording ("late", "rude", "cancelled") means nothing until it is clear who did it. A clause about the customer, other people, another business or an event is set aside rather than filed.

**Coverage.** 119 topics across 7 verticals. 56 of them are attribution-sensitive.


## Clinic / Healthcare (`clinic`)

### `wait_time` — Long waiting time

Problem · severity high · other side: `short_wait`

- **Specific phrases (24):** "long time", "bahut time", "kaafi time", "time lagta", "वेळ जास्त", "वेळ लागला", "खूप वेळ", "वाट पाहावी", "वाट बघावी", "उशीर झाला", "long wait", "had to wait", "kept waiting", "waited for hours", "बहुत इंतजार", "wait karna pada", "wait karna padta", "wait karna padega", "wait karaya", "wait karwaya", "bahut wait", "itna wait", "kaafi wait", "wait karte rahe"
- **Weak, single words (14):** "waiting", "waited", "queue", "delay", "delayed", "late", "intezaar", "intzar", "der", "उशीर", "प्रतीक्षा", "इंतजार", "देरी", "इंतज़ार"
- **Aspect route:** WAIT: one of "wait", "waiting" with "long", "endless", "forever" within five words
- **Rejected:** "wait" (round one)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `appointment_scheduling` — Appointment / booking problems

Problem · severity high

- **Specific phrases (18):** "no confirmation", "double book", "appointment nahi", "वेळ मिळाली नाही", "appointment was cancelled", "appointment cancelled", "cancelled my appointment", "cancelled without", "no slot", "slot not available", "no appointment available", "could not get an appointment", "couldn't get an appointment", "booking problem", "अपॉइंटमेंट मिळाली नाही", "अपॉइंटमेंट रद्द", "बुकिंग रद्द", "अपॉइंटमेंट नाही"
- **Weak, single words (1):** "reschedul*"
- **Aspect route:** —
- **Rejected:** "reschedul" (round one)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `billing_clarity` — Unclear or unexpected billing

Problem · severity high · other side: `fair_pricing`

- **Specific phrases (43):** "extra money", "zyada charge", "जास्त पैसे", "wrong bill", "bill was wrong", "billing error", "extra charge", "charged extra", "charged more", "unexpected bill", "bill zyada", "extra paise", "billing was confusing", "billing is confusing", "bill was confusing", "confusing bill", "unclear bill", "bill was unclear", "bill was not explained", "billing was wrong", "billing is wrong", "wrong billing", "billing was incorrect", "billing mistake", "बिल चुकीचे", "बिल जास्त", "जास्त बिल", "पैसे जास्त घेतले", "अतिरिक्त शुल्क", "charged me extra", "charged us extra", "charged me more", "फी जास्त", "fees are high", "fee is high", "too expensive", "unexplained charges", "charges i did not understand", "did not understand the charges", "did not understand the bill", "no breakdown", "charges were not explained", "charges not explained"
- **Weak, single words (6):** "expensive", "costly", "overcharge", "hidden", "mehnga", "महाग"
- **Aspect route:** BILL: one of "bill", "billing", "invoice", "receipt", "बिल" with "mistake", "mistakes", "galti", "wrong", "error", "errors", "incorrect", "extra" within five words; PRICE: one of "price", "pricing", "rate", "cost", "fee", "charge", "brokerage", "commission"… with "high", "higher", "steep", "expensive", "costly", "pricey", "overpriced", "went up" within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `staff_behaviour` — Reception / staff behaviour

Problem · severity high · other side: `staff_friendly`

- **Specific phrases (16):** "bad behaviour", "bad behavior", "rude behaviour", "poor behaviour", "staff was rude", "staff were rude", "staff are rude", "reception was rude", "receptionist was rude", "no one at the desk", "nobody at the desk", "वाईट वागणूक", "उद्धट वागणूक", "वाईट व्यवहार", "स्टाफ उद्धट", "shouted at"
- **Weak, single words (14):** "rude", "attitude", "unprofessional", "shouted", "badtameez", "tameez", "उद्धट", "shrugged", "बदतमीज़ी", "बदतमीजी", "बदतमीज", "dismissive", "arrogant", "misbehav*"
- **Aspect route:** STAFF: one of "staff", "waiter", "waitress", "server", "manager", "receptionist", "reception", "nurse"… with "rude", "arrogant", "dismissive", "unprofessional", "unhelpful", "careless", "badtameez", "उद्धट" (or a generic opinion word: weak) within five words
- **Rejected:** "misbehav" (round two)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `cleanliness` — Cleanliness / hygiene

Problem · severity high · other side: `clean_facility`

- **Specific phrases (13):** "poor hygiene", "no hygiene", "bad hygiene", "hygiene issue", "dirty washroom", "washroom was dirty", "washroom not clean", "toilet was dirty", "toilet not clean", "safai nahi", "सफाई नाही", "सफाई नव्हती", "स्वच्छता नाही"
- **Weak, single words (9):** "dirty", "unclean", "smell", "unhygienic", "dusty", "ganda", "गंदा", "अस्वच्छ", "घाण"
- **Aspect route:** HYGIENE: one of "towel", "towels", "tools", "tool", "combs", "comb", "scissors", "razor"… with "dirty", "rusty", "reused", "unsterilised", "unsterilized", "unhygienic", "stained", "गंदा" within five words; CLEAN: one of "place", "washroom", "toilet", "restroom", "bathroom", "floor", "table", "room"… with "dirty", "filthy", "unclean", "smelly", "smells", "smelled", "stinks", "damp" within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `consultation_rush` — Consultation felt rushed

Problem · severity high · other side: `doctor_care`

- **Specific phrases (12):** "no time", "two minutes", "didn't listen", "did not listen", "not explain", "sunna nahi", "समजावले नाही", "सुना नहीं", "in a hurry", "barely examined", "did not examine", "didn't examine"
- **Weak, single words (7):** "rushed", "hurry", "hurried", "jaldi", "घाई", "जल्दी", "जल्दी-जल्दी"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `followup_communication` — Poor follow-up / report delays

Problem · severity medium

- **Specific phrases (25):** "no response", "not reply", "no callback", "उत्तर नाही", "जवाब नहीं", "no report", "report not", "report was delayed", "still waiting for the report", "no follow up", "never followed up", "no followup", "test result not", "रिपोर्ट मिळाला नाही", "रिपोर्ट उशीरा", "फोन आला नाही", "report was late", "reports were delayed", "no updates", "never called back", "no one called back", "nobody called", "no one called", "never called", "no follow-up"
- **Weak, single words (0):** —
- **Aspect route:** COMMS: one of "communication", "coordination", "updates", "update", "replies", "reply", "response", "responses"… with "silent", "slow", "lacking", "zero", "nil", "missing", "late" (or a generic opinion word: weak) within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `treatment_outcome` — Concern about treatment outcome

Problem · severity high · other side: `good_outcome`

- **Specific phrases (16):** "no relief", "not cured", "wrong diagnosis", "side effect", "pain still", "fayda nahi", "aaram nahi", "आराम नाही", "फायदा नाही", "no improvement", "pain is still", "still in pain", "still have pain", "no difference", "did not help", "didn't help"
- **Weak, single words (3):** "worse", "misdiagnos", "चुकीचे"
- **Aspect route:** OUTCOME: one of "pain", "symptoms", "problem", "infection", "cough", "fever", "swelling", "allergy"… with "came back", "returned", "worse", "persists", "still there", "no difference", "not better" within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `parking_access` — Parking / access difficulty

Problem · severity low

- **Specific phrases (15):** "hard to find", "no lift", "no parking", "parking problem", "nowhere to park", "hard to park", "parking nahi", "too many stairs", "only stairs", "gaadi kahan", "पार्किंग नाही", "पार्किंगची अडचण", "जागा नाही", "लिफ्ट नाही", "फक्त जिना"
- **Weak, single words (0):** —
- **Aspect route:** PARKING: one of "parking", "parking space", "parking spot", "parking spots", "parking lot" with "impossible", "difficult", "limited", "hard", "tough", "nightmare", "terrible", "hopeless" (or a generic opinion word: weak) within five words
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `phone_unreachable` — Phone not answered

Problem · severity medium

- **Specific phrases (24):** "phone not", "call not", "never picks", "not answering", "phone nahi", "फोन उचलत नाही", "फोन नहीं उठाया", "संपर्क होत नाही", "संपर्क झाला नाही", "nobody answers", "no one answers", "nobody picks up", "no one picks up", "did not pick up", "didn't pick up", "not picking up", "never answers", "does not answer", "hard to reach", "difficult to reach", "hard to get", "hard to contact", "difficult to contact", "hard to get through"
- **Weak, single words (1):** "unreachable"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `doctor_care` — Doctor's care and explanation

Praise

- **Specific phrases (13):** "acha samjhaya", "doctor was good", "doctor was very good", "doctor was great", "doctor was excellent", "doctor was amazing", "good doctor", "great doctor", "excellent doctor", "best doctor", "very patient", "examined properly", "kind doctor"
- **Weak, single words (8):** "explained", "caring", "listened", "समजावून", "छान", "अच्छे", "thorough", "patiently"
- **Aspect route:** DOCTOR: one of "doctor", "dr", "doc", "physician", "dentist", "डॉक्टर" with "thorough", "experienced", "knowledgeable", "explain", "explains", "explained", "listens", "listened" (or a generic opinion word: weak) within five words
- **Rejected:** "kind" (round three), "very kind" (round four), "so kind" (round four), "was kind" (round four), "is kind" (round four)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `staff_friendly` — Friendly, helpful staff

Praise

- **Specific phrases (16):** "अच्छा व्यवहार", "staff was good", "staff were good", "staff are good", "staff was great", "staff were great", "staff are great", "staff was lovely", "staff were lovely", "staff are lovely", "staff is lovely", "staff is good", "staff is great", "very kind", "nurse was kind", "nurse was gentle"
- **Weak, single words (8):** "friendly", "helpful", "polite", "supportive", "cooperative", "मदत", "नम्र", "gentle"
- **Aspect route:** STAFF: one of "staff", "waiter", "waitress", "server", "manager", "receptionist", "reception", "nurse"… with "welcoming", "courteous", "warm", "sweet", "attentive" (or a generic opinion word: weak) within five words
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `clean_facility` — Clean, well-kept clinic

Praise

- **Specific phrases (1):** "well maintained"
- **Weak, single words (8):** "clean", "neat", "hygienic", "spotless", "safai", "स्वच्छ", "साफ", "नीटनेटके"
- **Aspect route:** HYGIENE: one of "towel", "towels", "tools", "tool", "combs", "comb", "scissors", "razor"… with "clean", "fresh", "sanitised", "sanitized", "sterilised", "sterilized", "disposable", "new" within five words; CLEAN: one of "place", "washroom", "toilet", "restroom", "bathroom", "floor", "table", "room"… with "clean", "spotless", "neat", "hygienic", "tidy", "maintained", "well maintained", "स्वच्छ" within five words
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `short_wait` — Short waiting times

Praise

- **Specific phrases (10):** "no wait", "on time", "jaldi mila", "समय पर", "quick appointment", "seen quickly", "saw me quickly", "seen immediately", "no waiting", "seen on time"
- **Weak, single words (4):** "prompt", "immediately", "वेळेवर", "लगेच"
- **Aspect route:** WAIT: one of "wait", "waiting" with "short", "quick", "minimal" within five words
- **Rejected:** "quick" (round three)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `fair_pricing` — Fair, transparent pricing

Praise

- **Specific phrases (6):** "fair price", "not expensive", "योग्य दर", "good value", "great value", "value for money"
- **Weak, single words (5):** "reasonable", "affordable", "transparent", "वाजवी", "किफायती"
- **Aspect route:** PRICE: one of "price", "pricing", "rate", "cost", "fee", "charge", "brokerage", "commission"… with "reasonable", "fair", "affordable", "cheap", "worth", "वाजवी", "किफायती" within five words
- **Rejected:** "value" (round three)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `good_outcome` — Good treatment result

Praise

- **Specific phrases (10):** "better now", "aaram mila", "बरे वाटले", "medicine worked", "medicines worked", "treatment worked", "it worked", "therapy worked", "worked well", "worked for me"
- **Weak, single words (7):** "relief", "cured", "recovered", "improved", "fayda", "आराम", "फायदा"
- **Aspect route:** OUTCOME: one of "pain", "symptoms", "problem", "infection", "cough", "fever", "swelling", "allergy"… with "gone", "went away", "better", "cured", "healed", "improved", "worked" within five words
- **Rejected:** "worked" (round two)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `modern_equipment` — Modern equipment / facilities

Praise

- **Specific phrases (1):** "well equipped"
- **Weak, single words (3):** "modern", "latest", "आधुनिक"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

## Coaching / Tuition Centre (`coaching`)

### `teaching_quality` — Teaching quality / doubt clearing

Problem · severity high

- **Specific phrases (18):** "not explained", "poor teaching", "doesn't teach", "समजत नाही", "पढ़ाया नहीं", "teaching is not", "teacher does not", "teacher did not", "faculty is not", "doubts not cleared", "doubt not cleared", "concepts not clear", "concept not clear", "nahi shikav", "नीट शिकवत नाही", "शिकवत नाही", "शिक्षक नीट नाही", "पढ़ाई अच्छी नहीं"
- **Weak, single words (0):** —
- **Aspect route:** TEACHER: one of "teacher", "teaching", "faculty", "tutor", "sir", "madam", "maam", "शिक्षक" with "boring", "confusing", "unclear" (or a generic opinion word: weak) within five words
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `faculty_turnover` — Teachers changed mid-course

Problem · severity high

- **Specific phrases (24):** "teacher changed", "new teacher", "faculty left", "different teacher", "शिक्षक बदलले", "टीचर बदल", "फैकल्टी बदल", "teacher was changed", "teachers keep changing", "teacher keeps changing", "changed the teacher", "teacher left", "teachers left", "teacher changes", "teacher replaced", "teacher was replaced", "teachers were replaced", "faculty replaced", "replaced the teacher", "replaced our teacher", "teachers change", "teacher change", "faculty change", "faculty keeps changing"
- **Weak, single words (0):** —
- **Aspect route:** —
- **Rejected:** "replaced" (round two)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `batch_size` — Batch too large / no attention

Problem · severity high

- **Specific phrases (16):** "too many students", "batch size", "no individual attention", "60 students", "मुलं जास्त", "ध्यान नहीं", "बॅच मोठा", "बॅचमध्ये गर्दी", "too many kids", "overcrowded batch", "huge batch", "no one gets attention", "nobody gets attention", "खूप मुलं", "बहुत सारे बच्चे", "bahut bachche"
- **Weak, single words (3):** "crowded", "गर्दी", "overcrowded"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `fee_transparency` — Fee / refund disputes

Problem · severity high

- **Specific phrases (47):** "money back", "extra charge", "material charge", "fees increased", "fee was increased", "extra fees", "no refund of fees", "fees wapas nahi", "फी जास्त", "फी वाढवली", "अतिरिक्त शुल्क", "पैसे परत नाही", "fees were increased", "increased the fees", "fee hike", "hiked the fees", "fees are too high", "fees too high", "fee is too high", "too expensive", "no refund", "refund not", "not refunded", "never refunded", "refused to refund", "refused a refund", "refused the refund", "refund refused", "refund denied", "denied a refund", "denied refund", "did not refund", "didn't refund", "won't refund", "will not refund", "refund pending", "refund still pending", "waiting for my refund", "waiting for the refund", "waiting for refund", "still no refund", "asked for a refund", "asking for a refund", "refund is pending", "refund has not", "refund hasn't", "refund of fees"
- **Weak, single words (2):** "hidden", "रिफंड"
- **Aspect route:** PRICE: one of "price", "pricing", "rate", "cost", "fee", "charge", "brokerage", "commission"… with "high", "higher", "steep", "expensive", "costly", "pricey", "overpriced", "went up" within five words
- **Rejected:** "refund" (round two)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `communication_parents` — Poor communication with parents

Problem · severity medium

- **Specific phrases (18):** "no update", "not informed", "no response", "never told", "माहिती नाही", "जानकारी नहीं", "poor communication", "no communication", "never informed the parents", "no parent meeting", "parents were not informed", "संपर्क नाही", "पालकांना कळवले नाही", "without telling", "without informing", "not told", "never told us", "no information"
- **Weak, single words (0):** —
- **Aspect route:** COMMS: one of "communication", "coordination", "updates", "update", "replies", "reply", "response", "responses"… with "silent", "slow", "lacking", "zero", "nil", "missing", "late" (or a generic opinion word: weak) within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `schedule_reliability` — Classes cancelled or rescheduled

Problem · severity medium

- **Specific phrases (25):** "class off", "timing changed", "समय बदल", "क्लास रद्द", "वेळापत्रक बदलले", "class cancelled", "class canceled", "classes cancelled", "classes canceled", "class was cancelled", "classes were cancelled", "classes get cancelled", "class gets cancelled", "lecture cancelled", "lectures cancelled", "lecture was cancelled", "cancelled the class", "cancelled classes", "cancelled lectures", "start late", "starts late", "started late", "late start", "never start on time", "never starts on time"
- **Weak, single words (3):** "irregular", "postponed", "रद्द"
- **Aspect route:** SCHEDULE: one of "timing", "timings", "schedule", "schedules", "batch timing", "class timing", "classes", "class"… with "changed", "changing", "cancelled", "canceled", "postponed", "irregular", "rescheduled" within five words
- **Rejected:** "cancelled" (round two), "canceled" (round two)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `results_claims` — Results not as promised

Problem · severity high

- **Specific phrases (22):** "not as promised", "false claim", "no results", "results did not", "marks did not improve", "no selection", "rank not", "no rank", "निकाल चांगला नाही", "निकाल लागला नाही", "they claimed", "total lie", "false promise", "fake promise", "fake claims", "promised a rank", "promised selection", "promised results", "promised 100", "guaranteed selection", "guaranteed rank", "promised a top"
- **Weak, single words (4):** "misleading", "vaada", "वादा", "दावा"
- **Aspect route:** —
- **Rejected:** "promised" (round two)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `facility_condition` — Classroom condition / facilities

Problem · severity medium

- **Specific phrases (23):** "classroom was dirty", "small classroom", "crowded classroom", "fan not working", "no fan", "ac not working", "no ac", "too hot", "seating is uncomfortable", "broken bench", "dirty washroom", "washroom was dirty", "toilet was dirty", "वर्ग लहान", "बाक तुटलेले", "पंखा बंद", "स्वच्छता नाही", "fan was not working", "ac does not work", "ac is not working", "room gets very hot", "वर्ग खूप लहान", "classroom is small"
- **Weak, single words (2):** "dirty", "गंदा"
- **Aspect route:** FACILITY: one of "ac", "fan", "ventilation", "air conditioning", "classroom", "bench", "room", "lift"… with "hot", "stuffy", "suffocating", "cramped", "broken", "not working", "never works", "does not work" within five words; CLEAN: one of "place", "washroom", "toilet", "restroom", "bathroom", "floor", "table", "room"… with "dirty", "filthy", "unclean", "smelly", "smells", "smelled", "stinks", "damp" within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `study_material` — Study material quality / delays

Problem · severity medium

- **Specific phrases (18):** "not provided", "late material", "no material", "material not provided", "notes were not", "poor notes", "books not provided", "bad photocopy", "photocopy quality", "साहित्य मिळाले नाही", "नोट्स मिळाल्या नाहीत", "पुस्तक मिळाले नाही", "मटेरियल उशीरा", "material came late", "notes came late", "material was late", "books came late", "no study material"
- **Weak, single words (0):** —
- **Aspect route:** MATERIAL: one of "notes", "material", "books", "test series", "worksheets" with "late", "delayed", "outdated" (or a generic opinion word: weak) within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `safety_discipline` — Safety / discipline concerns

Problem · severity high

- **Specific phrases (11):** "not safe", "safety issue", "no discipline", "poor discipline", "सुरक्षा नाही", "सुरक्षित नाही", "beats students", "beat students", "beats the students", "hits students", "scared to go"
- **Weak, single words (10):** "unsafe", "bullying", "shouted", "beaten", "मारले", "गैरवर्तन", "असुरक्षित", "slapped", "misbehav*", "harass*"
- **Aspect route:** —
- **Rejected:** "misbehav" (round one), "harass" (round one)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `teaching_quality_praise` — Strong teaching

Praise

- **Specific phrases (28):** "explains well", "excellent faculty", "good teacher", "छान शिकवतात", "अच्छा पढ़ाते", "teaching was good", "teaching is good", "teaching was excellent", "great teacher", "excellent teacher", "best teacher", "teachers are good", "faculty is good", "faculty was good", "explain concepts", "explains concepts", "concepts clearly", "good teachers", "great teachers", "chhan shikav", "chhan shikavtat", "explains clearly", "explains very clearly", "explained clearly", "explains every topic", "taught well", "teaches well", "explained well"
- **Weak, single words (2):** "clarity", "समजते"
- **Aspect route:** TEACHER: one of "teacher", "teaching", "faculty", "tutor", "sir", "madam", "maam", "शिक्षक" with "clear", "clearly", "supportive", "dedicated", "patiently" (or a generic opinion word: weak) within five words
- **Rejected:** "concept" (round two)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `individual_attention` — Individual attention

Praise

- **Specific phrases (20):** "individual attention", "one on one", "small batch", "वैयक्तिक लक्ष", "ध्यान देते", "personal attention", "doubt sessions", "doubt session", "clear every doubt", "clears every doubt", "clears doubts", "doubts are cleared", "doubt clearing", "solve doubts", "solves doubts", "personal guidance", "extra time", "extra attention", "extra classes", "available for doubts"
- **Weak, single words (0):** —
- **Aspect route:** —
- **Rejected:** "personal" (round two), "doubt" (round two)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `results_praise` — Improvement in results

Praise

- **Specific phrases (14):** "marks improved", "निकाल सुधारला", "मार्क वाढले", "got a rank", "good rank", "rank improved", "secured a rank", "cleared the exam", "got selected", "big improvement", "improvement in marks", "scored well", "scored high", "improved in"
- **Weak, single words (2):** "passed", "सुधार"
- **Aspect route:** —
- **Rejected:** "rank" (round one), "improvement" (round three), "scored" (round three)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `faculty_support` — Supportive, approachable faculty

Praise

- **Specific phrases (1):** "friendly teacher"
- **Weak, single words (7):** "supportive", "approachable", "motivating", "patient", "मदत", "प्रोत्साहन", "सहकार्य"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `study_material_praise` — Good study material

Praise

- **Specific phrases (7):** "well prepared", "test series", "practice papers", "mock tests helped", "tests really helped", "test series helped", "weekly tests helped"
- **Weak, single words (1):** "पेपर"
- **Aspect route:** MATERIAL: one of "notes", "material", "books", "test series", "worksheets" with "prepared", "useful" (or a generic opinion word: weak) within five words
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `discipline` — Discipline and regularity

Praise

- **Specific phrases (5):** "never cancelled", "classes are regular", "regular classes", "very regular", "regular tests"
- **Weak, single words (7):** "disciplined", "punctual", "organised", "organized", "शिस्त", "नियमित", "वेळेवर"
- **Aspect route:** SCHEDULE: one of "timing", "timings", "schedule", "schedules", "batch timing", "class timing", "classes", "class"… with "flexible", "convenient", "regular", "fixed", "consistent", "punctual" within five words
- **Rejected:** "regular" (round two)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `fee_value` — Fair fees

Praise

- **Specific phrases (13):** "reasonable fees", "योग्य फी", "good value", "great value", "value for money", "worth the money", "worth every rupee", "worth every penny", "worth the price", "worth the cost", "worth paying", "worth the fee", "worth the fees"
- **Weak, single words (3):** "affordable", "वाजवी", "किफायती"
- **Aspect route:** PRICE: one of "price", "pricing", "rate", "cost", "fee", "charge", "brokerage", "commission"… with "reasonable", "fair", "affordable", "cheap", "worth", "वाजवी", "किफायती" within five words
- **Rejected:** "value" (round three), "worth" (round five)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

## Gym / Fitness Studio (`gym`)

### `equipment_condition` — Broken or insufficient equipment

Problem · severity high · other side: `equipment_quality`

- **Specific phrases (17):** "out of order", "old machine", "broken equipment", "equipment is broken", "equipment not working", "treadmill not working", "treadmill was broken", "dumbbells missing", "needs maintenance", "no maintenance", "never repaired", "not repaired", "मशीन खराब", "मशीन बंद", "मशीन तुटली", "machines are broken", "मशीन खराब आहेत"
- **Weak, single words (5):** "broken", "kharab", "खराब", "बंद", "टूटा"
- **Aspect route:** EQUIPMENT: one of "equipment", "machine", "machines", "treadmill", "weights", "dumbbell", "bike", "bikes"… with "broken", "broke", "old", "faulty", "rusty", "kharab", "खराब", "not working" (or a generic opinion word: weak) within five words
- **Rejected:** "not working" (round three)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `crowding` — Overcrowding at peak hours

Problem · severity high

- **Specific phrases (10):** "too many people", "waiting for machine", "no space", "जागा नाही", "crowded at peak", "too crowded", "rush at peak", "jam packed", "hardly move", "no space to"
- **Weak, single words (6):** "crowded", "bheed", "गर्दी", "भीड", "packed", "overcrowded"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `trainer_availability` — Trainer absent or inattentive

Problem · severity high · other side: `trainer_quality`

- **Specific phrases (23):** "no trainer", "not available", "no guidance", "trainer was not", "trainer never", "no coach", "trainer ignored", "no one to guide", "trainer nahi", "no personal training", "ट्रेनर नाही", "ट्रेनर नसतो", "मार्गदर्शन नाही", "कोच नाही", "trainer changes", "trainer keeps changing", "trainer changed", "new trainer every", "milta nahi", "trainer milta nahi", "never around", "never available", "trainer is never"
- **Weak, single words (1):** "ignor*"
- **Aspect route:** —
- **Rejected:** "ignored" (round two)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `cleanliness` — Cleanliness / changing rooms

Problem · severity high · other side: `cleanliness_praise`

- **Specific phrases (13):** "dirty washroom", "washroom was dirty", "toilet was dirty", "changing room was dirty", "dirty changing room", "shower not working", "poor hygiene", "no hygiene", "smells of sweat", "sweat smell", "safai nahi", "सफाई नाही", "स्वच्छता नाही"
- **Weak, single words (10):** "dirty", "unclean", "smell", "ganda", "गंदा", "घाण", "filthy", "smells", "smelly", "stinks"
- **Aspect route:** HYGIENE: one of "towel", "towels", "tools", "tool", "combs", "comb", "scissors", "razor"… with "dirty", "rusty", "reused", "unsterilised", "unsterilized", "unhygienic", "stained", "गंदा" within five words; CLEAN: one of "place", "washroom", "toilet", "restroom", "bathroom", "floor", "table", "room"… with "dirty", "filthy", "unclean", "smelly", "smells", "smelled", "stinks", "damp" within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `membership_billing` — Membership / refund disputes

Problem · severity high · other side: `value_pricing`

- **Specific phrases (47):** "money back", "no refund", "refund not", "charged again", "charged extra", "auto debit without", "renewed without asking", "membership not cancelled", "cancelled but charged", "paise wapas nahi", "पैसे परत नाही", "फी जास्त", "बिल चुकीचे", "not refunded", "never refunded", "refused to refund", "refused a refund", "refused the refund", "refund refused", "refund denied", "denied a refund", "denied refund", "did not refund", "didn't refund", "won't refund", "will not refund", "refund pending", "refund still pending", "waiting for my refund", "waiting for the refund", "waiting for refund", "still no refund", "asked for a refund", "asking for a refund", "refund is pending", "refund has not", "refund hasn't", "charged my card", "charged me again", "charged twice", "double charged", "still charged", "kept charging", "charged after", "after i cancelled", "cancelled my membership", "cancelled the membership"
- **Weak, single words (2):** "रिफंड", "auto-debit"
- **Aspect route:** —
- **Rejected:** "refund" (round two)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `ac_ventilation` — AC / ventilation / temperature

Problem · severity medium

- **Specific phrases (16):** "ac not", "no air", "too hot", "very hot inside", "fan not working", "no fan", "no ventilation", "poor ventilation", "एसी बंद", "एसी चालत नाही", "हवा नाही", "ac never works", "ac does not work", "ac not working", "no proper ventilation", "too hot inside"
- **Weak, single words (4):** "stuffy", "suffocating", "गर्मी", "उकाडा"
- **Aspect route:** FACILITY: one of "ac", "fan", "ventilation", "air conditioning", "classroom", "bench", "room", "lift"… with "hot", "stuffy", "suffocating", "cramped", "broken", "not working", "never works", "does not work" within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `staff_behaviour` — Front-desk / staff behaviour

Problem · severity medium

- **Specific phrases (10):** "staff was rude", "staff were rude", "staff are rude", "bad behaviour", "bad behavior", "rude behaviour", "वाईट वागणूक", "उद्धट वागणूक", "desk were rude", "desk was rude"
- **Weak, single words (5):** "rude", "attitude", "unprofessional", "उद्धट", "misbehav*"
- **Aspect route:** STAFF: one of "staff", "waiter", "waitress", "server", "manager", "receptionist", "reception", "nurse"… with "rude", "arrogant", "dismissive", "unprofessional", "unhelpful", "careless", "badtameez", "उद्धट" (or a generic opinion word: weak) within five words
- **Rejected:** "misbehav" (round one)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `overcommitted_sales` — Sales promises not kept

Problem · severity high

- **Specific phrases (5):** "not as promised", "सांगितले होते", "pushy sales", "sales promise", "promised but"
- **Weak, single words (7):** "promised", "false", "misleading", "lied", "vaada", "वादा", "झूठ"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `class_schedule` — Classes cancelled or changed

Problem · severity medium · other side: `timings`

- **Specific phrases (25):** "timing changed", "class was cancelled", "classes cancelled", "class timing changed", "schedule keeps changing", "zumba was cancelled", "yoga class cancelled", "batch changed", "no classes", "क्लास रद्द", "क्लास बंद", "वेळापत्रक बदलले", "बॅच बदलला", "समय बदल", "class cancelled", "class canceled", "classes were cancelled", "classes get cancelled", "session cancelled", "sessions cancelled", "session was cancelled", "cancelled the class", "cancelled the session", "cancelled classes", "batch cancelled"
- **Weak, single words (0):** —
- **Aspect route:** SCHEDULE: one of "timing", "timings", "schedule", "schedules", "batch timing", "class timing", "classes", "class"… with "changed", "changing", "cancelled", "canceled", "postponed", "irregular", "rescheduled" within five words
- **Rejected:** "cancelled" (round two), "canceled" (round two)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `parking_access` — Parking / access

Problem · severity low

- **Specific phrases (9):** "no space to park", "no parking", "parking problem", "nowhere to park", "parking nahi", "पार्किंग नाही", "गाडी लावायला जागा", "पार्किंगला जागा नाही", "parking ke liye jagah nahi"
- **Weak, single words (0):** —
- **Aspect route:** PARKING: one of "parking", "parking space", "parking spot", "parking spots", "parking lot" with "impossible", "difficult", "limited", "hard", "tough", "nightmare", "terrible", "hopeless" (or a generic opinion word: weak) within five words
- **Rejected:** "जागा नाही" (round three)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `trainer_quality` — Trainer knowledge and attention

Praise

- **Specific phrases (18):** "form correction", "trainer was good", "trainer was great", "trainer was excellent", "good trainer", "great trainer", "best trainer", "trainers are good", "trainers are great", "pushes you", "pushes me", "corrects form", "personal attention", "good guidance", "great guidance", "proper guidance", "care about form", "cares about form"
- **Weak, single words (5):** "knowledgeable", "supportive", "मार्गदर्शन", "प्रेरणा", "motivates"
- **Aspect route:** TRAINER: one of "trainer", "coach", "instructor", "ट्रेनर" with "knowledgeable", "motivating", "supportive" (or a generic opinion word: weak) within five words
- **Rejected:** "guidance" (round three), "motivating" (round three)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `equipment_quality` — Good equipment

Praise

- **Specific phrases (4):** "new machines", "great equipment", "good equipment", "always working"
- **Weak, single words (1):** "variety"
- **Aspect route:** EQUIPMENT: one of "equipment", "machine", "machines", "treadmill", "weights", "dumbbell", "bike", "bikes"… with "new", "modern", "maintained" (or a generic opinion word: weak) within five words
- **Rejected:** "well maintained" (round three), "motivating" (round three)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `cleanliness_praise` — Clean facility

Praise

- **Specific phrases (0):** —
- **Weak, single words (6):** "clean", "hygienic", "neat", "स्वच्छ", "साफ", "नीटनेटके"
- **Aspect route:** HYGIENE: one of "towel", "towels", "tools", "tool", "combs", "comb", "scissors", "razor"… with "clean", "fresh", "sanitised", "sanitized", "sterilised", "sterilized", "disposable", "new" within five words; CLEAN: one of "place", "washroom", "toilet", "restroom", "bathroom", "floor", "table", "room"… with "clean", "spotless", "neat", "hygienic", "tidy", "maintained", "well maintained", "स्वच्छ" within five words
- **Rejected:** "well maintained" (round three)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `atmosphere` — Motivating atmosphere

Praise

- **Specific phrases (11):** "friendly crowd", "great atmosphere", "good atmosphere", "great vibe", "good vibe", "positive vibe", "great energy", "good energy", "positive energy", "great community", "friendly community"
- **Weak, single words (1):** "ऊर्जा"
- **Aspect route:** ATMOSPHERE: one of "atmosphere", "vibe", "energy", "crowd", "community" with "motivating" (or a generic opinion word: weak) within five words
- **Rejected:** "atmosphere" (round two), "vibe" (round two), "energy" (round two), "community" (round two), "motivating" (round three)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `value_pricing` — Fair membership pricing

Praise

- **Specific phrases (13):** "योग्य दर", "good value", "great value", "value for money", "worth the money", "worth every rupee", "worth every penny", "worth the price", "worth the cost", "worth paying", "worth the membership", "worth the fee", "worth the fees"
- **Weak, single words (4):** "affordable", "reasonable", "वाजवी", "किफायती"
- **Aspect route:** PRICE: one of "price", "pricing", "rate", "cost", "fee", "charge", "brokerage", "commission"… with "reasonable", "fair", "affordable", "cheap", "worth", "वाजवी", "किफायती" within five words
- **Rejected:** "value" (round three), "worth" (round five)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `results` — Visible results

Praise

- **Specific phrases (8):** "lost weight", "great results", "good results", "seeing results", "saw results", "visible results", "amazing results", "real results"
- **Weak, single words (5):** "transformation", "gained", "improved", "fitter", "फरक"
- **Aspect route:** —
- **Rejected:** "results" (round two)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `timings` — Convenient timings

Praise

- **Specific phrases (3):** "early morning", "late night", "open till"
- **Weak, single words (2):** "flexible", "सोयीचे"
- **Aspect route:** SCHEDULE: one of "timing", "timings", "schedule", "schedules", "batch timing", "class timing", "classes", "class"… with "flexible", "convenient", "regular", "fixed", "consistent", "punctual" within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

## Real Estate / Property (`real_estate`)

### `listing_accuracy` — Listing did not match reality

Problem · severity high

- **Specific phrases (21):** "photos different", "not as shown", "fake listing", "wrong size", "different property", "not available", "गलत जानकारी", "फोटो वेगळे", "दाखवले तसे नाही", "nothing like the photos", "nothing like the pictures", "nothing like the listing", "not like the photos", "different from the photos", "much smaller", "smaller than", "looked different", "different flat", "different apartment", "fake photos", "old photos"
- **Weak, single words (3):** "misleading", "galat", "चुकीचे"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `responsiveness` — Slow or no response

Problem · severity high

- **Specific phrases (25):** "no response", "not reply", "never called", "no callback", "phone not", "jawab nahi", "उत्तर नाही", "फोन उचलत नाही", "जवाब नहीं", "never called back", "does not pick up", "did not pick up", "no reply", "never replied", "went silent", "gone silent", "stopped replying", "hard to reach", "difficult to reach", "hard to get", "hard to contact", "difficult to contact", "hard to get through", "stopped responding", "went quiet"
- **Weak, single words (3):** "unresponsive", "ignor*", "ghosted"
- **Aspect route:** COMMS: one of "communication", "coordination", "updates", "update", "replies", "reply", "response", "responses"… with "silent", "slow", "lacking", "zero", "nil", "missing", "late" (or a generic opinion word: weak) within five words
- **Rejected:** "ignored" (round two)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `hidden_charges` — Hidden brokerage / charges

Problem · severity high

- **Specific phrases (17):** "hidden charge", "extra money", "asked more", "छुपे शुल्क", "extra brokerage", "high brokerage", "more brokerage", "hidden commission", "extra charges", "hidden charges", "extra paise", "दलाली जास्त", "जास्त कमिशन", "जास्त पैसे मागितले", "added charges", "charges we never agreed", "never agreed to"
- **Weak, single words (0):** —
- **Aspect route:** PRICE: one of "price", "pricing", "rate", "cost", "fee", "charge", "brokerage", "commission"… with "high", "higher", "steep", "expensive", "costly", "pricey", "overpriced", "went up" within five words
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `site_visit_experience` — Site visit problems

Problem · severity medium

- **Specific phrases (22):** "did not turn up", "no show", "owner not", "cancelled visit", "आले नाहीत", "नहीं आया", "site visit was cancelled", "no one came for the site visit", "no keys", "keys were not", "forgot the keys", "साइट भेट रद्द", "भेटीसाठी आले नाहीत", "late to the site visit", "late for the site visit", "late for the visit", "visit was cancelled", "never turned up", "didn't turn up", "never showed up", "did not show up", "didn't show up"
- **Weak, single words (1):** "waited"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `documentation_delay` — Documentation / paperwork delays

Problem · severity high

- **Specific phrases (9):** "agreement was delayed", "documents were delayed", "paperwork is pending", "registration delayed", "noc pending", "still waiting for the documents", "कागदपत्रे उशिरा", "करार उशिरा", "दस्तऐवज प्रलंबित"
- **Weak, single words (3):** "delay", "pending", "देरी"
- **Aspect route:** PAPERWORK: one of "documentation", "documents", "paperwork", "papers", "registration", "sale deed", "agreement", "noc"… with "forever", "delayed", "pending", "slow", "stuck", "longer", "ages" (or a generic opinion word: weak) within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `pressure_tactics` — Pressure / pushy selling

Problem · severity high

- **Specific phrases (8):** "created urgency", "token amount pressure", "kept calling", "close the deal fast", "rushed us", "pushed us", "pushed me", "pushing us"
- **Weak, single words (8):** "forced", "pushy", "hurry", "insisted", "जबरदस्ती", "दबाव", "घाई", "pressur*"
- **Aspect route:** —
- **Rejected:** "pressur" (round one)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `token_refund` — Token / advance not refunded

Problem · severity high

- **Specific phrases (36):** "money not returned", "token not refunded", "token amount not returned", "advance not returned", "advance not refunded", "deposit not returned", "booking amount not returned", "टोकन परत नाही", "आगाऊ रक्कम परत नाही", "पैसे परत नाही", "no refund", "refund not", "not refunded", "never refunded", "refused to refund", "refused a refund", "refused the refund", "refund refused", "refund denied", "denied a refund", "denied refund", "did not refund", "didn't refund", "won't refund", "will not refund", "refund pending", "refund still pending", "waiting for my refund", "waiting for the refund", "waiting for refund", "still no refund", "asked for a refund", "asking for a refund", "refund is pending", "refund has not", "refund hasn't"
- **Weak, single words (1):** "रिफंड"
- **Aspect route:** —
- **Rejected:** "refund" (round two)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `post_deal_support` — Disappeared after the deal

Problem · severity medium

- **Specific phrases (9):** "after deal", "stopped responding", "no support", "not helping now", "after payment", "नंतर संपर्क", "बाद में", "after we paid", "disappeared after"
- **Weak, single words (1):** "करारानंतर"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `professionalism` — Professionalism / behaviour

Problem · severity medium

- **Specific phrases (5):** "bad behaviour", "bad behavior", "rude behaviour", "वाईट वागणूक", "उद्धट वागणूक"
- **Weak, single words (6):** "rude", "unprofessional", "attitude", "late", "उद्धट", "misbehav*"
- **Aspect route:** —
- **Rejected:** "misbehav" (round one)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `unclear_pricing` — Price kept changing

Problem · severity medium

- **Specific phrases (13):** "price changed", "different price", "दर बदलला", "than quoted", "quoted a different", "different from the quoted", "किंमत बदलली", "किंमत वेगळी", "changing the price", "changed the price", "price kept changing", "kept changing the price", "price went up"
- **Weak, single words (1):** "increased"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `transparency` — Honesty and transparency

Praise

- **Specific phrases (12):** "no hidden", "clear bataya", "sab clear", "told us the flaws", "honest guy", "honest broker", "clear about every cost", "clear about the costs", "clear about costs", "clear about the charges", "clear about charges", "clear about the fees"
- **Weak, single words (8):** "honest", "transparent", "upfront", "genuine", "trustworthy", "प्रामाणिक", "पारदर्शक", "ईमानदार"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `responsiveness_praise` — Quick, reliable responses

Praise

- **Specific phrases (10):** "quick reply", "always available", "picks up", "लगेच उत्तर", "जल्दी जवाब", "answered every call", "answers every call", "always answered", "always picks up", "replies quickly"
- **Weak, single words (3):** "responsive", "prompt", "त्वरित"
- **Aspect route:** COMMS: one of "communication", "coordination", "updates", "update", "replies", "reply", "response", "responses"… with "regular", "prompt", "clear", "timely", "quick", "constant" (or a generic opinion word: weak) within five words
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `market_knowledge` — Strong local market knowledge

Praise

- **Specific phrases (12):** "knows the area", "suggested the right", "good advice", "great advice", "sound advice", "good knowledge", "great knowledge", "local knowledge", "knows the market", "knew the market", "knowledge of the area", "good guidance"
- **Weak, single words (2):** "expert", "सल्ला"
- **Aspect route:** —
- **Rejected:** "suggested" (round two), "knowledge" (round three), "advice" (round three), "guidance" (round three)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `options_shown` — Well-matched options

Praise

- **Specific phrases (10):** "exactly the kind", "exactly what we wanted", "good options", "showed us good", "showed us exactly", "showed us many", "showed us several", "matched our budget", "matched our needs", "matched what we wanted"
- **Weak, single words (2):** "shortlist", "दाखवले"
- **Aspect route:** OPTIONS: one of "flats", "flat", "options", "properties", "property", "homes", "apartments", "apartment" with "lovely", "good", "great", "nice", "beautiful", "excellent", "perfect", "shortlisted" within five words
- **Rejected:** "showed" (round two), "matched" (round two)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `paperwork_help` — Help with paperwork

Praise

- **Specific phrases (9):** "helped with", "loan sanctioned", "loan approved", "helped with the loan", "helped us with the loan", "helped with the home loan", "helped us with the home loan", "loan paperwork", "loan process"
- **Weak, single words (1):** "मदत"
- **Aspect route:** PAPERWORK: one of "documentation", "documents", "paperwork", "papers", "registration", "sale deed", "agreement", "noc"… with "smooth", "quick", "fast", "seamless", "sorted", "hassle-free" (or a generic opinion word: weak) within five words
- **Rejected:** "loan" (round two)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `no_pressure` — An unpressured approach

Praise

- **Specific phrases (17):** "no pressure", "not pushy", "took time", "दबाव नाही", "घाई नाही", "आराम से", "gave us time", "no pressure at all", "made us comfortable", "felt comfortable", "never felt pressured", "never pressured", "never rushed", "never pushed", "did not rush", "didn't rush", "never forced"
- **Weak, single words (1):** "patient"
- **Aspect route:** —
- **Rejected:** "comfortable" (round three)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `fair_brokerage` — Fair brokerage

Praise

- **Specific phrases (11):** "reasonable brokerage", "no extra", "योग्य दलाली", "worth the money", "worth every rupee", "worth every penny", "worth the price", "worth the cost", "worth paying", "worth the brokerage", "worth the commission"
- **Weak, single words (3):** "fair", "वाजवी", "उचित"
- **Aspect route:** PRICE: one of "price", "pricing", "rate", "cost", "fee", "charge", "brokerage", "commission"… with "reasonable", "fair", "affordable", "cheap", "worth", "वाजवी", "किफायती" within five words
- **Rejected:** "worth" (round five)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

## Restaurant / Cafe (`restaurant`)

### `food_quality` — Food & taste

Problem · severity high · other side: `food_taste`

- **Specific phrases (26):** "cold food", "no taste", "poor quality", "bad quality", "quality was bad", "quality has gone", "khana bekar", "khana thanda", "swad nahi", "khane mein", "food was cold", "food came cold", "food arrived cold", "food was stale", "food was bland", "food was oily", "चव नाही", "चव खराब", "स्वाद नहीं", "खाना खराब", "खाना थंड", "too salty", "too oily", "rice was stale", "food was not good", "food was bad"
- **Weak, single words (13):** "tasteless", "bland", "stale", "oily", "burnt", "raw", "bekar", "बेचव", "थंड", "बासी", "ठंडा", "undercooked", "overcooked"
- **Aspect route:** FOOD: one of "food", "dish", "meal", "khana", "khaana", "jevan", "biryani", "dal"… with "bland", "stale", "cold", "tasteless", "oily", "burnt", "undercooked", "overcooked" (or a generic opinion word: weak) within five words
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `service_speed` — Slow service

Problem · severity high · other side: `service_quality`

- **Specific phrases (27):** "took forever", "45 minutes", "one hour", "bahut time", "वेळ जास्त", "वेळ लागला", "खूप वेळ", "takes forever", "took ages", "took so long", "took too long", "took a long time", "long wait", "still waiting", "देर से", "बहुत देर", "bahut der", "late aaya", "wait karna pada", "wait karna padta", "wait karna padega", "wait karaya", "wait karwaya", "bahut wait", "itna wait", "kaafi wait", "wait karte rahe"
- **Weak, single words (9):** "slow", "waiting", "waited", "late", "delay", "der", "उशीर", "देरी", "इंतजार"
- **Aspect route:** SPEED: one of "service", "order", "bill", "delivery", "सर्व्हिस", "सर्विस", "सेवा" with "slow", "slowly", "delayed", "forever", "ages", "हळू", "धीमी", "धीमा" within five words; WAIT: one of "wait", "waiting" with "long", "endless", "forever" within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `order_accuracy` — Wrong or missing items

Problem · severity high

- **Specific phrases (17):** "wrong order", "not what i ordered", "different dish", "order galat", "गलत ऑर्डर", "नहीं आया", "forgot our", "never arrived", "wrong dish", "missing item", "order wrong", "order was wrong", "got our order wrong", "got the order wrong", "mixed up our order", "order was mixed up", "order got mixed up"
- **Weak, single words (5):** "missing", "forgot", "galat", "चुकीचे", "चूक"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `staff_behaviour` — Staff behaviour / attentiveness

Problem · severity high · other side: `staff_warmth`

- **Specific phrases (21):** "no attention", "waiter was rude", "rude waiter", "waiter forgot", "waiter did not", "waiter didn't", "waiter ignored", "server was rude", "no one came to the table", "वाईट वागणूक", "उद्धट वागणूक", "वेटर उद्धट", "nobody came", "no one came", "nobody took our order", "no one took our order", "nobody attended", "no one attended", "nobody served", "had to call the waiter", "could not find a waiter"
- **Weak, single words (11):** "rude", "attitude", "unprofessional", "badtameez", "उद्धट", "dismissive", "arrogant", "बदतमीज", "बदतमीज़", "ignor*", "misbehav*"
- **Aspect route:** STAFF: one of "staff", "waiter", "waitress", "server", "manager", "receptionist", "reception", "nurse"… with "rude", "arrogant", "dismissive", "unprofessional", "unhelpful", "careless", "badtameez", "उद्धट" (or a generic opinion word: weak) within five words
- **Rejected:** "ignored" (round two), "misbehav" (round two)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `cleanliness` — Cleanliness

Problem · severity high · other side: `cleanliness_praise`

- **Specific phrases (14):** "poor hygiene", "no hygiene", "hygiene issue", "dirty washroom", "washroom was dirty", "toilet was dirty", "safai nahi", "a fly in", "सफाई नाही", "स्वच्छता नाही", "hair in", "a hair in", "insect in", "cockroach in"
- **Weak, single words (13):** "dirty", "unclean", "smell", "flies", "insect", "cockroach", "ganda", "गंदा", "घाण", "माशी", "filthy", "smells", "smelly"
- **Aspect route:** CLEAN: one of "place", "washroom", "toilet", "restroom", "bathroom", "floor", "table", "room"… with "dirty", "filthy", "unclean", "smelly", "smells", "smelled", "stinks", "damp" within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `pricing_value` — Pricing / value for money

Problem · severity medium · other side: `value_for_money`

- **Specific phrases (17):** "not worth", "not value for money", "no value for money", "charged extra", "service charge added", "paise waste", "किंमत जास्त", "पैसे वाया", "too expensive", "very expensive", "portions were small", "small portion", "small portions", "not worth the money", "price felt high", "price is high", "prices are high"
- **Weak, single words (8):** "expensive", "costly", "overpriced", "mehnga", "महाग", "महंगा", "overcharged", "pricey"
- **Aspect route:** PORTION: one of "portion", "quantity", "serving" with "small", "tiny", "less", "skimpy", "little" within five words; PRICE: one of "price", "pricing", "rate", "cost", "fee", "charge", "brokerage", "commission"… with "high", "higher", "steep", "expensive", "costly", "pricey", "overpriced", "went up" within five words
- **Rejected:** "extra charge" (round three)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `wait_for_table` — Long wait for a table

Problem · severity medium

- **Specific phrases (14):** "no table", "waiting for table", "table nahi", "जगह नहीं", "table not available", "had to wait for a table", "no reservation", "reservation was not", "despite the reservation", "टेबल मिळाले नाही", "टेबलसाठी वाट", "waiting for a table", "wait for a table", "waited for a table"
- **Weak, single words (4):** "queue", "crowded", "गर्दी", "रांग"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `ambience_noise` — Ambience / noise / seating

Problem · severity low · other side: `ambience`

- **Specific phrases (19):** "ac not", "loud music", "music was too loud", "cramped seating", "seating was cramped", "uncomfortable seating", "too hot inside", "no ac", "खूप आवाज", "आवाज जास्त", "जागा कमी", "could not talk", "too noisy", "very loud", "ac was not working", "ac not working", "ac is not working", "ac was off", "fan was not working"
- **Weak, single words (7):** "noisy", "noise", "loud", "cramped", "uncomfortable", "गर्मी", "गोंगाट"
- **Aspect route:** NOISE: one of "music", "noise", "sound" with "loud", "noisy", "deafening" within five words; FACILITY: one of "ac", "fan", "ventilation", "air conditioning", "classroom", "bench", "room", "lift"… with "hot", "stuffy", "suffocating", "cramped", "broken", "not working", "never works", "does not work" within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `delivery_packaging` — Delivery / packaging problems

Problem · severity medium

- **Specific phrases (11):** "delivery was late", "late delivery", "delivery delayed", "poor packaging", "bad packaging", "packaging was", "packing was bad", "parcel was", "पॅकिंग खराब", "डिलिव्हरी उशीरा", "पार्सल गळत"
- **Weak, single words (2):** "spilled", "leaked"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `billing_issue` — Billing errors / hidden charges

Problem · severity medium

- **Specific phrases (24):** "extra charge", "service charge", "wrong bill", "जास्त पैसे", "गलत बिल", "bill was wrong", "billing error", "added to the bill", "extra in the bill", "billing was confusing", "bill was confusing", "confusing bill", "unclear bill", "bill was unclear", "billing was wrong", "billing is wrong", "wrong billing", "billing was incorrect", "billing mistake", "बिल चुकीचे", "जास्त बिल", "बिल गलत", "bill galat", "wrong amount"
- **Weak, single words (1):** "overcharge"
- **Aspect route:** BILL: one of "bill", "billing", "invoice", "receipt", "बिल" with "mistake", "mistakes", "galti", "wrong", "error", "errors", "incorrect", "extra" within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `food_taste` — Food & taste

Praise

- **Specific phrases (24):** "best food", "food was excellent", "food was great", "food was good", "good food", "great food", "excellent food", "loved the food", "biryani was outstanding", "khana accha", "accha khana", "khana badhiya", "khana mast", "food was tasty", "food was delicious", "finger licking", "lip smacking", "loved the dal", "loved the biryani", "best meal", "best dosa", "best biryani", "full of flavour", "full of flavor"
- **Weak, single words (15):** "delicious", "tasty", "yummy", "authentic", "fresh", "mast", "swad", "चवदार", "चव", "स्वादिष्ट", "मस्त", "delicous", "delicios", "flavourful", "flavorful"
- **Aspect route:** FOOD: one of "food", "dish", "meal", "khana", "khaana", "jevan", "biryani", "dal"… with "delicious", "tasty", "yummy", "fresh", "flavourful", "flavorful", "authentic", "स्वादिष्ट" (or a generic opinion word: weak) within five words
- **Rejected:** "flavour" (round two), "flavor" (round two)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `service_quality` — Attentive service

Praise

- **Specific phrases (13):** "quick service", "helpful staff", "अच्छी सेवा", "service was good", "service was great", "service was excellent", "good service", "great service", "excellent service", "fast service", "served quickly", "came quickly", "attentive staff"
- **Weak, single words (3):** "attentive", "prompt", "courteous"
- **Aspect route:** SPEED: one of "service", "order", "bill", "delivery", "सर्व्हिस", "सर्विस", "सेवा" with "quick", "quickly", "fast", "prompt", "promptly", "speedy" within five words; SERVICE: one of "service", "सेवा" with "attentive", "courteous" (or a generic opinion word: weak) within five words
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `ambience` — Ambience and decor

Praise

- **Specific phrases (15):** "lovely ambience", "great ambience", "nice ambience", "good ambience", "ambience was great", "ambience was lovely", "lovely ambiance", "great ambiance", "nice ambiance", "beautiful place", "beautiful decor", "beautiful interiors", "great vibe", "good vibe", "nice vibe"
- **Weak, single words (3):** "cosy", "cozy", "peaceful"
- **Aspect route:** AMBIENCE: one of "ambience", "ambiance", "atmosphere", "vibe", "decor", "interior", "seating", "place" with "cosy", "cozy", "relaxing", "peaceful", "calm", "beautiful", "gorgeous", "stunning" (or a generic opinion word: weak) within five words
- **Rejected:** "vibe" (round two), "beautiful" (round two)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `value_for_money` — Good value for money

Praise

- **Specific phrases (12):** "value for money", "पैसा वसूल", "paisa vasool", "paisa wasool", "paise vasool", "worth the money", "worth every rupee", "good value", "worth every penny", "worth the price", "worth the cost", "worth paying"
- **Weak, single words (5):** "affordable", "reasonable", "generous", "वाजवी", "किफायती"
- **Aspect route:** PORTION: one of "portion", "quantity", "serving" with "generous", "large", "big", "filling", "enough" within five words; PRICE: one of "price", "pricing", "rate", "cost", "fee", "charge", "brokerage", "commission"… with "reasonable", "fair", "affordable", "cheap", "worth", "वाजवी", "किफायती" within five words
- **Rejected:** "worth" (round five)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `cleanliness_praise` — Cleanliness

Praise

- **Specific phrases (1):** "well maintained"
- **Weak, single words (6):** "clean", "hygienic", "neat", "स्वच्छ", "साफ", "नीटनेटके"
- **Aspect route:** CLEAN: one of "place", "washroom", "toilet", "restroom", "bathroom", "floor", "table", "room"… with "clean", "spotless", "neat", "hygienic", "tidy", "maintained", "well maintained", "स्वच्छ" within five words
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `staff_warmth` — Warm, welcoming staff

Praise

- **Specific phrases (18):** "अच्छा व्यवहार", "staff was good", "staff were good", "staff are good", "staff was great", "staff were great", "staff are great", "staff was lovely", "staff were lovely", "staff are lovely", "staff is lovely", "staff is good", "staff is great", "great hospitality", "warm hospitality", "good hospitality", "lovely hospitality", "excellent hospitality"
- **Weak, single words (7):** "friendly", "welcoming", "polite", "warm", "smiling", "आपुलकी", "नम्र"
- **Aspect route:** STAFF: one of "staff", "waiter", "waitress", "server", "manager", "receptionist", "reception", "nurse"… with "welcoming", "courteous", "warm", "sweet", "attentive" (or a generic opinion word: weak) within five words
- **Rejected:** "hospitality" (round two)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `menu_variety` — Menu variety

Praise

- **Specific phrases (0):** —
- **Weak, single words (1):** "variety"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

## Salon / Spa (`salon`)

### `service_result` — Unhappy with the result

Problem · severity high · other side: `stylist_skill`

- **Specific phrases (20):** "bad cut", "not what i asked", "damaged hair", "बाल खराब", "bad haircut", "haircut was bad", "ruined my hair", "hair was ruined", "colour was wrong", "color was wrong", "colour came out", "not what i wanted", "did not like the result", "not happy with the cut", "colour faded", "color faded", "faded within", "faded quickly", "faded in", "faded after"
- **Weak, single words (8):** "botched", "uneven", "ruined", "galat", "kharab", "बिघडले", "खराब", "चुकीचे"
- **Aspect route:** RESULT: one of "haircut", "cut", "hair", "colour", "color", "facial", "styling", "makeup"… with "uneven", "patchy", "ruined", "botched", "damaged", "brassy", "faded", "chipped" (or a generic opinion word: weak) within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `appointment_scheduling` — Appointment / waiting problems

Problem · severity high · other side: `punctuality`

- **Specific phrases (12):** "no confirmation", "appointment was cancelled", "cancelled my appointment", "past my appointment", "late for my appointment", "booking problem", "no slot", "slot not available", "could not get an appointment", "अपॉइंटमेंट रद्द", "अपॉइंटमेंट मिळाली नाही", "बुकिंग रद्द"
- **Weak, single words (0):** —
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `pricing_transparency` — Price quoted vs price charged

Problem · severity high · other side: `value_pricing`

- **Specific phrases (19):** "charged more", "hidden charge", "जास्त पैसे", "than quoted", "than the price quoted", "price was different", "price changed", "charged extra", "extra charge", "wrong bill", "extra paise", "किंमत वेगळी", "जास्त किंमत", "सांगितलेली किंमत", "higher than what", "than what they quote", "than they quoted", "more than quoted", "prices are higher"
- **Weak, single words (4):** "expensive", "overcharge", "mehnga", "महाग"
- **Aspect route:** PRICE: one of "price", "pricing", "rate", "cost", "fee", "charge", "brokerage", "commission"… with "high", "higher", "steep", "expensive", "costly", "pricey", "overpriced", "went up" within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `staff_behaviour` — Staff behaviour / attitude

Problem · severity high · other side: `staff_warmth`

- **Specific phrases (9):** "bad behaviour", "bad behavior", "rude behaviour", "staff was rude", "staff were rude", "staff are rude", "वाईट वागणूक", "उद्धट वागणूक", "वाईट व्यवहार"
- **Weak, single words (6):** "rude", "attitude", "unprofessional", "उद्धट", "misbehav*", "ignor*"
- **Aspect route:** STAFF: one of "staff", "waiter", "waitress", "server", "manager", "receptionist", "reception", "nurse"… with "rude", "arrogant", "dismissive", "unprofessional", "unhelpful", "careless", "badtameez", "उद्धट" (or a generic opinion word: weak) within five words
- **Rejected:** "misbehav" (round one), "ignored" (round two)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `hygiene` — Hygiene & cleanliness

Problem · severity high · other side: `hygiene_praise`

- **Specific phrases (13):** "not sanitised", "not sanitized", "dirty towel", "same towel", "towel was not", "poor hygiene", "no hygiene", "hygiene issue", "safai nahi", "सफाई नाही", "स्वच्छता नाही", "टॉवेल घाण", "तोच टॉवेल"
- **Weak, single words (4):** "dirty", "unclean", "smell", "infection"
- **Aspect route:** HYGIENE: one of "towel", "towels", "tools", "tool", "combs", "comb", "scissors", "razor"… with "dirty", "rusty", "reused", "unsterilised", "unsterilized", "unhygienic", "stained", "गंदा" within five words
- **Rejected:** "गंदा" (round three), "घाण" (round three), "not very clean" (round three)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `upselling_pressure` — Pushy upselling

Problem · severity medium

- **Specific phrases (19):** "kept insisting", "tried to sell", "kept trying to sell", "sell me", "pushed a package", "forced package", "pushed membership", "membership pushed", "पॅकेज घ्यायला लावले", "पॅकेजसाठी जबरदस्ती", "kept pushing", "keeps pushing", "kept selling", "pushing a membership", "pushing a package", "pushed me to", "pushed us to", "pushed products", "pushed a membership"
- **Weak, single words (5):** "forced", "upsell", "जबरदस्ती", "दबाव", "pressur*"
- **Aspect route:** —
- **Rejected:** "pressur" (round one), "pushed" (round two)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `product_quality` — Product quality concerns

Problem · severity medium

- **Specific phrases (15):** "cheap product", "cheap products", "duplicate product", "expired product", "product was bad", "local product", "fake product", "cheap brand", "प्रॉडक्ट खराब", "स्वस्त प्रॉडक्ट", "डुप्लिकेट प्रॉडक्ट", "burning sensation", "harsh chemical", "harsh chemicals", "too much chemical"
- **Weak, single words (11):** "duplicate", "expired", "allergy", "reaction", "एलर्जी", "rash", "itching", "itchy", "irritation", "allergic", "breakout"
- **Aspect route:** —
- **Rejected:** "chemical" (round two)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `wait_time` — Long wait despite appointment

Problem · severity medium · other side: `punctuality`

- **Specific phrases (19):** "long time", "late start", "वाट पाहावी", "वाट बघावी", "वेळ जास्त", "वेळ लागला", "खूप वेळ", "उशीर झाला", "kept waiting", "had to wait", "wait karna pada", "wait karna padta", "wait karna padega", "wait karaya", "wait karwaya", "bahut wait", "itna wait", "kaafi wait", "wait karte rahe"
- **Weak, single words (8):** "waited", "waiting", "delay", "der", "उशीर", "देरी", "इंतजार", "इंतज़ार"
- **Aspect route:** WAIT: one of "wait", "waiting" with "long", "endless", "forever" within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `cleanliness_space` — Salon cleanliness / condition

Problem · severity medium · other side: `hygiene_praise`

- **Specific phrases (11):** "dirty floor", "hair everywhere", "unclean salon", "dirty washroom", "washroom was dirty", "washroom not clean", "toilet was dirty", "toilet not clean", "not very clean", "salon was dirty", "salon is dirty"
- **Weak, single words (4):** "messy", "घाण", "अस्वच्छ", "गंदा"
- **Aspect route:** CLEAN: one of "place", "washroom", "toilet", "restroom", "bathroom", "floor", "table", "room"… with "dirty", "filthy", "unclean", "smelly", "smells", "smelled", "stinks", "damp" within five words
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `phone_unreachable` — Phone / booking channel unresponsive

Problem · severity low

- **Specific phrases (19):** "phone not", "call not", "no reply", "never picks", "not answering", "फोन उचलत नाही", "फोन नहीं उठाया", "जवाब नहीं", "nobody answers", "no one answers", "nobody picks up", "did not pick up", "never answers", "hard to reach", "difficult to reach", "hard to get", "hard to contact", "difficult to contact", "hard to get through"
- **Weak, single words (0):** —
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `stylist_skill` — Stylist skill and result

Praise

- **Specific phrases (26):** "great cut", "loved my hair", "अच्छा किया", "stylist was good", "stylist was great", "stylist was excellent", "good haircut", "great haircut", "haircut was good", "haircut was great", "hair looks great", "hair looks good", "loved my haircut", "loved the haircut", "happy with my haircut", "happy with the haircut", "great facial", "good facial", "lovely colour", "lovely color", "exactly what i asked", "haircut mast", "mast hua", "the look i wanted", "exactly the look", "exactly what i wanted"
- **Weak, single words (5):** "skilled", "expert", "छान", "सुंदर", "मस्त"
- **Aspect route:** RESULT: one of "haircut", "cut", "hair", "colour", "color", "facial", "styling", "makeup"… with "exactly right", "spot on", "neat", "sharp", "clean" (or a generic opinion word: weak) within five words
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `staff_warmth` — Warm, patient staff

Praise

- **Specific phrases (15):** "अच्छा व्यवहार", "staff was good", "staff were good", "staff are good", "staff was great", "staff were great", "staff are great", "staff was lovely", "staff were lovely", "staff are lovely", "staff is lovely", "staff is good", "staff is great", "स्टाफ बहुत अच्छा", "staff bahut acha"
- **Weak, single words (8):** "friendly", "polite", "patient", "listened", "welcoming", "comfortable", "नम्र", "आपुलकी"
- **Aspect route:** STAFF: one of "staff", "waiter", "waitress", "server", "manager", "receptionist", "reception", "nurse"… with "welcoming", "courteous", "warm", "sweet", "attentive" (or a generic opinion word: weak) within five words
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `hygiene_praise` — Hygiene & cleanliness

Praise

- **Specific phrases (1):** "well maintained"
- **Weak, single words (7):** "clean", "hygienic", "sanitised", "sanitized", "स्वच्छ", "साफ", "नीटनेटके"
- **Aspect route:** HYGIENE: one of "towel", "towels", "tools", "tool", "combs", "comb", "scissors", "razor"… with "clean", "fresh", "sanitised", "sanitized", "sterilised", "sterilized", "disposable", "new" within five words; CLEAN: one of "place", "washroom", "toilet", "restroom", "bathroom", "floor", "table", "room"… with "clean", "spotless", "neat", "hygienic", "tidy", "maintained", "well maintained", "स्वच्छ" within five words
- **Rejected:** "neat" (round five)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `ambience` — Relaxing ambience

Praise

- **Specific phrases (2):** "relaxing massage", "head massage"
- **Weak, single words (4):** "relaxing", "calm", "peaceful", "शांत"
- **Aspect route:** AMBIENCE: one of "ambience", "ambiance", "atmosphere", "vibe", "decor", "interior", "seating", "place" with "cosy", "cozy", "relaxing", "peaceful", "calm", "beautiful", "gorgeous", "stunning" (or a generic opinion word: weak) within five words
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `value_pricing` — Fair pricing

Praise

- **Specific phrases (11):** "not expensive", "योग्य दर", "good value", "great value", "value for money", "worth the money", "worth every rupee", "worth every penny", "worth the price", "worth the cost", "worth paying"
- **Weak, single words (4):** "reasonable", "affordable", "वाजवी", "किफायती"
- **Aspect route:** PRICE: one of "price", "pricing", "rate", "cost", "fee", "charge", "brokerage", "commission"… with "reasonable", "fair", "affordable", "cheap", "worth", "वाजवी", "किफायती" within five words
- **Rejected:** "value" (round three), "worth" (round five)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `punctuality` — On-time appointments

Praise

- **Specific phrases (4):** "on time", "no waiting", "समय पर", "took me on time"
- **Weak, single words (4):** "punctual", "prompt", "वेळेवर", "लगेच"
- **Aspect route:** WAIT: one of "wait", "waiting" with "short", "quick", "minimal" within five words
- **Rejected:** "quick" (round three)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `consultation` — Good consultation / advice

Praise

- **Specific phrases (8):** "suggested the right", "suggested a style", "suggested what suits", "good advice", "great advice", "helpful advice", "good consultation", "proper consultation"
- **Weak, single words (5):** "explained", "guided", "सल्ला", "समजावून", "सुझाव"
- **Aspect route:** —
- **Rejected:** "suggested" (round two), "consultation" (round three), "advice" (round three), "recommendation" (round three)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

## Wedding Vendor (`wedding_vendor`)

### `delivery_delay` — Final delivery delayed

Problem · severity high

- **Specific phrases (12):** "still waiting", "not delivered", "photos not", "video not", "मिळाले नाही", "नहीं मिला", "album not delivered", "still waiting for the album", "after months", "several months", "many months", "missed the deadline"
- **Weak, single words (5):** "delay", "delayed", "der", "उशीर", "देरी"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `quality_vs_sample` — Output did not match the samples shown

Problem · severity high

- **Specific phrases (22):** "not like sample", "different quality", "not as shown", "expected better", "जैसा दिखाया", "not like the portfolio", "different from the portfolio", "poor quality", "quality was not", "bad quality", "गुणवत्ता कमी", "गुणवत्ता चांगली नाही", "अपेक्षेपेक्षा कमी", "दाखवले त्यापेक्षा वेगळे", "nothing like the samples", "nothing like the sample", "not like the samples", "nothing like what they showed", "disappointed with the photos", "disappointed with the video", "disappointed with the album", "disappointed with the quality"
- **Weak, single words (0):** —
- **Aspect route:** OUTPUT: one of "photos", "photo", "pictures", "pics", "shots", "candids", "candid", "frames"… with "blurry", "dull", "dark", "grainy", "out of focus", "washed out" (or a generic opinion word: weak) within five words
- **Rejected:** "disappointed" (round two)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `team_substitution` — Different team turned up on the day

Problem · severity high

- **Specific phrases (13):** "different photographer", "someone else came", "team changed", "not the person", "टीम बदलली", "कोई और", "दुसरा फोटोग्राफर", "दुसरी टीम", "different team", "another team", "sent someone else", "sent juniors", "sent a junior"
- **Weak, single words (3):** "junior", "substitute", "trainee"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `communication` — Poor communication before the event

Problem · severity high

- **Specific phrases (26):** "no response", "not reply", "no updates", "hard to reach", "phone not", "उत्तर नाही", "जवाब नहीं", "फोन नहीं", "संपर्क होत नाही", "never replied", "never responded", "did not reply", "didn't reply", "not replying", "no reply", "went silent", "gone silent", "stopped replying", "difficult to reach", "hard to get", "hard to contact", "difficult to contact", "hard to get through", "stopped responding", "went quiet", "gone quiet"
- **Weak, single words (1):** "ignor*"
- **Aspect route:** COMMS: one of "communication", "coordination", "updates", "update", "replies", "reply", "response", "responses"… with "silent", "slow", "lacking", "zero", "nil", "missing", "late" (or a generic opinion word: weak) within five words
- **Rejected:** "ignored" (round two)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `hidden_costs` — Costs added later

Problem · severity high

- **Specific phrases (16):** "extra charge", "hidden cost", "asked more", "छुपे शुल्क", "जास्त पैसे", "additional charge", "additional cost", "more than the quotation", "different from the quotation", "extra paise", "अतिरिक्त शुल्क", "अतिरिक्त पैसे", "charged extra", "charged us extra", "charged me extra", "never mentioned"
- **Weak, single words (1):** "overcharge"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `punctuality` — Late arrival on the day

Problem · severity high

- **Specific phrases (8):** "came late", "not on time", "delay on the day", "der se", "वेळेवर नाही", "देर से", "hours late", "came late on the day"
- **Weak, single words (2):** "late", "उशीरा"
- **Aspect route:** —
- **Rejected:** "missed the" (round one)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `coverage_gaps` — Missed key moments / coverage gaps

Problem · severity high

- **Specific phrases (16):** "did not cover", "no photos of", "missing moments", "छूट गया", "फोटो राहिले", "क्षण राहिले", "मिस झाले", "not a single photo", "no photo of", "not even one photo", "missed the", "photos are missing", "photos were missing", "photos missing", "missing photos", "missing from the album"
- **Weak, single words (2):** "missed", "skipped"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `professionalism` — Behaviour on the day

Problem · severity medium

- **Specific phrases (7):** "bad behaviour", "bad behavior", "rude behaviour", "वाईट वागणूक", "उद्धट वागणूक", "rude to our guests", "rude to the guests"
- **Weak, single words (6):** "rude", "unprofessional", "attitude", "argued", "उद्धट", "misbehav*"
- **Aspect route:** TEAM: one of "team", "photographer", "crew", "coordinator", "staff" with "rude", "unprofessional", "arrogant" (or a generic opinion word: weak) within five words
- **Rejected:** "misbehav" (round one)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `revisions_refused` — Edits / revisions refused

Problem · severity medium

- **Specific phrases (10):** "no correction", "no revisions", "revisions refused", "refused to edit", "refused any changes", "would not make changes", "rejected our request", "बदल करायला नकार", "दुरुस्ती नाकारली", "संशोधन नाकारले"
- **Weak, single words (1):** "refused"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `advance_refund` — Advance not refunded on cancellation

Problem · severity high

- **Specific phrases (35):** "money not returned", "advance not returned", "advance not refunded", "deposit not returned", "booking amount not returned", "cancelled but no refund", "आगाऊ रक्कम परत नाही", "पैसे परत नाही", "रद्द केल्यावर परत नाही", "no refund", "refund not", "not refunded", "never refunded", "refused to refund", "refused a refund", "refused the refund", "refund refused", "refund denied", "denied a refund", "denied refund", "did not refund", "didn't refund", "won't refund", "will not refund", "refund pending", "refund still pending", "waiting for my refund", "waiting for the refund", "waiting for refund", "still no refund", "asked for a refund", "asking for a refund", "refund is pending", "refund has not", "refund hasn't"
- **Weak, single words (1):** "रिफंड"
- **Aspect route:** —
- **Rejected:** "refund" (round two)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `output_quality` — Excellent final output

Praise

- **Specific phrases (14):** "amazing photos", "loved the album", "decor was", "excellent work", "work was excellent", "work was great", "great work", "photos were great", "photos were good", "photos were amazing", "photos are beautiful", "album was beautiful", "photos came out", "album came out beautiful"
- **Weak, single words (7):** "beautiful", "stunning", "सुंदर", "छान", "उत्कृष्ट", "शानदार", "sundar"
- **Aspect route:** OUTPUT: one of "photos", "photo", "pictures", "pics", "shots", "candids", "candid", "frames"… with "stunning", "gorgeous", "breathtaking", "magical" (or a generic opinion word: weak) within five words
- **Rejected:** none removed
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `team_conduct` — Professional, calm team

Praise

- **Specific phrases (7):** "well managed", "handled everything", "handled it well", "handled it perfectly", "handled the rain", "well handled", "handled perfectly"
- **Weak, single words (8):** "professional", "calm", "smooth", "polite", "coordinated", "व्यवस्थित", "शांत", "नियोजन"
- **Aspect route:** TEAM: one of "team", "photographer", "crew", "coordinator", "staff" with "professional", "calm", "organised", "organized" (or a generic opinion word: weak) within five words
- **Rejected:** "handled" (round three)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `communication_praise` — Clear communication

Praise

- **Specific phrases (5):** "always reachable", "regular updates", "kept us updated", "constant updates", "timely updates"
- **Weak, single words (3):** "responsive", "explained", "जवाब"
- **Aspect route:** COMMS: one of "communication", "coordination", "updates", "update", "replies", "reply", "response", "responses"… with "regular", "prompt", "clear", "timely", "quick", "constant" (or a generic opinion word: weak) within five words
- **Rejected:** "updates" (round two)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `punctuality_praise` — Punctuality

Praise

- **Specific phrases (6):** "on time", "arrived early", "no delay", "समय पर", "time pe", "time par"
- **Weak, single words (4):** "punctual", "वेळेवर", "आधीच", "on-time"
- **Aspect route:** —
- **Rejected:** none removed
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.

### `flexibility` — Flexibility and willingness to accommodate

Praise

- **Specific phrases (3):** "last minute", "accommodate every", "accommodated all"
- **Weak, single words (7):** "flexible", "accommodating", "adjusted", "समायोजन", "मदत", "एडजस्ट", "accommodated"
- **Aspect route:** —
- **Rejected:** "helped" (round two)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `value_pricing` — Fair pricing for the work

Praise

- **Specific phrases (6):** "worth every", "no hidden", "योग्य दर", "good value", "great value", "value for money"
- **Weak, single words (4):** "reasonable", "affordable", "वाजवी", "किफायती"
- **Aspect route:** PRICE: one of "price", "pricing", "rate", "cost", "fee", "charge", "brokerage", "commission"… with "reasonable", "fair", "affordable", "cheap", "worth", "वाजवी", "किफायती" within five words
- **Rejected:** "value" (round three)
- **Attribution:** not sensitive. Counted wherever it appears, unless negated or past.

### `delivery_speed` — On-time delivery

Praise

- **Specific phrases (10):** "delivered on time", "quick delivery", "got the album", "as promised", "वेळेत मिळाले", "समय पर मिला", "album on time", "within a month", "got the album on time", "album arrived on time"
- **Weak, single words (0):** —
- **Aspect route:** —
- **Rejected:** "arrived on time" (round one)
- **Attribution:** sensitive. Set aside when the clause is about someone other than the business.
