/* ============================================================================
   Ready-made lists, in English and Arabic, so filling things in is a pick
   rather than typing. Amounts are only suggestions; everything stays editable.
   split: each = same for every apartment, total = one bill shared by share,
   custom = per subscriber.
   ============================================================================ */
var CHARGE_PRESETS = {
  fixed: [
    { g: ['Upkeep', 'الصيانة والتشغيل'], en: 'Building maintenance', ar: 'صيانة البناية', amt: 20, cur: 'USD', split: 'each' },
    { g: ['Upkeep', 'الصيانة والتشغيل'], en: 'Staircase & common areas cleaning', ar: 'تنظيف الدرج والأقسام المشتركة', amt: 10, cur: 'USD', split: 'each' },
    { g: ['Upkeep', 'الصيانة والتشغيل'], en: 'Elevator maintenance contract', ar: 'عقد صيانة المصعد', amt: 60, cur: 'USD', split: 'total' },
    { g: ['Upkeep', 'الصيانة والتشغيل'], en: 'Water pump maintenance', ar: 'صيانة مضخة المياه', amt: 20, cur: 'USD', split: 'total' },
    { g: ['Upkeep', 'الصيانة والتشغيل'], en: 'Garden care', ar: 'العناية بالحديقة', amt: 40, cur: 'USD', split: 'total' },
    { g: ['Trash', 'النفايات'], en: 'Trash collection (door to door)', ar: 'جمع النفايات من الأبواب', amt: 5, cur: 'USD', split: 'each' },
    { g: ['Trash', 'النفايات'], en: 'Trash collection company', ar: 'شركة جمع النفايات', amt: 60, cur: 'USD', split: 'total' },
    { g: ['Trash', 'النفايات'], en: 'Trash bags & bin cleaning', ar: 'أكياس النفايات وتنظيف المستوعبات', amt: 2, cur: 'USD', split: 'each' },
    { g: ['Staff', 'الموظفون'], en: 'Natour (concierge) salary', ar: 'راتب الناطور', amt: 300, cur: 'USD', split: 'total' },
    { g: ['Staff', 'الموظفون'], en: 'Security guard', ar: 'أجر الحارس', amt: 400, cur: 'USD', split: 'total' },
    { g: ['Staff', 'الموظفون'], en: 'Cleaner', ar: 'أجر عامل التنظيف', amt: 100, cur: 'USD', split: 'total' },
    { g: ['Power & water', 'الكهرباء والمياه'], en: 'Common areas electricity (EDL meter)', ar: 'كهرباء الأقسام المشتركة (عداد الدولة)', amt: 2000000, cur: 'LBP', split: 'total' },
    { g: ['Power & water', 'الكهرباء والمياه'], en: 'Common areas generator subscription', ar: 'اشتراك المولد للأقسام المشتركة', amt: 40, cur: 'USD', split: 'total' },
    { g: ['Power & water', 'الكهرباء والمياه'], en: 'Building generator diesel', ar: 'مازوت مولّد البناية', amt: 150, cur: 'USD', split: 'total' },
    { g: ['Power & water', 'الكهرباء والمياه'], en: 'Water subscription (monthly share)', ar: 'اشتراك المياه (الحصة الشهرية)', amt: 1000000, cur: 'LBP', split: 'total' },
    { g: ['Savings', 'الادخار'], en: 'Reserve fund', ar: 'صندوق الاحتياط', amt: 5, cur: 'USD', split: 'each' },
    { g: ['Savings', 'الادخار'], en: 'Solar system installment', ar: 'قسط نظام الطاقة الشمسية', amt: 25, cur: 'USD', split: 'each' }
  ],
  due: [
    { g: ['Water', 'المياه'], en: 'Water bill (Water Establishment)', ar: 'فاتورة مؤسسة المياه', amt: 10000000, cur: 'LBP', split: 'total' },
    { g: ['Water', 'المياه'], en: 'Water tanker fill', ar: 'نقلة صهريج مياه', amt: 40, cur: 'USD', split: 'total' },
    { g: ['Water', 'المياه'], en: 'Water tank cleaning', ar: 'تنظيف خزانات المياه', amt: 80, cur: 'USD', split: 'total' },
    { g: ['Water', 'المياه'], en: 'Water pump repair', ar: 'تصليح مضخة المياه', amt: 60, cur: 'USD', split: 'total' },
    { g: ['Power', 'الكهرباء'], en: 'EDL bill (common meter)', ar: 'فاتورة كهرباء الدولة (العداد المشترك)', amt: 3000000, cur: 'LBP', split: 'total' },
    { g: ['Power', 'الكهرباء'], en: 'Generator diesel top-up', ar: 'تعبئة مازوت للمولّد', amt: 200, cur: 'USD', split: 'total' },
    { g: ['Power', 'الكهرباء'], en: 'Generator repair', ar: 'تصليح المولّد', amt: 100, cur: 'USD', split: 'total' },
    { g: ['Power', 'الكهرباء'], en: 'Solar batteries replacement', ar: 'تبديل بطاريات الطاقة الشمسية', amt: 600, cur: 'USD', split: 'total' },
    { g: ['Repairs', 'التصليحات'], en: 'Elevator repair', ar: 'تصليح المصعد', amt: 150, cur: 'USD', split: 'total' },
    { g: ['Repairs', 'التصليحات'], en: 'Plumbing repair', ar: 'تصليحات صحية', amt: 50, cur: 'USD', split: 'total' },
    { g: ['Repairs', 'التصليحات'], en: 'Electrical repair', ar: 'تصليحات كهربائية', amt: 50, cur: 'USD', split: 'total' },
    { g: ['Repairs', 'التصليحات'], en: 'Intercom or entrance door repair', ar: 'تصليح الإنترفون أو باب المدخل', amt: 60, cur: 'USD', split: 'total' },
    { g: ['Repairs', 'التصليحات'], en: 'Garage gate repair', ar: 'تصليح باب الموقف', amt: 80, cur: 'USD', split: 'total' },
    { g: ['Repairs', 'التصليحات'], en: 'Roof waterproofing', ar: 'عزل السطح', amt: 1500, cur: 'USD', split: 'total' },
    { g: ['Repairs', 'التصليحات'], en: 'Painting common areas', ar: 'دهان الأقسام المشتركة', amt: 800, cur: 'USD', split: 'total' },
    { g: ['Safety & admin', 'السلامة والإدارة'], en: 'Fire extinguishers refill', ar: 'تعبئة طفايات الحريق', amt: 60, cur: 'USD', split: 'total' },
    { g: ['Safety & admin', 'السلامة والإدارة'], en: 'Pest control', ar: 'رش مبيدات', amt: 50, cur: 'USD', split: 'total' },
    { g: ['Safety & admin', 'السلامة والإدارة'], en: 'Building insurance', ar: 'تأمين البناية', amt: 300, cur: 'USD', split: 'total' },
    { g: ['Safety & admin', 'السلامة والإدارة'], en: 'Municipality fees (common parts)', ar: 'رسوم البلدية (الأقسام المشتركة)', amt: 5000000, cur: 'LBP', split: 'total' },
    { g: ['Safety & admin', 'السلامة والإدارة'], en: 'Lawyer or syndicate fees', ar: 'أتعاب المحامي أو النقابة', amt: 100, cur: 'USD', split: 'total' },
    { g: ['Trash', 'النفايات'], en: 'New trash bins', ar: 'مستوعبات نفايات جديدة', amt: 80, cur: 'USD', split: 'total' },
    { g: ['Trash', 'النفايات'], en: 'Bulky waste removal (renovation debris)', ar: 'رفع ردميات وأغراض كبيرة', amt: 50, cur: 'USD', split: 'total' },
    { g: ['Trash', 'النفايات'], en: 'Municipality trash fee', ar: 'رسم النفايات للبلدية', amt: 2000000, cur: 'LBP', split: 'total' },
    { g: ['Other', 'أخرى'], en: 'Common light bulbs', ar: 'لمبات الأقسام المشتركة', amt: 20, cur: 'USD', split: 'total' },
    { g: ['Other', 'أخرى'], en: 'Holiday decoration', ar: 'زينة الأعياد', amt: 50, cur: 'USD', split: 'total' }
  ],
  service: [
    { g: ['Collected for a supplier', 'تُجمع لمورّد'], en: 'Private generator (moteur)', ar: 'اشتراك الموتور', cur: 'USD' },
    { g: ['Collected for a supplier', 'تُجمع لمورّد'], en: 'Internet', ar: 'اشتراك الإنترنت', cur: 'USD' },
    { g: ['Collected for a supplier', 'تُجمع لمورّد'], en: 'Satellite dish', ar: 'اشتراك الدش', cur: 'USD' },
    { g: ['Collected for a supplier', 'تُجمع لمورّد'], en: 'Cable TV', ar: 'اشتراك الكابل', cur: 'USD' },
    { g: ['Collected for a supplier', 'تُجمع لمورّد'], en: 'Drinking water delivery', ar: 'توصيل مياه الشرب', cur: 'USD' },
    { g: ['Collected for a supplier', 'تُجمع لمورّد'], en: 'Cooking gas', ar: 'غاز الطبخ', cur: 'USD' },
    { g: ['Collected for a supplier', 'تُجمع لمورّد'], en: 'Solar power share', ar: 'حصة الطاقة الشمسية', cur: 'USD' },
    { g: ['Collected for a supplier', 'تُجمع لمورّد'], en: 'Private trash pickup', ar: 'جمع النفايات الخاص', cur: 'USD' },
    { g: ['Collected for a supplier', 'تُجمع لمورّد'], en: 'Parking space rent', ar: 'إيجار موقف السيارة', cur: 'USD' }
  ]
};

var EXPENSE_PRESETS = [
  { cat: 'gen', en: 'Generator diesel', ar: 'مازوت المولّد' },
  { cat: 'gen', en: 'Generator oil & filters', ar: 'زيت وفلاتر المولّد' },
  { cat: 'gen', en: 'Generator repair', ar: 'تصليح المولّد' },
  { cat: 'elev', en: 'Elevator monthly service', ar: 'صيانة المصعد الشهرية' },
  { cat: 'elev', en: 'Elevator repair', ar: 'تصليح المصعد' },
  { cat: 'water', en: 'Water bill', ar: 'فاتورة المياه' },
  { cat: 'water', en: 'Water tanker', ar: 'صهريج مياه' },
  { cat: 'water', en: 'Water tank cleaning', ar: 'تنظيف خزانات المياه' },
  { cat: 'water', en: 'Water pump repair', ar: 'تصليح مضخة المياه' },
  { cat: 'clean', en: 'Cleaning supplies', ar: 'مواد تنظيف' },
  { cat: 'clean', en: 'Trash bags', ar: 'أكياس نفايات' },
  { cat: 'clean', en: 'Trash collection fee', ar: 'رسم جمع النفايات' },
  { cat: 'clean', en: 'Trash bins', ar: 'مستوعبات نفايات' },
  { cat: 'clean', en: 'Bulky waste removal', ar: 'رفع ردميات وأغراض كبيرة' },
  { cat: 'clean', en: 'Pest control', ar: 'رش مبيدات' },
  { cat: 'light', en: 'Light bulbs', ar: 'لمبات إنارة' },
  { cat: 'light', en: 'EDL bill (common meter)', ar: 'فاتورة كهرباء الدولة (العداد المشترك)' },
  { cat: 'light', en: 'Electrician', ar: 'كهربائي' },
  { cat: 'repair', en: 'Plumber', ar: 'سنكري' },
  { cat: 'repair', en: 'Locksmith / door repair', ar: 'تصليح أقفال وأبواب' },
  { cat: 'repair', en: 'Intercom repair', ar: 'تصليح الإنترفون' },
  { cat: 'repair', en: 'Painting', ar: 'دهان' },
  { cat: 'repair', en: 'Roof waterproofing', ar: 'عزل السطح' },
  { cat: 'repair', en: 'Fire extinguishers refill', ar: 'تعبئة طفايات الحريق' },
  { cat: 'staff', en: 'Natour salary', ar: 'راتب الناطور' },
  { cat: 'staff', en: 'Cleaner pay', ar: 'أجر عامل التنظيف' },
  { cat: 'staff', en: 'Gardener', ar: 'جنيناتي' },
  { cat: 'other', en: 'Building insurance', ar: 'تأمين البناية' },
  { cat: 'other', en: 'Municipality fees', ar: 'رسوم البلدية' },
  { cat: 'other', en: 'Transport / delivery', ar: 'نقل وتوصيل' }
];

var TASK_PRESETS = [
  { g: ['Water', 'المياه'], en: 'Clean water tanks', ar: 'تنظيف خزانات المياه', rep: 'halfyear', who: 'collector' },
  { g: ['Water', 'المياه'], en: 'Check the water pump', ar: 'فحص مضخة المياه', rep: 'monthly', who: 'collector' },
  { g: ['Water', 'المياه'], en: 'Read the water meters', ar: 'قراءة عدادات المياه', rep: 'monthly', who: 'collector' },
  { g: ['Water', 'المياه'], en: 'Order a water tanker', ar: 'طلب صهريج مياه', rep: 'none', who: 'manager' },
  { g: ['Power', 'الكهرباء'], en: 'Generator oil change', ar: 'تغيير زيت المولّد', rep: 'monthly', who: 'collector' },
  { g: ['Power', 'الكهرباء'], en: 'Top up generator diesel', ar: 'تعبئة مازوت المولّد', rep: 'weekly', who: 'collector' },
  { g: ['Power', 'الكهرباء'], en: 'Dust the solar panels', ar: 'تنظيف ألواح الطاقة الشمسية', rep: 'monthly', who: 'collector' },
  { g: ['Power', 'الكهرباء'], en: 'Replace burnt common lights', ar: 'تبديل اللمبات المحروقة', rep: 'monthly', who: 'collector' },
  { g: ['Trash', 'النفايات'], en: 'Collect trash from the floors', ar: 'جمع النفايات من الطوابق', rep: 'daily', who: 'collector' },
  { g: ['Trash', 'النفايات'], en: 'Put the bins out for pickup', ar: 'إخراج المستوعبات للجمع', rep: 'daily', who: 'collector' },
  { g: ['Trash', 'النفايات'], en: 'Sort recycling (plastic, cardboard)', ar: 'فرز إعادة التدوير (بلاستيك، كرتون)', rep: 'weekly', who: 'collector' },
  { g: ['Trash', 'النفايات'], en: 'Pay the trash collection company', ar: 'الدفع لشركة جمع النفايات', rep: 'monthly', who: 'manager' },
  { g: ['Trash', 'النفايات'], en: 'Wash the trash bins', ar: 'غسل مستوعبات النفايات', rep: 'weekly', who: 'collector' },
  { g: ['Cleaning', 'التنظيف'], en: 'Clean the staircase', ar: 'تنظيف الدرج', rep: 'weekly', who: 'collector' },
  { g: ['Cleaning', 'التنظيف'], en: 'Clean the entrance glass', ar: 'تنظيف زجاج المدخل', rep: 'weekly', who: 'collector' },
  { g: ['Cleaning', 'التنظيف'], en: 'Clear roof drains before winter', ar: 'تنظيف مجاري السطح قبل الشتاء', rep: 'yearly', who: 'collector' },
  { g: ['Cleaning', 'التنظيف'], en: 'Clean basement drains & light wells', ar: 'تنظيف مجاري الطابق السفلي والمناور', rep: 'quarterly', who: 'collector' },
  { g: ['Cleaning', 'التنظيف'], en: 'Water the garden', ar: 'سقاية الحديقة', rep: 'weekly', who: 'collector' },
  { g: ['Safety', 'السلامة'], en: 'Elevator service visit', ar: 'زيارة صيانة المصعد', rep: 'monthly', who: 'manager' },
  { g: ['Safety', 'السلامة'], en: 'Elevator safety certificate', ar: 'شهادة سلامة المصعد', rep: 'yearly', who: 'manager' },
  { g: ['Safety', 'السلامة'], en: 'Check fire extinguishers', ar: 'فحص طفايات الحريق', rep: 'yearly', who: 'manager' },
  { g: ['Safety', 'السلامة'], en: 'Pest control', ar: 'رش مبيدات', rep: 'halfyear', who: 'manager' },
  { g: ['Safety', 'السلامة'], en: 'Test the intercom & door lock', ar: 'فحص الإنترفون وقفل الباب', rep: 'quarterly', who: 'collector' },
  { g: ['Admin', 'الإدارة'], en: 'Collect the monthly dues', ar: 'جمع المستحقات الشهرية', rep: 'monthly', who: 'collector' },
  { g: ['Admin', 'الإدارة'], en: 'Share the monthly report', ar: 'مشاركة التقرير الشهري', rep: 'monthly', who: 'manager' },
  { g: ['Admin', 'الإدارة'], en: 'Renew building insurance', ar: 'تجديد تأمين البناية', rep: 'yearly', who: 'manager' },
  { g: ['Admin', 'الإدارة'], en: 'Pay the generator owner', ar: 'الدفع لصاحب المولّد', rep: 'monthly', who: 'manager' },
  { g: ['Admin', 'الإدارة'], en: 'Residents\' meeting', ar: 'اجتماع السكان', rep: 'halfyear', who: 'manager' }
];

/* A <select> that lists presets grouped, each shown in both languages. */
function presetSelect(id, list, onchange, label) {
  var h = '<select class="input preset-pick" id="' + id + '" onchange="' + onchange + '"><option value="">' + esc(label || t('Pick from the list…', 'اختر من القائمة…')) + '</option>';
  var group = null;
  list.forEach(function(p, i) {
    var gk = p.g ? p.g[0] : (p.cat ? catName(p.cat) : '');
    if (gk !== group) {
      if (group !== null) h += '</optgroup>';
      group = gk;
      h += '<optgroup label="' + esc(p.g ? (LANG === 'ar' ? p.g[1] + ' · ' + p.g[0] : p.g[0] + ' · ' + p.g[1]) : catIcon(p.cat) + ' ' + gk) + '">';
    }
    h += '<option value="' + i + '">' + esc(LANG === 'ar' ? p.ar + ' · ' + p.en : p.en + ' · ' + p.ar) + '</option>';
  });
  if (group !== null) h += '</optgroup>';
  return h + '</select>';
}
