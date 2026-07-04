# ItsaSign TODO

## Testing & Quality

### Unit Testing (High Priority)
- [ ] Refactor widgets to separate logic from rendering
  - [ ] Extract pure functions (time formatting, temperature conversion, etc.)
  - [ ] Make external dependencies mockable (fetch, API calls)
  - [ ] Separate data fetching from DOM rendering
  - [ ] Create `logic.js` and `render.js` files per widget
  
- [ ] Refactoring Priority Order (simplest first)
  - [ ] moon.js - light refactoring needed
  - [ ] qotd.js - light refactoring needed
  - [ ] xkcd.js - medium refactoring
  - [ ] clock.js - extract time formatting logic
  - [ ] weather.js - heavy, many pure functions to extract
  - [ ] playlist.js & items - already partially done

- [ ] Write unit tests for extracted logic
  - [ ] Use Jest + Node (no jsdom needed)
  - [ ] Test pure functions: formatting, conversions, calculations
  - [ ] Mock external API calls
  - [ ] Aim for >80% code coverage on logic

### E2E Testing (Medium Priority)
- [ ] Set up Puppeteer E2E tests (reuse existing dependency)
  - [ ] Test app loads at localhost:8080
  - [ ] Test sidebar widgets render (clock, weather, moon, qotd)
  - [ ] Test main panel carousel cycles through items
  - [ ] Test RSS feed displays if server is running
  - [ ] Verify no console errors during playback
  - [ ] Note: Do NOT use screenshot testing (too fragile)

- [ ] Add E2E tests to GitHub Actions CI
  - [ ] Ensure dev server and RSS server start
  - [ ] Run tests in headless mode
  - [ ] Report failures

### Code Coverage (Low Priority)
- [ ] Implement coverage reporting in CI
- [ ] Set minimum coverage threshold (>60% target)
- [ ] Coverage only meaningful after unit tests written

---

## Documentation

### WIDGET.md Updates
- [ ] Verify documentation matches current item widget architecture
- [ ] Add examples for creating custom item types
- [ ] Document pure function extraction pattern

### README.md Updates
- [ ] Add E2E testing instructions
- [ ] Document how to run tests locally
- [ ] Add coverage badge (if implemented)

---

## Known Issues & Technical Debt

### Browser/DOM Testing
- **Problem:** JSdom + ESM modules don't play well together in current Jest setup
- **Current State:** Only basic smoke tests (package.json validation)
- **Solution:** Refactor widgets → unit tests, use Puppeteer for E2E

### Widget Architecture
- **Problem:** Logic tightly coupled to rendering, hard to test
- **Current State:** DOM manipulation inside widget functions
- **Solution:** Extract pure functions per widget (see refactoring section above)

### Test Coverage
- **Current:** 0% on widget code
- **Target:** >80% on logic functions, E2E covering main flows

---

## Future Enhancements (Not Urgent)

- [ ] Vitest as ESM-native alternative to Jest (if Jest becomes a problem)
- [ ] Integration tests for RSS server + app together
- [ ] Performance testing with Puppeteer (page load time, memory)
- [ ] Accessibility testing (a11y)
- [ ] Mobile/responsive testing with Playwright (if cross-browser testing needed)

---

## Notes

- **Screenshot Testing:** Explicitly avoiding - too brittle and maintenance-heavy
- **Priority:** Focus on unit tests first (faster feedback), then E2E for confidence
- **Dependencies:** Puppeteer already available, no need to add Playwright
- **CI/CD:** GitHub Actions already set up for lint, audit, and basic tests
