/**
 * Japto.in launch category master (from developer handover).
 * Admin can add/edit more later — this is seed data only.
 * Clothing / size-based apparel intentionally excluded.
 */

const PHOTO = {
  grocery: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=160&auto=format&fit=crop&q=80',
  veggies: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=160&auto=format&fit=crop&q=80',
  footwear: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=160&auto=format&fit=crop&q=80',
  electronics: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=160&auto=format&fit=crop&q=80',
  appliances: 'https://images.unsplash.com/photo-1556911220-bff31c875dbe?w=160&auto=format&fit=crop&q=80',
  kitchen: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=160&auto=format&fit=crop&q=80',
  stationery: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=160&auto=format&fit=crop&q=80',
  beauty: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=160&auto=format&fit=crop&q=80',
  baby: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=160&auto=format&fit=crop&q=80',
  health: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=160&auto=format&fit=crop&q=80',
  hardware: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=160&auto=format&fit=crop&q=80',
  furniture: 'https://images.unsplash.com/photo-1580481077197-28564f513904?w=160&auto=format&fit=crop&q=80',
  sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba6851?w=160&auto=format&fit=crop&q=80',
  auto: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=160&auto=format&fit=crop&q=80',
  pets: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=160&auto=format&fit=crop&q=80',
  toys: 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=160&auto=format&fit=crop&q=80',
  pooja: 'https://images.unsplash.com/photo-1604608672516-f1b9b1d37076?w=160&auto=format&fit=crop&q=80',
  sweets: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=160&auto=format&fit=crop&q=80',
  handmade: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=160&auto=format&fit=crop&q=80'
};

const slugify = (name) =>
  String(name)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** @type {{ name: string, nameHi?: string, slug: string, iconEmoji: string, photoUrl: string, requiresLicence?: boolean, subcategories: string[] }[]} */
const JAPTO_MAIN_CATEGORIES = [
  {
    name: 'Grocery & Daily Needs',
    nameHi: 'किराना',
    slug: 'grocery-daily-needs',
    iconEmoji: '🛒',
    photoUrl: PHOTO.grocery,
    subcategories: [
      'Atta, Rice & Flour',
      'Pulses & Dals',
      'Edible Oil & Ghee',
      'Spices & Masala',
      'Sugar, Salt & Jaggery',
      'Dry Fruits & Nuts',
      'Tea, Coffee & Beverages',
      'Biscuits, Snacks & Namkeen',
      'Packaged & Instant Food',
      'Pickles, Sauces & Papad',
      'Breakfast & Cereals',
      'Organic & Health Food'
    ]
  },
  {
    name: 'Fruits & Vegetables',
    nameHi: 'फल और सब्जियां',
    slug: 'fruits-vegetables',
    iconEmoji: '🥬',
    photoUrl: PHOTO.veggies,
    subcategories: [
      'Fresh Fruits',
      'Fresh Vegetables',
      'Leafy Vegetables',
      'Exotic Vegetables',
      'Seasonal Fruits',
      'Herbs & Greens',
      'Cut & Packed Vegetables'
    ]
  },
  {
    name: 'Footwear & Fashion Accessories',
    nameHi: 'जूते और फैशन एक्सेसरीज़',
    slug: 'footwear-fashion-accessories',
    iconEmoji: '👟',
    photoUrl: PHOTO.footwear,
    subcategories: [
      "Men's Shoes",
      "Women's Shoes",
      "Kids' Shoes",
      'Sports Shoes',
      'Sandals & Slippers',
      'Handbags & Wallets',
      'Belts & Caps',
      'Sunglasses',
      'Watches'
    ]
  },
  {
    name: 'Electronics & Gadgets',
    nameHi: 'इलेक्ट्रॉनिक्स',
    slug: 'electronics-gadgets',
    iconEmoji: '📱',
    photoUrl: PHOTO.electronics,
    subcategories: [
      'Smartphones',
      'Tablets',
      'Laptops & Computers',
      'Computer Accessories',
      'Headphones & Earphones',
      'Speakers',
      'Smart Watches',
      'Cameras',
      'Chargers & Cables',
      'Power Banks',
      'Gaming Accessories',
      'Electronic Components'
    ]
  },
  {
    name: 'Home Appliances',
    nameHi: 'घरेलू उपकरण',
    slug: 'home-appliances',
    iconEmoji: '🔌',
    photoUrl: PHOTO.appliances,
    subcategories: [
      'Refrigerators',
      'Washing Machines',
      'Air Conditioners',
      'Coolers & Fans',
      'Televisions',
      'Microwave Ovens',
      'Mixer & Grinder',
      'Water Purifiers',
      'Geysers',
      'Irons',
      'Vacuum Cleaners'
    ]
  },
  {
    name: 'Home & Kitchen',
    nameHi: 'घर और रसोई',
    slug: 'home-kitchen',
    iconEmoji: '🍳',
    photoUrl: PHOTO.kitchen,
    subcategories: [
      'Kitchen Utensils',
      'Cookware & Pans',
      'Dinner Sets',
      'Glassware',
      'Storage Containers',
      'Home Decor',
      'Wall Clocks',
      'Bedsheets & Blankets',
      'Curtains',
      'Pillows & Cushions',
      'Cleaning Supplies',
      'Bathroom Accessories'
    ]
  },
  {
    name: 'Stationery & Office Supplies',
    nameHi: 'स्टेशनरी और ऑफिस',
    slug: 'stationery-office',
    iconEmoji: '📚',
    photoUrl: PHOTO.stationery,
    subcategories: [
      'Notebooks & Registers',
      'Pens & Pencils',
      'Erasers & Sharpeners',
      'School Bags',
      'Geometry Boxes',
      'Art & Craft Supplies',
      'Office Files & Folders',
      'Printer Paper',
      'Printers & Ink',
      'Office Accessories',
      'School Books',
      'Educational Supplies'
    ]
  },
  {
    name: 'Beauty & Personal Care',
    nameHi: 'ब्यूटी और पर्सनल केयर',
    slug: 'beauty-personal-care',
    iconEmoji: '💄',
    photoUrl: PHOTO.beauty,
    subcategories: [
      'Face Wash & Cream',
      'Skin Care',
      'Hair Care',
      'Shampoo & Conditioner',
      'Hair Oil',
      'Makeup & Cosmetics',
      'Perfumes & Deodorants',
      "Men's Grooming",
      'Bath & Body',
      'Oral Care',
      'Beauty Tools'
    ]
  },
  {
    name: 'Baby & Kids Products',
    nameHi: 'बेबी और बच्चों के उत्पाद',
    slug: 'baby-kids',
    iconEmoji: '🍼',
    photoUrl: PHOTO.baby,
    subcategories: [
      'Diapers & Wipes',
      'Baby Food',
      'Baby Skincare',
      'Feeding Bottles',
      'Baby Toys',
      'Baby Bedding',
      'Baby Care Accessories',
      'Kids Learning Toys'
    ]
  },
  {
    name: 'Health & Pharmacy',
    nameHi: 'स्वास्थ्य और फार्मेसी',
    slug: 'health-pharmacy',
    iconEmoji: '💊',
    photoUrl: PHOTO.health,
    requiresLicence: true,
    subcategories: [
      'OTC Healthcare Products',
      'First Aid Supplies',
      'Medical Devices',
      'Health Monitoring Devices',
      'Personal Hygiene',
      'Surgical & Medical Supplies',
      'Healthcare Essentials'
    ]
  },
  {
    name: 'Hardware & Electrical',
    nameHi: 'हार्डवेयर और इलेक्ट्रिकल',
    slug: 'hardware-electrical',
    iconEmoji: '🔧',
    photoUrl: PHOTO.hardware,
    subcategories: [
      'Hand Tools',
      'Power Tools',
      'Paint & Brushes',
      'Plumbing Supplies',
      'Pipes & Fittings',
      'Electrical Wires',
      'Switches & Sockets',
      'LED Lights & Bulbs',
      'Locks & Handles',
      'Building Materials'
    ]
  },
  {
    name: 'Furniture & Home Furnishing',
    nameHi: 'फर्नीचर',
    slug: 'furniture-home-furnishing',
    iconEmoji: '🪑',
    photoUrl: PHOTO.furniture,
    subcategories: [
      'Sofas',
      'Beds',
      'Mattresses',
      'Dining Tables',
      'Chairs',
      'Wardrobes',
      'Study Tables',
      'Office Furniture',
      'Shoe Racks',
      'Storage Furniture'
    ]
  },
  {
    name: 'Sports & Fitness',
    nameHi: 'खेल और फिटनेस',
    slug: 'sports-fitness',
    iconEmoji: '🏏',
    photoUrl: PHOTO.sports,
    subcategories: [
      'Cricket Equipment',
      'Football & Basketball',
      'Badminton',
      'Fitness Equipment',
      'Gym Accessories',
      'Yoga Mats',
      'Cycling Accessories',
      'Sports Clothing',
      'Outdoor Games'
    ]
  },
  {
    name: 'Automobile Accessories',
    nameHi: 'ऑटोमोबाइल',
    slug: 'automobile-accessories',
    iconEmoji: '🛵',
    photoUrl: PHOTO.auto,
    subcategories: [
      'Bike Accessories',
      'Car Accessories',
      'Helmets',
      'Car Cleaning Products',
      'Engine Oil',
      'Vehicle Covers',
      'Seat Covers',
      'Vehicle Lights',
      'Tyre Accessories',
      'Tools & Spares'
    ]
  },
  {
    name: 'Pet Supplies',
    nameHi: 'पालतू जानवरों के उत्पाद',
    slug: 'pet-supplies',
    iconEmoji: '🐾',
    photoUrl: PHOTO.pets,
    subcategories: [
      'Dog Food',
      'Cat Food',
      'Pet Toys',
      'Pet Grooming',
      'Pet Accessories',
      'Pet Bedding',
      'Pet Feeding Supplies'
    ]
  },
  {
    name: 'Toys, Gifts & Lifestyle',
    nameHi: 'खिलौने और उपहार',
    slug: 'toys-gifts-lifestyle',
    iconEmoji: '🎁',
    photoUrl: PHOTO.toys,
    subcategories: [
      'Educational Toys',
      'Soft Toys',
      'Board Games',
      'Birthday Gifts',
      'Gift Hampers',
      'Decorative Items',
      'Festival Decorations',
      'Artificial Flowers',
      'Craft & Hobby Items'
    ]
  },
  {
    name: 'Pooja & Religious Items',
    nameHi: 'पूजा सामग्री',
    slug: 'pooja-religious',
    iconEmoji: '🪔',
    photoUrl: PHOTO.pooja,
    subcategories: [
      'Agarbatti & Dhoop',
      'Pooja Thali',
      'Diyas',
      'Pooja Samagri',
      'Religious Books',
      'Idols & Murti',
      'Decorative Pooja Items',
      'Festival Pooja Kits'
    ]
  },
  {
    name: 'Sweets, Bakery & Dairy',
    nameHi: 'मिठाई, बेकरी और डेयरी',
    slug: 'sweets-bakery-dairy',
    iconEmoji: '🥛',
    photoUrl: PHOTO.sweets,
    subcategories: [
      'Fresh Sweets',
      'Cakes & Pastries',
      'Bread & Bakery',
      'Milk & Curd',
      'Paneer & Cheese',
      'Butter',
      'Ice Cream',
      'Chocolates',
      'Fresh Juices'
    ]
  },
  {
    name: 'Local & Handmade Products',
    nameHi: 'स्थानीय और हस्तनिर्मित उत्पाद',
    slug: 'local-handmade',
    iconEmoji: 'handmade',
    photoUrl: PHOTO.handmade,
    subcategories: [
      'Handicrafts',
      'Local Art & Paintings',
      'Handmade Jewellery',
      'Wooden Products',
      'Traditional Bundelkhand Products',
      'Local Specialties',
      'Handmade Decor'
    ]
  }
];

// Fix emoji typo
JAPTO_MAIN_CATEGORIES.find((c) => c.slug === 'local-handmade').iconEmoji = '🎨';

const buildCategorySeedDocs = () => {
  const mains = [];
  const subs = [];
  JAPTO_MAIN_CATEGORIES.forEach((main, idx) => {
    mains.push({
      name: main.name,
      nameHi: main.nameHi || '',
      slug: main.slug,
      iconEmoji: main.iconEmoji,
      photoUrl: main.photoUrl,
      displayOrder: idx + 1,
      parentId: null,
      isActive: true,
      requiresLicence: Boolean(main.requiresLicence)
    });
    main.subcategories.forEach((subName, sIdx) => {
      subs.push({
        mainSlug: main.slug,
        name: subName,
        slug: `${main.slug}--${slugify(subName)}`,
        iconEmoji: '📁',
        photoUrl: main.photoUrl,
        displayOrder: sIdx + 1,
        isActive: true,
        requiresLicence: Boolean(main.requiresLicence)
      });
    });
  });
  return { mains, subs };
};

module.exports = {
  JAPTO_MAIN_CATEGORIES,
  buildCategorySeedDocs,
  slugify
};
