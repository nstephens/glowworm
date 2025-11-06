# PRD: Background Image Processing System

**Status:** Draft  
**Version:** 1.0  
**Author:** System Analysis  
**Date:** November 6, 2025  
**Target Release:** v2.1.0

---

## Executive Summary

GlowWorm currently processes images synchronously during upload, creating thumbnails and scaled variants before returning a response. This causes slow upload speeds (especially for bulk uploads) and poor user experience. This PRD proposes implementing an asynchronous background task queue to decouple upload from processing, resulting in 5-10x faster uploads and better scalability.

---

## Problem Statement

### Current Issues

1. **Slow Upload Speed**
   - Each image upload takes 3-5 seconds on LAN
   - Processing time scales linearly with image count
   - 137 images took approximately 8-11 minutes to upload
   - User must wait for all processing to complete before upload "finishes"

2. **Poor Bulk Upload Experience**
   - Frontend batches 2-4 concurrent uploads to avoid overwhelming server
   - No visibility into what's happening during "processing" phase
   - Cannot use uploaded images until ALL processing completes
   - Network interruptions can cause partial uploads with missing variants

3. **Resource Inefficiency**
   - Backend CPU at 42% during upload (CPU-bound)
   - Processing blocks upload endpoint from handling other requests
   - Cannot prioritize thumbnail generation vs variant generation
   - No way to retry failed processing without re-uploading

4. **Architectural Limitations**
   - Tightly coupled upload and processing logic
   - No mechanism for background/deferred tasks
   - Cannot scale processing independently from uploads
   - Difficult to add new image processing features (like AI tagging, face detection, etc.)

### Impact

- **User Experience:** Upload feels slow, especially for photographers with large libraries
- **System Performance:** Backend becomes bottleneck during bulk uploads
- **Reliability:** Single point of failure - if processing fails, upload fails
- **Scalability:** Cannot handle multiple users uploading simultaneously

---

## Goals and Non-Goals

### Goals

1. **Primary Goals:**
   - Reduce upload response time by 80-90% (from 3-5s to <500ms per image)
   - Decouple upload from processing for better reliability
   - Provide real-time feedback on background processing status
   - Enable graceful degradation (originals available even if processing fails)

2. **Secondary Goals:**
   - Support prioritized processing (thumbnails before variants)
   - Enable retry logic for failed processing tasks
   - Provide admin visibility into processing queue status
   - Create foundation for future AI/ML features

### Non-Goals

- Distributed task queue (single server is fine for now)
- Real-time collaborative uploads (not needed)
- Advanced image editing features (out of scope)
- Video processing (separate feature)

---

## Current Architecture

### Upload Flow (Synchronous)

```
User → Frontend → API Endpoint → ImageStorageService → Database
                        ↓
                  [BLOCKING OPERATIONS]
                  - Validate image
                  - Calculate hash
                  - Extract EXIF
                  - Apply orientation
                  - Generate 3 thumbnails (150px, 300px, 600px)
                  - Generate scaled variants (1080x1920, 2160x3840, etc.)
                  - Save 5-7 files to disk
                        ↓
                  [3-5 seconds later]
                        ↓
                  Response (success)
```

### Key Code Locations

- **Upload Endpoint:** `backend/api/images.py:28-99`
- **Processing Logic:** `backend/services/image_storage_service.py:397-576`
- **Thumbnail Generation:** Lines 526-538
- **Variant Generation:** Lines 540-560
- **Frontend Upload:** `frontend/src/hooks/useUploadMutation.ts:186-201`

### Performance Profile

**Per-image processing breakdown:**
- Validate + hash: ~50ms
- EXIF extraction: ~100ms
- Orientation correction: ~200ms
- Thumbnail generation (3x): ~500ms
- Variant generation (2-4x): ~1,500-2,500ms
- **Total: 2,350-3,350ms per image**

---

## Proposed Architecture

### New Upload Flow (Asynchronous)

```
User → Frontend → API Endpoint → ImageStorageService → Database
                        ↓
                  [FAST OPERATIONS ONLY]
                  - Validate image
                  - Calculate hash
                  - Check duplicates
                  - Extract EXIF
                  - Save original file
                  - Create DB record with status='processing'
                        ↓
                  [<500ms later]
                        ↓
                  Response (success, processing=true)
                        ↓
                  Queue background job
                        ↓
                  [BACKGROUND WORKER]
                  - Generate thumbnails (priority 1)
                  - Generate variants (priority 2)
                  - Update DB status='complete'
                  - Emit WebSocket event
                        ↓
                  Frontend receives update → UI reflects completion
```

### Technology Stack

**Option 1: Celery (Full-Featured)**
- Pros: Battle-tested, comprehensive, good monitoring tools
- Cons: Requires Redis/RabbitMQ, heavier setup, more dependencies

**Option 2: RQ (Redis Queue - Recommended)**
- Pros: Simpler, Python-native, good for our scale, easy monitoring
- Cons: Requires Redis (but we may want it anyway for caching)

**Option 3: FastAPI BackgroundTasks**
- Pros: Built-in, no extra dependencies, simple
- Cons: No persistence, no retry logic, jobs lost on restart

**Recommendation: Start with FastAPI BackgroundTasks, migrate to RQ if needed**

---

## Detailed Requirements

### Functional Requirements

#### FR-1: Fast Upload Response
- Upload endpoint returns within 500ms for typical images (< 5MB)
- Original image saved and accessible immediately
- Database record created with `processing_status='pending'`
- Background job queued for processing

#### FR-2: Background Processing
- System processes images in background after upload
- Thumbnail generation prioritized over variants
- Failed processing jobs automatically retry (3 attempts max)
- Processing status tracked in database

#### FR-3: Processing Status Visibility
- Users can see processing status (pending, processing, complete, failed)
- Real-time updates via WebSocket when processing completes
- Admin dashboard shows queue status and failed jobs
- Thumbnails display "processing" placeholder until ready

#### FR-4: Graceful Degradation
- Original images viewable even if thumbnail generation fails
- Frontend falls back to scaled-down original if thumbnails missing
- Variant generation failure doesn't block thumbnail availability
- Manual retry option for failed processing jobs

#### FR-5: Prioritized Processing
- Thumbnails generated first (needed for UI)
- Variants generated second (needed for displays)
- Batch processing for efficiency when queue has many items
- User-initiated processing can jump queue priority

### Non-Functional Requirements

#### NFR-1: Performance
- Upload response time: < 500ms (p95)
- Thumbnail generation: < 2s per image
- Variant generation: < 5s per image
- Queue processing throughput: 20+ images/minute

#### NFR-2: Reliability
- Processing jobs persist across server restarts (if using RQ/Celery)
- Failed jobs automatically retry with exponential backoff
- No data loss if processing fails
- Circuit breaker for repeated failures

#### NFR-3: Scalability
- Support 1000+ images in processing queue
- Handle concurrent uploads from multiple users
- Processing workers can scale independently
- Minimal memory overhead for queue management

#### NFR-4: Observability
- Log all processing attempts (success/failure)
- Track processing duration metrics
- Admin dashboard for queue monitoring
- Alerts for processing failures

---

## Database Schema Changes

### Image Model Updates

Add processing status tracking:

```python
class Image(Base):
    # Existing fields...
    
    # New fields:
    processing_status = Column(
        Enum('pending', 'processing', 'complete', 'failed'),
        default='pending',
        nullable=False
    )
    thumbnail_status = Column(
        Enum('pending', 'processing', 'complete', 'failed'),
        default='pending',
        nullable=False
    )
    variant_status = Column(
        Enum('pending', 'processing', 'complete', 'failed'),
        default='pending',
        nullable=False
    )
    processing_error = Column(Text, nullable=True)
    processing_attempts = Column(Integer, default=0)
    last_processing_attempt = Column(DateTime, nullable=True)
    processing_completed_at = Column(DateTime, nullable=True)
```

### New Processing Jobs Table (if using persistent queue)

```python
class ProcessingJob(Base):
    __tablename__ = "processing_jobs"
    
    id = Column(Integer, primary_key=True)
    image_id = Column(Integer, ForeignKey("images.id"), nullable=False)
    job_type = Column(Enum('thumbnail', 'variant', 'full'), nullable=False)
    status = Column(Enum('queued', 'processing', 'completed', 'failed'), default='queued')
    priority = Column(Integer, default=5)  # 1=highest, 10=lowest
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationship
    image = relationship("Image", back_populates="processing_jobs")
```

---

## API Changes

### Upload Endpoint Response

**Current:**
```json
{
  "message": "Image uploaded successfully",
  "data": {
    "id": 123,
    "filename": "image.jpg",
    "thumbnail_url": "/api/images/123/file?size=medium",
    ...
  },
  "status_code": 200
}
```

**New:**
```json
{
  "message": "Image uploaded successfully",
  "data": {
    "id": 123,
    "filename": "image.jpg",
    "thumbnail_url": "/api/images/123/file?size=medium",
    "processing_status": "pending",
    "thumbnail_status": "pending",
    "variant_status": "pending",
    ...
  },
  "status_code": 200,
  "background_processing": true
}
```

### New Endpoints

#### GET `/api/images/{id}/processing-status`
Get processing status for a specific image.

**Response:**
```json
{
  "image_id": 123,
  "processing_status": "complete",
  "thumbnail_status": "complete",
  "variant_status": "processing",
  "processing_attempts": 1,
  "last_attempt": "2025-11-06T12:34:56Z",
  "completed_at": "2025-11-06T12:35:02Z"
}
```

#### POST `/api/images/{id}/retry-processing`
Manually retry failed processing.

#### GET `/api/admin/processing-queue`
Admin endpoint for queue monitoring.

**Response:**
```json
{
  "queue_size": 42,
  "processing_count": 3,
  "failed_count": 2,
  "oldest_job_age_seconds": 120,
  "jobs": [
    {
      "id": 456,
      "image_id": 123,
      "job_type": "thumbnail",
      "status": "processing",
      "attempts": 1,
      "created_at": "2025-11-06T12:34:56Z"
    }
  ]
}
```

---

## Frontend Changes

### Upload Flow UX

**Phase 1: Upload**
- User selects images
- Upload begins immediately
- Progress bar shows upload progress (not processing)
- Images appear in gallery with "processing" badge

**Phase 2: Processing Notification**
- After upload completes: "Upload complete! Processing images in background..."
- Toast notification showing processing progress
- User can navigate away, processing continues

**Phase 3: Real-Time Updates**
- WebSocket updates when thumbnails ready
- "Processing" badges removed as images complete
- Failed processing shows "Retry" button

### Image Display Strategy

**Loading States:**
1. **Uploading:** Skeleton loader or upload progress
2. **Processing:** Show low-res preview from original (scaled down)
3. **Thumbnail Ready:** Show thumbnail, badge "Generating variants..."
4. **Complete:** Full quality thumbnails and variants available
5. **Failed:** Show error icon, "Retry" button

### WebSocket Events

Subscribe to processing updates:

```typescript
socket.on('image:processing:thumbnail_complete', (data) => {
  // Update image status, remove "processing" badge
  updateImageStatus(data.image_id, { thumbnail_status: 'complete' });
});

socket.on('image:processing:complete', (data) => {
  // All processing done
  updateImageStatus(data.image_id, { processing_status: 'complete' });
  showToast('Image processing complete', 'success');
});

socket.on('image:processing:failed', (data) => {
  // Show error state
  updateImageStatus(data.image_id, { 
    processing_status: 'failed',
    error: data.error_message 
  });
});
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
**Goal:** Basic async processing with FastAPI BackgroundTasks

**Tasks:**
1. Database schema updates (add processing status fields)
2. Create Alembic migration for schema changes
3. Update Image model with new fields
4. Refactor `process_and_store_image()` to skip thumbnail/variant generation
5. Create separate `process_thumbnails()` function
6. Create separate `process_variants()` function
7. Update upload endpoint to queue background tasks
8. Add processing status to image API responses

**Deliverable:** Uploads complete in <500ms, processing happens in background

### Phase 2: Monitoring & Retry (Week 2)
**Goal:** Visibility and reliability

**Tasks:**
1. Add processing status tracking in database
2. Implement retry logic for failed jobs
3. Create admin endpoint for queue monitoring
4. Add logging for all processing operations
5. Create `/retry-processing` endpoint
6. Add error handling and fallback logic

**Deliverable:** Admins can monitor processing, users can retry failures

### Phase 3: Frontend Integration (Week 2-3)
**Goal:** Real-time updates and better UX

**Tasks:**
1. Add WebSocket events for processing updates
2. Update image gallery to show processing status
3. Add "processing" badges and loading states
4. Implement fallback rendering (show original if thumbnails missing)
5. Add toast notifications for processing completion
6. Update upload progress UI to separate upload from processing

**Deliverable:** Users see real-time processing status, smooth UX

### Phase 4: Optimization (Week 3-4)
**Goal:** Performance and scalability

**Tasks:**
1. Implement batch processing for efficiency
2. Add priority queue (thumbnails before variants)
3. Optimize thumbnail generation (parallel processing)
4. Add circuit breaker for repeated failures
5. Performance testing and tuning
6. Migration guide for existing images

**Deliverable:** System can handle 1000+ images efficiently

### Phase 5: Migration to RQ (Optional - Week 4-5)
**Goal:** Production-grade queue with persistence

**Tasks:**
1. Add Redis to Docker setup
2. Install and configure RQ
3. Create RQ worker service
4. Migrate background tasks from FastAPI to RQ
5. Update Docker Compose for RQ worker
6. Add RQ dashboard for monitoring
7. Test persistence across restarts

**Deliverable:** Production-ready persistent queue

---

## Testing Strategy

### Unit Tests

**Backend:**
- `test_upload_without_processing()` - Upload completes quickly
- `test_thumbnail_generation_task()` - Thumbnails generated correctly
- `test_variant_generation_task()` - Variants generated correctly
- `test_processing_retry_logic()` - Failed jobs retry properly
- `test_duplicate_detection_still_works()` - Duplicate check before processing

**Frontend:**
- `test_processing_status_display()` - Status badges show correctly
- `test_websocket_updates()` - Real-time updates work
- `test_fallback_rendering()` - Originals displayed if thumbnails missing

### Integration Tests

- `test_end_to_end_upload_flow()` - Full flow from upload to processing
- `test_bulk_upload_with_processing()` - 100+ images processed correctly
- `test_processing_failure_handling()` - Failures handled gracefully
- `test_server_restart_persistence()` - Jobs survive restart (if using RQ)

### Performance Tests

- **Upload Speed:** Measure p50, p95, p99 response times
- **Processing Throughput:** Images processed per minute
- **Queue Performance:** Time to process 1000 image backlog
- **Concurrent Users:** Multiple users uploading simultaneously

### Manual Testing Checklist

- [ ] Upload single image, verify fast response
- [ ] Upload 100 images, verify all process correctly
- [ ] Disconnect network mid-upload, verify resume works
- [ ] Kill backend during processing, verify jobs resume (RQ only)
- [ ] Upload duplicate image, verify processing skipped
- [ ] Manually retry failed processing
- [ ] Check admin dashboard shows accurate queue status
- [ ] Verify WebSocket updates received in real-time

---

## Migration Plan

### For Existing Installations

1. **Pre-Migration:**
   - Run database backup
   - Document current image count and storage usage
   - Test migration on dev environment first

2. **Migration Steps:**
   - Apply Alembic migration (adds new columns)
   - Mark all existing images as `processing_status='complete'`
   - Run script to verify all images have thumbnails/variants
   - Queue processing jobs for any missing thumbnails/variants

3. **Post-Migration:**
   - Monitor processing queue
   - Check logs for any errors
   - Verify admin dashboard shows correct status

### Migration Script

```python
# scripts/migrate_to_background_processing.py

def migrate_existing_images(db: Session):
    """Mark existing images as already processed"""
    images = db.query(Image).all()
    
    for image in images:
        # Check if thumbnails exist
        has_thumbnails = check_thumbnails_exist(image.filename)
        has_variants = check_variants_exist(image.filename)
        
        image.thumbnail_status = 'complete' if has_thumbnails else 'pending'
        image.variant_status = 'complete' if has_variants else 'pending'
        image.processing_status = 'complete' if (has_thumbnails and has_variants) else 'pending'
        
        # Queue processing if needed
        if not has_thumbnails:
            queue_thumbnail_job(image.id)
        if not has_variants:
            queue_variant_job(image.id)
    
    db.commit()
```

---

## Risks and Mitigation

### Risk 1: Processing Failures
**Impact:** High - Users can't view images properly
**Probability:** Medium
**Mitigation:**
- Implement robust retry logic (3 attempts)
- Graceful degradation (show originals)
- Manual retry option for users
- Monitoring and alerting for high failure rates

### Risk 2: Queue Backlog
**Impact:** Medium - Slow processing, poor UX
**Probability:** Medium
**Mitigation:**
- Prioritize thumbnail generation
- Batch processing for efficiency
- Circuit breaker for overload
- Admin dashboard to monitor queue

### Risk 3: Storage Issues
**Impact:** High - Disk full, processing stops
**Probability:** Low
**Mitigation:**
- Disk space monitoring
- Cleanup of failed processing attempts
- Graceful handling of disk full errors
- Pre-flight disk space check

### Risk 4: WebSocket Connection Issues
**Impact:** Low - Users don't see real-time updates
**Probability:** Medium
**Mitigation:**
- Polling fallback if WebSocket fails
- Periodic status refresh
- Clear visual indication of connection status

### Risk 5: Migration Issues
**Impact:** High - Existing images broken
**Probability:** Low
**Mitigation:**
- Thorough testing on dev environment
- Database backup before migration
- Rollback plan documented
- Gradual rollout (dev → staging → prod)

---

## Success Metrics

### Performance Metrics
- **Upload Response Time:** < 500ms (p95), down from 3-5s
- **Thumbnail Generation Time:** < 2s per image
- **Variant Generation Time:** < 5s per image
- **Queue Processing Throughput:** 20+ images/minute

### User Experience Metrics
- **Perceived Upload Speed:** 80-90% improvement
- **Failed Processing Rate:** < 1%
- **Retry Success Rate:** > 90%
- **User Satisfaction:** Positive feedback on upload speed

### System Health Metrics
- **Backend CPU Usage:** < 50% during bulk uploads
- **Queue Backlog:** < 100 images at peak
- **Processing Success Rate:** > 99%
- **Error Rate:** < 0.1%

---

## Open Questions

1. **Should we process thumbnails immediately or truly async?**
   - Option A: Generate thumbnails synchronously (fast), only defer variants
   - Option B: Defer everything, show originals until thumbnails ready
   - **Recommendation:** Option A for better initial UX

2. **How long to keep failed processing jobs?**
   - Auto-retry for 24 hours, then mark as permanently failed?
   - Keep indefinitely with manual retry?
   - **Recommendation:** 3 retries over 1 hour, then manual retry option

3. **Should we add image optimization (compression) to processing?**
   - Could save storage space
   - Additional processing time
   - **Recommendation:** Separate feature, not in initial release

4. **What about video support?**
   - Videos need similar background processing
   - More complex (transcoding, thumbnails)
   - **Recommendation:** Out of scope, future PRD

---

## Dependencies

### Required
- Python 3.10+
- FastAPI 0.100+
- SQLAlchemy 2.0+
- Pillow 10.0+
- WebSocket support (existing)

### Optional (Phase 5)
- Redis 7.0+ (for RQ)
- RQ 1.15+ (for persistent queue)
- RQ Dashboard (for monitoring)

---

## References

- Current upload code: `backend/api/images.py:28-99`
- Processing logic: `backend/services/image_storage_service.py:397-576`
- FastAPI BackgroundTasks: https://fastapi.tiangolo.com/tutorial/background-tasks/
- RQ Documentation: https://python-rq.org/
- Celery Documentation: https://docs.celeryproject.org/

---

## Approval

**Stakeholders:**
- [ ] Product Owner
- [ ] Engineering Lead
- [ ] DevOps
- [ ] QA Lead

**Approved By:** _________________  
**Date:** _________________

---

## Appendix A: Performance Benchmarks

### Current Performance (Synchronous)
```
Single Image Upload:
- 1 image:   3.2s
- 10 images: 32s (sequential)
- 100 images: 320s (5.3 minutes)

Bulk Upload (batch=4):
- 100 images: ~80s (1.3 minutes)
- 137 images: ~110s (8-11 minutes reported by user)
```

### Target Performance (Asynchronous)
```
Upload Response:
- 1 image:   <0.5s (85% improvement)
- 10 images: <5s (84% improvement)
- 100 images: <50s (84% improvement)

Background Processing:
- Thumbnails: 2s per image
- Variants: 5s per image
- Total: ~7s per image (background)
- 100 images: ~12 minutes total, but users can continue working
```

### Key Insight
User-facing upload time improves by 85%, while background processing can take its time without blocking the user.

---

## Appendix B: Alternative Approaches Considered

### Approach 1: Client-Side Processing
Generate thumbnails in browser before upload.
- **Pros:** No server load, instant thumbnails
- **Cons:** Inconsistent quality, privacy concerns, JavaScript performance issues
- **Verdict:** Rejected - Server-side is more reliable

### Approach 2: CDN with Image Transform
Use CDN (like Cloudflare) to generate thumbnails on-the-fly.
- **Pros:** No storage for variants, automatic optimization
- **Cons:** Ongoing costs, latency, less control
- **Verdict:** Maybe future enhancement, but not replacement

### Approach 3: Separate Processing Service
Microservice architecture for image processing.
- **Pros:** Independent scaling, isolation
- **Cons:** Over-engineered for current scale, deployment complexity
- **Verdict:** Overkill for now, revisit at scale

### Approach 4: Lazy Loading
Generate thumbnails/variants on first request.
- **Pros:** Simple, no queue needed
- **Cons:** Slow first load, race conditions, poor UX
- **Verdict:** Acceptable as fallback, not primary strategy

