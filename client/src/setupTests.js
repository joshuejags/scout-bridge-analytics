import '@testing-library/jest-dom';

// AuthContext opens a real socket.io connection on login/session-restore.
// jsdom has no real network, and socket.io-client's reconnection timers
// would otherwise keep running past a test's lifetime (open-handle
// warnings, occasional flakiness) — stub it globally so every test gets a
// harmless fake socket instead of a real connection attempt.
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

// Browser APIs used by the workspace shell are not provided by jsdom.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
