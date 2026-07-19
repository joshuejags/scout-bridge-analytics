export const poll = async (fn, interval = 2000, maxAttempts = 10) => {
  let attempts = 0;
  while (attempts < maxAttempts) {
    const { ready, data } = await fn();
    if (ready) {
      return data;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
    attempts += 1;
  }
  throw new Error('Polling timed out');
};
