# 🚀 B2B Pipeline Pro v2.0

منصة ذكاء مبيعات B2B متقدمة مع فرض **التحكم البشري (Human-in-the-loop)**.

## ✨ الميزات السبع الجديدة:
1. 🌐 **Buying Signals**: رصد إشارات الشراء (توظيف، تمويل).
2.  **Org Chart**: خريطة صناع القرار وتحليل الشخصيات.
3. 🧪 **A/B Testing**: تحسين الرسائل تلقائياً حسب معدل الرد.
4. 📄 **Micro-sites**: تتبع تفاعل العميل مع أقسام العرض.
5. 🎙️ **Battlecards**: تجهيز وتلخيص المكالمات تلقائياً.
6. ️ **Compliance**: فحص القوائم السوداء و Unsubscribe قبل الإرسال.
7. 🎯 **Intent Discovery**: رصد طلبات الخدمات المباشرة على الشبكات.

## ⚠️ القواعد الصارمة:
- **AI لا يحدد الأسعار**: التسعير يدوي 100% عبر `NegotiationHistory`.
- **لا سعر في الرسالة الأولى**: الحالة الافتراضية `NOT_SET`.
- **الموافقة البشرية إلزامية**: أي تواصل يمر بحالة `PENDING_APPROVAL`.
- **الإيراد الحقيقي**: يحسب فقط من `final_agreed_price`.

## ️ التشغيل:
```bash
cp .env.example .env
deno run --allow-net --allow-env --allow-read index.ts
```

##  النشر:
يدعم Wasmer Edge, Deno Deploy, Docker, و VPS عبر نمط `DatabaseAdapter`.
