The poster service is responsible for sending transactions.
A TypeScript implementation is located in the './peripheral/poster' folder. It retrieves finalized epochs from the
ERC20-bridge extension on the Kwil network and attempts to post them onto EVM blockchains.

Features include:

- Targeting a specific ERC20-bridge extension
- Reposting transactions with higher tips to accelerate processing if the transaction remains pending for too long
- Limiting gas costs using the `gwei_max_fee_per_gas` configuration

To run the service, copy './peripheral/poster/config.json.example' to YOUR_CONFIG_FILE, update the configuration, and
execute `npm run poster YOUR_CONFIG_FILE`.