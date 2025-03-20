The poster service is a transaction sender.
We have a TypeScript implementation in './peripheral/poster' folder, it fetches target erc2-bridge finalized epochs from Kwil network, and try to post it onto evm blockchains.

It has followed features:
- target one erc20-bridge extension
- re-post transaction with higher tips to speedup, if transaction waits too long
- cap gas cost through the `gwei_max_fee_per_gas` configuration

To run it, copy './peripheral/poster/config.json.example' to YOUR_CONFIG_FILE, modify the config, and run `npm run poster YOUR_CONFIG_FILE`