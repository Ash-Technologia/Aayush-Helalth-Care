'use strict';

const cron = require('node-cron');
const mongoose = require('mongoose');

/**
 * Cleanup Job: Expired Appointment Locks
 *
 * Runs every 5 minutes.
 * Finds appointments with:
 *   - status === 'awaiting_payment'
 *   - lockedUntil <= now (lock has expired)
 *
 * Sets their status to 'expired', freeing the slot for others to book.
 *
 * Why a job instead of MongoDB TTL index:
 *   - TTL indexes DELETE the document, losing booking history.
 *   - This job UPDATES the status to 'expired', preserving the audit trail.
 *   - The partial compound index automatically stops counting 'expired'
 *     appointments as blocking slots (it only covers awaiting_payment,
 *     pending_approval, confirmed).
 *
 * MongoDB must be connected before this module is required.
 * Called from src/index.js after connectDB() resolves.
 */

let isRunning = false; // prevent overlapping runs

const runCleanup = async () => {
  if (isRunning) {
    console.log('[Cleanup] Previous run still in progress. Skipping.');
    return;
  }

  isRunning = true;

  try {
    // Lazy-load to avoid circular dependency at startup
    const Appointment = require('../models/Appointment');

    const now = new Date();
    const result = await Appointment.updateMany(
      {
        status: 'awaiting_payment',
        lockedUntil: { $lte: now, $ne: null },
      },
      {
        $set: { status: 'expired' },
        $unset: { lockedUntil: '' },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(
        `[Cleanup] Expired ${result.modifiedCount} appointment lock(s) at ${now.toISOString()}.`
      );
    }
  } catch (err) {
    console.error('[Cleanup] Error during expired lock cleanup:', err.message);
  } finally {
    isRunning = false;
  }
};

// ─── Schedule: every 5 minutes ────────────────────────────────────────────────
// Cron expression: '*/5 * * * *'
const job = cron.schedule('*/5 * * * *', runCleanup, {
  scheduled: true,
  timezone: 'Asia/Kolkata', // Run in clinic's local timezone context
});

console.log('[Cleanup] Scheduled expired lock cleanup every 5 minutes.');

// ─── Run once immediately on startup ─────────────────────────────────────────
// Cleans up any locks that expired while the server was down.
// Small delay to ensure Mongoose is fully ready.
setTimeout(runCleanup, 3000);

module.exports = { job, runCleanup };
