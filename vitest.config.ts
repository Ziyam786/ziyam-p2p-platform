import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // The money path is what these tests exist to protect. Coverage
    // thresholds are deliberately scoped to those modules rather than the
    // whole repo — a repo-wide number would be gameable by testing the easy
    // parts and would not tell us the thing we actually need to know.
    coverage: {
      provider: 'v8',
      include: [
        'src/backend/services/gstService.ts',
        'src/backend/services/payoutEngine.ts',
        'src/backend/utils/razorpaySignature.ts',
      ],
      reporter: ['text', 'html'],
    },
  },
});
