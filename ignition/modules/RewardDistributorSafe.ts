import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RewardDistributorSafeModule = buildModule("RewardDistributor", (m) => {
    const deployer = m.getAccount(0);
    const rd = m.contract("RewardDistributor",
        [m.getParameter("safe"), m.getParameter("posterFee"), m.getParameter("rewardToken")],
        {from: deployer}
    );

    return {rd };
});

export default RewardDistributorSafeModule;
