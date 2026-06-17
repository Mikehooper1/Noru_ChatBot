/**
 * WhatsApp Clinic Receptionist question bank.
 * Applies only when business.type is clinic or hospital.
 *
 * handling:
 * - bot_answer   → AI answers from clinic knowledge base
 * - needs_agent  → hand off to receptionist
 * - urgent       → immediate escalation (emergency)
 */

const CLINIC_CATEGORIES = [
  {
    id: 'appointment',
    label: 'Book appointment',
    menuLabel: 'Book appointment',
    description: 'Scheduling, rescheduling, and appointment reminders',
  },
  {
    id: 'registration',
    label: 'Patient registration',
    menuLabel: 'Registration',
    description: 'New patient signup, documents, and profile updates',
  },
  {
    id: 'records',
    label: 'Medical records & reports',
    menuLabel: 'Records & reports',
    description: 'Prescriptions, lab reports, certificates, and referrals',
  },
  {
    id: 'billing',
    label: 'Billing, fees & insurance',
    menuLabel: 'Billing & fees',
    description: 'Consultation fees, insurance, payments, and invoices',
  },
  {
    id: 'services',
    label: 'Services & doctors',
    menuLabel: 'Services & doctors',
    description: 'Specialties, departments, teleconsultation, and packages',
  },
  {
    id: 'location',
    label: 'Location & general info',
    menuLabel: 'Location & hours',
    description: 'Address, directions, parking, and clinic hours',
  },
  {
    id: 'emergency',
    label: 'Emergency & urgent',
    menuLabel: 'Emergency',
    description: 'Medical emergencies and after-hours contact',
  },
  {
    id: 'followup',
    label: 'Follow-up & feedback',
    menuLabel: 'Follow-up & feedback',
    description: 'Post-visit questions, feedback, and complaints',
  },
];

const CLINIC_QUESTIONS = [
  // 1. Appointment Booking
  { category: 'appointment', text: 'I want to book an appointment', handling: 'bot_answer', patterns: [/book an? appointment/i, /want to book/i, /schedule (a )?visit/i] },
  { category: 'appointment', text: 'Which doctors are available today / tomorrow?', handling: 'bot_answer', patterns: [/doctors? available/i, /available today/i, /available tomorrow/i] },
  { category: 'appointment', text: 'Book appointment with Dr. [Name] on [date]', handling: 'bot_answer', patterns: [/book.*dr\.?/i, /appointment with dr/i] },
  { category: 'appointment', text: 'What are your clinic hours / timings?', handling: 'bot_answer', patterns: [/clinic hours/i, /clinic timings/i, /opening hours/i, /what time.*open/i] },
  { category: 'appointment', text: 'Is Dr. [Name] available on [day]?', handling: 'bot_answer', patterns: [/is dr\.?.*available/i, /doctor available on/i] },
  { category: 'appointment', text: 'I need to reschedule my appointment', handling: 'bot_answer', patterns: [/reschedule.*appointment/i, /change my appointment/i] },
  { category: 'appointment', text: 'I want to cancel my appointment', handling: 'bot_answer', patterns: [/cancel.*appointment/i] },
  { category: 'appointment', text: 'I need an urgent / same-day appointment', handling: 'needs_agent', patterns: [/urgent appointment/i, /same[- ]day appointment/i, /need.*today/i] },
  { category: 'appointment', text: 'Can I book for my family member?', handling: 'bot_answer', patterns: [/book for (my )?(family|relative|child|parent|spouse)/i, /family member/i] },
  { category: 'appointment', text: 'Do you have Sunday / holiday appointments?', handling: 'bot_answer', patterns: [/sunday appointment/i, /holiday appointment/i, /open on sunday/i] },
  { category: 'appointment', text: 'How early should I arrive before my slot?', handling: 'bot_answer', patterns: [/how early.*arrive/i, /before my (slot|appointment)/i] },
  { category: 'appointment', text: 'I missed my appointment — can I rebook?', handling: 'needs_agent', patterns: [/missed my appointment/i, /missed.*rebook/i, /no[- ]show/i] },
  { category: 'appointment', text: 'Can I get an appointment reminder?', handling: 'bot_answer', patterns: [/appointment reminder/i, /remind me.*appointment/i] },

  // 2. Patient Registration
  { category: 'registration', text: 'How do I register as a new patient?', handling: 'bot_answer', patterns: [/register as (a )?new patient/i, /new patient registration/i, /how do i register/i] },
  { category: 'registration', text: 'What documents do I need to bring?', handling: 'bot_answer', patterns: [/documents.*bring/i, /what (to )?bring/i, /required documents/i] },
  { category: 'registration', text: 'Can I register online before visiting?', handling: 'bot_answer', patterns: [/register online/i, /online registration/i, /register before visiting/i] },
  { category: 'registration', text: 'I am a returning patient — do I re-register?', handling: 'bot_answer', patterns: [/returning patient/i, /re[- ]?register/i, /do i (need to )?register again/i] },
  { category: 'registration', text: 'How do I register a child / minor?', handling: 'bot_answer', patterns: [/register (a )?child/i, /register.*minor/i, /child registration/i] },
  { category: 'registration', text: 'Can someone else register on my behalf?', handling: 'needs_agent', patterns: [/register on my behalf/i, /someone else register/i] },
  { category: 'registration', text: 'I forgot my patient ID / registration number', handling: 'needs_agent', patterns: [/forgot.*patient id/i, /forgot.*registration number/i, /lost my patient id/i] },
  { category: 'registration', text: 'How do I update my phone number or address?', handling: 'needs_agent', patterns: [/update (my )?(phone|address|contact)/i, /change (my )?(phone|address)/i] },

  // 3. Medical Records & Reports
  { category: 'records', text: 'I need a copy of my prescription', handling: 'needs_agent', patterns: [/copy of (my )?prescription/i, /need (my )?prescription/i] },
  { category: 'records', text: 'I need my lab test report', handling: 'needs_agent', patterns: [/lab (test )?report/i, /test results/i, /need my report/i] },
  { category: 'records', text: 'Can I get my discharge summary?', handling: 'needs_agent', patterns: [/discharge summary/i] },
  { category: 'records', text: 'How long does it take to get my report?', handling: 'bot_answer', patterns: [/how long.*report/i, /report turnaround/i, /when will.*report/i] },
  { category: 'records', text: 'Can reports be sent on WhatsApp / email?', handling: 'bot_answer', patterns: [/report.*whatsapp/i, /report.*email/i, /send.*report/i] },
  { category: 'records', text: 'I need a medical certificate for office / school', handling: 'needs_agent', patterns: [/medical certificate/i, /certificate for (office|school|work)/i] },
  { category: 'records', text: 'Can I get a referral letter from my doctor?', handling: 'needs_agent', patterns: [/referral letter/i, /referral from (my )?doctor/i] },
  { category: 'records', text: 'I want to transfer my records to another clinic', handling: 'needs_agent', patterns: [/transfer.*records/i, /records to another clinic/i] },

  // 4. Billing, Fees & Insurance
  { category: 'billing', text: 'What is the consultation fee?', handling: 'bot_answer', patterns: [/consultation fee/i, /doctor fee/i, /how much.*consultation/i] },
  { category: 'billing', text: 'Do you accept insurance / cashless treatment?', handling: 'bot_answer', patterns: [/accept insurance/i, /cashless/i, /insurance cover/i] },
  { category: 'billing', text: 'Which insurance companies do you accept?', handling: 'bot_answer', patterns: [/which insurance/i, /insurance companies/i, /list of insurance/i] },
  { category: 'billing', text: 'What payment methods are accepted (cash, card, UPI)?', handling: 'bot_answer', patterns: [/payment methods/i, /accept (cash|card|upi)/i, /how can i pay/i] },
  { category: 'billing', text: 'Can I get an estimate for a test or procedure?', handling: 'needs_agent', patterns: [/estimate for/i, /cost of (test|procedure|surgery)/i, /price estimate/i] },
  { category: 'billing', text: 'I have a wrong charge on my bill', handling: 'needs_agent', patterns: [/wrong charge/i, /incorrect bill/i, /billing (error|issue|dispute)/i] },
  { category: 'billing', text: 'Can I pay in installments?', handling: 'needs_agent', patterns: [/pay in installments/i, /installment/i, /emi/i] },
  { category: 'billing', text: 'I need a receipt / invoice for my visit', handling: 'needs_agent', patterns: [/need (a )?(receipt|invoice)/i, /send (me )?(receipt|invoice)/i] },
  { category: 'billing', text: 'Do you offer discounts for senior citizens?', handling: 'needs_agent', patterns: [/senior citizen.*discount/i, /discount for (senior|elderly)/i] },

  // 5. Services & Doctors
  { category: 'services', text: 'Which specialties / departments do you have?', handling: 'bot_answer', patterns: [/specialt(y|ies)/i, /departments? (do you|available)/i, /which departments/i] },
  { category: 'services', text: 'Do you have a [cardiologist / pediatrician / etc.]?', handling: 'bot_answer', patterns: [/do you have a (cardiologist|pediatrician|dermatologist|gynecologist|orthopedic|neurologist|dentist)/i, /have a specialist/i] },
  { category: 'services', text: 'Do you offer teleconsultation / video call?', handling: 'bot_answer', patterns: [/teleconsult/i, /video call/i, /online consultation/i] },
  { category: 'services', text: 'Do you do home visits?', handling: 'bot_answer', patterns: [/home visit/i, /doctor at home/i] },
  { category: 'services', text: 'What lab tests are available?', handling: 'bot_answer', patterns: [/lab tests? available/i, /what tests/i, /blood test/i] },
  { category: 'services', text: 'Do you have a pharmacy inside the clinic?', handling: 'bot_answer', patterns: [/pharmacy/i, /medicine shop/i] },
  { category: 'services', text: 'Do you offer vaccination services?', handling: 'bot_answer', patterns: [/vaccination/i, /vaccine/i, /immunization/i] },
  { category: 'services', text: 'Is there a dietician / physiotherapist?', handling: 'bot_answer', patterns: [/dietician|dietitian/i, /physiotherapist/i, /physio/i] },
  { category: 'services', text: 'Do you do health check-up packages?', handling: 'bot_answer', patterns: [/health check[- ]?up/i, /checkup package/i, /full body check/i] },
  { category: 'services', text: 'Do you have an ICU / operation theater?', handling: 'bot_answer', patterns: [/\bicu\b/i, /operation theater/i, /operation theatre/i] },

  // 6. Location & General Info
  { category: 'location', text: 'What is the clinic address?', handling: 'bot_answer', patterns: [/clinic address/i, /where are you located/i, /your address/i] },
  { category: 'location', text: 'How do I reach the clinic by bus / auto / car?', handling: 'bot_answer', patterns: [/how (do i )?reach/i, /directions to/i, /how to get there/i] },
  { category: 'location', text: 'Is parking available?', handling: 'bot_answer', patterns: [/parking available/i, /is there parking/i, /car park/i] },
  { category: 'location', text: 'Is the clinic open on Sundays / public holidays?', handling: 'bot_answer', patterns: [/open on sunday/i, /public holiday/i, /holiday hours/i] },
  { category: 'location', text: 'Do you have facilities for disabled / elderly patients?', handling: 'bot_answer', patterns: [/disabled|wheelchair/i, /elderly patients/i, /accessibility/i] },
  { category: 'location', text: 'What is your website or social media?', handling: 'bot_answer', patterns: [/website/i, /social media/i, /instagram|facebook/i] },
  { category: 'location', text: 'I just want to ask about your services', handling: 'bot_answer', patterns: [/ask about (your )?services/i, /tell me about (your )?services/i, /what services/i] },

  // 7. Emergency & Urgent
  { category: 'emergency', text: 'I have chest pain / difficulty breathing', handling: 'urgent', patterns: [/chest pain/i, /difficulty breathing/i, /can'?t breathe/i, /shortness of breath/i] },
  { category: 'emergency', text: 'My child has very high fever right now', handling: 'urgent', patterns: [/high fever/i, /very high fever/i, /child.*fever/i] },
  { category: 'emergency', text: 'I had an accident / injury', handling: 'urgent', patterns: [/had an accident/i, /accident.*injury/i, /serious injury/i, /badly injured/i] },
  { category: 'emergency', text: 'What is your emergency helpline number?', handling: 'bot_answer', patterns: [/emergency helpline/i, /emergency number/i, /emergency contact/i] },
  { category: 'emergency', text: 'Who should I call after clinic hours?', handling: 'bot_answer', patterns: [/after (clinic )?hours/i, /after hours/i, /outside working hours/i] },
  { category: 'emergency', text: 'Does the clinic handle emergency cases?', handling: 'bot_answer', patterns: [/handle emergency/i, /emergency cases/i] },
  { category: 'emergency', text: 'Is there an ambulance service?', handling: 'bot_answer', patterns: [/ambulance/i] },

  // 8. Follow-up & Feedback
  { category: 'followup', text: 'I want to share feedback about my visit', handling: 'needs_agent', patterns: [/share feedback/i, /feedback about (my )?visit/i, /rate my visit/i] },
  { category: 'followup', text: 'I want to speak to a human / receptionist', handling: 'needs_agent', patterns: [/speak to (a )?(human|receptionist|person|staff)/i, /talk to reception/i] },
  { category: 'followup', text: 'My condition got worse after the visit', handling: 'urgent', patterns: [/condition got worse/i, /worse after (the )?visit/i, /symptoms worsened/i] },
  { category: 'followup', text: 'I have a question for my doctor after my visit', handling: 'needs_agent', patterns: [/question for (my )?doctor/i, /ask (my )?doctor/i, /follow[- ]?up question/i] },
  { category: 'followup', text: 'When is my next follow-up appointment?', handling: 'bot_answer', patterns: [/next follow[- ]?up/i, /when is my follow/i, /follow up appointment/i] },
  { category: 'followup', text: 'Can I ask a general health question?', handling: 'bot_answer', patterns: [/general health question/i, /health question/i, /medical advice/i] },
  { category: 'followup', text: 'Do you send appointment reminders?', handling: 'bot_answer', patterns: [/send appointment reminders/i, /do you remind/i] },
  { category: 'followup', text: 'I want to file a complaint', handling: 'needs_agent', patterns: [/file a complaint/i, /lodge a complaint/i, /make a complaint/i] },
];

const CLINIC_MENU_QUICK_REPLIES = [
  'Book appointment',
  'My appointments',
  'Services & doctors',
  'Billing & fees',
  'Location & hours',
  'Emergency',
];

const URGENT_REPLY =
  '🚨 This sounds like a medical emergency. Please call your local emergency number (112 in India) or visit the nearest emergency room immediately. I am connecting you to our clinic team right away.';

const AGENT_REPLY =
  'I will connect you with our receptionist who can help with this. Please wait a moment...';

module.exports = {
  CLINIC_CATEGORIES,
  CLINIC_QUESTIONS,
  CLINIC_MENU_QUICK_REPLIES,
  URGENT_REPLY,
  AGENT_REPLY,
};
