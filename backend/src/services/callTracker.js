/**
 * In-memory call tracking service for monitoring outbound calls and IVR events.
 */
class CallTracker {
  constructor() {
    this.calls = new Map();
    this.maxHistory = 100;
  }

  registerCall(callUuid, data) {
    const record = {
      callUuid,
      toNumber: data.toNumber,
      fromNumber: data.fromNumber,
      status: 'initiated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      events: [
        {
          timestamp: new Date().toISOString(),
          type: 'CALL_INITIATED',
          message: `Outbound call initiated to ${data.toNumber}`,
          details: data
        }
      ]
    };

    this.calls.set(callUuid, record);
    this._prune();
    return record;
  }

  updateStatus(callUuid, status, details = {}) {
    let record = this.calls.get(callUuid);
    if (!record) {
      record = {
        callUuid,
        toNumber: details.To || 'Unknown',
        fromNumber: details.From || 'Unknown',
        status: status || 'unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        events: []
      };
      this.calls.set(callUuid, record);
    }

    record.status = status;
    record.updatedAt = new Date().toISOString();
    record.events.push({
      timestamp: new Date().toISOString(),
      type: `STATUS_${status.toUpperCase()}`,
      message: `Call status changed to: ${status}`,
      details
    });

    this._prune();
    return record;
  }

  addEvent(callUuid, eventType, message, details = {}) {
    let record = this.calls.get(callUuid);
    if (!record && callUuid) {
      record = {
        callUuid,
        toNumber: details.To || 'Unknown',
        fromNumber: details.From || 'Unknown',
        status: 'in-progress',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        events: []
      };
      this.calls.set(callUuid, record);
    }

    if (record) {
      record.updatedAt = new Date().toISOString();
      record.events.push({
        timestamp: new Date().toISOString(),
        type: eventType,
        message,
        details
      });
    }

    return record;
  }

  getCall(callUuid) {
    return this.calls.get(callUuid) || null;
  }

  getAllCalls() {
    return Array.from(this.calls.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  _prune() {
    if (this.calls.size > this.maxHistory) {
      const keys = Array.from(this.calls.keys());
      const excess = keys.length - this.maxHistory;
      for (let i = 0; i < excess; i++) {
        this.calls.delete(keys[i]);
      }
    }
  }
}

module.exports = new CallTracker();
