/**
 * Seed MongoDB from html-design/js/data.js catalog
 * Run: npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const Category = require('../models/Category');
const Store = require('../models/Store');
const Product = require('../models/Product');
const StoreProductPricing = require('../models/StoreProductPricing');
const Order = require('../models/Order');
const Delivery = require('../models/Delivery');
const Service = require('../models/Service');
const ServiceArea = require('../models/ServiceArea');
const Franchise = require('../models/Franchise');
const FranchiseNotification = require('../models/FranchiseNotification');
const { buildCategorySeedDocs } = require('./japtoCategories');

const SEED_LOCATIONS = [
  { pincode: '201301', area: 'Sector 62, Noida', city: 'Noida', state: 'Uttar Pradesh', lat: 28.6280, lng: 77.3649, storesCount: 5, tag: 'HQ HUB', isDefault: true, displayOrder: 0 },
  { pincode: '201301', area: 'Sector 18 Atta Market', city: 'Noida', state: 'Uttar Pradesh', lat: 28.5708, lng: 77.3271, storesCount: 6, tag: 'POPULAR', displayOrder: 1 },
  { pincode: '110001', area: 'Connaught Place, Central Delhi', city: 'New Delhi', state: 'Delhi', lat: 28.6304, lng: 77.2177, storesCount: 4, tag: 'METRO', displayOrder: 2 },
  { pincode: '560038', area: 'Indiranagar 100ft Road', city: 'Bengaluru', state: 'Karnataka', lat: 12.9784, lng: 77.6408, storesCount: 4, tag: 'FASTEST', displayOrder: 3 },
  { pincode: '400050', area: 'Bandra West (Linking Road)', city: 'Mumbai', state: 'Maharashtra', lat: 19.0596, lng: 72.8295, storesCount: 4, tag: 'COASTAL', displayOrder: 4 },
  { pincode: '500081', area: 'HITEC City / Madhapur', city: 'Hyderabad', state: 'Telangana', lat: 17.4474, lng: 78.3762, storesCount: 4, tag: 'CYBER', displayOrder: 5 }
];

const SEED_SERVICES = [
  {
    name: 'Expert Home Plumber & Leakage Repair', category: 'plumbing', visitCharge: 149, rating: 4.8, reviews: 142,
    photoUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500&auto=format&fit=crop&q=80',
    description: 'Tap repair, pipe fitting, water tank cleaning, and bathroom sanitary installations.',
    provider: { name: 'Manoj Kumar', phone: '9811883322', experienceYears: 7, badge: 'Verified Master Plumber', photoUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&auto=format&fit=crop&q=80' }
  },
  {
    name: 'Certified Electrician & Wiring Master', category: 'electrical', visitCharge: 149, rating: 4.7, reviews: 210,
    photoUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=80',
    description: 'Switchboard installation, inverter setup, short circuit repair, and fan fitting.',
    provider: { name: 'Deepak Verma', phone: '9822994411', experienceYears: 5, badge: 'Government Certified', photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80' }
  },
  {
    name: 'Split AC Gas Refill & Repair', category: 'ac', visitCharge: 299, rating: 4.9, reviews: 268,
    photoUrl: 'https://images.unsplash.com/photo-1631545806609-6b729a4f2c91?w=500&auto=format&fit=crop&q=80',
    description: 'Gas charging, PCB repair, water leakage fix, and deep AC coil cleaning at home.',
    provider: { name: 'Amit Joshi', phone: '9811007788', experienceYears: 8, badge: 'AC Specialist', photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80' }
  },
  {
    name: 'Deep Home Cleaning (2BHK / 3BHK)', category: 'cleaning', visitCharge: 499, rating: 4.8, reviews: 410,
    photoUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500&auto=format&fit=crop&q=80',
    description: 'Kitchen degreasing, bathroom sanitization, floor mopping, and dusting by trained crew.',
    provider: { name: 'CleanPro Team', phone: '9899001122', experienceYears: 6, badge: 'Hygiene Certified', photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80' }
  },
  {
    name: 'Washing Machine & Fridge Repair', category: 'appliance', visitCharge: 199, rating: 4.6, reviews: 175,
    photoUrl: 'https://images.unsplash.com/photo-1626806787461-525c69443b34?w=500&auto=format&fit=crop&q=80',
    description: 'Drum issues, motor repair, cooling faults, and thermostat replacement for major brands.',
    provider: { name: 'Ravi Singh', phone: '9877112233', experienceYears: 9, badge: 'Multi-Brand Expert', photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80' }
  },
  {
    name: 'Carpenter & Furniture Repair / Assembly', category: 'carpentry', visitCharge: 199, rating: 4.9, reviews: 185,
    photoUrl: 'https://images.unsplash.com/photo-1580481077197-28564f513904?w=500&auto=format&fit=crop&q=80',
    description: 'Chair repair, wardrobe lock fitting, door alignment, and custom furniture assembly.',
    provider: { name: 'Ramprasad Sharma', phone: '9811442211', experienceYears: 10, badge: 'Top Rated Carpenter', photoUrl: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=100&auto=format&fit=crop&q=80' }
  },
  {
    name: 'Home Salon & Beautician for Women', category: 'beauty', visitCharge: 249, rating: 4.9, reviews: 320,
    photoUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500&auto=format&fit=crop&q=80',
    description: 'Facial, cleanup, waxing, pedicure, threading, and party makeup at your doorstep.',
    provider: { name: 'Sneha Arora', phone: '9833771100', experienceYears: 6, badge: 'Certified Cosmetologist', photoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80' }
  }
];

const SEED_STORES = [
  {
    seedKey: 'store-1',
    name: 'Gupta General & Kirana Store',
    ownerPhone: '9811223344',
    ownerName: 'Ramesh Gupta',
    phone: '9811223344',
    rating: 4.8,
    reviewsCount: 342,
    estDeliveryMins: 20,
    baseDeliveryFee: 20,
    freeDeliveryAbove: 300,
    address: 'Shop 12, Main Market, Sector 62, Noida',
    pincode: '201301',
    city: 'Noida',
    lat: 28.6280,
    lng: 77.3649,
    photoUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '08:00 AM - 10:30 PM'
  },
  {
    seedKey: 'store-2',
    name: 'City Super Mart & Essentials',
    ownerPhone: '9822334455',
    ownerName: 'Vikas Agarwal',
    phone: '9822334455',
    rating: 4.6,
    reviewsCount: 520,
    estDeliveryMins: 25,
    baseDeliveryFee: 0,
    freeDeliveryAbove: 0,
    address: 'Plot 45, Central Avenue, Sector 62, Noida',
    pincode: '201301',
    city: 'Noida',
    lat: 28.6310,
    lng: 77.3710,
    photoUrl: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '07:30 AM - 11:00 PM'
  },
  {
    seedKey: 'store-3',
    name: 'Fresh Express Farm Vegetables',
    ownerPhone: '9833445566',
    ownerName: 'Suresh Yadav',
    phone: '9833445566',
    rating: 4.9,
    reviewsCount: 198,
    estDeliveryMins: 30,
    baseDeliveryFee: 10,
    freeDeliveryAbove: 200,
    address: 'Shop 4, Sabzi Mandi Road, Sector 63, Noida',
    pincode: '201301',
    city: 'Noida',
    lat: 28.6250,
    lng: 77.3800,
    photoUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '06:00 AM - 09:00 PM'
  },
  {
    seedKey: 'store-4',
    name: 'Verma Stationery & Book Point',
    ownerPhone: '9844556677',
    ownerName: 'Sunil Verma',
    phone: '9844556677',
    rating: 4.7,
    reviewsCount: 260,
    estDeliveryMins: 15,
    baseDeliveryFee: 15,
    freeDeliveryAbove: 250,
    address: 'Near Tech Park Gate 2, Sector 62, Noida',
    pincode: '201301',
    city: 'Noida',
    lat: 28.6295,
    lng: 77.3680,
    photoUrl: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '09:00 AM - 09:30 PM'
  },
  {
    seedKey: 'store-5',
    name: 'Bhatia Hardware & Sanitary Store',
    ownerPhone: '9855667788',
    ownerName: 'Harish Bhatia',
    phone: '9855667788',
    rating: 4.8,
    reviewsCount: 180,
    estDeliveryMins: 25,
    baseDeliveryFee: 25,
    freeDeliveryAbove: 500,
    address: 'Shop 22, Building Material Market, Sector 63, Noida',
    pincode: '201301',
    city: 'Noida',
    lat: 28.6320,
    lng: 77.3750,
    photoUrl: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '08:30 AM - 08:30 PM'
  },
  {
    seedKey: 'store-6',
    name: 'Royal Comfort Chairs & Furniture',
    ownerPhone: '9866778899',
    ownerName: 'Anil Chawla',
    phone: '9866778899',
    rating: 4.7,
    reviewsCount: 145,
    estDeliveryMins: 35,
    baseDeliveryFee: 40,
    freeDeliveryAbove: 1000,
    address: 'Furniture Hub, Sector 62 Commercial Complex, Noida',
    pincode: '201301',
    city: 'Noida',
    lat: 28.6350,
    lng: 77.3620,
    photoUrl: 'https://images.unsplash.com/photo-1580481077197-28564f513904?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '10:00 AM - 09:00 PM'
  },
  {
    seedKey: 'store-7',
    name: 'Glamour Beauty & Cosmetics Hub',
    ownerPhone: '9877889900',
    ownerName: 'Priya Kapoor',
    phone: '9877889900',
    rating: 4.9,
    reviewsCount: 310,
    estDeliveryMins: 15,
    baseDeliveryFee: 15,
    freeDeliveryAbove: 400,
    address: 'Shop 5, Galleria Mall, Sector 62, Noida',
    pincode: '201301',
    city: 'Noida',
    lat: 28.6270,
    lng: 77.3660,
    photoUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '10:00 AM - 09:30 PM'
  },
  {
    seedKey: 'store-blr-1',
    name: 'Kaveri Super Mart & Groceries',
    ownerPhone: '9845112233',
    ownerName: 'Venkatesh Rao',
    phone: '9845112233',
    rating: 4.8,
    reviewsCount: 420,
    estDeliveryMins: 18,
    baseDeliveryFee: 15,
    freeDeliveryAbove: 300,
    address: '100ft Road, Near KFC Junction, Indiranagar, Bengaluru',
    pincode: '560038',
    city: 'Bengaluru',
    lat: 12.9780,
    lng: 77.6410,
    photoUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '07:30 AM - 10:30 PM'
  },
  {
    seedKey: 'store-blr-2',
    name: "Namdhari's Fresh Farm Produce",
    ownerPhone: '9845223344',
    ownerName: 'Karthik Gowda',
    phone: '9845223344',
    rating: 4.9,
    reviewsCount: 380,
    estDeliveryMins: 20,
    baseDeliveryFee: 10,
    freeDeliveryAbove: 250,
    address: '12th Main Road, HAL 2nd Stage, Indiranagar, Bengaluru',
    pincode: '560038',
    city: 'Bengaluru',
    lat: 12.9795,
    lng: 77.6390,
    photoUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '06:30 AM - 09:30 PM'
  },
  {
    seedKey: 'store-blr-3',
    name: 'Sapna Book House & Stationery Hub',
    ownerPhone: '9845334455',
    ownerName: 'M. S. Murthy',
    phone: '9845334455',
    rating: 4.7,
    reviewsCount: 290,
    estDeliveryMins: 22,
    baseDeliveryFee: 20,
    freeDeliveryAbove: 350,
    address: 'CMH Road, Metro Pillar 84, Indiranagar, Bengaluru',
    pincode: '560038',
    city: 'Bengaluru',
    lat: 12.9770,
    lng: 77.6425,
    photoUrl: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '09:00 AM - 09:00 PM'
  },
  {
    seedKey: 'store-blr-4',
    name: 'Indiranagar Tools & Electricals',
    ownerPhone: '9845445566',
    ownerName: 'Naveen Kumar',
    phone: '9845445566',
    rating: 4.8,
    reviewsCount: 175,
    estDeliveryMins: 25,
    baseDeliveryFee: 25,
    freeDeliveryAbove: 500,
    address: 'Double Road, Indiranagar 2nd Stage, Bengaluru',
    pincode: '560038',
    city: 'Bengaluru',
    lat: 12.9760,
    lng: 77.6400,
    photoUrl: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '08:30 AM - 08:30 PM'
  },
  {
    seedKey: 'store-blr-5',
    name: 'Urban Comfort Chairs & Furniture',
    ownerPhone: '9845556677',
    ownerName: 'Rohan Deshmukh',
    phone: '9845556677',
    rating: 4.7,
    reviewsCount: 130,
    estDeliveryMins: 30,
    baseDeliveryFee: 40,
    freeDeliveryAbove: 1000,
    address: '80ft Road, 4th Block, Koramangala, Bengaluru',
    pincode: '560034',
    city: 'Bengaluru',
    lat: 12.9360,
    lng: 77.6250,
    photoUrl: 'https://images.unsplash.com/photo-1580481077197-28564f513904?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '10:00 AM - 09:00 PM'
  },
  {
    seedKey: 'store-del-1',
    name: 'Central Delhi Mega Mart',
    ownerPhone: '9811334411',
    ownerName: 'Rajinder Singhal',
    phone: '9811334411',
    rating: 4.8,
    reviewsCount: 610,
    estDeliveryMins: 18,
    baseDeliveryFee: 20,
    freeDeliveryAbove: 350,
    address: 'Connaught Circus, Block B, Connaught Place, New Delhi',
    pincode: '110001',
    city: 'New Delhi',
    lat: 28.6310,
    lng: 77.2185,
    photoUrl: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '08:00 AM - 10:30 PM'
  },
  {
    seedKey: 'store-del-2',
    name: 'Green Valley Fresh Veggies & Fruits',
    ownerPhone: '9811445522',
    ownerName: 'Jagdish Mehra',
    phone: '9811445522',
    rating: 4.9,
    reviewsCount: 340,
    estDeliveryMins: 20,
    baseDeliveryFee: 10,
    freeDeliveryAbove: 200,
    address: 'Barakhamba Road, Near Metro Gate 3, Connaught Place, New Delhi',
    pincode: '110001',
    city: 'New Delhi',
    lat: 28.6295,
    lng: 77.2220,
    photoUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '07:00 AM - 09:30 PM'
  },
  {
    seedKey: 'store-del-3',
    name: 'Oxford Stationery & Fine Art Supplies',
    ownerPhone: '9811556633',
    ownerName: 'Naveen Aggarwal',
    phone: '9811556633',
    rating: 4.8,
    reviewsCount: 420,
    estDeliveryMins: 22,
    baseDeliveryFee: 15,
    freeDeliveryAbove: 300,
    address: 'Janpath Lane, Opposite Cottage Emporium, New Delhi',
    pincode: '110001',
    city: 'New Delhi',
    lat: 28.6280,
    lng: 77.2190,
    photoUrl: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '09:30 AM - 09:00 PM'
  },
  {
    seedKey: 'store-del-4',
    name: 'Capital Hardware & Sanitary Mart',
    ownerPhone: '9811667744',
    ownerName: 'Gurpreet Singh',
    phone: '9811667744',
    rating: 4.7,
    reviewsCount: 195,
    estDeliveryMins: 25,
    baseDeliveryFee: 25,
    freeDeliveryAbove: 500,
    address: 'Main Bazar Road, Near CP Outpost, New Delhi',
    pincode: '110001',
    city: 'New Delhi',
    lat: 28.6340,
    lng: 77.2140,
    photoUrl: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '09:00 AM - 08:30 PM'
  },
  {
    seedKey: 'store-mum-1',
    name: 'Hill Road Gourmet & Supermart',
    ownerPhone: '9820112233',
    ownerName: 'Farhan Merchant',
    phone: '9820112233',
    rating: 4.9,
    reviewsCount: 580,
    estDeliveryMins: 18,
    baseDeliveryFee: 15,
    freeDeliveryAbove: 350,
    address: 'Hill Road, Near Elco Market, Bandra West, Mumbai',
    pincode: '400050',
    city: 'Mumbai',
    lat: 19.0590,
    lng: 72.8300,
    photoUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '07:30 AM - 10:30 PM'
  },
  {
    seedKey: 'store-mum-2',
    name: 'Pali Hill Fresh Greens & Organic Store',
    ownerPhone: '9820223344',
    ownerName: 'Sameer Sawant',
    phone: '9820223344',
    rating: 4.8,
    reviewsCount: 310,
    estDeliveryMins: 20,
    baseDeliveryFee: 10,
    freeDeliveryAbove: 200,
    address: 'Pali Mala Road, Off Pali Hill, Bandra West, Mumbai',
    pincode: '400050',
    city: 'Mumbai',
    lat: 19.0620,
    lng: 72.8280,
    photoUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '06:30 AM - 09:30 PM'
  },
  {
    seedKey: 'store-mum-3',
    name: 'Suburban Stationery & Art Corner',
    ownerPhone: '9820334455',
    ownerName: 'Chetan Shah',
    phone: '9820334455',
    rating: 4.7,
    reviewsCount: 240,
    estDeliveryMins: 22,
    baseDeliveryFee: 20,
    freeDeliveryAbove: 300,
    address: 'Linking Road, Near Khar Telephone Exch, Bandra West, Mumbai',
    pincode: '400050',
    city: 'Mumbai',
    lat: 19.0610,
    lng: 72.8320,
    photoUrl: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '09:00 AM - 09:00 PM'
  },
  {
    seedKey: 'store-mum-4',
    name: 'Powai Hardware & Home Essentials',
    ownerPhone: '9820445566',
    ownerName: 'Manish Joshi',
    phone: '9820445566',
    rating: 4.8,
    reviewsCount: 180,
    estDeliveryMins: 25,
    baseDeliveryFee: 25,
    freeDeliveryAbove: 500,
    address: 'Galleria Shopping Mall, Hiranandani Gardens, Powai, Mumbai',
    pincode: '400076',
    city: 'Mumbai',
    lat: 19.1180,
    lng: 72.9070,
    photoUrl: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '09:00 AM - 08:30 PM'
  },
  {
    seedKey: 'store-hyd-1',
    name: 'Cyber Mart & Daily Essentials',
    ownerPhone: '9848112233',
    ownerName: 'Srinivas Reddy',
    phone: '9848112233',
    rating: 4.8,
    reviewsCount: 470,
    estDeliveryMins: 18,
    baseDeliveryFee: 15,
    freeDeliveryAbove: 300,
    address: 'Madhapur Main Road, Near Cyber Towers, HITEC City, Hyderabad',
    pincode: '500081',
    city: 'Hyderabad',
    lat: 17.4480,
    lng: 78.3770,
    photoUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '07:30 AM - 10:30 PM'
  },
  {
    seedKey: 'store-hyd-2',
    name: 'Deccan Fresh Farm Vegetables',
    ownerPhone: '9848223344',
    ownerName: 'Mohd. Rizwan',
    phone: '9848223344',
    rating: 4.9,
    reviewsCount: 310,
    estDeliveryMins: 20,
    baseDeliveryFee: 10,
    freeDeliveryAbove: 200,
    address: 'Inorbit Mall Road, Mindspace Circle, HITEC City, Hyderabad',
    pincode: '500081',
    city: 'Hyderabad',
    lat: 17.4450,
    lng: 78.3750,
    photoUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '06:30 AM - 09:30 PM'
  },
  {
    seedKey: 'store-hyd-3',
    name: 'Cyber Stationery & IT Office Supplies',
    ownerPhone: '9848334455',
    ownerName: 'G. Venkat Rao',
    phone: '9848334455',
    rating: 4.7,
    reviewsCount: 220,
    estDeliveryMins: 25,
    baseDeliveryFee: 20,
    freeDeliveryAbove: 350,
    address: 'Kondapur Cross Road, Near Botanical Garden, Hyderabad',
    pincode: '500084',
    city: 'Hyderabad',
    lat: 17.4520,
    lng: 78.3790,
    photoUrl: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=500&auto=format&fit=crop&q=80',
    isOnline: true,
    pickupAvailable: true,
    openingTime: '09:00 AM - 09:00 PM'
  }
];

const SEED_PRODUCTS = [
  {
    name: 'Maggi 2-Minute Masala Instant Noodles',
    categorySlug: 'grocery-daily-needs',
    subcategorySlug: 'grocery-daily-needs--packaged-and-instant-food',
    brand: 'Nestle',
    mrp: 15,
    unit: '70g Pack',
    rating: 4.8,
    reviewsCount: 1250,
    photoUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500&auto=format&fit=crop&q=80',
    description: 'Instant noodles with special tastemaker spices. Ready in 2 minutes.',
    stores: [
      { storeKey: 'store-1', price: 12, stock: 50 },
      { storeKey: 'store-2', price: 14, stock: 120 }
    ]
  },
  {
    name: 'Amul Taaza Homogenised Toned Milk',
    categorySlug: 'sweets-bakery-dairy',
    subcategorySlug: 'sweets-bakery-dairy--milk-and-curd',
    brand: 'Amul',
    mrp: 68,
    unit: '1 Litre Tetra Pack',
    rating: 4.9,
    reviewsCount: 890,
    photoUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80',
    description: 'Pasteurised toned milk with 3.0% fat. Long shelf life, no boiling required.',
    stores: [
      { storeKey: 'store-1', price: 65, stock: 30 },
      { storeKey: 'store-2', price: 64, stock: 45 }
    ]
  },
  {
    name: 'Fortune Sunlite Refined Sunflower Oil',
    categorySlug: 'grocery-daily-needs',
    subcategorySlug: 'grocery-daily-needs--edible-oil-and-ghee',
    brand: 'Fortune',
    mrp: 145,
    unit: '1 Litre Pouch',
    rating: 4.7,
    reviewsCount: 640,
    photoUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80',
    description: 'Light and healthy edible cooking oil enriched with vitamins A & D.',
    stores: [
      { storeKey: 'store-1', price: 128, stock: 25 },
      { storeKey: 'store-2', price: 130, stock: 40 }
    ]
  },
  {
    name: 'Bosch Professional Impact Drill Machine 550W',
    categorySlug: 'hardware-electrical',
    subcategorySlug: 'hardware-electrical--power-tools',
    brand: 'Bosch',
    mrp: 2999,
    unit: '1 Set (13mm Chuck)',
    rating: 4.8,
    reviewsCount: 320,
    photoUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=500&auto=format&fit=crop&q=80',
    description: 'Heavy duty impact drill for concrete, wood, and metal drilling with reversible rotation.',
    stores: [
      { storeKey: 'store-5', price: 2450, stock: 15 },
      { storeKey: 'store-2', price: 2599, stock: 8 }
    ]
  },
  {
    name: 'Stanley Precision Screwdriver & Tool Set (31 Pcs)',
    categorySlug: 'hardware-electrical',
    subcategorySlug: 'hardware-electrical--hand-tools',
    brand: 'Stanley',
    mrp: 750,
    unit: '31 in 1 Kit',
    rating: 4.7,
    reviewsCount: 410,
    photoUrl: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=500&auto=format&fit=crop&q=80',
    description: 'Magnetic multi-bit precision screwdriver kit for household repairs and electronics.',
    stores: [
      { storeKey: 'store-5', price: 540, stock: 35 },
      { storeKey: 'store-1', price: 590, stock: 12 }
    ]
  },
  {
    name: 'Asian Paints Apex Exterior Waterproof Paint 4L',
    categorySlug: 'hardware-electrical',
    subcategorySlug: 'hardware-electrical--paint-and-brushes',
    brand: 'Asian Paints',
    mrp: 1450,
    unit: '4 Litres Bucket',
    rating: 4.9,
    reviewsCount: 210,
    photoUrl: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=500&auto=format&fit=crop&q=80',
    description: 'All-weather waterproof exterior wall paint with anti-fungal protection.',
    stores: [
      { storeKey: 'store-5', price: 1199, stock: 20 }
    ]
  },
  {
    name: 'High-Back Ergonomic Office Chair with Lumbar Support',
    categorySlug: 'furniture-home-furnishing',
    subcategorySlug: 'furniture-home-furnishing--chairs',
    brand: 'Green Soul',
    mrp: 8999,
    unit: '1 Piece (Breathable Mesh)',
    rating: 4.8,
    reviewsCount: 580,
    photoUrl: 'https://images.unsplash.com/photo-1580481077197-28564f513904?w=500&auto=format&fit=crop&q=80',
    description: 'Adjustable height, tilt-lock mechanism, soft armrests for work-from-home comfort.',
    stores: [
      { storeKey: 'store-6', price: 5499, stock: 10 },
      { storeKey: 'store-2', price: 5899, stock: 5 }
    ]
  },
  {
    name: 'Nilkamal Premium Heavy-Duty Plastic Arm Chair',
    categorySlug: 'furniture-home-furnishing',
    subcategorySlug: 'furniture-home-furnishing--chairs',
    brand: 'Nilkamal',
    mrp: 1100,
    unit: 'Pack of 1 (Marble Beige)',
    rating: 4.6,
    reviewsCount: 430,
    photoUrl: 'https://images.unsplash.com/photo-1503602642458-232111445657?w=500&auto=format&fit=crop&q=80',
    description: 'Durable weather-resistant molded plastic chair for balcony, lawn, or study room.',
    stores: [
      { storeKey: 'store-6', price: 799, stock: 40 },
      { storeKey: 'store-1', price: 850, stock: 15 }
    ]
  },
  {
    name: 'Multi-Purpose Folding Bed & Study Table with Cup Holder',
    categorySlug: 'furniture-home-furnishing',
    subcategorySlug: 'furniture-home-furnishing--study-tables',
    brand: 'Royal Wood',
    mrp: 999,
    unit: '1 Table (60x40 cm)',
    rating: 4.7,
    reviewsCount: 720,
    photoUrl: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=500&auto=format&fit=crop&q=80',
    description: 'Portable wooden bed laptop desk with tablet slot and non-slip metal legs.',
    stores: [
      { storeKey: 'store-6', price: 449, stock: 30 },
      { storeKey: 'store-4', price: 499, stock: 20 }
    ]
  },
  {
    name: 'Maybelline New York Super Stay Matte Ink Lipstick',
    categorySlug: 'beauty-personal-care',
    subcategorySlug: 'beauty-personal-care--makeup-and-cosmetics',
    brand: 'Maybelline',
    mrp: 699,
    unit: '5ml (Rendezvous Pink)',
    rating: 4.9,
    reviewsCount: 840,
    photoUrl: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=500&auto=format&fit=crop&q=80',
    description: '16-hour long-lasting waterproof liquid matte lipstick with intense pigmentation.',
    stores: [
      { storeKey: 'store-7', price: 489, stock: 25 },
      { storeKey: 'store-2', price: 520, stock: 15 }
    ]
  },
  {
    name: 'Lakme Absolute Skin Gloss Gel Face Cream',
    categorySlug: 'beauty-personal-care',
    subcategorySlug: 'beauty-personal-care--face-wash-and-cream',
    brand: 'Lakme',
    mrp: 450,
    unit: '50g Jar',
    rating: 4.7,
    reviewsCount: 510,
    photoUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500&auto=format&fit=crop&q=80',
    description: 'Hydrating non-greasy day gel cream with mineral moisture for glowing skin.',
    stores: [
      { storeKey: 'store-7', price: 349, stock: 30 },
      { storeKey: 'store-1', price: 375, stock: 18 }
    ]
  },
  {
    name: "L'Oreal Paris Total Repair 5 Shampoo & Keratin XS",
    categorySlug: 'beauty-personal-care',
    subcategorySlug: 'beauty-personal-care--shampoo-and-conditioner',
    brand: "L'Oreal",
    mrp: 499,
    unit: '650ml Bottle',
    rating: 4.8,
    reviewsCount: 960,
    photoUrl: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&auto=format&fit=crop&q=80',
    description: 'Damage repair shampoo tackling hair fall, dryness, roughness, dullness and split ends.',
    stores: [
      { storeKey: 'store-7', price: 389, stock: 45 },
      { storeKey: 'store-2', price: 410, stock: 25 }
    ]
  },
  {
    name: 'Classmate Pulse 6-Subject Spiral Notebook',
    categorySlug: 'stationery-office',
    subcategorySlug: 'stationery-office--notebooks-and-registers',
    brand: 'Classmate',
    mrp: 190,
    unit: '300 Pages (Single Line)',
    rating: 4.8,
    reviewsCount: 540,
    photoUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=80',
    description: 'Premium quality paper with subject partition tabs for college and office note-taking.',
    stores: [
      { storeKey: 'store-4', price: 155, stock: 40 },
      { storeKey: 'store-2', price: 165, stock: 25 }
    ]
  },
  {
    name: 'Fresh Hybrid Red Tomatoes',
    categorySlug: 'fruits-vegetables',
    subcategorySlug: 'fruits-vegetables--fresh-vegetables',
    brand: 'Farm Fresh',
    mrp: 40,
    unit: '1 kg',
    rating: 4.8,
    reviewsCount: 310,
    photoUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=80',
    description: 'Locally grown crisp and juicy fresh red tomatoes delivered fresh every morning.',
    stores: [
      { storeKey: 'store-3', price: 28, stock: 60 },
      { storeKey: 'store-1', price: 32, stock: 20 }
    ]
  }
];

const seed = async () => {
  try {
    await connectDB();

    console.log('Clearing existing collections...');
    await Promise.all([
      Delivery.deleteMany({}),
      Order.deleteMany({}),
      StoreProductPricing.deleteMany({}),
      Product.deleteMany({}),
      Store.deleteMany({}),
      Category.deleteMany({}),
      Service.deleteMany({}),
      ServiceArea.deleteMany({}),
      FranchiseNotification.deleteMany({}),
      Franchise.deleteMany({}),
      User.deleteMany({})
    ]);

    const passwordHash = await bcrypt.hash('password123', 10);

    console.log('Seeding users...');
    const customer = await User.create({
      name: 'Demo Customer',
      phone: '9999900001',
      email: 'customer@hyperlocal.test',
      password: passwordHash,
      role: 'customer',
      status: 'approved',
      addresses: [{
        tag: 'Home',
        flatBuilding: 'Tower A, Flat 1204',
        streetArea: 'Sector 62',
        pincode: '201301',
        city: 'Noida',
        lat: 28.6280,
        lng: 77.3649,
        isDefault: true
      }]
    });

    const driver = await User.create({
      name: 'Rahul Sharma',
      phone: '9811009988',
      email: 'driver@hyperlocal.test',
      password: passwordHash,
      role: 'driver',
      status: 'approved',
      vehicleType: 'Hero Splendor (Bike)',
      plateNumber: 'DL 3S AB 1234',
      licenseNo: 'DL-0420110147820',
      city: 'Sector 62, Noida',
      isOnline: true,
      todayEarnings: 0,
      completedDeliveries: 0,
      rating: 4.9
    });

    await User.create({
      name: 'Amit Kumar',
      phone: '9822338877',
      email: 'amit.driver@hyperlocal.test',
      password: passwordHash,
      role: 'driver',
      status: 'approved',
      vehicleType: 'Honda Activa (Scooter)',
      plateNumber: 'UP 16 DX 5544',
      licenseNo: 'UP-1620180099123',
      city: 'Noida',
      isOnline: true,
      todayEarnings: 340,
      completedDeliveries: 4,
      rating: 4.9
    });

    await User.create({
      name: 'Sunil Verma',
      phone: '9833449911',
      email: 'sunil.driver@hyperlocal.test',
      password: passwordHash,
      role: 'driver',
      status: 'approved',
      vehicleType: 'Bajaj Pulsar (Bike)',
      plateNumber: 'DL 7S EF 9012',
      licenseNo: 'DL-0720190088456',
      city: 'Delhi NCR',
      isOnline: true,
      todayEarnings: 210,
      completedDeliveries: 3,
      rating: 4.8
    });

    // Pending rider KYC for Super Admin testing
    await User.create({
      name: 'Vicky Kashyap',
      phone: '9811447788',
      email: 'vicky.pending@hyperlocal.test',
      password: passwordHash,
      role: 'driver',
      status: 'pending',
      vehicleType: 'Hero Splendor (Bike)',
      plateNumber: 'UP 16 DX 9876',
      licenseNo: 'DL-UP16-2022001928',
      aadhaarNo: 'XXXX-XXXX-4812',
      city: 'Sector 62, Noida',
      isOnline: false,
      rating: 5.0
    });

    const superadmin = await User.create({
      name: 'Platform Super Admin',
      phone: '9999900000',
      email: 'admin@hyperlocal.test',
      password: passwordHash,
      role: 'superadmin',
      status: 'approved'
    });

    console.log('Seeding franchise...');
    const franchiseDoc = await Franchise.create({
      applicationId: 'JAPTO-FR-2026-0001',
      name: 'Jhansi City Franchise',
      ownerName: 'Ramesh Franchise',
      phone: '9811776655',
      email: 'franchise@hyperlocal.test',
      city: 'Jhansi',
      state: 'UP',
      pincode: '284001',
      pinCodes: ['284001', '284002'],
      houseNo: '12',
      streetArea: 'Civil Lines',
      address: '12, Civil Lines, Jhansi, UP, 284001',
      businessExperience: 'experienced',
      message: 'Ready to operate Jhansi PINs',
      promoters: [{ name: 'Suresh', phone: '9811001122' }],
      franchiseFee: 350000,
      gstAmount: 63000,
      deliveryCommissionPct: 5,
      bankAccountHolder: 'Ramesh Franchise',
      bankAccountNumber: '123456789012',
      bankIfsc: 'SBIN0001234',
      feeNonRefundable: true,
      agreementYears: 5,
      status: 'approved',
      isActive: true,
      commissionLedger: [
        {
          amount: 2400,
          note: 'Week commission',
          weekOf: new Date().toISOString().slice(0, 10),
          status: 'paid',
          at: new Date()
        },
        {
          amount: 1800,
          note: 'Pending week',
          weekOf: new Date().toISOString().slice(0, 10),
          status: 'pending',
          at: new Date()
        }
      ],
      paymentHistory: [
        { amount: 2400, note: 'Weekly payout', status: 'paid', paidAt: new Date() }
      ]
    });

    const franchiseUser = await User.create({
      name: 'Ramesh Franchise',
      phone: '9811776655',
      email: 'franchise@hyperlocal.test',
      password: passwordHash,
      role: 'franchise',
      status: 'approved',
      franchiseId: franchiseDoc._id,
      city: 'Jhansi',
      fullAddress: franchiseDoc.address
    });
    franchiseDoc.ownerUserId = franchiseUser._id;
    await franchiseDoc.save();

    await FranchiseNotification.create({
      franchiseId: franchiseDoc._id,
      type: 'notice',
      title: 'Welcome to Japto Franchise',
      body: 'Head Office notices will appear here.'
    });

    // Link demo rider to franchise city for overview counts
    await User.findByIdAndUpdate(driver._id, { franchiseId: franchiseDoc._id, city: 'Jhansi' });

    console.log('Seeding Japto category master (main + subcategories)...');
    const { mains, subs } = buildCategorySeedDocs();
    const mainDocs = await Category.insertMany(mains);
    const mainBySlug = Object.fromEntries(mainDocs.map((c) => [c.slug, c]));
    const subDocs = await Category.insertMany(
      subs.map((s) => ({
        name: s.name,
        slug: s.slug,
        iconEmoji: s.iconEmoji,
        photoUrl: s.photoUrl,
        displayOrder: s.displayOrder,
        parentId: mainBySlug[s.mainSlug]._id,
        isActive: true,
        requiresLicence: s.requiresLicence
      }))
    );
    const categories = [...mainDocs, ...subDocs];
    const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

    console.log('Seeding store owners & stores...');
    const storeIdByKey = {};

    for (const storeData of SEED_STORES) {
      const owner = await User.create({
        name: storeData.ownerName,
        phone: storeData.ownerPhone,
        email: `${storeData.seedKey}@hyperlocal.test`,
        password: passwordHash,
        role: 'store_owner',
        status: 'approved'
      });

      const store = await Store.create({
        name: storeData.name,
        ownerId: owner._id,
        phone: storeData.phone,
        photoUrl: storeData.photoUrl,
        address: storeData.address,
        pincode: storeData.pincode,
        city: storeData.city,
        location: {
          type: 'Point',
          coordinates: [storeData.lng, storeData.lat]
        },
        baseDeliveryFee: storeData.baseDeliveryFee,
        freeDeliveryAbove: storeData.freeDeliveryAbove,
        estDeliveryMins: storeData.estDeliveryMins,
        pickupAvailable: storeData.pickupAvailable,
        rating: storeData.rating,
        reviewsCount: storeData.reviewsCount,
        isOnline: storeData.isOnline,
        status: 'approved',
        openingTime: storeData.openingTime,
        ownerName: storeData.ownerName,
        category: 'grocery'
      });

      storeIdByKey[storeData.seedKey] = store._id;
    }

    console.log('Seeding products & multi-store pricing...');
    let pricingCount = 0;

    for (const productData of SEED_PRODUCTS) {
      const category = categoryBySlug[productData.categorySlug];
      const subcategory = categoryBySlug[productData.subcategorySlug];
      if (!category) {
        throw new Error(`Missing category for slug: ${productData.categorySlug}`);
      }
      if (!subcategory) {
        throw new Error(`Missing subcategory for slug: ${productData.subcategorySlug}`);
      }

      const product = await Product.create({
        categoryId: category._id,
        subcategoryId: subcategory._id,
        name: productData.name,
        brand: productData.brand,
        unit: productData.unit,
        description: productData.description,
        photoUrl: productData.photoUrl,
        photos: [productData.photoUrl],
        mrp: productData.mrp,
        rating: productData.rating,
        reviewsCount: productData.reviewsCount,
        isActive: true,
        status: 'active'
      });

      for (const pricing of productData.stores) {
        const storeId = storeIdByKey[pricing.storeKey];
        if (!storeId) {
          throw new Error(`Missing store for key: ${pricing.storeKey}`);
        }

        await StoreProductPricing.create({
          storeId,
          productId: product._id,
          price: pricing.price,
          stockQuantity: pricing.stock,
          isAvailable: true
        });
        pricingCount += 1;
      }
    }

    console.log('Seeding home services...');
    const services = await Service.insertMany(
      SEED_SERVICES.map((s) => ({ ...s, city: 'Noida', isActive: true, status: 'approved' }))
    );

    console.log('Seeding service areas / locations...');
    const locations = await ServiceArea.insertMany(
      SEED_LOCATIONS.map((l) => ({ ...l, isActive: true }))
    );

    // Pending store KYC for Super Admin testing
    const pendingOwner = await User.create({
      name: 'Sunil Sharma',
      phone: '9899112233',
      email: 'pending.store@hyperlocal.test',
      password: passwordHash,
      role: 'store_owner',
      status: 'pending'
    });
    await Store.create({
      name: 'Sharma Sweets & Dairy',
      ownerId: pendingOwner._id,
      ownerName: 'Sunil Sharma',
      phone: '9899112233',
      photoUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&auto=format&fit=crop&q=80',
      address: 'Shop 8, Sector 62 Market, Noida',
      pincode: '201301',
      city: 'Noida',
      location: { type: 'Point', coordinates: [77.3649, 28.628] },
      gstin: '09AAAAA0000A1Z5',
      fssai: '12723000000123',
      category: 'grocery',
      status: 'pending',
      isOnline: false
    });

    console.log('\n✅ Seed completed successfully');
    console.log(`   Categories: ${mainDocs.length} main + ${subDocs.length} sub = ${categories.length}`);
    console.log(`   Stores: ${Object.keys(storeIdByKey).length} (+1 pending KYC)`);
    console.log(`   Products: ${SEED_PRODUCTS.length}`);
    console.log(`   Pricing rows: ${pricingCount}`);
    console.log(`   Services: ${services.length}`);
    console.log(`   Locations: ${locations.length}`);
    console.log(`   Users: customer=${customer.phone}, driver=${driver.phone}, admin=${superadmin.phone}`);
    console.log('   Logins require OTP (no shared demo password on the login UI).');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
};

seed();
