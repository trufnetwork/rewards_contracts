import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("RewardDistributorSingletonModule", (m) => {
    const deployer = m.getAccount(1);
    const singleton = m.contract("RewardDistributor",
        [],
        {from: deployer});
    return {singleton};
});
