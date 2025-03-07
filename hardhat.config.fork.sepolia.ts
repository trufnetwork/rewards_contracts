import { HardhatUserConfig, vars } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import dotenv from 'dotenv';

// Load environment variables.
dotenv.config();
const { SEPOLIA_RPC, MAINNET_RPC, ETHERSCAN_API_KEY, PK, MNEMONIC } = process.env;
const DEFAULT_MNEMONIC = "test test test test test test test test test test test junk" // same as hardhat's default mnemonic


// @ts-ignore
const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      hardfork: "merge", // https://ethereum.org/en/history/#paris
      forking: {
          url: SEPOLIA_RPC!,
          blockNumber: 7606599,
      },
      chainId: 11155111,  // chainId must be the same as the forking network
        accounts: PK ? [PK] : {
            mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
        },
    },
  },
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: `paris`, // https://github.com/NomicFoundation/hardhat/issues/4232
    }
  },
};

export default config;
