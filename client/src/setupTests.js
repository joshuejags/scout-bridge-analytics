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
