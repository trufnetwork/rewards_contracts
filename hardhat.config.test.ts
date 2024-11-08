import { HardhatUserConfig, vars } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// const ALCHEMY_API_KEY = vars.get("ALCHEMY_API_KEY");
// const SEPOLIA_PRIVATE_KEY = vars.get("SEPOLIA_PRIVATE_KEY");

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      hardfork: "merge", // https://ethereum.org/en/history/#paris
      gasPrice: 1000000000,
      mining: {
        auto: false,
        interval: 30000, // 30s
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
