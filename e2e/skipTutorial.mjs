/** Marks the first-visit tutorial as seen, so flows that aren't about it start straight away. */
export const skipTutorial = (context) => context.addInitScript(() => localStorage.setItem('ivc-tutorial-v1', JSON.stringify({ introSeen: true, active: false, done: [] })))
