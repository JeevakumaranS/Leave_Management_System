const DATA_UPDATED_EVENT = 'lms:data-updated';
const DATA_UPDATED_STORAGE_KEY = 'lms:data-updated';

export function notifyLmsDataUpdated() {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new Event(DATA_UPDATED_EVENT));
  try {
    localStorage.setItem(
      DATA_UPDATED_STORAGE_KEY,
      `${Date.now()}-${Math.random()}`,
    );
  } catch (error) {
    console.warn('Could not notify other browser tabs about updated LMS data.', error);
  }
}

export { DATA_UPDATED_EVENT, DATA_UPDATED_STORAGE_KEY };
