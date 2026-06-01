'use strict';

/**
 * Slot Generator — Pure utility functions for the availability algorithm.
 *
 * All functions are stateless and have no DB dependencies.
 * This makes them independently testable and usable in both
 * the slot availability route and the admin slot preview.
 */

// ─── Time Conversion ──────────────────────────────────────────────────────────

/**
 * Converts an HH:mm string to total minutes since midnight.
 * @param {string} time - e.g. "09:30"
 * @returns {number} e.g. 570
 */
const timeToMins = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Converts total minutes since midnight to HH:mm string.
 * @param {number} mins - e.g. 570
 * @returns {string} e.g. "09:30"
 */
const minsToTime = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// ─── Slot Generation ──────────────────────────────────────────────────────────

/**
 * Generates an array of { slotStart, slotEnd } objects by dividing a
 * time block into equal-duration slots.
 *
 * The last slot is only included if it fits fully within the end time.
 *
 * @param {string} startTime      - HH:mm e.g. "09:00"
 * @param {string} endTime        - HH:mm e.g. "13:00"
 * @param {number} durationMins   - e.g. 30
 * @returns {{ slotStart: string, slotEnd: string }[]}
 */
const generateTimeSlots = (startTime, endTime, durationMins) => {
  const slots = [];
  const startMins = timeToMins(startTime);
  const endMins   = timeToMins(endTime);

  for (let cur = startMins; cur + durationMins <= endMins; cur += durationMins) {
    slots.push({
      slotStart: minsToTime(cur),
      slotEnd:   minsToTime(cur + durationMins),
    });
  }

  return slots;
};

// ─── Break-time Filtering ─────────────────────────────────────────────────────

/**
 * Returns true if a slot overlaps (even partially) with any break period.
 * A slot is excluded if any part of it falls within a break.
 *
 * Overlap condition: slotStart < breakEnd AND slotEnd > breakStart
 *
 * @param {string} slotStart     - HH:mm
 * @param {string} slotEnd       - HH:mm
 * @param {{ start: string, end: string }[]} breakTimings
 * @returns {boolean}
 */
const isInBreakTime = (slotStart, slotEnd, breakTimings) => {
  if (!breakTimings || breakTimings.length === 0) return false;

  const slotStartMins = timeToMins(slotStart);
  const slotEndMins   = timeToMins(slotEnd);

  return breakTimings.some((brk) => {
    const breakStartMins = timeToMins(brk.start);
    const breakEndMins   = timeToMins(brk.end);
    return slotStartMins < breakEndMins && slotEndMins > breakStartMins;
  });
};

// ─── Past-slot Filtering ──────────────────────────────────────────────────────

/**
 * Returns true if a slot has already started (for today's date).
 * Adds a 5-minute buffer so users can't book a slot that starts in <5 minutes.
 *
 * @param {string} slotStart     - HH:mm
 * @param {Date}   requestDate   - The appointment date (normalized to UTC midnight)
 * @returns {boolean}
 */
const isSlotInPast = (slotStart, requestDate) => {
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  // Only apply past-slot logic if the requested date is today
  if (requestDate.getTime() !== today.getTime()) return false;

  const slotMins = timeToMins(slotStart);
  const currentMins = now.getUTCHours() * 60 + now.getUTCMinutes() + 5; // +5 min buffer

  return slotMins <= currentMins;
};

// ─── Full Pipeline ────────────────────────────────────────────────────────────

/**
 * Runs the complete slot generation + filtering pipeline for one SlotTemplate.
 *
 * @param {Object}   template          - A SlotTemplate document
 * @param {string[]} blockedSlotStarts - Already-booked slotStart values
 * @param {Object[]} breakTimings      - DoctorProfile.breakTimings
 * @param {Date}     requestDate       - Appointment date (UTC midnight)
 * @param {string}   requestedType     - 'online' | 'clinic'
 * @returns {{ slotStart, slotEnd, consultationType, fee }[]}
 */
const filterAvailableSlots = (
  template,
  blockedSlotStarts,
  breakTimings,
  requestDate,
  requestedType,
  fee
) => {
  const raw = generateTimeSlots(
    template.startTime,
    template.endTime,
    template.slotDurationMins
  );

  const blockedSet = new Set(blockedSlotStarts);

  return raw
    .filter((slot) => !blockedSet.has(slot.slotStart))
    .filter((slot) => !isInBreakTime(slot.slotStart, slot.slotEnd, breakTimings))
    .filter((slot) => !isSlotInPast(slot.slotStart, requestDate))
    .map((slot) => ({
      slotStart: slot.slotStart,
      slotEnd:   slot.slotEnd,
      consultationType: requestedType,
      fee,
    }));
};

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Deduplicates a flat array of slots by slotStart.
 * When two templates generate the same slot time, the first one wins.
 * Sorts the result chronologically.
 *
 * @param {{ slotStart: string }[]} slots
 * @returns {{ slotStart: string }[]}
 */
const deduplicateSlots = (slots) => {
  const seen = new Set();
  const unique = [];
  for (const slot of slots) {
    if (!seen.has(slot.slotStart)) {
      seen.add(slot.slotStart);
      unique.push(slot);
    }
  }
  // Sort chronologically
  unique.sort((a, b) => timeToMins(a.slotStart) - timeToMins(b.slotStart));
  return unique;
};

module.exports = {
  timeToMins,
  minsToTime,
  generateTimeSlots,
  isInBreakTime,
  isSlotInPast,
  filterAvailableSlots,
  deduplicateSlots,
};
