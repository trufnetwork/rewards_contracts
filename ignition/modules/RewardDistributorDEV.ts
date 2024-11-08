import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RewardDEVModule = buildModule("RewardDistributor", (m) => {


    const deployer = m.getAccount(1);
    const rd = m.contract("RewardDistributor",
        [m.getParameter("signers"),
            m.getParameter("threshold"),
            m.getParameter("posterFee"),
            m.getParameter("rewardToken")],
        {from: deployer}
    );

    return {rd};
});

export default RewardDEVModule;
