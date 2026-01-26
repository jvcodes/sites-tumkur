# TODO - SiteHub Enhancements

## 🧪 Testing & Performance

### Performance Testing with 100+ Mock Listings
- [ ] **Goal**: Stress test the application with realistic data volume
- **Implementation**:
  - Create a seed script to generate 100-500 mock site listings with varied data
  - Test pagination performance (page load times should be <100ms)
  - Verify MongoDB indexes are efficiently used
  - Measure API response times for search/filter operations
  - Test concurrent user scenarios
- **Files to Create**: `debug/seed_mock_data.py`
- **Success Criteria**: Sub-second load times even with 500+ listings

### Cross-Device UI Responsiveness Testing
- [ ] **Goal**: Ensure seamless experience across all devices
- **Devices to Test**:
  - Mobile (iOS Safari, Android Chrome) - 375px to 428px width
  - Tablet (iPad, Android tablets) - 768px to 1024px width
  - Desktop (1280px, 1920px, 2560px)
- **Focus Areas**:
  - Site card grid layout (should adapt: 1 col mobile, 2-3 col tablet, 4 col desktop)
  - Search filters UI (mobile drawer vs desktop sidebar)
  - Navigation menu (hamburger on mobile)
  - Image aspect ratios and loading
  - Touch interactions vs mouse hover effects

---

## 🔒 Authentication & Security

### Admin Page Not Asking for Login
- [ ] **Current Issue**: `/dashboard` is accessible without authentication
- **Implementation**:
  - Add Django `@login_required` decorator to all admin views
  - Create middleware to redirect unauthenticated users to `/login`
  - On Frontend: Add route protection using `AuthContext` (check if user is admin)
  - Consider adding role-based permissions (admin vs regular user)
- **Files to Modify**:
  - `listings/views.py` - Add decorators
  - `frontend/app/dashboard/page.tsx` - Add auth check
- **Success Criteria**: Visiting `/dashboard` while logged out redirects to login page

### Integrate Real Google OAuth
- [ ] **Goal**: Replace simulated login with production-ready Google Sign-In
- **Implementation Steps**:
  1. Create Google Cloud Console project
  2. Enable Google+ API and get OAuth credentials (Client ID, Secret)
  3. Install `django-allauth` or `social-auth-app-django`
  4. Configure OAuth redirect URLs
  5. Update `api/auth_views.py` to handle real OAuth token exchange
  6. Frontend: Replace mock button with official Google Sign-In button
- **Environment Variables Needed**:
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
- **Success Criteria**: Users can login with their actual Google accounts

### Add Mobile OTP Login
- [ ] **Goal**: Enable phone number + OTP authentication
- **Implementation**:
  1. Choose SMS provider (Twilio, AWS SNS, or local provider)
  2. Create `POST /api/auth/send-otp/` endpoint (sends 6-digit code)
  3. Create `POST /api/auth/verify-otp/` endpoint (validates and creates session)
  4. Store OTP in Redis/cache with 5-minute expiry
  5. Frontend: Build phone number input + OTP verification UI
  6. Rate limiting: Max 3 OTP requests per phone number per hour
- **Files to Create**:
  - `api/otp_views.py`
  - `frontend/app/login-otp/page.tsx`
- **Success Criteria**: Users receive OTP on their phone and can login

---

## 🎨 UI/UX Improvements

### Listed Sites Not Showing ID Number (Like Matrimony App)
- [ ] **Goal**: Display unique identifier prominently on each listing
- **Implementation**:
  - Add a visible badge/label on `SiteCard` component showing site code
  - Position: Top-left or top-right corner (like "SH-12345")
  - Style: Small pill badge with distinct color (e.g., blue background, white text)
  - Format: Use `site_code` field (e.g., "SEED-001" or generate sequential IDs)
- **Example UI**:
  ```
  ┌─────────────────┐
  │ [SH-12345]      │ ← ID Badge
  │                 │
  │   Site Image    │
  │                 │
  └─────────────────┘
  ```
- **Files to Modify**: `frontend/app/components/SiteCard.tsx`
- **Success Criteria**: Every site card shows a clearly visible unique ID

### Add Cart Not Showing in the Listing
- [ ] **Current Issue**: "Add to Cart" button missing from site cards
- **Implementation**:
  1. Backend: Create cart system similar to wishlist
     - `POST /api/cart/add/` - Add site to cart
     - `GET /api/cart/` - Get user's cart items
     - `DELETE /api/cart/remove/{site_code}/` - Remove from cart
  2. Frontend: Add `CartContext` for state management
  3. Add 🛒 "Add to Cart" button to `SiteCard` component
  4. Create `/cart` page to view and manage cart items
  5. Cart badge in Navbar showing item count
- **Files to Create**:
  - `api/cart_views.py`
  - `frontend/app/context/CartContext.tsx`
  - Update `frontend/app/components/SiteCard.tsx`
- **Success Criteria**: Users can add sites to cart and view cart page with all items

### Many Filters Got Removed
- [ ] **Goal**: Restore comprehensive filtering options
- **Filters to Add Back**:
  - **Price Range**: Min/Max sliders (₹0 - ₹50,00,000+)
  - **Location**: Dropdown or autocomplete with all available locations
  - **Site Type**: Residential / Commercial / Agricultural / Industrial
  - **Area Range**: Min/Max sq.ft (e.g., 500 - 10,000 sq.ft)
  - **Status**: For Sale / Sold / Pending
  - **Amenities**: Water, Electricity, Road Access, etc.
  - **Posted Date**: Last 24 hours / 7 days / 30 days / All time
  - **Sort Options**: Price (Low to High), Price (High to Low), Newest First, Area Size
- **UI Design**:
  - Desktop: Left sidebar with collapsible filter sections
  - Mobile: Bottom sheet or full-screen filter modal
- **Files to Modify**:
  - `frontend/app/page.tsx` - Add filter UI components
  - `api/views.py` - Extend `filter_sites_api` to support all filters
- **Success Criteria**: Users can apply multiple filters simultaneously and see real-time results

### Instagram-Style Scrolling (User Friendly)
- [ ] **Goal**: Create smooth, engaging infinite scroll experience
- **Implementation**:
  1. Replace pagination buttons with infinite scroll
  2. Use Intersection Observer API to detect when user reaches bottom
  3. Auto-load next page of results (show subtle loading skeleton)
  4. Implement "pull-to-refresh" on mobile
  5. Add smooth scroll animations and momentum
  6. Virtual scrolling for performance (render only visible cards)
  7. Add "Back to Top" floating button
- **Libraries to Consider**: `react-infinite-scroll-component`, `framer-motion`
- **UX Features**:
  - Skeleton loaders while fetching
  - Smooth fade-in animation for new items
  - Maintain scroll position on navigation back
  - Auto-pause videos when scrolled out of view
- **Files to Modify**: `frontend/app/page.tsx`
- **Success Criteria**: Scrolling feels native and fluid like Instagram feed

---

## 📸 Media & Content

### Multiple Images and YouTube Uploaded Video in View Details
- [ ] **Goal**: Rich media gallery in site detail page
- **Implementation**:
  
  **Backend Changes**:
  1. Update MongoDB schema to support arrays:
     - `images: ["img1.jpg", "img2.jpg", ...]` (up to 10 images)
     - `videos: [{"type": "youtube", "url": "..."}, {"type": "upload", "path": "..."}]`
  2. Update `POST /api/sites/create/` to accept multiple files
  3. Process and resize images server-side (thumbnails + full-size)
  4. Store videos: YouTube links directly, uploaded videos via file storage
  
  **Frontend Changes**:
  1. Create image gallery carousel component:
     - Thumbnails at bottom
     - Full-size image viewer with left/right arrows
     - Swipe gesture support on mobile
     - Lightbox mode (full-screen view)
  2. Embed YouTube videos using `react-youtube` or iframe
  3. Upload form: Drag-and-drop multiple images + YouTube URL input
  
  **UI Design**:
  ```
  ┌─────────────────────────────┐
  │    Main Image/Video         │ ← Carousel
  ├─────────────────────────────┤
  │ [thumb1][thumb2][thumb3]... │ ← Thumbnails
  └─────────────────────────────┘
  ```
  
- **Files to Create/Modify**:
  - `frontend/app/components/MediaGallery.tsx` (new)
  - `frontend/app/site/[id]/page.tsx` (detail page)
  - `api/views.py` - Update create/edit endpoints
  - `listings/mongo.py` - Update schema
  
- **File Upload Limits**:
  - Max 10 images per site
  - Max 5 videos (3 uploaded + unlimited YouTube links)
  - Individual image max: 5MB
  - Individual video max: 50MB
  
- **Success Criteria**: 
  - Site detail page shows beautiful image carousel
  - YouTube videos play inline
  - Uploaded videos stream smoothly

---

## 📋 Priority Order

**Phase 1 (Critical - Week 1)**:
1. ✅ Admin authentication (security vulnerability)
2. ✅ Add Cart functionality (core feature)
3. ✅ Restore filters (user needs)

**Phase 2 (Important - Week 2)**:
4. ✅ Site ID display (usability)
5. ✅ Multiple images & video support (enhanced content)
6. ✅ Instagram-style scrolling (better UX)

**Phase 3 (Enhancement - Week 3-4)**:
7. ✅ Performance testing with mock data
8. ✅ Cross-device responsiveness testing
9. ✅ Real Google OAuth integration
10. ✅ Mobile OTP login service

---

## 📝 Notes

- Each task should be moved to a GitHub Issue or task management tool once started
- Mark checkboxes as completed: `- [x]` when done
- Add estimated completion dates for each phase
- Consider user feedback after each phase before proceeding
