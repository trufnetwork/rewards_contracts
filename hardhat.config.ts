import type { HardhatUserConfig, HttpNetworkUserConfig } from "hardhat/types";

import "@nomicfoundation/hardhat-toolbox";

import dotenv from 'dotenv';

const solidityVersion = "0.8.27";

// Load environment variables.
dotenv.config();
const { SEPOLIA_RPC, BASE_SEPOLIA_RPC, MAINNET_RPC, ETHERSCAN_API_KEY, PK, MNEMONIC } = process.env;

const DEFAULT_MNEMONIC = "test test test test test test test test test test test junk" // same as hardhat's default mnemonic

const sharedNetworkConfig: HttpNetworkUserConfig = {};
if (PK) {
    sharedNetworkConfig.accounts = [PK];
} else {
    sharedNetworkConfig.accounts = {
        mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
    };
}


// import custom tasks
import "./tasks/misc";
import "./tasks/deploy_factory";
import "./tasks/deploy_clone";
import "./tasks/deploy_safe";


const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    solidity: {
        version: solidityVersion,
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            },
            evmVersion: `paris`, // https://github.com/NomicFoundation/hardhat/issues/4232
        },
    },
    networks: {
        hardhat: {
            // hardfork: "merge", // https://ethereum.org/en/history/#paris
            gasPrice: 1000000000,
        },
        sepolia: {
            ...sharedNetworkConfig,
            url: SEPOLIA_RPC,
            chainId: 11155111,
        },
        baseSepolia: {
            ...sharedNetworkConfig,
            url: BASE_SEPOLIA_RPC,
            chainId: 84532,
        },
        mainnet: {
            ...sharedNetworkConfig,
            url: MAINNET_RPC,
            chainId: 1,
        },
    },
  etherscan: {
      apiKey: ETHERSCAN_API_KEY,
      customChains: [
          {
              network: "base-sepolia",
              chainId: 84532,
              urls: {
                  apiURL: "https://base-sepolia.blockscout.com/api",
                  browserURL: "https://base-sepolia.blockscout.com/",
              }
          }
      ]
  },
  sourcify: {
        enabled: false,
  }
};

export default config;
