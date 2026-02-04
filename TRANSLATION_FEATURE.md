# Real-Time Translation Feature Implementation

## Overview

This document describes the implementation of the real-time translation feature on the viewer page. Two options are available:

1. **Chrome Translator API** – On-device translation (Chrome 138+).
2. **Server translation API** – Optional server-side translation (e.g. [DeepL](https://www.deepl.com/pro-api)) so viewers can translate in any browser.

When both are available, the viewer shows a **Translation** dropdown: **Chrome (on-device)** or **API (server)**. When only the API is configured, translation uses the server. When only Chrome supports translation, the Chrome path is used.

### Enabling server translation (DeepL)

1. Get an API key from [DeepL](https://www.deepl.com/pro-api) (free tier available).
2. In `.env.local` set:
   - `TRANSLATION_API_PROVIDER=deepl`
   - `DEEPL_API_KEY=your_key`
3. Restart the dev server. The viewer will show **API (server)** when a target language is selected.

## Implementation Details

### Technology Stack

- **Chrome Translator API**: On-device translation using Chrome's built-in AI (Chrome 138+)
- **React**: State management for translations
- **TypeScript**: Type-safe implementation with custom type definitions

### Key Components

#### 1. Type Definitions

Custom TypeScript interfaces for the Chrome Translator API:

- `TranslatorCreateOptions`: Configuration for creating a translator
- `TranslatorMonitor`: Monitor for download progress
- `TranslatorDownloadProgressEvent`: Progress event interface
- `Translator`: The translator instance interface
- `TranslatorConstructor`: The Translator API constructor

#### 2. State Management

The implementation tracks:

- `targetLanguage`: Selected target language for translation
- `translatedCaptions`: Map of caption IDs to translated text
- `translatedPartialText`: Translated partial transcript
- `isTranslatorSupported`: Browser support detection
- `isTranslating`: Loading state during translation
- `translationError`: Error messages for troubleshooting
- `downloadProgress`: Model download progress percentage
- `translatorRef`: Reference to the active translator instance

#### 3. Translation Logic

**Feature Detection**

```typescript
useEffect(() => {
  if (typeof window !== "undefined" && "Translator" in self) {
    setIsTranslatorSupported(true);
  }
}, []);
```

**Translator Creation**

- Creates translator instance when language changes
- Monitors download progress for translation models
- Translates all existing captions
- Handles cleanup on unmount or language change

**Real-Time Translation**

- Translates new captions as they arrive
- Debounces partial transcript translation (500ms)
- Maintains translation cache to avoid re-translating

#### 4. UI Components

**Language Selector**

- Dropdown with 15 languages (including "Original (No Translation)")
- Displays loading state during translation
- Shows download progress when models are being downloaded

**Translation Status**

- Loading badge with spinner during translation
- Download progress indicator
- Error alerts for troubleshooting
- Browser compatibility message for unsupported browsers

**Caption Display**

- Shows translated text when available
- Falls back to original text if translation fails
- Language badge indicator on translated captions
- Supports both final captions and partial transcripts

### Supported Languages

1. Original (No Translation)
2. English
3. Spanish
4. French
5. German
6. Italian
7. Portuguese
8. Dutch
9. Russian
10. Japanese
11. Korean
12. Chinese (Simplified)
13. Arabic
14. Hindi
15. Turkish

### Key Features

#### Privacy-First Design

- All translation happens on-device
- No data sent to external servers
- Chrome's built-in AI models

#### Performance Optimized

- Debounced partial text translation (500ms)
- Translation caching to avoid duplicates
- Sequential processing for efficiency

#### User Experience

- Automatic feature detection
- Progressive enhancement (works without translation)
- Clear error messages and troubleshooting hints
- Visual feedback for all states (loading, downloading, translating)

#### Error Handling

- Graceful fallback to original text
- Detailed error messages
- Console logging for debugging
- Try-catch blocks around all translation operations

### Browser Requirements

- **Google Chrome 138+** with built-in AI features enabled
- The Translator API must be available in `window.Translator`
- Internet connection required for first-time model download
- Models are cached locally for offline use

### Usage Flow

1. **Viewer opens the page**

   - Browser support is automatically detected
   - Language selector appears if supported

2. **Viewer selects a language**

   - Translator instance is created
   - Model downloads if needed (with progress indicator)
   - All existing captions are translated
   - Translation state is saved

3. **New captions arrive**

   - Automatically translated if language is selected
   - Translation cache updated
   - UI shows translated text with language badge

4. **Partial transcripts update**
   - Debounced translation (500ms)
   - Prevents excessive API calls
   - Smooth user experience

### File Changes

**Modified Files:**

- `/components/viewer-interface.tsx`: Complete translation implementation
- `/SCRIBE_SETUP.md`: Added documentation for translation feature
- `/TRANSLATION_FEATURE.md`: This file (new)

### Testing Checklist

- [x] Build succeeds without errors
- [ ] Feature detection works correctly
- [ ] Language selector appears in Chrome 138+
- [ ] Translation works for existing captions
- [ ] Translation works for new captions
- [ ] Translation works for partial transcripts
- [ ] Download progress indicator shows correctly
- [ ] Error handling works as expected
- [ ] Fallback to original text works
- [ ] Browser not supported message displays correctly
- [ ] Translation caching prevents duplicates
- [ ] Cleanup on unmount works properly

### Future Enhancements

1. **Language Detection**: Automatically detect source language using Chrome's Language Detector API
2. **User Preferences**: Save selected language in localStorage
3. **Translation History**: Export translated captions
4. **Multiple Source Languages**: Support detection of different source languages
5. **Streaming Translation**: Implement `translateStreaming()` for longer texts

### Troubleshooting

**Translation not working?**

1. Ensure Chrome 138+ is installed
2. Check `chrome://flags` for AI feature flags
3. Allow model downloads (first-time setup)
4. Check browser console for errors

**Model download stuck?**

1. Verify internet connection
2. Try a different language pair
3. Clear Chrome cache and restart
4. Check if storage quota is available

**Captions not translating?**

1. Check if language is selected (not "Original")
2. Verify translator instance is created
3. Look for error messages in UI
4. Check console logs for detailed errors

### Performance Considerations

- **Initial Load**: Minimal impact (feature detection only)
- **Model Download**: One-time per language pair (cached thereafter)
- **Translation Speed**: Near-instant for short texts (<100ms)
- **Memory Usage**: Translator instance is lightweight
- **Cleanup**: Proper cleanup prevents memory leaks

### Security & Privacy

- **On-Device Processing**: All translation happens locally
- **No External API Calls**: After model download, works offline
- **No Data Leakage**: Captions never leave the device for translation
- **Browser Sandboxing**: Chrome's security model applies
- **User Control**: Users choose when to enable translation

## References

- [Chrome Translator API Documentation](https://developer.chrome.com/docs/ai/translator-api)
- [Chrome Built-in AI Overview](https://developer.chrome.com/docs/ai/built-in)
- [BCP 47 Language Codes](https://en.wikipedia.org/wiki/IETF_language_tag)

## License

Same as parent project.
