import type { HardhatUserConfig, HttpNetworkUserConfig, HttpNetworkAccountsUserConfig } from "hardhat/types";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from 'dotenv';

dotenv.config();
const { MAINNET_RPC, PK, MNEMONIC, ETHERSCAN_API_KEY } = process.env;

const DEFAULT_MNEMONIC = "test test test test test test test test test test test junk";

const accounts: HttpNetworkAccountsUserConfig = PK 
    ? [PK] 
    : { mnemonic: MNEMONIC || DEFAULT_MNEMONIC };

const sharedNetworkConfig: HttpNetworkUserConfig = { accounts };

// Import custom tasks
import "./tasks/misc";
import "./tasks/deploy_factory";
import "./tasks/deploy_clone";
import "./tasks/deploy_safe";
import "./tasks/deploy_upgradeable_factory";
import "./tasks/deploy_upgradeable_proxy";
import "./tasks/deploy_new_implementation";
import "./tasks/check_implementation";
import "./tasks/generate_safe_upgrade_data";

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    solidity: {
        version: "0.8.27",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            },
            evmVersion: "paris",
        },
    },
    networks: {
        hardhat: {
            forking: {
                url: MAINNET_RPC || "https://eth.llamarpc.com",
                // blockNumber: 18500000, // Optional: pin to specific block
            },
            gas: 30000000, // 30M gas limit
            blockGasLimit: 30000000,
            gasPrice: 20000000000, // 20 gwei
        },
        localhost: {
            url: "http://127.0.0.1:8545",
            gas: 10000000,
        },
        mainnet: {
            ...sharedNetworkConfig,
            url: MAINNET_RPC || "https://eth.llamarpc.com",
            chainId: 1
        },
    },
    etherscan: {
      apiKey: ETHERSCAN_API_KEY,
      customChains: [
          {
              network: "mainnet",
              chainId: 1,
              urls: {
                  apiURL: "https://api.etherscan.io/v2/api?chainId=1",
                  browserURL: "https://etherscan.io",
              }
          }
      ]
    }
};

export default config;