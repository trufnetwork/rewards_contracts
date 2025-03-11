import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("RewardDistributorSingletonModule", (m) => {
    const singleton = m.contract("RewardDistributor", []);
    return {singleton};
});
