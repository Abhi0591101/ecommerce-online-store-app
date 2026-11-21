# Master Product Requirements Document (PRD)
## Project: HyperLocal Online Grocery & Multi-Store E-Commerce Platform
**Target Stack:** MERN (MongoDB, Express.js, React / Next.js, Node.js + Socket.IO)  
**Optimized for:** Cursor IDE (Step-by-Step AI Implementation & Code Generation)  
**Version:** 2.1 (Production Blueprint)

---

## 1. Project Overview & Core Concept

### 1.1 What We Are Building
A modern, hyperlocal **Online Grocery & Kirana E-Commerce Store** based on our tested HTML design. It enables customers to:
1. Browse grocery staples, fresh vegetables, dairy, stationery, and household essentials.
2. **Compare real-time prices across nearby neighborhood stores** (e.g., Gupta Kirana vs. City Super Mart) for the exact same item.
3. Order with **15–25 minute express doorstep delivery** or choose **store self-pickup**.
4. Track delivery riders in real time on a live GPS map with a **4-digit security OTP handshake**.
5. Provide store owners with an **online/offline switch** and live order dispatch board.
6. Provide delivery riders with an on-duty radar screen and earnings dashboard.

---

## 2. Target File & Folder Structure for Cursor

When generating this project in Cursor, structure the repository as follows:

```
hyperlocal-grocery-mern/
├── server/                         # Backend (Node.js + Express + MongoDB)
│   ├── config/
│   │   ├── db.js                   # Mongoose connection with error handling
│   │   └── redis.js                # Redis client for real-time pub/sub (optional/scalable)
│   ├── models/
│   │   ├── User.js                 # Customers, Store Owners, Riders, Admins
│   │   ├── Category.js             # Grocery, Dairy, Veggies, Stationery, etc.
│   │   ├── Store.js                # Merchant profiles & geo-coordinates
│   │   ├── Product.js              # Master SKU catalog & photos
│   │   ├── StoreProductPricing.js  # Multi-store price & inventory matrix
│   │   ├── Order.js                # Placed orders & item details
│   │   └── Delivery.js             # Live rider telemetry & OTP
│   ├── controllers/
│   │   ├── authController.js       # Register, login, OTP authentication
│   │   ├── categoryController.js   # Category management
│   │   ├── storeController.js      # Stores listing, geo-query & online toggle
│   │   ├── productController.js    # Catalog & multi-store price comparison
│   │   ├── orderController.js      # Cart checkout, atomic transaction & stock update
│   │   └── deliveryController.js   # Rider GPS pings & OTP validation
│   ├── middleware/
│   │   ├── authMiddleware.js       # JWT & role verification (customer/owner/driver)
│   │   └── errorHandler.js        # Centralized JSON error responses
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── categoryRoutes.js
│   │   ├── storeRoutes.js
│   │   ├── productRoutes.js
│   │   ├── orderRoutes.js
│   │   └── deliveryRoutes.js
│   ├── sockets/
│   │   └── trackingSocket.js       # Socket.IO live rider GPS broadcast
│   ├── package.json
│   └── server.js                   # Express server entry point
│
└── client/                         # Frontend (React / Next.js + Tailwind CSS)
    ├── public/                     # Static icons & placeholder images
    ├── src/
    │   ├── components/
    │   │   ├── Header.jsx          # Logo, location picker pill, search, cart icon
    │   │   ├── CategorySlider.jsx  # Circular Instagram-style story bubbles
    │   │   ├── HeroBanner.jsx      # Promo banner & delivery time badge
    │   │   ├── ProductCard.jsx     # Product card with lowest store price badge
    │   │   ├── CompareModal.jsx    # Real-time multi-store price comparison matrix
    │   │   ├── CartDrawer.jsx      # Slide-over cart, delivery vs pickup selector
    │   │   ├── CheckoutModal.jsx   # Guest/user address & payment (COD / UPI QR)
    │   │   ├── LiveTrackingModal.jsx # Live Leaflet map, moving bike marker, OTP card
    │   │   ├── MyOrdersModal.jsx   # Order history, 1-click reorder, print tax invoice
    │   │   └── PrintableInvoice.jsx # Official GST tax invoice format
    │   ├── pages/
    │   │   ├── CustomerHome.jsx    # Complete customer shopping website
    │   │   ├── StoreAdmin.jsx      # Store owner dashboard (Online switch, dispatch queue)
    │   │   ├── RiderHub.jsx        # Delivery partner screen (Duty toggle, radar, OTP entry)
    │   │   └── SuperAdmin.jsx      # Master platform control & KYC approvals
    │   ├── context/
    │   │   ├── CartContext.jsx     # Cart state management (items, totals, store selection)
    │   │   └── AuthContext.jsx     # User session & active role
    │   ├── services/
    │   │   ├── api.js              # Axios / Fetch HTTP client for REST endpoints
    │   │   └── socket.js           # Socket.IO client for live driver tracking
    │   ├── App.jsx                 # Routing & global role switcher
    │   ├── index.css               # Tailwind CSS & custom design system tokens
    │   └── main.jsx
    ├── tailwind.config.js
    └── package.json
```

---

## 3. Database Schema (MongoDB & Mongoose Models)

Below are the exact Mongoose schema specifications to create in `server/models/`:

### 3.1 `User.js`
```javascript
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String }, // Hashed with bcrypt
  role: { 
    type: String, 
    enum: ['customer', 'store_owner', 'driver', 'superadmin'], 
    default: 'customer' 
  },
  addresses: [{
    tag: { type: String, default: 'Home' }, // Home, Work, Other
    flatBuilding: String,
    streetArea: String,
    pincode: String,
    city: String,
    lat: Number,
    lng: Number,
    isDefault: { type: Boolean, default: false }
  }],
  status: { type: String, enum: ['pending', 'approved', 'suspended'], default: 'approved' },
  avatarUrl: String
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
```

### 3.2 `Category.js`
```javascript
const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  iconEmoji: { type: String, default: '🛒' },
  photoUrl: { type: String, required: true },
  displayOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);
```

### 3.3 `Store.js` (With Geospatial Location)
```javascript
const mongoose = require('mongoose');

const StoreSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  phone: { type: String, required: true },
  photoUrl: { type: String, required: true },
  address: { type: String, required: true },
  pincode: { type: String, required: true },
  city: { type: String, default: 'Noida' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  deliveryRadiusKm: { type: Number, default: 5.0 },
  baseDeliveryFee: { type: Number, default: 20.0 },
  freeDeliveryAbove: { type: Number, default: 300.0 },
  estDeliveryMins: { type: Number, default: 20 },
  pickupAvailable: { type: Boolean, default: true },
  rating: { type: Number, default: 4.8 },
  reviewsCount: { type: Number, default: 50 },
  isOnline: { type: Boolean, default: true }, // Store Open / Closed Switch
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  openingTime: { type: String, default: '08:00 AM - 10:30 PM' }
}, { timestamps: true });

StoreSchema.index({ location: '2dsphere' });
StoreSchema.index({ isOnline: 1, status: 1 });

module.exports = mongoose.model('Store', StoreSchema);
```

### 3.4 `Product.js` (Master Grocery Catalog)
```javascript
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  name: { type: String, required: true },
  brand: { type: String },
  unit: { type: String, required: true }, // e.g., '1 Litre', '500g', 'Pack of 4'
  description: { type: String },
  photoUrl: { type: String, required: true },
  photos: [{ type: String }], // Array of multiple gallery images
  mrp: { type: Number, required: true },
  rating: { type: Number, default: 4.8 },
  reviewsCount: { type: Number, default: 25 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

ProductSchema.index({ name: 'text', brand: 'text', description: 'text' });

module.exports = mongoose.model('Product', ProductSchema);
```

### 3.5 `StoreProductPricing.js` (Multi-Store Price Matrix)
```javascript
const mongoose = require('mongoose');

const StoreProductPricingSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  price: { type: Number, required: true }, // Store selling price
  stockQuantity: { type: Number, default: 50 },
  isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

StoreProductPricingSchema.index({ storeId: 1, productId: 1 }, { unique: true });
StoreProductPricingSchema.index({ productId: 1, isAvailable: 1, price: 1 });

module.exports = mongoose.model('StoreProductPricing', StoreProductPricingSchema);
```

### 3.6 `Order.js`
```javascript
const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  unitSpec: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true }
});

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  orderType: { type: String, enum: ['delivery', 'pickup'], default: 'delivery' },
  timeSlot: { type: String, default: '⚡ Express Delivery (15-25 Mins)' },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  deliveryAddress: { type: String, required: true },
  pincode: { type: String, default: '201301' },
  items: [OrderItemSchema],
  itemsTotal: { type: Number, required: true },
  deliveryFee: { type: Number, default: 0.0 },
  grandTotal: { type: Number, required: true },
  paymentMode: { type: String, enum: ['COD', 'UPI', 'CARD'], default: 'COD' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  status: { 
    type: String, 
    enum: ['placed', 'accepted', 'packing', 'out_for_delivery', 'ready_for_pickup', 'completed', 'cancelled'], 
    default: 'placed' 
  },
  otpCode: { type: String, required: true } // 4-digit security code e.g. '4821'
}, { timestamps: true });

OrderSchema.index({ storeId: 1, status: 1 });
OrderSchema.index({ orderNumber: 1 });

module.exports = mongoose.model('Order', OrderSchema);
```

### 3.7 `Delivery.js` (Live GPS Telemetry)
```javascript
const mongoose = require('mongoose');

const DeliverySchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  driverName: { type: String, default: 'Rahul Sharma' },
  driverPhone: { type: String, default: '9811009988' },
  driverVehicle: { type: String, default: 'Hero Splendor (DL 3S AB 1234)' },
  status: { 
    type: String, 
    enum: ['assigned', 'arrived_at_store', 'picked_up', 'out_for_delivery', 'delivered'], 
    default: 'assigned' 
  },
  currentLat: { type: Number, default: 28.6280 },
  currentLng: { type: Number, default: 77.3649 },
  etaMins: { type: Number, default: 15 },
  distanceRemainingKm: { type: Number, default: 1.5 },
  lastPingAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Delivery', DeliverySchema);
```

---

## 4. Backend REST API & Business Logic Specifications

### 4.1 Master Seed Catalog Data
Provide a seed script (`server/scripts/seed.js`) that populates MongoDB with:
* **7 Core Categories:** All Products, Grocery, Stationery, Vegetables, Hardware & Tools, Chairs & Furniture, Cosmetics & Beauty.
* **Neighborhood Stores:** Store 1 (Gupta Kirana), Store 2 (City Super Mart), Store 3 (Bhatia Tools), Store 4 (Royal Furniture), Store 5 (Glamour Cosmetics).
* **Products with Multi-Store Pricing:** Maggi 2-Minute Noodles, Amul Taaza Milk, Aashirvaad Atta, Britannia Bread, Fresh Tomatoes, Ballpoint Pens, etc., with varying prices across stores to test the comparison matrix immediately.

### 4.2 Multi-Store Price Comparison Logic (`GET /api/products/:id/compare-stores`)
* **Objective:** Given a product ID, find all active, online stores stocking this item.
* **Algorithm:**
  1. Find the product in MongoDB.
  2. Query `StoreProductPricing` where `productId = :id` and `isAvailable = true` and `stockQuantity > 0`.
  3. Join each store and verify `store.isOnline === true` and `store.status === 'approved'`.
  4. Compute delivery fee: If `itemPrice >= store.freeDeliveryAbove`, fee = ₹0, else `store.baseDeliveryFee`.
  5. Calculate `totalCost = itemPrice + deliveryFee`.
  6. Return stores sorted by `totalCost ASC`. Mark the first store with `isLowestPrice: true`.

### 4.3 Atomic Order Placement (`POST /api/orders`)
* **Objective:** Ensure stock safety and create order atomically using a MongoDB Session (`mongoose.startSession()`).
* **Steps:**
  1. Start database transaction.
  2. Verify fulfilling store exists and is online (`store.isOnline === true`).
  3. For every item in the cart, deduct quantity from `StoreProductPricing`:
     ```javascript
     const pricing = await StoreProductPricing.findOneAndUpdate(
       { storeId, productId: item.productId, stockQuantity: { $gte: item.quantity } },
       { $inc: { stockQuantity: -item.quantity } },
       { session, new: true }
     );
     if (!pricing) throw new Error(`Out of stock: ${item.name}`);
     ```
  4. Generate random 4-digit OTP (`Math.floor(1000 + Math.random() * 9000)`).
  5. Generate unique order number (e.g. `ORD-` + random hex + random 3-digit number).
  6. Insert `Order` and insert linked `Delivery` record.
  7. Commit transaction.
  8. Emit Socket.IO alert to store owner (`io.to('store_' + storeId).emit('order:new', order)`).
  9. Return `{ orderNumber, grandTotal, otpCode, status: 'placed' }`.

### 4.4 Live Rider GPS Update (`POST /api/delivery/update-location`) & Socket.IO
* Riders ping their coordinates (`lat`, `lng`, `etaMins`, `distanceKm`) every 3 seconds.
* Update `Delivery` document in MongoDB.
* Broadcast to Socket.IO room `order_${orderId}` so the customer's Leaflet/Google map marker moves smoothly in real time without refreshing the page.

---

## 5. Frontend Pages & Components (Based on HTML Design)

### 5.1 Page 1: Customer Storefront (`CustomerHome.jsx`)
* **Header Bar:**
  * HyperLocal logo with lightning badge.
  * Location Selector Pill (e.g., `Deliver to 201301`) that opens the GPS/Pincode Modal.
  * Search bar with instant real-time keyword filtering.
  * Header buttons: My Orders (`📦`), Rider Hub (`🛵`), Admin (`⚙️`), and Cart button with live count badge.
* **Instagram-Style Circular Category Stories:**
  * Horizontal slider with smooth left/right scroll buttons.
  * Categories: All, Grocery, Stationery, Vegetables, Hardware, Furniture, Cosmetics. Clicking filters the products.
* **Hero Promo Banner:**
  * Express delivery callout: `15-25 Mins Doorstep Delivery`.
* **Grocery Products Grid:**
  * Product image, brand name, unit spec (`500g`, `1 Litre`).
  * Price onwards: Displays lowest available store price and MRP strike-through with savings percentage.
  * "Compare Stores" trigger button that opens the comparison modal.
  * Direct "Add to Cart" button bound to the cheapest store.
* **Store Comparison Modal (`CompareModal.jsx`):**
  * Multi-image thumbnail selector and 2.2x zoom magnification on hover.
  * Real-time list of all nearby stores carrying this item with store rating (`★ 4.8`), delivery ETA, item price, delivery fee, and total cost.
  * One-click "Add to Cart" for the selected store.
* **Slide-Over Cart Drawer (`CartDrawer.jsx`):**
  * Fulfillment toggle: `⚡ Doorstep Delivery` vs `🏬 Store Self-Pickup`.
  * Time slot picker: `Express (15-25 mins)` or scheduled slots.
  * Item list with quantity increment/decrement buttons.
  * Complete bill breakdown (Subtotal, Delivery Fee, Discount, Grand Total).
  * "Proceed to Checkout" button.
* **Guest Checkout Modal (`CheckoutModal.jsx`):**
  * Full name, phone number, pin code, flat/tower address.
  * Payment options: `💵 Pay on Delivery (Cash/UPI)` and `📱 Instant UPI QR`.
  * "Place Order" button ➔ Directly opens the Live Tracking Screen.
* **Live GPS Tracking Modal (`LiveTrackingModal.jsx`):**
  * Full interactive Leaflet map rendering store marker, moving rider bike marker, and customer home marker.
  * Live status pill: `Rider Rahul Sharma is on the way (3 mins away)`.
  * Prominent **4-digit OTP card** for secure delivery completion.
  * Driver profile card with photo, bike plate, rating, and direct `📞 Call Rider` and `💬 WhatsApp` buttons.
* **My Orders & Printable Invoice Modal:**
  * List of previous orders with current statuses (`Placed`, `Packing`, `Out for Delivery`, `Completed`).
  * 1-Click Reorder button.
  * Official GST Tax Invoice preview with a dedicated `@media print` CSS stylesheet for printing or saving to PDF.

### 5.2 Page 2: Store Owner Dashboard (`StoreAdmin.jsx`)
* **Store Availability Switch:** Big toggle button switching between `STORE IS ONLINE` (Green) and `STORE IS OFFLINE` (Red). When offline, items are automatically hidden from customer search.
* **Dynamic Creator Studio:** Form to add new grocery products, upload photos, set retail prices per store, and adjust stock quantities.
* **Live Dispatch Board:** Kanban-style incoming order cards showing items, customer address, payment mode, and action buttons (`Accept` ➔ `Mark Packing` ➔ `Ready for Dispatch`).

### 5.3 Page 3: Delivery Rider Hub (`RiderHub.jsx`)
* **On-Duty / Off-Duty Switch:** Pulsing indicator showing active fleet status.
* **Earnings Bar:** Today's earnings counter, completed trips, and customer tips.
* **Incoming Order Radar:** High-pitch audio chime alert when a new order is ready for pickup with a 30-second accept button.
* **Turn-by-Turn Navigation Map:** Leaflet map showing route from store pickup to customer dropoff.
* **Customer Delivery Handshake:** 4-digit auto-focus OTP input box. Once correct OTP is entered, plays cash register sound, credits rider earnings, and completes the order.

---

## 6. Step-by-Step Prompt Sequences for Cursor

Copy and paste these exact sequential instructions into Cursor Composer (`Ctrl + I` or `Cmd + I`):

### Prompt 1: Initialize Project & Setup Backend
```markdown
We are building a MERN HyperLocal Grocery Ecommerce application based on the PRD.
1. Create a root directory with two folders: `server` and `client`.
2. In `server`, initialize a Node.js project with dependencies: `express`, `mongoose`, `cors`, `dotenv`, `socket.io`, `bcryptjs`, `jsonwebtoken`.
3. Create `server/config/db.js` connecting to MongoDB via Mongoose.
4. Set up `server/server.js` with Express, CORS, JSON parsing, Socket.IO HTTP server, and basic health-check endpoint `GET /api/health`.
```

### Prompt 2: Create All Mongoose Models & Seed Script
```markdown
Based on Section 3 of the PRD:
1. Create the Mongoose models in `server/models/`:
   - `User.js`
   - `Category.js`
   - `Store.js` (with 2dsphere location index)
   - `Product.js`
   - `StoreProductPricing.js`
   - `Order.js`
   - `Delivery.js`
2. Create `server/scripts/seed.js` that populates MongoDB with 7 core categories (Grocery, Dairy, Veggies, Stationery, etc.), 3 nearby stores with Noida coordinates, 15 grocery products with multi-store prices, and test users (Customer, Store Owner, Driver). Add an npm run seed script.
```

### Prompt 3: Implement Controllers & REST API Routes
```markdown
Based on Section 4 of the PRD:
1. Implement `categoryController.js` and `categoryRoutes.js` for `GET /api/categories`.
2. Implement `storeController.js` and `storeRoutes.js` for `GET /api/stores` and `PATCH /api/stores/:id/toggle-status`.
3. Implement `productController.js` and `productRoutes.js`:
   - `GET /api/products` (supports category filter, text search, and attaches the lowest store price).
   - `GET /api/products/:id/compare-stores` (returns all online stores selling the item sorted by total cost).
4. Implement `orderController.js` and `orderRoutes.js`:
   - `POST /api/orders` (atomic transaction deducting stock, generating 4-digit OTP, creating Delivery record).
   - `GET /api/orders` (retrieving order history).
5. Implement `deliveryController.js` and `deliveryRoutes.js`:
   - `GET /api/delivery/track/:orderNumber`
   - `POST /api/delivery/verify-otp`
```

### Prompt 4: Setup React Client & Design System
```markdown
1. In the `client` directory, setup a React application using Vite and Tailwind CSS.
2. Configure `client/tailwind.config.js` with the brand colors:
   - Primary Indigo: #4f46e5
   - Green (Rating/Savings): #038d63
   - Slate dark neutrals: #0f172a, #1e293b
3. Install dependencies: `lucide-react`, `leaflet`, `axios`, `socket.io-client`.
4. Create `src/context/CartContext.jsx` handling cart items, quantity updates, selected store, delivery vs pickup mode, and total calculations.
```

### Prompt 5: Build Customer Shopping Storefront Components
```markdown
Replicate the exact design from the project's `index.html` into React components:
1. `Header.jsx`: Logo, location selector pill, search bar, role switcher, orders button, and cart button with badge.
2. `CategorySlider.jsx`: Horizontal circular story bubbles with smooth slide arrows.
3. `HeroBanner.jsx`: 15-minute express delivery banner.
4. `ProductCard.jsx`: Product image, unit spec, lowest price Kirana store badge, and "Compare Stores" button.
5. `CompareModal.jsx`: Multi-image preview with hover zoom and comparison table of nearby stores.
6. `CartDrawer.jsx`: Slide-over cart drawer with delivery/pickup toggle and checkout trigger.
7. `CheckoutModal.jsx`: Address input, COD/UPI selector, and order submission.
8. `LiveTrackingModal.jsx`: Leaflet map with moving rider marker, ETA countdown, and 4-digit security OTP box.
9. `MyOrdersModal.jsx` and `PrintableInvoice.jsx`: Order history and printable GST receipt.
```

### Prompt 6: Build Store Owner & Rider Dashboards
```markdown
1. Create `StoreAdmin.jsx`:
   - Real-time `STORE IS ONLINE / OFFLINE` toggle button.
   - Creator studio to add products and set prices across stores.
   - Live orders dispatch queue with status transition buttons (`Accept`, `Pack`, `Hand to Rider`).
2. Create `RiderHub.jsx`:
   - On-duty/off-duty switch.
   - Incoming order radar alert with audio chime.
   - Active route Leaflet map.
   - 4-digit OTP verification input that marks the delivery completed.
```
