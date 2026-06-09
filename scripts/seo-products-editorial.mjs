#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

if (existsSync(".env") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
}

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  }),
);

const sourceBackupPath = resolve(String(args.get("source-backup") ?? ""));
const currentBackupPath = args.get("current-backup")
  ? resolve(String(args.get("current-backup")))
  : null;
const outputDir = resolve(
  String(
    args.get("output-dir") ??
      `artifacts/seo-products-editorial/${new Date().toISOString().replace(/[:.]/g, "-")}`,
  ),
);
const expectedCount = Number(args.get("expected-count") ?? 150);
const generatedAt = new Date().toISOString();

if (!sourceBackupPath || !existsSync(sourceBackupPath)) {
  throw new Error(
    "Pass --source-backup=/absolute/path/products-backup.json using the pre-SEO backup.",
  );
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
}

const supabase = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const LANGS = ["en", "es", "ar"];
const RESTRICTED_CLAIMS = [
  "organic",
  "gluten-free",
  "vegan",
  "keto",
  "halal",
  "preservative-free",
  "high in protein",
  "high in fiber",
  "no artificial colors",
  "made in mexico",
  "real cane sugar",
];

const COPY = {
  en: {
    location: "UAE",
    titleSuffix: "UAE | Corner Mex",
    shop: [
      ({ name }) =>
        `${name} is available online from Corner Mex for delivery in Dubai, Abu Dhabi and across the UAE.`,
      ({ name, use }) =>
        `Order ${name} from Corner Mex when planning ${use}, with delivery across the UAE.`,
      ({ name }) => `Corner Mex stocks ${name} for shoppers in Dubai, Abu Dhabi and the wider UAE.`,
      ({ name }) =>
        `Make ${name} part of the next pantry restock with online UAE delivery from Corner Mex.`,
    ],
    metaCta: [
      "Order online from Corner Mex UAE.",
      "Find it at Corner Mex with UAE delivery.",
      "Bring it home with Corner Mex UAE.",
      "Shop it online for delivery across the UAE.",
    ],
    hooks: [
      ({ name, sensory, type }) => `${name} is a ${type} with a clear point of view: ${sensory}.`,
      ({ name, sensory, use }) => `The appeal of ${name} lies in ${sensory}, especially in ${use}.`,
      ({ name, sensory, type }) =>
        `${name} brings ${sensory} to a ${type} made for more expressive food moments.`,
      ({ name, sensory, use }) => `Choose ${name} for ${sensory} when planning ${use}.`,
      ({ name, sensory, type }) =>
        `${name} turns a familiar ${type} into something more memorable through ${sensory}.`,
      ({ name, sensory, use }) =>
        `For shoppers who care about flavour as much as function, ${name} offers ${sensory} for ${use}.`,
    ],
    use: [
      ({ name, uses }) =>
        `Use ${name} with ${uses} to add a more deliberate Mexican note to the plate.`,
      ({ name, uses }) =>
        `In the kitchen, ${name} earns its place with ${uses}, where its character stays easy to recognise.`,
      ({ name, uses }) =>
        `Reach for ${name} when serving ${uses}; it adds interest without making the occasion complicated.`,
      ({ name, uses }) =>
        `The strongest serving ideas for ${name} are ${uses}, covering both quick cravings and planned menus.`,
      ({ name, uses }) =>
        `Build the serving moment for ${name} around ${uses} and let its flavour lead the experience.`,
    ],
    occasion: [
      ({ name, occasion, use }) =>
        `${name} works especially well for ${occasion}, particularly when the plan includes ${use}.`,
      ({ name, occasion }) =>
        `For ${occasion}, ${name} feels considered without becoming difficult to enjoy or serve.`,
      ({ name, occasion, sensory }) =>
        `Keep ${name} in mind for ${occasion}, when the promise of ${sensory} helps people choose quickly.`,
      ({ name, occasion, use }) =>
        `${name} is a practical match for ${occasion} because its role in ${use} is immediately clear.`,
    ],
    format: [
      ({ name, format, occasion }) =>
        `The ${format} presentation of ${name} makes the portion easy to plan for ${occasion}.`,
      ({ name, format, use }) =>
        `With ${format} in the pack, ${name} gives a clear reference point for ${use}.`,
      ({ name, format, occasion }) =>
        `At ${format}, ${name} is straightforward to size for ${occasion}.`,
    ],
    claim: ({ name, claims }) =>
      `The product information supplied for ${name} also notes: ${claims}.`,
    compactMeta: [
      ({ name, type, sensory, cta }) => `${name}, ${type}: ${sensory}. ${cta}`,
      ({ name, type, use, cta }) => `${name}: ${type} for ${use}. ${cta}`,
      ({ name, type, occasion }) => `${name}: ${type} selected for ${occasion}.`,
    ],
    meta: [
      ({ name, type, sensory, use, cta }) =>
        `${name}, a ${type}: ${sensory}, ideal for ${use}. ${cta}`,
      ({ name, type, use, cta }) => `Discover ${name}, a ${type} selected for ${use}. ${cta}`,
      ({ name, type, sensory, occasion, cta }) =>
        `${name}, a ${type}, brings ${sensory} to ${occasion}. ${cta}`,
      ({ name, type, sensory, cta }) => `Buy ${name}, a ${type} defined by ${sensory}. ${cta}`,
    ],
  },
  es: {
    location: "EAU",
    titleSuffix: "EAU | Corner Mex",
    shop: [
      ({ name }) =>
        `${name} está disponible online en Corner Mex con entrega en Dubái, Abu Dabi y otros emiratos.`,
      ({ name, use }) =>
        `Pide ${name} en Corner Mex al planear ${use}, con entrega en distintos puntos de Emiratos.`,
      ({ name }) => `Corner Mex ofrece ${name} a compradores de Dubái, Abu Dabi y el resto de EAU.`,
      ({ name }) =>
        `Incluye ${name} en tu próxima compra de despensa con entrega online de Corner Mex en EAU.`,
    ],
    metaCta: [
      "Compra online en Corner Mex EAU.",
      "Pídelo en Corner Mex con entrega en EAU.",
      "Llévalo a tu mesa con Corner Mex.",
      "Disponible online para entrega en Emiratos.",
    ],
    hooks: [
      ({ name, sensory, type }) =>
        `${name} tiene una personalidad clara dentro de la categoría de ${type}: ${sensory}.`,
      ({ name, sensory, use }) =>
        `El atractivo de ${name} está en ${sensory} y en la facilidad de integrarlo en ${use}.`,
      ({ name, sensory, type }) =>
        `${name} lleva ${sensory} a la categoría de ${type}, con una propuesta pensada para momentos de sabor más expresivos.`,
      ({ name, sensory, use }) => `Elige ${name} si buscas ${sensory} para ${use}.`,
      ({ name, sensory, type }) =>
        `${name} convierte la idea de ${type} en una experiencia más memorable gracias a ${sensory}.`,
      ({ name, sensory, use }) =>
        `Para quien valora tanto el sabor como la practicidad, ${name} ofrece ${sensory} para ${use}.`,
    ],
    use: [
      ({ name, uses }) =>
        `Usa ${name} con ${uses} para dar a la mesa un acento mexicano más intencional.`,
      ({ name, uses }) =>
        `${name} encuentra su mejor lugar junto a ${uses}, donde su carácter se reconoce desde el primer bocado.`,
      ({ name, uses }) =>
        `Ten ${name} a mano al servir ${uses}; aporta interés sin complicar el momento.`,
      ({ name, uses }) =>
        `Las formas más atractivas de servir ${name} incluyen ${uses}, desde un antojo rápido hasta un menú planeado.`,
      ({ name, uses }) =>
        `Construye el momento de ${name} alrededor de ${uses} y deja que su perfil guíe la experiencia.`,
    ],
    occasion: [
      ({ name, occasion, use }) =>
        `${name} funciona especialmente bien para ${occasion}, sobre todo cuando el plan incluye ${use}.`,
      ({ name, occasion }) =>
        `Para ${occasion}, ${name} se siente especial sin dejar de ser sencillo de servir y disfrutar.`,
      ({ name, occasion, sensory }) =>
        `Considera ${name} para ${occasion}, cuando la promesa de ${sensory} ayuda a decidir sin esfuerzo.`,
      ({ name, occasion, use }) =>
        `${name} es una opción práctica para ${occasion} porque su papel en ${use} se entiende de inmediato.`,
    ],
    format: [
      ({ name, format, occasion }) =>
        `La presentación de ${format} de ${name} permite calcular con facilidad la porción para ${occasion}.`,
      ({ name, format, use }) =>
        `Con ${format} por envase, ${name} ofrece una referencia clara al preparar ${use}.`,
      ({ name, format, occasion }) =>
        `En formato de ${format}, ${name} resulta sencillo de dimensionar para ${occasion}.`,
    ],
    claim: ({ name, claims }) =>
      `La información proporcionada para ${name} también indica: ${claims}.`,
    compactMeta: [
      ({ name, type, sensory, cta }) => `${name}, ${type}: ${sensory}. ${cta}`,
      ({ name, type, use, cta }) => `${name}: ${type} para ${use}. ${cta}`,
      ({ name, type, occasion }) => `${name}: ${type} pensado para ${occasion}.`,
    ],
    meta: [
      ({ name, type, sensory, use, cta }) =>
        `${name}, ${type}: ${sensory}, ideal para ${use}. ${cta}`,
      ({ name, type, use, cta }) => `Descubre ${name}: ${type} para ${use}. ${cta}`,
      ({ name, type, sensory, occasion, cta }) =>
        `${name}, ${type}, aporta ${sensory} a ${occasion}. ${cta}`,
      ({ name, type, sensory, cta }) => `Compra ${name}: ${type} con ${sensory}. ${cta}`,
    ],
  },
  ar: {
    location: "الإمارات",
    titleSuffix: "الإمارات | Corner Mex",
    shop: [
      ({ name }) => `${name} متوفر أونلاين من Corner Mex للتوصيل في دبي وأبوظبي وبقية الإمارات.`,
      ({ name, use }) =>
        `اطلب ${name} من Corner Mex عند التخطيط لـ ${use}، مع التوصيل داخل الإمارات.`,
      ({ name }) => `يوفر Corner Mex منتج ${name} للمتسوقين في دبي وأبوظبي وبقية الإمارات.`,
      ({ name }) => `أضف ${name} إلى طلب المؤونة القادم مع توصيل Corner Mex داخل الإمارات.`,
    ],
    metaCta: [
      "اطلبه أونلاين من Corner Mex.",
      "متوفر لدى Corner Mex للتوصيل داخل الإمارات.",
      "أضفه إلى طلبك من Corner Mex.",
      "تسوّق أونلاين مع توصيل داخل الإمارات.",
    ],
    hooks: [
      ({ name, sensory, type }) => `${name} هو ${type} بشخصية واضحة تجمع ${sensory}.`,
      ({ name, sensory, use }) => `تبدأ جاذبية ${name} من ${sensory} ومن سهولة تقديمه مع ${use}.`,
      ({ name, sensory, type }) =>
        `يضيف ${name} لمسة من ${sensory} إلى ${type} مناسب للحظات طعام أكثر تميزاً.`,
      ({ name, sensory, use }) =>
        `اختر ${name} عندما تكون ${sensory} هي الإضافة المناسبة لـ ${use}.`,
      ({ name, sensory, type }) =>
        `يحوّل ${name} فكرة ${type} المألوفة إلى تجربة أكثر حضوراً بفضل ${sensory}.`,
      ({ name, sensory, use }) =>
        `لمن يهتم بالنكهة وسهولة الاستخدام، يقدم ${name} ${sensory} مع ${use}.`,
    ],
    use: [
      ({ name, uses }) => `قدّم ${name} مع ${uses} لإضافة طابع مكسيكي أوضح إلى المائدة.`,
      ({ name, uses }) => `يظهر طابع ${name} بشكل أفضل مع ${uses} حيث تبقى نكهته سهلة التمييز.`,
      ({ name, uses }) => `استخدم ${name} عند تقديم ${uses} لإضافة لمسة ملفتة من دون تعقيد.`,
      ({ name, uses }) =>
        `من أفضل طرق استخدام ${name} تقديمه مع ${uses}، سواء لوجبة سريعة أو قائمة مخططة.`,
      ({ name, uses }) => `ابنِ لحظة تقديم ${name} حول ${uses} ودع نكهته تقود التجربة.`,
    ],
    occasion: [
      ({ name, occasion, use }) =>
        `يناسب ${name} بشكل خاص ${occasion}، ولا سيما عندما تتضمن الخطة ${use}.`,
      ({ name, occasion }) =>
        `من أجل ${occasion}، يبدو ${name} مميزاً مع بقائه سهل التقديم والاستمتاع.`,
      ({ name, occasion, sensory }) =>
        `فكر في ${name} من أجل ${occasion} عندما تساعد جاذبية ${sensory} على الاختيار بسرعة.`,
      ({ name, occasion, use }) =>
        `يعد ${name} خياراً عملياً من أجل ${occasion} لأن دوره مع ${use} واضح مباشرة.`,
    ],
    format: [
      ({ name, format, occasion }) =>
        `تجعل عبوة ${format} من ${name} تقدير الكمية أسهل من أجل ${occasion}.`,
      ({ name, format, use }) =>
        `مع ${format} في العبوة، يقدم ${name} مرجعاً واضحاً عند تحضير ${use}.`,
      ({ name, format, occasion }) =>
        `بحجم ${format}، يسهل تقدير كمية ${name} المناسبة من أجل ${occasion}.`,
    ],
    claim: ({ name, claims }) => `وتشير المعلومات المقدمة عن ${name} أيضاً إلى: ${claims}.`,
    compactMeta: [
      ({ name, type, sensory, cta }) => `${name}، ${type}: ${sensory}. ${cta}`,
      ({ name, type, use, cta }) => `${name}: ${type} مناسب لـ ${use}. ${cta}`,
      ({ name, type, occasion }) => `${name}: ${type} مختار من أجل ${occasion}.`,
    ],
    meta: [
      ({ name, type, sensory, use, cta }) =>
        `${name}، ${type}: ${sensory}، مناسب لـ ${use}. ${cta}`,
      ({ name, type, use, cta }) => `اكتشف ${name}: ${type} مناسب لـ ${use}. ${cta}`,
      ({ name, type, sensory, occasion, cta }) =>
        `${name}، ${type}، يضيف ${sensory} إلى ${occasion}. ${cta}`,
      ({ name, type, sensory, cta }) => `اشترِ ${name}، ${type} يتميز بـ ${sensory}. ${cta}`,
    ],
  },
};

const KIND_RULES = [
  {
    key: "giftSet",
    test: /sampler|gift basket|sauce basket|set\b|pack\b.*sauce|basket/i,
    type: {
      en: "Mexican tasting set",
      es: "set de degustación mexicano",
      ar: "مجموعة تذوق مكسيكية",
    },
    intent: {
      en: "Mexican food gifts UAE",
      es: "regalos mexicanos en EAU",
      ar: "هدايا مكسيكية في الإمارات",
    },
    uses: ["gifting", "sharing", "tasting"],
    sensory: ["variety", "colourful"],
  },
  {
    key: "popsicles",
    test: /popsicle|iced pop/i,
    type: { en: "frozen treat selection", es: "selección de paletas heladas", ar: "تشكيلة مثلجات" },
    intent: {
      en: "Mexican popsicles UAE",
      es: "paletas heladas en EAU",
      ar: "مثلجات مكسيكية في الإمارات",
    },
    uses: ["hotDays", "sharing", "parties"],
    sensory: ["refreshing", "variety"],
  },
  {
    key: "drinkConcentrate",
    test: /concentrate|horchata|jamaica drink/i,
    type: {
      en: "Mexican drink concentrate",
      es: "concentrado para bebida mexicana",
      ar: "مركز مشروب مكسيكي",
    },
    intent: {
      en: "Mexican drink concentrate UAE",
      es: "concentrado de bebida mexicana EAU",
      ar: "مركز مشروبات مكسيكية الإمارات",
    },
    uses: ["coldDrinks", "parties", "foodservice"],
    sensory: ["refreshing"],
  },
  {
    key: "soda",
    test: /jarritos|soda|cola drink|fruit punch drink|grapefruit drink|lime drink|guava drink|mandarin drink|pineapple drink|strawberry drink/i,
    type: { en: "Mexican soft drink", es: "refresco mexicano", ar: "مشروب غازي مكسيكي" },
    intent: {
      en: "Mexican soda UAE",
      es: "refresco mexicano en EAU",
      ar: "مشروبات غازية مكسيكية الإمارات",
    },
    uses: ["coldDrinks", "tacos", "parties"],
    sensory: ["refreshing", "bubbly"],
  },
  {
    key: "clamato",
    test: /clamato|tomato cocktail/i,
    type: {
      en: "savoury tomato drink",
      es: "bebida de tomate de perfil salado",
      ar: "مشروب طماطم مالح",
    },
    intent: { en: "Clamato UAE", es: "Clamato en EAU", ar: "كلاماتو الإمارات" },
    uses: ["micheladas", "cocktails", "seafood"],
    sensory: ["savory", "tomato"],
  },
  {
    key: "driedChile",
    test: /whole.*chili|whole.*chile|dried chili|dried chile|chile ancho 150g/i,
    type: {
      en: "whole dried Mexican chile",
      es: "chile mexicano seco entero",
      ar: "فلفل مكسيكي مجفف كامل",
    },
    intent: {
      en: "dried Mexican chiles UAE",
      es: "chiles secos mexicanos EAU",
      ar: "فلفل مكسيكي مجفف الإمارات",
    },
    uses: ["salsas", "moles", "marinades"],
    sensory: ["deep", "aromatic"],
  },
  {
    key: "chilePowder",
    test: /chili powder|chile.*powder|ground chile|ground chili/i,
    type: { en: "ground Mexican chile", es: "chile mexicano molido", ar: "فلفل مكسيكي مطحون" },
    intent: {
      en: "Mexican chile powder UAE",
      es: "chile mexicano molido EAU",
      ar: "مسحوق فلفل مكسيكي الإمارات",
    },
    uses: ["spiceBlends", "marinades", "salsas"],
    sensory: ["aromatic", "warming"],
  },
  {
    key: "peanuts",
    test: /peanut/i,
    type: {
      en: "seasoned peanut snack",
      es: "botana de cacahuate sazonado",
      ar: "وجبة خفيفة من الفول السوداني المتبل",
    },
    intent: {
      en: "Mexican peanuts UAE",
      es: "cacahuates mexicanos EAU",
      ar: "فول سوداني مكسيكي الإمارات",
    },
    uses: ["snacking", "sharing", "drinks"],
    sensory: ["crunchy", "savory"],
  },
  {
    key: "hotSauce",
    test: /hot sauce|salsa picante|habanero sauce|valentina|cholula|marisquera|chamoy sauce|salsa chamoy/i,
    type: { en: "Mexican hot sauce", es: "salsa picante mexicana", ar: "صلصة مكسيكية حارة" },
    intent: {
      en: "Mexican hot sauce UAE",
      es: "salsa picante mexicana EAU",
      ar: "صلصة حارة مكسيكية الإمارات",
    },
    uses: ["tacos", "snacks", "grilledFood"],
    sensory: ["bold", "tangy"],
  },
  {
    key: "jam",
    test: /\bjam\b|mermelada/i,
    type: {
      en: "Mexican sweet-and-savoury preserve",
      es: "conserva mexicana dulce y salada",
      ar: "مربى مكسيكي حلو ومالح",
    },
    intent: {
      en: "Mexican gourmet preserves UAE",
      es: "conservas mexicanas gourmet EAU",
      ar: "مربى مكسيكي فاخر الإمارات",
    },
    uses: ["cheeseBoards", "grilledFood", "breakfast"],
    sensory: ["fruity", "sweetSpicy"],
  },
  {
    key: "salsa",
    test: /salsa|sauce|dip\b|guacamole/i,
    type: { en: "Mexican salsa", es: "salsa mexicana", ar: "سالسا مكسيكية" },
    intent: {
      en: "Mexican salsa UAE",
      es: "salsa mexicana en EAU",
      ar: "سالسا مكسيكية الإمارات",
    },
    uses: ["tacos", "dips", "everydayMeals"],
    sensory: ["savory", "bright"],
  },
  {
    key: "pickledChile",
    test: /jalapeño nachos|jalapeno nachos|jalapeño slices|jalapeno slices|diced jalapeño|diced jalapeno|pickled jalapeño|pickled jalapeno|rajas de jalapeño|peppers in adobo|diced chipotle/i,
    type: {
      en: "prepared Mexican chile",
      es: "chile mexicano preparado",
      ar: "فلفل مكسيكي محضر",
    },
    intent: {
      en: "Mexican jalapeños UAE",
      es: "jalapeños mexicanos EAU",
      ar: "هالبينو مكسيكي الإمارات",
    },
    uses: ["nachos", "tacos", "sandwiches"],
    sensory: ["jalapeno", "tangy"],
  },
  {
    key: "tortillaChips",
    test: /tortilla chips|totopos|nachos/i,
    type: {
      en: "corn tortilla snack",
      es: "botana de tortilla de maíz",
      ar: "وجبة خفيفة من تورتيلا الذرة",
    },
    intent: {
      en: "tortilla chips UAE",
      es: "totopos y tortilla chips EAU",
      ar: "رقائق تورتيلا الإمارات",
    },
    uses: ["dips", "sharing", "nachos"],
    sensory: ["crunchy", "corn"],
  },
  {
    key: "tortilla",
    test: /corn tortilla|flour tortilla|tortillas/i,
    type: { en: "Mexican tortilla", es: "tortilla mexicana", ar: "تورتيلا مكسيكية" },
    intent: {
      en: "Mexican tortillas UAE",
      es: "tortillas mexicanas EAU",
      ar: "تورتيلا مكسيكية الإمارات",
    },
    uses: ["tacos", "quesadillas", "wraps"],
    sensory: ["soft", "versatile"],
  },
  {
    key: "tostada",
    test: /tostada/i,
    type: {
      en: "crisp Mexican tostada",
      es: "tostada mexicana crujiente",
      ar: "توستادا مكسيكية مقرمشة",
    },
    intent: {
      en: "Mexican tostadas UAE",
      es: "tostadas mexicanas EAU",
      ar: "توستادا مكسيكية الإمارات",
    },
    uses: ["tostadas", "ceviche", "beans"],
    sensory: ["crunchy", "toasted"],
  },
  {
    key: "masaFlour",
    test: /masa flour|corn flour|nixtamalized|maseca|corn husk|maizena|corn starch/i,
    type: {
      en: "Mexican cooking staple",
      es: "básico para cocina mexicana",
      ar: "مكوّن أساسي للمطبخ المكسيكي",
    },
    intent: {
      en: "Mexican cooking ingredients UAE",
      es: "ingredientes mexicanos en EAU",
      ar: "مكونات طبخ مكسيكية الإمارات",
    },
    uses: ["tamales", "tortillas", "homeCooking"],
    sensory: ["versatile", "traditional"],
  },
  {
    key: "beans",
    test: /beans|frijol/i,
    type: {
      en: "Mexican bean pantry staple",
      es: "básico mexicano de frijoles",
      ar: "منتج فاصوليا للمطبخ المكسيكي",
    },
    intent: {
      en: "Mexican beans UAE",
      es: "frijoles mexicanos EAU",
      ar: "فاصوليا مكسيكية الإمارات",
    },
    uses: ["tacos", "sideDishes", "everydayMeals"],
    sensory: ["creamy", "savory"],
  },
  {
    key: "corn",
    test: /hominy|esquite|white corn|mexican corn|maiz pozolero/i,
    type: {
      en: "Mexican corn ingredient",
      es: "ingrediente mexicano de maíz",
      ar: "مكوّن ذرة مكسيكي",
    },
    intent: {
      en: "Mexican corn UAE",
      es: "maíz mexicano EAU",
      ar: "ذرة مكسيكية الإمارات",
    },
    uses: ["pozole", "esquites", "soups"],
    sensory: ["corn", "comforting"],
  },
  {
    key: "nopales",
    test: /cactus|nopal/i,
    type: {
      en: "Mexican cactus ingredient",
      es: "ingrediente mexicano de nopal",
      ar: "مكوّن صبار مكسيكي",
    },
    intent: {
      en: "Mexican nopales UAE",
      es: "nopales mexicanos EAU",
      ar: "نوبال مكسيكي الإمارات",
    },
    uses: ["salads", "tacos", "sideDishes"],
    sensory: ["tangy", "vegetal"],
  },
  {
    key: "huitlacoche",
    test: /huitlacoche/i,
    type: {
      en: "Mexican huitlacoche ingredient",
      es: "ingrediente mexicano de huitlacoche",
      ar: "مكوّن هويتلاكوتشي مكسيكي",
    },
    intent: {
      en: "huitlacoche UAE",
      es: "huitlacoche en EAU",
      ar: "هويتلاكوتشي الإمارات",
    },
    uses: ["tacos", "quesadillas", "soups"],
    sensory: ["umami", "earthy"],
  },
  {
    key: "mole",
    test: /mole\b/i,
    type: { en: "Mexican mole", es: "mole mexicano", ar: "مولي مكسيكي" },
    intent: { en: "Mexican mole UAE", es: "mole mexicano EAU", ar: "مولي مكسيكي الإمارات" },
    uses: ["chicken", "enchiladas", "celebrations"],
    sensory: ["complex", "deep"],
  },
  {
    key: "chorizo",
    test: /chorizo/i,
    type: {
      en: "Mexican-style chorizo",
      es: "chorizo estilo mexicano",
      ar: "تشوريزو على الطريقة المكسيكية",
    },
    intent: {
      en: "Mexican chorizo UAE",
      es: "chorizo mexicano EAU",
      ar: "تشوريزو مكسيكي الإمارات",
    },
    uses: ["breakfast", "tacos", "quesadillas"],
    sensory: ["savory", "spiced"],
  },
  {
    key: "cheese",
    test: /queso|cheese\b/i,
    type: { en: "Mexican cheese", es: "queso mexicano", ar: "جبن مكسيكي" },
    intent: { en: "Mexican cheese UAE", es: "queso mexicano EAU", ar: "جبن مكسيكي الإمارات" },
    uses: ["tacos", "beans", "salads"],
    sensory: ["savory", "aged"],
  },
  {
    key: "seasoning",
    test: /seasoning|achiote paste/i,
    type: {
      en: "Mexican cooking seasoning",
      es: "sazonador para cocina mexicana",
      ar: "تتبيلة للمطبخ المكسيكي",
    },
    intent: {
      en: "Mexican seasoning UAE",
      es: "sazonador mexicano EAU",
      ar: "توابل مكسيكية الإمارات",
    },
    uses: ["marinades", "soups", "grilledFood"],
    sensory: ["savory", "aromatic"],
  },
  {
    key: "fruitInSyrup",
    test: /in syrup|peach halves|whole guavas/i,
    type: {
      en: "fruit pantry ingredient",
      es: "fruta para despensa y repostería",
      ar: "فاكهة محفوظة للحلويات",
    },
    intent: {
      en: "Latin dessert ingredients UAE",
      es: "ingredientes para postres latinos EAU",
      ar: "مكونات حلويات لاتينية الإمارات",
    },
    uses: ["desserts", "baking", "breakfast"],
    sensory: ["juicy", "sweet"],
  },
  {
    key: "sweetPantry",
    test: /agave|cajeta|chocolate abuelita|jam\b/i,
    type: {
      en: "Mexican sweet pantry product",
      es: "producto dulce de despensa mexicana",
      ar: "منتج حلو للمؤونة المكسيكية",
    },
    intent: {
      en: "Mexican sweet pantry UAE",
      es: "dulces mexicanos de despensa EAU",
      ar: "منتجات حلوة مكسيكية الإمارات",
    },
    uses: ["desserts", "hotDrinks", "breakfast"],
    sensory: ["sweet", "comforting"],
  },
  {
    key: "potatoChips",
    test: /ruffles/i,
    type: {
      en: "ridged potato snack",
      es: "botana de papa ondulada",
      ar: "وجبة خفيفة من رقائق البطاطس المموجة",
    },
    intent: {
      en: "Mexican potato chips UAE",
      es: "papas mexicanas EAU",
      ar: "رقائق بطاطس مكسيكية الإمارات",
    },
    uses: ["snacking", "sharing", "drinks"],
    sensory: ["crunchy", "bold"],
  },
  {
    key: "chicharronSnack",
    test: /chicharron/i,
    type: {
      en: "crisp chicharrón-style snack",
      es: "botana crujiente estilo chicharrón",
      ar: "وجبة خفيفة مقرمشة على طريقة التشيتشارون",
    },
    intent: {
      en: "Mexican chicharron snacks UAE",
      es: "chicharrón mexicano EAU",
      ar: "وجبات تشيتشارون مكسيكية الإمارات",
    },
    uses: ["snacking", "sharing", "hotSaucePairing"],
    sensory: ["crunchy", "bold"],
  },
  {
    key: "churritosSnack",
    test: /churritos/i,
    type: {
      en: "crunchy churritos snack",
      es: "botana crujiente de churritos",
      ar: "وجبة خفيفة مقرمشة من التشوريتوس",
    },
    intent: {
      en: "Mexican churritos UAE",
      es: "churritos mexicanos EAU",
      ar: "تشوريتوس مكسيكي الإمارات",
    },
    uses: ["snacking", "sharing", "hotSaucePairing"],
    sensory: ["crunchy", "bold"],
  },
  {
    key: "candy",
    test: /candy|candies|lollipop|mazapan|marzipan|paleta payaso|pelon|pulparindo|tama-roca|banderilla|barritas|choco roles|lucas muecas/i,
    type: { en: "Mexican sweet", es: "dulce mexicano", ar: "حلوى مكسيكية" },
    intent: {
      en: "Mexican candy UAE",
      es: "dulces mexicanos EAU",
      ar: "حلويات مكسيكية الإمارات",
    },
    uses: ["snacking", "sharing", "nostalgia"],
    sensory: ["sweet", "playful"],
  },
  {
    key: "chips",
    test: /chips|nachos|chicharron|churritos|fritos|rancheritos|ruffles|totopos/i,
    type: {
      en: "Mexican-style crunchy snack",
      es: "botana crujiente de estilo mexicano",
      ar: "وجبة خفيفة مقرمشة على الطريقة المكسيكية",
    },
    intent: {
      en: "Mexican snacks UAE",
      es: "botanas mexicanas EAU",
      ar: "وجبات خفيفة مكسيكية الإمارات",
    },
    uses: ["snacking", "dips", "sharing"],
    sensory: ["crunchy", "bold"],
  },
  {
    key: "general",
    test: /.*/,
    type: {
      en: "Mexican pantry product",
      es: "producto de despensa mexicana",
      ar: "منتج للمؤونة المكسيكية",
    },
    intent: {
      en: "Mexican groceries UAE",
      es: "productos mexicanos EAU",
      ar: "منتجات مكسيكية الإمارات",
    },
    uses: ["everydayMeals", "homeCooking"],
    sensory: ["distinctive", "versatile"],
  },
];

const SENSORY = {
  blueCorn: {
    en: "an earthy blue-corn crunch",
    es: "un crujido terroso de maíz azul",
    ar: "قرمشة الذرة الزرقاء بطابع ترابي",
  },
  crunchy: {
    en: "a pronounced, satisfying crunch",
    es: "un crujido marcado y satisfactorio",
    ar: "قرمشة واضحة ومُرضية",
  },
  sweetSpicy: {
    en: "a lively balance of sweetness and heat",
    es: "un equilibrio vivo entre dulzor y picor",
    ar: "توازن واضح بين الحلاوة والحرارة",
  },
  tamarind: {
    en: "tangy tamarind with a sweet-sour edge",
    es: "tamarindo ácido con un contraste agridulce",
    ar: "تمر هندي لاذع بطابع حلو وحامض",
  },
  habanero: {
    en: "fruity habanero heat",
    es: "picor frutal de habanero",
    ar: "حرارة فاكهية من الهابانيرو",
  },
  chipotle: {
    en: "smoky chipotle depth",
    es: "profundidad ahumada de chipotle",
    ar: "عمق مدخن من الشيبوتلي",
  },
  epazote: {
    en: "corn comfort lifted by aromatic epazote",
    es: "maíz reconfortante con el aroma del epazote",
    ar: "ذرة مريحة مع رائحة الإبازوت العطرية",
  },
  green: {
    en: "bright green-chile freshness",
    es: "frescura vibrante de chile verde",
    ar: "انتعاش الفلفل الأخضر",
  },
  red: {
    en: "a rounded red-chile profile",
    es: "un perfil redondo de chile rojo",
    ar: "طابع متوازن من الفلفل الأحمر",
  },
  fruitPunch: {
    en: "a bright mixed-fruit sweetness",
    es: "un dulzor alegre de frutas mixtas",
    ar: "حلاوة مشرقة من الفواكه المشكلة",
  },
  grapefruit: {
    en: "a bittersweet grapefruit lift",
    es: "un toque cítrico y agridulce de toronja",
    ar: "انتعاش الجريب فروت الحلو والمر",
  },
  lime: {
    en: "a sharp, refreshing lime note",
    es: "una nota intensa y refrescante de limón",
    ar: "نفحة ليمون حادة ومنعشة",
  },
  guava: {
    en: "soft tropical guava sweetness",
    es: "dulzor tropical y suave de guayaba",
    ar: "حلاوة الجوافة الاستوائية الناعمة",
  },
  avocado: {
    en: "a mellow avocado-led creaminess",
    es: "una cremosidad suave con sabor a aguacate",
    ar: "قوام كريمي ناعم بنكهة الأفوكادو",
  },
  cola: {
    en: "a familiar cola profile with a Mexican soft-drink character",
    es: "un perfil de cola familiar con carácter de refresco mexicano",
    ar: "طابع كولا مألوف بروح المشروبات المكسيكية",
  },
  mandarin: {
    en: "juicy mandarin brightness",
    es: "brillo jugoso de mandarina",
    ar: "انتعاش اليوسفي العصيري",
  },
  mango: {
    en: "ripe mango sweetness",
    es: "dulzor de mango maduro",
    ar: "حلاوة المانجو الناضجة",
  },
  pineapple: {
    en: "tropical pineapple sweetness",
    es: "dulzor tropical de piña",
    ar: "حلاوة الأناناس الاستوائية",
  },
  strawberry: {
    en: "a ripe strawberry sweetness",
    es: "dulzor de fresa madura",
    ar: "حلاوة الفراولة الناضجة",
  },
  chamoy: {
    en: "chamoy's sweet, tangy and gently spicy contrast",
    es: "un contraste dulce, ácido y ligeramente picante de chamoy",
    ar: "تباين الشاموي الحلو واللاذع والحار قليلاً",
  },
  valentina: {
    en: "Valentina's tangy chile character",
    es: "el carácter ácido y picante de Valentina",
    ar: "الطابع اللاذع والحار لصلصة فالنتينا",
  },
  yellowLabel: {
    en: "the balanced heat of Valentina's yellow label",
    es: "el picor equilibrado de la etiqueta amarilla de Valentina",
    ar: "الحرارة المتوازنة لصلصة فالنتينا ذات الملصق الأصفر",
  },
  blackLabel: {
    en: "the more intense heat of Valentina's black label",
    es: "el picor más intenso de la etiqueta negra de Valentina",
    ar: "الحرارة الأقوى لصلصة فالنتينا ذات الملصق الأسود",
  },
  ancho: {
    en: "mild ancho warmth with dark-fruit depth",
    es: "calidez suave de ancho con fondo de fruta oscura",
    ar: "دفء أنشو معتدل مع عمق فاكهي داكن",
  },
  pasilla: {
    en: "deep pasilla notes with raisin-like sweetness",
    es: "notas profundas de pasilla con dulzor parecido a la pasa",
    ar: "نفحات باسيلا عميقة مع حلاوة تشبه الزبيب",
  },
  cascabel: {
    en: "nutty cascabel warmth and subtle smoke",
    es: "calidez de cascabel, notas de nuez y humo sutil",
    ar: "دفء الكاسكابيل مع نكهة جوزية ودخان خفيف",
  },
  guajillo: {
    en: "fruity guajillo depth and gentle heat",
    es: "profundidad frutal de guajillo con picor amable",
    ar: "عمق فاكهي من الغواخيو مع حرارة لطيفة",
  },
  arbol: {
    en: "a clean, direct chile de árbol heat",
    es: "un picor limpio y directo de chile de árbol",
    ar: "حرارة صافية ومباشرة من فلفل أربول",
  },
  jalapeno: {
    en: "tangy jalapeño heat",
    es: "picor ácido de jalapeño",
    ar: "حرارة الهالبينو اللاذعة",
  },
  ranchera: {
    en: "a rustic, savoury ranchera profile",
    es: "un perfil ranchero rústico y sabroso",
    ar: "طابع رانشيرا ريفي ولذيذ",
  },
  butterRum: {
    en: "buttery sweetness with a warm rum aroma",
    es: "dulzor mantequilloso con aroma cálido a ron",
    ar: "حلاوة زبدية مع رائحة روم دافئة",
  },
  cheese: {
    en: "a rich, savoury cheese note",
    es: "una nota intensa y sabrosa de queso",
    ar: "نكهة جبن غنية ومالحة",
  },
  coffee: {
    en: "roasted coffee depth against chile heat",
    es: "profundidad tostada de café frente al picor del chile",
    ar: "عمق القهوة المحمصة مع حرارة الفلفل",
  },
  ghost: {
    en: "an assertive ghost-chile finish",
    es: "un final intenso de ghost chili",
    ar: "نهاية قوية من فلفل غوست",
  },
  papaya: {
    en: "soft papaya sweetness",
    es: "dulzor suave de papaya",
    ar: "حلاوة البابايا الناعمة",
  },
  agave: { en: "smooth agave sweetness", es: "dulzor suave de agave", ar: "حلاوة الأغاف الناعمة" },
  jamaica: {
    en: "tart hibiscus brightness",
    es: "acidez brillante de jamaica",
    ar: "حموضة الكركديه المشرقة",
  },
  horchata: {
    en: "creamy rice-and-cinnamon comfort",
    es: "suavidad reconfortante de arroz y canela",
    ar: "نعومة الأرز والقرفة المريحة",
  },
  chocolate: {
    en: "deep chocolate comfort",
    es: "profundidad reconfortante de chocolate",
    ar: "عمق الشوكولاتة المريح",
  },
  cajeta: {
    en: "caramelised goat-milk richness",
    es: "riqueza caramelizada de leche de cabra",
    ar: "غنى حليب الماعز المكرمل",
  },
  mole: {
    en: "layered spice and savoury-sweet mole depth",
    es: "capas de especias y profundidad agridulce de mole",
    ar: "طبقات من التوابل وعمق المولي الحلو والمالح",
  },
  achiote: {
    en: "earthy achiote colour and spice",
    es: "color y especias terrosas de achiote",
    ar: "لون وتوابل الأشيوت الترابية",
  },
  corn: {
    en: "the mellow sweetness of corn",
    es: "el dulzor suave del maíz",
    ar: "حلاوة الذرة الناعمة",
  },
  beans: {
    en: "a creamy, savoury bean profile",
    es: "un perfil cremoso y sabroso de frijol",
    ar: "طابع فاصوليا كريمي ومالح",
  },
  cactus: {
    en: "a fresh, lightly tangy cactus character",
    es: "un carácter fresco y ligeramente ácido de nopal",
    ar: "طابع صبار طازج ولاذع قليلاً",
  },
  sesame: {
    en: "toasted sesame aroma over a crisp base",
    es: "aroma de ajonjolí tostado sobre una base crujiente",
    ar: "رائحة السمسم المحمص فوق قاعدة مقرمشة",
  },
  chorizo: {
    en: "a savoury, well-spiced chorizo profile",
    es: "un perfil sabroso y bien especiado de chorizo",
    ar: "طابع تشوريزو مالح وغني بالتوابل",
  },
  fruity: {
    en: "a fruit-led flavour with a bright finish",
    es: "un sabor frutal de final brillante",
    ar: "نكهة فاكهية بنهاية مشرقة",
  },
  smoky: {
    en: "a lingering smoky depth",
    es: "una profundidad ahumada persistente",
    ar: "عمق مدخن يدوم",
  },
  tangy: {
    en: "a mouth-watering tang",
    es: "una acidez que abre el apetito",
    ar: "حموضة فاتحة للشهية",
  },
  creamy: {
    en: "a smooth, creamy body",
    es: "una textura suave y cremosa",
    ar: "قوام ناعم وكريمي",
  },
  savory: {
    en: "a full savoury character",
    es: "un carácter sabroso y completo",
    ar: "طابع مالح ومتكامل",
  },
  nutty: { en: "a rounded nutty flavour", es: "un sabor redondo a nuez", ar: "نكهة جوزية متوازنة" },
  soft: { en: "a soft, flexible texture", es: "una textura suave y flexible", ar: "قوام طري ومرن" },
  sweet: {
    en: "a generous, comforting sweetness",
    es: "un dulzor generoso y reconfortante",
    ar: "حلاوة غنية ومريحة",
  },
  deep: {
    en: "a deep, layered flavour",
    es: "un sabor profundo y con capas",
    ar: "نكهة عميقة ومتعددة الطبقات",
  },
  aromatic: { en: "an expressive aroma", es: "un aroma expresivo", ar: "رائحة واضحة وغنية" },
  warming: {
    en: "a warm chile character",
    es: "un carácter cálido de chile",
    ar: "طابع فلفل دافئ",
  },
  bold: {
    en: "a bold, immediate flavour",
    es: "un sabor audaz e inmediato",
    ar: "نكهة جريئة ومباشرة",
  },
  bright: {
    en: "a bright, lively finish",
    es: "un final vivo y brillante",
    ar: "نهاية مشرقة وحيوية",
  },
  versatile: {
    en: "an adaptable pantry-friendly profile",
    es: "un perfil versátil para la despensa",
    ar: "طابع مرن ومناسب للمؤونة",
  },
  traditional: {
    en: "a familiar Mexican cooking character",
    es: "un carácter familiar de cocina mexicana",
    ar: "طابع مألوف من المطبخ المكسيكي",
  },
  comforting: {
    en: "a familiar, comforting flavour",
    es: "un sabor familiar y reconfortante",
    ar: "نكهة مألوفة ومريحة",
  },
  vegetal: { en: "a clean vegetal note", es: "una nota vegetal limpia", ar: "نفحة نباتية صافية" },
  umami: {
    en: "a deep, savoury umami character",
    es: "un carácter umami profundo y sabroso",
    ar: "طابع أومامي عميق ومالح",
  },
  earthy: {
    en: "an earthy, woodland-like depth",
    es: "una profundidad terrosa con matices de bosque",
    ar: "عمق ترابي بلمسة طبيعية",
  },
  complex: {
    en: "a complex balance of spice and depth",
    es: "un equilibrio complejo de especias y profundidad",
    ar: "توازن معقد بين التوابل والعمق",
  },
  spiced: {
    en: "a rounded blend of savoury spices",
    es: "una mezcla redonda de especias sabrosas",
    ar: "مزيج متوازن من التوابل المالحة",
  },
  juicy: {
    en: "a juicy fruit character",
    es: "un carácter frutal y jugoso",
    ar: "طابع فاكهي وعصيري",
  },
  playful: {
    en: "a playful mix of flavour and texture",
    es: "una mezcla divertida de sabor y textura",
    ar: "مزيج مرح من النكهة والقوام",
  },
  refreshing: {
    en: "a clean, refreshing finish",
    es: "un final limpio y refrescante",
    ar: "نهاية نظيفة ومنعشة",
  },
  bubbly: { en: "a lively sparkle", es: "una burbuja viva", ar: "فقاعات حيوية" },
  tomato: {
    en: "a rich tomato-led base",
    es: "una base intensa de tomate",
    ar: "قاعدة غنية من الطماطم",
  },
  toasted: { en: "a warm toasted note", es: "una nota cálida y tostada", ar: "نفحة محمصة ودافئة" },
  variety: {
    en: "a spectrum of contrasting flavours",
    es: "un recorrido por sabores contrastantes",
    ar: "مجموعة من النكهات المتباينة",
  },
  colourful: {
    en: "a colourful presentation with gift appeal",
    es: "una presentación colorida con vocación de regalo",
    ar: "تقديم ملون مناسب للهدايا",
  },
  distinctive: {
    en: "a distinctive flavour identity",
    es: "una identidad de sabor propia",
    ar: "هوية نكهة مميزة",
  },
  aged: {
    en: "a firm, savoury aged-cheese character",
    es: "un carácter firme y sabroso de queso madurado",
    ar: "طابع جبن معتق متماسك ومالح",
  },
};

const SENSORY_OVERRIDES = {
  masaFlour: {
    blueCorn: {
      en: "the earthy character and natural colour of blue corn",
      es: "el carácter terroso y el color natural del maíz azul",
      ar: "الطابع الترابي واللون الطبيعي للذرة الزرقاء",
    },
  },
  tortilla: {
    blueCorn: {
      en: "the earthy character of blue corn",
      es: "el carácter terroso del maíz azul",
      ar: "الطابع الترابي للذرة الزرقاء",
    },
  },
  corn: {
    blueCorn: {
      en: "the earthy depth of blue corn",
      es: "la profundidad terrosa del maíz azul",
      ar: "العمق الترابي للذرة الزرقاء",
    },
  },
};

const SIGNAL_RULES = [
  ["blueCorn", /blue corn|maiz azul/i],
  ["tamarind", /tamarind|tamarindo/i],
  ["chamoy", /chamoy/i],
  ["blackLabel", /black label|muy picante/i],
  ["yellowLabel", /yellow label/i],
  ["valentina", /valentina/i],
  ["mango", /\bmango\b/i],
  ["habanero", /habanero/i],
  ["chipotle", /chipotle/i],
  ["epazote", /epazote/i],
  ["green", /green sauce|green chile|salsa verde/i],
  ["red", /red sauce|red chile|salsa roja/i],
  ["fruitPunch", /fruit punch/i],
  ["grapefruit", /grape\s*fruit|grapefruit/i],
  ["lime", /\blime\b|lemon & salt/i],
  ["guava", /guava/i],
  ["avocado", /avocado|guacamole/i],
  ["cola", /\bcola\b/i],
  ["mandarin", /mandarin/i],
  ["pineapple", /pineapple|piña|pina/i],
  ["strawberry", /strawberry|fresa/i],
  ["ancho", /\bancho\b/i],
  ["pasilla", /pasilla/i],
  ["cascabel", /cascabel/i],
  ["guajillo", /guajillo/i],
  ["arbol", /árbol|arbol/i],
  ["jalapeno", /jalapeño|jalapeno/i],
  ["ranchera", /ranchera/i],
  ["butterRum", /butter rum/i],
  ["cheese", /cheese|queso|cheddar/i],
  ["coffee", /coffee|café|cafe/i],
  ["ghost", /ghost chili/i],
  ["papaya", /papaya/i],
  ["agave", /agave/i],
  ["jamaica", /jamaica|hibiscus/i],
  ["horchata", /horchata/i],
  ["chocolate", /chocolate|choco/i],
  ["cajeta", /cajeta|goat milk caramel/i],
  ["mole", /\bmole\b/i],
  ["achiote", /achiote/i],
  ["beans", /beans|frijol/i],
  ["cactus", /cactus|nopal/i],
  ["umami", /umami|huitlacoche|mexican truffle/i],
  ["earthy", /earthy|woodland/i],
  ["sesame", /sesame|ajonjol/i],
  ["chorizo", /chorizo/i],
  ["sweetSpicy", /sweet.{0,20}(spicy|heat)|spicy.{0,20}sweet/i],
  ["smoky", /smoky|smoked|smoke-dried/i],
  ["creamy", /creamy|cream-based|smooth texture/i],
  ["tangy", /tangy|zesty|sour/i],
  ["nutty", /nutty|peanut/i],
  ["crunchy", /crunch|crispy|crisp/i],
  ["soft", /soft (?:center|cake|texture)|flexible|pliable/i],
  ["fruity", /fruity|fruit flavor|fruit flavour|tropical/i],
  ["savory", /savory|savoury|umami/i],
  ["corn", /\bcorn\b|maiz|maíz/i],
  ["sweet", /sweet|candy|caramel/i],
];

const USES = {
  tacos: { en: "tacos", es: "tacos", ar: "التاكو" },
  snacks: {
    en: "snacks and street-food favourites",
    es: "botanas y antojitos",
    ar: "الوجبات الخفيفة وأطعمة الشارع",
  },
  grilledFood: {
    en: "grilled meats and vegetables",
    es: "carnes y vegetales a la parrilla",
    ar: "اللحوم والخضروات المشوية",
  },
  micheladas: { en: "micheladas", es: "micheladas", ar: "الميتشيلادا" },
  cocktails: {
    en: "cocktails and savoury drinks",
    es: "cocteles y bebidas saladas",
    ar: "الكوكتيلات والمشروبات المالحة",
  },
  seafood: {
    en: "seafood, ceviche and fish tacos",
    es: "mariscos, ceviche y tacos de pescado",
    ar: "المأكولات البحرية والسيفيتشي وتاكو السمك",
  },
  salsas: {
    en: "salsas and blended sauces",
    es: "salsas y preparaciones licuadas",
    ar: "الصلصات والخلطات",
  },
  moles: {
    en: "moles and slow-cooked sauces",
    es: "moles y salsas de cocción lenta",
    ar: "المولي والصلصات المطهية ببطء",
  },
  marinades: {
    en: "marinades and spice pastes",
    es: "marinados y pastas de especias",
    ar: "التتبيلات ومعاجين التوابل",
  },
  spiceBlends: {
    en: "spice blends and dry rubs",
    es: "mezclas de especias y rubs secos",
    ar: "خلطات التوابل والتتبيل الجاف",
  },
  dips: {
    en: "dips, nachos and sharing boards",
    es: "dips, nachos y tablas para compartir",
    ar: "الغموس والناتشوز وأطباق المشاركة",
  },
  nachos: {
    en: "nachos and loaded snack plates",
    es: "nachos y platos de botana",
    ar: "الناتشوز وأطباق الوجبات الخفيفة",
  },
  sandwiches: {
    en: "sandwiches, burgers and tortas",
    es: "sándwiches, hamburguesas y tortas",
    ar: "السندويتشات والبرغر والتورتا",
  },
  cheeseBoards: {
    en: "cheese boards and warm toast",
    es: "tablas de queso y pan tostado",
    ar: "ألواح الجبن والخبز المحمص",
  },
  hotSaucePairing: {
    en: "hot sauce and lime",
    es: "salsa picante y limón",
    ar: "الصلصة الحارة والليمون",
  },
  everydayMeals: {
    en: "weeknight meals and quick snacks",
    es: "comidas entre semana y antojos rápidos",
    ar: "وجبات أيام الأسبوع والوجبات الخفيفة السريعة",
  },
  quesadillas: {
    en: "quesadillas and melted-cheese dishes",
    es: "quesadillas y platillos con queso fundido",
    ar: "الكاساديا وأطباق الجبن الذائب",
  },
  wraps: {
    en: "wraps, burritos and lunch ideas",
    es: "wraps, burritos y comidas para llevar",
    ar: "الراب والبوريتو ووجبات الغداء",
  },
  tostadas: {
    en: "layered tostadas",
    es: "tostadas con capas de ingredientes",
    ar: "التوستادا بطبقاتها المختلفة",
  },
  ceviche: {
    en: "ceviche and fresh toppings",
    es: "ceviche y toppings frescos",
    ar: "السيفيتشي والإضافات الطازجة",
  },
  beans: {
    en: "beans and hearty toppings",
    es: "frijoles y toppings sustanciosos",
    ar: "الفاصوليا والإضافات الغنية",
  },
  tamales: {
    en: "tamales and corn-based recipes",
    es: "tamales y recetas a base de maíz",
    ar: "التامال ووصفات الذرة",
  },
  tortillas: { en: "homemade tortillas", es: "tortillas hechas en casa", ar: "التورتيلا المنزلية" },
  homeCooking: {
    en: "home cooking and recipe projects",
    es: "cocina casera y proyectos de receta",
    ar: "الطبخ المنزلي وتجربة الوصفات",
  },
  sideDishes: {
    en: "side dishes, bowls and fillings",
    es: "guarniciones, bowls y rellenos",
    ar: "الأطباق الجانبية والأوعية والحشوات",
  },
  pozole: {
    en: "pozole and hearty soups",
    es: "pozole y sopas sustanciosas",
    ar: "البوزولي والشوربات الغنية",
  },
  esquites: {
    en: "esquites and corn cups",
    es: "esquites y vasos de maíz",
    ar: "الإسكيتيس وأكواب الذرة",
  },
  soups: {
    en: "soups, stews and broths",
    es: "sopas, guisos y caldos",
    ar: "الشوربات واليخنات والمرق",
  },
  salads: {
    en: "salads and fresh plates",
    es: "ensaladas y platos frescos",
    ar: "السلطات والأطباق الطازجة",
  },
  chicken: {
    en: "chicken and roasted vegetables",
    es: "pollo y vegetales rostizados",
    ar: "الدجاج والخضروات المشوية",
  },
  enchiladas: {
    en: "enchiladas and plated meals",
    es: "enchiladas y platos servidos",
    ar: "الإنشيلادا والوجبات المقدمة",
  },
  celebrations: {
    en: "weekend cooking and celebratory meals",
    es: "cocina de fin de semana y comidas de celebración",
    ar: "طبخ نهاية الأسبوع ووجبات المناسبات",
  },
  breakfast: {
    en: "breakfast plates and brunch",
    es: "desayunos y brunch",
    ar: "أطباق الفطور والبرنش",
  },
  hotDrinks: {
    en: "hot drinks and comforting desserts",
    es: "bebidas calientes y postres reconfortantes",
    ar: "المشروبات الساخنة والحلويات الدافئة",
  },
  desserts: {
    en: "desserts and sweet finishes",
    es: "postres y finales dulces",
    ar: "الحلويات والختام الحلو",
  },
  baking: {
    en: "baking and plated desserts",
    es: "repostería y postres emplatados",
    ar: "الخبز والحلويات المقدمة",
  },
  snacking: {
    en: "solo snacking and afternoon cravings",
    es: "antojos individuales y pausas de la tarde",
    ar: "الوجبات الخفيفة الفردية وفترات بعد الظهر",
  },
  sharing: {
    en: "sharing with friends and family",
    es: "compartir con amigos y familia",
    ar: "المشاركة مع الأصدقاء والعائلة",
  },
  nostalgia: {
    en: "nostalgic treats and playful gifting",
    es: "antojos nostálgicos y regalos divertidos",
    ar: "الحلويات الحنينية والهدايا المرحة",
  },
  drinks: {
    en: "cold drinks and casual gatherings",
    es: "bebidas frías y reuniones informales",
    ar: "المشروبات الباردة والتجمعات البسيطة",
  },
  gifting: {
    en: "food gifts and host presents",
    es: "regalos gastronómicos y detalles para anfitriones",
    ar: "هدايا الطعام وهدايا المضيف",
  },
  tasting: {
    en: "guided tastings and flavour discovery",
    es: "degustaciones y descubrimiento de sabores",
    ar: "جلسات التذوق واكتشاف النكهات",
  },
  parties: {
    en: "parties and group occasions",
    es: "fiestas y reuniones",
    ar: "الحفلات والتجمعات",
  },
  hotDays: {
    en: "hot days and outdoor plans",
    es: "días calurosos y planes al aire libre",
    ar: "الأيام الحارة والأنشطة الخارجية",
  },
  coldDrinks: {
    en: "ice-cold refreshment",
    es: "refrescos servidos bien fríos",
    ar: "مشروبات باردة ومنعشة",
  },
  foodservice: {
    en: "events, cafés and food-service preparation",
    es: "eventos, cafeterías y servicio de alimentos",
    ar: "الفعاليات والمقاهي وخدمات الطعام",
  },
};

const USE_RULES = [
  ["micheladas", /michelada/i],
  ["cocktails", /cocktail|bloody mary/i],
  ["seafood", /seafood|shrimp|oyster|ceviche|fish taco/i],
  ["moles", /\bmole|moles/i],
  ["marinades", /marinade|adobo|glaz/i],
  ["salsas", /for (?:making )?salsas|into salsas|salsas,|sauces,|sauces and|sauce recipes/i],
  ["grilledFood", /grill|bbq|barbecue/i],
  ["tacos", /\btaco/i],
  ["quesadillas", /quesadilla/i],
  ["tostadas", /tostada/i],
  ["tamales", /tamal/i],
  ["pozole", /pozole/i],
  ["esquites", /esquite/i],
  ["soups", /soup|stew|broth|braise/i],
  ["desserts", /dessert|candy dip/i],
  ["baking", /baking|bake/i],
  ["breakfast", /breakfast|eggs/i],
  ["salads", /salad/i],
  ["dips", /\bdip|chips|nachos/i],
  ["sharing", /sharing|gathering|party|friends/i],
  ["gifting", /gift/i],
];

const OCCASIONS = {
  en: [
    "a quick weekday meal",
    "a relaxed gathering",
    "a more adventurous pantry",
    "a thoughtful food gift",
    "a family-style table",
    "a restaurant or catering menu",
    "a weekend recipe project",
  ],
  es: [
    "una comida rápida entre semana",
    "una reunión relajada",
    "una despensa más aventurera",
    "un regalo gastronómico con intención",
    "una mesa para compartir en familia",
    "un menú de restaurante o catering",
    "una receta especial de fin de semana",
  ],
  ar: [
    "وجبة سريعة خلال الأسبوع",
    "تجمع بسيط ومريح",
    "مؤونة أكثر تنوعاً",
    "هدية طعام مدروسة",
    "مائدة عائلية للمشاركة",
    "قائمة مطعم أو تموين",
    "وصفة خاصة لنهاية الأسبوع",
  ],
};

const OCCASION_INDEXES = {
  giftSet: [3, 1, 2],
  popsicles: [1, 4, 0],
  drinkConcentrate: [1, 4, 5],
  soda: [1, 4, 0],
  clamato: [1, 6, 5],
  driedChile: [6, 5, 2],
  chilePowder: [6, 5, 0],
  peanuts: [1, 4, 2],
  hotSauce: [0, 1, 2],
  jam: [3, 1, 6],
  salsa: [0, 1, 4],
  pickledChile: [0, 1, 4],
  tortillaChips: [1, 4, 0],
  tortilla: [0, 4, 5],
  tostada: [0, 4, 1],
  masaFlour: [6, 4, 5],
  beans: [0, 4, 5],
  corn: [4, 6, 5],
  nopales: [0, 6, 4],
  huitlacoche: [6, 4, 5],
  mole: [6, 4, 1],
  chorizo: [0, 4, 5],
  cheese: [4, 1, 3],
  seasoning: [0, 6, 5],
  fruitInSyrup: [6, 4, 3],
  sweetPantry: [0, 6, 3],
  potatoChips: [1, 4, 0],
  chicharronSnack: [1, 4, 2],
  churritosSnack: [1, 4, 2],
  candy: [1, 3, 4],
  chips: [1, 4, 0],
  general: [0, 2, 6],
};

const TITLE_SIGNAL = {
  blueCorn: "Blue Corn",
  tamarind: "Tamarind",
  chamoy: "Chamoy",
  blackLabel: "Black Label",
  yellowLabel: "Yellow Label",
  valentina: "Valentina",
  mango: "Mango",
  habanero: "Habanero",
  chipotle: "Chipotle",
  green: "Green Chile",
  red: "Red Chile",
  fruitPunch: "Fruit Punch",
  grapefruit: "Grapefruit",
  lime: "Lime",
  guava: "Guava",
  avocado: "Guacamole",
  cola: "Cola",
  mandarin: "Mandarin",
  pineapple: "Pineapple",
  strawberry: "Strawberry",
  ancho: "Ancho",
  pasilla: "Pasilla",
  cascabel: "Cascabel",
  guajillo: "Guajillo",
  arbol: "Arbol",
  jalapeno: "Jalapeno",
  ranchera: "Ranchera",
  butterRum: "Butter Rum",
  cheese: "Cheese",
  coffee: "Coffee",
  ghost: "Ghost Chile",
  papaya: "Papaya",
  agave: "Agave",
  jamaica: "Jamaica",
  horchata: "Horchata",
  chocolate: "Chocolate",
  cajeta: "Cajeta",
  mole: "Mole",
  achiote: "Achiote",
  beans: "Beans",
  cactus: "Nopales",
  umami: "Huitlacoche",
  sesame: "Sesame",
  chorizo: "Chorizo",
};

const MOTIVATIONS = {
  impact: {
    en: [
      ({ name, sensory, use }) =>
        `Because ${name} expresses ${sensory} clearly, a small amount can redirect ${use} with purpose.`,
      ({ name, use }) =>
        `The reason to choose ${name} is practical as well as emotional: it gives ${use} more character without demanding a complicated recipe.`,
    ],
    es: [
      ({ name, sensory, use }) =>
        `Como ${name} expresa con claridad ${sensory}, una pequeña cantidad puede cambiar el rumbo de ${use}.`,
      ({ name, use }) =>
        `La razón para elegir ${name} es práctica y emocional: da más carácter a ${use} sin exigir una receta complicada.`,
    ],
    ar: [
      ({ name, sensory, use }) =>
        `لأن ${sensory} واضحة، يمكن لكمية صغيرة من ${name} أن تغيّر اتجاه ${use} بوضوح.`,
      ({ name, use }) =>
        `سبب اختيار ${name} عملي وعاطفي معاً: فهو يمنح ${use} طابعاً أقوى من دون وصفة معقدة.`,
    ],
  },
  discovery: {
    en: [
      ({ name, sensory, use }) =>
        `${name} balances recognisable cues in ${sensory} with enough surprise to make ${use} feel like a small discovery.`,
      ({ name, sensory, use }) =>
        `For shoppers curious about ${sensory}, ${name} offers a low-friction way to explore it through ${use}.`,
    ],
    es: [
      ({ name, sensory, use }) =>
        `${name} equilibra señales reconocibles de ${sensory} con suficiente sorpresa para convertir ${use} en un pequeño descubrimiento.`,
      ({ name, sensory, use }) =>
        `Para quien siente curiosidad por ${sensory}, ${name} permite explorarlo de forma sencilla mediante ${use}.`,
    ],
    ar: [
      ({ name, sensory, use }) =>
        `يوازن ${name} بين الطابع المألوف في ${sensory} وقدر من المفاجأة يجعل ${use} تجربة اكتشاف صغيرة.`,
      ({ name, sensory, use }) =>
        `للمهتمين باستكشاف ${sensory}، يقدم ${name} طريقة سهلة لتجربتها من خلال ${use}.`,
    ],
  },
  easyChoice: {
    en: [
      ({ name, sensory, use }) =>
        `The clear promise of ${sensory} makes ${name} easy to choose when ${use} needs a crowd-friendly option.`,
      ({ name, sensory, use }) =>
        `With ${name}, shoppers can picture the serving moment immediately: ${use}, anchored by ${sensory}.`,
    ],
    es: [
      ({ name, sensory, use }) =>
        `La promesa clara de ${sensory} hace que ${name} sea fácil de elegir cuando ${use} pide una opción para compartir.`,
      ({ name, sensory, use }) =>
        `Con ${name}, es fácil imaginar el momento de servicio: ${use}, con ${sensory} como punto de referencia.`,
    ],
    ar: [
      ({ name, sensory, use }) =>
        `تجعل جاذبية ${sensory} الواضحة اختيار ${name} سهلاً عندما تحتاج ${use} إلى خيار مناسب للمشاركة.`,
      ({ name, sensory, use }) =>
        `مع ${name}، يسهل تصور لحظة التقديم مباشرة: ${use} بطابع ${sensory}.`,
    ],
  },
  textureReward: {
    en: [
      ({ name, sensory, use }) =>
        `${name} delivers its reward in two steps: texture first, then ${sensory}, a combination that suits ${use}.`,
      ({ name, sensory, use }) =>
        `${name} turns ${sensory} into a clear sensory payoff for ${use}, rather than a generic snack impression.`,
    ],
    es: [
      ({ name, sensory, use }) =>
        `${name} entrega su recompensa en dos tiempos: primero la textura y después ${sensory}, una combinación adecuada para ${use}.`,
      ({ name, sensory, use }) =>
        `${name} convierte ${sensory} en una recompensa sensorial clara para ${use}, lejos de una botana sin personalidad.`,
    ],
    ar: [
      ({ name, sensory, use }) =>
        `يقدم ${name} متعته على مرحلتين: القوام أولاً ثم ${sensory}، وهي تركيبة تناسب ${use}.`,
      ({ name, sensory, use }) =>
        `تمنح ${sensory} منتج ${name} مكافأة حسية واضحة مع ${use} بعيداً عن انطباع الوجبات الخفيفة العادي.`,
    ],
  },
  cookingConfidence: {
    en: [
      ({ name, sensory, use }) =>
        `${name} gives cooks a clear direction for ${use}: build the dish around ${sensory} rather than seasoning by guesswork.`,
      ({ name, sensory, use }) =>
        `For ${use}, ${name} reduces uncertainty by making ${sensory} the starting point of the recipe.`,
    ],
    es: [
      ({ name, sensory, use }) =>
        `${name} da una dirección clara al preparar ${use}: tomar ${sensory} como punto de partida en lugar de sazonar a ciegas.`,
      ({ name, sensory, use }) =>
        `Para ${use}, ${name} reduce las dudas al convertir ${sensory} en el punto de partida de la receta.`,
    ],
    ar: [
      ({ name, sensory, use }) =>
        `يمنح ${name} الطاهي اتجاهاً واضحاً مع ${use}: بناء الطبق حول ${sensory} بدلاً من التخمين.`,
      ({ name, sensory, use }) =>
        `مع ${use}، يقلل ${name} التردد من خلال جعل ${sensory} نقطة بداية الوصفة.`,
    ],
  },
  flexibleBase: {
    en: [
      ({ name, sensory, use }) =>
        `${name} works as a flexible base for ${use}; ${sensory} leaves room for the cook to shape the final plate.`,
      ({ name, sensory, use }) =>
        `The planning advantage of ${name} is versatility: it supports ${use} while keeping ${sensory} recognisable.`,
    ],
    es: [
      ({ name, sensory, use }) =>
        `${name} funciona como una base flexible para ${use}; ${sensory} deja espacio para personalizar el plato final.`,
      ({ name, sensory, use }) =>
        `La ventaja práctica de ${name} es su versatilidad: facilita ${use} y mantiene reconocible ${sensory}.`,
    ],
    ar: [
      ({ name, sensory, use }) =>
        `يعمل ${name} كقاعدة مرنة من أجل ${use}؛ وتترك ${sensory} مساحة لتخصيص الطبق النهائي.`,
      ({ name, sensory, use }) =>
        `ميزة ${name} العملية هي المرونة: فهو يدعم ${use} مع إبقاء ${sensory} واضحة.`,
    ],
  },
};

const MOTIVATION_GROUPS = {
  giftSet: "discovery",
  candy: "discovery",
  sweetPantry: "discovery",
  popsicles: "easyChoice",
  soda: "easyChoice",
  clamato: "easyChoice",
  drinkConcentrate: "easyChoice",
  peanuts: "textureReward",
  tortillaChips: "textureReward",
  potatoChips: "textureReward",
  chicharronSnack: "textureReward",
  churritosSnack: "textureReward",
  chips: "textureReward",
  hotSauce: "impact",
  salsa: "impact",
  jam: "impact",
  seasoning: "impact",
  pickledChile: "impact",
  driedChile: "cookingConfidence",
  chilePowder: "cookingConfidence",
  masaFlour: "cookingConfidence",
  mole: "cookingConfidence",
  nopales: "cookingConfidence",
  huitlacoche: "cookingConfidence",
  chorizo: "cookingConfidence",
  tortilla: "flexibleBase",
  tostada: "flexibleBase",
  beans: "flexibleBase",
  corn: "flexibleBase",
  cheese: "flexibleBase",
  fruitInSyrup: "flexibleBase",
  general: "cookingConfidence",
};

const CLAIM_TRANSLATIONS = {
  organic: { en: "organic", es: "orgánico", ar: "عضوي" },
  "gluten-free": { en: "gluten-free", es: "sin gluten", ar: "خالٍ من الغلوتين" },
  vegan: { en: "vegan", es: "vegano", ar: "نباتي" },
  keto: { en: "keto-friendly", es: "apto para keto", ar: "مناسب للكيتو" },
  halal: { en: "halal", es: "halal", ar: "حلال" },
  "preservative-free": {
    en: "preservative-free",
    es: "sin conservadores",
    ar: "خالٍ من المواد الحافظة",
  },
  "high in protein": { en: "high in protein", es: "alto en proteína", ar: "غني بالبروتين" },
  "high in fiber": { en: "high in fibre", es: "alto en fibra", ar: "غني بالألياف" },
  "no artificial colors": {
    en: "no artificial colours",
    es: "sin colorantes artificiales",
    ar: "من دون ألوان صناعية",
  },
  "made in mexico": { en: "made in Mexico", es: "hecho en México", ar: "مصنوع في المكسيك" },
  "real cane sugar": {
    en: "sweetened with cane sugar",
    es: "endulzado con azúcar de caña",
    ar: "محلّى بسكر القصب",
  },
};

function cleanText(value) {
  return String(value ?? "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, max) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  const shortened = text
    .slice(0, Math.max(1, max - 1))
    .replace(/\s+\S*$/, "")
    .replace(/[.,;:!?¿¡-]+$/, "")
    .trim();
  return `${shortened}…`;
}

function truncateTitlePart(value, max) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  const shortened = text
    .slice(0, max)
    .replace(/\s+\S*$/, "")
    .replace(/[.,;:!?¿¡([{"'-]+$/, "")
    .trim();
  return shortened || text.slice(0, max).trim();
}

function unique(values) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) {
    result ^= char.codePointAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function pick(productKey, values, salt = "") {
  return values[hash(`${productKey}:${salt}`) % values.length];
}

function translationMap(product) {
  return Object.fromEntries((product.translations ?? []).map((item) => [item.lang, item]));
}

function getName(source, current, lang) {
  const sourceTranslations = translationMap(source);
  const currentTranslations = translationMap(current);
  return cleanText(
    sourceTranslations[lang]?.name ??
      currentTranslations[lang]?.name ??
      sourceTranslations.en?.name ??
      currentTranslations.en?.name ??
      source.slug,
  );
}

function englishSource(product) {
  return cleanText(translationMap(product).en?.description);
}

function extractSourceLead(sourceText) {
  const candidates = sourceText
    .replace(/[•✅✔️🌶️🌶🥭🍑🌿🔥🎁💯🥜🍍🌾🌽🥫]/gu, ". ")
    .split(/(?<=[.!?])\s+|\s+(?=(?:Brand|Size|Perfect|Ideal|Includes|Net Weight|Packaging|Tip):)/i)
    .map(cleanText)
    .filter((item) => item.length >= 28 && item.length <= 230)
    .filter((item) => !/^(brand|size|net weight|packaging|tip):/i.test(item))
    .filter((item) => !/INTERMEXUAE|Perfect for.+Ideal for/i.test(item));
  return candidates[0] ?? "";
}

function getKind(combined) {
  const priority = [
    "giftSet",
    "popsicles",
    "clamato",
    "soda",
    "drinkConcentrate",
    "driedChile",
    "chilePowder",
    "peanuts",
    "potatoChips",
    "chicharronSnack",
    "churritosSnack",
    "pickledChile",
    "tortillaChips",
    "tortilla",
    "tostada",
    "jam",
    "hotSauce",
    "seasoning",
    "salsa",
    "masaFlour",
    "beans",
    "corn",
    "nopales",
    "huitlacoche",
    "mole",
    "chorizo",
    "cheese",
    "fruitInSyrup",
    "sweetPantry",
    "candy",
    "chips",
    "general",
  ];
  return (
    priority
      .map((key) => KIND_RULES.find((rule) => rule.key === key))
      .find((rule) => rule?.test.test(combined)) ?? KIND_RULES.at(-1)
  );
}

function getSignals(combined, kind) {
  const excludedByKind = {
    soda: new Set(["crunchy", "soft", "creamy", "savory", "sweet"]),
  };
  const excluded = excludedByKind[kind.key] ?? new Set();
  const detected = SIGNAL_RULES.filter(([, test]) => test.test(combined))
    .map(([key]) => key)
    .filter((key) => !excluded.has(key));
  const generic = new Set([
    "crunchy",
    "soft",
    "fruity",
    "savory",
    "sweet",
    "smoky",
    "creamy",
    "tangy",
    "nutty",
  ]);
  const specific = detected.filter((key) => !generic.has(key));
  return unique([...specific.slice(0, 2), ...detected, ...kind.sensory]).slice(0, 2);
}

function getUses(combined, kind) {
  const detected = USE_RULES.filter(([, test]) => test.test(combined)).map(([key]) => key);
  const kindFirst = new Set([
    "giftSet",
    "popsicles",
    "drinkConcentrate",
    "soda",
    "peanuts",
    "tortillaChips",
    "potatoChips",
    "chicharronSnack",
    "churritosSnack",
    "candy",
    "chips",
  ]);
  return unique(
    kindFirst.has(kind.key) ? [...kind.uses, ...detected] : [...detected, ...kind.uses],
  ).slice(0, 3);
}

function getClaims(sourceText) {
  const lower = sourceText.toLowerCase();
  return RESTRICTED_CLAIMS.filter((claim) => {
    if (claim === "gluten-free") return /gluten[- ]free/.test(lower);
    if (claim === "preservative-free") return /preservative[- ]free/.test(lower);
    if (claim === "high in fiber") return /high in fib(?:er|re)/.test(lower);
    if (claim === "no artificial colors") return /no artificial colou?rs/.test(lower);
    return lower.includes(claim);
  });
}

function getFormat(product, name) {
  const match = name.match(
    /\b\d+(?:[.,]\d+)?\s?(?:ml|l|g|gm|kg|fl oz|pieces?|pcs?|pack|bottles?|bars?)\b/i,
  );
  if (match) return cleanText(match[0]);
  const variants = (product.variants ?? [])
    .slice()
    .sort((a, b) => Number(b.is_default) - Number(a.is_default));
  const label = cleanText(variants[0]?.format_label);
  return label.match(/^\d+(?:[.,]\d+)?\s?(?:ml|l|g|gm|kg|fl oz|pieces?|pcs?)$/i) ? label : "";
}

function joinNatural(values, lang) {
  const clean = unique(values);
  if (clean.length <= 1) return clean[0] ?? "";
  const conjunction = lang === "es" ? " y " : lang === "ar" ? " و" : " and ";
  if (clean.length === 2) return `${clean[0]}${conjunction}${clean[1]}`;
  const separator = lang === "ar" ? "؛ " : "; ";
  return `${clean.slice(0, -1).join(separator)}${separator}${conjunction}${clean.at(-1)}`;
}

function seoTitle(name, intent, suffix, profile) {
  const compactIntent = intent.replace(/\s+/g, " ").trim();
  const tails = [`${compactIntent} | Corner Mex`, suffix, "Corner Mex"];
  const tail = tails.find((candidate) => 60 - candidate.length - 3 >= 24) ?? "Corner Mex";
  const available = 60 - tail.length - 3;
  if (name.length <= available) return `${name} | ${tail}`;

  const desiredDifferentiators = unique([TITLE_SIGNAL[profile.signals[0]], profile.format]);
  const reservedLength = desiredDifferentiators.join(" ").length;
  const prefix = truncateTitlePart(name, Math.max(12, available - reservedLength - 1));
  const differentiators = desiredDifferentiators.filter(
    (item) => !prefix.toLowerCase().includes(item.toLowerCase()),
  );
  const namePart = truncateTitlePart(
    `${prefix}${differentiators.length ? ` ${differentiators.join(" ")}` : ""}`,
    available,
  );
  return `${namePart} | ${tail}`;
}

function buildProfile(source, current) {
  const name = getName(source, current, "en");
  const sourceText = englishSource(source);
  const identity = `${name} ${source.slug}`;
  const combined = `${identity} ${source.brand ?? ""} ${sourceText}`;
  const kind = getKind(identity);
  const signals = getSignals(combined, kind);
  const uses = getUses(combined, kind);
  const claims = getClaims(sourceText);
  return {
    id: current.id,
    slug: current.slug,
    name,
    brand: cleanText(source.brand ?? current.brand),
    category: current.category,
    sourceText,
    sourceLead: extractSourceLead(sourceText),
    kind,
    signals,
    uses,
    claims,
    format:
      getFormat(source, `${name} ${sourceText}`) ||
      getFormat(current, `${name} ${englishSource(current)}`),
    isBulk: Boolean(source.is_bulk ?? current.is_bulk),
    images: current.images ?? [],
  };
}

function renderLocale(profile, source, current, lang) {
  const copy = COPY[lang];
  const name = getName(source, current, lang);
  const sensory = joinNatural(
    profile.signals
      .map((key) => SENSORY_OVERRIDES[profile.kind.key]?.[key]?.[lang] ?? SENSORY[key]?.[lang])
      .filter(Boolean),
    lang,
  );
  const uses = joinNatural(profile.uses.map((key) => USES[key]?.[lang]).filter(Boolean), lang);
  const primaryUse = USES[profile.uses[0]]?.[lang] ?? uses;
  const occasionIndexes = profile.isBulk
    ? [5, 4, 6]
    : (OCCASION_INDEXES[profile.kind.key] ?? OCCASION_INDEXES.general);
  const occasion = pick(
    profile.slug,
    occasionIndexes.map((index) => OCCASIONS[lang][index]),
    `occasion-${lang}`,
  );
  const type = profile.kind.type[lang];
  const values = { name, sensory, use: primaryUse, uses, occasion, type };
  const hook = pick(profile.slug, copy.hooks, `hook-${lang}`)(values);
  const useSentence = pick(profile.slug, copy.use, `use-${lang}`)({ ...values, uses });
  const occasionSentence = pick(profile.slug, copy.occasion, `occasion-copy-${lang}`)(values);
  const motivationGroup = MOTIVATION_GROUPS[profile.kind.key] ?? "cookingConfidence";
  const motivationSentence = pick(
    profile.slug,
    MOTIVATIONS[motivationGroup][lang],
    `motivation-${lang}`,
  )(values);
  const sourceLeadSuffix = pick(
    profile.slug,
    [
      () => `a useful detail when planning ${occasion}.`,
      () => `a product cue that sets expectations for ${primaryUse}.`,
      () => `a detail that explains its role in ${primaryUse}.`,
    ],
    "source-lead",
  )();
  const sourceLead =
    lang === "en" &&
    profile.sourceLead &&
    !hook.toLowerCase().includes(profile.sourceLead.toLowerCase().slice(0, 30))
      ? `${profile.sourceLead.replace(/[.!?]+$/, "")}; ${sourceLeadSuffix}`
      : "";
  const formatSentence = profile.format
    ? pick(profile.slug, copy.format, `format-${lang}`)({ ...values, format: profile.format })
    : "";
  const localizedClaims = profile.claims
    .map((claim) => CLAIM_TRANSLATIONS[claim]?.[lang])
    .filter(Boolean);
  const claimSentence = localizedClaims.length
    ? copy.claim({ ...values, claims: joinNatural(localizedClaims, lang) })
    : "";
  const shopSentence = pick(profile.slug, copy.shop, `shop-${lang}`)(values);
  const cta = pick(profile.slug, copy.metaCta, `meta-cta-${lang}`);
  const metaTemplate = pick(profile.slug, copy.meta, `meta-${lang}`);
  const compactName = truncateTitlePart(name, 52);
  const metaValues = { ...values, use: primaryUse, occasion, cta };
  const compactOffset =
    hash(`${profile.kind.key}:${profile.signals[0]}:compact-meta-${lang}`) %
    copy.compactMeta.length;
  const compactTemplates = copy.compactMeta.map(
    (_, index) => copy.compactMeta[(index + compactOffset) % copy.compactMeta.length],
  );
  const metaCandidates = unique([
    metaTemplate(metaValues),
    metaTemplate({ ...metaValues, cta: "" }),
    ...compactTemplates.map((template) => template(metaValues)),
    ...compactTemplates.map((template) => template({ ...metaValues, name: compactName })),
  ]);
  const metaDescription =
    metaCandidates.find((candidate) => candidate.length >= 100 && candidate.length <= 158) ??
    metaCandidates.find((candidate) => candidate.length >= 90 && candidate.length <= 158) ??
    metaCandidates.find((candidate) => candidate.length <= 158);
  const shortDescription = cleanText(`${hook} ${occasionSentence}`);
  const coreSentences = [hook, sourceLead, useSentence, motivationSentence, occasionSentence];
  const sentenceOrders = [
    [0, 1, 2, 3, 4],
    [0, 1, 3, 2, 4],
    [0, 2, 1, 4, 3],
    [0, 3, 1, 2, 4],
    [0, 2, 4, 1, 3],
  ];
  const orderedCore = pick(profile.slug, sentenceOrders, `structure-${lang}`)
    .map((index) => coreSentences[index])
    .filter(Boolean);
  const longDescription = cleanText(
    [...orderedCore, formatSentence, claimSentence, shopSentence].filter(Boolean).join(" "),
  );
  const keywords = unique([
    name,
    profile.brand,
    profile.kind.intent[lang],
    `${primaryUse} ${copy.location}`,
    sensory,
    lang === "en"
      ? "Mexican groceries Dubai"
      : lang === "es"
        ? "productos mexicanos en Dubái"
        : "منتجات مكسيكية في دبي",
    lang === "en"
      ? "Mexican food delivery UAE"
      : lang === "es"
        ? "entrega de productos mexicanos EAU"
        : "توصيل منتجات مكسيكية الإمارات",
  ]).slice(0, 8);

  return {
    title: seoTitle(name, profile.kind.intent[lang], copy.titleSuffix, profile),
    meta_description: metaDescription,
    short_description: shortDescription,
    long_description: longDescription,
    keywords,
  };
}

function buildAltText(profile, source, current, imageIndex) {
  const name = getName(source, current, "en");
  const sensory = SENSORY[profile.signals[0]]?.en ?? SENSORY.distinctive.en;
  const use = USES[profile.uses[0]]?.en ?? USES.everydayMeals.en;
  const imageLabel = imageIndex ? `, view ${imageIndex + 1}` : "";
  return truncate(
    `${name}${profile.brand ? ` by ${profile.brand}` : ""}, ${sensory}, for ${use}${imageLabel}`,
    180,
  );
}

function buildPlan(profile, source, current) {
  const locales = Object.fromEntries(
    LANGS.map((lang) => [lang, renderLocale(profile, source, current, lang)]),
  );
  return {
    productId: current.id,
    slug: current.slug,
    editorial: {
      kind: profile.kind.key,
      signals: profile.signals,
      uses: profile.uses,
      claims_from_source: profile.claims,
      source_lead: profile.sourceLead,
    },
    seo: {
      schema_version: 2,
      editorial_strategy: "individual-product-v1",
      generated_at: generatedAt,
      category: {
        slug: current.category?.slug ?? null,
        en: current.category?.name_en ?? null,
        es: current.category?.name_es ?? null,
        ar: current.category?.name_ar ?? null,
      },
      locales,
    },
    translations: LANGS.map((lang) => ({
      product_id: current.id,
      lang,
      name: getName(source, current, lang),
      description: locales[lang].long_description,
    })),
    images: (current.images ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((image, index) => ({
        id: image.id,
        alt_text: buildAltText(profile, source, current, index),
      })),
  };
}

function sqlString(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function generateSql(plans) {
  const productValues = plans
    .map((plan) => `(${sqlString(plan.productId)}::uuid, ${sqlJson(plan.seo)})`)
    .join(",\n");
  const translationValues = plans
    .flatMap((plan) => plan.translations)
    .map(
      (row) =>
        `(${sqlString(row.product_id)}::uuid, ${sqlString(row.lang)}::public.lang_code, ${sqlString(row.name)}, ${sqlString(row.description)})`,
    )
    .join(",\n");
  const imageValues = plans
    .flatMap((plan) => plan.images)
    .map((row) => `(${sqlString(row.id)}::uuid, ${sqlString(row.alt_text)})`)
    .join(",\n");
  const imageCount = plans.reduce((sum, plan) => sum + plan.images.length, 0);

  return `-- Generated by scripts/seo-products-editorial.mjs
-- Individual editorial SEO for ${plans.length} active products.
-- Existing slugs, IDs, prices, stock, SKUs, image URLs and relationships are preserved.
BEGIN;

CREATE TEMP TABLE editorial_product_updates (
  product_id uuid PRIMARY KEY,
  seo jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO editorial_product_updates (product_id, seo) VALUES
${productValues};

DO $$
DECLARE
  expected_count integer := ${plans.length};
  matched_count integer;
BEGIN
  SELECT count(*) INTO matched_count
  FROM public.products p
  JOIN editorial_product_updates u ON u.product_id = p.id
  WHERE p.status = 'active';

  IF matched_count <> expected_count THEN
    RAISE EXCEPTION 'Editorial SEO migration aborted: expected % active products, found %',
      expected_count, matched_count;
  END IF;
END $$;

UPDATE public.products p
SET attrs = jsonb_set(COALESCE(p.attrs, '{}'::jsonb), '{seo}', u.seo, true)
FROM editorial_product_updates u
WHERE p.id = u.product_id
  AND p.status = 'active';

CREATE TEMP TABLE editorial_translation_updates (
  product_id uuid NOT NULL,
  lang public.lang_code NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  PRIMARY KEY (product_id, lang)
) ON COMMIT DROP;

INSERT INTO editorial_translation_updates (product_id, lang, name, description) VALUES
${translationValues};

INSERT INTO public.product_translations (product_id, lang, name, description)
SELECT product_id, lang, name, description
FROM editorial_translation_updates
ON CONFLICT (product_id, lang) DO UPDATE
SET description = EXCLUDED.description;

CREATE TEMP TABLE editorial_image_updates (
  image_id uuid PRIMARY KEY,
  alt_text text NOT NULL
) ON COMMIT DROP;

INSERT INTO editorial_image_updates (image_id, alt_text) VALUES
${imageValues};

UPDATE public.product_images i
SET alt_text = u.alt_text
FROM editorial_image_updates u
WHERE i.id = u.image_id;

DO $$
DECLARE
  product_count integer;
  translation_count integer;
  image_count integer;
BEGIN
  SELECT count(*) INTO product_count
  FROM public.products p
  JOIN editorial_product_updates u ON u.product_id = p.id
  WHERE p.attrs->'seo'->>'schema_version' = '2';

  SELECT count(*) INTO translation_count
  FROM public.product_translations t
  JOIN editorial_translation_updates u
    ON u.product_id = t.product_id AND u.lang = t.lang
  WHERE btrim(t.description) <> '';

  SELECT count(*) INTO image_count
  FROM public.product_images i
  JOIN editorial_image_updates u ON u.image_id = i.id
  WHERE btrim(i.alt_text) <> '';

  IF product_count <> ${plans.length}
    OR translation_count <> ${plans.length * LANGS.length}
    OR image_count <> ${imageCount}
  THEN
    RAISE EXCEPTION 'Editorial SEO validation failed: products %, translations %, images %',
      product_count, translation_count, image_count;
  END IF;
END $$;

COMMIT;
`;
}

async function fetchProducts() {
  const all = [];
  const pageSize = 100;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id, seller_id, category_id, slug, brand, status, is_halal, is_bulk,
        spice_level, origin_region, attrs, created_at, updated_at,
        category:categories(slug, name_en, name_es, name_ar),
        translations:product_translations(lang, name, description),
        images:product_images(id, product_id, url, alt_text, sort_order, created_at),
        variants:product_variants(id, product_id, sku, format_label, weight_grams, price_aed, compare_at_price_aed, stock, bulk_tiers, is_default, created_at)
      `,
      )
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

function duplicateGroups(plans, lang, field) {
  const groups = new Map();
  for (const plan of plans) {
    const value = cleanText(plan.seo.locales[lang][field]).toLowerCase();
    groups.set(value, [...(groups.get(value) ?? []), plan.slug]);
  }
  return [...groups.entries()]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([text, slugs]) => ({ text, slugs }));
}

function ngrams(value, size = 5) {
  const words = cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  return new Set(
    Array.from({ length: Math.max(0, words.length - size + 1) }, (_, index) =>
      words.slice(index, index + size).join(" "),
    ),
  );
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function highestSimilarity(plans, lang, field) {
  const rows = plans.map((plan) => ({
    slug: plan.slug,
    grams: ngrams(plan.seo.locales[lang][field]),
  }));
  let best = { score: 0, slugs: [] };
  for (let left = 0; left < rows.length; left += 1) {
    for (let right = left + 1; right < rows.length; right += 1) {
      const score = jaccard(rows[left].grams, rows[right].grams);
      if (score > best.score) best = { score, slugs: [rows[left].slug, rows[right].slug] };
    }
  }
  return best;
}

function claimViolations(plan, source) {
  const sourceText = englishSource(source).toLowerCase();
  const generated = LANGS.map((lang) => plan.seo.locales[lang].long_description)
    .join(" ")
    .toLowerCase();
  return RESTRICTED_CLAIMS.filter((claim) => {
    const translations = Object.values(CLAIM_TRANSLATIONS[claim] ?? {}).map((item) =>
      item.toLowerCase(),
    );
    const generatedClaim = [claim, ...translations].some((item) => generated.includes(item));
    const sourceClaim =
      sourceText.includes(claim) ||
      (claim === "gluten-free" && /gluten[- ]free/.test(sourceText)) ||
      (claim === "high in fiber" && /high in fib(?:er|re)/.test(sourceText)) ||
      (claim === "no artificial colors" && /no artificial colou?rs/.test(sourceText));
    return generatedClaim && !sourceClaim;
  });
}

function buildQualityReport(plans, sourceById) {
  const locales = Object.fromEntries(
    LANGS.map((lang) => {
      const titleLengths = plans.map((plan) => plan.seo.locales[lang].title.length);
      const metaLengths = plans.map((plan) => plan.seo.locales[lang].meta_description.length);
      return [
        lang,
        {
          title_length: { min: Math.min(...titleLengths), max: Math.max(...titleLengths) },
          meta_length: { min: Math.min(...metaLengths), max: Math.max(...metaLengths) },
          titles_over_60: plans
            .filter((plan) => plan.seo.locales[lang].title.length > 60)
            .map((plan) => plan.slug),
          metas_under_100: plans
            .filter((plan) => plan.seo.locales[lang].meta_description.length < 100)
            .map((plan) => plan.slug),
          metas_over_160: plans
            .filter((plan) => plan.seo.locales[lang].meta_description.length > 160)
            .map((plan) => plan.slug),
          exact_duplicates: Object.fromEntries(
            ["title", "meta_description", "short_description", "long_description"].map((field) => [
              field,
              duplicateGroups(plans, lang, field),
            ]),
          ),
          highest_similarity: Object.fromEntries(
            ["meta_description", "short_description", "long_description"].map((field) => [
              field,
              highestSimilarity(plans, lang, field),
            ]),
          ),
        },
      ];
    }),
  );
  const claims = plans.flatMap((plan) => {
    const violations = claimViolations(plan, sourceById.get(plan.productId));
    return violations.length ? [{ slug: plan.slug, violations }] : [];
  });
  const lowSpecificity = plans
    .filter(
      (plan) =>
        plan.editorial.kind === "general" &&
        !plan.editorial.source_lead &&
        plan.editorial.signals.length < 2,
    )
    .map((plan) => plan.slug);
  const duplicateCount = Object.values(locales).reduce(
    (sum, locale) =>
      sum +
      Object.values(locale.exact_duplicates).reduce(
        (fieldSum, groups) => fieldSum + groups.length,
        0,
      ),
    0,
  );
  const similarityThresholds = {
    meta_description: 0.86,
    short_description: 0.86,
    long_description: 0.78,
  };
  const highSimilarity = LANGS.flatMap((lang) =>
    Object.entries(locales[lang].highest_similarity).flatMap(([field, result]) =>
      result.score > similarityThresholds[field] ? [{ lang, field, ...result }] : [],
    ),
  );
  const lengthViolations = LANGS.flatMap((lang) =>
    plans.flatMap((plan) => {
      const locale = plan.seo.locales[lang];
      const issues = [];
      if (locale.title.length > 60) issues.push("title_over_60");
      if (locale.meta_description.length < 90) issues.push("meta_under_90");
      if (locale.meta_description.length > 160) issues.push("meta_over_160");
      return issues.length ? [{ lang, slug: plan.slug, issues }] : [];
    }),
  );

  return {
    generated_at: generatedAt,
    products: plans.length,
    source_backup: basename(sourceBackupPath),
    locales,
    claim_violations: claims,
    low_specificity: lowSpecificity,
    high_similarity: highSimilarity,
    length_violations: lengthViolations,
    blockers: {
      exact_duplicate_groups: duplicateCount,
      claim_violations: claims.length,
      low_specificity: lowSpecificity.length,
      high_similarity: highSimilarity.length,
      length_violations: lengthViolations.length,
    },
  };
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function sampleMarkdown(plans) {
  const sampleIndexes = [0, 6, 9, 17, 27, 55, 58, 71, 89, 93, 101, 113, 119, 129, 141];
  return [
    "# Editorial SEO Samples",
    "",
    ...sampleIndexes.flatMap((index) => {
      const plan = plans[index];
      if (!plan) return [];
      return [
        `## ${plan.slug}`,
        "",
        `**Angle:** ${plan.editorial.kind}; ${plan.editorial.signals.join(", ")}; ${plan.editorial.uses.join(", ")}`,
        "",
        ...LANGS.flatMap((lang) => [
          `### ${lang.toUpperCase()}`,
          "",
          `**Title:** ${plan.seo.locales[lang].title}`,
          "",
          `**Meta:** ${plan.seo.locales[lang].meta_description}`,
          "",
          plan.seo.locales[lang].long_description,
          "",
        ]),
      ];
    }),
  ].join("\n");
}

const sourceProducts = JSON.parse(readFileSync(sourceBackupPath, "utf8"));
const currentProducts =
  currentBackupPath && existsSync(currentBackupPath)
    ? JSON.parse(readFileSync(currentBackupPath, "utf8"))
    : await fetchProducts();

if (currentProducts.length !== expectedCount) {
  throw new Error(
    `Expected ${expectedCount} active products, found ${currentProducts.length}. Review before generating.`,
  );
}

const sourceById = new Map(sourceProducts.map((product) => [product.id, product]));
const missingSources = currentProducts
  .filter((product) => !sourceById.has(product.id))
  .map((product) => product.slug);
if (missingSources.length) {
  throw new Error(
    `Pre-SEO source is missing ${missingSources.length} products: ${missingSources.join(", ")}`,
  );
}

const plans = currentProducts.map((current) => {
  const source = sourceById.get(current.id);
  return buildPlan(buildProfile(source, current), source, current);
});
const quality = buildQualityReport(plans, sourceById);

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  resolve(outputDir, "products-current-backup.json"),
  `${JSON.stringify(currentProducts, null, 2)}\n`,
);
writeFileSync(
  resolve(outputDir, "seo-products-editorial-plan.json"),
  `${JSON.stringify(plans, null, 2)}\n`,
);
writeFileSync(
  resolve(outputDir, "seo-products-editorial-quality.json"),
  `${JSON.stringify(quality, null, 2)}\n`,
);
writeFileSync(resolve(outputDir, "seo-products-editorial-update.sql"), generateSql(plans));
writeFileSync(resolve(outputDir, "seo-products-editorial-samples.md"), sampleMarkdown(plans));
writeFileSync(
  resolve(outputDir, "seo-products-editorial-review.csv"),
  [
    ["slug", "kind", "signals", "uses", "source_lead", "format"].map(csvEscape).join(","),
    ...plans.map((plan) =>
      [
        plan.slug,
        plan.editorial.kind,
        plan.editorial.signals.join("|"),
        plan.editorial.uses.join("|"),
        plan.editorial.source_lead,
        plan.translations[0]?.name,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n") + "\n",
);

const blockerCount = Object.values(quality.blockers).reduce((sum, count) => sum + count, 0);
if (blockerCount) {
  throw new Error(
    `Editorial quality checks found ${blockerCount} blocker(s). Review ${resolve(outputDir, "seo-products-editorial-quality.json")}`,
  );
}

console.log(
  JSON.stringify(
    {
      mode: "dry-run",
      outputDir,
      products: plans.length,
      translations: plans.length * LANGS.length,
      images: plans.reduce((sum, plan) => sum + plan.images.length, 0),
      qualityBlockers: quality.blockers,
      maxSimilarity: Object.fromEntries(
        LANGS.map((lang) => [lang, quality.locales[lang].highest_similarity.long_description]),
      ),
    },
    null,
    2,
  ),
);
