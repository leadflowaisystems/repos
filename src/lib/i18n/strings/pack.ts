import type { Namespace } from '../t';

/**
 * The vertical packs' own labels, in three languages.
 *
 * These are the only phrases in the dictionary whose keys are not known at
 * compile time. A theme label lives in packs/*.json as DATA — "Long waiting
 * time", "Food taste and quality" — and reaches an owner inside almost every
 * generated sentence: "The main problem they mention is long waiting time."
 * Leaving them English would put an English noun phrase in the middle of every
 * Marathi sentence on Home.
 *
 * Looked up with `t.soft('pack.<vertical>.<themeKey>')`, which returns null
 * when there is no entry, so the pack's own English label is the fallback and a
 * new theme is never a broken screen.
 *
 * THE KEY IS NOT TRANSLATED — only the label. `wait_time` stays `wait_time`
 * everywhere: it is how the code recognises a theme, joins it to feedback and
 * builds a URL. Nothing here may change what a theme IS.
 */
export const pack = {
  // --- restaurant (packs/restaurant.json) ---------------------------------
  'pack.restaurant.food_quality': {
    en: 'Food quality / taste',
    hi: 'खाने की क्वालिटी / स्वाद',
    mr: 'जेवणाची गुणवत्ता / चव',
  },
  'pack.restaurant.service_speed': {
    en: 'Slow service',
    hi: 'धीमी सर्विस',
    mr: 'संथ सर्व्हिस',
  },
  'pack.restaurant.order_accuracy': {
    en: 'Wrong or missing items',
    hi: 'ग़लत या छूटे हुए आइटम',
    mr: 'चुकीचे किंवा न आलेले पदार्थ',
  },
  'pack.restaurant.staff_behaviour': {
    en: 'Staff behaviour / attentiveness',
    hi: 'स्टाफ़ का व्यवहार / ध्यान देना',
    mr: 'स्टाफची वागणूक / लक्ष देणं',
  },
  'pack.restaurant.cleanliness': {
    en: 'Cleanliness / hygiene',
    hi: 'साफ़-सफ़ाई / हाइजीन',
    mr: 'स्वच्छता / हायजीन',
  },
  'pack.restaurant.pricing_value': {
    en: 'Pricing / value for money',
    hi: 'क़ीमत / पैसा वसूल',
    mr: 'किंमत / पैसा वसूल',
  },
  'pack.restaurant.wait_for_table': {
    en: 'Long wait for a table',
    hi: 'टेबल के लिए लंबा इंतज़ार',
    mr: 'टेबलसाठी बराच वेळ प्रतीक्षा',
  },
  'pack.restaurant.ambience_noise': {
    en: 'Ambience / noise / seating',
    hi: 'माहौल / शोर / बैठने की जगह',
    mr: 'वातावरण / आवाज / बसण्याची जागा',
  },
  'pack.restaurant.delivery_packaging': {
    en: 'Delivery / packaging problems',
    hi: 'डिलीवरी / पैकिंग की दिक़्क़तें',
    mr: 'डिलिव्हरी / पॅकिंगच्या अडचणी',
  },
  'pack.restaurant.billing_issue': {
    en: 'Billing errors / hidden charges',
    hi: 'बिलिंग की ग़लतियाँ / छुपे हुए चार्ज',
    mr: 'बिलिंगमधल्या चुका / छुपे चार्ज',
  },
  'pack.restaurant.food_taste': {
    en: 'Food taste and quality',
    hi: 'खाने का स्वाद और क्वालिटी',
    mr: 'जेवणाची चव आणि गुणवत्ता',
  },
  'pack.restaurant.service_quality': {
    en: 'Attentive service',
    hi: 'ध्यान रखने वाली सर्विस',
    mr: 'लक्ष देणारी सर्व्हिस',
  },
  'pack.restaurant.ambience': {
    en: 'Ambience and decor',
    hi: 'माहौल और सजावट',
    mr: 'वातावरण आणि सजावट',
  },
  'pack.restaurant.value_for_money': {
    en: 'Good value for money',
    hi: 'पैसा वसूल क़ीमत',
    mr: 'पैसा वसूल किंमत',
  },
  'pack.restaurant.cleanliness_praise': {
    en: 'Cleanliness and upkeep',
    hi: 'साफ़-सफ़ाई और रख-रखाव',
    mr: 'स्वच्छता आणि देखभाल',
  },
  'pack.restaurant.staff_warmth': {
    en: 'Warm, welcoming staff',
    hi: 'गर्मजोशी से स्वागत करने वाला स्टाफ़',
    mr: 'आपुलकीने स्वागत करणारा स्टाफ',
  },
  'pack.restaurant.menu_variety': {
    en: 'Menu variety',
    hi: 'मेन्यू में वैरायटी',
    mr: 'मेन्यूमधील विविधता',
  },

  // --- gym (packs/gym.json) -----------------------------------------------
  'pack.gym.equipment_condition': {
    en: 'Broken or insufficient equipment',
    hi: 'ख़राब या कम पड़ने वाले उपकरण',
    mr: 'बिघडलेली किंवा कमी पडणारी उपकरणं',
  },
  'pack.gym.crowding': {
    en: 'Overcrowding at peak hours',
    hi: 'पीक टाइम पर ज़्यादा भीड़',
    mr: 'पीक टाइमला होणारी गर्दी',
  },
  'pack.gym.trainer_availability': {
    en: 'Trainer absent or inattentive',
    hi: 'ट्रेनर का न होना या ध्यान न देना',
    mr: 'ट्रेनर नसणं किंवा लक्ष न देणं',
  },
  'pack.gym.cleanliness': {
    en: 'Cleanliness / changing rooms',
    hi: 'साफ़-सफ़ाई / चेंजिंग रूम',
    mr: 'स्वच्छता / चेंजिंग रूम',
  },
  'pack.gym.membership_billing': {
    en: 'Membership / refund disputes',
    hi: 'मेंबरशिप / रिफ़ंड के विवाद',
    mr: 'मेंबरशिप / रिफंडचे वाद',
  },
  'pack.gym.ac_ventilation': {
    en: 'AC / ventilation / temperature',
    hi: 'एसी / वेंटिलेशन / तापमान',
    mr: 'एसी / व्हेंटिलेशन / तापमान',
  },
  'pack.gym.staff_behaviour': {
    en: 'Front-desk / staff behaviour',
    hi: 'फ़्रंट डेस्क / स्टाफ़ का व्यवहार',
    mr: 'फ्रंट डेस्क / स्टाफची वागणूक',
  },
  'pack.gym.overcommitted_sales': {
    en: 'Sales promises not kept',
    hi: 'सेल्स के पूरे न हुए वादे',
    mr: 'सेल्सची न पाळलेली आश्वासनं',
  },
  'pack.gym.class_schedule': {
    en: 'Classes cancelled or changed',
    hi: 'क्लास कैंसिल या बदल जाना',
    mr: 'क्लास रद्द होणं किंवा बदलणं',
  },
  'pack.gym.parking_access': {
    en: 'Parking / access',
    hi: 'पार्किंग / आने-जाने की सुविधा',
    mr: 'पार्किंग / येण्या-जाण्याची सोय',
  },
  'pack.gym.trainer_quality': {
    en: 'Trainer knowledge and attention',
    hi: 'ट्रेनर की जानकारी और ध्यान',
    mr: 'ट्रेनरचं ज्ञान आणि लक्ष',
  },
  'pack.gym.equipment_quality': {
    en: 'Good equipment',
    hi: 'अच्छे उपकरण',
    mr: 'चांगली उपकरणं',
  },
  'pack.gym.cleanliness_praise': {
    en: 'Clean facility',
    hi: 'साफ़-सुथरी जगह',
    mr: 'स्वच्छ जागा',
  },
  'pack.gym.atmosphere': {
    en: 'Motivating atmosphere',
    hi: 'मोटिवेट करने वाला माहौल',
    mr: 'प्रेरणा देणारं वातावरण',
  },
  'pack.gym.value_pricing': {
    en: 'Fair membership pricing',
    hi: 'वाजिब मेंबरशिप फ़ीस',
    mr: 'वाजवी मेंबरशिप फी',
  },
  'pack.gym.results': {
    en: 'Visible results',
    hi: 'दिखने वाले नतीजे',
    mr: 'दिसणारे परिणाम',
  },
  'pack.gym.timings': {
    en: 'Convenient timings',
    hi: 'सुविधाजनक टाइमिंग',
    mr: 'सोयीस्कर वेळा',
  },

  // --- clinic (packs/clinic.json) -----------------------------------------
  'pack.clinic.wait_time': {
    en: 'Long waiting time',
    hi: 'लंबा इंतज़ार',
    mr: 'बराच वेळ प्रतीक्षा',
  },
  'pack.clinic.appointment_scheduling': {
    en: 'Appointment / booking problems',
    hi: 'अपॉइंटमेंट / बुकिंग की दिक़्क़तें',
    mr: 'अपॉइंटमेंट / बुकिंगच्या अडचणी',
  },
  'pack.clinic.billing_clarity': {
    en: 'Unclear or unexpected billing',
    hi: 'अस्पष्ट या अनपेक्षित बिलिंग',
    mr: 'अस्पष्ट किंवा अनपेक्षित बिलिंग',
  },
  'pack.clinic.staff_behaviour': {
    en: 'Reception / staff behaviour',
    hi: 'रिसेप्शन / स्टाफ़ का व्यवहार',
    mr: 'रिसेप्शन / स्टाफची वागणूक',
  },
  'pack.clinic.cleanliness': {
    en: 'Cleanliness / hygiene',
    hi: 'साफ़-सफ़ाई / हाइजीन',
    mr: 'स्वच्छता / हायजीन',
  },
  'pack.clinic.consultation_rush': {
    en: 'Consultation felt rushed',
    hi: 'जल्दबाज़ी में हुआ कंसल्टेशन',
    mr: 'घाईघाईत झालेलं कन्सल्टेशन',
  },
  'pack.clinic.followup_communication': {
    en: 'Poor follow-up / report delays',
    hi: 'कमज़ोर फ़ॉलो-अप / रिपोर्ट में देरी',
    mr: 'कमकुवत फॉलो-अप / रिपोर्टला उशीर',
  },
  'pack.clinic.treatment_outcome': {
    en: 'Concern about treatment outcome',
    hi: 'इलाज के नतीजे को लेकर चिंता',
    mr: 'उपचाराच्या परिणामाबद्दल काळजी',
  },
  'pack.clinic.parking_access': {
    en: 'Parking / access difficulty',
    hi: 'पार्किंग / आने-जाने में दिक़्क़त',
    mr: 'पार्किंग / येण्या-जाण्यात अडचण',
  },
  'pack.clinic.phone_unreachable': {
    en: 'Phone not answered',
    hi: 'फ़ोन का जवाब न मिलना',
    mr: 'फोन न उचलला जाणं',
  },
  'pack.clinic.doctor_care': {
    en: "Doctor's care and explanation",
    hi: 'डॉक्टर की देखभाल और समझाने का तरीक़ा',
    mr: 'डॉक्टरांची काळजी आणि समजावून सांगणं',
  },
  'pack.clinic.staff_friendly': {
    en: 'Friendly, helpful staff',
    hi: 'मिलनसार, मददगार स्टाफ़',
    mr: 'मनमिळाऊ, मदत करणारा स्टाफ',
  },
  'pack.clinic.clean_facility': {
    en: 'Clean, well-kept clinic',
    hi: 'साफ़-सुथरा, अच्छे से रखा गया क्लिनिक',
    mr: 'स्वच्छ, नीटनेटकं क्लिनिक',
  },
  'pack.clinic.short_wait': {
    en: 'Short waiting times',
    hi: 'कम इंतज़ार',
    mr: 'कमी प्रतीक्षा वेळ',
  },
  'pack.clinic.fair_pricing': {
    en: 'Fair, transparent pricing',
    hi: 'वाजिब, साफ़-साफ़ बताई गई क़ीमत',
    mr: 'वाजवी, स्पष्ट सांगितलेली किंमत',
  },
  'pack.clinic.good_outcome': {
    en: 'Good treatment result',
    hi: 'इलाज का अच्छा नतीजा',
    mr: 'उपचाराचा चांगला परिणाम',
  },
  'pack.clinic.modern_equipment': {
    en: 'Modern equipment / facilities',
    hi: 'आधुनिक उपकरण / सुविधाएँ',
    mr: 'आधुनिक उपकरणं / सुविधा',
  },

  // --- salon (packs/salon.json) -------------------------------------------
  'pack.salon.service_result': {
    en: 'Unhappy with the result',
    hi: 'नतीजे से नाख़ुशी',
    mr: 'परिणामाबद्दल नाराजी',
  },
  'pack.salon.appointment_scheduling': {
    en: 'Appointment / waiting problems',
    hi: 'अपॉइंटमेंट / इंतज़ार की दिक़्क़तें',
    mr: 'अपॉइंटमेंट / प्रतीक्षेच्या अडचणी',
  },
  'pack.salon.pricing_transparency': {
    en: 'Price quoted vs price charged',
    hi: 'बताई गई क़ीमत बनाम ली गई क़ीमत',
    mr: 'सांगितलेली किंमत विरुद्ध घेतलेली किंमत',
  },
  'pack.salon.staff_behaviour': {
    en: 'Staff behaviour / attitude',
    hi: 'स्टाफ़ का व्यवहार / रवैया',
    mr: 'स्टाफची वागणूक / वृत्ती',
  },
  'pack.salon.hygiene': {
    en: 'Hygiene / tool cleanliness',
    hi: 'हाइजीन / औज़ारों की साफ़-सफ़ाई',
    mr: 'हायजीन / साधनांची स्वच्छता',
  },
  'pack.salon.upselling_pressure': {
    en: 'Pushy upselling',
    hi: 'एक्स्ट्रा सर्विस बेचने का दबाव',
    mr: 'जास्तीची सर्व्हिस विकण्याचा दबाव',
  },
  'pack.salon.product_quality': {
    en: 'Product quality concerns',
    hi: 'प्रोडक्ट की क्वालिटी पर चिंता',
    mr: 'प्रॉडक्टच्या गुणवत्तेबद्दल काळजी',
  },
  'pack.salon.wait_time': {
    en: 'Long wait despite appointment',
    hi: 'अपॉइंटमेंट के बावजूद लंबा इंतज़ार',
    mr: 'अपॉइंटमेंट असूनही बराच वेळ प्रतीक्षा',
  },
  'pack.salon.cleanliness_space': {
    en: 'Salon cleanliness / condition',
    hi: 'सैलून की साफ़-सफ़ाई / हालत',
    mr: 'सलूनची स्वच्छता / अवस्था',
  },
  'pack.salon.phone_unreachable': {
    en: 'Phone / booking channel unresponsive',
    hi: 'फ़ोन / बुकिंग चैनल का जवाब न देना',
    mr: 'फोन / बुकिंग चॅनेलकडून प्रतिसाद न मिळणं',
  },
  'pack.salon.stylist_skill': {
    en: 'Stylist skill and result',
    hi: 'स्टाइलिस्ट की कुशलता और नतीजा',
    mr: 'स्टायलिस्टचं कौशल्य आणि परिणाम',
  },
  'pack.salon.staff_warmth': {
    en: 'Warm, patient staff',
    hi: 'गर्मजोशी भरा, सब्र वाला स्टाफ़',
    mr: 'आपुलकीचा, संयमी स्टाफ',
  },
  'pack.salon.hygiene_praise': {
    en: 'Cleanliness and hygiene',
    hi: 'साफ़-सफ़ाई और हाइजीन',
    mr: 'स्वच्छता आणि हायजीन',
  },
  'pack.salon.ambience': {
    en: 'Relaxing ambience',
    hi: 'सुकून देने वाला माहौल',
    mr: 'निवांत वातावरण',
  },
  'pack.salon.value_pricing': {
    en: 'Fair pricing',
    hi: 'वाजिब क़ीमत',
    mr: 'वाजवी किंमत',
  },
  'pack.salon.punctuality': {
    en: 'On-time appointments',
    hi: 'वक़्त पर मिलने वाली अपॉइंटमेंट',
    mr: 'वेळेवर मिळणाऱ्या अपॉइंटमेंट',
  },
  'pack.salon.consultation': {
    en: 'Good consultation / advice',
    hi: 'अच्छा कंसल्टेशन / सलाह',
    mr: 'चांगलं कन्सल्टेशन / सल्ला',
  },

  // --- coaching (packs/coaching.json) -------------------------------------
  'pack.coaching.teaching_quality': {
    en: 'Teaching quality / doubt clearing',
    hi: 'पढ़ाई की क्वालिटी / डाउट क्लियरिंग',
    mr: 'शिकवण्याची गुणवत्ता / शंका निरसन',
  },
  'pack.coaching.faculty_turnover': {
    en: 'Teachers changed mid-course',
    hi: 'कोर्स के बीच में बदले गए टीचर',
    mr: 'कोर्समध्येच बदललेले शिक्षक',
  },
  'pack.coaching.batch_size': {
    en: 'Batch too large / no attention',
    hi: 'बहुत बड़ा बैच / ध्यान न मिलना',
    mr: 'खूप मोठा बॅच / लक्ष न मिळणं',
  },
  'pack.coaching.fee_transparency': {
    en: 'Fee / refund disputes',
    hi: 'फ़ीस / रिफ़ंड के विवाद',
    mr: 'फी / रिफंडचे वाद',
  },
  'pack.coaching.communication_parents': {
    en: 'Poor communication with parents',
    hi: 'पैरेंट्स से कमज़ोर बातचीत',
    mr: 'पालकांशी कमकुवत संवाद',
  },
  'pack.coaching.schedule_reliability': {
    en: 'Classes cancelled or rescheduled',
    hi: 'क्लास कैंसिल या रीशेड्यूल होना',
    mr: 'क्लास रद्द होणं किंवा वेळ बदलणं',
  },
  'pack.coaching.results_claims': {
    en: 'Results not as promised',
    hi: 'वादे के मुताबिक़ न आए नतीजे',
    mr: 'सांगितल्याप्रमाणे न आलेले निकाल',
  },
  'pack.coaching.facility_condition': {
    en: 'Classroom condition / facilities',
    hi: 'क्लासरूम की हालत / सुविधाएँ',
    mr: 'वर्गाची अवस्था / सुविधा',
  },
  'pack.coaching.study_material': {
    en: 'Study material quality / delays',
    hi: 'स्टडी मटीरियल की क्वालिटी / देरी',
    mr: 'अभ्यास साहित्याची गुणवत्ता / उशीर',
  },
  'pack.coaching.safety_discipline': {
    en: 'Safety / discipline concerns',
    hi: 'सुरक्षा / अनुशासन की चिंता',
    mr: 'सुरक्षा / शिस्तीबद्दलची काळजी',
  },
  'pack.coaching.teaching_quality_praise': {
    en: 'Strong teaching',
    hi: 'बढ़िया पढ़ाई',
    mr: 'दर्जेदार शिकवणं',
  },
  'pack.coaching.individual_attention': {
    en: 'Individual attention',
    hi: 'हर बच्चे पर अलग ध्यान',
    mr: 'प्रत्येकाकडे स्वतंत्र लक्ष',
  },
  'pack.coaching.results_praise': {
    en: 'Improvement in results',
    hi: 'नतीजों में सुधार',
    mr: 'निकालात सुधारणा',
  },
  'pack.coaching.faculty_support': {
    en: 'Supportive, approachable faculty',
    hi: 'मददगार, आसानी से मिलने वाले टीचर',
    mr: 'मदत करणारे, सहज उपलब्ध शिक्षक',
  },
  'pack.coaching.study_material_praise': {
    en: 'Good study material',
    hi: 'अच्छा स्टडी मटीरियल',
    mr: 'चांगलं अभ्यास साहित्य',
  },
  'pack.coaching.discipline': {
    en: 'Discipline and regularity',
    hi: 'अनुशासन और नियमितता',
    mr: 'शिस्त आणि नियमितपणा',
  },
  'pack.coaching.fee_value': {
    en: 'Fair fees',
    hi: 'वाजिब फ़ीस',
    mr: 'वाजवी फी',
  },

  // --- real_estate (packs/real_estate.json) --------------------------------
  'pack.real_estate.listing_accuracy': {
    en: 'Listing did not match reality',
    hi: 'लिस्टिंग का हक़ीक़त से मेल न खाना',
    mr: 'लिस्टिंग प्रत्यक्षाशी न जुळणं',
  },
  'pack.real_estate.responsiveness': {
    en: 'Slow or no response',
    hi: 'देर से या बिल्कुल जवाब न मिलना',
    mr: 'उशिरा किंवा अजिबात प्रतिसाद न मिळणं',
  },
  'pack.real_estate.hidden_charges': {
    en: 'Hidden brokerage / charges',
    hi: 'छुपी हुई ब्रोकरेज / चार्ज',
    mr: 'छुपी ब्रोकरेज / चार्ज',
  },
  'pack.real_estate.site_visit_experience': {
    en: 'Site visit problems',
    hi: 'साइट विज़िट की दिक़्क़तें',
    mr: 'साइट व्हिजिटच्या अडचणी',
  },
  'pack.real_estate.documentation_delay': {
    en: 'Documentation / paperwork delays',
    hi: 'डॉक्युमेंटेशन / कागज़ात में देरी',
    mr: 'डॉक्युमेंटेशन / कागदपत्रांना उशीर',
  },
  'pack.real_estate.pressure_tactics': {
    en: 'Pressure / pushy selling',
    hi: 'दबाव / ज़बरदस्ती की सेलिंग',
    mr: 'दबाव / जबरदस्तीची विक्री',
  },
  'pack.real_estate.token_refund': {
    en: 'Token / advance not refunded',
    hi: 'टोकन / एडवांस वापस न मिलना',
    mr: 'टोकन / आगाऊ रक्कम परत न मिळणं',
  },
  'pack.real_estate.post_deal_support': {
    en: 'Disappeared after the deal',
    hi: 'डील के बाद ग़ायब हो जाना',
    mr: 'व्यवहार झाल्यावर गायब होणं',
  },
  'pack.real_estate.professionalism': {
    en: 'Professionalism / behaviour',
    hi: 'प्रोफ़ेशनलिज़्म / व्यवहार',
    mr: 'व्यावसायिकता / वागणूक',
  },
  'pack.real_estate.unclear_pricing': {
    en: 'Price kept changing',
    hi: 'क़ीमत का बार-बार बदलना',
    mr: 'किंमत वारंवार बदलणं',
  },
  'pack.real_estate.transparency': {
    en: 'Honesty and transparency',
    hi: 'ईमानदारी और पारदर्शिता',
    mr: 'प्रामाणिकपणा आणि पारदर्शकता',
  },
  'pack.real_estate.responsiveness_praise': {
    en: 'Quick, reliable responses',
    hi: 'तेज़, भरोसेमंद जवाब',
    mr: 'जलद, विश्वासार्ह प्रतिसाद',
  },
  'pack.real_estate.market_knowledge': {
    en: 'Strong local market knowledge',
    hi: 'लोकल मार्केट की मज़बूत जानकारी',
    mr: 'स्थानिक मार्केटची पक्की माहिती',
  },
  'pack.real_estate.options_shown': {
    en: 'Well-matched options',
    hi: 'ज़रूरत से मेल खाते ऑप्शन',
    mr: 'गरजेला जुळणारे पर्याय',
  },
  'pack.real_estate.paperwork_help': {
    en: 'Help with paperwork',
    hi: 'कागज़ात में मदद',
    mr: 'कागदपत्रांत मदत',
  },
  'pack.real_estate.no_pressure': {
    en: 'An unpressured approach',
    hi: 'बिना दबाव वाला तरीक़ा',
    mr: 'दबाव न आणणारा दृष्टिकोन',
  },
  'pack.real_estate.fair_brokerage': {
    en: 'Fair brokerage',
    hi: 'वाजिब ब्रोकरेज',
    mr: 'वाजवी ब्रोकरेज',
  },

  // --- wedding_vendor (packs/wedding_vendor.json) --------------------------
  'pack.wedding_vendor.delivery_delay': {
    en: 'Final delivery delayed',
    hi: 'फ़ाइनल डिलीवरी में देरी',
    mr: 'अंतिम डिलिव्हरीला उशीर',
  },
  'pack.wedding_vendor.quality_vs_sample': {
    en: 'Output did not match the samples shown',
    hi: 'दिखाए गए सैंपल से काम का मेल न खाना',
    mr: 'दाखवलेल्या नमुन्यांशी काम न जुळणं',
  },
  'pack.wedding_vendor.team_substitution': {
    en: 'Different team turned up on the day',
    hi: 'उस दिन दूसरी टीम का आना',
    mr: 'त्या दिवशी वेगळी टीम येणं',
  },
  'pack.wedding_vendor.communication': {
    en: 'Poor communication before the event',
    hi: 'इवेंट से पहले कमज़ोर बातचीत',
    mr: 'कार्यक्रमापूर्वी कमकुवत संवाद',
  },
  'pack.wedding_vendor.hidden_costs': {
    en: 'Costs added later',
    hi: 'बाद में जोड़े गए ख़र्च',
    mr: 'नंतर वाढवलेले खर्च',
  },
  'pack.wedding_vendor.punctuality': {
    en: 'Late arrival on the day',
    hi: 'उस दिन देर से पहुँचना',
    mr: 'त्या दिवशी उशिरा पोहोचणं',
  },
  'pack.wedding_vendor.coverage_gaps': {
    en: 'Missed key moments / coverage gaps',
    hi: 'छूटे हुए ख़ास पल / कवरेज में कमी',
    mr: 'निसटलेले महत्त्वाचे क्षण / कव्हरेजमधली कमतरता',
  },
  'pack.wedding_vendor.professionalism': {
    en: 'Behaviour on the day',
    hi: 'उस दिन का व्यवहार',
    mr: 'त्या दिवशीची वागणूक',
  },
  'pack.wedding_vendor.revisions_refused': {
    en: 'Edits / revisions refused',
    hi: 'एडिट / बदलाव करने से इनकार',
    mr: 'एडिट / बदल करण्यास नकार',
  },
  'pack.wedding_vendor.advance_refund': {
    en: 'Advance not refunded on cancellation',
    hi: 'कैंसिल करने पर एडवांस वापस न मिलना',
    mr: 'रद्द केल्यावर आगाऊ रक्कम परत न मिळणं',
  },
  'pack.wedding_vendor.output_quality': {
    en: 'Excellent final output',
    hi: 'शानदार फ़ाइनल काम',
    mr: 'उत्तम अंतिम काम',
  },
  'pack.wedding_vendor.team_conduct': {
    en: 'Professional, calm team',
    hi: 'प्रोफ़ेशनल, शांत टीम',
    mr: 'व्यावसायिक, शांत टीम',
  },
  'pack.wedding_vendor.communication_praise': {
    en: 'Clear communication',
    hi: 'साफ़ बातचीत',
    mr: 'स्पष्ट संवाद',
  },
  'pack.wedding_vendor.punctuality_praise': {
    en: 'Punctuality',
    hi: 'वक़्त की पाबंदी',
    mr: 'वक्तशीरपणा',
  },
  'pack.wedding_vendor.flexibility': {
    en: 'Flexibility and willingness to accommodate',
    hi: 'लचीलापन और ज़रूरत के मुताबिक़ ढलने की तैयारी',
    mr: 'लवचिकता आणि गरजेनुसार जुळवून घेण्याची तयारी',
  },
  'pack.wedding_vendor.value_pricing': {
    en: 'Fair pricing for the work',
    hi: 'काम के हिसाब से वाजिब क़ीमत',
    mr: 'कामाच्या मानाने वाजवी किंमत',
  },
  'pack.wedding_vendor.delivery_speed': {
    en: 'On-time delivery',
    hi: 'वक़्त पर डिलीवरी',
    mr: 'वेळेवर डिलिव्हरी',
  },

  // -----------------------------------------------------------------------
  // THE SUGGESTED CHANGE.
  //
  // Every issue theme in a pack carries an `action` — the WHAT TO DO line an
  // owner reads under the problem on Home. It is the one sentence on the page
  // that asks for work, so it is the last place English may survive: an owner
  // who cannot read the instruction cannot follow it, and the whole screen was
  // built to end in a change being made.
  //
  // Keyed `pack.<vertical>.<themeKey>.action`, alongside the theme label above,
  // and read with `t.soft` by `actionFor` in `intelligence/engine.ts` — so a
  // theme whose action is not translated yet falls back to the pack's own
  // English sentence rather than showing nothing.
  //
  // TRANSLATED AS INSTRUCTIONS, not as sentences. "Publish a repair log at the
  // entrance" has to read like something an owner would actually say to their
  // staff on a Tuesday morning; a literal rendering of the English would be
  // grammatical and useless. Nothing is softened: an action that says to stop
  // doing something says to stop in all three languages.
  // -----------------------------------------------------------------------

  // --- restaurant (packs/restaurant.json) ----------------------------
  'pack.restaurant.food_quality.action': {
    en: 'Re-standardise the two dishes named most often: fix the recipe card, weigh portions, and taste-check at the pass for one week.',
    hi: 'सबसे ज़्यादा बार बताई गई दो डिश को दोबारा पक्का करें: रेसिपी कार्ड तय करें, हिस्से तौलें, और एक हफ़्ते तक पास पर चखकर जाँचें।',
    mr: 'सर्वात जास्त वेळा सांगितलेल्या दोन पदार्थांचं प्रमाण पुन्हा पक्कं करा: रेसिपी कार्ड ठरवा, वाढपाचं वजन करा, आणि एक आठवडा पासवर चव घेऊन तपासा.',
  },
  'pack.restaurant.service_speed.action': {
    en: 'Set a target ticket time per course and post it in the kitchen; assign one person to track tables waiting over that time.',
    hi: 'हर कोर्स के लिए टिकट टाइम का लक्ष्य तय करें और किचन में लगाएँ; उस समय से ज़्यादा इंतज़ार कर रही टेबलों पर नज़र रखने के लिए एक व्यक्ति तय करें।',
    mr: 'प्रत्येक कोर्ससाठी टिकट टाइमचं लक्ष्य ठरवा आणि ते किचनमध्ये लावा; त्या वेळेपेक्षा जास्त वाट पाहणाऱ्या टेबलांवर लक्ष ठेवायला एक माणूस नेमा.',
  },
  'pack.restaurant.order_accuracy.action': {
    en: 'Add a repeat-back step: the server reads the full order back before sending it, and the pass checks the ticket before it leaves.',
    hi: 'ऑर्डर दोहराने का क़दम जोड़ें: सर्वर ऑर्डर भेजने से पहले पूरा ऑर्डर पढ़कर सुनाए, और पास से निकलने से पहले टिकट जाँचा जाए।',
    mr: 'ऑर्डर पुन्हा वाचण्याची पायरी जोडा: सर्व्हरने ऑर्डर पाठवण्याआधी पूर्ण ऑर्डर वाचून दाखवावी, आणि पासवरून बाहेर जाण्याआधी टिकट तपासावं.',
  },
  'pack.restaurant.staff_behaviour.action': {
    en: 'Assign every table an owner for the whole visit, and brief staff on how to handle a complaint at the table.',
    hi: 'हर टेबल की पूरी विज़िट के लिए एक ज़िम्मेदार व्यक्ति तय करें, और स्टाफ़ को समझाएँ कि टेबल पर आई शिकायत कैसे संभालनी है।',
    mr: 'प्रत्येक टेबलसाठी संपूर्ण भेटीपुरता एक जबाबदार माणूस नेमा, आणि टेबलवरची तक्रार कशी हाताळायची हे स्टाफला समजावून सांगा.',
  },
  'pack.restaurant.cleanliness.action': {
    en: 'Add a visible washroom and table-turn cleaning checklist signed off every hour.',
    hi: 'वॉशरूम और टेबल बदलने की सफ़ाई की चेकलिस्ट सबको दिखे ऐसी जगह लगाएँ, और हर घंटे उस पर साइन कराएँ।',
    mr: 'वॉशरूम आणि टेबल बदलताना करायच्या स्वच्छतेची चेकलिस्ट सर्वांना दिसेल अशी लावा, आणि दर तासाला त्यावर सही घ्या.',
  },
  'pack.restaurant.pricing_value.action': {
    en: 'Publish clear portion sizes and prices on the menu, and remove any charge that is not printed.',
    hi: 'मेन्यू पर हिस्से का साफ़ माप और क़ीमत लिखें, और जो चार्ज छपा नहीं है उसे हटा दें।',
    mr: 'मेन्यूवर वाढपाचं स्पष्ट प्रमाण आणि किंमत लिहा, आणि छापलेला नसलेला कोणताही चार्ज काढून टाका.',
  },
  'pack.restaurant.wait_for_table.action': {
    en: 'Introduce a written waitlist with a quoted time, and honour the quote or comp nothing but apologise clearly.',
    hi: 'लिखित वेटलिस्ट शुरू करें जिसमें बताया गया समय भी लिखा हो, और वह समय निभाएँ; न निभा पाएँ तो कुछ मुफ़्त देने के बजाय साफ़ शब्दों में माफ़ी माँगें।',
    mr: 'लेखी वेटलिस्ट सुरू करा, त्यात सांगितलेली वेळही लिहा, आणि ती वेळ पाळा; नाही पाळता आली तर काही फुकट देण्याऐवजी स्पष्ट शब्दांत माफी मागा.',
  },
  'pack.restaurant.ambience_noise.action': {
    en: 'Fix the specific physical complaint named most often (AC, seating, music volume) before adding anything new.',
    hi: 'कुछ भी नया जोड़ने से पहले सबसे ज़्यादा बार बताई गई सुविधा की शिकायत ठीक करें (एसी, बैठने की जगह, म्यूज़िक की आवाज़)।',
    mr: 'काहीही नवीन जोडण्याआधी सर्वात जास्त वेळा सांगितलेली सुविधेची तक्रार दुरुस्त करा (एसी, बसण्याची जागा, म्युझिकचा आवाज).',
  },
  'pack.restaurant.delivery_packaging.action': {
    en: 'Switch to leak-proof packaging for the items named, and seal every bag with a tamper sticker.',
    hi: 'जिन आइटम की शिकायत आई है उनके लिए लीक-प्रूफ़ पैकेजिंग पर जाएँ, और हर बैग पर टैम्पर स्टिकर लगाकर सील करें।',
    mr: 'ज्या पदार्थांबद्दल तक्रार आली आहे त्यांच्यासाठी गळत नाही अशी पॅकेजिंग वापरा, आणि प्रत्येक बॅग टॅम्पर स्टिकरने सील करा.',
  },
  'pack.restaurant.billing_issue.action': {
    en: 'Print every charge on the bill and train staff to explain the service charge before it appears.',
    hi: 'हर चार्ज बिल पर छापें, और स्टाफ़ को सिखाएँ कि सर्विस चार्ज बिल में आने से पहले ही ग्राहक को समझा दें।',
    mr: 'प्रत्येक चार्ज बिलावर छापा, आणि सर्व्हिस चार्ज बिलात येण्याआधीच ग्राहकाला समजावून सांगायला स्टाफला शिकवा.',
  },

  // --- salon (packs/salon.json) --------------------------------------
  'pack.salon.service_result.action': {
    en: 'Add a two-minute consultation before every chemical or cutting service: agree the result in words and show a reference, then confirm before starting.',
    hi: 'हर केमिकल या कटिंग सर्विस से पहले दो मिनट की बातचीत रखें: नतीजा शब्दों में तय करें, एक रेफ़रेंस दिखाएँ, और शुरू करने से पहले पक्का कर लें।',
    mr: 'प्रत्येक केमिकल किंवा कटिंग सर्व्हिसच्या आधी दोन मिनिटांची चर्चा करा: निकाल शब्दांत ठरवा, एक संदर्भ दाखवा, आणि सुरू करण्याआधी नक्की करून घ्या.',
  },
  'pack.salon.appointment_scheduling.action': {
    en: 'Stop double-booking the same stylist: block realistic service durations and confirm every appointment the day before.',
    hi: 'एक ही स्टाइलिस्ट की दोहरी बुकिंग बंद करें: हर सर्विस के लिए असली लगने वाला समय ब्लॉक करें, और हर अपॉइंटमेंट एक दिन पहले कन्फ़र्म करें।',
    mr: 'एकाच स्टायलिस्टची दुहेरी बुकिंग बंद करा: प्रत्येक सर्व्हिससाठी खरोखर लागणारा वेळ राखून ठेवा, आणि प्रत्येक अपॉइंटमेंट आदल्या दिवशी कन्फर्म करा.',
  },
  'pack.salon.pricing_transparency.action': {
    en: 'Quote the full price in writing before starting, including any add-on, and never add a charge mid-service.',
    hi: 'शुरू करने से पहले पूरी क़ीमत लिखकर बताएँ, हर ऐड-ऑन समेत, और सर्विस के बीच में कोई चार्ज कभी न जोड़ें।',
    mr: 'सुरू करण्याआधी प्रत्येक अ‍ॅड-ऑनसह पूर्ण किंमत लेखी सांगा, आणि सर्व्हिस चालू असताना कधीही नवा चार्ज लावू नका.',
  },
  'pack.salon.staff_behaviour.action': {
    en: 'Brief the floor on a fixed greeting and handover script, and name one person responsible for each client visit.',
    hi: 'फ़्लोर को तय स्वागत और हैंडओवर स्क्रिप्ट समझाएँ, और हर ग्राहक की विज़िट के लिए एक ज़िम्मेदार व्यक्ति तय करें।',
    mr: 'फ्लोअरला ठरलेली स्वागत आणि हस्तांतरणाची स्क्रिप्ट समजावून सांगा, आणि प्रत्येक ग्राहकाच्या भेटीसाठी एक जबाबदार माणूस नेमा.',
  },
  'pack.salon.hygiene.action': {
    en: 'Sanitise tools in front of the client and keep a visible sterilisation log at each station.',
    hi: 'औज़ार ग्राहक के सामने सैनिटाइज़ करें, और हर स्टेशन पर स्टरलाइज़ेशन का लॉग सबको दिखे ऐसी जगह रखें।',
    mr: 'साधनं ग्राहकासमोर सॅनिटाइज करा, आणि प्रत्येक स्टेशनवर निर्जंतुकीकरणाची नोंद सर्वांना दिसेल अशी ठेवा.',
  },
  'pack.salon.upselling_pressure.action': {
    en: 'Ban mid-service upselling: offer add-ons once, at consultation, and never while the client is in the chair.',
    hi: 'सर्विस के बीच में कुछ और बेचना बंद करें: ऐड-ऑन एक ही बार, बातचीत के वक़्त बताएँ, और ग्राहक के कुर्सी पर बैठे रहते हुए कभी नहीं।',
    mr: 'सर्व्हिस चालू असताना आणखी काही विकणं बंद करा: अ‍ॅड-ऑन एकदाच, सुरुवातीच्या चर्चेच्या वेळी सांगा, आणि ग्राहक खुर्चीत असताना कधीच नाही.',
  },
  'pack.salon.product_quality.action': {
    en: 'Show the product brand and expiry to the client before use for any chemical service.',
    hi: 'किसी भी केमिकल सर्विस में इस्तेमाल से पहले प्रोडक्ट का ब्रांड और एक्सपायरी ग्राहक को दिखाएँ।',
    mr: 'कोणत्याही केमिकल सर्व्हिसमध्ये वापरण्याआधी प्रॉडक्टचा ब्रँड आणि एक्स्पायरी ग्राहकाला दाखवा.',
  },
  'pack.salon.wait_time.action': {
    en: 'Track actual start time against booked time for one week and cut the number of parallel bookings per stylist.',
    hi: 'एक हफ़्ते तक बुक किए गए समय और असली शुरू होने के समय का हिसाब रखें, और हर स्टाइलिस्ट की एक साथ चलने वाली बुकिंग घटाएँ।',
    mr: 'एक आठवडा बुक केलेली वेळ आणि प्रत्यक्ष सुरू झालेली वेळ यांची नोंद ठेवा, आणि प्रत्येक स्टायलिस्टच्या एकाच वेळी चालणाऱ्या बुकिंग कमी करा.',
  },
  'pack.salon.cleanliness_space.action': {
    en: 'Reset the floor between clients: sweep, wipe the station, and change the cape and towel every time.',
    hi: 'हर ग्राहक के बाद जगह दोबारा तैयार करें: झाड़ू लगाएँ, स्टेशन पोंछें, और हर बार केप और तौलिया बदलें।',
    mr: 'प्रत्येक ग्राहकानंतर जागा पुन्हा तयार करा: झाडून घ्या, स्टेशन पुसा, आणि दर वेळी केप आणि टॉवेल बदला.',
  },
  'pack.salon.phone_unreachable.action': {
    en: 'Assign one person to the salon phone during opening hours and return every missed call the same day.',
    hi: 'खुलने के घंटों में सैलून का फ़ोन एक व्यक्ति के ज़िम्मे करें, और हर छूटी कॉल उसी दिन वापस करें।',
    mr: 'सलून चालू असताना फोनची जबाबदारी एका माणसाकडे द्या, आणि चुकलेला प्रत्येक कॉल त्याच दिवशी परत करा.',
  },

  // --- clinic (packs/clinic.json) ------------------------------------
  'pack.clinic.wait_time.action': {
    en: 'Fix the waiting-time expectation: publish a realistic slot length, and have reception tell each patient the expected wait on arrival.',
    hi: 'इंतज़ार को लेकर सही उम्मीद बनाएँ: हर स्लॉट का असली समय लिखकर लगाएँ, और रिसेप्शन हर मरीज़ को आते ही बता दे कि कितनी देर लगेगी।',
    mr: 'प्रतीक्षेबद्दल योग्य अपेक्षा तयार करा: प्रत्येक स्लॉटची खरी वेळ लिहून लावा, आणि रिसेप्शनने प्रत्येक रुग्णाला आल्या आल्या किती वेळ लागेल ते सांगावं.',
  },
  'pack.clinic.appointment_scheduling.action': {
    en: 'Tighten the booking flow: confirm every appointment on the channel it was made, and re-confirm on the morning of the visit.',
    hi: 'बुकिंग का तरीक़ा कसें: हर अपॉइंटमेंट उसी माध्यम पर कन्फ़र्म करें जिस पर वह ली गई थी, और विज़िट वाले दिन सुबह दोबारा कन्फ़र्म करें।',
    mr: 'बुकिंगची पद्धत घट्ट करा: प्रत्येक अपॉइंटमेंट ज्या माध्यमातून घेतली त्याच माध्यमावर कन्फर्म करा, आणि भेटीच्या दिवशी सकाळी पुन्हा कन्फर्म करा.',
  },
  'pack.clinic.billing_clarity.action': {
    en: 'Give a written estimate before treatment starts and repeat the total out loud before payment.',
    hi: 'इलाज शुरू होने से पहले लिखित अनुमान दें, और पेमेंट से पहले कुल रक़म बोलकर दोहराएँ।',
    mr: 'उपचार सुरू होण्याआधी लेखी अंदाज द्या, आणि पेमेंटच्या आधी एकूण रक्कम मोठ्याने सांगून पुन्हा नक्की करा.',
  },
  'pack.clinic.staff_behaviour.action': {
    en: 'Run a short front-desk script drill: greeting, expected wait, and how to answer a frustrated patient.',
    hi: 'फ़्रंट डेस्क के लिए छोटी स्क्रिप्ट ड्रिल कराएँ: स्वागत कैसे करना है, कितने इंतज़ार की बात कहनी है, और नाराज़ मरीज़ को क्या जवाब देना है।',
    mr: 'फ्रंट डेस्कसाठी छोटी स्क्रिप्ट ड्रिल घ्या: स्वागत कसं करायचं, किती वेळ लागेल हे कसं सांगायचं, आणि नाराज रुग्णाला काय उत्तर द्यायचं.',
  },
  'pack.clinic.cleanliness.action': {
    en: 'Add a visible hourly cleaning checklist in the waiting area and washroom.',
    hi: 'वेटिंग एरिया और वॉशरूम में हर घंटे की सफ़ाई की चेकलिस्ट सबको दिखे ऐसी जगह लगाएँ।',
    mr: 'वेटिंग एरिया आणि वॉशरूममध्ये दर तासाच्या स्वच्छतेची चेकलिस्ट सर्वांना दिसेल अशी लावा.',
  },
  'pack.clinic.consultation_rush.action': {
    en: 'Protect a fixed minimum consultation length and end every consult with a one-line summary of the plan.',
    hi: 'हर कंसल्टेशन के लिए कम से कम तय समय पक्का रखें, और हर कंसल्टेशन के अंत में इलाज का प्लान एक लाइन में दोहराएँ।',
    mr: 'प्रत्येक कन्सल्टेशनसाठी किमान ठरलेला वेळ पक्का ठेवा, आणि प्रत्येक कन्सल्टेशनच्या शेवटी उपचाराचा प्लॅन एका ओळीत सांगा.',
  },
  'pack.clinic.followup_communication.action': {
    en: 'Set a promised turnaround for reports and send a status message if it will slip.',
    hi: 'रिपोर्ट कितने समय में मिलेगी यह तय करके बताएँ, और देर होने पर स्टेटस का मैसेज भेजें।',
    mr: 'रिपोर्ट किती वेळात मिळेल हे ठरवून सांगा, आणि उशीर होणार असेल तर स्टेटसचा मेसेज पाठवा.',
  },
  'pack.clinic.treatment_outcome.action': {
    en: 'Escalate offline: review the specific case privately with the doctor before any public reply.',
    hi: 'इसे ऑफ़लाइन उठाएँ: कोई भी सार्वजनिक जवाब देने से पहले यह केस डॉक्टर के साथ निजी तौर पर देखें।',
    mr: 'हे ऑफलाइन हाताळा: कोणतंही जाहीर उत्तर देण्याआधी हे प्रकरण डॉक्टरांसोबत खाजगीत तपासा.',
  },
  'pack.clinic.parking_access.action': {
    en: 'Add clear parking directions to the listing and to every appointment confirmation.',
    hi: 'पार्किंग का साफ़ रास्ता लिस्टिंग में और हर अपॉइंटमेंट कन्फ़र्मेशन में लिखें।',
    mr: 'पार्किंगचा स्पष्ट मार्ग लिस्टिंगमध्ये आणि प्रत्येक अपॉइंटमेंट कन्फर्मेशनमध्ये लिहा.',
  },
  'pack.clinic.phone_unreachable.action': {
    en: 'Assign a named person to the clinic phone during opening hours and log missed calls daily.',
    hi: 'खुलने के घंटों में क्लिनिक का फ़ोन एक तय व्यक्ति के ज़िम्मे करें, और छूटी कॉलों का रोज़ हिसाब रखें।',
    mr: 'क्लिनिक चालू असताना फोनची जबाबदारी एका ठरलेल्या व्यक्तीकडे द्या, आणि चुकलेल्या कॉल्सची रोज नोंद ठेवा.',
  },

  // --- gym (packs/gym.json) ------------------------------------------
  'pack.gym.equipment_condition.action': {
    en: 'Publish a repair log at the entrance: what is out of service, and the date it returns. Fix the machine named most often first.',
    hi: 'एंट्रेंस पर रिपेयर लॉग लगाएँ: कौन-सी मशीन बंद है और कब वापस चालू होगी। सबसे ज़्यादा बार बताई गई मशीन पहले ठीक कराएँ।',
    mr: 'प्रवेशद्वारावर दुरुस्तीची नोंद लावा: कोणतं मशीन बंद आहे आणि ते कधी पुन्हा सुरू होईल. सर्वात जास्त वेळा सांगितलेलं मशीन आधी दुरुस्त करा.',
  },
  'pack.gym.crowding.action': {
    en: 'Publish live peak-hour occupancy at the desk and cap peak-slot sign-ups for the busiest hour.',
    hi: 'डेस्क पर पीक आवर की मौजूदा भीड़ दिखाएँ, और सबसे व्यस्त घंटे के लिए स्लॉट बुकिंग की सीमा तय करें।',
    mr: 'डेस्कवर पीक अवरची सध्याची गर्दी दाखवा, आणि सर्वात गजबजलेल्या तासासाठी स्लॉट नोंदणीची मर्यादा ठेवा.',
  },
  'pack.gym.trainer_availability.action': {
    en: 'Roster a named floor trainer for every hour the gym is open and put the roster on the wall.',
    hi: 'जिम खुला रहने के हर घंटे के लिए एक नामज़द फ़्लोर ट्रेनर तय करें, और यह रोस्टर दीवार पर लगाएँ।',
    mr: 'जिम चालू असलेल्या प्रत्येक तासासाठी नावानिशी फ्लोअर ट्रेनर ठरवा, आणि तो रोस्टर भिंतीवर लावा.',
  },
  'pack.gym.cleanliness.action': {
    en: 'Add an hourly cleaning sign-off for the floor, washroom and changing room, visible to members.',
    hi: 'फ़्लोर, वॉशरूम और चेंजिंग रूम की हर घंटे की सफ़ाई का साइन-ऑफ़ रखें, जो मेंबर्स को दिखे।',
    mr: 'फ्लोअर, वॉशरूम आणि चेंजिंग रूमच्या दर तासाच्या स्वच्छतेची सही घ्या, आणि ती मेंबर्सना दिसेल अशी ठेवा.',
  },
  'pack.gym.membership_billing.action': {
    en: 'Give every member a written copy of the freeze, transfer and refund terms at signup, and stop verbal-only promises.',
    hi: 'साइनअप के वक़्त हर मेंबर को फ़्रीज़, ट्रांसफ़र और रिफ़ंड की शर्तें लिखकर दें, और सिर्फ़ ज़ुबानी वादे करना बंद करें।',
    mr: 'साइनअपच्या वेळी प्रत्येक मेंबरला फ्रीज, ट्रान्सफर आणि परताव्याच्या अटी लेखी द्या, आणि फक्त तोंडी दिलेली आश्वासनं बंद करा.',
  },
  'pack.gym.ac_ventilation.action': {
    en: 'Service the AC and add exhaust in the busiest zone; log temperature at peak hour for a week.',
    hi: 'एसी की सर्विस कराएँ और सबसे भीड़ वाले हिस्से में एग्ज़ॉस्ट लगवाएँ; एक हफ़्ते तक पीक आवर का तापमान दर्ज करें।',
    mr: 'एसीची सर्व्हिस करा आणि सर्वात गर्दीच्या भागात एक्झॉस्ट बसवा; एक आठवडा पीक अवरचं तापमान नोंदवा.',
  },
  'pack.gym.staff_behaviour.action': {
    en: 'Brief the desk on how to handle a freeze, cancellation and complaint without escalating.',
    hi: 'डेस्क को समझाएँ कि फ़्रीज़, कैंसिलेशन और शिकायत को बात बढ़ाए बिना कैसे संभालना है।',
    mr: 'फ्रीज, रद्द करणं आणि तक्रार वाद न वाढवता कशी हाताळायची हे डेस्कला समजावून सांगा.',
  },
  'pack.gym.overcommitted_sales.action': {
    en: 'Remove every claim from the sales pitch that is not written in the membership form.',
    hi: 'सेल्स पिच से हर वह दावा हटा दें जो मेंबरशिप फ़ॉर्म में लिखा नहीं है।',
    mr: 'सेल्स पिचमधून मेंबरशिप फॉर्ममध्ये लिहिलेला नसलेला प्रत्येक दावा काढून टाका.',
  },
  'pack.gym.class_schedule.action': {
    en: 'Fix the class timetable for a month and notify members in advance of any change.',
    hi: 'क्लास का टाइमटेबल महीने भर के लिए तय करें, और किसी भी बदलाव की सूचना मेंबर्स को पहले से दें।',
    mr: 'क्लासचं वेळापत्रक महिनाभरासाठी पक्कं करा, आणि कोणताही बदल झाल्यास मेंबर्सना आधीच कळवा.',
  },
  'pack.gym.parking_access.action': {
    en: 'Publish parking guidance on the listing and at the entrance.',
    hi: 'पार्किंग की जानकारी लिस्टिंग पर और एंट्रेंस पर लगाएँ।',
    mr: 'पार्किंगची माहिती लिस्टिंगवर आणि प्रवेशद्वारावर लावा.',
  },

  // --- coaching (packs/coaching.json) --------------------------------
  'pack.coaching.teaching_quality.action': {
    en: 'Add a fixed weekly doubt-clearing slot per batch and record attendance of the faculty member who takes it.',
    hi: 'हर बैच के लिए हफ़्ते में एक तय डाउट-क्लियरिंग स्लॉट रखें, और जो फ़ैकल्टी वह लेती है उसकी हाज़िरी दर्ज करें।',
    mr: 'प्रत्येक बॅचसाठी आठवड्यातून एक ठरलेला शंका-निरसनाचा स्लॉट ठेवा, आणि तो घेणाऱ्या शिक्षकाची हजेरी नोंदवा.',
  },
  'pack.coaching.faculty_turnover.action': {
    en: 'Commit the named faculty per batch in writing at admission, and inform parents in advance of any change.',
    hi: 'एडमिशन के वक़्त ही लिखकर दें कि किस बैच को कौन-सी फ़ैकल्टी पढ़ाएगी, और कोई भी बदलाव होने पर पहले से पैरेंट्स को बताएँ।',
    mr: 'प्रवेशाच्या वेळीच कोणत्या बॅचला कोणते शिक्षक शिकवणार हे लेखी द्या, आणि बदल झाल्यास आधीच पालकांना कळवा.',
  },
  'pack.coaching.batch_size.action': {
    en: 'Cap the batch size you advertise and stop admitting past that cap, even in season.',
    hi: 'जितनी बैच साइज़ आप बताते हैं उससे ऊपर एडमिशन बंद कर दें, सीज़न में भी।',
    mr: 'तुम्ही जाहीर करता तेवढीच बॅच साइज ठेवा आणि त्यापुढे प्रवेश देऊ नका, सीझनमध्येसुद्धा.',
  },
  'pack.coaching.fee_transparency.action': {
    en: 'Give every parent a written fee and refund schedule at admission, and stop collecting anything not on that sheet.',
    hi: 'एडमिशन के वक़्त हर पैरेंट को फ़ीस और रिफ़ंड का लिखित शेड्यूल दें, और उस काग़ज़ पर जो नहीं है वह पैसा लेना बंद करें।',
    mr: 'प्रवेशाच्या वेळी प्रत्येक पालकाला फी आणि परताव्याचं लेखी वेळापत्रक द्या, आणि त्या कागदावर नसलेली कोणतीही रक्कम घेणं बंद करा.',
  },
  'pack.coaching.communication_parents.action': {
    en: 'Send a fixed monthly progress note per student and hold one parent meeting per term.',
    hi: 'हर छात्र के लिए महीने में एक तय प्रोग्रेस नोट भेजें, और हर टर्म में एक पैरेंट मीटिंग रखें।',
    mr: 'प्रत्येक विद्यार्थ्यासाठी महिन्यातून एक ठरलेली प्रगती नोंद पाठवा, आणि प्रत्येक टर्ममध्ये एक पालक सभा घ्या.',
  },
  'pack.coaching.schedule_reliability.action': {
    en: 'Publish the term timetable up front and give 24-hour notice for any change, with a make-up slot.',
    hi: 'टर्म का टाइमटेबल पहले ही जारी करें, और किसी भी बदलाव की 24 घंटे पहले सूचना दें, साथ में मेक-अप स्लॉट भी।',
    mr: 'टर्मचं वेळापत्रक आधीच जाहीर करा, आणि कोणत्याही बदलाची 24 तास आधी सूचना द्या, सोबत भरपाईचा स्लॉटही द्या.',
  },
  'pack.coaching.results_claims.action': {
    en: 'Remove every result claim you cannot evidence, and never promise a rank, score or selection.',
    hi: 'नतीजों का हर वह दावा हटा दें जिसका सबूत आप नहीं दे सकते, और रैंक, स्कोर या सिलेक्शन का वादा कभी न करें।',
    mr: 'निकालाचा जो दावा तुम्ही सिद्ध करू शकत नाही तो प्रत्येक दावा काढून टाका, आणि रँक, स्कोअर किंवा निवडीचं वचन कधीच देऊ नका.',
  },
  'pack.coaching.facility_condition.action': {
    en: 'Fix the specific physical complaint named most often (fans, seating, washroom, light) before adding new batches.',
    hi: 'नए बैच शुरू करने से पहले सबसे ज़्यादा बार बताई गई सुविधा की शिकायत ठीक करें (पंखे, बैठने की जगह, वॉशरूम, रोशनी)।',
    mr: 'नवीन बॅच सुरू करण्याआधी सर्वात जास्त वेळा सांगितलेली सुविधेची तक्रार दुरुस्त करा (पंखे, बसण्याची जागा, वॉशरूम, प्रकाश).',
  },
  'pack.coaching.study_material.action': {
    en: 'Hand over the full material set on day one of the batch, or state the delivery date in writing.',
    hi: 'बैच के पहले ही दिन पूरा स्टडी मटीरियल दें, या फिर कब मिलेगा यह तारीख़ लिखकर बताएँ।',
    mr: 'बॅचच्या पहिल्याच दिवशी संपूर्ण अभ्यास साहित्य द्या, किंवा ते कधी मिळेल ती तारीख लेखी सांगा.',
  },
  'pack.coaching.safety_discipline.action': {
    en: 'Escalate offline immediately: handle privately with the parent before any public reply.',
    hi: 'इसे तुरंत ऑफ़लाइन उठाएँ: कोई भी सार्वजनिक जवाब देने से पहले पैरेंट के साथ निजी तौर पर निपटाएँ।',
    mr: 'हे लगेच ऑफलाइन हाताळा: कोणतंही जाहीर उत्तर देण्याआधी पालकांशी खाजगीत बोलून सोडवा.',
  },

  // --- real_estate (packs/real_estate.json) --------------------------
  'pack.real_estate.listing_accuracy.action': {
    en: 'Photograph every property yourself on the day it is listed, and remove any listing you have not personally verified this month.',
    hi: 'हर प्रॉपर्टी की तस्वीरें लिस्ट करने वाले दिन ख़ुद खींचें, और इस महीने जिस लिस्टिंग को आपने ख़ुद जाँचा नहीं है उसे हटा दें।',
    mr: 'प्रत्येक प्रॉपर्टीचे फोटो लिस्ट करण्याच्या दिवशी स्वतः काढा, आणि या महिन्यात तुम्ही स्वतः तपासली नाही अशी लिस्टिंग काढून टाका.',
  },
  'pack.real_estate.responsiveness.action': {
    en: 'Commit to a same-day first reply on every enquiry, and log any enquiry not answered within four working hours.',
    hi: 'हर पूछताछ का पहला जवाब उसी दिन देने का नियम बनाएँ, और जिस पूछताछ का जवाब चार कामकाजी घंटों में नहीं गया उसे दर्ज करें।',
    mr: 'प्रत्येक चौकशीचं पहिलं उत्तर त्याच दिवशी देण्याचा नियम करा, आणि चार कामाच्या तासांत उत्तर न गेलेली चौकशी नोंदवा.',
  },
  'pack.real_estate.hidden_charges.action': {
    en: 'State the full brokerage and any additional charge in writing before the first site visit.',
    hi: 'पहली साइट विज़िट से पहले पूरी ब्रोकरेज और कोई भी अतिरिक्त चार्ज लिखकर बताएँ।',
    mr: 'पहिल्या साइट व्हिजिटच्या आधी पूर्ण ब्रोकरेज आणि कोणताही अतिरिक्त चार्ज लेखी सांगा.',
  },
  'pack.real_estate.site_visit_experience.action': {
    en: 'Confirm site-visit time and address the evening before, and never schedule a visit without the key in hand.',
    hi: 'साइट विज़िट का समय और पता एक दिन पहले शाम को कन्फ़र्म करें, और चाबी हाथ में आए बिना कभी विज़िट तय न करें।',
    mr: 'साइट व्हिजिटची वेळ आणि पत्ता आदल्या दिवशी संध्याकाळी कन्फर्म करा, आणि चावी हातात असल्याशिवाय कधीही व्हिजिट ठरवू नका.',
  },
  'pack.real_estate.documentation_delay.action': {
    en: 'Give a written checklist of documents and a dated timeline at agreement stage, and update it weekly.',
    hi: 'एग्रीमेंट के वक़्त काग़ज़ात की लिखित चेकलिस्ट और तारीख़ों वाली टाइमलाइन दें, और उसे हर हफ़्ते अपडेट करें।',
    mr: 'करार करतेवेळी कागदपत्रांची लेखी चेकलिस्ट आणि तारखांसह टाइमलाइन द्या, आणि ती दर आठवड्याला अपडेट करा.',
  },
  'pack.real_estate.pressure_tactics.action': {
    en: 'Remove urgency claims from the pitch entirely, and never quote a deadline you cannot show in writing.',
    hi: 'पिच से जल्दबाज़ी वाले दावे पूरी तरह हटा दें, और ऐसी कोई डेडलाइन कभी न बताएँ जो आप लिखकर न दिखा सकें।',
    mr: 'पिचमधून घाई निर्माण करणारे दावे पूर्णपणे काढून टाका, आणि लेखी दाखवता येणार नाही अशी डेडलाइन कधीच सांगू नका.',
  },
  'pack.real_estate.token_refund.action': {
    en: 'Escalate offline immediately. Put the token refund terms in writing before accepting any advance.',
    hi: 'इसे तुरंत ऑफ़लाइन उठाएँ। कोई भी एडवांस लेने से पहले टोकन रिफ़ंड की शर्तें लिखकर दें।',
    mr: 'हे लगेच ऑफलाइन हाताळा. कोणतीही आगाऊ रक्कम घेण्याआधी टोकन परताव्याच्या अटी लेखी द्या.',
  },
  'pack.real_estate.post_deal_support.action': {
    en: 'Schedule one follow-up call at 7 days and one at 30 days after possession for every closed deal.',
    hi: 'हर पूरी हो चुकी डील में पज़ेशन के 7 दिन बाद एक और 30 दिन बाद एक फ़ॉलो-अप कॉल तय करें।',
    mr: 'प्रत्येक पूर्ण झालेल्या डीलमध्ये ताबा मिळाल्यानंतर 7 दिवसांनी एक आणि 30 दिवसांनी एक फॉलो-अप कॉल ठरवा.',
  },
  'pack.real_estate.professionalism.action': {
    en: 'Set a fixed intro script and dress-and-punctuality standard for every site visit.',
    hi: 'हर साइट विज़िट के लिए तय इंट्रो स्क्रिप्ट और कपड़ों व वक़्त की पाबंदी का मानक बनाएँ।',
    mr: 'प्रत्येक साइट व्हिजिटसाठी ठरलेली ओळख-स्क्रिप्ट आणि पेहराव व वक्तशीरपणाचा नियम ठरवा.',
  },
  'pack.real_estate.unclear_pricing.action': {
    en: 'Quote the all-in price in writing at first contact and do not revise it without a written reason.',
    hi: 'पहली बातचीत में ही सब कुछ मिलाकर बनने वाली क़ीमत लिखकर बताएँ, और लिखित कारण के बिना उसे बदलें नहीं।',
    mr: 'पहिल्या संपर्कातच सर्व काही धरून येणारी किंमत लेखी सांगा, आणि लेखी कारणाशिवाय ती बदलू नका.',
  },

  // --- wedding_vendor (packs/wedding_vendor.json) --------------------
  'pack.wedding_vendor.delivery_delay.action': {
    en: 'Put a dated delivery commitment in every contract and send a written status update at the halfway point.',
    hi: 'हर कॉन्ट्रैक्ट में डिलीवरी की तारीख़ लिखकर दें, और बीच के पड़ाव पर लिखित स्टेटस अपडेट भेजें।',
    mr: 'प्रत्येक करारात डिलिव्हरीची तारीख लिहून द्या, आणि अर्ध्या टप्प्यावर लेखी स्टेटस अपडेट पाठवा.',
  },
  'pack.wedding_vendor.quality_vs_sample.action': {
    en: 'Show only work your current team actually shot or produced, and name the lead person assigned to the booking in the contract.',
    hi: 'सिर्फ़ वही काम दिखाएँ जो आपकी मौजूदा टीम ने वाक़ई शूट या तैयार किया है, और कॉन्ट्रैक्ट में उस बुकिंग के लीड व्यक्ति का नाम लिखें।',
    mr: 'फक्त तुमच्या सध्याच्या टीमने खरोखर शूट किंवा तयार केलेलं कामच दाखवा, आणि करारात त्या बुकिंगसाठी नेमलेल्या मुख्य व्यक्तीचं नाव लिहा.',
  },
  'pack.wedding_vendor.team_substitution.action': {
    en: 'Name the exact lead crew in the contract and get written consent before any substitution.',
    hi: 'कॉन्ट्रैक्ट में लीड क्रू के नाम साफ़ लिखें, और किसी को बदलने से पहले लिखित सहमति लें।',
    mr: 'करारात मुख्य क्रूची नावं स्पष्ट लिहा, आणि कोणीही बदलण्याआधी लेखी संमती घ्या.',
  },
  'pack.wedding_vendor.communication.action': {
    en: 'Schedule one written check-in at booking, one at minus 30 days and one at minus 3 days for every event.',
    hi: 'हर इवेंट के लिए तीन लिखित चेक-इन तय करें: बुकिंग के वक़्त, इवेंट से 30 दिन पहले, और इवेंट से 3 दिन पहले।',
    mr: 'प्रत्येक इव्हेंटसाठी तीन लेखी चेक-इन ठरवा: बुकिंगच्या वेळी, इव्हेंटच्या 30 दिवस आधी, आणि इव्हेंटच्या 3 दिवस आधी.',
  },
  'pack.wedding_vendor.hidden_costs.action': {
    en: 'Itemise every inclusion and exclusion in the quote, and refuse to add a charge that is not in the signed contract.',
    hi: 'कोटेशन में क्या शामिल है और क्या नहीं, हर चीज़ अलग-अलग लिखें, और साइन किए कॉन्ट्रैक्ट में जो चार्ज नहीं है उसे जोड़ने से मना करें।',
    mr: 'कोटेशनमध्ये काय समाविष्ट आहे आणि काय नाही ते प्रत्येक बाब स्वतंत्रपणे लिहा, आणि सही केलेल्या करारात नसलेला चार्ज लावायला नकार द्या.',
  },
  'pack.wedding_vendor.punctuality.action': {
    en: 'Require the crew to arrive one hour before call time and confirm arrival to the client by message.',
    hi: 'क्रू को कॉल टाइम से एक घंटा पहले पहुँचना ज़रूरी करें, और पहुँचने की सूचना ग्राहक को मैसेज से दें।',
    mr: 'क्रूने कॉल टाइमच्या एक तास आधी पोहोचणं बंधनकारक करा, आणि पोहोचल्याचं ग्राहकाला मेसेजने कळवा.',
  },
  'pack.wedding_vendor.coverage_gaps.action': {
    en: 'Agree a written shot or coverage list with the client at minus 7 days and assign one person to tick it off live.',
    hi: 'इवेंट से 7 दिन पहले ग्राहक के साथ लिखित शॉट या कवरेज लिस्ट तय करें, और उसे मौक़े पर टिक करने के लिए एक व्यक्ति तय करें।',
    mr: 'इव्हेंटच्या 7 दिवस आधी ग्राहकासोबत लेखी शॉट किंवा कव्हरेज यादी ठरवा, आणि ती जागेवरच टिक करण्यासाठी एक माणूस नेमा.',
  },
  'pack.wedding_vendor.professionalism.action': {
    en: 'Brief the crew on guest conduct and dress code, and name one on-site lead who owns all client contact.',
    hi: 'क्रू को मेहमानों के साथ व्यवहार और ड्रेस कोड समझाएँ, और एक ऑन-साइट लीड तय करें जिसके ज़िम्मे ग्राहक से पूरी बातचीत हो।',
    mr: 'क्रूला पाहुण्यांशी वागणूक आणि ड्रेस कोड समजावून सांगा, आणि ग्राहकाशी होणारा सर्व संपर्क ज्याच्या जबाबदारीत असेल असा एक ऑन-साइट लीड नेमा.',
  },
  'pack.wedding_vendor.revisions_refused.action': {
    en: 'State the number of included revisions in the contract and honour them without argument.',
    hi: 'कॉन्ट्रैक्ट में लिखें कि कितने रिविज़न शामिल हैं, और बिना बहस किए वे पूरे करें।',
    mr: 'करारात किती रिव्हिजन समाविष्ट आहेत ते लिहा, आणि वाद न घालता ते पूर्ण करा.',
  },
  'pack.wedding_vendor.advance_refund.action': {
    en: 'Escalate offline immediately. Put the cancellation and refund slab in writing before accepting any advance.',
    hi: 'इसे तुरंत ऑफ़लाइन उठाएँ। कोई भी एडवांस लेने से पहले कैंसिलेशन और रिफ़ंड की स्लैब लिखकर दें।',
    mr: 'हे लगेच ऑफलाइन हाताळा. कोणतीही आगाऊ रक्कम घेण्याआधी रद्दीकरण आणि परताव्याचे टप्पे लेखी द्या.',
  },
  // --- gateway: restaurant (packs/restaurant.json) --------------------
  'pack.restaurant.dim.food': {
    en: 'Food and drink',
    hi: 'खाना और ड्रिंक्स',
    mr: 'जेवण आणि पेय',
  },
  'pack.restaurant.sig.food.taste': {
    en: 'Taste was off',
    hi: 'स्वाद ठीक नहीं था',
    mr: 'चव नीट नव्हती',
  },
  'pack.restaurant.sig.food.not_hot': {
    en: 'Not served hot',
    hi: 'गरम नहीं मिला',
    mr: 'गरम मिळालं नाही',
  },
  'pack.restaurant.sig.food.portion': {
    en: 'Portion was small',
    hi: 'मात्रा कम थी',
    mr: 'प्रमाण कमी होतं',
  },
  'pack.restaurant.sig.food.not_fresh': {
    en: 'Did not taste fresh',
    hi: 'ताज़ा नहीं लगा',
    mr: 'ताजं वाटलं नाही',
  },
  'pack.restaurant.sig.food.spice_level': {
    en: 'Spice level was wrong',
    hi: 'तीखापन सही नहीं था',
    mr: 'तिखटपणा योग्य नव्हता',
  },
  'pack.restaurant.dim.service': {
    en: 'Service',
    hi: 'सर्विस',
    mr: 'सर्व्हिस',
  },
  'pack.restaurant.sig.service.hard_to_find': {
    en: 'Hard to find someone',
    hi: 'कोई मिलना मुश्किल था',
    mr: 'कोणी सापडणं अवघड होतं',
  },
  'pack.restaurant.sig.service.rushed': {
    en: 'Felt rushed',
    hi: 'जल्दबाज़ी महसूस हुई',
    mr: 'घाई केल्यासारखं वाटलं',
  },
  'pack.restaurant.sig.service.order_wrong': {
    en: 'Order came wrong',
    hi: 'ऑर्डर ग़लत आया',
    mr: 'ऑर्डर चुकीची आली',
  },
  'pack.restaurant.sig.service.manner': {
    en: 'Rude or dismissive',
    hi: 'रूखा या बेपरवाह व्यवहार',
    mr: 'उद्धट किंवा दुर्लक्ष करणारी वागणूक',
  },
  'pack.restaurant.dim.waiting': {
    en: 'Waiting',
    hi: 'इंतज़ार',
    mr: 'प्रतीक्षा',
  },
  'pack.restaurant.sig.waiting.for_table': {
    en: 'For a table',
    hi: 'टेबल के लिए',
    mr: 'टेबलसाठी',
  },
  'pack.restaurant.sig.waiting.to_order': {
    en: 'To place the order',
    hi: 'ऑर्डर देने के लिए',
    mr: 'ऑर्डर देण्यासाठी',
  },
  'pack.restaurant.sig.waiting.for_food': {
    en: 'For the food',
    hi: 'खाने के लिए',
    mr: 'जेवणासाठी',
  },
  'pack.restaurant.sig.waiting.for_bill': {
    en: 'For the bill',
    hi: 'बिल के लिए',
    mr: 'बिलासाठी',
  },
  'pack.restaurant.dim.cleanliness': {
    en: 'Cleanliness',
    hi: 'साफ़-सफ़ाई',
    mr: 'स्वच्छता',
  },
  'pack.restaurant.sig.cleanliness.table': {
    en: 'The table',
    hi: 'टेबल',
    mr: 'टेबल',
  },
  'pack.restaurant.sig.cleanliness.washroom': {
    en: 'The washroom',
    hi: 'वॉशरूम',
    mr: 'वॉशरूम',
  },
  'pack.restaurant.sig.cleanliness.crockery': {
    en: 'Plates or glasses',
    hi: 'प्लेट या ग्लास',
    mr: 'प्लेट किंवा ग्लास',
  },
  'pack.restaurant.sig.cleanliness.seating_area': {
    en: 'The seating area',
    hi: 'बैठने की जगह',
    mr: 'बसण्याची जागा',
  },
  'pack.restaurant.dim.value': {
    en: 'Value for money',
    hi: 'पैसा वसूल',
    mr: 'पैसा वसूल',
  },
  'pack.restaurant.sig.value.too_high': {
    en: 'Prices are high',
    hi: 'क़ीमतें ज़्यादा हैं',
    mr: 'किंमती जास्त आहेत',
  },
  'pack.restaurant.sig.value.portion_price': {
    en: 'Portion for the price',
    hi: 'क़ीमत के हिसाब से मात्रा',
    mr: 'किंमतीच्या मानाने प्रमाण',
  },
  'pack.restaurant.sig.value.bill_surprise': {
    en: 'Bill was more than expected',
    hi: 'बिल उम्मीद से ज़्यादा आया',
    mr: 'बिल अपेक्षेपेक्षा जास्त आलं',
  },
  'pack.restaurant.sig.value.extra_charges': {
    en: 'Charges I was not told about',
    hi: 'ऐसे चार्ज जो बताए ही नहीं गए',
    mr: 'न सांगितलेले चार्ज',
  },

  // --- gateway: gym (packs/gym.json) ----------------------------------
  'pack.gym.dim.equipment': {
    en: 'Equipment',
    hi: 'उपकरण',
    mr: 'उपकरणं',
  },
  'pack.gym.sig.equipment.out_of_order': {
    en: 'Something was out of order',
    hi: 'कुछ ख़राब पड़ा था',
    mr: 'काहीतरी बंद होतं',
  },
  'pack.gym.sig.equipment.worn': {
    en: 'Worn out',
    hi: 'घिसे-पिटे उपकरण',
    mr: 'झिजलेली उपकरणं',
  },
  'pack.gym.sig.equipment.not_enough': {
    en: 'Not enough of it',
    hi: 'ज़रूरत से कम',
    mr: 'गरजेपेक्षा कमी',
  },
  'pack.gym.sig.equipment.weights_missing': {
    en: 'Weights missing or misplaced',
    hi: 'वेट ग़ायब या इधर-उधर पड़े हुए',
    mr: 'वेट गायब किंवा इकडे-तिकडे पडलेले',
  },
  'pack.gym.dim.cleanliness': {
    en: 'Cleanliness',
    hi: 'साफ़-सफ़ाई',
    mr: 'स्वच्छता',
  },
  'pack.gym.sig.cleanliness.equipment_dirty': {
    en: 'Equipment not wiped down',
    hi: 'उपकरण पोंछे नहीं गए',
    mr: 'उपकरणं पुसलेली नव्हती',
  },
  'pack.gym.sig.cleanliness.washroom': {
    en: 'The washroom',
    hi: 'वॉशरूम',
    mr: 'वॉशरूम',
  },
  'pack.gym.sig.cleanliness.changing_room': {
    en: 'The changing room',
    hi: 'चेंजिंग रूम',
    mr: 'चेंजिंग रूम',
  },
  'pack.gym.sig.cleanliness.floor': {
    en: 'The floor area',
    hi: 'फ़र्श का हिस्सा',
    mr: 'फरशीचा भाग',
  },
  'pack.gym.dim.trainers': {
    en: 'Trainers and staff',
    hi: 'ट्रेनर और स्टाफ़',
    mr: 'ट्रेनर आणि स्टाफ',
  },
  'pack.gym.sig.trainers.none_around': {
    en: 'No trainer around',
    hi: 'आस-पास कोई ट्रेनर नहीं',
    mr: 'आजूबाजूला ट्रेनर नाही',
  },
  'pack.gym.sig.trainers.no_guidance': {
    en: 'No guidance on form',
    hi: 'फ़ॉर्म पर कोई गाइडेंस नहीं',
    mr: 'फॉर्मबद्दल मार्गदर्शन नाही',
  },
  'pack.gym.sig.trainers.manner': {
    en: 'Rude or dismissive',
    hi: 'रूखा या बेपरवाह व्यवहार',
    mr: 'उद्धट किंवा दुर्लक्ष करणारी वागणूक',
  },
  'pack.gym.sig.trainers.sales_pressure': {
    en: 'Pushed to buy something',
    hi: 'कुछ ख़रीदने का दबाव',
    mr: 'काहीतरी घेण्याचा दबाव',
  },
  'pack.gym.dim.crowding': {
    en: 'How busy it was',
    hi: 'कितनी भीड़ थी',
    mr: 'किती गर्दी होती',
  },
  'pack.gym.sig.crowding.waited_machines': {
    en: 'Waited for machines',
    hi: 'मशीनों के लिए इंतज़ार',
    mr: 'मशीनसाठी प्रतीक्षा',
  },
  'pack.gym.sig.crowding.no_space': {
    en: 'No space to train',
    hi: 'वर्कआउट के लिए जगह नहीं',
    mr: 'वर्कआउटसाठी जागा नाही',
  },
  'pack.gym.sig.crowding.peak_hours': {
    en: 'Only at peak hours',
    hi: 'सिर्फ़ पीक टाइम पर',
    mr: 'फक्त पीक टाइमला',
  },
  'pack.gym.sig.crowding.classes_full': {
    en: 'Classes were full',
    hi: 'क्लास भरे हुए थे',
    mr: 'क्लास भरलेले होते',
  },
  'pack.gym.dim.facilities': {
    en: 'Changing rooms and facilities',
    hi: 'चेंजिंग रूम और सुविधाएँ',
    mr: 'चेंजिंग रूम आणि सुविधा',
  },
  'pack.gym.sig.facilities.too_hot': {
    en: 'Too hot or stuffy',
    hi: 'बहुत गर्मी या घुटन',
    mr: 'खूप उकाडा किंवा कोंदटपणा',
  },
  'pack.gym.sig.facilities.lockers': {
    en: 'Lockers',
    hi: 'लॉकर',
    mr: 'लॉकर',
  },
  'pack.gym.sig.facilities.showers': {
    en: 'Showers',
    hi: 'शावर',
    mr: 'शॉवर',
  },
  'pack.gym.sig.facilities.water': {
    en: 'Drinking water',
    hi: 'पीने का पानी',
    mr: 'पिण्याचं पाणी',
  },
  'pack.gym.sig.facilities.parking': {
    en: 'Parking',
    hi: 'पार्किंग',
    mr: 'पार्किंग',
  },

  // --- gateway: clinic (packs/clinic.json) ----------------------------
  'pack.clinic.dim.waiting': {
    en: 'Waiting time',
    hi: 'इंतज़ार का समय',
    mr: 'प्रतीक्षा वेळ',
  },
  'pack.clinic.sig.waiting.long_past_slot': {
    en: 'Well past my appointment time',
    hi: 'अपॉइंटमेंट के समय से काफ़ी बाद',
    mr: 'अपॉइंटमेंटच्या वेळेनंतर बराच उशीर',
  },
  'pack.clinic.sig.waiting.no_update': {
    en: 'Nobody told me how long',
    hi: 'किसी ने नहीं बताया कितनी देर लगेगी',
    mr: 'किती वेळ लागेल हे कोणी सांगितलं नाही',
  },
  'pack.clinic.sig.waiting.nowhere_to_sit': {
    en: 'Nowhere to sit',
    hi: 'बैठने की जगह नहीं',
    mr: 'बसायला जागाच नाही',
  },
  'pack.clinic.sig.waiting.order_skipped': {
    en: 'Others were taken before me',
    hi: 'मुझसे पहले दूसरों को बुला लिया गया',
    mr: 'माझ्या आधी इतरांना आत घेतलं',
  },
  'pack.clinic.dim.staff': {
    en: 'Staff at the desk',
    hi: 'डेस्क पर मौजूद स्टाफ़',
    mr: 'डेस्कवरचा स्टाफ',
  },
  'pack.clinic.sig.staff.manner': {
    en: 'Rude or dismissive',
    hi: 'रूखा या बेपरवाह व्यवहार',
    mr: 'उद्धट किंवा दुर्लक्ष करणारी वागणूक',
  },
  'pack.clinic.sig.staff.unclear_answers': {
    en: 'Could not answer my questions',
    hi: 'मेरे सवालों के जवाब नहीं दे पाए',
    mr: 'माझ्या प्रश्नांची उत्तरं देता आली नाहीत',
  },
  'pack.clinic.sig.staff.unreachable': {
    en: 'Could not reach anyone on the phone',
    hi: 'फ़ोन पर कोई नहीं मिला',
    mr: 'फोनवर कोणाशीच संपर्क झाला नाही',
  },
  'pack.clinic.sig.staff.billing': {
    en: 'Billing was not explained',
    hi: 'बिलिंग समझाई नहीं गई',
    mr: 'बिलिंग समजावून सांगितली नाही',
  },
  'pack.clinic.dim.consultation': {
    en: 'Time with the doctor',
    hi: 'डॉक्टर के साथ मिला समय',
    mr: 'डॉक्टरांसोबतचा वेळ',
  },
  'pack.clinic.sig.consultation.too_short': {
    en: 'Felt too short',
    hi: 'बहुत कम लगा',
    mr: 'खूप कमी वाटला',
  },
  'pack.clinic.sig.consultation.not_explained': {
    en: 'Condition not explained',
    hi: 'तकलीफ़ के बारे में नहीं समझाया',
    mr: 'आजाराबद्दल समजावून सांगितलं नाही',
  },
  'pack.clinic.sig.consultation.no_questions': {
    en: 'No room to ask questions',
    hi: 'सवाल पूछने की गुंजाइश नहीं',
    mr: 'प्रश्न विचारायला वावच नाही',
  },
  'pack.clinic.sig.consultation.followup_unclear': {
    en: 'Unclear what to do next',
    hi: 'आगे क्या करना है, साफ़ नहीं',
    mr: 'पुढे काय करायचं ते स्पष्ट नाही',
  },
  'pack.clinic.dim.booking': {
    en: 'Booking the appointment',
    hi: 'अपॉइंटमेंट की बुकिंग',
    mr: 'अपॉइंटमेंटची बुकिंग',
  },
  'pack.clinic.sig.booking.no_answer': {
    en: 'Phone went unanswered',
    hi: 'फ़ोन का जवाब ही नहीं मिला',
    mr: 'फोन उचललाच गेला नाही',
  },
  'pack.clinic.sig.booking.no_slot': {
    en: 'No slot available',
    hi: 'कोई स्लॉट ख़ाली नहीं',
    mr: 'एकही स्लॉट उपलब्ध नाही',
  },
  'pack.clinic.sig.booking.moved': {
    en: 'Appointment was moved',
    hi: 'अपॉइंटमेंट आगे-पीछे कर दी गई',
    mr: 'अपॉइंटमेंट पुढे-मागे केली गेली',
  },
  'pack.clinic.sig.booking.time_confusion': {
    en: 'Confusion about the time',
    hi: 'समय को लेकर गड़बड़ी',
    mr: 'वेळेबाबत गोंधळ',
  },
  'pack.clinic.dim.cleanliness': {
    en: 'Cleanliness',
    hi: 'साफ़-सफ़ाई',
    mr: 'स्वच्छता',
  },
  'pack.clinic.sig.cleanliness.waiting_area': {
    en: 'The waiting area',
    hi: 'वेटिंग एरिया',
    mr: 'वेटिंग एरिया',
  },
  'pack.clinic.sig.cleanliness.washroom': {
    en: 'The washroom',
    hi: 'वॉशरूम',
    mr: 'वॉशरूम',
  },
  'pack.clinic.sig.cleanliness.consult_room': {
    en: 'The consulting room',
    hi: 'कंसल्टेशन रूम',
    mr: 'कन्सल्टेशन रूम',
  },

  // --- gateway: salon (packs/salon.json) -----------------------------
  'pack.salon.dim.result': {
    en: 'The result',
    hi: 'रिज़ल्ट',
    mr: 'रिझल्ट',
  },
  'pack.salon.sig.result.not_as_asked': {
    en: 'Not what I asked for',
    hi: 'जो माँगा था वो नहीं मिला',
    mr: 'जे मागितलं तेच मिळालं नाही',
  },
  'pack.salon.sig.result.uneven': {
    en: 'Finish was uneven',
    hi: 'फ़िनिश एक जैसी नहीं थी',
    mr: 'फिनिश एकसारखी नव्हती',
  },
  'pack.salon.sig.result.did_not_last': {
    en: 'Did not last',
    hi: 'ज़्यादा दिन नहीं टिका',
    mr: 'फार दिवस टिकलं नाही',
  },
  'pack.salon.sig.result.products': {
    en: 'Products did not suit me',
    hi: 'प्रोडक्ट मुझे सूट नहीं हुए',
    mr: 'प्रॉडक्ट मला सूट झाले नाहीत',
  },
  'pack.salon.dim.stylist': {
    en: 'The person who served you',
    hi: 'जिसने आपकी सर्विस की',
    mr: 'ज्यांनी तुमची सर्व्हिस केली',
  },
  'pack.salon.sig.stylist.did_not_listen': {
    en: 'Did not listen to what I wanted',
    hi: 'मुझे क्या चाहिए था, वो सुना ही नहीं',
    mr: 'मला काय हवं होतं ते ऐकलंच नाही',
  },
  'pack.salon.sig.stylist.rushed': {
    en: 'Felt rushed',
    hi: 'जल्दबाज़ी महसूस हुई',
    mr: 'घाई केल्यासारखं वाटलं',
  },
  'pack.salon.sig.stylist.manner': {
    en: 'Rude or dismissive',
    hi: 'रूखा या बेपरवाह व्यवहार',
    mr: 'उद्धट किंवा दुर्लक्ष करणारी वागणूक',
  },
  'pack.salon.sig.stylist.pushed_extras': {
    en: 'Pushed extra services',
    hi: 'एक्स्ट्रा सर्विस लेने का दबाव',
    mr: 'एक्स्ट्रा सर्व्हिस घेण्याचा आग्रह',
  },
  'pack.salon.dim.waiting': {
    en: 'Waiting',
    hi: 'इंतज़ार',
    mr: 'प्रतीक्षा',
  },
  'pack.salon.sig.waiting.past_appointment': {
    en: 'Well past my appointment time',
    hi: 'अपॉइंटमेंट के समय से काफ़ी बाद',
    mr: 'अपॉइंटमेंटच्या वेळेनंतर बराच उशीर',
  },
  'pack.salon.sig.waiting.mid_service': {
    en: 'Left waiting mid-service',
    hi: 'सर्विस के बीच में इंतज़ार कराया',
    mr: 'सर्व्हिसच्या मध्येच वाट पाहायला लावली',
  },
  'pack.salon.sig.waiting.no_slot': {
    en: 'Could not get a slot',
    hi: 'स्लॉट ही नहीं मिला',
    mr: 'स्लॉटच मिळाला नाही',
  },
  'pack.salon.sig.waiting.unreachable': {
    en: 'Could not reach anyone to book',
    hi: 'बुकिंग के लिए कोई मिला ही नहीं',
    mr: 'बुकिंगसाठी कोणाशीच संपर्क झाला नाही',
  },
  'pack.salon.dim.cleanliness': {
    en: 'Cleanliness',
    hi: 'साफ़-सफ़ाई',
    mr: 'स्वच्छता',
  },
  'pack.salon.sig.cleanliness.tools': {
    en: 'Tools and equipment',
    hi: 'औज़ार और उपकरण',
    mr: 'साधनं आणि उपकरणं',
  },
  'pack.salon.sig.cleanliness.towels': {
    en: 'Towels or linen',
    hi: 'तौलिए या चादरें',
    mr: 'टॉवेल किंवा चादरी',
  },
  'pack.salon.sig.cleanliness.washroom': {
    en: 'The washroom',
    hi: 'वॉशरूम',
    mr: 'वॉशरूम',
  },
  'pack.salon.sig.cleanliness.station': {
    en: 'The station or chair',
    hi: 'स्टेशन या कुर्सी',
    mr: 'स्टेशन किंवा खुर्ची',
  },
  'pack.salon.dim.value': {
    en: 'Value for money',
    hi: 'पैसा वसूल',
    mr: 'पैसा वसूल',
  },
  'pack.salon.sig.value.more_than_quoted': {
    en: 'More than I was quoted',
    hi: 'बताए गए दाम से ज़्यादा',
    mr: 'सांगितलेल्या दरापेक्षा जास्त',
  },
  'pack.salon.sig.value.not_told': {
    en: 'Price not told upfront',
    hi: 'क़ीमत पहले नहीं बताई गई',
    mr: 'किंमत आधी सांगितली नाही',
  },
  'pack.salon.sig.value.too_high': {
    en: 'Prices are high',
    hi: 'क़ीमतें ज़्यादा हैं',
    mr: 'किंमती जास्त आहेत',
  },
  'pack.salon.sig.value.extras_added': {
    en: 'Extras added to the bill',
    hi: 'बिल में एक्स्ट्रा चीज़ें जोड़ दीं',
    mr: 'बिलात एक्स्ट्रा गोष्टी जोडल्या',
  },

  // --- gateway: coaching (packs/coaching.json) -----------------------
  'pack.coaching.dim.teaching': {
    en: 'Teaching',
    hi: 'पढ़ाना',
    mr: 'शिकवणं',
  },
  'pack.coaching.sig.teaching.pace': {
    en: 'Pace of the class',
    hi: 'क्लास की रफ़्तार',
    mr: 'क्लासचा वेग',
  },
  'pack.coaching.sig.teaching.doubts': {
    en: 'Doubts not cleared',
    hi: 'डाउट क्लियर नहीं हुए',
    mr: 'शंका दूर झाल्या नाहीत',
  },
  'pack.coaching.sig.teaching.depth': {
    en: 'Not enough depth',
    hi: 'गहराई से नहीं पढ़ाया',
    mr: 'पुरेशा खोलात शिकवलं नाही',
  },
  'pack.coaching.sig.teaching.material': {
    en: 'Study material not useful',
    hi: 'स्टडी मटीरियल काम का नहीं',
    mr: 'अभ्यास साहित्य उपयोगी नाही',
  },
  'pack.coaching.dim.faculty': {
    en: 'The faculty',
    hi: 'टीचर',
    mr: 'शिक्षक',
  },
  'pack.coaching.sig.faculty.changed': {
    en: 'Teacher was changed',
    hi: 'टीचर बदल दिया गया',
    mr: 'शिक्षक बदलले गेले',
  },
  'pack.coaching.sig.faculty.absent': {
    en: 'Teacher often absent',
    hi: 'टीचर अक्सर ग़ैरहाज़िर',
    mr: 'शिक्षक अनेकदा गैरहजर',
  },
  'pack.coaching.sig.faculty.manner': {
    en: 'Harsh or dismissive with students',
    hi: 'बच्चों से सख़्ती या बेपरवाही',
    mr: 'विद्यार्थ्यांशी कठोर किंवा दुर्लक्ष करणारी वागणूक',
  },
  'pack.coaching.sig.faculty.substitute': {
    en: 'Substitute took the class',
    hi: 'क्लास किसी और टीचर ने ली',
    mr: 'क्लास दुसऱ्या शिक्षकाने घेतला',
  },
  'pack.coaching.dim.communication': {
    en: 'Keeping you informed',
    hi: 'आपको जानकारी देते रहना',
    mr: 'तुम्हाला माहिती देत राहणं',
  },
  'pack.coaching.sig.communication.no_updates': {
    en: 'No updates on progress',
    hi: 'प्रोग्रेस की कोई जानकारी नहीं',
    mr: 'प्रगतीबद्दल काहीच कळवलं नाही',
  },
  'pack.coaching.sig.communication.schedule_changes': {
    en: 'Schedule changes not told',
    hi: 'शेड्यूल में बदलाव नहीं बताए गए',
    mr: 'वेळापत्रकातील बदल सांगितले नाहीत',
  },
  'pack.coaching.sig.communication.unreachable': {
    en: 'Hard to reach anyone',
    hi: 'किसी से संपर्क करना मुश्किल',
    mr: 'कोणाशीही संपर्क होणं अवघड',
  },
  'pack.coaching.sig.communication.no_test_feedback': {
    en: 'No feedback after tests',
    hi: 'टेस्ट के बाद कोई फ़ीडबैक नहीं',
    mr: 'टेस्टनंतर काहीच फीडबॅक नाही',
  },
  'pack.coaching.dim.facilities': {
    en: 'Classrooms and facilities',
    hi: 'क्लासरूम और सुविधाएँ',
    mr: 'क्लासरूम आणि सुविधा',
  },
  'pack.coaching.sig.facilities.batch_size': {
    en: 'Too many in the batch',
    hi: 'बैच में बहुत ज़्यादा बच्चे',
    mr: 'बॅचमध्ये खूप जास्त मुलं',
  },
  'pack.coaching.sig.facilities.too_hot': {
    en: 'Too hot or stuffy',
    hi: 'बहुत गर्मी या घुटन',
    mr: 'खूप उकाडा किंवा कोंदटपणा',
  },
  'pack.coaching.sig.facilities.seating': {
    en: 'Uncomfortable seating',
    hi: 'बैठने में तकलीफ़',
    mr: 'बसायला त्रासदायक जागा',
  },
  'pack.coaching.sig.facilities.washroom': {
    en: 'The washroom',
    hi: 'वॉशरूम',
    mr: 'वॉशरूम',
  },
  'pack.coaching.sig.facilities.safety': {
    en: 'Safety or supervision',
    hi: 'सुरक्षा या निगरानी',
    mr: 'सुरक्षा किंवा देखरेख',
  },
  'pack.coaching.dim.value': {
    en: 'Value for the fee',
    hi: 'फ़ीस का पैसा वसूल',
    mr: 'फीचा पैसा वसूल',
  },
  'pack.coaching.sig.value.extra_charges': {
    en: 'Charges I was not told about',
    hi: 'ऐसे चार्ज जो बताए ही नहीं गए',
    mr: 'न सांगितलेले चार्ज',
  },
  'pack.coaching.sig.value.too_high': {
    en: 'Fee is high',
    hi: 'फ़ीस ज़्यादा है',
    mr: 'फी जास्त आहे',
  },
  'pack.coaching.sig.value.refund_terms': {
    en: 'Refund terms',
    hi: 'रिफ़ंड की शर्तें',
    mr: 'रिफंडच्या अटी',
  },
  'pack.coaching.sig.value.results': {
    en: 'Results were not what was promised',
    hi: 'नतीजे वैसे नहीं मिले जैसे कहे गए थे',
    mr: 'सांगितल्याप्रमाणे निकाल मिळाले नाहीत',
  },

  // --- gateway: real_estate (packs/real_estate.json) -----------------
  'pack.real_estate.dim.communication': {
    en: 'Communication',
    hi: 'बातचीत',
    mr: 'संवाद',
  },
  'pack.real_estate.sig.communication.no_reply': {
    en: 'Calls or messages went unanswered',
    hi: 'कॉल या मैसेज का जवाब ही नहीं आया',
    mr: 'कॉल किंवा मेसेजला उत्तरच आलं नाही',
  },
  'pack.real_estate.sig.communication.slow': {
    en: 'Slow to come back',
    hi: 'जवाब देने में बहुत देर',
    mr: 'उत्तर द्यायला खूप उशीर',
  },
  'pack.real_estate.sig.communication.chased': {
    en: 'I had to keep chasing',
    hi: 'मुझे बार-बार पीछे पड़ना पड़ा',
    mr: 'मलाच सारखा पाठपुरावा करावा लागला',
  },
  'pack.real_estate.sig.communication.changed_hands': {
    en: 'Kept being passed to someone else',
    hi: 'बार-बार किसी और के पास भेज दिया गया',
    mr: 'सारखं दुसऱ्याकडे पाठवलं जात राहिलं',
  },
  'pack.real_estate.dim.transparency': {
    en: 'Being straight with you',
    hi: 'आपसे साफ़-साफ़ बात करना',
    mr: 'तुमच्याशी स्पष्ट बोलणं',
  },
  'pack.real_estate.sig.transparency.extra_charges': {
    en: 'Charges I was not told about',
    hi: 'ऐसे चार्ज जो बताए ही नहीं गए',
    mr: 'न सांगितलेले चार्ज',
  },
  'pack.real_estate.sig.transparency.price_changed': {
    en: 'Price changed later',
    hi: 'बाद में क़ीमत बदल गई',
    mr: 'नंतर किंमत बदलली',
  },
  'pack.real_estate.sig.transparency.pressure': {
    en: 'Pressed to decide quickly',
    hi: 'जल्दी फ़ैसला लेने का दबाव',
    mr: 'लवकर निर्णय घेण्याचा दबाव',
  },
  'pack.real_estate.sig.transparency.token_terms': {
    en: 'Token amount terms',
    hi: 'टोकन रक़म की शर्तें',
    mr: 'टोकन रकमेच्या अटी',
  },
  'pack.real_estate.dim.options': {
    en: 'The properties shown',
    hi: 'दिखाई गई प्रॉपर्टी',
    mr: 'दाखवलेल्या मालमत्ता',
  },
  'pack.real_estate.sig.options.not_as_listed': {
    en: 'Not as described',
    hi: 'जैसा बताया था वैसा नहीं',
    mr: 'सांगितल्यासारखं नव्हतं',
  },
  'pack.real_estate.sig.options.photos': {
    en: 'Photos did not match',
    hi: 'फ़ोटो से मेल नहीं खाया',
    mr: 'फोटोंशी जुळत नव्हतं',
  },
  'pack.real_estate.sig.options.already_gone': {
    en: 'Already taken',
    hi: 'पहले ही जा चुकी थी',
    mr: 'आधीच गेलेली होती',
  },
  'pack.real_estate.sig.options.wrong_budget': {
    en: 'Outside what I asked for',
    hi: 'जो माँगा था उससे बाहर',
    mr: 'मी सांगितलं होतं त्याबाहेरचं',
  },
  'pack.real_estate.dim.visits': {
    en: 'Site visits',
    hi: 'साइट विज़िट',
    mr: 'साइट भेटी',
  },
  'pack.real_estate.sig.visits.late': {
    en: 'Nobody turned up on time',
    hi: 'कोई समय पर नहीं आया',
    mr: 'कोणीच वेळेवर आलं नाही',
  },
  'pack.real_estate.sig.visits.no_access': {
    en: 'Could not get in',
    hi: 'अंदर जा ही नहीं पाए',
    mr: 'आत जाताच आलं नाही',
  },
  'pack.real_estate.sig.visits.rushed': {
    en: 'Rushed through it',
    hi: 'जल्दबाज़ी में निपटा दिया',
    mr: 'घाईघाईत उरकलं',
  },
  'pack.real_estate.sig.visits.no_answers': {
    en: 'Questions went unanswered',
    hi: 'सवालों के जवाब नहीं मिले',
    mr: 'प्रश्नांची उत्तरं मिळाली नाहीत',
  },
  'pack.real_estate.dim.paperwork': {
    en: 'Paperwork',
    hi: 'काग़ज़ी कार्रवाई',
    mr: 'कागदपत्रांचं काम',
  },
  'pack.real_estate.sig.paperwork.delayed': {
    en: 'Took far longer than said',
    hi: 'बताए गए समय से कहीं ज़्यादा लगा',
    mr: 'सांगितलेल्या वेळेपेक्षा खूप जास्त वेळ लागला',
  },
  'pack.real_estate.sig.paperwork.errors': {
    en: 'Errors in the documents',
    hi: 'काग़ज़ात में ग़लतियाँ',
    mr: 'कागदपत्रांत चुका',
  },
  'pack.real_estate.sig.paperwork.no_updates': {
    en: 'No updates on progress',
    hi: 'प्रोग्रेस की कोई जानकारी नहीं',
    mr: 'प्रगतीबद्दल काहीच कळवलं नाही',
  },
  'pack.real_estate.sig.paperwork.after_deal': {
    en: 'Support stopped after the deal',
    hi: 'सौदे के बाद मदद बंद हो गई',
    mr: 'व्यवहारानंतर मदत थांबली',
  },

  // --- gateway: wedding_vendor (packs/wedding_vendor.json) -----------
  'pack.wedding_vendor.dim.quality': {
    en: 'The work itself',
    hi: 'असल काम',
    mr: 'प्रत्यक्ष काम',
  },
  'pack.wedding_vendor.sig.quality.not_like_sample': {
    en: 'Not like the sample shown',
    hi: 'दिखाए गए सैंपल जैसा नहीं',
    mr: 'दाखवलेल्या सॅम्पलसारखं नाही',
  },
  'pack.wedding_vendor.sig.quality.missed_things': {
    en: 'Missed things I asked for',
    hi: 'जो कहा था वो छूट गया',
    mr: 'मी सांगितलेल्या गोष्टी राहून गेल्या',
  },
  'pack.wedding_vendor.sig.quality.uneven': {
    en: 'Quality was uneven',
    hi: 'क्वालिटी एक जैसी नहीं रही',
    mr: 'गुणवत्ता एकसारखी नव्हती',
  },
  'pack.wedding_vendor.sig.quality.revisions': {
    en: 'Changes were refused',
    hi: 'बदलाव करने से मना कर दिया',
    mr: 'बदल करायला नकार दिला',
  },
  'pack.wedding_vendor.dim.communication': {
    en: 'Communication',
    hi: 'बातचीत',
    mr: 'संवाद',
  },
  'pack.wedding_vendor.sig.communication.no_reply': {
    en: 'Messages went unanswered',
    hi: 'मैसेज का जवाब ही नहीं आया',
    mr: 'मेसेजला उत्तरच आलं नाही',
  },
  'pack.wedding_vendor.sig.communication.chased': {
    en: 'I had to keep chasing',
    hi: 'मुझे बार-बार पीछे पड़ना पड़ा',
    mr: 'मलाच सारखा पाठपुरावा करावा लागला',
  },
  'pack.wedding_vendor.sig.communication.plans_changed': {
    en: 'Plans changed without telling me',
    hi: 'बिना बताए प्लान बदल दिए',
    mr: 'न सांगता प्लॅन बदलले',
  },
  'pack.wedding_vendor.sig.communication.unclear_scope': {
    en: 'Never clear what was included',
    hi: 'क्या-क्या शामिल है, कभी साफ़ नहीं हुआ',
    mr: 'काय काय समाविष्ट आहे ते कधीच स्पष्ट झालं नाही',
  },
  'pack.wedding_vendor.dim.punctuality': {
    en: 'Being on time',
    hi: 'समय पर पहुँचना',
    mr: 'वेळेवर येणं',
  },
  'pack.wedding_vendor.sig.punctuality.arrived_late': {
    en: 'Arrived late',
    hi: 'देर से पहुँचे',
    mr: 'उशिरा पोहोचले',
  },
  'pack.wedding_vendor.sig.punctuality.delivery_late': {
    en: 'Delivery was late',
    hi: 'डिलीवरी में देर हुई',
    mr: 'डिलिव्हरी उशिरा झाली',
  },
  'pack.wedding_vendor.sig.punctuality.left_early': {
    en: 'Left before the end',
    hi: 'ख़त्म होने से पहले चले गए',
    mr: 'संपण्याआधीच निघून गेले',
  },
  'pack.wedding_vendor.sig.punctuality.setup_late': {
    en: 'Setup was not ready',
    hi: 'सेटअप तैयार नहीं था',
    mr: 'सेटअप तयार नव्हता',
  },
  'pack.wedding_vendor.dim.team': {
    en: 'The team on the day',
    hi: 'उस दिन आई टीम',
    mr: 'त्या दिवशीची टीम',
  },
  'pack.wedding_vendor.sig.team.different_people': {
    en: 'Not the people I was promised',
    hi: 'जिनका वादा था वो लोग नहीं आए',
    mr: 'ज्यांचं सांगितलं होतं ती माणसं आलीच नाहीत',
  },
  'pack.wedding_vendor.sig.team.short_staffed': {
    en: 'Fewer people than agreed',
    hi: 'तय से कम लोग आए',
    mr: 'ठरल्यापेक्षा कमी माणसं आली',
  },
  'pack.wedding_vendor.sig.team.conduct': {
    en: 'Unprofessional behaviour',
    hi: 'ग़ैर-पेशेवर व्यवहार',
    mr: 'अव्यावसायिक वागणूक',
  },
  'pack.wedding_vendor.sig.team.no_lead': {
    en: 'Nobody seemed in charge',
    hi: 'कोई ज़िम्मेदार दिखा ही नहीं',
    mr: 'कोणी जबाबदार व्यक्तीच दिसली नाही',
  },
  'pack.wedding_vendor.dim.value': {
    en: 'Value for the price',
    hi: 'क़ीमत के हिसाब से पैसा वसूल',
    mr: 'किंमतीच्या मानाने पैसा वसूल',
  },
  'pack.wedding_vendor.sig.value.extra_charges': {
    en: 'Charges I was not told about',
    hi: 'ऐसे चार्ज जो बताए ही नहीं गए',
    mr: 'न सांगितलेले चार्ज',
  },
  'pack.wedding_vendor.sig.value.more_than_quoted': {
    en: 'More than the quote',
    hi: 'कोटेशन से ज़्यादा',
    mr: 'कोटेशनपेक्षा जास्त',
  },
  'pack.wedding_vendor.sig.value.advance_terms': {
    en: 'Advance or refund terms',
    hi: 'एडवांस या रिफ़ंड की शर्तें',
    mr: 'ॲडव्हान्स किंवा रिफंडच्या अटी',
  },
  'pack.wedding_vendor.sig.value.not_included': {
    en: 'Things I assumed were included',
    hi: 'जो चीज़ें मैंने शामिल समझी थीं',
    mr: 'ज्या गोष्टी समाविष्ट आहेत असं मला वाटलं होतं',
  },

  // --- clinic askOwner (packs/clinic.json) -----------------------------
  'pack.clinic.wait_time.ask': {
    en: 'Where does the waiting mostly happen?',
    hi: 'इंतज़ार ज़्यादातर कहाँ होता है?',
    mr: 'प्रतीक्षा बहुतेक वेळा कुठे होते?',
  },
  'pack.clinic.wait_time.ask.0': {
    en: 'Before the appointment starts',
    hi: 'अपॉइंटमेंट शुरू होने से पहले',
    mr: 'अपॉइंटमेंट सुरू होण्याआधी',
  },
  'pack.clinic.wait_time.ask.1': {
    en: 'At reception or billing',
    hi: 'रिसेप्शन या बिलिंग पर',
    mr: 'रिसेप्शन किंवा बिलिंगला',
  },
  'pack.clinic.wait_time.ask.2': {
    en: 'The doctor runs late',
    hi: 'डॉक्टर को देर हो जाती है',
    mr: 'डॉक्टरांना उशीर होतो',
  },
  'pack.clinic.appointment_scheduling.ask': {
    en: 'Where do bookings most often go wrong?',
    hi: 'बुकिंग में सबसे ज़्यादा गड़बड़ी कहाँ होती है?',
    mr: 'बुकिंगमध्ये सर्वात जास्त गोंधळ कुठे होतो?',
  },
  'pack.clinic.appointment_scheduling.ask.0': {
    en: 'Phone bookings',
    hi: 'फ़ोन पर बुकिंग',
    mr: 'फोनवरून बुकिंग',
  },
  'pack.clinic.appointment_scheduling.ask.1': {
    en: 'Online or app bookings',
    hi: 'ऑनलाइन या ऐप से बुकिंग',
    mr: 'ऑनलाइन किंवा ॲपवरून बुकिंग',
  },
  'pack.clinic.appointment_scheduling.ask.2': {
    en: 'Walk-ins',
    hi: 'बिना अपॉइंटमेंट आने वाले',
    mr: 'अपॉइंटमेंटशिवाय येणारे',
  },
  'pack.clinic.billing_clarity.ask': {
    en: 'Which part of billing surprises patients?',
    hi: 'बिलिंग का कौन-सा हिस्सा मरीज़ों को चौंकाता है?',
    mr: 'बिलिंगचा कोणता भाग रुग्णांना अनपेक्षित वाटतो?',
  },
  'pack.clinic.billing_clarity.ask.0': {
    en: 'No estimate before treatment',
    hi: 'इलाज से पहले कोई अनुमान न देना',
    mr: 'उपचाराआधी अंदाजित खर्च न सांगणं',
  },
  'pack.clinic.billing_clarity.ask.1': {
    en: 'Final bill differs from the estimate',
    hi: 'आख़िरी बिल अनुमान से अलग',
    mr: 'अंतिम बिल अंदाजापेक्षा वेगळं',
  },
  'pack.clinic.billing_clarity.ask.2': {
    en: 'Insurance or paperwork',
    hi: 'इंश्योरेंस या काग़ज़ी काम',
    mr: 'इन्शुरन्स किंवा कागदपत्रं',
  },

  // --- gym askOwner (packs/gym.json) -----------------------------------
  'pack.gym.equipment_condition.ask': {
    en: 'What is the equipment problem mostly?',
    hi: 'उपकरणों की दिक़्क़त ज़्यादातर क्या है?',
    mr: 'उपकरणांची अडचण बहुतेक करून काय आहे?',
  },
  'pack.gym.equipment_condition.ask.0': {
    en: 'Machines out of order',
    hi: 'मशीनें ख़राब पड़ी हैं',
    mr: 'मशीन बंद पडलेल्या',
  },
  'pack.gym.equipment_condition.ask.1': {
    en: 'Not enough of the popular ones',
    hi: 'लोकप्रिय मशीनें कम पड़ती हैं',
    mr: 'लोकप्रिय मशीन कमी पडतात',
  },
  'pack.gym.equipment_condition.ask.2': {
    en: 'Worn or old equipment',
    hi: 'घिसे-पुराने उपकरण',
    mr: 'झिजलेली किंवा जुनी उपकरणं',
  },
  'pack.gym.crowding.ask': {
    en: 'When is it most crowded?',
    hi: 'सबसे ज़्यादा भीड़ कब होती है?',
    mr: 'सर्वात जास्त गर्दी कधी असते?',
  },
  'pack.gym.crowding.ask.0': {
    en: 'Weekday mornings',
    hi: 'वीकडे की सुबह',
    mr: 'आठवड्याच्या दिवशी सकाळी',
  },
  'pack.gym.crowding.ask.1': {
    en: 'Weekday evenings',
    hi: 'वीकडे की शाम',
    mr: 'आठवड्याच्या दिवशी संध्याकाळी',
  },
  'pack.gym.crowding.ask.2': {
    en: 'Weekends',
    hi: 'वीकेंड',
    mr: 'वीकेंडला',
  },
  'pack.gym.trainer_availability.ask': {
    en: 'When are trainers hardest to find?',
    hi: 'ट्रेनर सबसे ज़्यादा कब नहीं मिलते?',
    mr: 'ट्रेनर सर्वात जास्त कधी मिळत नाहीत?',
  },
  'pack.gym.trainer_availability.ask.0': {
    en: 'Peak hours',
    hi: 'पीक टाइम पर',
    mr: 'पीक टाइमला',
  },
  'pack.gym.trainer_availability.ask.1': {
    en: 'Early or late in the day',
    hi: 'सुबह जल्दी या शाम को देर से',
    mr: 'सकाळी लवकर किंवा उशिरा संध्याकाळी',
  },
  'pack.gym.trainer_availability.ask.2': {
    en: 'Weekends',
    hi: 'वीकेंड',
    mr: 'वीकेंडला',
  },

  // --- restaurant askOwner (packs/restaurant.json) ---------------------
  'pack.restaurant.food_quality.ask': {
    en: 'Which dishes do complaints mention most?',
    hi: 'शिकायतों में सबसे ज़्यादा कौन-से डिश आते हैं?',
    mr: 'तक्रारींमध्ये सर्वात जास्त कोणते पदार्थ येतात?',
  },
  'pack.restaurant.food_quality.ask.0': {
    en: 'A few specific dishes',
    hi: 'कुछ ख़ास डिश',
    mr: 'काही ठराविक पदार्थ',
  },
  'pack.restaurant.food_quality.ask.1': {
    en: 'Whole sections of the menu',
    hi: 'मेन्यू के पूरे-पूरे हिस्से',
    mr: 'मेन्यूचे संपूर्ण विभाग',
  },
  'pack.restaurant.food_quality.ask.2': {
    en: 'Not sure yet',
    hi: 'अभी पक्का नहीं',
    mr: 'अजून नक्की सांगता येत नाही',
  },
  'pack.restaurant.service_speed.ask': {
    en: 'When is service slowest?',
    hi: 'सर्विस सबसे धीमी कब होती है?',
    mr: 'सर्व्हिस सर्वात संथ कधी असते?',
  },
  'pack.restaurant.service_speed.ask.0': {
    en: 'Weekend evenings',
    hi: 'वीकेंड की शाम',
    mr: 'वीकेंडला संध्याकाळी',
  },
  'pack.restaurant.service_speed.ask.1': {
    en: 'Weekday lunch',
    hi: 'वीकडे का लंच',
    mr: 'आठवड्याच्या दिवशी दुपारचं जेवण',
  },
  'pack.restaurant.service_speed.ask.2': {
    en: 'All the time',
    hi: 'हर वक़्त',
    mr: 'नेहमीच',
  },
  'pack.restaurant.order_accuracy.ask': {
    en: 'Where do orders go wrong?',
    hi: 'ऑर्डर में गड़बड़ी कहाँ होती है?',
    mr: 'ऑर्डरमध्ये गोंधळ कुठे होतो?',
  },
  'pack.restaurant.order_accuracy.ask.0': {
    en: 'Taking the order',
    hi: 'ऑर्डर लेते वक़्त',
    mr: 'ऑर्डर घेताना',
  },
  'pack.restaurant.order_accuracy.ask.1': {
    en: 'In the kitchen',
    hi: 'किचन में',
    mr: 'किचनमध्ये',
  },
  'pack.restaurant.order_accuracy.ask.2': {
    en: 'Delivery or packing',
    hi: 'डिलीवरी या पैकिंग में',
    mr: 'डिलिव्हरी किंवा पॅकिंगमध्ये',
  },

  // --- salon askOwner (packs/salon.json) -------------------------------
  'pack.salon.service_result.ask': {
    en: 'Which services draw the complaints?',
    hi: 'शिकायतें किन सर्विस को लेकर आती हैं?',
    mr: 'तक्रारी कोणत्या सर्व्हिसबद्दल येतात?',
  },
  'pack.salon.service_result.ask.0': {
    en: 'Colour or chemical services',
    hi: 'कलर या केमिकल सर्विस',
    mr: 'कलर किंवा केमिकल सर्व्हिस',
  },
  'pack.salon.service_result.ask.1': {
    en: 'Cuts and styling',
    hi: 'कट और स्टाइलिंग',
    mr: 'कट आणि स्टायलिंग',
  },
  'pack.salon.service_result.ask.2': {
    en: 'Spa or skin treatments',
    hi: 'स्पा या स्किन ट्रीटमेंट',
    mr: 'स्पा किंवा स्किन ट्रीटमेंट',
  },
  'pack.salon.appointment_scheduling.ask': {
    en: 'Where do appointment problems usually start?',
    hi: 'अपॉइंटमेंट की दिक़्क़तें आमतौर पर कहाँ से शुरू होती हैं?',
    mr: 'अपॉइंटमेंटच्या अडचणी सहसा कुठून सुरू होतात?',
  },
  'pack.salon.appointment_scheduling.ask.0': {
    en: 'Appointment cancelled or not confirmed',
    hi: 'अपॉइंटमेंट रद्द या कन्फ़र्म ही नहीं हुई',
    mr: 'अपॉइंटमेंट रद्द किंवा कन्फर्मच झाली नाही',
  },
  'pack.salon.appointment_scheduling.ask.1': {
    en: 'The same stylist is double-booked',
    hi: 'एक ही स्टाइलिस्ट की डबल बुकिंग',
    mr: 'एकाच स्टायलिस्टची डबल बुकिंग',
  },
  'pack.salon.appointment_scheduling.ask.2': {
    en: 'The previous client runs over',
    hi: 'पिछले क्लाइंट में ज़्यादा वक़्त लग जाता है',
    mr: 'आधीच्या क्लायंटला जास्त वेळ लागतो',
  },
  'pack.salon.appointment_scheduling.ask.3': {
    en: 'The booking was not recorded',
    hi: 'बुकिंग दर्ज ही नहीं हुई',
    mr: 'बुकिंग नोंदवलीच गेली नाही',
  },
  'pack.salon.pricing_transparency.ask': {
    en: 'Where does the price change?',
    hi: 'क़ीमत कहाँ बदल जाती है?',
    mr: 'किंमत कुठे बदलते?',
  },
  'pack.salon.pricing_transparency.ask.0': {
    en: 'Add-ons during the service',
    hi: 'सर्विस के दौरान जुड़ने वाली चीज़ें',
    mr: 'सर्व्हिसदरम्यान वाढवलेल्या गोष्टी',
  },
  'pack.salon.pricing_transparency.ask.1': {
    en: 'Product charges at billing',
    hi: 'बिलिंग के वक़्त प्रोडक्ट के चार्ज',
    mr: 'बिलिंगच्या वेळी प्रॉडक्टचे चार्ज',
  },
  'pack.salon.pricing_transparency.ask.2': {
    en: 'Quoted price was unclear',
    hi: 'बताई गई क़ीमत साफ़ नहीं थी',
    mr: 'सांगितलेली किंमत स्पष्ट नव्हती',
  },
  // The vertical itself, as it is spoken inside a sentence: "a serious
  // complaint for a clinic / healthcare". English is the pack's own label,
  // lowercased exactly as the code lowercases it today.
  'pack.vertical.clinic': {
    en: 'clinic / healthcare',
    hi: 'क्लिनिक / हेल्थकेयर',
    mr: 'क्लिनिक / हेल्थकेअर',
  },
  'pack.vertical.coaching': {
    en: 'coaching / tuition centre',
    hi: 'कोचिंग / ट्यूशन सेंटर',
    mr: 'कोचिंग / ट्यूशन सेंटर',
  },
  'pack.vertical.gym': {
    en: 'gym / fitness studio',
    hi: 'जिम / फ़िटनेस स्टूडियो',
    mr: 'जिम / फिटनेस स्टुडिओ',
  },
  'pack.vertical.real_estate': {
    en: 'real estate / property',
    hi: 'रियल एस्टेट / प्रॉपर्टी',
    mr: 'रिअल एस्टेट / प्रॉपर्टी',
  },
  'pack.vertical.restaurant': {
    en: 'restaurant / cafe',
    hi: 'रेस्टोरेंट / कैफ़े',
    mr: 'रेस्टॉरंट / कॅफे',
  },
  'pack.vertical.salon': {
    en: 'salon / spa',
    hi: 'सैलॉन / स्पा',
    mr: 'सलून / स्पा',
  },
  'pack.vertical.wedding_vendor': {
    en: 'wedding vendor',
    hi: 'वेडिंग वेंडर',
    mr: 'वेडिंग व्हेंडर',
  },
} satisfies Namespace;
