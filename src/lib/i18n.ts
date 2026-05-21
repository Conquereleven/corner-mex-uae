import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const en = {
  nav: { shop: "Shop", sellers: "Sellers", b2b: "For Business", about: "About", account: "Account", cart: "Cart", login: "Sign in", signup: "Get started" },
  hero: {
    eyebrow: "Authentic Mexican supply · UAE",
    title: "The pantry of Mexico,",
    titleAccent: "delivered across the Emirates.",
    sub: "A curated marketplace of chiles, salsas, masa and snacks for restaurants, hotels, caterers and supermarkets — sourced from trusted Mexican producers.",
    ctaShop: "Browse the catalogue",
    ctaB2B: "Open a business account",
  },
  categories: { title: "Shop by category", chiles: "Dried chiles", salsas: "Salsas & moles", masa: "Masa & tortillas", snacks: "Snacks & sweets", drinks: "Drinks", pantry: "Pantry staples" },
  features: {
    title: "Built for the UAE's mexican kitchen",
    a: { title: "Verified producers", body: "Every brand is vetted for quality, origin and halal-friendly handling where applicable." },
    b: { title: "Multi-seller cart", body: "Order from several Mexican suppliers in a single checkout, billed in AED." },
    c: { title: "B2B pricing & quotes", body: "Volume tiers, custom catalogues and same-day quotes for restaurants & hotels." },
  },
  b2b: { eyebrow: "For restaurants, hotels & caterings", title: "Stock your kitchen with the real thing.", body: "Open a business account to unlock wholesale pricing, dedicated account managers and consolidated monthly invoicing across the Emirates.", cta: "Request access" },
  footer: { tagline: "Mexican corner. Emirati table.", rights: "All rights reserved.", shop: "Shop", company: "Company", legal: "Legal" },
  auth: { signin: "Sign in", signup: "Create account", email: "Email", password: "Password", name: "Full name", google: "Continue with Google", or: "or", haveAccount: "Already have an account?", noAccount: "New to Corner Mex?" },
};

const es = {
  nav: { shop: "Tienda", sellers: "Vendedores", b2b: "Para negocios", about: "Nosotros", account: "Cuenta", cart: "Carrito", login: "Entrar", signup: "Empezar" },
  hero: {
    eyebrow: "Insumos mexicanos auténticos · EAU",
    title: "La despensa de México,",
    titleAccent: "entregada en todos los Emiratos.",
    sub: "Un marketplace curado de chiles, salsas, masa y snacks para restaurantes, hoteles, caterings y supermercados — directo de productores mexicanos.",
    ctaShop: "Ver catálogo",
    ctaB2B: "Abrir cuenta de negocio",
  },
  categories: { title: "Compra por categoría", chiles: "Chiles secos", salsas: "Salsas y moles", masa: "Masa y tortillas", snacks: "Snacks y dulces", drinks: "Bebidas", pantry: "Despensa" },
  features: {
    title: "Hecho para la cocina mexicana en EAU",
    a: { title: "Productores verificados", body: "Cada marca pasa por revisión de calidad, origen y manejo halal-friendly cuando aplica." },
    b: { title: "Carrito multi-vendedor", body: "Pide a varios proveedores mexicanos en un solo checkout, facturado en AED." },
    c: { title: "Precios B2B y cotizaciones", body: "Niveles por volumen, catálogos a medida y cotizaciones el mismo día." },
  },
  b2b: { eyebrow: "Para restaurantes, hoteles y caterings", title: "Surte tu cocina con lo auténtico.", body: "Abre una cuenta de negocio para acceder a precios mayoristas, gerentes dedicados y facturación mensual consolidada.", cta: "Solicitar acceso" },
  footer: { tagline: "Esquina mexicana. Mesa emiratí.", rights: "Todos los derechos reservados.", shop: "Tienda", company: "Empresa", legal: "Legal" },
  auth: { signin: "Entrar", signup: "Crear cuenta", email: "Correo", password: "Contraseña", name: "Nombre completo", google: "Continuar con Google", or: "o", haveAccount: "¿Ya tienes cuenta?", noAccount: "¿Nuevo en Corner Mex?" },
};

const ar = {
  nav: { shop: "المتجر", sellers: "البائعون", b2b: "للأعمال", about: "من نحن", account: "الحساب", cart: "السلة", login: "تسجيل الدخول", signup: "ابدأ الآن" },
  hero: {
    eyebrow: "مؤن مكسيكية أصيلة · الإمارات",
    title: "مخزن المكسيك،",
    titleAccent: "يُسلَّم في جميع أنحاء الإمارات.",
    sub: "سوق مختار للفلفل والصلصات والذرة والوجبات الخفيفة للمطاعم والفنادق وشركات تموين الطعام والسوبر ماركت — من منتجين مكسيكيين موثوقين.",
    ctaShop: "تصفّح الكتالوج",
    ctaB2B: "فتح حساب أعمال",
  },
  categories: { title: "تسوّق حسب الفئة", chiles: "فلفل مجفف", salsas: "صلصات ومولي", masa: "ماسا وتورتيلا", snacks: "وجبات خفيفة وحلوى", drinks: "مشروبات", pantry: "أساسيات المؤن" },
  features: {
    title: "مصمَّم لمطبخ المكسيك في الإمارات",
    a: { title: "منتجون موثوقون", body: "كل علامة تجارية تُراجع للجودة والمنشأ والتعامل المتوافق مع الحلال عند الاقتضاء." },
    b: { title: "سلة متعددة البائعين", body: "اطلب من عدة موردين مكسيكيين في عملية شراء واحدة بالدرهم." },
    c: { title: "أسعار وعروض B2B", body: "أسعار جملة وكتالوجات مخصصة وعروض في نفس اليوم." },
  },
  b2b: { eyebrow: "للمطاعم والفنادق وشركات التموين", title: "زوّد مطبخك بالأصيل.", body: "افتح حساب أعمال للحصول على أسعار الجملة ومديري حسابات مخصصين وفوترة شهرية موحدة.", cta: "طلب الوصول" },
  footer: { tagline: "ركن مكسيكي. مائدة إماراتية.", rights: "جميع الحقوق محفوظة.", shop: "المتجر", company: "الشركة", legal: "قانوني" },
  auth: { signin: "تسجيل الدخول", signup: "إنشاء حساب", email: "البريد الإلكتروني", password: "كلمة المرور", name: "الاسم الكامل", google: "المتابعة عبر جوجل", or: "أو", haveAccount: "هل لديك حساب؟", noAccount: "جديد في كورنر ميكس؟" },
};

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: { en: { t: en }, es: { t: es }, ar: { t: ar } },
    lng: "en", // deterministic for SSR; client switches in LanguageProvider
    fallbackLng: "en",
    defaultNS: "t",
    ns: ["t"],
    interpolation: { escapeValue: false },
  });
}

export const LANGS = [
  { code: "en", label: "English", dir: "ltr" as const },
  { code: "es", label: "Español", dir: "ltr" as const },
  { code: "ar", label: "العربية", dir: "rtl" as const },
];

export default i18n;