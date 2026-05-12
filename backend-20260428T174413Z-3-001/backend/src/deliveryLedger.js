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
  createMemoryDeliveryLedger
};
