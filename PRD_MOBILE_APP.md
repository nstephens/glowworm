# GlowWorm Mobile App - Product Requirements Document

## **1. Executive Summary**

### **Product Vision**
Create a native mobile application for GlowWorm that enables users to manage their digital photo displays, upload images, and control playlists directly from their iOS devices. The app will provide a seamless, native experience while leveraging the existing backend infrastructure.

### **Business Objectives**
- **Primary**: Enable mobile-first photo management and display control
- **Secondary**: Increase user engagement through native mobile experience
- **Tertiary**: Establish foundation for future Android support

### **Success Metrics**
- User adoption rate (target: 80% of web users try mobile app within 30 days)
- Upload frequency increase (target: 2x more photo uploads via mobile)
- User retention (target: 70% monthly active users)
- App Store rating (target: 4.5+ stars)

---

## **2. Product Overview**

### **Target Audience**
- **Primary**: Existing GlowWorm web users who want mobile convenience
- **Secondary**: New users discovering GlowWorm through mobile app
- **Tertiary**: Power users who need remote display management

### **User Personas**

#### **Sarah - The Family Photo Manager**
- **Demographics**: 35-45, parent, tech-savvy
- **Pain Points**: Wants to quickly upload family photos from phone
- **Goals**: Easy photo management, instant display updates
- **Key Features**: Camera integration, quick upload, family album organization

#### **Mike - The Remote Manager**
- **Demographics**: 40-55, business owner, travels frequently
- **Pain Points**: Needs to manage displays remotely
- **Goals**: Remote control, real-time monitoring, professional appearance
- **Key Features**: Remote playlist management, display status monitoring

#### **Emma - The Content Creator**
- **Demographics**: 25-35, creative professional, social media active
- **Pain Points**: Wants to showcase work on displays
- **Goals**: Professional presentation, easy content updates
- **Key Features**: High-quality image uploads, portfolio management

---

## **3. Functional Requirements**

### **3.1 Core Features (MVP)**

#### **Authentication & Onboarding**
- **FR-001**: User can log in with existing GlowWorm credentials
- **FR-002**: User can configure server URL (dev/prod environments)
- **FR-003**: App remembers login state and server configuration
- **FR-004**: User can log out and switch accounts
- **FR-005**: Biometric authentication (Face ID/Touch ID) for quick access

#### **Image Management**
- **FR-006**: User can browse all images in gallery view
- **FR-007**: User can upload photos directly from camera
- **FR-008**: User can select multiple photos from device library
- **FR-009**: User can view image details and metadata
- **FR-010**: User can delete images with confirmation
- **FR-011**: User can search and filter images
- **FR-012**: User can view images in full-screen mode with zoom/pan

#### **Playlist Management**
- **FR-013**: User can view all playlists in list/grid view
- **FR-014**: User can create new playlists with name and description
- **FR-015**: User can edit existing playlists
- **FR-016**: User can delete playlists with confirmation
- **FR-017**: User can add images to playlists via drag-and-drop or selection
- **FR-018**: User can remove images from playlists
- **FR-019**: User can reorder images within playlists
- **FR-020**: User can set playlist display duration and settings

#### **Display Control**
- **FR-021**: User can view all connected displays
- **FR-022**: User can see display status (online/offline, current playlist)
- **FR-023**: User can assign playlists to displays
- **FR-024**: User can start/stop displays remotely
- **FR-025**: User can view real-time display information
- **FR-026**: User can rename displays

#### **Settings & Configuration**
- **FR-027**: User can view and edit app settings
- **FR-028**: User can change server configuration
- **FR-029**: User can manage notification preferences
- **FR-030**: User can view app version and update information

### **3.2 Advanced Features (Post-MVP)**

#### **Real-time Features**
- **FR-031**: Real-time display status updates via WebSocket
- **FR-032**: Push notifications for display status changes
- **FR-033**: Live preview of what's currently displaying

#### **Enhanced Image Features**
- **FR-034**: Image editing (crop, rotate, filters)
- **FR-035**: Batch operations (select multiple, delete, add to playlist)
- **FR-036**: Image metadata editing (tags, descriptions)
- **FR-037**: Duplicate detection and management

#### **Offline Support**
- **FR-038**: Cache recently viewed images for offline viewing
- **FR-039**: Queue uploads when offline, sync when online
- **FR-040**: Offline playlist management

---

## **4. Technical Requirements**

### **4.1 Platform & Architecture**

#### **Target Platforms**
- **Primary**: iOS 14.0+ (iPhone and iPad)
- **Future**: Android (Phase 2)

#### **Technology Stack**
- **Framework**: React Native 0.72+
- **Language**: TypeScript
- **State Management**: React Query + Context API
- **Navigation**: React Navigation 6
- **UI Components**: React Native Elements + Custom Components
- **Image Handling**: React Native Fast Image
- **Storage**: AsyncStorage + Keychain (iOS)

#### **Backend Integration**
- **API**: Existing FastAPI backend (no changes required)
- **Authentication**: JWT tokens with refresh mechanism
- **Real-time**: WebSocket connection for live updates
- **File Upload**: Multipart form data with progress tracking

### **4.2 Performance Requirements**

#### **App Performance**
- **FR-041**: App launches in under 3 seconds on iPhone 12
- **FR-042**: Image gallery loads in under 2 seconds
- **FR-043**: Image uploads show progress indicator
- **FR-044**: Smooth scrolling with 60fps in image gallery
- **FR-045**: Memory usage stays under 200MB during normal operation

#### **Network Performance**
- **FR-046**: Graceful handling of network connectivity issues
- **FR-047**: Automatic retry for failed network requests
- **FR-048**: Image caching for improved performance
- **FR-049**: Optimized image sizes for mobile viewing

### **4.3 Security Requirements**

#### **Data Protection**
- **FR-050**: All API communications use HTTPS
- **FR-051**: Sensitive data stored in iOS Keychain
- **FR-052**: JWT tokens automatically refresh before expiration
- **FR-053**: App can be locked with device passcode/biometrics

#### **Privacy**
- **FR-054**: Camera/photo library access requires user permission
- **FR-055**: No personal data stored outside user's control
- **FR-056**: User can clear all cached data

---

## **5. User Experience Requirements**

### **5.1 Design Principles**

#### **Native iOS Experience**
- **FR-057**: Follows iOS Human Interface Guidelines
- **FR-058**: Uses native iOS navigation patterns
- **FR-059**: Supports iOS accessibility features
- **FR-060**: Adapts to different screen sizes (iPhone/iPad)

#### **Consistency with Web App**
- **FR-061**: Maintains visual consistency with web interface
- **FR-062**: Uses same color scheme and branding
- **FR-063**: Similar information architecture and navigation patterns

### **5.2 User Interface Requirements**

#### **Navigation Structure**
```
Tab Navigation (Bottom):
├── Gallery (Images)
├── Playlists
├── Displays
└── Settings

Modal Screens:
├── Image Detail/Edit
├── Playlist Editor
├── Camera/Photo Picker
└── Display Details
```

#### **Key Screens**

**Gallery Screen**
- Grid view of images (3-4 columns on iPhone)
- Pull-to-refresh functionality
- Search bar at top
- Floating action button for camera
- Swipe gestures for quick actions

**Playlist Screen**
- List view of playlists with thumbnails
- Swipe-to-delete functionality
- Quick create button
- Playlist status indicators

**Display Screen**
- Card-based layout for each display
- Real-time status indicators
- Quick action buttons
- Connection status

### **5.3 Interaction Requirements**

#### **Touch Interactions**
- **FR-064**: Tap to select, long-press for context menu
- **FR-065**: Swipe gestures for common actions (delete, edit)
- **FR-066**: Pull-to-refresh on list screens
- **FR-067**: Pinch-to-zoom on image detail view

#### **Haptic Feedback**
- **FR-068**: Haptic feedback for button presses
- **FR-069**: Success/error haptic patterns
- **FR-070**: Selection haptic feedback

---

## **6. Non-Functional Requirements**

### **6.1 Usability**
- **FR-071**: New users can complete basic tasks without training
- **FR-072**: App works in both portrait and landscape orientations
- **FR-073**: Supports Dynamic Type for accessibility
- **FR-074**: VoiceOver compatible for screen readers

### **6.2 Reliability**
- **FR-075**: App crashes less than 0.1% of sessions
- **FR-076**: Graceful error handling with user-friendly messages
- **FR-077**: Automatic recovery from network interruptions
- **FR-078**: Data integrity maintained during app updates

### **6.3 Scalability**
- **FR-079**: App handles 1000+ images without performance degradation
- **FR-080**: Efficient memory management for large image collections
- **FR-081**: Background processing for uploads and sync

---

## **7. Integration Requirements**

### **7.1 Backend Integration**
- **FR-082**: Uses existing FastAPI endpoints without modification
- **FR-083**: Implements same authentication flow as web app
- **FR-084**: Handles API versioning and backward compatibility
- **FR-085**: Supports both development and production server environments

### **7.2 iOS Integration**
- **FR-086**: Integrates with iOS Camera and Photo Library
- **FR-087**: Supports iOS Share Sheet for importing images
- **FR-088**: Handles iOS background app refresh
- **FR-089**: Supports iOS Shortcuts for quick actions

### **7.3 Third-Party Services**
- **FR-090**: Optional: Firebase for push notifications
- **FR-091**: Optional: Crashlytics for crash reporting
- **FR-092**: Optional: Analytics for usage tracking

---

## **8. Development Phases**

### **Phase 1: Foundation (Weeks 1-2)**
- Project setup and architecture
- Authentication and basic navigation
- API service layer implementation
- Basic UI component library

### **Phase 2: Core Features (Weeks 3-5)**
- Image gallery and upload functionality
- Playlist management
- Display control
- Settings and configuration

### **Phase 3: Polish & Testing (Weeks 6-7)**
- UI/UX refinements
- Performance optimization
- Testing and bug fixes
- Accessibility improvements

### **Phase 4: TestFlight & Launch (Weeks 8-9)**
- TestFlight beta testing
- App Store preparation
- Documentation and support materials
- Launch planning

---

## **9. Success Criteria**

### **9.1 Launch Criteria**
- [ ] All MVP features implemented and tested
- [ ] App passes Apple's TestFlight review
- [ ] Performance meets all specified requirements
- [ ] Accessibility compliance verified
- [ ] Documentation complete

### **9.2 Post-Launch Metrics**
- [ ] 4.5+ App Store rating within 30 days
- [ ] 80% of web users try mobile app within 30 days
- [ ] 2x increase in photo uploads via mobile
- [ ] <0.1% crash rate
- [ ] 70% monthly active user retention

---

## **10. Risks & Mitigation**

### **10.1 Technical Risks**
- **Risk**: React Native performance issues with large image collections
- **Mitigation**: Implement virtualized lists and image optimization

- **Risk**: iOS camera/photo library permission issues
- **Mitigation**: Implement graceful fallbacks and clear permission requests

### **10.2 Business Risks**
- **Risk**: Low user adoption
- **Mitigation**: Focus on core user workflows and native iOS experience

- **Risk**: App Store rejection
- **Mitigation**: Follow Apple guidelines strictly, use TestFlight for testing

### **10.3 Timeline Risks**
- **Risk**: Development takes longer than expected
- **Mitigation**: Prioritize MVP features, defer nice-to-have features

---

## **11. Appendices**

### **11.1 User Stories**

**As a GlowWorm user, I want to:**
- Upload photos directly from my camera so I can quickly add new content
- Manage my playlists on the go so I can update displays remotely
- See which displays are online so I know my content is being shown
- Get notified when displays go offline so I can troubleshoot issues

### **11.2 Technical Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Native  │    │   FastAPI       │    │   MySQL         │
│   Mobile App    │◄──►│   Backend       │◄──►│   Database      │
│                 │    │                 │    │                 │
│ • TypeScript    │    │ • Python        │    │ • User Data     │
│ • React Query   │    │ • SQLAlchemy    │    │ • Images        │
│ • Navigation    │    │ • WebSocket     │    │ • Playlists     │
│ • Camera API    │    │ • JWT Auth      │    │ • Settings      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **11.3 API Endpoints (Existing)**
- `GET /api/images` - List images
- `POST /api/images/upload` - Upload image
- `GET /api/playlists` - List playlists
- `POST /api/playlists` - Create playlist
- `GET /api/displays` - List displays
- `PUT /api/displays/{id}/playlist` - Assign playlist to display
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings

---

**Document Version**: 1.0  
**Last Updated**: October 26, 2025  
**Next Review**: November 2, 2025

