// Minimal multi-language simulation configurations for English, Hindi, and Arabic
const translations: Record<string, any> = {
  en: {
    title: 'Airport Security Intelligent Surveillance',
    live_view: 'Live Video Grid',
    layout_editor: 'Building Layout Editor',
    reid_tracking: 'Cross-Cam Re-ID Mapping',
    alerts: 'Security Alerts'
  },
  hi: {
    title: 'हवाई अड्डा सुरक्षा निगरानी प्रणाली',
    live_view: 'लाइव वीडियो ग्रिड',
    layout_editor: 'इमारत नक्शा संपादक',
    reid_tracking: 'क्रॉस-कैमरा री-आइडेंटिफिकेशन',
    alerts: 'सुरक्षा अलर्ट'
  },
  ar: {
    title: 'نظام المراقبة الذكي لأمن المطارات',
    live_view: 'شبكة الفيديو الحية',
    layout_editor: 'محرر تخطيط المبنى',
    reid_tracking: 'تتبع إعادة تحديد الهوية',
    alerts: 'تنبيهات الأمن'
  }
};

export const getTranslation = (lang: 'en' | 'hi' | 'ar', key: string) => {
  return translations[lang]?.[key] || translations['en'][key] || key;
};
