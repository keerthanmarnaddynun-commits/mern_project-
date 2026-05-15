
const ITEM_SYNONYMS = {
// phones
iphone: ["phone", "mobile", "smartphone", "apple phone"],
phone: ["mobile", "smartphone", "cellphone", "iphone", "android phone"],
mobile: ["phone", "smartphone", "cellphone", "android phone"],
smartphone: ["phone", "mobile", "cellphone"],
cellphone: ["phone", "mobile", "smartphone"],
"apple phone": ["iphone", "phone"],
android: ["android phone", "phone", "mobile"],
"android phone": ["android", "phone", "mobile", "smartphone"],
samsung: ["android phone", "phone", "mobile"],
oneplus: ["android phone", "phone", "mobile"],
redmi: ["android phone", "phone", "mobile"],
oppo: ["android phone", "phone", "mobile"],
vivo: ["android phone", "phone", "mobile"],
realme: ["android phone", "phone", "mobile"],

// laptops
laptop: ["notebook", "computer", "laptop pc"],
notebook: ["laptop", "computer"],
computer: ["laptop", "notebook"],
"laptop pc": ["laptop", "computer"],
macbook: ["laptop", "apple laptop", "notebook"],
"apple laptop": ["macbook", "laptop"],
chromebook: ["laptop", "notebook"],
thinkpad: ["laptop", "notebook"],
dell: ["laptop", "notebook"],
hp: ["laptop", "notebook"],
lenovo: ["laptop", "notebook"],
asus: ["laptop", "notebook"],
acer: ["laptop", "notebook"],

// electronics
tablet: ["tab", "ipad", "android tablet"],
tab: ["tablet", "ipad", "android tablet"],
ipad: ["tablet", "apple tablet", "tab"],
"apple tablet": ["ipad", "tablet"],
"android tablet": ["tablet", "tab"],
pendrive: ["usb drive", "flash drive", "usb stick"],
"usb drive": ["pendrive", "flash drive", "usb stick"],
"flash drive": ["pendrive", "usb drive", "usb stick"],
"usb stick": ["pendrive", "usb drive", "flash drive"],
harddisk: ["hard disk", "external hard drive", "hdd"],
"hard disk": ["harddisk", "external hard drive", "hdd"],
hdd: ["harddisk", "hard disk", "external hard drive"],
ssd: ["external ssd"],
"external ssd": ["ssd"],
mouse: ["wireless mouse", "usb mouse"],
"wireless mouse": ["mouse"],
"usb mouse": ["mouse"],
keyboard: ["wireless keyboard", "usb keyboard"],
"wireless keyboard": ["keyboard"],
"usb keyboard": ["keyboard"],
speaker: ["bluetooth speaker", "portable speaker"],
"bluetooth speaker": ["speaker", "portable speaker"],
"portable speaker": ["speaker", "bluetooth speaker"],
powerbank: ["power bank", "portable charger"],
"power bank": ["powerbank", "portable charger"],
"portable charger": ["powerbank", "power bank"],

// chargers
charger: ["adapter", "charging adapter"],
adapter: ["charger", "charging adapter", "power adapter"],
"charging adapter": ["charger", "adapter"],
"power adapter": ["adapter", "laptop charger"],
"phone charger": ["charger", "mobile charger", "iphone charger"],
"mobile charger": ["phone charger", "charger"],
"laptop charger": ["charger", "laptop adapter", "power adapter"],
"laptop adapter": ["laptop charger", "adapter"],
"charging cable": ["charger cable", "usb cable", "data cable"],
"charger cable": ["charging cable", "usb cable", "data cable"],
"usb cable": ["charging cable", "charger cable", "data cable"],
"data cable": ["usb cable", "charging cable", "charger cable"],
"type c cable": ["usb c cable", "charging cable"],
"usb c cable": ["type c cable", "charging cable"],
"lightning cable": ["iphone charger", "charging cable"],
"iphone charger": ["lightning cable", "phone charger"],

// wallets
wallet: ["purse", "card holder", "money purse"],
purse: ["wallet", "hand purse"],
"card holder": ["wallet", "card wallet"],
"card wallet": ["card holder", "wallet"],
"money purse": ["wallet", "purse"],
"hand purse": ["purse", "wallet"],

// cards / ids
"id card": ["college id", "student id", "id badge", "campus card"],
"college id": ["id card", "student id", "college card"],
"student id": ["id card", "college id", "student card"],
"college card": ["college id", "id card"],
"student card": ["student id", "campus card"],
"id badge": ["id card", "badge"],
"campus card": ["id card", "student card"],
"aadhaar card": ["aadhar card", "aadhaar", "aadhar"],
"aadhar card": ["aadhaar card", "aadhaar", "aadhar"],
aadhaar: ["aadhaar card", "aadhar card"],
aadhar: ["aadhaar card", "aadhar card"],
"pan card": ["pan"],
pan: ["pan card"],
"driving licence": ["driving license", "dl"],
"driving license": ["driving licence", "dl"],
dl: ["driving licence", "driving license"],
"debit card": ["bank card", "atm card"],
"credit card": ["bank card"],
"bank card": ["debit card", "credit card", "atm card"],
"atm card": ["debit card", "bank card"],
"metro card": ["travel card", "bus pass"],
"travel card": ["metro card"],
"library card": ["college card", "student card"],

// keys
key: ["keys", "keychain", "key ring"],
keys: ["key", "keychain", "key ring"],
keychain: ["key chain", "key ring", "keys"],
"key chain": ["keychain", "key ring", "keys"],
"key ring": ["keychain", "key chain", "keys"],
"bike key": ["vehicle key", "scooty key", "motorcycle key"],
"scooty key": ["bike key", "vehicle key", "activa key"],
"activa key": ["scooty key", "vehicle key"],
"motorcycle key": ["bike key", "vehicle key"],
"car key": ["vehicle key", "key fob"],
"key fob": ["car key", "vehicle key"],
"vehicle key": ["bike key", "scooty key", "car key"],
"room key": ["hostel key", "locker key"],
"hostel key": ["room key", "locker key"],
"locker key": ["room key", "hostel key"],

// bags
bag: ["carry bag", "college bag"],
backpack: ["bag", "school bag", "college bag", "rucksack"],
"school bag": ["bag", "backpack", "college bag"],
"college bag": ["bag", "backpack", "school bag"],
rucksack: ["backpack", "bag"],
handbag: ["hand bag", "ladies bag", "purse"],
"hand bag": ["handbag", "ladies bag", "purse"],
"ladies bag": ["handbag", "hand bag", "purse"],
"laptop bag": ["bag", "office bag", "laptop sleeve"],
"office bag": ["laptop bag", "bag"],
"laptop sleeve": ["laptop bag", "bag"],
sling: ["sling bag", "side bag"],
"sling bag": ["sling", "side bag", "crossbody bag"],
"side bag": ["sling bag", "crossbody bag"],
"crossbody bag": ["sling bag", "side bag"],
tote: ["tote bag", "cloth bag"],
"tote bag": ["tote", "cloth bag"],
"cloth bag": ["tote bag", "tote"],
duffle: ["duffel bag", "gym bag"],
"duffel bag": ["duffle", "gym bag"],
"gym bag": ["duffel bag", "duffle"],

// books / notebooks
book: ["textbook", "notebook", "course book"],
textbook: ["book", "course book", "subject book"],
"course book": ["book", "textbook"],
"subject book": ["textbook", "book"],
notebook: ["note book", "class notebook", "rough notebook"],
"note book": ["notebook", "class notebook"],
"class notebook": ["notebook", "note book"],
"rough notebook": ["notebook"],
diary: ["journal", "personal notebook"],
journal: ["diary", "notebook"],
"personal notebook": ["diary", "journal"],
record: ["record book", "lab record"],
"record book": ["record", "lab record"],
"lab record": ["record", "record book"],
notes: ["class notes", "notebook"],
"class notes": ["notes", "notebook"],
assignment: ["assignment file"],
"assignment file": ["assignment", "file"],
register: ["notebook", "record book"],

// watches
watch: ["wrist watch", "smartwatch", "smart watch"],
"wrist watch": ["watch"],
smartwatch: ["smart watch", "watch"],
"smart watch": ["smartwatch", "watch"],
"fitness band": ["smart band", "band"],
"smart band": ["fitness band", "band"],
band: ["fitness band", "smart band"],

// jewelry
ring: ["finger ring"],
"finger ring": ["ring"],
chain: ["neck chain", "gold chain", "silver chain"],
"neck chain": ["chain"],
"gold chain": ["chain", "neck chain"],
"silver chain": ["chain", "neck chain"],
bracelet: ["bangle", "wrist band"],
bangle: ["bracelet"],
"wrist band": ["bracelet"],
earring: ["ear ring", "stud"],
"ear ring": ["earring", "stud"],
stud: ["earring", "ear stud"],
"ear stud": ["stud", "earring"],
pendant: ["locket"],
locket: ["pendant"],
anklet: ["payal"],
payal: ["anklet"],
jewelry: ["jewellery"],
jewellery: ["jewelry"],

// earphones / headphones
earphones: ["earphone", "wired earphones", "handsfree"],
earphone: ["earphones", "wired earphone", "handsfree"],
"wired earphones": ["earphones", "handsfree"],
"wired earphone": ["earphone", "handsfree"],
handsfree: ["earphones", "earphone"],
earbuds: ["ear buds", "tws", "wireless earbuds"],
"ear buds": ["earbuds", "tws", "wireless earbuds"],
tws: ["earbuds", "wireless earbuds"],
airpods: ["earbuds", "wireless earbuds", "apple earbuds"],
"apple earbuds": ["airpods", "earbuds"],
"wireless earbuds": ["earbuds", "tws", "airpods"],
headphones: ["headphone", "headset", "over ear headphones"],
headphone: ["headphones", "headset"],
headset: ["headphones", "headphone"],
"over ear headphones": ["headphones", "headset"],
"bluetooth earphones": ["wireless earphones", "neckband"],
"wireless earphones": ["bluetooth earphones", "neckband", "earbuds"],
neckband: ["wireless earphones", "bluetooth earphones"],

// bottles
bottle: ["water bottle", "flask", "sipper"],
"water bottle": ["bottle", "flask", "sipper"],
flask: ["bottle", "water bottle", "steel bottle"],
sipper: ["bottle", "water bottle"],
"steel bottle": ["flask", "water bottle"],
tumbler: ["bottle", "sipper"],

// clothes
jacket: ["coat", "hoodie"],
coat: ["jacket", "blazer", "lab coat"],
hoodie: ["hooded jacket", "jacket", "sweatshirt"],
"hooded jacket": ["hoodie", "jacket"],
sweater: ["pullover", "jersey"],
pullover: ["sweater"],
jersey: ["sweater"],
sweatshirt: ["hoodie", "sweater"],
shawl: ["stole"],
stole: ["shawl", "dupatta"],
dupatta: ["stole"],
cap: ["hat"],
hat: ["cap"],
scarf: ["muffler"],
muffler: ["scarf"],
shirt: ["formal shirt", "t shirt"],
"formal shirt": ["shirt"],
"t shirt": ["tee", "shirt"],
tee: ["t shirt"],
uniform: ["college uniform", "lab coat"],
"college uniform": ["uniform"],
"lab coat": ["coat", "uniform"],
blazer: ["coat"],
raincoat: ["rain coat"],
"rain coat": ["raincoat"],

// umbrellas
umbrella: ["folding umbrella", "rain umbrella", "compact umbrella"],
"folding umbrella": ["umbrella", "compact umbrella"],
"rain umbrella": ["umbrella"],
"compact umbrella": ["umbrella", "folding umbrella"],

// documents
document: ["documents", "paper file", "certificate"],
documents: ["document", "papers", "paper file"],
papers: ["document", "documents"],
"paper file": ["document", "documents", "file"],
certificate: ["document", "marksheet"],
marksheet: ["mark sheet", "certificate"],
"mark sheet": ["marksheet", "certificate"],
passport: ["passport document"],
"passport document": ["passport"],
receipt: ["bill", "payment slip"],
bill: ["receipt"],
"payment slip": ["receipt"],
file: ["folder", "document file"],
folder: ["file", "document folder"],
"document file": ["file", "folder"],
"document folder": ["folder", "file"],

// spectacles / glasses
spectacles: ["glasses", "specs", "eyeglasses"],
glasses: ["spectacles", "specs", "eyeglasses"],
specs: ["spectacles", "glasses", "specs frame"],
eyeglasses: ["spectacles", "glasses", "specs"],
"specs frame": ["specs", "frame"],
goggles: ["sunglasses"],
sunglasses: ["goggles", "shades"],
shades: ["sunglasses"],
frame: ["glasses", "spectacles"],

// calculators
calculator: ["calc", "scientific calculator", "casio"],
calc: ["calculator", "scientific calculator", "casio"],
"scientific calculator": ["calculator", "calc", "casio"],
casio: ["calculator", "scientific calculator", "calc"],
fx82ms: ["casio", "scientific calculator", "calculator"],
fx991es: ["casio", "scientific calculator", "calculator"],

// college / student items
"geometry box": ["geo box", "instrument box"],
"geo box": ["geometry box", "instrument box"],
"instrument box": ["geometry box", "geo box"],
pen: ["ball pen", "gel pen"],
"ball pen": ["pen"],
"gel pen": ["pen"],
pencil: ["mechanical pencil"],
"mechanical pencil": ["pencil"],
pouch: ["pen pouch", "stationery pouch"],
"pen pouch": ["pouch", "stationery pouch"],
"stationery pouch": ["pouch", "pen pouch"],
lanyard: ["id lanyard", "neck strap"],
"id lanyard": ["lanyard", "neck strap"],
"neck strap": ["lanyard", "id lanyard"],
labcoat: ["lab coat", "coat"],
"hall ticket": ["admit card"],
"admit card": ["hall ticket"],
"bus pass": ["student bus pass", "metro card"],
"student bus pass": ["bus pass"],
"exam pad": ["writing pad", "clipboard"],
"writing pad": ["exam pad", "clipboard"],
clipboard: ["writing pad", "exam pad"],
"lab file": ["record file", "assignment file"],
"record file": ["lab file", "record book"],
"college badge": ["badge", "id badge"],
badge: ["college badge", "id badge"],

// extra practical campus items
lunchbox: ["lunch box", "tiffin", "tiffin box"],
"lunch box": ["lunchbox", "tiffin", "tiffin box"],
tiffin: ["lunchbox", "tiffin box"],
"tiffin box": ["lunchbox", "tiffin"],
helmet: ["bike helmet"],
"bike helmet": ["helmet"]
};

const CATEGORY_TOKENS = {
phones: [
"iphone", "phone", "mobile", "smartphone", "cellphone", "apple phone",
"android", "android phone", "samsung", "oneplus", "redmi", "oppo", "vivo", "realme"
],
laptops: [
"laptop", "notebook", "computer", "laptop pc", "macbook", "apple laptop",
"chromebook", "thinkpad", "dell", "hp", "lenovo", "asus", "acer"
],
electronics: [
"tablet", "tab", "ipad", "apple tablet", "android tablet", "pendrive", "usb drive",
"flash drive", "usb stick", "harddisk", "hard disk", "hdd", "ssd", "external ssd",
"mouse", "wireless mouse", "usb mouse", "keyboard", "wireless keyboard", "usb keyboard",
"speaker", "bluetooth speaker", "portable speaker", "powerbank", "power bank", "portable charger"
],
chargers: [
"charger", "adapter", "charging adapter", "power adapter", "phone charger", "mobile charger",
"laptop charger", "laptop adapter", "charging cable", "charger cable", "usb cable",
"data cable", "type c cable", "usb c cable", "lightning cable", "iphone charger"
],
wallets: [
"wallet", "purse", "card holder", "card wallet", "money purse", "hand purse"
],
cards: [
"id card", "college id", "student id", "college card", "student card", "id badge", "campus card",
"aadhaar card", "aadhar card", "aadhaar", "aadhar", "pan card", "pan", "driving licence",
"driving license", "dl", "debit card", "credit card", "bank card", "atm card",
"metro card", "travel card", "library card"
],
keys: [
"key", "keys", "keychain", "key chain", "key ring", "bike key", "scooty key", "activa key",
"motorcycle key", "car key", "key fob", "vehicle key", "room key", "hostel key", "locker key"
],
bags: [
"bag", "backpack", "school bag", "college bag", "rucksack", "handbag", "hand bag", "ladies bag",
"laptop bag", "office bag", "laptop sleeve", "sling", "sling bag", "side bag", "crossbody bag",
"tote", "tote bag", "cloth bag", "duffle", "duffel bag", "gym bag"
],
books: [
"book", "textbook", "course book", "subject book", "notebook", "note book", "class notebook",
"rough notebook", "diary", "journal", "personal notebook", "record", "record book",
"lab record", "notes", "class notes", "assignment", "assignment file", "register"
],
watches: [
"watch", "wrist watch", "smartwatch", "smart watch", "fitness band", "smart band", "band"
],
jewelry: [
"ring", "finger ring", "chain", "neck chain", "gold chain", "silver chain", "bracelet",
"bangle", "wrist band", "earring", "ear ring", "stud", "ear stud", "pendant", "locket",
"anklet", "payal", "jewelry", "jewellery"
],
audio: [
"earphones", "earphone", "wired earphones", "wired earphone", "handsfree", "earbuds", "ear buds",
"tws", "airpods", "apple earbuds", "wireless earbuds", "headphones", "headphone", "headset",
"over ear headphones", "bluetooth earphones", "wireless earphones", "neckband"
],
bottles: [
"bottle", "water bottle", "flask", "sipper", "steel bottle", "tumbler"
],
clothes: [
"jacket", "coat", "hoodie", "hooded jacket", "sweater", "pullover", "jersey", "sweatshirt",
"shawl", "stole", "dupatta", "cap", "hat", "scarf", "muffler", "shirt", "formal shirt",
"t shirt", "tee", "uniform", "college uniform", "lab coat", "blazer", "raincoat", "rain coat"
],
umbrellas: [
"umbrella", "folding umbrella", "rain umbrella", "compact umbrella"
],
documents: [
"document", "documents", "papers", "paper file", "certificate", "marksheet", "mark sheet",
"passport", "passport document", "receipt", "bill", "payment slip", "file", "folder",
"document file", "document folder"
],
spectacles: [
"spectacles", "glasses", "specs", "eyeglasses", "specs frame", "goggles", "sunglasses", "shades", "frame"
],
calculators: [
"calculator", "calc", "scientific calculator", "casio", "fx82ms", "fx991es"
],
student_items: [
"geometry box", "geo box", "instrument box", "pen", "ball pen", "gel pen", "pencil",
"mechanical pencil", "pouch", "pen pouch", "stationery pouch", "lanyard", "id lanyard",
"neck strap", "labcoat", "hall ticket", "admit card", "bus pass", "student bus pass",
"exam pad", "writing pad", "clipboard", "lab file", "record file", "college badge", "badge",
"lunchbox", "lunch box", "tiffin", "tiffin box", "helmet", "bike helmet"
]
};

const STOPWORDS = new Set([
"a", "an", "the", "my", "is", "was", "are", "were", "to", "of", "for", "in", "on", "at", "near",
"from", "and", "or", "with", "without", "this", "that", "these", "those", "black", "blue", "red",
"green", "white", "grey", "gray", "brown", "pink", "yellow", "orange", "purple", "golden", "silver",
"small", "big", "large", "medium", "old", "new", "lost", "found", "missing", "item", "stuff", "thing"
]);

const NORMALIZE_MAP = {
mobiles: "mobile",
phones: "phone",
smartphones: "smartphone",
cellphones: "cellphone",
laptops: "laptop",
notebooks: "notebook",
tablets: "tablet",
ipads: "ipad",
chargers: "charger",
wallets: "wallet",
purses: "purse",
cards: "card",
keys: "key",
bags: "bag",
backpacks: "backpack",
books: "book",
notebookss: "notebook",
watches: "watch",
earphones: "earphones",
headphones: "headphones",
bottles: "bottle",
clothes: "clothes",
spectacles: "spectacles",
glasses: "glasses",
specs: "specs",
calculators: "calculator",
documents: "document",
umbrellas: "umbrella"
};

function uniq(arr) {
return [...new Set(arr.filter(Boolean))];
}

function normalizeText(text = "") {
return String(text)
.toLowerCase()
.replace(/['’]/g, "")
.replace(/[^a-z0-9]+/g, " ")
.replace(/\s+/g, " ")
.trim();
}

function normalizeToken(token = "") {
const clean = normalizeText(token);
return NORMALIZE_MAP[clean] || clean;
}

const PHRASE_INDEX = buildPhraseIndex();

function buildPhraseIndex() {
const phrases = new Map();

for (const [key, values] of Object.entries(ITEM_SYNONYMS)) {
const normalizedKey = normalizeToken(key);
if (normalizedKey.includes(" ")) {
phrases.set(normalizedKey, normalizedKey);
}

for (const value of values) {
  const normalizedValue = normalizeToken(value);
  if (normalizedValue.includes(" ")) {
    phrases.set(normalizedValue, normalizedValue);
  }
}
}

for (const items of Object.values(CATEGORY_TOKENS)) {
for (const item of items) {
const normalizedItem = normalizeToken(item);
if (normalizedItem.includes(" ")) {
phrases.set(normalizedItem, normalizedItem);
}
}
}

return [...phrases.keys()].sort((a, b) => b.length - a.length);
}

function detectCategories(tokens) {
const tokenSet = new Set(tokens);
const matched = [];

for (const [category, categoryTerms] of Object.entries(CATEGORY_TOKENS)) {
for (const term of categoryTerms) {
if (tokenSet.has(normalizeToken(term))) {
matched.push(category);
break;
}
}
}

return matched;
}

function expandTokens(tokens = []) {
const normalizedInput = uniq(tokens.map(normalizeToken).filter(Boolean));
const categories = detectCategories(normalizedInput);
const categorySet = new Set(categories);
const expanded = new Set(normalizedInput);

for (const token of normalizedInput) {
const direct = ITEM_SYNONYMS[token] || [];
for (const synonym of direct) {
const normalizedSynonym = normalizeToken(synonym);
if (!normalizedSynonym) continue;

  const synonymCategories = detectCategories([normalizedSynonym]);

  if (
    synonymCategories.length === 0 ||
    synonymCategories.some((category) => categorySet.has(category))
  ) {
    expanded.add(normalizedSynonym);
  }
}
}

return {
tokens: [...expanded],
categories
};
}

function tokenizeWithSynonyms(text = "") {
const normalized = normalizeText(text);
if (!normalized) {
return {
rawTokens: [],
tokens: [],
categories: []
};
}

const matchedPhrases = [];
let workingText = normalized;

for (const phrase of PHRASE_INDEX) {
const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const regex = new RegExp('(^|\\s)' + escaped + '(?=\\s|$)', 'g');

if (regex.test(workingText)) {
  matchedPhrases.push(phrase);
  workingText = workingText.replace(regex, " ");
}
}

const singleWords = workingText
.split(/\s+/)
.map(normalizeToken)
.filter((token) => token && !STOPWORDS.has(token));

const rawTokens = uniq([
...matchedPhrases.map(normalizeToken),
...singleWords
]);

const expanded = expandTokens(rawTokens);

return {
rawTokens,
tokens: expanded.tokens,
categories: expanded.categories
};
}

module.exports = {
  ITEM_SYNONYMS,
  expandTokens,
  tokenizeWithSynonyms
};
