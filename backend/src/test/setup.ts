// Jest setup file for backend tests
import { logger } from '../utils/logger';

// Suppress logs during testing
logger.silent = true;

// Global test setup
beforeAll(() => {
  // Setup test database or other resources
});

afterAll(() => {
  // Cleanup test resources
});

beforeEach(() => {
  // Reset state before each test
});

afterEach(() => {
  // Cleanup after each test
});