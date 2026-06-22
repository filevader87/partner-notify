const fs = require('node:fs')

function createConsoleDeliveryLedger() {
  return {
    async recordRecipient(record) {
      console.info(JSON.stringify({
        event: 'delivery_ledger_recorded',
        ...record
      }));
    },

    async recordProviderStatus(record) {
      console.info(JSON.stringify({
        event: 'provider_status_recorded',
        ...record
      }));
    }
  };
}

function createFileDeliveryLedger({ filePath = './delivery-ledger.jsonl' } = {}) {
  async function appendLine(data) {
    try {
      await fs.promises.appendFile(filePath, JSON.stringify(data) + '\n')
    } catch (error) {
      console.error('Failed to write delivery ledger:', error.message)
    }
  }

  return {
    async recordRecipient(record) {
      await appendLine({ event: 'delivery_ledger_recorded', ...record })
    },

    async recordProviderStatus(record) {
      await appendLine({ event: 'provider_status_recorded', ...record })
    }
  }
}

function createMemoryDeliveryLedger() {
  const records = [];
  const statusRecords = [];

  return {
    records,
    statusRecords,

    async recordRecipient(record) {
      records.push(record);
    },

    async recordProviderStatus(record) {
      statusRecords.push(record);
    }
  };
}

module.exports = {
  createConsoleDeliveryLedger,
  createFileDeliveryLedger,
  createMemoryDeliveryLedger
};
