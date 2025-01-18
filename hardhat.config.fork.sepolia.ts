import { HardhatUserConfig, vars } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import dotenv from 'dotenv';
dotenv.config();

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

const forkingConfig = {
        url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
        blockNumber: 7152609,
        // url: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
        // blockNumber: 21272700,
    };

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      hardfork: "merge", // https://ethereum.org/en/history/#paris
      forking: forkingConfig,
      chainId: 11155111,  // chainId must be the same as the forking network
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
