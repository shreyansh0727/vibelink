"use strict";

const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");
const { onValueCreated } = require("firebase-functions/v2/database");
const logger = require("firebase-functions/logger");

initializeApp();

const ALLOWED_PATTERNS = new Set([
  "tap",
  "double",
  "wave",
  "heartbeat",
  "ripple",
  "sos",
  "long",
  "custom",
]);
const MAX_TIMINGS = 41;
const MAX_TIMING_MS = 10_000;
const MAX_PATTERN_TOTAL_MS = 30_000;
const DEAD_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

exports.relayPulse = onValueCreated(
  {
    ref: "/pairs/{pairId}/triggers/{triggerId}",
    region: "us-central1",
  },
  async event => {
    const { pairId, triggerId } = event.params;
    const database = getDatabase();
    const triggerRef = database.ref(
      `pairs/${pairId}/triggers/${triggerId}`,
    );
    let recipientUid = null;
    let recipientToken = null;

    try {
      const trigger = event.data.val();
      if (!trigger || typeof trigger.from !== "string") {
        logger.warn("Discarded a malformed pulse trigger.", { pairId });
        return;
      }

      const membersSnapshot = await database
        .ref(`pairs/${pairId}/members`)
        .once("value");
      const members = membersSnapshot.val() || {};

      if (!members[trigger.from]) {
        logger.warn("Discarded a pulse from a non-member.", {
          pairId,
          sender: trigger.from,
        });
        return;
      }

      recipientUid = Object.keys(members).find(
        uid => uid !== trigger.from,
      );
      if (!recipientUid) {
        logger.info("Pulse skipped because the pair has no other phone.", {
          pairId,
        });
        return;
      }

      const tokenSnapshot = await database
        .ref(`notificationTokens/${recipientUid}/token`)
        .once("value");
      recipientToken = tokenSnapshot.val();
      if (!recipientToken || typeof recipientToken !== "string") {
        logger.warn("Pulse skipped because the recipient has no FCM token.", {
          pairId,
          recipient: recipientUid,
        });
        return;
      }

      const pattern = ALLOWED_PATTERNS.has(trigger.pattern)
        ? trigger.pattern
        : "tap";

      const data = {
        type: "buzz",
        pattern,
        triggerId,
        fromName: String(trigger.fromName || "Your other phone").slice(0, 64),
      };

      if (pattern === "custom") {
        const timings = sanitizeTimings(trigger.timings);
        if (timings) {
          data.timings = JSON.stringify(timings);
          const amplitudes = sanitizeAmplitudes(
            trigger.amplitudes,
            timings.length,
          );
          if (amplitudes) {
            data.amplitudes = JSON.stringify(amplitudes);
          }
        }
        const label =
          typeof trigger.patternLabel === "string"
            ? trigger.patternLabel.trim().slice(0, 24)
            : "";
        if (label) {
          data.label = label;
        }
      }

      await getMessaging().send({
        token: recipientToken,
        data,
        android: {
          priority: "high",
          ttl: 60 * 1000,
        },
      });

      logger.info("Silent pulse delivered to FCM.", {
        pairId,
        triggerId,
        recipient: recipientUid,
        pattern,
        custom: Boolean(data.timings),
      });
    } catch (error) {
      logger.error("Pulse relay failed.", {
        pairId,
        triggerId,
        code: error?.code,
        message: error?.message,
      });

      if (
        recipientUid &&
        recipientToken &&
        DEAD_TOKEN_CODES.has(error?.code)
      ) {
        await removeDeadToken(database, recipientUid, recipientToken);
      }
    } finally {
      await triggerRef.remove().catch(error => {
        logger.warn("Could not remove a processed trigger.", {
          pairId,
          triggerId,
          message: error?.message,
        });
      });
    }
  },
);

function sanitizeTimings(value) {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_TIMINGS) {
    return null;
  }
  const timings = [];
  for (const entry of value) {
    if (typeof entry !== "number" || !Number.isFinite(entry) || entry < 0) {
      return null;
    }
    timings.push(Math.min(MAX_TIMING_MS, Math.round(entry)));
  }
  if (timings[0] !== 0) {
    return null;
  }
  const total = timings.reduce((sum, value) => sum + value, 0);
  if (total > MAX_PATTERN_TOTAL_MS) {
    return null;
  }
  return timings;
}

function sanitizeAmplitudes(value, length) {
  if (!Array.isArray(value) || value.length !== length) {
    return null;
  }
  const amplitudes = [];
  for (const entry of value) {
    if (typeof entry !== "number" || !Number.isFinite(entry) || entry < 0) {
      return null;
    }
    amplitudes.push(Math.max(0, Math.min(255, Math.round(entry))));
  }
  return amplitudes;
}

async function removeDeadToken(database, recipientUid, failedToken) {
  const tokenRef = database.ref(`notificationTokens/${recipientUid}/token`);
  try {
    const current = await tokenRef.once("value");
    if (current.val() !== failedToken) {
      return;
    }
    await database.ref(`notificationTokens/${recipientUid}`).remove();
    logger.warn("Removed an FCM token that FCM reported as unregistered.", {
      recipient: recipientUid,
    });
  } catch (error) {
    logger.warn("Could not remove an unregistered FCM token.", {
      recipient: recipientUid,
      message: error?.message,
    });
  }
}
