# Property Video Reels Integration Roadmap & Technical Architecture

## 1. Executive Summary & Why Reels Were Temporarily Archived

In real-time testing, the YouTube embed reels player encountered standard modern browser audio autoplay policies:
- **Browser Security Policy**: All modern browsers (Google Chrome, Apple Safari, Mozilla Firefox) enforce strict autoplay policies. Unmuted autoplay (`autoplay=1` without `mute=1`) inside cross-origin `<iframe>` elements is blocked unless the user has directly interacted with the iframe itself.
- **Audio Clashing / Double Sound**: When users swipe rapidly across iframe embeds, iframe disposal and audio state cannot be synchronously guaranteed without the full YouTube IFrame Player JS API.
- **User Decision**: Per user directive, the Reels button and badges have been temporarily removed from the homepage feed and site cards to keep the browsing UX clean, fast, and stable. The underlying component (`frontend/app/components/ReelsModal.tsx`) and test suite (`frontend/tests/reels-modal.spec.ts.archived`) have been preserved in the codebase for future integration.

---

## 2. Technical Comparison: YouTube Embeds vs Native Video Pipeline

| Metric / Requirement | YouTube `<iframe>` Embeds | Native Video Pipeline (Cloudflare Stream / S3 + `<video>`) |
| :--- | :--- | :--- |
| **Autoplay with Sound on Scroll** | ❌ Blocked by browser security policy | ⚠️ Requires 1 initial user tap ("Enable Audio"), then all subsequent videos play with sound smoothly |
| **Instant Swiping / Snapping** | ⚠️ Noticeable latency (loading YouTube player bundle per reel) | ⚡ Instantaneous (preloading `<video>` tags via HLS / MP4) |
| **Audio Leak Prevention** | ⚠️ Tricky with iframes (requires waiting for iframe destruction) | ✅ Trivial: `videoRef.current.pause()` / `src = ""` guarantees 0 audio bleed |
| **Custom UI & Brand Overlay** | ⚠️ YouTube branding & controls appear | ✅ 100% custom UI: TikTok-style heart, share, visit buttons, price badges |
| **Hosting & Infrastructure** | Free (hosted on YouTube) | Small cost (e.g., Cloudflare Stream ~$5/month per 1,000 mins) |

---

## 3. Recommended Production Architectures for Re-Implementation

### Option A: Native Video Pipeline (Recommended for TikTok / Instagram Experience)
1. **Video Ingestion & CDN**:
   - Store short vertical property video clips (9:16 aspect ratio, under 60 seconds) in Cloudflare Stream or AWS S3 + CloudFront.
   - Serve adaptive HLS (`.m3u8`) or lightweight MP4 streams.
2. **Audio Activation Protocol**:
   - On the first open of Reels, show an initial "🔊 Tap anywhere to enable sound" overlay.
   - Once the user taps, initialize a Web Audio context or call `video.play()` with `muted = false`.
   - All subsequent video swipes down or up will seamlessly autoplay **with sound** at full volume.
3. **Preloading & Virtualization**:
   - Preload the next video (`preload="metadata"` or `auto`) to ensure zero-buffering transitions.

### Option B: YouTube IFrame Player JS API (Zero Storage Costs)
If staying with YouTube videos:
1. Load the official YouTube IFrame Player API script (`https://www.youtube.com/iframe_api`).
2. Manage a single persistent player instance instead of creating/destroying iframes.
3. Provide a prominent "Tap to Unmute" banner on the first reel to satisfy browser user-gesture requirements.
4. On swipe, call `player.loadVideoById(nextSiteYoutubeId)` directly, avoiding iframe re-mount overhead.

---

## 4. Re-enabling Steps When Ready

When ready to reinstate Reels:
1. **Frontend Page**:
   - Re-import `ReelsModal` in `frontend/app/page.tsx`.
   - Restore `isReelsOpen` and `selectedReelSiteId` state.
   - Add back the `⚡ Watch Reels` pill in the filter bar.
   - Pass `onOpenReels` to `<SiteCard />`.
2. **Site Card**:
   - Add `onOpenReels?: (siteId: string) => void` back to `SiteCardProps` in `frontend/app/components/SiteCard.tsx`.
3. **Tests**:
   - Rename `frontend/tests/reels-modal.spec.ts.archived` back to `frontend/tests/reels-modal.spec.ts`.
