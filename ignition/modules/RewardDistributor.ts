import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RewardDistributorModule = buildModule("RewardDistributor", (m) => {
    const rd = m.contract("RewardDistributor",
        [m.getParameter("safe"), m.getParameter("posterFee"), m.getParameter("rewardToken")]);

    return {rd};
});

export default RewardDistributorModule;
